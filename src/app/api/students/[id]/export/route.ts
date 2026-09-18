import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { buildStudentPopiaExport } from "@/lib/student-export";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { scopedId } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "students:read") || !requirePermission(session, "audit:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: scopedId(session, id),
    select: { id: true, schoolId: true },
  });
  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const payload = await buildStudentPopiaExport(id, student.schoolId);
  if (!payload) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  await logAudit({
    schoolId: student.schoolId,
    userId: session.userId,
    action: "EXPORT",
    entity: "Student",
    entityId: id,
    metadata: { type: "POPIA_DATA_EXPORT" },
  });

  const filename = `popia-export-${payload.profile.studentNumber}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
