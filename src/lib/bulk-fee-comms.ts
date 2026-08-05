import {
  CommunicationBatchStatus,
  CommunicationCategory,
  CommunicationChannel,
  CommunicationStatus,
  StudentStatus,
} from "@prisma/client";
import { prisma } from "./db";
import { getOutstandingBalance } from "./finance";
import { formatDate, formatZAR } from "./utils";
import { logCommunication } from "./communications";
import { generateFeeStatementPdf } from "./pdf-fee-statement";
import { toSchoolBrand, type SchoolBrand } from "./pdf-branding";
import { getStudentLedger, STUDENT_LEDGER_TYPE_LABELS } from "./student-ledger";
import { createTwilioSmsProvider } from "./sms/twilio-provider";
import {
  getResolvedIntegrations,
  isSendGridReady,
  isTwilioReady,
} from "./school-integrations";
import { sendEmailViaSendGrid } from "./outbound-messaging";

export type BulkChannel = "EMAIL" | "SMS" | "BOTH";
export type BulkAction = "FEE_REMINDER" | "FEE_STATEMENT";

export type OutstandingStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeId: string | null;
  gradeName: string | null;
  className: string | null;
  outstanding: number;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
};

export async function listOutstandingFeeStudents(params: {
  schoolId: string;
  gradeId?: string | null;
  minBalance?: number;
}): Promise<OutstandingStudent[]> {
  const minBalance = params.minBalance ?? 0.01;

  const students = await prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      status: StudentStatus.ACTIVE,
      ...(params.gradeId ? { gradeId: params.gradeId } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      gradeId: true,
      email: true,
      grade: { select: { name: true } },
      class: { select: { name: true } },
      guardians: {
        orderBy: { isPrimary: "desc" },
        take: 1,
        include: {
          guardian: {
            select: { firstName: true, lastName: true, phone: true, email: true },
          },
        },
      },
      invoices: {
        where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
        select: { total: true, amountPaid: true },
      },
    },
  });

  const ledgerBalances = await prisma.studentLedgerEntry.groupBy({
    by: ["studentId"],
    where: {
      schoolId: params.schoolId,
      studentId: { in: students.map((s) => s.id) },
    },
    _sum: { signedAmount: true },
  });
  const ledgerMap = new Map(
    ledgerBalances.map((row) => [row.studentId, Number(row._sum.signedAmount ?? 0)])
  );

  const rows: OutstandingStudent[] = [];

  for (const student of students) {
    const ledgerBalance = ledgerMap.get(student.id);
    const invoiceOutstanding = student.invoices.reduce(
      (sum, inv) =>
        sum + getOutstandingBalance(Number(inv.total), Number(inv.amountPaid)),
      0
    );
    const outstanding =
      ledgerBalance !== undefined && Math.abs(ledgerBalance) > 0.001
        ? Math.max(0, ledgerBalance)
        : invoiceOutstanding;

    if (outstanding < minBalance) continue;

    const guardian = student.guardians[0]?.guardian;
    rows.push({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      studentNumber: student.studentNumber,
      gradeId: student.gradeId,
      gradeName: student.grade?.name ?? null,
      className: student.class?.name ?? null,
      outstanding,
      guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
      guardianPhone: guardian?.phone ?? null,
      guardianEmail: guardian?.email ?? student.email ?? null,
    });
  }

  return rows.sort((a, b) => b.outstanding - a.outstanding);
}

function reminderMessage(
  schoolName: string,
  student: OutstandingStudent,
  channel: "email" | "sms"
) {
  const balance = formatZAR(student.outstanding);
  if (channel === "sms") {
    return `Dear Parent/Guardian, your current outstanding school fee balance for ${student.firstName} ${student.lastName} is ${balance}. Kindly arrange payment or contact the school accounts office. Thank you. — ${schoolName}`;
  }
  return `Dear ${student.guardianName ?? "Parent/Guardian"},

Please be advised that the current outstanding school fee balance for ${student.firstName} ${student.lastName} (${student.studentNumber}) is ${balance}.

Kindly arrange payment or contact the accounts office if you require assistance.

Kind regards,
${schoolName} Accounts Department`;
}

