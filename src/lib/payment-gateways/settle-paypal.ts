import { PaymentMethod } from "@prisma/client";
import { getPayPalOrder, capturePayPalOrder, isPayPalConfigured } from "./paypal";
import { recordGatewayPayment } from "./record-payment";
import { getResolvedIntegrations } from "../school-integrations";
import { prisma } from "../db";
import { PaymentCaptureStatus, GatewayPaymentStatus } from "@prisma/client";
import { postApprovedPayment } from "../manual-payment";

export async function settlePayPalOrder(schoolId: string, orderId: string) {
  const config = await getResolvedIntegrations(schoolId);
  if (!isPayPalConfigured(config)) return { ok: false as const, reason: "not_configured" as const };
  let order = await getPayPalOrder(config, orderId);
  if (!order) return { ok: false as const, reason: "order_not_found" as const };

  if (order.status === "APPROVED") {
    await capturePayPalOrder(config, orderId);
    order = (await getPayPalOrder(config, orderId)) ?? order;
  }
  if (order.status !== "COMPLETED") {
    await prisma.payment.updateMany({
      where: { gatewayTxnId: orderId },
      data: { gatewayStatus: GatewayPaymentStatus.PENDING },
    });
    return { ok: false as const, reason: "not_completed" as const };
  }

  const existing = await prisma.payment.findFirst({
    where: { gatewayTxnId: orderId },
    include: { invoice: true },
  });
  if (existing?.postedAt) return { ok: true as const, duplicate: true as const };

  const invoiceId = existing?.invoiceId ?? order.purchase_units?.[0]?.custom_id;
  if (!invoiceId) return { ok: false as const, reason: "invoice_not_found" as const };

  if (existing && !existing.postedAt) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: {
        gatewayStatus: GatewayPaymentStatus.COMPLETED,
        captureStatus: PaymentCaptureStatus.VERIFIED,
      },
    });
    await postApprovedPayment({
      paymentId: existing.id,
      userId: existing.recordedById ?? existing.invoice.studentId,
    });
    return { ok: true as const };
  }

  const amount = Number(order.purchase_units?.[0]?.amount?.value ?? existing?.amount ?? 0);
  return recordGatewayPayment({
    invoiceId,
    amount,
    method: PaymentMethod.PAYPAL,
    reference: `paypal:${orderId}`,
    notes: "PayPal payment verified server-side",
  });
}
