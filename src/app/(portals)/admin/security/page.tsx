import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { dashboardSnapshot } from "@/lib/gate/queries";

export default async function AdminSecurityPage() {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "gate:read")) redirect("/admin/dashboard");
  const dash = await dashboardSnapshot(session.schoolId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gate & security</h1>
        <p className="text-sm text-muted">Today&apos;s occupancy for this school. Payroll is not changed by gate scans.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Learners on site" value={dash.counts.learners} />
        <Tile label="Staff on site" value={dash.counts.staff} />
        <Tile label="Visitors on site" value={dash.counts.visitors} />
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="text-primary underline" href="/security">Open security desk</Link>
        <Link className="text-primary underline" href="/admin/security/settings">Settings</Link>
        <Link className="text-primary underline" href="/admin/security/gates">Checkpoints</Link>
        <Link className="text-primary underline" href="/admin/security/cards">Cards</Link>
        <Link className="text-primary underline" href="/admin/security/reports">Reports</Link>
        <Link className="text-primary underline" href="/admin/users">Security user accounts</Link>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted">{label}</p><p className="text-3xl font-bold">{value}</p></div>;
}
