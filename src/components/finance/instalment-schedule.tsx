import { formatZAR, formatDate } from "@/lib/utils";
import { outstandingOf } from "@/lib/money";

export interface InstalmentView {
  id: string;
  sequence: number;
  dueDate: Date | string;
  amount: number | string;
  amountPaid: number | string;
  status: string;
  description?: string;
}

export function InstalmentSchedule({
  instalments,
  title = "Payment plan",
}: {
  instalments: InstalmentView[];
  title?: string;
}) {
  if (instalments.length === 0) return null;
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <p className="px-4 py-2 text-sm font-medium bg-background/50">{title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left px-4 py-2 font-medium">#</th>
            <th className="text-left px-4 py-2 font-medium">Due</th>
            {instalments.some((row) => row.description) ? (
              <th className="text-left px-4 py-2 font-medium">Charge</th>
            ) : null}
            <th className="text-right px-4 py-2 font-medium">Amount</th>
            <th className="text-right px-4 py-2 font-medium">Outstanding</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {instalments.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2">{row.sequence}</td>
              <td className="px-4 py-2">{formatDate(row.dueDate)}</td>
              {instalments.some((item) => item.description) ? (
                <td className="px-4 py-2">{row.description ?? "—"}</td>
              ) : null}
              <td className="px-4 py-2 text-right">{formatZAR(Number(row.amount))}</td>
              <td className="px-4 py-2 text-right">
                {formatZAR(outstandingOf(row.amount, row.amountPaid))}
              </td>
              <td className="px-4 py-2">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
