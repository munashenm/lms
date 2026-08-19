import { InvoiceStatus, PaymentMethod } from "@prisma/client";

export function calculateInvoiceTotals(
  lineItems: { quantity: number; unitPrice: number }[],
  discount = 0
) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, total };
}

export function deriveInvoiceStatus(
  total: number,
  amountPaid: number,
  dueDate: Date | null,
  currentStatus: InvoiceStatus
): InvoiceStatus {
  if (currentStatus === "CANCELLED" || currentStatus === "DRAFT") return currentStatus;
  if (amountPaid >= total) return "PAID";
  if (amountPaid > 0) return "PARTIALLY_PAID";
  if (dueDate && new Date() > dueDate) return "OVERDUE";
  return "SENT";
}

export function getOutstandingBalance(total: number, amountPaid: number): number {
  return Math.max(0, total - amountPaid);
}

/** Original receipts that still count as collections. Reversed rows and audit reversals are excluded. */
export const COLLECTED_PAYMENT_WHERE = {
  reversedAt: null,
  reversalOfId: null,
} as const;

export function isCollectedPayment(payment: {
  reversedAt?: Date | string | null;
  reversalOfId?: string | null;
}): boolean {
  return !payment.reversedAt && !payment.reversalOfId;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  EFT: "EFT / Bank Transfer",
  BANK_DEPOSIT: "Bank deposit",
  CARD: "Card",
  PAYFAST: "PayFast",
  OZOW: "Ozow",
  YOCO: "Yoco",
  MOBILE: "Mobile payment",
  SCHOLARSHIP: "Scholarship / Bursary",
  OTHER: "Other",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export async function generateInvoiceNumber(
  schoolId: string,
  countFn: () => Promise<number>
): Promise<string> {
  const count = await countFn();
  const year = new Date().getFullYear();
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "success" | "warning" | "danger" | "secondary"
> = {
  DRAFT: "secondary",
  SENT: "default",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "secondary",
};
