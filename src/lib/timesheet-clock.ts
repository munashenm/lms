import { ApprovalStatus } from "@prisma/client";
import { prisma } from "./db";
import {
  hoursBetweenHhmm,
  overtimeHoursFromMinutes,
  parseClockPunches,
  type ClockPunch,
} from "./clock-hours";
import { sumTimesheetHours } from "./timesheet-hours";
import { roundMoney } from "./money";

export { parseClockPunches, hoursBetweenHhmm } from "./clock-hours";

export async function ingestClockPunches(params: {
  schoolId: string;
  punches: ClockPunch[];
  periodStart: Date;
  periodEnd: Date;
}) {
  const grouped = new Map<string, ClockPunch[]>();
  for (const punch of params.punches) {
    const employee = punch.employeeId
      ? await prisma.employee.findFirst({ where: { id: punch.employeeId, schoolId: params.schoolId } })
      : punch.employeeNumber
        ? await prisma.employee.findFirst({
            where: { schoolId: params.schoolId, employeeNumber: punch.employeeNumber },
          })
        : null;
    if (!employee) continue;
    const list = grouped.get(employee.id) ?? [];
    list.push(punch);
    grouped.set(employee.id, list);
  }

  const timesheets = [];
  for (const [employeeId, punches] of grouped) {
    const existing = await prisma.timesheet.findFirst({
      where: {
        employeeId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      },
      include: { entries: true },
    });
    if (existing && (existing.status === ApprovalStatus.APPROVED || existing.status === ApprovalStatus.POSTED)) {
      continue;
    }

    const byDate = new Map<string, { hours: number; overtimeHours: number; notes: string | null }>();
    for (const punch of existing?.entries ?? []) {
      byDate.set(punch.workDate.toISOString().slice(0, 10), {
        hours: Number(punch.hours),
        overtimeHours: Number(punch.overtimeHours),
        notes: punch.notes,
      });
    }
    for (const punch of punches) {
      const day = punch.workDate.slice(0, 10);
      const hours = hoursBetweenHhmm(punch.checkIn, punch.checkOut);
      const overtime = punch.overtimeHours != null
        ? Number(punch.overtimeHours)
        : overtimeHoursFromMinutes(punch.overtimeMinutes);
      if (hours <= 0 && overtime <= 0) continue;
      byDate.set(day, {
        hours: roundMoney(hours),
        overtimeHours: roundMoney(overtime),
        notes: punch.notes ?? punch.source ?? "CLOCK",
      });
    }

    const entries = [...byDate.entries()].map(([workDate, row]) => ({
      workDate: new Date(`${workDate}T00:00:00.000Z`),
      hours: row.hours,
      overtimeHours: row.overtimeHours,
      notes: row.notes,
    }));
    const totals = sumTimesheetHours(entries);

    if (existing) {
      await prisma.timesheetEntry.deleteMany({ where: { timesheetId: existing.id } });
      await prisma.timesheetEntry.createMany({
        data: entries.map((entry) => ({ ...entry, timesheetId: existing.id })),
      });
      timesheets.push(
        await prisma.timesheet.update({
          where: { id: existing.id },
          data: {
            totalHours: totals.totalHours,
            overtimeHours: totals.overtimeHours,
            status: ApprovalStatus.DRAFT,
            notes: "Generated from clock / attendance punches",
          },
        })
      );
    } else {
      timesheets.push(
        await prisma.timesheet.create({
          data: {
            employeeId,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            totalHours: totals.totalHours,
            overtimeHours: totals.overtimeHours,
            status: ApprovalStatus.DRAFT,
            notes: "Generated from clock / attendance punches",
            entries: { create: entries },
          },
        })
      );
    }
  }

  return { employees: grouped.size, timesheets: timesheets.length };
}

export async function ingestAttendanceForPeriod(params: {
  schoolId: string;
  employeeId?: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const records = await prisma.staffAttendanceRecord.findMany({
    where: {
      schoolId: params.schoolId,
      date: { gte: params.periodStart, lte: params.periodEnd },
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    },
  });
  const punches: ClockPunch[] = records.map((row) => ({
    employeeId: row.employeeId ?? undefined,
    workDate: row.date.toISOString().slice(0, 10),
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    overtimeMinutes: row.overtimeMinutes,
    source: row.source,
  }));
  return ingestClockPunches({
    schoolId: params.schoolId,
    punches,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
}
