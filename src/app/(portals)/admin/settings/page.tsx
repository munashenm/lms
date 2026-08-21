import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { SchoolSettingsForm } from "@/components/settings/school-settings-form";
import { IntegrationSettingsForm } from "@/components/settings/integration-settings-form";
import { CampusCreateForm } from "@/components/settings/campus-form";
import { CampusList } from "@/components/settings/campus-list";
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
    include: { campuses: { orderBy: { name: "asc" } } },
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
          {school.name} — institution profile, portal appearance, POPIA and integrations
        </p>
      </div>

      <SchoolSettingsForm
        school={{
          id: school.id,
          name: school.name,
          email: school.email,
          phone: school.phone,
          website: school.website,
          logoUrl: school.logoUrl,
          primaryColor: school.primaryColor,
          accentColor: school.accentColor,
          address: school.address,
          city: school.city,
          province: school.province,
          postalCode: school.postalCode,
          registrationNo: school.registrationNo,
          bankName: school.bankName,
          bankAccountName: school.bankAccountName,
          bankAccountNumber: school.bankAccountNumber,
          bankBranchCode: school.bankBranchCode,
          popiaConsentText: school.popiaConsentText,
          institutionType: school.institutionType,
          curriculumType: school.curriculumType,
          periodStructure: school.periodStructure,
          absenceNotifyEnabled: school.absenceNotifyEnabled,
          teacherReviewsAnonymous: school.teacherReviewsAnonymous,
          studentLeaveRequiresGuardian: school.studentLeaveRequiresGuardian,
          requireFeesPaidForDocuments: school.requireFeesPaidForDocuments,
          heroHeadline: school.heroHeadline,
          heroSubtitle: school.heroSubtitle,
          aboutText: school.aboutText,
          missionText: school.missionText,
          admissionsText: school.admissionsText,
        }}
        manageSchoolId={isSuperAdminView ? school.id : undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/admin/settings/licence${isSuperAdminView ? `?schoolId=${school.id}` : ""}`}
          className="rounded-xl border border-border bg-surface p-4 hover:border-primary"
        >
          <p className="font-medium">Licence</p>
          <p className="text-xs text-muted mt-1">Status, limits, modules and activation</p>
        </Link>
        <Link
          href={`/admin/settings/backup${isSuperAdminView ? `?schoolId=${school.id}` : ""}`}
          className="rounded-xl border border-border bg-surface p-4 hover:border-primary"
        >
          <p className="font-medium">Backup & Restore</p>
          <p className="text-xs text-muted mt-1">Cloud schedules and offline .lmsbackup files</p>
        </Link>
        <Link
          href={`/admin/integrations/sa-sams${isSuperAdminView ? `?schoolId=${school.id}` : ""}`}
          className="rounded-xl border border-border bg-surface p-4 hover:border-primary"
        >
          <p className="font-medium">SA-SAMS Migration Centre</p>
          <p className="text-xs text-muted mt-1">Authorised file import and future API connector</p>
        </Link>
        {session!.role === UserRole.SUPER_ADMIN && (
          <Link
            href="/admin/settings/licence-server"
            className="rounded-xl border border-border bg-surface p-4 hover:border-primary"
          >
            <p className="font-medium">Issue licences</p>
            <p className="text-xs text-muted mt-1">Vendor catalogue, signed keys and activations</p>
          </Link>
        )}
      </div>

      <IntegrationSettingsForm schoolId={school.id} schoolName={school.name} />

      <CampusCreateForm schoolId={isSuperAdminView ? school.id : undefined} />

      {school.campuses.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Campuses</p>
            <CampusList
              campuses={school.campuses}
              canWrite={hasPermission(session!.role, "settings:write")}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
