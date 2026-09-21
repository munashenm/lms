import Link from "next/link";
import { UserRole } from "@prisma/client";
import { RestoreWizard } from "@/components/enterprise/restore-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { needsSuperAdminSchoolPicker } from "@/lib/licensing/enforce";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ schoolId?: string; backupId?: string }>;
}

export default async function RestorePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "backup.restore")) {
    redirect("/admin/settings/backup");
  }
  const { schoolId: requested, backupId } = await searchParams;
  const isSuperAdminView = session.role === UserRole.SUPER_ADMIN && !session.schoolId;

  if (needsSuperAdminSchoolPicker(session, requested)) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    const backupQuery = backupId ? `&backupId=${encodeURIComponent(backupId)}` : "";
    if (schools.length === 1) {
      redirect(`/admin/settings/backup/restore?schoolId=${schools[0].id}${backupQuery}`);
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Restore backup</h1>
          <p className="text-muted text-sm mt-1">Select a school before restoring a backup.</p>
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
                    href={`/admin/settings/backup/restore?schoolId=${school.id}${backupQuery}`}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    Restore
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        {isSuperAdminView ? (
          <Link href="/admin/settings/backup" className="text-sm text-muted hover:text-primary">
            ← Backups
          </Link>
        ) : null}
        <h1 className={isSuperAdminView ? "text-2xl font-bold mt-2" : "text-2xl font-bold"}>Restore backup</h1>
        <p className="text-muted text-sm mt-1">
          Validate first. A pre-restore recovery backup is created automatically before any overwrite.
        </p>
      </div>
      <RestoreWizard schoolId={requested ?? session.schoolId ?? undefined} backupId={backupId} />
    </div>
  );
}
