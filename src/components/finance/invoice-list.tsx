import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
  getOutstandingBalance,
} from "@/lib/finance";
import { formatDate, formatZAR } from "@/lib/utils";
import type { InvoiceStatus } from "@prisma/client";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  total: number | string;
  amountPaid: number | string;
  dueDate: Date | string | null;
  issuedAt: Date | string;
  student: { firstName: string; lastName: string; studentNumber: string };
}

interface InvoiceListProps {
  invoices: InvoiceRow[];
  detailHref?: (id: string) => string;
}

export function InvoiceList({ invoices, detailHref = (id) => `/admin/finance/invoices/${id}` }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted text-sm">No invoices found.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Student</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Outstanding</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Due</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const outstanding = getOutstandingBalance(Number(inv.total), Number(inv.amountPaid));
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-background/30">
                    <td className="px-4 py-3">
                      <Link href={detailHref(inv.id)} className="font-medium text-primary hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-muted">{formatDate(inv.issuedAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{inv.student.firstName} {inv.student.lastName}</p>
                      <p className="text-xs text-muted">{inv.student.studentNumber}</p>
                    </td>
                    <td className="px-4 py-3">{formatZAR(inv.total)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {outstanding > 0 ? formatZAR(outstanding) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted">
                      {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
