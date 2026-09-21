import Link from "next/link";
import { UserRole } from "@prisma/client";
import { BackupDashboard } from "@/components/enterprise/backup-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { needsSuperAdminSchoolPicker } from "@/lib/licensing/enforce";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function BackupPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "backup.view")) {
    redirect("/admin/dashboard");
  }
  const { schoolId: requested } = await searchParams;
  const isSuperAdminView = session.role === UserRole.SUPER_ADMIN && !session.schoolId;

  if (needsSuperAdminSchoolPicker(session, requested)) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    if (schools.length === 1) {
      redirect(`/admin/settings/backup?schoolId=${schools[0].id}`);
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Backup & Restore</h1>
          <p className="text-muted text-sm mt-1">Select a school before creating or restoring a backup.</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No schools found.</p>
            ) : (
              schools.map((school) => (
                <div key={school.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{school.name}</p>
                    <p className="text-xs text-muted">{school.slug}</p>
                  </div>
                  <Link
                    href={`/admin/settings/backup?schoolId=${school.id}`}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    Open backups
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const schoolName =
    isSuperAdminView && requested
      ? (
          await prisma.school.findUnique({
            where: { id: requested },
            select: { name: true },
          })
        )?.name
      : null;

  return (
    <div className="space-y-6">
      <div>
        {isSuperAdminView ? (
          <Link href="/admin/settings/backup" className="text-sm text-muted hover:text-primary">
            ← All schools
          </Link>
        ) : null}
        <h1 className={isSuperAdminView ? "text-2xl font-bold mt-2" : "text-2xl font-bold"}>Backup & Restore</h1>
        <p className="text-muted text-sm mt-1">
          {schoolName ? `${schoolName} — ` : ""}
          Automatic cloud backups and encrypted offline .lmsbackup packages. Credentials stay on the server.
        </p>
      </div>
      <BackupDashboard schoolId={requested ?? session.schoolId ?? undefined} />
    </div>
  );
}
