import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSchoolPermission } from "@/lib/gate/access";
import { generateStudentCardPdf } from "@/lib/pdf-student-card";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { accessCardCopy } from "@/lib/gate/card-print";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const card = await prisma.accessCard.findFirst({
    where: { id, schoolId: auth.schoolId, status: "ACTIVE" },
    include: {
      school: true,
      student: { select: { firstName: true, lastName: true, studentNumber: true, photoUrl: true, grade: { select: { name: true } }, class: { select: { name: true } } } },
      employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: true, department: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          employee: { select: { employeeNumber: true, position: true, department: true } },
          teacher: { select: { employeeNumber: true, department: true } },
        },
      },
    },
  });
  if (!card) return NextResponse.json({ message: "Card not found" }, { status: 404 });

  let qrPng: Uint8Array | null = null;
  try {
    const QRCode = await import("qrcode");
    qrPng = await QRCode.toBuffer(card.token, { type: "png", margin: 1, width: 256, errorCorrectionLevel: "M" });
  } catch {
    qrPng = null;
  }

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: auth.schoolId, OR: [{ isCurrent: true }, { status: "ACTIVE" }] },
    orderBy: { startDate: "desc" },
    select: { name: true },
  });
  const copy = accessCardCopy({
    student: card.student,
    employee: card.employee,
    user: card.user,
    validYear: year?.name ?? null,
  });
  const pdf = await generateStudentCardPdf({
    brand: toSchoolBrand(card.school),
    ...copy,
    scanToken: card.token,
    qrPng,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="schoolhub-card.pdf"`,
    },
  });
}
