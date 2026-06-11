import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { studentSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "students:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status");
  const gradeId = searchParams.get("gradeId");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const schoolFilter = getSchoolFilter(session);

  const where = {
    ...schoolFilter,
    ...(status && { status: status as "ACTIVE" | "APPLICANT" | "SUSPENDED" | "GRADUATED" | "WITHDRAWN" }),
    ...(gradeId && { gradeId }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { studentNumber: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        grade: { select: { name: true } },
        class: { select: { name: true } },
        campus: { select: { name: true } },
      },
      orderBy: { lastName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);

  return NextResponse.json({
    students,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = studentSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() ?? "form";
        errors[key] = issue.message;
      });
      return NextResponse.json({ errors }, { status: 400 });
    }

    const schoolId = session.schoolId;
    if (!schoolId) {
      return NextResponse.json({ message: "School context required" }, { status: 400 });
    }

    const data = parsed.data;

    const existing = await prisma.student.findUnique({
      where: { schoolId_studentNumber: { schoolId, studentNumber: data.studentNumber } },
    });
    if (existing) {
      return NextResponse.json(
        { errors: { studentNumber: "Student number already exists" } },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        schoolId,
        firstName: data.firstName,
        lastName: data.lastName,
        studentNumber: data.studentNumber,
        saIdNumber: data.saIdNumber || null,
        email: data.email || null,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender || null,
        gradeId: data.gradeId || null,
        classId: data.classId || null,
        campusId: data.campusId || null,
        address: data.address || null,
        city: data.city || null,
        province: data.province || null,
        postalCode: data.postalCode || null,
        status: data.status,
        popiaConsentAt: data.popiaConsent ? new Date() : null,
        enrolledAt: new Date(),
      },
      include: {
        grade: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    await logAudit({
      schoolId,
      userId: session.userId,
      action: "CREATE",
      entity: "Student",
      entityId: student.id,
      metadata: { studentNumber: student.studentNumber },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    console.error("Create student error:", error);
    return NextResponse.json({ message: "Failed to create student" }, { status: 500 });
  }
}
