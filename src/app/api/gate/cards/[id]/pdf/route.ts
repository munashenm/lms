import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSchoolPermission } from "@/lib/gate/access";
import { generateStudentCardPdf } from "@/lib/pdf-student-card";
import { toSchoolBrand } from "@/lib/pdf-branding";

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

  const student = card.student;
  const user = card.user;
  const pdf = await generateStudentCardPdf({
    brand: toSchoolBrand(card.school),
    studentName: student ? `${student.firstName} ${student.lastName}` : user ? `${user.firstName} ${user.lastName}` : "Card holder",
    studentNumber: student?.studentNumber ?? user?.employee?.employeeNumber ?? user?.teacher?.employeeNumber ?? "—",
    studentNumberLabel: student ? "Learner No" : "Staff No",
    cardTitle: student ? "LEARNER IDENTITY CARD" : "STAFF IDENTITY CARD",
    gradeOrProgramme: student?.grade?.name ?? user?.employee?.department ?? user?.teacher?.department ?? null,
    className: student?.class?.name ?? user?.employee?.position ?? null,
    status: "ACTIVE",
    photoUrl: student?.photoUrl ?? user?.avatarUrl ?? null,
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
