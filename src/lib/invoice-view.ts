import type { Prisma } from "@prisma/client";

export const invoiceDetailInclude = {
  student: {
    include: {
      grade: { select: { name: true } },
      class: { select: { name: true } },
    },
  },
  lineItems: true,
  payments: { orderBy: { paidAt: "desc" as const } },
  charges: {
    where: { reversedAt: null },
    include: { instalments: { orderBy: { sequence: "asc" as const } } },
  },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetailRecord = Prisma.InvoiceGetPayload<{ include: typeof invoiceDetailInclude }>;

export function mapInvoiceForDetail(invoice: InvoiceDetailRecord) {
  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    lineItems: invoice.lineItems.map((li) => ({
      ...li,
      unitPrice: Number(li.unitPrice),
      amount: Number(li.amount),
    })),
    payments: invoice.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
    instalments: invoice.charges.flatMap((charge) =>
      charge.instalments.map((row) => ({
        id: row.id,
        sequence: row.sequence,
        dueDate: row.dueDate,
        amount: Number(row.amount),
        amountPaid: Number(row.amountPaid),
        status: row.status,
        description: charge.description,
      }))
    ),
  };
}
