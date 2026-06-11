import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ParentChildrenPage() {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Children</h1>
        <p className="text-muted text-sm mt-1">Students linked to your account</p>
      </div>

      {!guardian?.students.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted text-sm">
            No children linked to your account. Contact the school administrator.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guardian.students.map((sg) => (
            <Card key={sg.studentId}>
              <CardContent className="p-5 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {sg.student.firstName} {sg.student.lastName}
                  </h2>
                  <p className="text-sm text-muted">{sg.student.studentNumber}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sg.student.grade && (
                    <Badge variant="secondary">{sg.student.grade.name}</Badge>
                  )}
                  {sg.student.class && (
                    <Badge variant="secondary">{sg.student.class.name}</Badge>
                  )}
                  <Badge variant={sg.student.status === "ACTIVE" ? "success" : "secondary"}>
                    {sg.student.status}
                  </Badge>
                </div>
                {sg.relationship && (
                  <p className="text-xs text-muted">Relationship: {sg.relationship}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
