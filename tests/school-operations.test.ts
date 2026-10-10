import { describe, expect, it } from "vitest";
import { proposeTimetable } from "@/lib/timetable-generate";
import { calculateEmployeePay } from "@/lib/payroll-engine";
import { payrollConfigurationChecks, payrollFormDefaults, uifFinaliseBlockers, ZA_UIF_MONTHLY_CEILING } from "@/lib/payroll-checks";
import { summarizeInvoices } from "@/lib/invoice-summary";
import { calendarKindForAssessment, groupCalendarEntries, isHighlightedCalendarDate } from "@/lib/academic-calendar";
import { attendanceOccupancyGaps } from "@/lib/attendance-occupancy";
import { reminderDueWindows } from "@/lib/fee-reminder-rules";
import { johannesburgDateKey, johannesburgDayStart } from "@/lib/school-day";

describe("timetable generation", () => {
  const periods = [{ startTime: "08:00", endTime: "08:45" }];
  const days = ["MONDAY" as const];

  it("blocks a second lesson that shares the teacher or room", () => {
    const result = proposeTimetable({
      periods,
      days,
      lessons: [
        { classId: "c1", subjectId: "math", teacherId: "t1", room: "Lab", periodsPerWeek: 1, subjectName: "Math" },
        { classId: "c2", subjectId: "science", teacherId: "t1", room: "Lab", periodsPerWeek: 1, subjectName: "Science" },
      ],
    });
    expect(result.placed).toHaveLength(1);
    expect(result.placed[0]).toMatchObject({ classId: "c1", teacherId: "t1", room: "Lab" });
    expect(result.unplaced[0]).toMatchObject({ subjectId: "science" });
    expect(result.unplaced[0].reason).toMatch(/clash/);
  });

  it("does not add another period when the subject is already on the timetable", () => {
    const result = proposeTimetable({
      lessons: [{ classId: "c1", subjectId: "math", teacherId: "t1", room: "1", periodsPerWeek: 1 }],
      existing: [{
        classId: "c1",
        subjectId: "math",
        teacherId: "t1",
        room: "1",
        dayOfWeek: "TUESDAY",
        startTime: "09:15",
        endTime: "10:00",
      }],
    });
    expect(result.placed).toHaveLength(0);
    expect(result.unplaced).toHaveLength(0);
  });

  it("spreads one subject across different days", () => {
    const result = proposeTimetable({
      lessons: [{ classId: "c1", subjectId: "math", teacherId: "t1", room: "1", periodsPerWeek: 3 }],
    });
    expect(result.placed.map((slot) => slot.dayOfWeek)).toEqual(["MONDAY", "TUESDAY", "WEDNESDAY"]);
    expect(result.unplaced).toHaveLength(0);
  });
});

describe("payroll configuration", () => {
  it("caps UIF at the configured monthly ceiling and leaves tax on full gross", () => {
    const result = calculateEmployeePay(
      { payType: "MONTHLY", baseSalary: 20000 },
      {
        employeeTaxPercent: 10,
        uifEmployeePercent: 1,
        uifEmployerPercent: 1,
        uifMonthlyCeiling: ZA_UIF_MONTHLY_CEILING,
      }
    );
    expect(result.deductions.find((row) => row.name === "Income tax")?.amount).toBe(2000);
    expect(result.deductions.find((row) => row.name === "UIF (employee)")?.amount).toBe(177.12);
    expect(result.employer.find((row) => row.name === "UIF (employer)")?.amount).toBe(177.12);
  });

  it("warns when ZA UIF, the ceiling, SDL, or PAYE do not match the usual setup", () => {
    const checks = payrollConfigurationChecks({
      jurisdiction: "ZA",
      employeeTaxPercent: 0,
      uifEmployeePercent: 0,
      uifEmployerPercent: 0,
      sdlEmployerPercent: 2,
      uifMonthlyCeiling: 0,
    });
    expect(checks.filter((check) => check.level === "warning").length).toBeGreaterThanOrEqual(3);
    const ready = payrollConfigurationChecks({
      jurisdiction: "ZA",
      employeeTaxPercent: 18,
      uifEmployeePercent: 1,
      uifEmployerPercent: 1,
      sdlEmployerPercent: 1,
      uifMonthlyCeiling: ZA_UIF_MONTHLY_CEILING,
    });
    expect(ready.some((check) => check.message.includes("UIF rates are 1%"))).toBe(true);
    expect(ready.some((check) => check.message.includes("flat percent"))).toBe(true);
  });

  it("blocks finalising a ZA run when UIF rates or the ceiling are missing", () => {
    expect(uifFinaliseBlockers({ jurisdiction: "NA" })).toEqual([]);
    expect(
      uifFinaliseBlockers({
        jurisdiction: "ZA",
        uifEmployeePercent: 1,
        uifEmployerPercent: 1,
        uifMonthlyCeiling: ZA_UIF_MONTHLY_CEILING,
      })
    ).toEqual([]);
    expect(
      uifFinaliseBlockers({
        jurisdiction: "ZA",
        uifEmployeePercent: 1,
        uifEmployerPercent: 1,
        uifMonthlyCeiling: 15000,
      })
    ).toEqual([]);
    const missing = uifFinaliseBlockers({
      jurisdiction: "ZA",
      uifEmployeePercent: 0,
      uifEmployerPercent: 0,
      uifMonthlyCeiling: 0,
    });
    expect(missing.some((message) => message.includes("1%"))).toBe(true);
    expect(missing.some((message) => message.includes("ceiling"))).toBe(true);
    expect(
      uifFinaliseBlockers({
        jurisdiction: "ZA",
        uifEmployeePercent: 1,
        uifEmployerPercent: 2,
        uifMonthlyCeiling: ZA_UIF_MONTHLY_CEILING,
      })[0]
    ).toMatch(/1%/);
  });

  it("suggests statutory UIF only when the institution has not saved a rule set", () => {
    const suggested = payrollFormDefaults(null);
    expect(suggested.uifEmployeePercent).toBe(1);
    expect(suggested.uifEmployerPercent).toBe(1);
    expect(suggested.uifMonthlyCeiling).toBe(ZA_UIF_MONTHLY_CEILING);
    expect(payrollFormDefaults({ uifEmployeePercent: 0, uifEmployerPercent: 0, uifMonthlyCeiling: 0 })).toEqual({
      uifEmployeePercent: 0,
      uifEmployerPercent: 0,
      uifMonthlyCeiling: 0,
    });
  });
});

