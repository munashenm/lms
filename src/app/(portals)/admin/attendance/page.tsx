import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Suspense } from "react";
import { AttendanceMarker } from "@/components/attendance/attendance-marker";
import { ClassFilter } from "@/components/academics/class-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ classId?: string; date?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const today = new Date().toISOString().split("T")[0];
  const date = params.date ?? today;

  const classes = await prisma.class.findMany({
    where: { ...filter, isActive: true },
    orderBy: { name: "asc" },
  });

  const selectedClassId = params.classId ?? classes[0]?.id;

  const [students, existingRecords, recentRecords] = await Promise.all([
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
    prisma.attendanceRecord.findMany({
      where: { student: filter },
      include: {
        student: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted text-sm mt-1">Mark daily class attendance</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <Suspense fallback={<div className="h-10" />}>
          <ClassFilter
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
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

      {selectedClassId && students.length > 0 ? (
        <AttendanceMarker
          classId={selectedClassId}
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

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Records</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.student.firstName} {r.student.lastName}
                    </p>
                    <p className="text-xs text-muted">{r.class?.name} · {formatDate(r.date)}</p>
                  </div>
                  <Badge
                    variant={
                      r.status === "PRESENT" ? "success"
                      : r.status === "ABSENT" ? "danger"
                      : r.status === "LATE" ? "warning" : "secondary"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
