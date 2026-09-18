import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPortalSessionContext } from "@/lib/portal-session";
import { isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { canViewVisitorBook, canWriteVisitorBook, toPublicVisitorEntry } from "@/lib/visitors";
import { VisitorSignInForm } from "@/components/visitors/visitor-sign-in-form";
import { VisitorEntryList } from "@/components/visitors/visitor-entry-list";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface VisitorBookScreenProps {
  searchParams: Promise<{ date?: string; q?: string }>;
}

export async function VisitorBookScreen({ searchParams }: VisitorBookScreenProps) {
  const session = await getSession();
  if (!session || !canViewVisitorBook(session)) {
    redirect(session ? ROLE_DASHBOARD[session.role] : "/login");
  }

  const ctx = await getPortalSessionContext(session);
  if (!isFeatureEnabled(ctx.license, "visitor_management")) {
    return <PortalUnavailable moduleName="Visitor Book" />;
  }

  if (!session.schoolId) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted">
          Select a school context before using the visitor book.
        </CardContent>
      </Card>
    );
  }

  const { date, q } = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const selectedDate = date ?? today;
  const canWrite = canWriteVisitorBook(session);
  const query = q?.trim();

  const dayStart = new Date(`${selectedDate}T00:00:00+02:00`);
  const dayEnd = new Date(`${selectedDate}T23:59:59.999+02:00`);
  const now = new Date();
  const searchWhere = query
    ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query } },
          { badgeNumber: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [campuses, onSite, expected, overdue, dayEntries, todayCount] = await Promise.all([
    prisma.campus.findMany({
      where: { schoolId: session.schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.visitorEntry.findMany({
      where: {
        schoolId: session.schoolId,
        signedOutAt: null,
        status: { in: ["CHECKED_IN", "OVERDUE"] },
        ...searchWhere,
      },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { signedInAt: "desc" },
    }),
    prisma.visitorEntry.findMany({
      where: { schoolId: session.schoolId, status: "EXPECTED", ...searchWhere },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { expectedAt: "asc" },
    }),
    prisma.visitorEntry.findMany({
      where: {
        schoolId: session.schoolId,
        signedOutAt: null,
        expectedDepartureAt: { lt: now },
        status: { in: ["CHECKED_IN", "OVERDUE"] },
        ...searchWhere,
      },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { expectedDepartureAt: "asc" },
    }),
    prisma.visitorEntry.findMany({
      where: {
        schoolId: session.schoolId,
        signedInAt: { gte: dayStart, lte: dayEnd },
        ...searchWhere,
      },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { signedInAt: "desc" },
    }),
    prisma.visitorEntry.count({
      where: {
        schoolId: session.schoolId,
        OR: [
          { signedInAt: { gte: dayStart, lte: dayEnd } },
          { expectedAt: { gte: dayStart, lte: dayEnd } },
        ],
      },
    }),
  ]);

  const checkedOutToday = dayEntries.filter((row) => row.signedOutAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Visitors Book</h1>
          <p className="text-muted text-sm mt-1">
            Sign visitors in and out at reception. Search by name, mobile or badge number.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/visitors?format=csv&date=${selectedDate}`}>Export CSV</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/visitors?format=xlsx&date=${selectedDate}`}>Export Excel</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["On site", onSite.length],
          ["Expected", expected.length],
          ["Checked out today", checkedOutToday],
          ["Overdue", overdue.length],
          ["Today's total", todayCount],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canWrite ? <VisitorSignInForm campuses={campuses} /> : null}

      <form method="GET" className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Search</label>
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Name, mobile or badge"
            className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block min-w-[220px]"
          />
        </div>
        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium"
        >
          Load
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">On site now ({onSite.length})</h2>
        <Card>
          <CardContent className="p-0">
            <VisitorEntryList entries={onSite.map(toPublicVisitorEntry)} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Expected visitors ({expected.length})</h2>
        <Card>
          <CardContent className="p-0">
            <VisitorEntryList entries={expected.map(toPublicVisitorEntry)} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Overdue ({overdue.length})</h2>
        <Card>
          <CardContent className="p-0">
            <VisitorEntryList entries={overdue.map(toPublicVisitorEntry)} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Signed in on {selectedDate}</h2>
        <Card>
          <CardContent className="p-0">
            <VisitorEntryList entries={dayEntries.map(toPublicVisitorEntry)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
