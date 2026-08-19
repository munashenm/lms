import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { FeeStructureManager } from "@/components/finance/fee-structure-manager";

export default async function FeeStructuresPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [items, grades, courses, years] = await Promise.all([
    prisma.feeStructure.findMany({ where: filter, orderBy: { name: "asc" } }),
    prisma.grade.findMany({ where: filter, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.course.findMany({ where: filter, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ where: filter, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee structures</h1>
        <p className="text-muted text-sm mt-1">
          Combinations of grade, class, course, module and year. Instalments are stored with due dates and are not split unless enabled.
        </p>
      </div>
      <FeeStructureManager
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          chargeSource: i.chargeSource,
          amount: Number(i.amount),
          billingFrequency: i.billingFrequency,
          allowInstalments: i.allowInstalments,
          isActive: i.isActive,
        }))}
        grades={grades}
        courses={courses}
        years={years}
      />
    </div>
  );
}
