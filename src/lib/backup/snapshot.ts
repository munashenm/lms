import { prisma } from "@/lib/db";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { SECRET_BACKUP_FIELDS, type BackupSnapshot } from "./types";

function stripSecrets<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const field of SECRET_BACKUP_FIELDS) {
    if (field in copy) {
      (copy as Record<string, unknown>)[field] = null;
    }
  }
  return copy;
}

function omitKey<T extends Record<string, unknown>>(row: T, key: keyof T): Record<string, unknown> {
  const copy = { ...row };
  delete copy[key];
  return copy;
}

function omitKeys<T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): Record<string, unknown> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as T;
}

async function collectUploads(schoolId: string): Promise<BackupSnapshot["files"]> {
  const roots = [
    path.join(process.cwd(), "public", "uploads", schoolId),
  ];
  const files: BackupSnapshot["files"] = [];
  for (const root of roots) {
    await walkFiles(root, root, files);
  }
  return files;
}

async function walkFiles(
  root: string,
  current: string,
  out: BackupSnapshot["files"]
) {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(root, full, out);
      continue;
    }
    const info = await stat(full);
    if (info.size > 25 * 1024 * 1024) continue;
    const buf = await readFile(full);
    out.push({
      relativePath: path.relative(path.join(process.cwd(), "public"), full).replace(/\\/g, "/"),
      contentBase64: buf.toString("base64"),
    });
  }
}

