import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { FeeStructureManager } from "@/components/finance/fee-structure-manager";

export default async function FeeStructuresPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [items, grades, courses, modules, years] = await Promise.all([
    prisma.feeStructure.findMany({
      where: filter,
      orderBy: { name: "asc" },
      include: {
        grade: { select: { name: true } },
        course: { select: { name: true } },
        module: { select: { name: true } },
      },
    }),
    prisma.grade.findMany({ where: filter, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.course.findMany({ where: filter, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.module.findMany({
      where: { course: filter },
      select: { id: true, name: true, courseId: true, course: { select: { name: true } } },
      orderBy: [{ course: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.academicYear.findMany({ where: filter, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee structures</h1>
        <p className="text-muted text-sm mt-1">
          Registration is charged once for the whole enrolment. Grade, programme, and course fees are priced per month, quarter, half-year, or year, with a discount when the year is paid up front.
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
          priceIsPerPeriod: i.priceIsPerPeriod,
          invoiceYearly: i.invoiceYearly,
          yearlyDiscountPercent: i.yearlyDiscountPercent == null ? null : Number(i.yearlyDiscountPercent),
          gradeName: i.grade?.name ?? null,
          courseName: i.course?.name ?? null,
          moduleName: i.module?.name ?? null,
        }))}
        grades={grades}
        courses={courses}
        modules={modules.map((mod) => ({
          id: mod.id,
          name: mod.name,
          courseId: mod.courseId,
          courseName: mod.course.name,
        }))}
        years={years}
      />
    </div>
  );
}
