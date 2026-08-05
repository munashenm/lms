import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Suspense } from "react";
import { AttendanceMarker } from "@/components/attendance/attendance-marker";
import { ClassFilter } from "@/components/academics/class-filter";
import { Card, CardContent } from "@/components/ui/card";
import { isCollegeLike } from "@/lib/terminology";
import { buildAttendanceSessionKey } from "@/lib/attendance";

interface PageProps {
  searchParams: Promise<{
    classId?: string;
    date?: string;
    moduleId?: string;
    sessionStart?: string;
    sessionEnd?: string;
    mode?: string;
  }>;
}

export default async function TeacherAttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const today = new Date().toISOString().split("T")[0];
  const date = params.date ?? today;

  const school = session!.schoolId
    ? await prisma.school.findUnique({
        where: { id: session!.schoolId },
        select: { institutionType: true },
      })
    : null;
  const collegeMode = school ? isCollegeLike(school.institutionType) : false;

  const assignedClasses =
    teacher?.classTeachers.map((ct) => ({
      id: ct.classId,
      name: ct.class.name,
    })) ?? [];

  const modules = teacher
    ? await prisma.module.findMany({
        where: {
          course: { schoolId: teacher.schoolId, isActive: true },
          isActive: true,
          OR: [
            { timetableSlots: { some: { teacherId: teacher.id } } },
            { assessments: { some: { teacherId: teacher.id } } },
          ],
        },
        include: { course: { select: { name: true, code: true } } },
        orderBy: [{ course: { name: "asc" } }, { sortOrder: "asc" }],
        take: 50,
      })
    : [];

  // Fallback: all school modules if none linked to lecturer
  const moduleOptions =
    modules.length > 0
      ? modules
      : collegeMode && teacher
        ? await prisma.module.findMany({
            where: {
              course: { schoolId: teacher.schoolId, isActive: true },
              isActive: true,
            },
            include: { course: { select: { name: true, code: true } } },
            orderBy: [{ course: { name: "asc" } }, { sortOrder: "asc" }],
            take: 50,
          })
        : [];

  const mode =
    params.mode ??
    (collegeMode && moduleOptions.length > 0 ? "module" : "class");

  const selectedClassId = params.classId ?? assignedClasses[0]?.id;
  const selectedModuleId = params.moduleId ?? moduleOptions[0]?.id;
  const sessionStart = params.sessionStart ?? "";
  const sessionEnd = params.sessionEnd ?? "";

  const useModule = mode === "module" && Boolean(selectedModuleId);

  const sessionKey = useModule
    ? buildAttendanceSessionKey({
        moduleId: selectedModuleId,
        sessionStart,
        sessionEnd,
      })
    : buildAttendanceSessionKey({ classId: selectedClassId });

  const [students, existingRecords] = await Promise.all([
    useModule
      ? prisma.student.findMany({
          where: {
            schoolId: teacher?.schoolId,
            status: "ACTIVE",
            enrolments: {
              some: {
                status: "ENROLLED",
                course: { modules: { some: { id: selectedModuleId! } } },
              },
            },
          },
          orderBy: { lastName: "asc" },
        })
      : selectedClassId
        ? prisma.student.findMany({
            where: { classId: selectedClassId, status: "ACTIVE" },
            orderBy: { lastName: "asc" },
          })
        : Promise.resolve([]),
    useModule || selectedClassId
      ? prisma.attendanceRecord.findMany({
          where: {
            date: new Date(date),
            sessionKey,
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Take Attendance</h1>
        <p className="text-muted text-sm mt-1">
          {collegeMode
            ? "Mark module/session attendance for your groups"
            : "Mark daily attendance for your classes"}
        </p>
      </div>

      {collegeMode && (
        <div className="flex gap-2 text-sm">
          <a
            href={`?mode=class&date=${date}`}
            className={`px-3 py-1.5 rounded-lg border ${mode === "class" ? "bg-primary text-white border-primary" : "border-border"}`}
          >
            By class
          </a>
          <a
            href={`?mode=module&date=${date}`}
            className={`px-3 py-1.5 rounded-lg border ${mode === "module" ? "bg-primary text-white border-primary" : "border-border"}`}
          >
            By module / session
          </a>
        </div>
      )}

      {mode !== "module" && assignedClasses.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-4 items-end">
            <Suspense fallback={<div className="h-10" />}>
              <ClassFilter
                classes={assignedClasses}
                selectedClassId={selectedClassId}
                preserveParams={["date", "mode"]}
              />
            </Suspense>
            <form method="GET" className="flex gap-2 items-end">
              <input type="hidden" name="classId" value={selectedClassId} />
              <input type="hidden" name="mode" value="class" />
              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  name="date"
                  defaultValue={date}
                  className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block"
                />
              </div>
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium"
              >
                Load
              </button>
            </form>
          </div>

          {students.length > 0 ? (
            <AttendanceMarker
              classId={selectedClassId!}
              date={date}
              students={students}
              existingRecords={existingRecords.map((r) => ({
                studentId: r.studentId,
                status: r.status,
                notes: r.notes,
              }))}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted">
                No students in this class.
              </CardContent>
            </Card>
          )}
        </>
      ) : mode === "module" && moduleOptions.length > 0 ? (
        <>
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <input type="hidden" name="mode" value="module" />
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Module</label>
              <select
                name="moduleId"
                defaultValue={selectedModuleId}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                {moduleOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.course.code} — {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Start</label>
              <input
                type="time"
                name="sessionStart"
                defaultValue={sessionStart}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">End</label>
              <input
                type="time"
                name="sessionEnd"
                defaultValue={sessionEnd}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium sm:col-span-2 lg:col-span-1"
            >
              Load session
            </button>
          </form>

          {students.length > 0 ? (
            <AttendanceMarker
              moduleId={selectedModuleId!}
              sessionStart={sessionStart || null}
              sessionEnd={sessionEnd || null}
              date={date}
              students={students}
              studentLabel="Student"
              existingRecords={existingRecords.map((r) => ({
                studentId: r.studentId,
                status: r.status,
                notes: r.notes,
              }))}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted">
                No enrolled students found for this module.
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            {mode === "module"
              ? "No modules available yet."
              : "No classes assigned to you yet."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
