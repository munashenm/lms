import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { authorizeAcademicDocument } from "@/lib/fee-clearance";
import { pdfFileResponse, readPublicPdf } from "@/lib/pdf-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  const { id } = await params;
  const letter = await prisma.issuedLetter.findUnique({ where: { id } });
  if (!letter) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const access = await authorizeAcademicDocument({
    session,
    studentId: letter.studentId,
    schoolId: letter.schoolId,
  });
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  const file = await readPublicPdf(letter.pdfUrl);
  if (!file) return NextResponse.json({ message: "PDF not found" }, { status: 404 });
  return pdfFileResponse(file, `${letter.letterNo}.pdf`);
}
