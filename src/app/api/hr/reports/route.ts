import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { getHrReport } from "@/lib/reports";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  return NextResponse.json(await getHrReport(getSchoolFilter(session)));
}
