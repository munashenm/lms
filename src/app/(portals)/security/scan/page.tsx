import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScanConsole } from "@/components/security/scan-console";

export default async function SecurityScanPage() {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const gates = await prisma.gateCheckpoint.findMany({
    where: { schoolId: session.schoolId, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scan / gate check</h1>
      <ScanConsole gates={gates} />
    </div>
  );
}
