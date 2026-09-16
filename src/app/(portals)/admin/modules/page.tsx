import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AccessDenied } from "@/components/layout/access-denied";
import { ModulesManager } from "@/components/admin/modules-manager";
import { SYSTEM_MODULE_LABELS, SYSTEM_MODULES } from "@/lib/modules";
import { requireSchoolId } from "@/lib/portal-data";
import { UserRole } from "@prisma/client";

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ schoolId?: string }>;
}) {
  const session = await getSession();
  if (!requirePermission(session, "settings.manage")) return <AccessDenied />;
  const params = await searchParams;
  const schoolId =
    session.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : await requireSchoolId(session);

  const [schools, rows] = await Promise.all([
    prisma.school.findMany({
      where: session.role === UserRole.SUPER_ADMIN ? { isActive: true } : { id: schoolId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.schoolModule.findMany({ where: { schoolId } }),
  ]);
  const enabled = new Map(rows.map((row) => [row.moduleKey, row.enabled]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modules</h1>
        <p className="text-muted text-sm mt-1">Enable or disable LMS modules for an institution. Disabled modules are blocked in navigation and APIs.</p>
      </div>
      <ModulesManager
        schools={schools}
        initialSchoolId={schoolId}
        initialModules={SYSTEM_MODULES.map((moduleKey) => ({
          moduleKey,
          label: SYSTEM_MODULE_LABELS[moduleKey],
          enabled: enabled.has(moduleKey) ? enabled.get(moduleKey) !== false : true,
        }))}
      />
    </div>
  );
}
