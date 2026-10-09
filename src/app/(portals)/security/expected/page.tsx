import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPublicVisitorEntry } from "@/lib/visitors";
import { VisitorEntryList } from "@/components/visitors/visitor-entry-list";

export default async function ExpectedVisitorsPage() {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const rows = await prisma.visitorEntry.findMany({
    where: { schoolId: session.schoolId, status: "EXPECTED" },
    include: {
      campus: { select: { name: true } },
      signedInBy: { select: { firstName: true, lastName: true } },
      signedOutBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { expectedAt: "asc" },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Expected visitors</h1>
      <div className="rounded-xl border border-border">
        <VisitorEntryList entries={rows.map(toPublicVisitorEntry)} />
      </div>
    </div>
  );
}
