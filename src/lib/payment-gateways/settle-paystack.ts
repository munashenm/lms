import { PaymentMethod } from "@prisma/client";
import { prisma } from "../db";
import { getResolvedIntegrations, isPaystackReady } from "../school-integrations";
import { recordGatewayPayment } from "./record-payment";
import { invoiceIdFromPaystackReference, verifyPaystackTransaction } from "./paystack";

export async function settlePaystackReference(reference: string) {
  const invoiceId = invoiceIdFromPaystackReference(reference);
  if (!invoiceId) return { ok: false as const, reason: "invoice_not_found" as const };

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { schoolId: true },
  });
  if (!invoice) return { ok: false as const, reason: "invoice_not_found" as const };

  const config = await getResolvedIntegrations(invoice.schoolId);
  if (!isPaystackReady(config) || !config.paystack.secretKey) {
    return { ok: false as const, reason: "not_configured" as const };
  }

  const verified = await verifyPaystackTransaction(config.paystack.secretKey, reference);
  if (!verified || verified.status !== "success") {
    return { ok: false as const, reason: "not_completed" as const };
  }
  if ((verified.currency || "ZAR").toUpperCase() !== "ZAR") {
    return { ok: false as const, reason: "amount_mismatch" as const };
  }

  const amountCents = Number(verified.amount ?? 0);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false as const, reason: "amount_mismatch" as const };
  }

  const metadataInvoiceId = verified.metadata?.invoiceId ?? invoiceId;
  if (metadataInvoiceId !== invoiceId) {
    return { ok: false as const, reason: "invoice_not_found" as const };
  }

  return recordGatewayPayment({
    invoiceId,
    amount: amountCents / 100,
    method: PaymentMethod.PAYSTACK,
    reference: `paystack:${verified.reference ?? reference}`,
    notes: "Paystack payment verified server-side",
  });
}
