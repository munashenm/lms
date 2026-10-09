import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { gateEventsForDay, presentEvent, todayKey } from "@/lib/gate/queries";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function GateActivityPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const { date } = await searchParams;
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey();
  const rows = (await gateEventsForDay(session.schoolId, selected)).map(presentEvent);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gate activity</h1>
      <form>
        <input type="date" name="date" defaultValue={selected} className="h-11 rounded-lg border border-border px-3" />
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 ? <li className="p-4 text-sm text-muted">No gate events on this date.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{row.time} · {row.name}</p>
            <p className="text-muted">{row.personType} · {row.direction} · {row.method} · {row.outcome}{row.manualReason ? ` · ${row.manualReason}` : ""}</p>
            <p className="text-muted">Recorded by {row.recordedBy}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
