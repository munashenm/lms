import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { sumTimesheetHours } from "@/lib/timesheet-hours";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "update"]).default("update"),
  notes: z.string().optional().nullable(),
  entries: z
    .array(
      z.object({
        workDate: z.string().min(1),
        hours: z.coerce.number().min(0).max(24),
        overtimeHours: z.coerce.number().min(0).max(24).optional(),
        notes: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const timesheet = await prisma.timesheet.findUnique({
    where: { id },
    include: { employee: true, entries: true },
  });
  if (!timesheet || !canAccessSchool(session, timesheet.employee.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(timesheet.employee.schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const isSelf = timesheet.employee.userId === session.userId;
  const canManage = requirePermission(session, "hr.employees.manage") || requirePermission(session, "payroll.prepare");

  if (parsed.data.action === "approve" || parsed.data.action === "reject") {
    if (!canManage) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    const updated = await prisma.timesheet.update({
      where: { id },
      data: {
        status: parsed.data.action === "approve" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        notes: parsed.data.notes ?? timesheet.notes,
      },
      include: { entries: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
    });
    return NextResponse.json({ timesheet: updated });
  }

  if (!isSelf && !canManage) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (timesheet.status === ApprovalStatus.APPROVED || timesheet.status === ApprovalStatus.POSTED) {
    return NextResponse.json({ message: "Approved timesheets cannot be edited" }, { status: 400 });
  }

  const hours = parsed.data.entries ? sumTimesheetHours(parsed.data.entries) : null;
  if (parsed.data.entries) {
    await prisma.timesheetEntry.deleteMany({ where: { timesheetId: id } });
    await prisma.timesheetEntry.createMany({
      data: parsed.data.entries.map((entry) => ({
        timesheetId: id,
        workDate: new Date(entry.workDate),
        hours: entry.hours,
        overtimeHours: entry.overtimeHours ?? 0,
        notes: entry.notes ?? null,
      })),
    });
  }

  const updated = await prisma.timesheet.update({
    where: { id },
    data: {
      notes: parsed.data.notes ?? timesheet.notes,
      status: parsed.data.action === "submit" ? ApprovalStatus.PENDING : timesheet.status,
      ...(hours ? { totalHours: hours.totalHours, overtimeHours: hours.overtimeHours } : {}),
    },
    include: { entries: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
  });
  return NextResponse.json({ timesheet: updated });
}
