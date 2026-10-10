import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { dashboardSnapshot } from "@/lib/gate/queries";
import { attendanceOccupancyForSchool } from "@/lib/gate/attendance-match";

export default async function AdminSecurityPage() {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "gate:read")) redirect("/admin/dashboard");
  const [dash, attendance] = await Promise.all([
    dashboardSnapshot(session.schoolId),
    attendanceOccupancyForSchool(session.schoolId),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gate & security</h1>
        <p className="text-sm text-muted">Today&apos;s occupancy compared with the attendance register. Payroll is not changed by gate scans.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Learners on site" value={dash.counts.learners} />
        <Tile label="Staff on site" value={dash.counts.staff} />
        <Tile label="Visitors on site" value={dash.counts.visitors} />
      </div>
      <AttendanceGaps
        presentNotOnSite={attendance.presentNotOnSite}
        absentButOnSite={attendance.absentButOnSite}
      />
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

function AttendanceGaps(props: {
  presentNotOnSite: Array<{ name: string; status: string }>;
  absentButOnSite: Array<{ name: string; status: string }>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <GapList title="Marked present or late, not on site" rows={props.presentNotOnSite} empty="Everyone marked present or late has a gate entry." />
      <GapList title="On site but marked absent" rows={props.absentButOnSite} empty="No learner marked absent is still on site." />
    </div>
  );
}

function GapList(props: { title: string; rows: Array<{ name: string; status: string }>; empty: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-medium">{props.title}</p>
      {props.rows.length === 0 ? <p className="mt-2 text-sm text-muted">{props.empty}</p> : (
        <ul className="mt-2 space-y-1 text-sm">
          {props.rows.slice(0, 12).map((row) => <li key={`${row.name}-${row.status}`}>{row.name} · {row.status.toLowerCase()}</li>)}
        </ul>
      )}
    </div>
  );
}
