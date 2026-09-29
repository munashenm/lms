import { ComplianceCentre } from "@/components/compliance/compliance-centre";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CompliancePage() {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.view")) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance Centre</h1>
        <p className="text-muted text-sm mt-1">
          EMIS field checks, SA-SAMS export, LURITS feedback import and CEMIS marks (MVP).{" "}
          <Link href="/admin/integrations/sa-sams" className="text-primary hover:underline">
            SA-SAMS Migration Centre
          </Link>
        </p>
      </div>
      <ComplianceCentre />
    </div>
  );
}