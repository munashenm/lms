import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { AccessDenied } from "@/components/layout/access-denied";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { SYSTEM_MODULES } from "@/lib/modules";

export default async function InstitutionsPage() {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) return <AccessDenied />;

  const schools = await prisma.school.findMany({
    include: {
      _count: { select: { users: true, students: true } },
      schoolModules: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Institutions</h1>
        <p className="text-muted text-sm mt-1">Platform-wide school and college access for Super Admin.</p>
      </div>
      <div className="grid gap-4">
        {schools.map((school) => {
          const disabled = school.schoolModules.filter((row) => !row.enabled).length;
          return (
            <Card key={school.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {school.name}
                  <Badge variant={school.isActive ? "success" : "secondary"}>
                    {school.isActive ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm">
                <span>{school._count.users} users</span>
                <span>{school._count.students} students</span>
                <span>{SYSTEM_MODULES.length - disabled} modules enabled</span>
                <Link className="text-primary font-medium" href={`/admin/modules?schoolId=${school.id}`}>Modules</Link>
                <Link className="text-primary font-medium" href={`/admin/users`}>Users</Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
