import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { teacherSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { licenseDeniedResponse, licenseWriteGuard, requireLicenseWrite } from "@/lib/licensing/enforce";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "staff:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const teachers = await prisma.teacher.findMany({
    where: { ...getSchoolFilter(session), status: "ACTIVE" },
    include: {
      campus: { select: { name: true } },
      classTeachers: { include: { class: { select: { name: true } } } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json({ teachers });
}

async function nextEmployeeNumber(schoolId: string) {
  const count = await prisma.teacher.count({ where: { schoolId } });
  return `EMP${String(count + 1).padStart(4, "0")}`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "staff:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = teacherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && body.schoolId
      ? body.schoolId
      : await requireSchoolId(session!);
  const restricted = await requireLicenseWrite(schoolId);
  if (restricted) return restricted;

  const guard = await licenseWriteGuard({ schoolId, action: "create_educator" });
  if (!guard.ok) return licenseDeniedResponse(guard);

  const employeeNumber = parsed.data.employeeNumber?.trim() || (await nextEmployeeNumber(schoolId));
  const existing = await prisma.teacher.findUnique({
    where: { schoolId_employeeNumber: { schoolId, employeeNumber } },
  });
  if (existing) {
    return NextResponse.json({ message: "Employee number already exists" }, { status: 400 });
  }

  const teacher = await prisma.teacher.create({
    data: {
      schoolId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      employeeNumber,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      department: parsed.data.department || null,
      campusId: parsed.data.campusId || null,
      saIdNumber: parsed.data.saIdNumber || null,
    },
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Teacher",
    entityId: teacher.id,
    metadata: { employeeNumber },
  });

  return NextResponse.json({ teacher }, { status: 201 });
}
