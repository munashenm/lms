import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CERTIFICATE_TYPE_LABELS } from "@/lib/certificate-labels";
import { getDocumentRelease } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type CertificateWithCourse = Prisma.CertificateGetPayload<{
  include: { course: { select: { name: true } } };
}>;

export default async function StudentCertificatesPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const release = student ? await getDocumentRelease(student.id) : { released: true, outstandingCents: 0, requireFees: false };

  let certificates: CertificateWithCourse[] = [];
  let loadError: string | null = null;

  if (student && release.released) {
    try {
      certificates = await prisma.certificate.findMany({
        where: { studentId: student.id },
        include: { course: { select: { name: true } } },
        orderBy: { issuedAt: "desc" },
      });
    } catch {
      loadError = "Certificates are temporarily unavailable. Please try again shortly.";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Certificates</h1>
        <p className="text-muted text-sm mt-1">Certificates are released when school fees are paid in full</p>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">{loadError}</CardContent>
        </Card>
      ) : !student ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            Your student profile could not be loaded.
          </CardContent>
        </Card>
      ) : !release.released ? (
        <DocumentsHoldNotice outstandingCents={release.outstandingCents} feesHref="/student/fees" />
      ) : certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No certificates issued to you yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{cert.title}</p>
                  <p className="text-sm text-muted">{cert.course?.name}</p>
                  <p className="text-xs text-muted font-mono mt-1">{cert.certificateNo}</p>
                  <p className="text-xs text-muted">{formatDate(cert.issuedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{CERTIFICATE_TYPE_LABELS[cert.type] ?? cert.type}</Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/certificates/${cert.id}/pdf`}>
                      <Download className="h-4 w-4" />
                      PDF
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
