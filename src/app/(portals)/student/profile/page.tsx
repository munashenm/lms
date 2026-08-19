import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LearnerProfileForm } from "@/components/learner/profile-form";
import { StudentCardButton } from "@/components/students/student-card-button";
import { StudentBarcode } from "@/components/learner/student-barcode";
import { formatDate, getInitials } from "@/lib/utils";
import { maskIdentityNumber } from "@/lib/learner-portal";

export default async function StudentProfilePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const currentEnrolment =
    student?.enrolments.find((e) => e.academicYear?.isCurrent) ?? student?.enrolments[0];

  if (!student) {
    return <p className="text-sm text-muted">Your learner profile could not be loaded.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted text-sm mt-1">Personal, academic and guardian information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="h-16 w-16">
              {student.photoUrl ? <AvatarImage src={student.photoUrl} alt="" /> : null}
              <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{student.firstName} {student.lastName}</p>
              <p className="text-sm text-muted">{student.studentNumber}</p>
            </div>
            <StudentCardButton href="/api/me/card" studentNumber={student.studentNumber} />
          </div>
          <StudentBarcode value={student.studentNumber} />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted">Date of birth</dt><dd>{student.dateOfBirth ? formatDate(student.dateOfBirth) : "—"}</dd></div>
            <div><dt className="text-muted">Gender</dt><dd>{student.gender ?? "—"}</dd></div>
            <div><dt className="text-muted">ID / passport</dt><dd>{maskIdentityNumber(student.saIdNumber) ?? "—"}</dd></div>
            <div><dt className="text-muted">Status</dt><dd><Badge>{student.status}</Badge></dd></div>
          </dl>
          <LearnerProfileForm
            email={student.email ?? student.user?.email ?? ""}
            phone={student.phone ?? ""}
            address={student.address ?? ""}
            city={student.city ?? ""}
            province={student.province ?? ""}
            postalCode={student.postalCode ?? ""}
          />
          <p className="text-xs text-muted">
            Name, student number, grade and identity details can only be changed by the school office.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Academic information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><p className="text-muted">Grade</p><p>{student.grade?.name ?? "—"}</p></div>
          <div><p className="text-muted">Class</p><p>{student.class?.name ?? "—"}</p></div>
          <div><p className="text-muted">Campus</p><p>{student.campus?.name ?? "—"}</p></div>
          <div><p className="text-muted">Programme</p><p>{currentEnrolment?.course?.name ?? "—"}</p></div>
          <div><p className="text-muted">Academic year</p><p>{currentEnrolment?.academicYear?.name ?? "—"}</p></div>
          <div><p className="text-muted">Enrolment</p><p>{currentEnrolment?.status ?? student.status}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent / guardian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {student.guardians.length === 0 ? (
            <p className="text-sm text-muted">No guardian details on file.</p>
          ) : (
            student.guardians.map((link) => (
              <div key={link.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{link.guardian.firstName} {link.guardian.lastName}</p>
                <p className="text-xs text-muted">
                  {link.relationship || link.guardian.relationship || "Guardian"}
                  {link.isPrimary ? " · Primary" : ""}
                </p>
                <p className="text-xs text-muted mt-1">
                  {[link.guardian.email, link.guardian.phone].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
