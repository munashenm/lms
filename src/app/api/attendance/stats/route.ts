import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { getAttendanceDashboard } from "@/lib/attendance";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "attendance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const schoolId =
      session!.role === UserRole.SUPER_ADMIN && searchParams.get("schoolId")
        ? searchParams.get("schoolId")!
        : await requireSchoolId(session!);

    const dateParam = searchParams.get("date");
    const threshold = parseInt(searchParams.get("threshold") ?? "80", 10);

    const dashboard = await getAttendanceDashboard({
      schoolId,
      date: dateParam ? new Date(dateParam) : undefined,
      termId: searchParams.get("termId"),
      academicYearId: searchParams.get("academicYearId"),
      gradeId: searchParams.get("gradeId"),
      classId: searchParams.get("classId"),
      threshold: Number.isFinite(threshold) ? threshold : 80,
    });

    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load stats" },
      { status: 400 }
    );
  }
}
