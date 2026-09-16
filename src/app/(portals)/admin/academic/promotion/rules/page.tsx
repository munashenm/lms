import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { AccessDenied } from "@/components/layout/access-denied";
import { prisma } from "@/lib/db";
import { PromotionRulesManager } from "@/components/academic/promotion-rules-manager";

export default async function PromotionRulesPage() {
  const session = await getSession();
  if (!requirePermission(session, "settings.manage") && !requirePermission(session, "students.promote")) {
    return <AccessDenied />;
  }
  const filter = getSchoolFilter(session);
  const [rules, grades] = await Promise.all([
    prisma.promotionRule.findMany({
      where: filter,
      include: { fromGrade: { select: { name: true } }, toGrade: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.grade.findMany({ where: { ...filter, isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promotion rules</h1>
        <p className="text-muted text-sm mt-1">Each institution can define its own progression requirements. Nothing is hard-coded to one pass mark.</p>
      </div>
      <PromotionRulesManager
        rules={rules.map((rule) => ({
          ...rule,
          minAverage: rule.minAverage == null ? null : Number(rule.minAverage),
          minAttendancePercent: rule.minAttendancePercent == null ? null : Number(rule.minAttendancePercent),
        }))}
        grades={grades}
      />
    </div>
  );
}
