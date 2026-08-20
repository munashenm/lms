import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { amountToCents, paymentReturnBasePath, paymentReturnUrls } from "@/lib/payment-gateways/return-url";

describe("online payment returns", () => {
  it("sends parents back to the parent invoice and learners to the student invoice", () => {
    expect(paymentReturnBasePath(UserRole.PARENT, "inv_1")).toBe("/parent/fees/inv_1");
    expect(paymentReturnBasePath(UserRole.STUDENT, "inv_1")).toBe("/student/fees/inv_1");
    const parent = paymentReturnUrls(UserRole.PARENT, "inv_9");
    expect(parent.successUrl).toContain("/parent/fees/inv_9?paid=1");
    expect(parent.cancelUrl).toContain("/parent/fees/inv_9?cancelled=1");
  });

  it("converts amounts to cents without floating-point rounding errors", () => {
    expect(amountToCents(10.1)).toBe(1010);
    expect(amountToCents(19.99)).toBe(1999);
  });
});
