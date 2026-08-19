import { RestoreWizard } from "@/components/enterprise/restore-wizard";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ schoolId?: string; backupId?: string }>;
}

export default async function RestorePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "backup.restore")) {
    redirect("/admin/settings/backup");
  }
  const { schoolId, backupId } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Restore backup</h1>
        <p className="text-muted text-sm mt-1">
          Validate first. A pre-restore recovery backup is created automatically before any overwrite.
        </p>
      </div>
      <RestoreWizard schoolId={schoolId} backupId={backupId} />
    </div>
  );
}
