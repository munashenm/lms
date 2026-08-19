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

interface VisitorBookScreenProps {
  searchParams: Promise<{ date?: string }>;
}

export async function VisitorBookScreen({ searchParams }: VisitorBookScreenProps) {
  const session = await getSession();
  if (!session || !canViewVisitorBook(session.role)) {
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

  const { date } = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const selectedDate = date ?? today;
  const canWrite = canWriteVisitorBook(session.role);

  const dayStart = new Date(`${selectedDate}T00:00:00+02:00`);
  const dayEnd = new Date(`${selectedDate}T23:59:59.999+02:00`);

  const [campuses, onSite, dayEntries] = await Promise.all([
    prisma.campus.findMany({
      where: { schoolId: session.schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.visitorEntry.findMany({
      where: { schoolId: session.schoolId, signedOutAt: null },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { signedInAt: "desc" },
    }),
    prisma.visitorEntry.findMany({
      where: {
        schoolId: session.schoolId,
        signedInAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { signedInAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visitor Book</h1>
        <p className="text-muted text-sm mt-1">
          Sign visitors in and out at reception. This is the school register, not a learner portal.
        </p>
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
