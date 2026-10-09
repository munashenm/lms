import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { CheckpointForm } from "@/components/security/gate-admin";

export default async function GatesPage() {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "gate:manage")) redirect("/admin/dashboard");
  const gates = await prisma.gateCheckpoint.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gates and checkpoints</h1>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {gates.length === 0 ? <li className="p-4 text-sm text-muted">No checkpoints yet.</li> : null}
        {gates.map((gate) => (
          <li key={gate.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{gate.name} · {gate.code}</p>
            <p className="text-muted">{gate.location || "No location"} · {gate.isActive ? "Active" : "Inactive"}{gate.deviceId ? ` · Device ${gate.deviceId}` : ""}</p>
          </li>
        ))}
      </ul>
      <CheckpointForm />
    </div>
  );
}
