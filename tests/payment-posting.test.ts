import fs from "fs";
import { afterAll, describe, expect, it } from "vitest";
import { PAYMENT_REVIEW_ACTIONS, paymentPostingDecision } from "@/lib/finance";
import { postApprovedPayment } from "@/lib/manual-payment";
import { prisma } from "@/lib/db";

describe("payment posting decisions", () => {
  it("posts a pending payment once and blocks reversals", () => {
    expect(paymentPostingDecision({ captureStatus: "PENDING", postedAt: null })).toBe("post");
    expect(paymentPostingDecision({ captureStatus: "VERIFIED", postedAt: null })).toBe("post");
    expect(paymentPostingDecision({ captureStatus: "APPROVED", postedAt: new Date() })).toBe("already_posted");
    expect(paymentPostingDecision({ captureStatus: "REJECTED", postedAt: null })).toBe("blocked");
    expect(paymentPostingDecision({ captureStatus: "REVERSED", postedAt: null })).toBe("blocked");
    expect(paymentPostingDecision({ captureStatus: "APPROVED", postedAt: null, reversalOfId: "pay_1" })).toBe("blocked");
    expect(paymentPostingDecision({ captureStatus: "APPROVED", postedAt: null, reversedAt: new Date() })).toBe("blocked");
  });

  it("does not expose a payment reversal action", () => {
    expect(PAYMENT_REVIEW_ACTIONS).toEqual(["verify", "approve", "reject"]);
    expect(fs.existsSync("src/app/api/payments/[id]/reverse/route.ts")).toBe(false);
  });
});

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("concurrent payment approval", () => {
  const schoolIds: string[] = [];

  afterAll(async () => {
    if (schoolIds.length) {
      await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    }
    await prisma.$disconnect();
  });

  it("posts one payment twice without changing the invoice twice", async () => {
    const school = await prisma.school.create({
      data: {
        name: "Approval lock",
        slug: `approval-lock-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      select: { id: true },
    });
    schoolIds.push(school.id);
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `approval-lock-${Date.now()}@example.test`,
        firstName: "Approval",
        lastName: "Lock",
        passwordHash: "not-a-login",
        role: "FINANCE_OFFICER",
      },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        studentNumber: `AL-${Date.now()}`,
        firstName: "Approval",
        lastName: "Lock",
      },
      select: { id: true },
    });
    const invoice = await prisma.invoice.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        invoiceNumber: `INV-AL-${Date.now()}`,
        subtotal: 100,
        total: 100,
        amountPaid: 0,
        status: "SENT",
      },
      select: { id: true },
    });
    const payment = await prisma.payment.create({
      data: {
        schoolId: school.id,
        invoiceId: invoice.id,
        amount: 40,
        method: "EFT",
        receiptNumber: `RCP-LOCK-${Date.now()}`,
        captureStatus: "PENDING",
      },
      select: { id: true },
    });

    const [first, second] = await Promise.all([
      postApprovedPayment({ paymentId: payment.id, userId: user.id }),
      postApprovedPayment({ paymentId: payment.id, userId: user.id }),
    ]);
    expect(first.id).toBe(payment.id);
    expect(second.id).toBe(payment.id);

    const savedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    const savedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const ledgerCount = await prisma.studentLedgerEntry.count({
      where: { paymentId: payment.id, type: "PAYMENT" },
    });
    expect(Number(savedInvoice.amountPaid)).toBe(40);
    expect(savedInvoice.status).toBe("PARTIALLY_PAID");
    expect(savedPayment.captureStatus).toBe("APPROVED");
    expect(savedPayment.postedAt).toBeTruthy();
    expect(ledgerCount).toBe(1);

    await expect(
      postApprovedPayment({
        paymentId: payment.id,
        userId: user.id,
      })
    ).resolves.toMatchObject({ id: payment.id });
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(Number(after.amountPaid)).toBe(40);
  });
});
