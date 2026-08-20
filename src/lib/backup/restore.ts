import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { RestoreJobStatus, BackupType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifySchoolRoles } from "@/lib/notifications";
import type { BackupSnapshot } from "./types";
import { getBackupEncryptionKey } from "./crypto";
import { unpackBackup, verifyBackupIntegrity } from "./package";
import { checkBackupCompatibility, describeSnapshot, assertBackupBelongsToSchool } from "./compatibility";
import { runBackupJob } from "./engine";
import { getBackupStorage } from "./storage";
import { asInputJson } from "@/lib/json";

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createRestoreJob(opts: {
  schoolId: string;
  createdById?: string | null;
  backupJobId?: string | null;
  sourceType: "CLOUD" | "OFFLINE_UPLOAD";
}) {
  return prisma.restoreJob.create({
    data: {
      schoolId: opts.schoolId,
      createdById: opts.createdById ?? null,
      backupJobId: opts.backupJobId ?? null,
      sourceType: opts.sourceType,
      status: RestoreJobStatus.UPLOADING,
    },
  });
}

export async function validateRestorePackage(opts: {
  schoolId: string;
  restoreJobId: string;
  pkg: Buffer;
}) {
  await prisma.restoreJob.update({
    where: { id: opts.restoreJobId },
    data: { status: RestoreJobStatus.VALIDATING },
  });

  const integrity = verifyBackupIntegrity(opts.pkg);
  if (!integrity.ok || !integrity.manifest) {
    await prisma.restoreJob.update({
      where: { id: opts.restoreJobId },
      data: { status: RestoreJobStatus.FAILED, errorMessage: integrity.error ?? "Invalid backup" },
    });
    return { ok: false as const, error: integrity.error ?? "Invalid backup" };
  }

  const tenantError = assertBackupBelongsToSchool(integrity.manifest.institutionId, opts.schoolId);
  if (tenantError) {
    await prisma.restoreJob.update({
      where: { id: opts.restoreJobId },
      data: { status: RestoreJobStatus.FAILED, errorMessage: tenantError },
    });
    return { ok: false as const, error: tenantError };
  }

  const unpacked = unpackBackup(opts.pkg, getBackupEncryptionKey());
  if (!unpacked.ok) {
    const msg =
      unpacked.error === "decrypt"
        ? "Backup could not be decrypted. Confirm BACKUP_ENCRYPTION_KEY matches the key used to create it."
        : `Backup validation failed (${unpacked.error}).`;
    await prisma.restoreJob.update({
      where: { id: opts.restoreJobId },
      data: { status: RestoreJobStatus.FAILED, errorMessage: msg },
    });
    return { ok: false as const, error: msg };
  }

  const compat = checkBackupCompatibility(unpacked.manifest);
  let snapshot: BackupSnapshot;
  try {
    snapshot = JSON.parse(unpacked.plaintext.toString("utf8")) as BackupSnapshot;
  } catch {
    await prisma.restoreJob.update({
      where: { id: opts.restoreJobId },
      data: { status: RestoreJobStatus.FAILED, errorMessage: "Backup payload is not valid JSON" },
    });
    return { ok: false as const, error: "Backup payload is not valid JSON" };
  }

  const report = {
    manifest: unpacked.manifest,
    compatibility: compat,
    summary: describeSnapshot(snapshot),
  };

  await prisma.restoreJob.update({
    where: { id: opts.restoreJobId },
    data: {
      status: compat.ok ? RestoreJobStatus.READY : RestoreJobStatus.FAILED,
      validationReport: asInputJson(report),
      errorMessage: compat.ok ? null : compat.errors.join("; "),
    },
  });

  return { ok: compat.ok, report, snapshot, error: compat.errors[0] };
}

