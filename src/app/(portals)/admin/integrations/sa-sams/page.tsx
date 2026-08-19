import { SaSamsWizard } from "@/components/enterprise/sasams-wizard";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function SaSamsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.view")) {
    redirect("/admin/dashboard");
  }
  const { schoolId } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SA-SAMS Migration Centre</h1>
        <p className="text-muted text-sm mt-1">
          Import authorised SA-SAMS exports into staging tables, map fields, detect duplicates, then import with full audit provenance.
          Native database files are a placeholder until an authorised sample is received.
        </p>
      </div>
      <SaSamsWizard schoolId={schoolId} />
    </div>
  );
}
