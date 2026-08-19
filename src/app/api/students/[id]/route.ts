import { NextRequest, NextResponse } from "next/server";
import { StudentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { studentPatchSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import {
  learnerPortalShouldBeActive,
  provisionExistingStudent,
  setLinkedUserActive,
} from "@/lib/portal-provision";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing || !canAccessSchool(session, existing.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = studentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const student = parsed.data.status
    ? await prisma.student.update({
        where: { id },
        data: { status: parsed.data.status as StudentStatus },
      })
    : existing;

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await setLinkedUserActive({
      userId: student.userId,
      schoolId: existing.schoolId,
      actorId: session.userId,
      isActive: learnerPortalShouldBeActive(parsed.data.status),
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entity: "Student",
      entityId: id,
      metadata: { status: parsed.data.status },
    });
  }

  let provision: { studentLoginCreated: boolean; guardianLinked: boolean; invitesSent: number } | null =
    null;
  if (parsed.data.invitePortal) {
    try {
      provision = await provisionExistingStudent({
        studentId: id,
        schoolId: existing.schoolId,
        actorId: session.userId,
      });
    } catch {
      provision = { studentLoginCreated: false, guardianLinked: false, invitesSent: 0 };
    }
  }

  return NextResponse.json({ student, provision });
}
