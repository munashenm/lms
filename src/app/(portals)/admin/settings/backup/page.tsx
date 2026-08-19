import { BackupDashboard } from "@/components/enterprise/backup-dashboard";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function BackupPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "backup.view")) {
    redirect("/admin/dashboard");
  }
  const { schoolId } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backup & Restore</h1>
        <p className="text-muted text-sm mt-1">
          Automatic cloud backups and encrypted offline .lmsbackup packages. Credentials stay on the server.
        </p>
      </div>
      <BackupDashboard schoolId={schoolId} />
    </div>
  );
}
