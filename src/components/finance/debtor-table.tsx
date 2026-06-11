import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatZAR } from "@/lib/utils";

export interface DebtorRow {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentNumber: string;
    grade?: { name: string } | null;
    class?: { name: string } | null;
  };
  outstanding: number;
  invoiceCount: number;
  oldestDue: Date | string | null;
}

interface DebtorTableProps {
  debtors: DebtorRow[];
  totalOutstanding: number;
  studentHref?: (studentId: string) => string;
}

export function DebtorTable({
  debtors,
  totalOutstanding,
  studentHref = (id) => `/admin/finance/invoices?studentId=${id}`,
}: DebtorTableProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {debtors.length} debtor{debtors.length !== 1 ? "s" : ""} · Total outstanding:{" "}
        <span className="font-semibold text-foreground">{formatZAR(totalOutstanding)}</span>
      </p>
      <Card>
        <CardContent className="p-0">
          {debtors.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No outstanding debtors.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left px-4 py-3 font-medium text-muted">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Class</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Outstanding</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Invoices</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden lg:table-cell">Oldest Due</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map((d) => (
                    <tr key={d.student.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={studentHref(d.student.id)}
                          className="font-medium text-primary hover:underline"
                        >
                          {d.student.firstName} {d.student.lastName}
                        </Link>
                        <p className="text-xs text-muted">{d.student.studentNumber}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted">
                        {d.student.grade?.name ?? "—"}
                        {d.student.class?.name && ` · ${d.student.class.name}`}
                      </td>
                      <td className="px-4 py-3 font-semibold text-danger">{formatZAR(d.outstanding)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{d.invoiceCount}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted">
                        {d.oldestDue ? formatDate(d.oldestDue) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
