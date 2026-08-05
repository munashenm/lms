import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { BulkRemindersManager } from "@/components/finance/bulk-reminders-manager";
import { FeeReminderRulesManager } from "@/components/finance/fee-reminder-rules-manager";
import { listOutstandingFeeStudents } from "@/lib/bulk-fee-comms";
import {
  describeDaysOffset,
  ensureDefaultFeeReminderRules,
} from "@/lib/fee-reminder-rules";
import { prisma } from "@/lib/db";

interface PageProps {
  searchParams: Promise<{ schoolId?: string; gradeId?: string; minBalance?: string }>;
}

export default async function AdminFinanceRemindersPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance:write")) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const filter = getSchoolFilter(session);
  const schoolId =
    session.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : null;

  if (!schoolId) {
    redirect("/admin/finance");
  }

  const minBalance = parseFloat(params.minBalance ?? "0.01");

  await ensureDefaultFeeReminderRules(schoolId);

  const [students, grades, batches, rules, recentDispatches] = await Promise.all([
    listOutstandingFeeStudents({
      schoolId,
      gradeId: params.gradeId,
      minBalance: Number.isFinite(minBalance) ? minBalance : 0.01,
    }),
    prisma.grade.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.communicationBatch.findMany({
      where: {
        schoolId,
        category: { in: ["FEE_REMINDER", "FEE_STATEMENT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.feeReminderRule.findMany({
      where: { schoolId },
      orderBy: [{ daysOffset: "asc" }, { name: "asc" }],
    }),
    prisma.feeReminderDispatch.findMany({
      where: { schoolId },
      orderBy: { dispatchedAt: "desc" },
      take: 30,
      include: {
        rule: { select: { name: true, daysOffset: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            student: {
              select: { firstName: true, lastName: true, studentNumber: true },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Fee Reminders</h1>
        <p className="text-muted text-sm mt-1">
          Configure automated due-date rules and queue bulk fee reminders or
          statements
        </p>
      </div>

      <FeeReminderRulesManager
        schoolId={schoolId}
        rules={rules.map((rule) => ({
          ...rule,
          timingLabel: describeDaysOffset(rule.daysOffset),
        }))}
        recentDispatches={recentDispatches.map((d) => ({
          id: d.id,
          channel: d.channel,
          dispatchedAt: d.dispatchedAt.toISOString(),
          ruleName: d.rule.name,
          timingLabel: describeDaysOffset(d.rule.daysOffset),
          invoiceNumber: d.invoice.invoiceNumber,
          studentName: `${d.invoice.student.firstName} ${d.invoice.student.lastName}`,
          studentNumber: d.invoice.student.studentNumber,
        }))}
      />

      <BulkRemindersManager
        schoolId={schoolId}
        students={students}
        totalOutstanding={students.reduce((s, row) => s + row.outstanding, 0)}
        grades={grades}
        initialGradeId={params.gradeId ?? ""}
        initialMinBalance={Number.isFinite(minBalance) ? minBalance : 0.01}
        batches={batches.map((b) => ({
          id: b.id,
          category: b.category,
          channel: b.channel,
          status: b.status,
          totalCount: b.totalCount,
          queuedCount: b.queuedCount,
          sentCount: b.sentCount,
          failedCount: b.failedCount,
          createdAt: b.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
