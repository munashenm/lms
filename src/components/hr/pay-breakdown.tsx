import { formatZAR } from "@/lib/utils";

export function PayBreakdown(props: {
  earnings: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
  employer?: Array<{ name: string; amount: number }>;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerContributions?: number;
}) {
  const section = (title: string, rows: Array<{ name: string; amount: number }>) => (
    <div>
      <p className="text-xs font-medium text-muted mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">None</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((row, index) => (
            <li key={`${title}-${row.name}-${index}`} className="flex justify-between gap-4">
              <span>{row.name}</span>
              <span className="font-mono">{formatZAR(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {section("Earnings / allowances", props.earnings)}
      {section("Deductions", props.deductions)}
      {props.employer ? section("Employer contributions", props.employer) : null}
      <div className="border-t border-border pt-3 space-y-1 text-sm">
        <p className="flex justify-between gap-4">
          <span>Gross pay</span>
          <span className="font-mono">{formatZAR(props.grossPay)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span>Total deductions</span>
          <span className="font-mono">{formatZAR(props.totalDeductions)}</span>
        </p>
        <p className="flex justify-between gap-4 font-semibold">
          <span>Net pay</span>
          <span className="font-mono">{formatZAR(props.netPay)}</span>
        </p>
        {props.employerContributions != null ? (
          <p className="flex justify-between gap-4 text-muted">
            <span>Employer cost</span>
            <span className="font-mono">{formatZAR(props.employerContributions)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
