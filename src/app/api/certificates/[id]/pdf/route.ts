import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { authorizeAcademicDocument } from "@/lib/fee-clearance";
import { pdfFileResponse } from "@/lib/pdf-response";
import { resolveAcademicPdf } from "@/lib/academic-pdf";
import { scopedId } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const certificate = await prisma.certificate.findFirst({ where: scopedId(session, id) });
  if (!certificate) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const access = await authorizeAcademicDocument({
    session,
    studentId: certificate.studentId,
    schoolId: certificate.schoolId,
  });
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  const file = await resolveAcademicPdf({ pdfUrl: certificate.pdfUrl, snapshot: certificate.snapshot });
  if (!file) return NextResponse.json({ message: "PDF not found" }, { status: 404 });
  return pdfFileResponse(file, `${certificate.certificateNo}.pdf`);
}