export async function createFeeCommsBatch(params: {
  schoolId: string;
  action: BulkAction;
  channel: BulkChannel;
  gradeId?: string | null;
  minBalance?: number;
  studentIds?: string[];
  createdById?: string | null;
}) {
  const school = await prisma.school.findUnique({ where: { id: params.schoolId } });
  if (!school) throw new Error("School not found");

  let students = await listOutstandingFeeStudents({
    schoolId: params.schoolId,
    gradeId: params.gradeId,
    minBalance: params.minBalance,
  });

  if (params.studentIds?.length) {
    const allow = new Set(params.studentIds);
    students = students.filter((s) => allow.has(s.studentId));
  }

  const channels: CommunicationChannel[] =
    params.channel === "BOTH"
      ? [CommunicationChannel.EMAIL, CommunicationChannel.SMS]
      : params.channel === "SMS"
        ? [CommunicationChannel.SMS]
        : [CommunicationChannel.EMAIL];

  const category =
    params.action === "FEE_STATEMENT"
      ? CommunicationCategory.FEE_STATEMENT
      : CommunicationCategory.FEE_REMINDER;

  const batch = await prisma.communicationBatch.create({
    data: {
      schoolId: params.schoolId,
      category,
      channel: channels[0],
      status: CommunicationBatchStatus.PENDING,
      filters: {
        action: params.action,
        channel: params.channel,
        gradeId: params.gradeId ?? null,
        minBalance: params.minBalance ?? 0.01,
        studentCount: students.length,
      },
      createdById: params.createdById ?? null,
    },
  });

  let queued = 0;

  for (const student of students) {
    for (const channel of channels) {
      const contact =
        channel === CommunicationChannel.SMS
          ? student.guardianPhone
          : student.guardianEmail;

      const subject =
        params.action === "FEE_STATEMENT"
          ? `School Fee Statement – ${student.firstName} ${student.lastName}`
          : `School Fee Reminder – ${student.firstName} ${student.lastName}`;
      const message = reminderMessage(
        school.name,
        student,
        channel === CommunicationChannel.SMS ? "sms" : "email"
      );

      if (!contact) {
        await logCommunication({
          schoolId: params.schoolId,
          batchId: batch.id,
          studentId: student.studentId,
          channel,
          category,
          status: CommunicationStatus.FAILED,
          recipientName: student.guardianName,
          recipientContact: "missing",
          subject,
          message,
          error:
            channel === CommunicationChannel.SMS
              ? "No guardian phone on file"
              : "No guardian/student email on file",
          metadata: { outstanding: student.outstanding, action: params.action },
        });
        continue;
      }

      await logCommunication({
        schoolId: params.schoolId,
        batchId: batch.id,
        studentId: student.studentId,
        channel,
        category,
        status: CommunicationStatus.QUEUED,
        recipientName: student.guardianName,
        recipientContact: contact,
        subject,
        message,
        metadata: { outstanding: student.outstanding, action: params.action },
      });
      queued += 1;
    }
  }

  const failedCount = await prisma.communicationLog.count({
    where: { batchId: batch.id, status: CommunicationStatus.FAILED },
  });

  return prisma.communicationBatch.update({
    where: { id: batch.id },
    data: {
      totalCount: queued + failedCount,
      queuedCount: queued,
      failedCount,
      status:
        queued > 0
          ? CommunicationBatchStatus.PENDING
          : CommunicationBatchStatus.COMPLETED,
      completedAt: queued > 0 ? null : new Date(),
    },
  });
}

async function buildStatementAttachment(studentId: string, brand: SchoolBrand) {
  const ledger = await getStudentLedger({ studentId });
  if (!ledger.student) return null;

  const chronological = [...ledger.entries].reverse();
  const pdf = await generateFeeStatementPdf({
    brand,
    studentName: `${ledger.student.firstName} ${ledger.student.lastName}`,
    studentNumber: ledger.student.studentNumber,
    gradeOrProgramme: [ledger.student.grade?.name, ledger.student.class?.name]
      .filter(Boolean)
      .join(" / "),
    generatedAt: formatDate(new Date()),
    openingBalance: 0,
    balance: ledger.balance,
    lines: chronological.map((e) => ({
      date: formatDate(e.entryDate),
      description: e.description,
      type: STUDENT_LEDGER_TYPE_LABELS[e.type],
      amount: e.signedAmount,
    })),
  });

  return {
    filename: `fee-statement-${ledger.student.studentNumber}.pdf`,
    type: "application/pdf",
    contentBase64: Buffer.from(pdf).toString("base64"),
    balance: ledger.balance,
  };
}