export async function buildSchoolSnapshot(schoolId: string): Promise<BackupSnapshot> {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error("School not found");

  const [
    campuses,
    users,
    academicYears,
    grades,
    subjects,
    courses,
    classes,
    students,
    teachers,
    guardians,
    applications,
    documents,
    announcements,
    certificates,
    leaveRequests,
    ledgerEntries,
    studentLedgerEntries,
    communicationLogs,
    communicationBatches,
    auditLogs,
    invoices,
    feeScheduleItems,
    feeReminderRules,
    staffAttendanceRecords,
  ] = await Promise.all([
    prisma.campus.findMany({ where: { schoolId } }),
    prisma.user.findMany({ where: { schoolId } }),
    prisma.academicYear.findMany({ where: { schoolId }, include: { terms: true } }),
    prisma.grade.findMany({ where: { schoolId } }),
    prisma.subject.findMany({ where: { schoolId } }),
    prisma.course.findMany({ where: { schoolId }, include: { modules: true } }),
    prisma.class.findMany({
      where: { schoolId },
      include: { classSubjects: true, classTeachers: true },
    }),
    prisma.student.findMany({ where: { schoolId } }),
    prisma.teacher.findMany({ where: { schoolId } }),
    prisma.guardian.findMany({ where: { schoolId }, include: { students: true } }),
    prisma.application.findMany({ where: { schoolId } }),
    prisma.document.findMany({ where: { schoolId } }),
    prisma.announcement.findMany({ where: { schoolId } }),
    prisma.certificate.findMany({ where: { schoolId } }),
    prisma.leaveRequest.findMany({ where: { schoolId } }),
    prisma.ledgerEntry.findMany({ where: { schoolId } }),
    prisma.studentLedgerEntry.findMany({ where: { schoolId } }),
    prisma.communicationLog.findMany({ where: { schoolId } }),
    prisma.communicationBatch.findMany({ where: { schoolId } }),
    prisma.auditLog.findMany({ where: { schoolId }, take: 5000, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({
      where: { schoolId },
      include: { lineItems: true, payments: true },
    }),
    prisma.feeScheduleItem.findMany({ where: { schoolId } }),
    prisma.feeReminderRule.findMany({ where: { schoolId } }),
    prisma.staffAttendanceRecord.findMany({ where: { schoolId } }),
  ]);

  const yearIds = academicYears.map((y) => y.id);
  const classIds = classes.map((c) => c.id);
  const studentIds = students.map((s) => s.id);
  const subjectIds = subjects.map((s) => s.id);
  const moduleIds = courses.flatMap((c) => c.modules.map((m) => m.id));
  const termIds = academicYears.flatMap((y) => y.terms.map((t) => t.id));

  const [enrolments, attendanceRecords, timetableSlots, assessments] = await Promise.all([
    prisma.enrolment.findMany({
      where: { academicYearId: { in: yearIds.length ? yearIds : ["__none__"] } },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds.length ? studentIds : ["__none__"] } },
    }),
    prisma.timetableSlot.findMany({
      where: { classId: { in: classIds.length ? classIds : ["__none__"] } },
    }),
    prisma.assessment.findMany({
      where: {
        OR: [
          { subjectId: { in: subjectIds.length ? subjectIds : ["__none__"] } },
          { moduleId: { in: moduleIds.length ? moduleIds : ["__none__"] } },
          { termId: { in: termIds.length ? termIds : ["__none__"] } },
        ],
      },
      include: { assignment: { include: { submissions: true } }, marks: true },
    }),
  ]);

  const reportCards = await prisma.reportCard.findMany({
    where: { studentId: { in: studentIds.length ? studentIds : ["__none__"] } },
  });

  const [
    feeStructures,
    studentCharges,
    suppliers,
    expenseCategories,
    incomeCategories,
    financialAccounts,
    expenses,
    recurringExpenses,
    otherIncomes,
    employees,
    leavePolicies,
    payrollRuleSets,
    payrollRuns,
    creditNotes,
    refunds,
    studentAidAwards,
    paymentAllocations,
  ] = await Promise.all([
    prisma.feeStructure.findMany({ where: { schoolId } }),
    prisma.studentCharge.findMany({ where: { schoolId }, include: { instalments: true } }),
    prisma.supplier.findMany({ where: { schoolId } }),
    prisma.expenseCategory.findMany({ where: { schoolId } }),
    prisma.incomeCategory.findMany({ where: { schoolId } }),
    prisma.financialAccount.findMany({ where: { schoolId } }),
    prisma.expense.findMany({ where: { schoolId } }),
    prisma.recurringExpense.findMany({ where: { schoolId } }),
    prisma.otherIncome.findMany({ where: { schoolId } }),
    prisma.employee.findMany({
      where: { schoolId },
      include: { contracts: true, salaryStructures: true, documents: true, leaveEntitlements: true, timesheets: { include: { entries: true } } },
    }),
    prisma.leavePolicy.findMany({ where: { schoolId } }),
    prisma.payrollRuleSet.findMany({ where: { schoolId } }),
    prisma.payrollRun.findMany({
      where: { schoolId },
      include: { items: { include: { payslip: true } } },
    }),
    prisma.creditNote.findMany({ where: { schoolId } }),
    prisma.refund.findMany({ where: { schoolId } }),
    prisma.studentAidAward.findMany({ where: { schoolId } }),
    prisma.paymentAllocation.findMany({ where: { schoolId } }),
  ]);

  const enrolmentModules = await prisma.enrolmentModule.findMany({
    where: { enrolment: { student: { schoolId } } },
  });

  const files = await collectUploads(schoolId);

  const snapshot: BackupSnapshot = {
    school: jsonSafe(stripSecrets(school as unknown as Record<string, unknown>)),
    campuses: jsonSafe(campuses),
    users: jsonSafe(
      users.map((u) =>
        stripSecrets({
          ...u,
          passwordResetTokenHash: null,
          passwordResetExpires: null,
        } as unknown as Record<string, unknown>)
      )
    ),
    academicYears: jsonSafe(academicYears.map((y) => omitKey(y as unknown as Record<string, unknown>, "terms"))),
    terms: jsonSafe(academicYears.flatMap((y) => y.terms)),
    grades: jsonSafe(grades),
    subjects: jsonSafe(subjects),
    courses: jsonSafe(courses.map((c) => omitKey(c as unknown as Record<string, unknown>, "modules"))),
    modules: jsonSafe(courses.flatMap((c) => c.modules)),
    classes: jsonSafe(classes.map((c) => omitKeys(c as unknown as Record<string, unknown>, ["classSubjects", "classTeachers"]))),
    classSubjects: jsonSafe(classes.flatMap((c) => c.classSubjects)),
    classTeachers: jsonSafe(classes.flatMap((c) => c.classTeachers)),
    students: jsonSafe(students),
    teachers: jsonSafe(teachers),
    guardians: jsonSafe(guardians.map((g) => omitKey(g as unknown as Record<string, unknown>, "students"))),
    studentGuardians: jsonSafe(guardians.flatMap((g) => g.students)),
    enrolments: jsonSafe(enrolments),
    applications: jsonSafe(applications),
    attendanceRecords: jsonSafe(attendanceRecords),
    staffAttendanceRecords: jsonSafe(staffAttendanceRecords),
    timetableSlots: jsonSafe(timetableSlots),
    assessments: jsonSafe(assessments.map((a) => omitKeys(a as unknown as Record<string, unknown>, ["assignment", "marks"]))),
    assignments: jsonSafe(
      assessments.flatMap((a) => (a.assignment ? [{ ...a.assignment, submissions: undefined }] : []))
    ),
    assignmentSubmissions: jsonSafe(
      assessments.flatMap((a) => a.assignment?.submissions ?? [])
    ),
    marks: jsonSafe(assessments.flatMap((a) => a.marks)),
    reportCards: jsonSafe(reportCards),
    invoices: jsonSafe(invoices.map((i) => omitKeys(i as unknown as Record<string, unknown>, ["lineItems", "payments"]))),
    invoiceLineItems: jsonSafe(invoices.flatMap((i) => i.lineItems)),
    payments: jsonSafe(invoices.flatMap((i) => i.payments)),
    feeScheduleItems: jsonSafe(feeScheduleItems),
    feeReminderRules: jsonSafe(feeReminderRules),
    documents: jsonSafe(documents),
    announcements: jsonSafe(announcements),
    certificates: jsonSafe(certificates),
    leaveRequests: jsonSafe(
      leaveRequests.map((r) => ({ ...r, sickNoteUrl: r.sickNoteUrl }))
    ),
    ledgerEntries: jsonSafe(ledgerEntries),
    studentLedgerEntries: jsonSafe(studentLedgerEntries),
    communicationLogs: jsonSafe(communicationLogs),
    communicationBatches: jsonSafe(communicationBatches),
    auditLogs: jsonSafe(auditLogs),
    feeStructures: jsonSafe(feeStructures),
    studentCharges: jsonSafe(studentCharges.map((c) => omitKey(c as unknown as Record<string, unknown>, "instalments"))),
    chargeInstalments: jsonSafe(studentCharges.flatMap((c) => c.instalments)),
    paymentAllocations: jsonSafe(paymentAllocations),
    creditNotes: jsonSafe(creditNotes),
    refunds: jsonSafe(refunds),
    studentAidAwards: jsonSafe(studentAidAwards),
    suppliers: jsonSafe(suppliers),
    expenseCategories: jsonSafe(expenseCategories),
    incomeCategories: jsonSafe(incomeCategories),
    financialAccounts: jsonSafe(financialAccounts),
    expenses: jsonSafe(expenses),
    recurringExpenses: jsonSafe(recurringExpenses),
    otherIncomes: jsonSafe(otherIncomes),
    employees: jsonSafe(employees.map((e) => omitKeys(e as unknown as Record<string, unknown>, ["contracts", "salaryStructures", "documents", "leaveEntitlements", "timesheets"]))),
    employmentContracts: jsonSafe(employees.flatMap((e) => e.contracts)),
    salaryStructures: jsonSafe(employees.flatMap((e) => e.salaryStructures)),
    employeeDocuments: jsonSafe(employees.flatMap((e) => e.documents)),
    leavePolicies: jsonSafe(leavePolicies),
    leaveEntitlements: jsonSafe(employees.flatMap((e) => e.leaveEntitlements)),
    timesheets: jsonSafe(employees.flatMap((e) => e.timesheets.map((t) => omitKey(t as unknown as Record<string, unknown>, "entries")))),
    timesheetEntries: jsonSafe(employees.flatMap((e) => e.timesheets.flatMap((t) => t.entries))),
    payrollRuleSets: jsonSafe(payrollRuleSets),
    payrollRuns: jsonSafe(payrollRuns.map((r) => omitKey(r as unknown as Record<string, unknown>, "items"))),
    payrollItems: jsonSafe(payrollRuns.flatMap((r) => r.items.map((i) => omitKey(i as unknown as Record<string, unknown>, "payslip")))),
    payslips: jsonSafe(payrollRuns.flatMap((r) => r.items.flatMap((i) => (i.payslip ? [i.payslip] : [])))),
    enrolmentModules: jsonSafe(enrolmentModules),
    files,
  };

  return snapshot;
}

export function snapshotCounts(snapshot: BackupSnapshot) {
  return {
    learnerCount: snapshot.students.length,
    userCount: snapshot.users.length,
    fileCount: snapshot.files.length,
  };
}

export const SCHEMA_VERSION = "20260819080000_finance_hr_payroll";
export const APP_VERSION = process.env.npm_package_version || "0.1.0";
