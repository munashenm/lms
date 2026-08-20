import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { certificateSchema } from "@/lib/validators";
import { generateCertificatePdf } from "@/lib/pdf-certificate";
import { toSchoolBrand } from "@/lib/pdf-branding";
import { getTerminology } from "@/lib/terminology";
import { CERTIFICATE_TYPE_LABELS } from "@/lib/certificate-labels";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { writeAcademicPdf } from "@/lib/pdf-response";
import { isLearnerPortalRole } from "@/lib/fee-clearance";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (isLearnerPortalRole(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  const certificates = await prisma.certificate.findMany({
    where: {
      ...(studentId && { studentId }),
      student: getSchoolFilter(session!),
    },
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
      course: { select: { name: true } },
      academicYear: { select: { name: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json({ certificates });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = certificateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, ...getSchoolFilter(session!) },
    include: { school: true, grade: true },
  });
  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(student.schoolId);
  if (denied) return denied;

  const course = parsed.data.courseId
    ? await prisma.course.findUnique({ where: { id: parsed.data.courseId } })
    : null;
  const academicYear = parsed.data.academicYearId
    ? await prisma.academicYear.findUnique({ where: { id: parsed.data.academicYearId } })
    : null;

  const count = await prisma.certificate.count({ where: { schoolId: student.schoolId } });
  const certificateNo = `CERT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const issuedAt = new Date();

  const pdfBytes = await generateCertificatePdf({
    brand: toSchoolBrand(student.school),
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
    studentNumberLabel: getTerminology(student.school.institutionType).admissionNumber,
    title: parsed.data.title,
    type: CERTIFICATE_TYPE_LABELS[parsed.data.type] ?? parsed.data.type,
    courseName: course?.name,
    academicYear: academicYear?.name,
    description: parsed.data.description,
    certificateNo,
    issuedAt: issuedAt.toLocaleDateString("en-ZA"),
  });

  const filename = `cert-${student.studentNumber}-${Date.now()}.pdf`;
  const pdfUrl = await writeAcademicPdf("certificates", filename, pdfBytes);

  const certificate = await prisma.certificate.create({
    data: {
      schoolId: student.schoolId,
      studentId: student.id,
      courseId: parsed.data.courseId ?? null,
      academicYearId: parsed.data.academicYearId ?? null,
      certificateNo,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      pdfUrl,
      issuedById: session!.userId,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      course: { select: { name: true } },
    },
  });

  await logAudit({
    schoolId: student.schoolId,
    userId: session.userId,
    action: "CREATE",
    entity: "Certificate",
    entityId: certificate.id,
    metadata: { studentId: student.id, type: parsed.data.type, certificateNo },
  });

  return NextResponse.json({ certificate }, { status: 201 });
}