export async function processCommunicationBatch(batchId: string, limit = 15) {
  const batch = await prisma.communicationBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch not found");

  const school = await prisma.school.findUnique({ where: { id: batch.schoolId } });
  if (!school) throw new Error("School not found");

  await prisma.communicationBatch.update({
    where: { id: batchId },
    data: { status: CommunicationBatchStatus.PROCESSING },
  });

  const queued = await prisma.communicationLog.findMany({
    where: { batchId, status: CommunicationStatus.QUEUED },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const item of queued) {
    const action =
      ((item.metadata as { action?: BulkAction } | null)?.action as BulkAction | undefined) ??
      (item.category === CommunicationCategory.FEE_STATEMENT
        ? "FEE_STATEMENT"
        : "FEE_REMINDER");

    try {
      if (item.channel === CommunicationChannel.SMS) {
        const config = await getResolvedIntegrations(item.schoolId);
        if (!isTwilioReady(config)) {
          await prisma.communicationLog.update({
            where: { id: item.id },
            data: {
              status: CommunicationStatus.FAILED,
              error: "SMS provider not configured",
            },
          });
          failed += 1;
          continue;
        }
        const result = await createTwilioSmsProvider(config).send(
          item.recipientContact,
          item.message
        );
        await prisma.communicationLog.update({
          where: { id: item.id },
          data: {
            status: result.sent ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
            error: result.sent ? null : result.reason,
          },
        });
        if (result.sent) sent += 1;
        else failed += 1;
      } else {
        const config = await getResolvedIntegrations(item.schoolId);
        if (!isSendGridReady(config)) {
          await prisma.communicationLog.update({
            where: { id: item.id },
            data: {
              status: CommunicationStatus.FAILED,
              error: "Email provider not configured",
            },
          });
          failed += 1;
          continue;
        }

        let attachments:
          | { filename: string; type: string; contentBase64: string }[]
          | undefined;
        let message = item.message;

        if (action === "FEE_STATEMENT" && item.studentId) {
          const attachment = await buildStatementAttachment(
            item.studentId,
            toSchoolBrand(school)
          );
          if (attachment) {
            attachments = [attachment];
            message = `Dear ${item.recipientName ?? "Parent/Guardian"},

Please find attached the latest school fee statement.

Current outstanding balance: ${formatZAR(attachment.balance)}.

Kind regards,
${school.name} Accounts Department`;
          }
        }

        const result = await sendEmailViaSendGrid(
          config,
          item.recipientContact,
          item.subject ?? "School fee notice",
          message,
          attachments
        );
        await prisma.communicationLog.update({
          where: { id: item.id },
          data: {
            status: result.sent ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
            error: result.sent ? null : result.reason,
            message,
          },
        });
        if (result.sent) sent += 1;
        else failed += 1;
      }
    } catch (err) {
      await prisma.communicationLog.update({
        where: { id: item.id },
        data: {
          status: CommunicationStatus.FAILED,
          error: err instanceof Error ? err.message : "Send failed",
        },
      });
      failed += 1;
    }
  }

  const [queuedCount, sentCount, failedCount] = await Promise.all([
    prisma.communicationLog.count({
      where: { batchId, status: CommunicationStatus.QUEUED },
    }),
    prisma.communicationLog.count({
      where: { batchId, status: CommunicationStatus.SENT },
    }),
    prisma.communicationLog.count({
      where: { batchId, status: CommunicationStatus.FAILED },
    }),
  ]);

  const updated = await prisma.communicationBatch.update({
    where: { id: batchId },
    data: {
      queuedCount,
      sentCount,
      failedCount,
      status:
        queuedCount === 0
          ? CommunicationBatchStatus.COMPLETED
          : CommunicationBatchStatus.PROCESSING,
      completedAt: queuedCount === 0 ? new Date() : null,
    },
  });

  return {
    processed: queued.length,
    sent,
    failed,
    remaining: queuedCount,
    batch: updated,
  };
}

export async function retryFailedBatchMessages(batchId: string) {
  await prisma.communicationLog.updateMany({
    where: { batchId, status: CommunicationStatus.FAILED },
    data: { status: CommunicationStatus.QUEUED, error: null },
  });

  const queuedCount = await prisma.communicationLog.count({
    where: { batchId, status: CommunicationStatus.QUEUED },
  });

  return prisma.communicationBatch.update({
    where: { id: batchId },
    data: {
      queuedCount,
      status:
        queuedCount > 0
          ? CommunicationBatchStatus.PENDING
          : CommunicationBatchStatus.COMPLETED,
      completedAt: queuedCount > 0 ? null : new Date(),
    },
  });
}
