import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { GATE_REPORT_LABELS, GATE_REPORT_TYPES, getGateReport, isGateReportType } from "@/lib/gate/reports";
import { todayKey } from "@/lib/gate/queries";

interface PageProps {
  searchParams: Promise<{ type?: string; date?: string }>;
}

export default async function GateReportsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "gate:reports")) redirect("/admin/dashboard");
  const params = await searchParams;
  const type = isGateReportType(params.type) ? params.type : "register";
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();
  const report = await getGateReport(session.schoolId, type, date);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gate reports</h1>
      <div className="flex flex-wrap gap-2">
        {GATE_REPORT_TYPES.map((item) => (
          <Link key={item} href={`/admin/security/reports?type=${item}&date=${date}`} className={`rounded-lg px-3 py-1.5 text-sm ${item === type ? "bg-primary text-white" : "border border-border"}`}>
            {GATE_REPORT_LABELS[item]}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="type" value={type} />
        <input type="date" name="date" defaultValue={date} className="h-10 rounded-lg border border-border px-3" />
        <button className="h-10 rounded-lg border border-border px-3 text-sm" type="submit">Show</button>
        <a className="text-sm text-primary" href={`/api/gate/reports?type=${type}&date=${date}&format=csv`}>Download CSV</a>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-background text-left">
            <tr>{report.columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? <tr><td className="px-3 py-4 text-muted" colSpan={report.columns.length}>No rows for this report.</td></tr> : null}
            {report.rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
