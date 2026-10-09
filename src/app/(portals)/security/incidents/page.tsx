import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { gateEventsForDay, presentEvent, todayKey } from "@/lib/gate/queries";

export default async function IncidentsPage() {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const date = todayKey();
  const events = await gateEventsForDay(session.schoolId, date, {
    OR: [{ outcome: { in: ["DENIED", "DUPLICATE"] } }, { outcome: "EARLY_DEPARTURE" }],
  });
  const rows = events.map(presentEvent);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Incidents</h1>
      <p className="text-sm text-muted">Denied scans, duplicate scans, and early departures for {date}.</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 ? <li className="p-4 text-sm text-muted">No incidents recorded today.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{row.time} · {row.name || "Unrecognised card"}</p>
            <p className="text-muted">{row.outcome} {row.denialCode ?? row.earlyDepartureReason ?? ""} · {row.direction}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
