import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { ingestAttendanceForPeriod, ingestClockPunches, parseClockPunches } from "@/lib/timesheet-clock";
import { z } from "zod";

const schema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  employeeId: z.string().optional(),
  punches: z.unknown().optional(),
  fromAttendance: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "hr.employees.manage") && !requirePermission(session, "payroll.prepare")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const periodStart = new Date(parsed.data.periodStart);
  const periodEnd = new Date(parsed.data.periodEnd);

  if (parsed.data.punches) {
    const summary = await ingestClockPunches({
      schoolId,
      punches: parseClockPunches(parsed.data.punches),
      periodStart,
      periodEnd,
    });
    return NextResponse.json({ summary }, { status: 201 });
  }

  const summary = await ingestAttendanceForPeriod({
    schoolId,
    employeeId: parsed.data.employeeId,
    periodStart,
    periodEnd,
  });
  return NextResponse.json({ summary }, { status: 201 });
}
