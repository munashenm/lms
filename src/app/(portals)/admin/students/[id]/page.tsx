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
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getStudentLedger } from "@/lib/student-ledger";
import { getTerminology } from "@/lib/terminology";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const schoolFilter = getSchoolFilter(session!);

  const student = await prisma.student.findFirst({
    where: { id, ...schoolFilter },
    include: {
      grade: true,
      class: true,
      campus: true,
      guardians: { include: { guardian: true } },
      school: { select: { name: true, institutionType: true } },
    },
  });

  if (!student) notFound();

  const terms = getTerminology(student.school.institutionType);
  const canExportPopia =
    requirePermission(session, "students:read") && requirePermission(session, "audit:read");
  const canFinance = requirePermission(session, "finance:read");
  const canFinanceWrite = requirePermission(session, "finance:write");
  const canWriteStudents = requirePermission(session, "students:write");

  const ledger = canFinance
    ? await getStudentLedger({ studentId: student.id })
    : null;
  const currentEnrolment = await prisma.enrolment.findFirst({
    where: { studentId: student.id, academicYear: { isCurrent: true } },
    include: { academicYear: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const [grades, classes, campuses] = canWriteStudents
    ? await Promise.all([
        prisma.grade.findMany({
          where: { ...schoolFilter, isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.class.findMany({
          where: { ...schoolFilter, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.campus.findMany({
          where: { ...schoolFilter, isActive: true },
          select: { id: true, name: true },
        }),
      ])
    : [
        [] as { id: string; name: string }[],
        [] as { id: string; name: string }[],
        [] as { id: string; name: string }[],
      ];

  const statusVariant: Record<string, "success" | "warning" | "danger" | "secondary"> = {
    ACTIVE: "success",
    APPLICANT: "warning",
    SUSPENDED: "danger",
    GRADUATED: "secondary",
    WITHDRAWN: "secondary",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {student.firstName} {student.lastName}
            </h1>
            <Badge variant={statusVariant[student.status] ?? "secondary"}>
              {student.status}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">{student.studentNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StudentCardButton
            href={`/api/students/${student.id}/card`}
            studentNumber={student.studentNumber}
            label={terms.identityCard}
          />
          {canExportPopia && <StudentExportButton studentId={student.id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="SA ID" value={student.saIdNumber} />
            <Row label="Email" value={student.email} />
            <Row label="Phone" value={student.phone} />
            <Row label="Date of Birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : null} />
            <Row label="Gender" value={student.gender} />
            <Row label="POPIA Consent" value={student.popiaConsentAt ? formatDate(student.popiaConsentAt) : "Not recorded"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Academic Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="School" value={student.school.name} />
            <Row label="Grade" value={student.grade?.name} />
            <Row label="Class" value={student.class?.name} />
            <Row label="Campus" value={student.campus?.name} />
            <Row label="Enrolled" value={student.enrolledAt ? formatDate(student.enrolledAt) : null} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Street" value={student.address} />
            <Row label="City" value={student.city} />
            <Row label="Province" value={student.province} />
            <Row label="Postal Code" value={student.postalCode} />
          </CardContent>
        </Card>

        <StudentPortalPanel
          studentId={student.id}
          studentEmail={student.email}
          studentUserId={student.userId}
          studentStatus={student.status}
          canWrite={canWriteStudents}
          guardians={student.guardians}
        />
      </div>

      {canWriteStudents ? (
        <StudentEditForm
          studentId={student.id}
          student={{
            firstName: student.firstName,
            lastName: student.lastName,
            saIdNumber: student.saIdNumber,
            email: student.email,
            phone: student.phone,
            dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString().slice(0, 10) : null,
            gender: student.gender,
            gradeId: student.gradeId,
            classId: student.classId,
            campusId: student.campusId,
            address: student.address,
            city: student.city,
            province: student.province,
            postalCode: student.postalCode,
          }}
          grades={grades}
          classes={classes}
          campuses={campuses}
        />
      ) : null}

      {canWriteStudents && currentEnrolment ? (
        <EnrolmentServicesForm
          studentId={student.id}
          academicYearId={currentEnrolment.academicYear.id}
          academicYearName={currentEnrolment.academicYear.name}
          gradeId={student.gradeId}
          classId={student.classId}
          hostel={currentEnrolment.hostel}
          transport={currentEnrolment.transport}
        />
      ) : null}

      {ledger && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Financial account</h2>
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
              entryDate: e.entryDate.toISOString(),
              academicYear: e.academicYear,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
