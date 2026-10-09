import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { GateSettingsForm } from "@/components/security/gate-admin";
import { DEFAULT_DAY_BOUNDARY, DEFAULT_DEPARTURE, DEFAULT_DUPLICATE_SECONDS, DEFAULT_SCHOOL_START } from "@/lib/gate/engine";

export default async function GateSettingsPage() {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "gate:manage")) redirect("/admin/dashboard");
  const policy = await prisma.gatePolicy.findUnique({ where: { schoolId: session.schoolId } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gate settings</h1>
      <p className="text-sm text-muted">
        These times decide late arrival and early departure. Until you save them, the gate uses the learner&apos;s timetable, then 07:30–14:00.
        Website office hours stay separate.
      </p>
      <GateSettingsForm
        initial={{
          schoolStartTime: policy?.schoolStartTime ?? DEFAULT_SCHOOL_START,
          lateAfterMinutes: policy?.lateAfterMinutes ?? 0,
          normalDepartureTime: policy?.normalDepartureTime ?? DEFAULT_DEPARTURE,
          duplicateScanIntervalSeconds: policy?.duplicateScanIntervalSeconds ?? DEFAULT_DUPLICATE_SECONDS,
          dayBoundaryTime: policy?.dayBoundaryTime ?? DEFAULT_DAY_BOUNDARY,
          requireVisitorIdentity: policy?.requireVisitorIdentity ?? false,
          allowVisitorPhoto: policy?.allowVisitorPhoto ?? true,
        }}
      />
    </div>
  );
}