export async function executeRestore(opts: {
  schoolId: string;
  restoreJobId: string;
  snapshot: BackupSnapshot;
  preserveUserId?: string | null;
}) {
  const job = await prisma.restoreJob.update({
    where: { id: opts.restoreJobId },
    data: { status: RestoreJobStatus.RESTORING, startedAt: new Date() },
  });

  await logAudit({
    schoolId: opts.schoolId,
    userId: opts.preserveUserId,
    action: "RESTORE_STARTED",
    entity: "RestoreJob",
    entityId: job.id,
  });

  let preRestoreId: string | null = null;
  try {
    const pre = await runBackupJob({
      schoolId: opts.schoolId,
      type: BackupType.PRE_RESTORE,
      createdById: opts.preserveUserId,
    });
    preRestoreId = pre.jobId;
    await prisma.restoreJob.update({
      where: { id: job.id },
      data: { preRestoreBackupId: pre.jobId },
    });

    await replaceSchoolData(opts.schoolId, opts.snapshot, opts.preserveUserId ?? null);
    await restoreFiles(opts.snapshot);

    const learners = await prisma.student.count({ where: { schoolId: opts.schoolId } });
    if (learners !== opts.snapshot.students.length) {
      throw new Error("Restored learner count did not match the backup");
    }

    await prisma.restoreJob.update({
      where: { id: job.id },
      data: { status: RestoreJobStatus.COMPLETED, completedAt: new Date() },
    });
    await logAudit({
      schoolId: opts.schoolId,
      userId: opts.preserveUserId,
      action: "RESTORE_COMPLETED",
      entity: "RestoreJob",
      entityId: job.id,
    });
    await notifySchoolRoles({
      schoolId: opts.schoolId,
      roles: [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN],
      title: "Restore completed",
      message: "The selected backup was restored successfully.",
      type: "SUCCESS",
      link: "/admin/settings/backup",
    });
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    await prisma.restoreJob.update({
      where: { id: job.id },
      data: { status: RestoreJobStatus.FAILED, errorMessage: message, completedAt: new Date() },
    });
    await logAudit({
      schoolId: opts.schoolId,
      userId: opts.preserveUserId,
      action: "RESTORE_FAILED",
      entity: "RestoreJob",
      entityId: job.id,
      metadata: { reason: "failed" },
    });

    if (preRestoreId) {
      try {
        const storage = getBackupStorage();
        const pre = await prisma.backupJob.findUnique({ where: { id: preRestoreId } });
        if (pre?.storageKey) {
          const pkg = await storage.get(pre.storageKey);
          const unpacked = unpackBackup(pkg, getBackupEncryptionKey());
          if (unpacked.ok) {
            const snapshot = JSON.parse(unpacked.plaintext.toString("utf8")) as BackupSnapshot;
            await replaceSchoolData(opts.schoolId, snapshot, opts.preserveUserId ?? null);
            await prisma.restoreJob.update({
              where: { id: job.id },
              data: { status: RestoreJobStatus.ROLLED_BACK, errorMessage: message },
            });
          }
        }
      } catch {
        // leave FAILED if rollback also fails
      }
    }

    await notifySchoolRoles({
      schoolId: opts.schoolId,
      roles: [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN],
      title: "Restore failed",
      message: "A restore job failed. The system attempted to return to the pre-restore backup.",
      type: "WARNING",
      link: "/admin/settings/backup",
    });
    return { ok: false as const, error: message };
  }
}

async function restoreFiles(snapshot: BackupSnapshot) {
  for (const file of snapshot.files) {
    if (!file.relativePath.startsWith("uploads/")) continue;
    const dest = path.join(process.cwd(), "public", file.relativePath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(file.contentBase64, "base64"));
  }
}

