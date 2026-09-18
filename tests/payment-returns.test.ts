import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { amountToCents, paymentReturnBasePath, paymentReturnUrls } from "@/lib/payment-gateways/return-url";
import { invoiceIdFromPaystackReference, verifyPaystackSignature } from "@/lib/payment-gateways/paystack";

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

  it("parses Paystack references and verifies webhook HMAC signatures", () => {
    expect(invoiceIdFromPaystackReference("paystack_inv123_l8k2")).toBe("inv123");
    expect(invoiceIdFromPaystackReference("other_inv123_l8k2")).toBeNull();
    const body = '{"event":"charge.success"}';
    const good = crypto.createHmac("sha512", "sk_test").update(body).digest("hex");
    expect(verifyPaystackSignature("sk_test", body, good)).toBe(true);
    expect(verifyPaystackSignature("sk_test", body, "deadbeef")).toBe(false);
    expect(verifyPaystackSignature("sk_test", body, null)).toBe(false);
  });
});
