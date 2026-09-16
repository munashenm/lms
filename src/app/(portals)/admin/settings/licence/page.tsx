import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { LicenceManager } from "@/components/enterprise/licence-manager";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { needsSuperAdminSchoolPicker } from "@/lib/licensing/enforce";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function LicencePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "license.view")) {
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
      redirect(`/admin/settings/licence?schoolId=${schools[0].id}`);
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Licence</h1>
          <p className="text-muted text-sm mt-1">Select a school to view and activate its licence.</p>
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
                    href={`/admin/settings/licence?schoolId=${school.id}`}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    View licence
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
          <Link href="/admin/settings/licence" className="text-sm text-muted hover:text-primary">
            ← All schools
          </Link>
        ) : null}
        <h1 className={isSuperAdminView ? "text-2xl font-bold mt-2" : "text-2xl font-bold"}>Licence</h1>
        <p className="text-muted text-sm mt-1">
          {schoolName ? `${schoolName} — ` : ""}
          View and activate the institution licence. Enforcement is applied on the server, not only in this page.
        </p>
      </div>
      <LicenceManager schoolId={requested} />
    </div>
  );
}
