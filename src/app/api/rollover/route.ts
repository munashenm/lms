import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { rolloverCommitSchema } from "@/lib/validators";
import { commitRollover } from "@/lib/rollover";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = rolloverCommitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const schoolId =
      session!.role === UserRole.SUPER_ADMIN && body.schoolId
        ? body.schoolId
        : await requireSchoolId(session!);

    const result = await commitRollover({
      schoolId,
      sourceYearId: parsed.data.sourceYearId,
      targetYearId: parsed.data.targetYearId,
      decisions: parsed.data.decisions,
      activateTarget: parsed.data.activateTarget,
      closeSource: parsed.data.closeSource,
      userId: session!.userId,
    });

    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "UPDATE",
      entity: "AcademicYear",
      entityId: parsed.data.sourceYearId,
      metadata: {
        action: "rollover",
        targetYearId: parsed.data.targetYearId,
        summary: result.summary,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Rollover failed" },
      { status: 400 }
    );
  }
}
