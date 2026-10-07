import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { AccessDenied } from "@/components/layout/access-denied";
import { LicensingControlCentre } from "@/components/enterprise/licensing-control-centre";

export default async function AdminLicensingPage() {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Licensing</h1>
        <p className="text-muted text-sm mt-1">
          Cyber Developers control centre: trials, paid conversions, rates, and institution licence
          status. Estimated MRR counts ACTIVE licences only (ACTIVE learners × price per learner).
        </p>
      </div>
      <LicensingControlCentre />
    </div>
  );
}