describe("invoice summary", () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

  it("counts unpaid and partly paid past-due invoices, and skips drafts and cancellations", () => {
    const summary = summarizeInvoices([
      { status: "SENT", total: 1000, amountPaid: 0, dueDate: past },
      { status: "PARTIALLY_PAID", total: 1000, amountPaid: 400, dueDate: past },
      { status: "SENT", total: 500, amountPaid: 0, dueDate: future },
      { status: "PAID", total: 800, amountPaid: 800, dueDate: past },
      { status: "DRAFT", total: 900, amountPaid: 0, dueDate: past },
      { status: "CANCELLED", total: 700, amountPaid: 0, dueDate: past },
    ]);
    expect(summary.outstanding).toBe(2100);
    expect(summary.overdueCount).toBe(2);
  });
});

describe("academic calendar", () => {
  it("groups examinations, deadlines, and events, and highlights the next week", () => {
    expect(calendarKindForAssessment("EXAM")).toBe("EXAM");
    expect(calendarKindForAssessment("ASSIGNMENT")).toBe("DEADLINE");
    expect(calendarKindForAssessment("NOTICE")).toBe("EVENT");
    const now = new Date("2026-10-10T08:00:00.000Z");
    const groups = groupCalendarEntries([
      { date: "2026-10-20T08:00:00.000Z", kind: "EVENT", label: "Sports day" },
      { date: "2026-10-12T08:00:00.000Z", kind: "EXAM", label: "Math exam" },
      { date: "2026-10-11T08:00:00.000Z", kind: "DEADLINE", label: "Essay" },
    ]);
    expect(groups.map((group) => group.title)).toEqual(["Examinations", "Deadlines", "Institutional events"]);
    expect(isHighlightedCalendarDate("2026-10-12T08:00:00.000Z", now)).toBe(true);
    expect(isHighlightedCalendarDate("2026-10-20T08:00:00.000Z", now)).toBe(false);
    expect(isHighlightedCalendarDate("2026-10-09T08:00:00.000Z", now)).toBe(false);
  });
});

describe("attendance and occupancy", () => {
  it("lists learners whose register and gate presence disagree", () => {
    const gaps = attendanceOccupancyGaps({
      onSiteStudentIds: ["on-site-absent", "present-on-site"],
      attendance: [
        { studentId: "missing", name: "A", status: "PRESENT" },
        { studentId: "missing", name: "A duplicate", status: "ABSENT" },
        { studentId: "on-site-absent", name: "B", status: "SICK" },
        { studentId: "present-on-site", name: "C", status: "LATE" },
        { studentId: "away", name: "D", status: "ABSENT" },
      ],
    });
    expect(gaps.presentNotOnSite.map((row) => row.studentId)).toEqual(["missing"]);
    expect(gaps.absentButOnSite.map((row) => row.studentId)).toEqual(["on-site-absent"]);
  });
});

describe("fee reminder windows", () => {
  it("includes the Johannesburg due day and two catch-up days", () => {
    const windows = reminderDueWindows(new Date("2026-10-10T10:00:00.000Z"), 7);
    expect(windows).toHaveLength(3);
    expect(windows[0].from.toISOString()).toBe("2026-10-03T00:00:00.000Z");
    expect(windows[2].from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(johannesburgDateKey(new Date("2026-10-10T22:30:00.000Z"))).toBe("2026-10-11");
    expect(johannesburgDayStart(new Date("2026-10-10T22:30:00.000Z")).toISOString()).toBe("2026-10-11T00:00:00.000Z");
  });
});
