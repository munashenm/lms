import {
  CommunicationCategory,
  CommunicationStatus,
} from "@prisma/client";
import { prisma } from "./db";
import { getOutstandingBalance } from "./finance";
import { formatDate, formatZAR } from "./utils";
import { sendLoggedEmail, sendLoggedSms } from "./communications";

export const DEFAULT_FEE_REMINDER_RULES: {
  name: string;
  daysOffset: number;
  channel: string;
}[] = [
  { name: "7 days before due", daysOffset: -7, channel: "EMAIL" },
  { name: "On due date", daysOffset: 0, channel: "BOTH" },
  { name: "7 days overdue", daysOffset: 7, channel: "BOTH" },
  { name: "14 days overdue", daysOffset: 14, channel: "EMAIL" },
  { name: "30 days overdue", daysOffset: 30, channel: "EMAIL" },
];

export function describeDaysOffset(daysOffset: number): string {
  if (daysOffset === 0) return "On due date";
  if (daysOffset < 0) return `${Math.abs(daysOffset)} days before due`;
  return `${daysOffset} days overdue`;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return startOfDay(d);
}

function renderTemplate(
  template: string | null | undefined,
  vars: Record<string, string>,
  fallback: string
): string {
  const source = template?.trim() || fallback;
  return source.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function ensureDefaultFeeReminderRules(schoolId: string) {
  const count = await prisma.feeReminderRule.count({ where: { schoolId } });
  if (count > 0) return;

  await prisma.feeReminderRule.createMany({
    data: DEFAULT_FEE_REMINDER_RULES.map((rule) => ({
      schoolId,
      name: rule.name,
      daysOffset: rule.daysOffset,
      channel: rule.channel,
      isEnabled: false,
    })),
  });
}

export async function runFeeReminderRules(params?: {
  schoolId?: string;
  asOf?: Date;
  limitPerSchool?: number;
}) {
  const asOf = startOfDay(params?.asOf ?? new Date());
  const schools = await prisma.school.findMany({
    where: {
      isActive: true,
      ...(params?.schoolId ? { id: params.schoolId } : {}),
    },
    select: { id: true, name: true },
  });

  const summary = {
    schools: 0,
    matched: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const school of schools) {
    await ensureDefaultFeeReminderRules(school.id);
    const rules = await prisma.feeReminderRule.findMany({
      where: { schoolId: school.id, isEnabled: true },
    });
    if (rules.length === 0) continue;
    summary.schools += 1;

    let schoolSent = 0;
    const limit = params?.limitPerSchool ?? 100;

    for (const rule of rules) {
      if (schoolSent >= limit) break;

      // Target due date for this rule relative to today
      const targetDue = addDays(asOf, -rule.daysOffset);
      const nextDay = addDays(targetDue, 1);

      const invoices = await prisma.invoice.findMany({
        where: {
          schoolId: school.id,
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { gte: targetDue, lt: nextDay },
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentNumber: true,
              email: true,
              guardians: {
                orderBy: { isPrimary: "desc" },
                take: 1,
                include: {
                  guardian: {
                    select: {
                      firstName: true,
                      lastName: true,
                      phone: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: limit - schoolSent,
      });

      for (const invoice of invoices) {
        const outstanding = getOutstandingBalance(
          Number(invoice.total),
          Number(invoice.amountPaid)
        );
        if (outstanding <= 0) {
          summary.skipped += 1;
          continue;
        }

        summary.matched += 1;
        const guardian = invoice.student.guardians[0]?.guardian;
        const guardianName = guardian
          ? `${guardian.firstName} ${guardian.lastName}`
          : "Parent/Guardian";
        const vars = {
          schoolName: school.name,
          studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
          studentNumber: invoice.student.studentNumber,
          balance: formatZAR(outstanding),
          invoiceNumber: invoice.invoiceNumber,
          dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : "—",
          guardianName,
          ruleName: rule.name,
        };

        const channels =
          rule.channel === "BOTH"
            ? (["EMAIL", "SMS"] as const)
            : rule.channel === "SMS"
              ? (["SMS"] as const)
              : (["EMAIL"] as const);

        for (const channel of channels) {
          if (schoolSent >= limit) break;

          const existing = await prisma.feeReminderDispatch.findUnique({
            where: {
              ruleId_invoiceId_channel: {
                ruleId: rule.id,
                invoiceId: invoice.id,
                channel,
              },
            },
          });
          if (existing) {
            summary.skipped += 1;
            continue;
          }

          const contact =
            channel === "SMS"
              ? guardian?.phone
              : guardian?.email ?? invoice.student.email;

          if (!contact) {
            summary.failed += 1;
            await prisma.feeReminderDispatch.create({
              data: {
                schoolId: school.id,
                ruleId: rule.id,
                invoiceId: invoice.id,
                studentId: invoice.studentId,
                channel,
                communicationLogId: null,
              },
            });
            continue;
          }

          const subject = `School Fee Reminder – ${vars.studentName}`;
          const emailFallback = `Dear ${vars.guardianName},

This is an automated reminder (${vars.ruleName}) regarding outstanding school fees for ${vars.studentName} (${vars.studentNumber}).

Invoice: ${vars.invoiceNumber}
Due date: ${vars.dueDate}
Outstanding balance: ${vars.balance}

Please arrange payment or contact the accounts office if you need assistance.

Kind regards,
${vars.schoolName} Accounts Department`;

          const smsFallback = `Dear Parent/Guardian, outstanding school fees for ${vars.studentName} are ${vars.balance} (due ${vars.dueDate}). Please arrange payment or contact accounts. — ${vars.schoolName}`;

          let logId: string | null = null;
          try {
            if (channel === "SMS") {
              const log = await sendLoggedSms({
                schoolId: school.id,
                studentId: invoice.studentId,
                category: CommunicationCategory.FEE_REMINDER,
                recipientName: guardianName,
                recipientContact: contact,
                subject,
                message: renderTemplate(rule.smsTemplate, vars, smsFallback),
                metadata: {
                  ruleId: rule.id,
                  invoiceId: invoice.id,
                  daysOffset: rule.daysOffset,
                  automated: true,
                },
              });
              logId = log.id;
              if (log.status === CommunicationStatus.SENT) {
                summary.sent += 1;
                schoolSent += 1;
              } else {
                summary.failed += 1;
              }
            } else {
              const log = await sendLoggedEmail({
                schoolId: school.id,
                studentId: invoice.studentId,
                category: CommunicationCategory.FEE_REMINDER,
                recipientName: guardianName,
                recipientContact: contact,
                subject,
                message: renderTemplate(rule.emailTemplate, vars, emailFallback),
                metadata: {
                  ruleId: rule.id,
                  invoiceId: invoice.id,
                  daysOffset: rule.daysOffset,
                  automated: true,
                },
              });
              logId = log.id;
              if (log.status === CommunicationStatus.SENT) {
                summary.sent += 1;
                schoolSent += 1;
              } else {
                summary.failed += 1;
              }
            }

            await prisma.feeReminderDispatch.create({
              data: {
                schoolId: school.id,
                ruleId: rule.id,
                invoiceId: invoice.id,
                studentId: invoice.studentId,
                channel,
                communicationLogId: logId,
              },
            });
          } catch {
            summary.failed += 1;
          }
        }
      }
    }
  }

  return summary;
}
