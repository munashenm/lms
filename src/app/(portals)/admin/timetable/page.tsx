import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Suspense } from "react";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { TimetableForm } from "@/components/academics/timetable-form";
import { TimetableConflicts } from "@/components/academics/timetable-conflicts";
import { TimetableGenerateButton } from "@/components/academics/timetable-generate-button";
import { ClassFilter } from "@/components/academics/class-filter";
import { resolveOwnedClassId } from "@/lib/tenant";

interface PageProps {
  searchParams: Promise<{ classId?: string }>;
}

export default async function TimetablePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [classes, subjects, teachers] = await Promise.all([
    prisma.class.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { ...filter, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const selectedClass = resolveOwnedClassId(params.classId, classes);

  const slots = await prisma.timetableSlot.findMany({
    where: {
      ...filter,
      ...(selectedClass ? { classId: selectedClass } : {}),
    },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true, code: true } },
      module: { select: { name: true, code: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timetable</h1>
        <p className="text-muted text-sm mt-1">
          Generate a week from class subjects, or add periods one at a time. Teacher, class, and room clashes are blocked.
        </p>
      </div>
      <TimetableGenerateButton classId={selectedClass ?? undefined} />

      <Suspense fallback={<div className="h-10" />}>
        <ClassFilter
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          selectedClassId={selectedClass ?? undefined}
        />
      </Suspense>

      <TimetableConflicts classId={selectedClass ?? undefined} />

      <TimetableForm
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        teachers={teachers}
        defaultClassId={selectedClass ?? undefined}
      />

      <TimetableGrid slots={slots} showClass={!selectedClass} />
    </div>
  );
}
