import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listOnSitePeople, occupancyCounts } from "@/lib/gate/queries";
import { zonedParts } from "@/lib/gate/engine";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function OnSitePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const { q } = await searchParams;
  const [counts, live] = await Promise.all([
    occupancyCounts(session.schoolId),
    listOnSitePeople(session.schoolId, q),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Currently on site</h1>
      <p className="text-sm text-muted">Based on the latest valid entry and exit, so it can later support an evacuation roll-call.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Learners on site" value={counts.learners} />
        <Stat label="Staff on site" value={counts.staff} />
        <Stat label="Visitors on site" value={counts.visitors} />
      </div>
      <form>
        <input name="q" defaultValue={q ?? ""} placeholder="Search name or number" className="h-12 w-full rounded-lg border border-border px-3" />
      </form>
      <section className="space-y-2">
        {live.people.map((person) => (
          <article key={`${person.personType}-${person.personId}`} className="rounded-xl border border-border p-3">
            <p className="font-medium">{person.displayName}</p>
            <p className="text-sm text-muted">{person.personType === "STUDENT" ? "Learner" : "Staff"} · {person.detailLine} · {person.number}</p>
            <p className="text-sm">Entered {zonedParts(new Date(person.since)).hhmm}</p>
          </article>
        ))}
        {live.visitors.map((visitor) => (
          <article key={visitor.id} className="rounded-xl border border-border p-3">
            <p className="font-medium">{visitor.firstName} {visitor.lastName}</p>
            <p className="text-sm text-muted">Visitor {visitor.referenceNumber} · visiting {visitor.hostName}</p>
          </article>
        ))}
        {live.people.length + live.visitors.length === 0 ? <p className="text-sm text-muted">Nobody is currently on site.</p> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
