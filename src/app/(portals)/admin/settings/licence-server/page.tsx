import { LicenceDesk } from "@/components/enterprise/licence-desk";
import { getSession } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function LicenceServerPage() {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    redirect("/admin/dashboard");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers & licences</h1>
        <p className="text-muted text-sm mt-1">
          Vendor desk: add the customer, issue a signed key, then renew, suspend or revoke.
          Last heartbeat shows when the school last checked in. Signing keys must not exist on
          customer LMS installations.
        </p>
      </div>
      <LicenceDesk />
    </div>
  );
}
