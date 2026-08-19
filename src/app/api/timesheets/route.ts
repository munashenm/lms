import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { sumTimesheetHours } from "@/lib/timesheet-hours";
import { z } from "zod";

const entrySchema = z.object({
  workDate: z.string().min(1),
  hours: z.coerce.number().min(0).max(24),
  overtimeHours: z.coerce.number().min(0).max(24).optional(),
  notes: z.string().optional().nullable(),
});

const schema = z.object({
  employeeId: z.string().optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  notes: z.string().optional().nullable(),
  entries: z.array(entrySchema).default([]),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const mine = request.nextUrl.searchParams.get("scope") === "mine";
  const employee = await prisma.employee.findFirst({
    where: { userId: session.userId, ...(session.schoolId ? { schoolId: session.schoolId } : {}) },
  });
  if (mine) {
    if (!employee) return NextResponse.json({ timesheets: [] });
    const timesheets = await prisma.timesheet.findMany({
      where: { employeeId: employee.id },
      include: { entries: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { periodStart: "desc" },
    });
    return NextResponse.json({ timesheets });
  }
  if (!requirePermission(session, "hr.view") && !requirePermission(session, "payroll.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const timesheets = await prisma.timesheet.findMany({
    where: { employee: getSchoolFilter(session) },
    include: { entries: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: { periodStart: "desc" },
    take: 200,
  });
  return NextResponse.json({ timesheets });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const schoolId = await requireSchoolId(session);
  const denied = await requireLicenseWrite(schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const self = await prisma.employee.findFirst({ where: { userId: session.userId, schoolId } });
  const employeeId = parsed.data.employeeId ?? self?.id;
  if (!employeeId) return NextResponse.json({ message: "Employee not found" }, { status: 400 });
  const canManage = requirePermission(session, "hr.employees.manage");
  if (!canManage && self?.id !== employeeId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, schoolId } });
  if (!employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });

  const hours = sumTimesheetHours(parsed.data.entries);
  const timesheet = await prisma.timesheet.create({
    data: {
      employeeId,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      notes: parsed.data.notes ?? null,
      totalHours: hours.totalHours,
      overtimeHours: hours.overtimeHours,
      status: ApprovalStatus.DRAFT,
      entries: {
        create: parsed.data.entries.map((entry) => ({
          workDate: new Date(entry.workDate),
          hours: entry.hours,
          overtimeHours: entry.overtimeHours ?? 0,
          notes: entry.notes ?? null,
        })),
      },
    },
    include: { entries: true },
  });
  return NextResponse.json({ timesheet }, { status: 201 });
}
