import { describe, expect, it } from "vitest";
import { getTodayDayOfWeek, orderDaysWithTodayFirst } from "@/lib/timetable-conflicts";

describe("getTodayDayOfWeek", () => {
  it("returns null on Sunday because DayOfWeek has no SUNDAY value", () => {
    // 2026-09-13 is a Sunday (the day student login was failing)
    expect(getTodayDayOfWeek(new Date("2026-09-13T12:00:00"))).toBeNull();
  });

  it("maps weekdays onto the Prisma DayOfWeek enum", () => {
    expect(getTodayDayOfWeek(new Date("2026-09-14T12:00:00"))).toBe("MONDAY");
    expect(getTodayDayOfWeek(new Date("2026-09-15T12:00:00"))).toBe("TUESDAY");
    expect(getTodayDayOfWeek(new Date("2026-09-18T12:00:00"))).toBe("FRIDAY");
    expect(getTodayDayOfWeek(new Date("2026-09-19T12:00:00"))).toBe("SATURDAY");
  });
});

describe("orderDaysWithTodayFirst", () => {
  it("starts at Monday when today is Sunday", () => {
    expect(orderDaysWithTodayFirst(null)).toEqual([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ]);
  });

  it("puts today first and wraps the rest of the week", () => {
    expect(orderDaysWithTodayFirst("WEDNESDAY")).toEqual([
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "MONDAY",
      "TUESDAY",
    ]);
  });
});
