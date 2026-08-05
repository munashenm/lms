import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeeScheduleManager } from "@/components/finance/fee-schedule-manager";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function FeeSchedulePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance:write")) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const filter = getSchoolFilter(session);

  const schoolId =
    session.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : null;

  if (!schoolId) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Fee Schedule</h1>
          <p className="text-muted text-sm mt-1">Select a school to manage its published fee structure</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <p className="font-medium">{s.name}</p>
                <Link
                  href={`/admin/finance/fee-schedule?schoolId=${s.id}`}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Manage fees
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [school, items] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
    prisma.feeScheduleItem.findMany({
      where: { schoolId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!school) redirect("/admin/finance/fee-schedule");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        {session.role === UserRole.SUPER_ADMIN && (
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/finance/fee-schedule">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold">Fee Schedule</h1>
          <p className="text-muted text-sm mt-1">
            {school.name} — items appear on the public fees page and can pre-fill new invoices
          </p>
        </div>
      </div>

      <FeeScheduleManager
        schoolId={schoolId}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          amount: Number(item.amount),
          notes: item.notes,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          isPublic: item.isPublic,
        }))}
      />
    </div>
  );
}
