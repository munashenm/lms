import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { AccessDenied } from "@/components/layout/access-denied";
import { prisma } from "@/lib/db";
import { PromotionBoard } from "@/components/academic/promotion-board";

export default async function PromotionPage() {
  const session = await getSession();
  if (!requirePermission(session, "students.promote")) return <AccessDenied />;
  const filter = getSchoolFilter(session);
  const [years, grades, classes] = await Promise.all([
    prisma.academicYear.findMany({ where: filter, select: { id: true, name: true, isCurrent: true }, orderBy: { startDate: "desc" } }),
    prisma.grade.findMany({ where: { ...filter, isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.class.findMany({ where: { ...filter, isActive: true }, select: { id: true, name: true, gradeId: true }, orderBy: { name: "asc" } }),
  ]);
  const current = years.find((year) => year.isCurrent) ?? years[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promotion & Progression</h1>
        <p className="text-muted text-sm mt-1">Move learners to the next grade or programme year without overwriting previous enrolments.</p>
      </div>
      {current ? (
        <PromotionBoard
          years={years}
          grades={grades}
          classes={classes}
          initialYearId={current.id}
          initialGradeId={grades[0]?.id ?? ""}
        />
      ) : (
        <p className="text-muted">Create an academic session first.</p>
      )}
    </div>
  );
}
