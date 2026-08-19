import { InstalmentStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { outstandingOf, roundMoney } from "./money";

export async function allocatePaymentToOldest(params: {
  schoolId: string;
  studentId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
}) {
  let remaining = roundMoney(params.amount);
  const instalments = await prisma.chargeInstalment.findMany({
    where: {
      charge: { studentId: params.studentId, schoolId: params.schoolId, reversedAt: null },
      status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] },
    },
    orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
  });

  const allocations: Prisma.PaymentAllocationCreateManyInput[] = [];
  for (const inst of instalments) {
    if (remaining <= 0) break;
    const due = outstandingOf(Number(inst.amount), Number(inst.amountPaid));
    if (due <= 0) continue;
    const applied = Math.min(due, remaining);
    remaining = roundMoney(remaining - applied);
    const newPaid = roundMoney(Number(inst.amountPaid) + applied);
    const status =
      newPaid + 0.001 >= Number(inst.amount)
        ? InstalmentStatus.PAID
        : InstalmentStatus.PARTIAL;
    await prisma.chargeInstalment.update({
      where: { id: inst.id },
      data: { amountPaid: newPaid, status },
    });
    allocations.push({
      schoolId: params.schoolId,
      paymentId: params.paymentId,
      invoiceId: params.invoiceId,
      instalmentId: inst.id,
      amount: applied,
    });
  }

  if (allocations.length) {
    await prisma.paymentAllocation.createMany({ data: allocations });
  }
  return { unallocated: remaining };
}

export async function allocatePaymentManual(params: {
  schoolId: string;
  paymentId: string;
  invoiceId: string;
  allocations: Array<{ instalmentId: string; amount: number }>;
}) {
  for (const row of params.allocations) {
    const inst = await prisma.chargeInstalment.findUnique({ where: { id: row.instalmentId } });
    if (!inst) continue;
    const applied = roundMoney(row.amount);
    const newPaid = roundMoney(Number(inst.amountPaid) + applied);
    const status =
      newPaid + 0.001 >= Number(inst.amount)
        ? InstalmentStatus.PAID
        : applied > 0
          ? InstalmentStatus.PARTIAL
          : inst.status;
    await prisma.chargeInstalment.update({
      where: { id: inst.id },
      data: { amountPaid: newPaid, status },
    });
    await prisma.paymentAllocation.create({
      data: {
        schoolId: params.schoolId,
        paymentId: params.paymentId,
        invoiceId: params.invoiceId,
        instalmentId: inst.id,
        amount: applied,
      },
    });
  }
}
