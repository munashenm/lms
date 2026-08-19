import { LicenceIssuer } from "@/components/enterprise/licence-issuer";
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
        <h1 className="text-2xl font-bold">Issue licences</h1>
        <p className="text-muted text-sm mt-1">
          Vendor-only. Signing keys must not exist on customer LMS installations. Issued keys are
          activated by school admins under Settings → Licence.
        </p>
      </div>
      <LicenceIssuer />
    </div>
  );
}
