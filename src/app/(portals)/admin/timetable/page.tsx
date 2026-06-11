import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Suspense } from "react";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { TimetableForm } from "@/components/academics/timetable-form";
import { ClassFilter } from "@/components/academics/class-filter";

interface PageProps {
  searchParams: Promise<{ classId?: string }>;
}

export default async function TimetablePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [classes, subjects, teachers, slots] = await Promise.all([
    prisma.class.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { ...filter, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.timetableSlot.findMany({
      where: {
        ...(params.classId ? { classId: params.classId } : { class: filter }),
      },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true, code: true } },
        module: { select: { name: true, code: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const selectedClass = params.classId ?? classes[0]?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timetable</h1>
        <p className="text-muted text-sm mt-1">Build weekly class schedules</p>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <ClassFilter
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          selectedClassId={selectedClass}
        />
      </Suspense>

      <TimetableForm
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        teachers={teachers}
        defaultClassId={selectedClass}
      />

      <TimetableGrid slots={slots} showClass={!params.classId} />
    </div>
  );
}
