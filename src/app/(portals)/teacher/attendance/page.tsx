import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Suspense } from "react";
import { AttendanceMarker } from "@/components/attendance/attendance-marker";
import { ClassFilter } from "@/components/academics/class-filter";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{ classId?: string; date?: string }>;
}

export default async function TeacherAttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const today = new Date().toISOString().split("T")[0];
  const date = params.date ?? today;

  const assignedClasses = teacher?.classTeachers.map((ct) => ({
    id: ct.classId,
    name: ct.class.name,
  })) ?? [];

  const selectedClassId = params.classId ?? assignedClasses[0]?.id;

  const [students, existingRecords] = await Promise.all([
    selectedClassId
      ? prisma.student.findMany({
          where: { classId: selectedClassId, status: "ACTIVE" },
          orderBy: { lastName: "asc" },
        })
      : Promise.resolve([]),
    selectedClassId
      ? prisma.attendanceRecord.findMany({
          where: { classId: selectedClassId, date: new Date(date) },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Take Attendance</h1>
        <p className="text-muted text-sm mt-1">Mark daily attendance for your classes</p>
      </div>

      {assignedClasses.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-4 items-end">
            <Suspense fallback={<div className="h-10" />}>
              <ClassFilter
                classes={assignedClasses}
                selectedClassId={selectedClassId}
                preserveParams={["date"]}
              />
            </Suspense>
            <form method="GET" className="flex gap-2 items-end">
              <input type="hidden" name="classId" value={selectedClassId} />
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
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No classes assigned to you yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
