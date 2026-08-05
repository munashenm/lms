import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { buildStudentPopiaExport } from "@/lib/student-export";
import { logAudit } from "@/lib/audit";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "students:read") || !requirePermission(session, "audit:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const filter = getSchoolFilter(session!);
  const schoolId = "schoolId" in filter ? filter.schoolId : undefined;

  if (session!.role !== UserRole.SUPER_ADMIN && !schoolId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  if (schoolId) {
    const owned = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }
  }

  const payload = await buildStudentPopiaExport(id, schoolId);
  if (!payload) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const exportSchoolId =
    schoolId ??
    (await prisma.student.findUnique({ where: { id }, select: { schoolId: true } }))?.schoolId;

  if (exportSchoolId) {
    await logAudit({
      schoolId: exportSchoolId,
      userId: session!.userId,
      action: "EXPORT",
      entity: "Student",
      entityId: id,
      metadata: { type: "POPIA_DATA_EXPORT" },
    });
  }

  const filename = `popia-export-${payload.profile.studentNumber}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
