import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StudentSubjectsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const classSubjects = student?.classId
    ? await prisma.classSubject.findMany({
        where: { classId: student.classId },
        include: {
          subject: true,
          teacher: { select: { firstName: true, lastName: true } },
        },
      })
    : [];

  const modules = student?.enrolments.flatMap((e) => e.course?.modules ?? []) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subjects & Modules</h1>
        <p className="text-muted text-sm mt-1">Your academic programme</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class Subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {classSubjects.length === 0 ? (
            <p className="text-sm text-muted">No subjects assigned.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {classSubjects.map((cs) => (
                <div key={cs.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{cs.subject.code}</Badge>
                    <p className="font-medium">{cs.subject.name}</p>
                  </div>
                  {cs.teacher && (
                    <p className="text-xs text-muted mt-2">
                      {cs.teacher.firstName} {cs.teacher.lastName}
                    </p>
                  )}
                  {cs.subject.credits && (
                    <p className="text-xs text-muted">{cs.subject.credits} credits</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {modules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {modules.map((mod) => (
                <div key={mod.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div>
                    <span className="font-medium">{mod.code}</span> — {mod.name}
                  </div>
                  {mod.credits && <span className="text-muted">{mod.credits} cr</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
