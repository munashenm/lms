import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { InvoiceList } from "@/components/finance/invoice-list";
import { InstalmentSchedule } from "@/components/finance/instalment-schedule";
import { FeeStatementButton } from "@/components/finance/fee-statement-button";
import { PaymentReceiptButton } from "@/components/finance/payment-receipt-button";
import { PayOnlineButton } from "@/components/finance/pay-online-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOutstandingBalance } from "@/lib/finance";
import { getStudentLedger, STUDENT_LEDGER_TYPE_LABELS } from "@/lib/student-ledger";
import { formatZAR, formatDate } from "@/lib/utils";
import { CreditCard, TrendingDown, Wallet } from "lucide-react";
import { InstalmentStatus, StudentLedgerType } from "@prisma/client";

export default async function StudentFeesPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const now = new Date();

  const [invoices, instalments, allInstalments, charges, payments, ledger] = student
    ? await Promise.all([
        prisma.invoice.findMany({
          where: { studentId: student.id, status: { not: "DRAFT" } },
          include: {
            student: { select: { firstName: true, lastName: true, studentNumber: true } },
          },
          orderBy: { issuedAt: "desc" },
        }),
        prisma.chargeInstalment.findMany({
          where: {
            charge: { studentId: student.id, reversedAt: null },
            status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL, InstalmentStatus.PAID] },
          },
          include: { charge: { select: { description: true } } },
          orderBy: { dueDate: "asc" },
          take: 24,
        }),
        prisma.chargeInstalment.findMany({
          where: {
            charge: { studentId: student.id, reversedAt: null },
            status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] },
          },
          include: { charge: { select: { description: true } } },
          orderBy: { dueDate: "asc" },
          take: 1,
        }),
        prisma.studentCharge.findMany({
          where: { studentId: student.id, reversedAt: null },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.payment.findMany({
          where: { invoice: { studentId: student.id }, reversedAt: null },
          orderBy: { paidAt: "desc" },
          take: 20,
        }),
        getStudentLedger({ studentId: student.id, take: 40 }),
      ])
    : [[], [], [], [], [], null];

  const totalOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
  const totalFees = invoices.reduce((s, i) => s + Number(i.total), 0);
  const overdue = invoices
    .filter((i) => i.dueDate && i.dueDate < now && getOutstandingBalance(Number(i.total), Number(i.amountPaid)) > 0)
    .reduce((s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)), 0);
  const payInvoice = invoices.find((i) => getOutstandingBalance(Number(i.total), Number(i.amountPaid)) > 0);
  const nextDue = allInstalments[0];

  const mapped = invoices.map((i) => ({
    ...i,
    total: Number(i.total),
    amountPaid: Number(i.amountPaid),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Fees</h1>
          <p className="text-muted text-sm mt-1">Account balance, instalments, receipts and statements</p>
        </div>
        {student ? <FeeStatementButton /> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Current balance" value={formatZAR(ledger?.balance ?? totalOutstanding)} icon={Wallet} />
        <StatCard title="Total fees" value={formatZAR(totalFees)} icon={CreditCard} />
        <StatCard title="Total paid" value={formatZAR(totalPaid)} icon={CreditCard} />
        <StatCard title="Overdue" value={formatZAR(overdue)} icon={TrendingDown} />
      </div>
      {nextDue ? (
        <p className="text-sm text-muted">
          Next instalment {formatZAR(Number(nextDue.amount) - Number(nextDue.amountPaid))} due {formatDate(nextDue.dueDate)}
        </p>
      ) : null}
      {payInvoice ? (
        <PayOnlineButton
          invoiceId={payInvoice.id}
          outstanding={getOutstandingBalance(Number(payInvoice.total), Number(payInvoice.amountPaid))}
        />
      ) : null}

      {charges.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Fee breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {charges.map((charge) => (
              <div key={charge.id} className="flex justify-between gap-3">
                <span>{charge.description}</span>
                <span>{formatZAR(Number(charge.amount))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <InstalmentSchedule
        title="Payment schedule"
        instalments={instalments.map((row) => ({
          id: row.id,
          sequence: row.sequence,
          dueDate: row.dueDate,
          amount: Number(row.amount),
          amountPaid: Number(row.amountPaid),
          status: row.status,
          description: row.charge.description,
        }))}
      />

      {ledger ? (
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="text-base">Account statement</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[40rem]">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Reference</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{formatDate(entry.entryDate)}</td>
                    <td className="px-4 py-3">
                      {STUDENT_LEDGER_TYPE_LABELS[entry.type as StudentLedgerType] ?? entry.type}: {entry.description}
                    </td>
                    <td className="px-4 py-3 text-muted">{entry.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatZAR(entry.signedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {payments.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Receipts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  {payment.receiptNumber} · {formatZAR(Number(payment.amount))} · {formatDate(payment.paidAt)}
                </p>
                <PaymentReceiptButton paymentId={payment.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <InvoiceList
        invoices={mapped}
        detailHref={(id) => `/student/fees/${id}`}
      />
    </div>
  );
}
