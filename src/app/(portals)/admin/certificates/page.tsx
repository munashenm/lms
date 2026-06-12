import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { CertificateForm } from "@/components/certificates/certificate-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CERTIFICATE_TYPE_LABELS } from "@/lib/pdf-certificate";

export default async function CertificatesPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [certificates, students, courses, academicYears] = await Promise.all([
    prisma.certificate.findMany({
      where: { student: filter },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        course: { select: { name: true } },
        academicYear: { select: { name: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.student.findMany({
      where: { ...filter, status: { in: ["ACTIVE", "GRADUATED"] } },
      orderBy: { lastName: "asc" },
    }),
    prisma.course.findMany({ where: { ...filter, isActive: true }, orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ where: filter, orderBy: { name: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificates</h1>
        <p className="text-muted text-sm mt-1">Issue completion, graduation and merit certificates with PDF export</p>
      </div>

      <CertificateForm
        students={students.map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          studentNumber: s.studentNumber,
        }))}
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        academicYears={academicYears.map((y) => ({ id: y.id, name: y.name }))}
      />

      <Card>
        <CardContent className="p-0">
          {certificates.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No certificates issued yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {certificates.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium">
                      {cert.student.firstName} {cert.student.lastName}
                    </p>
                    <p className="text-sm text-muted">{cert.title}</p>
                    <p className="text-xs text-muted font-mono">{cert.certificateNo}</p>
                    <p className="text-xs text-muted">{formatDate(cert.issuedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{CERTIFICATE_TYPE_LABELS[cert.type] ?? cert.type}</Badge>
                    {cert.pdfUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={cert.pdfUrl} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                          PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
