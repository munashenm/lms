import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { rolloverPreviewSchema } from "@/lib/validators";
import { buildRolloverPreview } from "@/lib/rollover";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/rollover/preview",
      method: "POST",
    });
    if (__licDenied) return __licDenied;
  }

if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = rolloverPreviewSchema.safeParse(body);
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

    const preview = await buildRolloverPreview({
      schoolId,
      sourceYearId: parsed.data.sourceYearId,
      targetYearId: parsed.data.targetYearId,
      gradeId: parsed.data.gradeId,
      classId: parsed.data.classId,
    });

    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Preview failed" },
      { status: 400 }
    );
  }
}
