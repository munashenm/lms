import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { dashboardSnapshot } from "@/lib/gate/queries";

export default async function SecurityHomePage() {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const dash = await dashboardSnapshot(session.schoolId);

  const tiles = [
    { label: "Learners on site", value: dash.counts.learners },
    { label: "Staff on site", value: dash.counts.staff },
    { label: "Visitors on site", value: dash.counts.visitors },
    { label: "Late arrivals today", value: dash.lateArrivals },
    { label: "Early departures today", value: dash.earlyDepartures },
    { label: "Visitors awaiting checkout", value: dash.visitorsAwaitingCheckout },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Gate desk</h1>
          <p className="text-muted">{dash.dateKey}</p>
        </div>
        <p className="text-4xl font-bold tabular-nums">{dash.time}</p>
      </div>
      <p className="text-sm">
        Gate status: {dash.gates.length ? dash.gates.map((gate) => gate.name).join(", ") : "No checkpoint configured — scans still record"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">{tile.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/security/scan" className="flex h-20 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white">Scan card</Link>
        <Link href="/security/visitors" className="flex h-20 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white">Register visitor</Link>
        <Link href="/security/on-site" className="flex h-20 items-center justify-center rounded-xl border border-border bg-surface text-lg font-semibold">Currently on site</Link>
        <Link href="/security/scan" className="flex h-20 items-center justify-center rounded-xl border border-border bg-surface text-lg font-semibold">Manual entry</Link>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Recent gate activity</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {dash.recent.length === 0 ? <li className="p-4 text-sm text-muted">No scans yet today.</li> : null}
          {dash.recent.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium">{row.time} · {row.name}</span>
              <span className="text-muted">{row.direction} · {row.outcome}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
