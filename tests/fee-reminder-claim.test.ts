import { afterAll, describe, expect, it } from "vitest";
import { claimFeeReminderDispatch } from "@/lib/fee-reminder-rules";
import { prisma } from "@/lib/db";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("fee reminder claims", () => {
  const schoolIds: string[] = [];

  afterAll(async () => {
    if (schoolIds.length) await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    await prisma.$disconnect();
  });

  it("records one claim per rule, invoice and channel", async () => {
    const school = await prisma.school.create({
      data: {
        name: "Reminder claim",
        slug: `reminder-claim-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      select: { id: true },
    });
    schoolIds.push(school.id);
    const student = await prisma.student.create({
      data: { schoolId: school.id, studentNumber: `RM-${Date.now()}`, firstName: "Rem", lastName: "Inder" },
      select: { id: true },
    });
    const invoice = await prisma.invoice.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        invoiceNumber: `INV-RM-${Date.now()}`,
        subtotal: 50,
        total: 50,
        status: "SENT",
      },
      select: { id: true },
    });
    const rule = await prisma.feeReminderRule.create({
      data: { schoolId: school.id, name: "Due", daysOffset: 0, channel: "EMAIL", isEnabled: false },
      select: { id: true },
    });
    const claim = {
      schoolId: school.id,
      ruleId: rule.id,
      invoiceId: invoice.id,
      studentId: student.id,
    };
    const [first, second] = await Promise.all([
      claimFeeReminderDispatch({ ...claim, channel: "EMAIL" }),
      claimFeeReminderDispatch({ ...claim, channel: "EMAIL" }),
    ]);
    expect([first, second].sort()).toEqual([false, true]);
    expect(await claimFeeReminderDispatch({ ...claim, channel: "SMS" })).toBe(true);
    const saved = await prisma.feeReminderRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(saved.isEnabled).toBe(false);
  });
});
