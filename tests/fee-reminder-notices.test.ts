import { afterAll, describe, expect, it } from "vitest";
import {
  FEE_REMINDER_FAILURE_NOTICE_TITLE,
  feeReminderFailureMessage,
  feeReminderNoticeIsRecent,
  notifyFeeReminderFailures,
} from "@/lib/fee-reminder-rules";
import { prisma } from "@/lib/db";

describe("fee reminder failure notices", () => {
  it("uses one stable title and does not include a contact address", () => {
    expect(feeReminderFailureMessage(1)).toContain("1 fee reminder could not be delivered");
    expect(feeReminderFailureMessage(3)).toContain("3 fee reminders could not be delivered");
    expect(feeReminderFailureMessage(3)).not.toMatch(/@/);
    expect(FEE_REMINDER_FAILURE_NOTICE_TITLE).toBe("Fee reminders need attention");
  });

  it("treats a notice inside 20 hours as already delivered", () => {
    const now = new Date("2026-10-10T15:00:00.000Z");
    expect(feeReminderNoticeIsRecent(new Date("2026-10-10T14:00:00.000Z"), now)).toBe(true);
    expect(feeReminderNoticeIsRecent(new Date("2026-10-09T18:00:00.000Z"), now)).toBe(false);
  });
});

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("fee reminder failure notice delivery", () => {
  const schoolIds: string[] = [];

  afterAll(async () => {
    if (schoolIds.length) await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    await prisma.$disconnect();
  });

  it("notifies school admins and finance officers once until the window passes", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const school = await prisma.school.create({
      data: { name: "Reminder notice", slug: `reminder-notice-${stamp}` },
      select: { id: true },
    });
    schoolIds.push(school.id);
    await prisma.user.createMany({
      data: [
        { schoolId: school.id, email: `admin-${stamp}@example.test`, passwordHash: "not-a-login", firstName: "Ada", lastName: "Admin", role: "SCHOOL_ADMIN" },
        { schoolId: school.id, email: `finance-${stamp}@example.test`, passwordHash: "not-a-login", firstName: "Fin", lastName: "Officer", role: "FINANCE_OFFICER" },
        { schoolId: school.id, email: `teacher-${stamp}@example.test`, passwordHash: "not-a-login", firstName: "Tea", lastName: "Cher", role: "TEACHER" },
      ],
    });

    const now = new Date("2026-10-10T12:00:00.000Z");
    expect(await notifyFeeReminderFailures(school.id, 2, now)).toBe(true);
    expect(await notifyFeeReminderFailures(school.id, 4, now)).toBe(false);

    const first = await prisma.notification.findMany({
      where: { schoolId: school.id, title: FEE_REMINDER_FAILURE_NOTICE_TITLE },
    });
    expect(first).toHaveLength(2);
    expect(first.every((row) => row.link === "/finance/reminders")).toBe(true);
    expect(first.some((row) => row.message.includes("@"))).toBe(false);

    await prisma.notification.updateMany({
      where: { schoolId: school.id, title: FEE_REMINDER_FAILURE_NOTICE_TITLE },
      data: { createdAt: new Date("2026-10-09T11:00:00.000Z") },
    });
    expect(await notifyFeeReminderFailures(school.id, 1, now)).toBe(true);
    expect(
      await prisma.notification.count({
        where: { schoolId: school.id, title: FEE_REMINDER_FAILURE_NOTICE_TITLE },
      })
    ).toBe(4);
  });
});
