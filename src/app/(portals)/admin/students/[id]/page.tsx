import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentExportButton } from "@/components/students/student-export-button";
import { StudentCardButton } from "@/components/students/student-card-button";
import { StudentLedgerPanel } from "@/components/finance/student-ledger-panel";
import { EnrolmentServicesForm } from "@/components/students/enrolment-services-form";
import { StudentPortalPanel } from "@/components/students/student-portal-panel";
import { StudentEditForm } from "@/components/students/student-edit-form";
import { StudentPhotoPanel } from "@/components/students/student-photo-panel";
import { StudentDocumentsPanel } from "@/components/students/student-documents-panel";
import { StudentPromoteForm } from "@/components/students/student-promote-form";
import { ProfileTabs } from "@/components/students/profile-tabs";
import { LetterForm } from "@/components/letters/letter-form";
import { AccessDenied } from "@/components/layout/access-denied";
import { ArrowLeft } from "lucide-react";
import { formatDate, toIsoDateInput, toIsoDateTime } from "@/lib/utils";
import { getStudentLedger } from "@/lib/student-ledger";
import { getTerminology } from "@/lib/terminology";
import { PROMOTION_OUTCOME_LABELS } from "@/lib/promotion";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!requirePermission(session, "students.view")) return <AccessDenied />;
  const schoolFilter = getSchoolFilter(session);

  const student = await prisma.student.findFirst({
    where: { id, ...schoolFilter },
    include: {
      grade: true,
      class: true,
      campus: true,
      guardians: { include: { guardian: true } },
      school: { select: { name: true, institutionType: true } },
      documents: { orderBy: { createdAt: "desc" } },
      enrolments: {
        include: { academicYear: { select: { id: true, name: true } }, grade: { select: { name: true } }, class: { select: { name: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      changeLogs: {
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      promotionDecisions: {
        select: {
          id: true,
          outcome: true,
          eligibility: true,
          fromAcademicYear: { select: { name: true } },
          toGrade: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!student) notFound();

  const terms = getTerminology(student.school.institutionType);
  const canExportPopia = requirePermission(session, "students.export") && requirePermission(session, "audit:read");
  const canFinance = requirePermission(session, "finance.view");
  const canFinanceWrite = requirePermission(session, "finance.record_payment");
  const canWriteStudents = requirePermission(session, "students.edit");
  const canPromote = requirePermission(session, "students.promote");
  const canAudit = requirePermission(session, "audit:read");

  let ledger: Awaited<ReturnType<typeof getStudentLedger>> | null = null;
  if (canFinance) {
    try {
      ledger = await getStudentLedger({ studentId: student.id });
    } catch (error) {
      console.error("Student ledger failed", student.id, error);
    }
  }
  const currentEnrolment = student.enrolments.find((row) => row.status === "ENROLLED") ?? student.enrolments[0];
  const [grades, classes, campuses, years, audit] = await Promise.all([
    prisma.grade.findMany({ where: { ...schoolFilter, isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.class.findMany({ where: { ...schoolFilter, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.campus.findMany({ where: { ...schoolFilter, isActive: true }, select: { id: true, name: true } }),
    prisma.academicYear.findMany({ where: schoolFilter, select: { id: true, name: true, isCurrent: true }, orderBy: { startDate: "desc" } }),
    canAudit
      ? prisma.auditLog.findMany({
          where: { entity: "Student", entityId: student.id },
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);
  const currentYear = years.find((year) => year.isCurrent) ?? years[0];

  const statusVariant: Record<string, "success" | "warning" | "danger" | "secondary"> = {
    ACTIVE: "success",
    APPLICANT: "warning",
    SUSPENDED: "danger",
    GRADUATED: "secondary",
    WITHDRAWN: "secondary",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/students"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {student.preferredName || student.firstName} {student.lastName}
            </h1>
            <Badge variant={statusVariant[student.status] ?? "secondary"}>{student.status}</Badge>
          </div>
          <p className="text-muted text-sm mt-1">{student.studentNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWriteStudents ? <Button asChild><a href="#edit-student">Edit Student</a></Button> : null}
          {canPromote ? <Button variant="outline" asChild><a href="#promote-student">Promote Student</a></Button> : null}
          <StudentCardButton href={`/api/students/${student.id}/card`} studentNumber={student.studentNumber} label={terms.identityCard} />
          {canExportPopia && <StudentExportButton studentId={student.id} />}
          {canFinance ? (
            <Button variant="outline" asChild>
              <a href={`/api/student-ledger/statement?studentId=${student.id}`}>View Statement</a>
            </Button>
          ) : null}
        </div>
      </div>

      <ProfileTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            hashes: ["edit-student"],
            content: (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <Row label="Preferred name" value={student.preferredName} />
                    <Row label="SA ID" value={student.saIdNumber} />
                    <Row label="Passport" value={student.passportNumber} />
                    <Row label="Email" value={student.email} />
                    <Row label="Phone" value={student.phone} />
                    <Row label="Date of Birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : null} />
                    <Row label="Gender" value={student.gender} />
                    <Row label="Nationality" value={student.nationality} />
                    <Row label="Home language" value={student.homeLanguage} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Academic Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <Row label="School" value={student.school.name} />
                    <Row label="Grade" value={student.grade?.name} />
                    <Row label="Class" value={student.class?.name} />
                    <Row label="Campus" value={student.campus?.name} />
                    <Row label="Enrolled" value={student.enrolledAt ? formatDate(student.enrolledAt) : null} />
                  </CardContent>
                </Card>
                {canWriteStudents ? (
                  <div className="md:col-span-2" id="edit-student">
                    <StudentEditForm
                      studentId={student.id}
                      student={{
                        firstName: student.firstName,
                        middleName: student.middleName,
                        lastName: student.lastName,
                        preferredName: student.preferredName,
                        saIdNumber: student.saIdNumber,
                        passportNumber: student.passportNumber,
                        alternativeId: student.alternativeId,
                        email: student.email,
                        phone: student.phone,
                        dateOfBirth: toIsoDateInput(student.dateOfBirth),
                        gender: student.gender,
                        nationality: student.nationality,
                        homeLanguage: student.homeLanguage,
                        campusId: student.campusId,
                        studentNumber: student.studentNumber,
                        enrolledAt: toIsoDateInput(student.enrolledAt),
                        address: student.address,
                        city: student.city,
                        province: student.province,
                        postalCode: student.postalCode,
                        postalAddress: student.postalAddress,
                        medicalNotes: student.medicalNotes,
                        emergencyName: student.emergencyName,
                        emergencyPhone: student.emergencyPhone,
                        emergencyRelationship: student.emergencyRelationship,
                        notes: student.notes,
                        status: student.status,
                      }}
                      campuses={campuses}
                    />
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            id: "history",
            label: "Academic History",
            content: (
              <Card>
                <CardHeader><CardTitle className="text-base">Enrolment history</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {student.enrolments.map((enrolment) => (
                    <div key={enrolment.id} className="flex justify-between border-b border-border pb-2">
                      <span>{enrolment.academicYear?.name ?? "Unknown year"} — {enrolment.grade?.name ?? "Ungraded"} {enrolment.class?.name ?? ""}</span>
                      <span className="font-medium">{enrolment.status}</span>
                    </div>
                  ))}
                  {student.enrolments.length === 0 ? <p className="text-muted">No enrolment history yet.</p> : null}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "attendance",
            label: "Attendance",
            content: <p className="text-sm text-muted">Use Attendance to capture and review daily registers for this learner.</p>,
          },
          {
            id: "results",
            label: "Results",
            content: <p className="text-sm text-muted">Marks and report cards remain on the Academics screens.</p>,
          },
          {
            id: "finance",
            label: "Finance",
            content: !canFinance ? (
              <p className="text-sm text-muted">Finance is hidden for this account.</p>
            ) : ledger ? (
              <StudentLedgerPanel
                studentId={student.id}
                balance={ledger.balance}
                canWrite={canFinanceWrite}
                entries={ledger.entries.map((e) => ({
                  id: e.id,
                  type: e.type,
                  description: e.description,
                  signedAmount: e.signedAmount,
                  reference: e.reference,
                  entryDate: toIsoDateTime(e.entryDate) ?? "",
                  academicYear: e.academicYear,
                }))}
              />
            ) : (
              <p className="text-sm text-muted">
                Fee history could not be loaded for this learner. Try View Statement, or open Finance.
              </p>
            ),
          },
          {
            id: "documents",
            label: "Documents",
            content: (
              <div className="space-y-6">
                <StudentPhotoPanel studentId={student.id} photoUrl={student.photoUrl} firstName={student.firstName} lastName={student.lastName} canWrite={canWriteStudents} identityCardLabel={terms.identityCard} />
                <StudentDocumentsPanel
                  studentId={student.id}
                  documents={student.documents.map((doc) => ({
                    id: doc.id,
                    type: doc.type,
                    title: doc.title,
                    fileUrl: doc.fileUrl,
                    createdAt: toIsoDateTime(doc.createdAt) ?? "",
                  }))}
                  canWrite={canWriteStudents}
                />
              </div>
            ),
          },
          {
            id: "guardians",
            label: "Guardians",
            content: (
              <StudentPortalPanel
                studentId={student.id}
                studentEmail={student.email}
                studentUserId={student.userId}
                studentStatus={student.status}
                canWrite={canWriteStudents}
                guardians={student.guardians.map((row) => ({
                  id: row.id,
                  relationship: row.relationship,
                  isPrimary: row.isPrimary,
                  guardian: {
                    firstName: row.guardian.firstName,
                    lastName: row.guardian.lastName,
                    email: row.guardian.email,
                    phone: row.guardian.phone,
                    userId: row.guardian.userId,
                  },
                }))}
                portalLabel={terms.portal}
              />
            ),
          },
          {
            id: "communication",
            label: "Communication",
            content: canWriteStudents ? (
              <LetterForm
                defaultStudentId={student.id}
                students={[{ id: student.id, name: `${student.firstName} ${student.lastName}`, studentNumber: student.studentNumber }]}
              />
            ) : (
              <p className="text-sm text-muted">No letter tools for this account.</p>
            ),
          },
          {
            id: "transfers",
            label: "Transfers",
            hashes: ["promote-student"],
            content: (
              <div className="space-y-4" id="promote-student">
                {canPromote && currentYear ? (
                  <StudentPromoteForm
                    studentId={student.id}
                    years={years}
                    grades={grades}
                    classes={classes}
                    currentYearId={currentYear.id}
                    currentGradeName={student.grade?.name ?? "Unassigned"}
                  />
                ) : null}
                <Card>
                  <CardHeader><CardTitle className="text-base">Promotion history</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {student.promotionDecisions.map((row) => (
                      <div key={row.id} className="flex justify-between">
                        <span>{row.fromAcademicYear?.name ?? "Unknown year"} → {row.toGrade?.name ?? row.outcome}</span>
                        <span>{row.outcome ? PROMOTION_OUTCOME_LABELS[row.outcome] : row.eligibility}</span>
                      </div>
                    ))}
                    {student.promotionDecisions.length === 0 ? <p className="text-muted">No promotion decisions yet.</p> : null}
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "audit",
            label: "Activity / Audit",
            content: (
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Student edit history</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {student.changeLogs.map((log) => (
                      <div key={log.id}>
                        <p className="font-medium">{log.field}</p>
                        <p>Previous: {log.oldValue ?? "—"}</p>
                        <p>New: {log.newValue ?? "—"}</p>
                        <p className="text-muted">
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : "System"} · {formatDate(log.createdAt)}
                        </p>
                      </div>
                    ))}
                    {student.changeLogs.length === 0 ? <p className="text-muted">No field changes recorded yet.</p> : null}
                  </CardContent>
                </Card>
                {canAudit ? (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {audit.map((row) => (
                        <div key={row.id} className="flex justify-between">
                          <span>{row.action} · {row.user?.email ?? "system"}</span>
                          <span className="text-muted">{formatDate(row.createdAt)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
                {canWriteStudents && currentEnrolment ? (
                  <EnrolmentServicesForm
                    studentId={student.id}
                    academicYearId={currentEnrolment.academicYear?.id ?? currentEnrolment.academicYearId}
                    academicYearName={currentEnrolment.academicYear?.name ?? "Current year"}
                    gradeId={student.gradeId}
                    classId={student.classId}
                    hostel={currentEnrolment.hostel}
                    transport={currentEnrolment.transport}
                  />
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}
