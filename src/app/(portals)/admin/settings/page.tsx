import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { SchoolSettingsForm } from "@/components/settings/school-settings-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  if (!("schoolId" in filter)) {
    const schools = await prisma.school.findMany({ where: { isActive: true } });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted text-sm mt-1">Multi-school SaaS overview</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">{s.slug} · {s.curriculumType}</p>
                </div>
                <span className={s.isActive ? "text-success text-xs" : "text-muted text-xs"}>
                  {s.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: filter.schoolId },
    include: { campuses: { where: { isActive: true } } },
  });

  if (!school) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted text-sm mt-1">
          School profile, POPIA configuration and contact details
        </p>
      </div>
      <SchoolSettingsForm school={school} />
      {school.campuses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Campuses</p>
            <div className="flex flex-wrap gap-2">
              {school.campuses.map((c) => (
                <span key={c.id} className="rounded-full bg-background border border-border px-3 py-1 text-xs">
                  {c.name} ({c.code}){c.isMain && " · Main"}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
