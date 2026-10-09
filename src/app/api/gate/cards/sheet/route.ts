import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { requireSchoolPermission } from "@/lib/gate/access";
import { cardSheetSchema } from "@/lib/gate/schema";
import { generateStudentCardPdf } from "@/lib/pdf-student-card";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { accessCardCopy } from "@/lib/gate/card-print";

export async function POST(request: NextRequest) {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const parsed = cardSheetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Choose up to 40 cards to print" }, { status: 400 });

  const cards = await prisma.accessCard.findMany({
    where: { schoolId: auth.schoolId, status: "ACTIVE", id: { in: parsed.data.cardIds } },
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
  if (cards.length === 0) return NextResponse.json({ message: "No active cards in this school" }, { status: 404 });

  const QRCode = await import("qrcode");
  const year = await prisma.academicYear.findFirst({
    where: { schoolId: auth.schoolId, OR: [{ isCurrent: true }, { status: "ACTIVE" }] },
    orderBy: { startDate: "desc" },
    select: { name: true },
  });
  const sheet = await PDFDocument.create();
  for (const card of cards) {
    const qrPng = await QRCode.toBuffer(card.token, { type: "png", margin: 1, width: 256, errorCorrectionLevel: "M" });
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
    const one = await PDFDocument.load(pdf);
    const [page] = await sheet.copyPages(one, [0]);
    sheet.addPage(page);
  }
  const bytes = await sheet.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="schoolhub-cards.pdf"',
    },
  });
}
