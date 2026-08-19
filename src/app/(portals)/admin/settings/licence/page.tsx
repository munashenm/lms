import { LicenceManager } from "@/components/enterprise/licence-manager";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function LicencePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "license.view")) {
    redirect("/admin/dashboard");
  }
  const { schoolId } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Licence</h1>
        <p className="text-muted text-sm mt-1">
          View and activate the institution licence. Enforcement is applied on the server, not only in this page.
        </p>
      </div>
      <LicenceManager schoolId={schoolId} />
    </div>
  );
}
