import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { SchoolSettingsForm } from "@/components/settings/school-settings-form";
import { IntegrationSettingsForm } from "@/components/settings/integration-settings-form";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : null;

  if (!schoolId) {
    const schools = await prisma.school.findMany({ where: { isActive: true } });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted text-sm mt-1">
            Select a school to manage profile and integrations
          </p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">{s.slug} · {s.curriculumType}</p>
                </div>
                <Link
                  href={`/admin/settings?schoolId=${s.id}`}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Manage settings
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { campuses: { where: { isActive: true } } },
  });

  if (!school) notFound();

  const isSuperAdminView =
    session!.role === UserRole.SUPER_ADMIN && !session!.schoolId;

  return (
    <div className="space-y-8">
      <div>
        {isSuperAdminView && (
          <Link href="/admin/settings" className="text-sm text-muted hover:text-primary">
            ← All schools
          </Link>
        )}
        <h1 className="text-2xl font-bold mt-2">Settings</h1>
        <p className="text-muted text-sm mt-1">
          {school.name} — profile, POPIA, integrations and payment gateways
        </p>
      </div>

      <SchoolSettingsForm school={school} />

      <IntegrationSettingsForm schoolId={school.id} schoolName={school.name} />

      {school.campuses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Campuses</p>
            <div className="flex flex-wrap gap-2">
              {school.campuses.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-background border border-border px-3 py-1 text-xs"
                >
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
