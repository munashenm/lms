export function paymentBelongsToStudent(opts: {
  payment: { reversedAt: Date | string | null; invoice: { studentId: string; schoolId: string } } | null;
  studentId: string;
  schoolId: string;
}): boolean {
  if (!opts.payment) return false;
  if (opts.payment.reversedAt) return false;
  if (opts.payment.invoice.schoolId !== opts.schoolId) return false;
  return opts.payment.invoice.studentId === opts.studentId;
}