async function replaceSchoolData(
  schoolId: string,
  snapshot: BackupSnapshot,
  preserveUserId: string | null
) {
  await prisma.$transaction(async (tx) => {
    await tx.studentAbsenceRequest.deleteMany({ where: { schoolId } });
    await tx.teacherReview.deleteMany({ where: { schoolId } });
    await tx.lessonPlan.deleteMany({ where: { schoolId } });
    await tx.curriculumTopic.deleteMany({ where: { schoolId } });
    await tx.payslip.deleteMany({ where: { item: { run: { schoolId } } } });
    await tx.payrollItem.deleteMany({ where: { run: { schoolId } } });
    await tx.payrollRun.deleteMany({ where: { schoolId } });
    await tx.payrollRuleSet.deleteMany({ where: { schoolId } });
    await tx.timesheetEntry.deleteMany({ where: { timesheet: { employee: { schoolId } } } });
    await tx.timesheet.deleteMany({ where: { employee: { schoolId } } });
    await tx.leaveEntitlement.deleteMany({ where: { employee: { schoolId } } });
    await tx.employeeDocument.deleteMany({ where: { employee: { schoolId } } });
    await tx.employmentContract.deleteMany({ where: { employee: { schoolId } } });
    await tx.salaryStructure.deleteMany({ where: { employee: { schoolId } } });
    await tx.paymentAllocation.deleteMany({ where: { schoolId } });
    await tx.chargeInstalment.deleteMany({ where: { charge: { schoolId } } });
    await tx.studentCharge.deleteMany({ where: { schoolId } });
    await tx.creditNote.deleteMany({ where: { schoolId } });
    await tx.refund.deleteMany({ where: { schoolId } });
    await tx.studentAidAward.deleteMany({ where: { schoolId } });
    await tx.expense.deleteMany({ where: { schoolId } });
    await tx.otherIncome.deleteMany({ where: { schoolId } });
    await tx.recurringExpense.deleteMany({ where: { schoolId } });
    await tx.feeStructure.deleteMany({ where: { schoolId } });
    await tx.enrolmentModule.deleteMany({ where: { enrolment: { student: { schoolId } } } });
    await tx.employee.deleteMany({ where: { schoolId } });
    await tx.leavePolicy.deleteMany({ where: { schoolId } });
    await tx.supplier.deleteMany({ where: { schoolId } });
    await tx.expenseCategory.deleteMany({ where: { schoolId } });
    await tx.incomeCategory.deleteMany({ where: { schoolId } });
    await tx.financialAccount.deleteMany({ where: { schoolId } });
    await tx.feeReminderDispatch.deleteMany({ where: { schoolId } });
    await tx.payment.deleteMany({ where: { invoice: { schoolId } } });
    await tx.invoiceLineItem.deleteMany({ where: { invoice: { schoolId } } });
    await tx.studentLedgerEntry.deleteMany({ where: { schoolId } });
    await tx.invoice.deleteMany({ where: { schoolId } });
    await tx.feeReminderRule.deleteMany({ where: { schoolId } });
    await tx.feeScheduleItem.deleteMany({ where: { schoolId } });
    await tx.examAnswer.deleteMany({ where: { attempt: { student: { schoolId } } } });
    await tx.examAttempt.deleteMany({ where: { student: { schoolId } } });
    await tx.examQuestion.deleteMany({
      where: {
        OR: [
          { assessment: { subject: { schoolId } } },
          { assessment: { module: { course: { schoolId } } } },
        ],
      },
    });
    await tx.schoolEvent.deleteMany({ where: { schoolId } });
    await tx.assignmentSubmission.deleteMany({ where: { student: { schoolId } } });
    await tx.mark.deleteMany({ where: { student: { schoolId } } });
    await tx.assignment.deleteMany({
      where: {
        assessment: {
          OR: [{ subject: { schoolId } }, { module: { course: { schoolId } } }],
        },
      },
    });
    await tx.assessment.deleteMany({
      where: {
        OR: [{ subject: { schoolId } }, { module: { course: { schoolId } } }],
      },
    });
    await tx.attendanceRecord.deleteMany({ where: { student: { schoolId } } });
    await tx.reportCard.deleteMany({ where: { student: { schoolId } } });
    await tx.issuedLetter.deleteMany({ where: { schoolId } });
    await tx.certificate.deleteMany({ where: { schoolId } });
    await tx.enrolment.deleteMany({ where: { student: { schoolId } } });
    await tx.studentGuardian.deleteMany({ where: { student: { schoolId } } });
    await tx.timetableSlot.deleteMany({ where: { class: { schoolId } } });
    await tx.classSubject.deleteMany({ where: { class: { schoolId } } });
    await tx.classTeacher.deleteMany({ where: { class: { schoolId } } });
    await tx.communicationLog.deleteMany({ where: { schoolId } });
    await tx.communicationBatch.deleteMany({ where: { schoolId } });
    await tx.leaveRequest.deleteMany({ where: { schoolId } });
    await tx.staffAttendanceRecord.deleteMany({ where: { schoolId } });
    await tx.ledgerEntry.deleteMany({ where: { schoolId } });
    await tx.document.deleteMany({ where: { schoolId } });
    await tx.announcement.deleteMany({ where: { schoolId } });
    await tx.application.deleteMany({ where: { schoolId } });
    await tx.student.deleteMany({ where: { schoolId } });
    await tx.teacher.deleteMany({ where: { schoolId } });
    await tx.guardian.deleteMany({ where: { schoolId } });
    await tx.class.deleteMany({ where: { schoolId } });
    await tx.module.deleteMany({ where: { course: { schoolId } } });
    await tx.course.deleteMany({ where: { schoolId } });
    await tx.subject.deleteMany({ where: { schoolId } });
    await tx.grade.deleteMany({ where: { schoolId } });
    await tx.term.deleteMany({ where: { academicYear: { schoolId } } });
    await tx.academicYear.deleteMany({ where: { schoolId } });
    await tx.campus.deleteMany({ where: { schoolId } });
    await tx.user.deleteMany({
      where: {
        schoolId,
        ...(preserveUserId ? { id: { not: preserveUserId } } : {}),
      },
    });

    const school = snapshot.school;
    await tx.school.update({
      where: { id: schoolId },
      data: {
        name: String(school.name ?? "School"),
        email: (school.email as string | null) ?? null,
        phone: (school.phone as string | null) ?? null,
        website: (school.website as string | null) ?? null,
        address: (school.address as string | null) ?? null,
        city: (school.city as string | null) ?? null,
        province: (school.province as string | null) ?? null,
        postalCode: (school.postalCode as string | null) ?? null,
        popiaConsentText: (school.popiaConsentText as string | null) ?? null,
        logoUrl: (school.logoUrl as string | null) ?? null,
        primaryColor: (school.primaryColor as string | null) ?? null,
        accentColor: (school.accentColor as string | null) ?? null,
        heroHeadline: (school.heroHeadline as string | null) ?? null,
        heroSubtitle: (school.heroSubtitle as string | null) ?? null,
        aboutText: (school.aboutText as string | null) ?? null,
        missionText: (school.missionText as string | null) ?? null,
        admissionsText: (school.admissionsText as string | null) ?? null,
        requireFeesPaidForDocuments: school.requireFeesPaidForDocuments !== false,
      },
    });

    const createManyIgnore = async (
      delegate: { createMany: (args: never) => Promise<unknown> },
      rows: Record<string, unknown>[]
    ) => {
      if (!rows.length) return;
      const data = rows.map((row) => {
        const copy = { ...row };
        for (const [k, v] of Object.entries(copy)) {
          if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && (k.endsWith("At") || k.endsWith("Date") || k.endsWith("From") || k.endsWith("To") || k === "date" || k === "paidAt" || k === "dueDate" || k === "issuedAt" || k === "entryDate" || k === "periodStart" || k === "periodEnd" || k === "effectiveFrom")) {
            copy[k] = asDate(v);
          }
        }
        return copy;
      });
      await delegate.createMany({ data, skipDuplicates: true } as never);
    };

    await createManyIgnore(tx.campus, snapshot.campuses);
    const users = snapshot.users.filter((u) => u.id !== preserveUserId);
    if (users.length) await createManyIgnore(tx.user, users);
    await createManyIgnore(tx.academicYear, snapshot.academicYears);
    await createManyIgnore(tx.term, snapshot.terms);
    await createManyIgnore(tx.grade, snapshot.grades);
    await createManyIgnore(tx.subject, snapshot.subjects);
    await createManyIgnore(tx.course, snapshot.courses);
    await createManyIgnore(tx.module, snapshot.modules);
    await createManyIgnore(tx.class, snapshot.classes);
    await createManyIgnore(tx.classSubject, snapshot.classSubjects);
    await createManyIgnore(tx.classTeacher, snapshot.classTeachers);
    await createManyIgnore(tx.student, snapshot.students);
    await createManyIgnore(tx.studentDocument, snapshot.studentDocuments ?? []);
    await createManyIgnore(tx.teacher, snapshot.teachers);
    await createManyIgnore(tx.guardian, snapshot.guardians);
    await createManyIgnore(tx.studentGuardian, snapshot.studentGuardians);
    await createManyIgnore(tx.enrolment, snapshot.enrolments);
    await createManyIgnore(tx.application, snapshot.applications);
    await createManyIgnore(tx.attendanceRecord, snapshot.attendanceRecords);
    await createManyIgnore(tx.timetableSlot, snapshot.timetableSlots);
    await createManyIgnore(tx.assessment, snapshot.assessments);
    await createManyIgnore(
      tx.examQuestion,
      (snapshot.examQuestions ?? []).map((row) => ({
        ...row,
        ...(row.options !== undefined && row.options !== null
          ? { options: asInputJson(row.options) }
          : {}),
      }))
    );
    await createManyIgnore(tx.examAttempt, snapshot.examAttempts ?? []);
    await createManyIgnore(tx.examAnswer, snapshot.examAnswers ?? []);
    await createManyIgnore(tx.assignment, snapshot.assignments);
    await createManyIgnore(tx.assignmentSubmission, snapshot.assignmentSubmissions);
    await createManyIgnore(tx.mark, snapshot.marks);
    await createManyIgnore(tx.reportCard, snapshot.reportCards);
    await createManyIgnore(tx.invoice, snapshot.invoices);
    await createManyIgnore(tx.invoiceLineItem, snapshot.invoiceLineItems);
    await createManyIgnore(tx.payment, snapshot.payments);
    await createManyIgnore(tx.feeScheduleItem, snapshot.feeScheduleItems);
    await createManyIgnore(tx.feeReminderRule, snapshot.feeReminderRules);
    await createManyIgnore(tx.document, snapshot.documents);
    await createManyIgnore(tx.announcement, snapshot.announcements);
    await createManyIgnore(tx.schoolEvent, snapshot.schoolEvents ?? []);
    await createManyIgnore(tx.certificate, snapshot.certificates);
    await createManyIgnore(tx.issuedLetter, snapshot.issuedLetters ?? []);
    await createManyIgnore(tx.leavePolicy, snapshot.leavePolicies ?? []);
    await createManyIgnore(tx.employee, snapshot.employees ?? []);
    await createManyIgnore(tx.staffAttendanceRecord, snapshot.staffAttendanceRecords);
    await createManyIgnore(tx.leaveRequest, snapshot.leaveRequests);
    await createManyIgnore(tx.employmentContract, snapshot.employmentContracts ?? []);
    await createManyIgnore(tx.salaryStructure, snapshot.salaryStructures ?? []);
    await createManyIgnore(tx.employeeDocument, snapshot.employeeDocuments ?? []);
    await createManyIgnore(tx.leaveEntitlement, snapshot.leaveEntitlements ?? []);
    await createManyIgnore(tx.timesheet, snapshot.timesheets ?? []);
    await createManyIgnore(tx.timesheetEntry, snapshot.timesheetEntries ?? []);
    await createManyIgnore(tx.enrolmentModule, snapshot.enrolmentModules ?? []);
    await createManyIgnore(tx.feeStructure, snapshot.feeStructures ?? []);
    await createManyIgnore(tx.studentCharge, snapshot.studentCharges ?? []);
    await createManyIgnore(tx.chargeInstalment, snapshot.chargeInstalments ?? []);
    await createManyIgnore(tx.paymentAllocation, snapshot.paymentAllocations ?? []);
    await createManyIgnore(tx.creditNote, snapshot.creditNotes ?? []);
    await createManyIgnore(tx.refund, snapshot.refunds ?? []);
    await createManyIgnore(tx.studentAidAward, snapshot.studentAidAwards ?? []);
    await createManyIgnore(tx.supplier, snapshot.suppliers ?? []);
    await createManyIgnore(tx.expenseCategory, snapshot.expenseCategories ?? []);
    await createManyIgnore(tx.incomeCategory, snapshot.incomeCategories ?? []);
    await createManyIgnore(tx.financialAccount, snapshot.financialAccounts ?? []);
    await createManyIgnore(tx.recurringExpense, snapshot.recurringExpenses ?? []);
    await createManyIgnore(tx.expense, snapshot.expenses ?? []);
    await createManyIgnore(tx.otherIncome, snapshot.otherIncomes ?? []);
    await createManyIgnore(tx.payrollRuleSet, snapshot.payrollRuleSets ?? []);
    await createManyIgnore(tx.payrollRun, snapshot.payrollRuns ?? []);
    await createManyIgnore(tx.payrollItem, snapshot.payrollItems ?? []);
    await createManyIgnore(tx.payslip, snapshot.payslips ?? []);
    await createManyIgnore(tx.ledgerEntry, snapshot.ledgerEntries);
    await createManyIgnore(tx.studentLedgerEntry, snapshot.studentLedgerEntries);
    await createManyIgnore(tx.communicationBatch, snapshot.communicationBatches);
    await createManyIgnore(tx.communicationLog, snapshot.communicationLogs);
    await createManyIgnore(tx.studentAbsenceRequest, snapshot.studentAbsenceRequests ?? []);
    await createManyIgnore(tx.teacherReview, snapshot.teacherReviews ?? []);
    await createManyIgnore(tx.lessonPlan, snapshot.lessonPlans ?? []);
    await createManyIgnore(tx.curriculumTopic, snapshot.curriculumTopics ?? []);
    await createManyIgnore(tx.visitorEntry, snapshot.visitorEntries ?? []);
  }, { timeout: 120_000 });
}
