import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

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
      school: { select: { name: true } },
    },
  });

  if (!student) notFound();

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

        {student.guardians.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Guardians</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {student.guardians.map((sg) => (
                  <div key={sg.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        {sg.guardian.firstName} {sg.guardian.lastName}
                        {sg.isPrimary && (
                          <Badge variant="accent" className="ml-2">Primary</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted">{sg.relationship}</p>
                    </div>
                    <p className="text-xs text-muted">{sg.guardian.phone ?? sg.guardian.email}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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
