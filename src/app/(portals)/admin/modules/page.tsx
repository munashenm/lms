import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AccessDenied } from "@/components/layout/access-denied";
import { ModulesManager } from "@/components/admin/modules-manager";
import { Card, CardContent } from "@/components/ui/card";
import { SYSTEM_MODULE_LABELS, SYSTEM_MODULES } from "@/lib/modules";
import { needsSuperAdminSchoolPicker, resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { UserRole } from "@prisma/client";

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ schoolId?: string }>;
}) {
  const session = await getSession();
  if (!requirePermission(session, "settings.manage")) return <AccessDenied />;
  const params = await searchParams;

  if (needsSuperAdminSchoolPicker(session, params.schoolId)) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (schools.length === 1) {
      redirect(`/admin/modules?schoolId=${schools[0].id}`);
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Modules</h1>
          <p className="text-muted text-sm mt-1">Select a school to manage its modules.</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No schools found.</p>
            ) : (
              schools.map((school) => (
                <div key={school.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <p className="font-medium">{school.name}</p>
                  <Link
                    href={`/admin/modules?schoolId=${school.id}`}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    Open modules
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const schoolId = await resolveLicenseSchoolId(session, params.schoolId);
  if (!schoolId || !canAccessSchool(session, schoolId)) return <AccessDenied />;

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
