import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { authorizeAcademicDocument } from "@/lib/fee-clearance";
import { pdfFileResponse } from "@/lib/pdf-response";
import { resolveAcademicPdf } from "@/lib/academic-pdf";
import { institutionScope } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const reportCard = await prisma.reportCard.findFirst({
    where: {
      id,
      publishedAt: { not: null },
      student: institutionScope(session),
    },
    include: { student: { select: { schoolId: true } } },
  });
  if (!reportCard) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const access = await authorizeAcademicDocument({
    session,
    studentId: reportCard.studentId,
    schoolId: reportCard.student.schoolId,
  });
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  const file = await resolveAcademicPdf({ pdfUrl: reportCard.pdfUrl, snapshot: reportCard.snapshot });
  if (!file) return NextResponse.json({ message: "PDF not found" }, { status: 404 });
  return pdfFileResponse(file, `report-card-${id}.pdf`);
}
