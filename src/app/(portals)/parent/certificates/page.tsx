import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CERTIFICATE_TYPE_LABELS } from "@/lib/certificate-labels";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentCertificatesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;

  const certificates = filterIds.length
    ? await prisma.certificate.findMany({
        where: { studentId: { in: filterIds } },
        include: {
          course: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: { issuedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificates</h1>
        <p className="text-muted text-sm mt-1">Issued certificates for your children</p>
      </div>

      <ChildFilter
        children={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/certificates"
      />

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No certificates issued yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{cert.title}</p>
                  <p className="text-sm text-muted">
                    {cert.student.firstName} {cert.student.lastName}
                    {cert.course?.name ? ` · ${cert.course.name}` : ""}
                  </p>
                  <p className="text-xs text-muted font-mono mt-1">{cert.certificateNo}</p>
                  <p className="text-xs text-muted">{formatDate(cert.issuedAt)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
