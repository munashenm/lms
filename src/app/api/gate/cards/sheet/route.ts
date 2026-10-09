import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { requireSchoolPermission } from "@/lib/gate/access";
import { cardSheetSchema } from "@/lib/gate/schema";
import { generateStudentCardPdf } from "@/lib/pdf-student-card";
import { toSchoolBrand } from "@/lib/pdf-branding";

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
  const sheet = await PDFDocument.create();
  for (const card of cards) {
    const qrPng = await QRCode.toBuffer(card.token, { type: "png", margin: 1, width: 256, errorCorrectionLevel: "M" });
    const student = card.student;
    const employee = card.employee;
    const user = card.user;
    const pdf = await generateStudentCardPdf({
      brand: toSchoolBrand(card.school),
      studentName: student
        ? `${student.firstName} ${student.lastName}`
        : employee
          ? `${employee.firstName} ${employee.lastName}`
          : user
            ? `${user.firstName} ${user.lastName}`
            : "Card holder",
      studentNumber: student?.studentNumber ?? employee?.employeeNumber ?? user?.employee?.employeeNumber ?? user?.teacher?.employeeNumber ?? "—",
      studentNumberLabel: student ? "Learner No" : "Staff No",
      cardTitle: student ? "LEARNER IDENTITY CARD" : "STAFF IDENTITY CARD",
      gradeOrProgramme: student?.grade?.name ?? employee?.department ?? user?.employee?.department ?? user?.teacher?.department ?? null,
      className: student?.class?.name ?? employee?.position ?? user?.employee?.position ?? null,
      status: "ACTIVE",
      photoUrl: student?.photoUrl ?? user?.avatarUrl ?? null,
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
