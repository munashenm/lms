import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type Health = {
  licence: {
    status: string;
    restricted: boolean;
    expiry: string | null;
    usage: { learners: { used: number; max: number | null }; educators: { used: number; max: number | null } };
    warnings: string[];
  };
  backups: { lastSuccessful: string | null; next: string | null; health: string };
  integrations: { provider: string; lastImport: string | null; status: string; recordsImported: number };
};

export function SystemHealthCards({ health, schoolId }: { health: Health; schoolId?: string }) {
  const qs = schoolId ? `?schoolId=${schoolId}` : "";
  const licenceVariant =
    health.licence.status === "ACTIVE" || health.licence.status === "TRIAL"
      ? "success"
      : health.licence.status === "GRACE"
        ? "warning"
        : "danger";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant={licenceVariant}>{health.licence.status}</Badge>
          </div>
          <p>Expiry: {health.licence.expiry ? formatDate(health.licence.expiry) : "—"}</p>
          <p>
            Usage: {health.licence.usage.learners.used}/{health.licence.usage.learners.max ?? "∞"} learners ·{" "}
            {health.licence.usage.educators.used}/{health.licence.usage.educators.max ?? "∞"} educators
          </p>
          <Link href={`/admin/settings/licence${qs}`} className="text-primary text-xs">
            Open licence
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Health</span>
            <Badge variant={health.backups.health === "healthy" ? "success" : "warning"}>
              {health.backups.health}
            </Badge>
          </div>
          <p>Last successful: {health.backups.lastSuccessful ? formatDate(health.backups.lastSuccessful) : "Never"}</p>
          <p>Next backup: {health.backups.next ? formatDate(health.backups.next) : "—"}</p>
          <Link href={`/admin/settings/backup${qs}`} className="text-primary text-xs">
            Open backups
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>SA-SAMS: {health.integrations.status}</p>
          <p>Last import: {health.integrations.lastImport ? formatDate(health.integrations.lastImport) : "Never"}</p>
          <p>Records imported: {health.integrations.recordsImported}</p>
          <Link href={`/admin/integrations/sa-sams${qs}`} className="text-primary text-xs">
            Open SA-SAMS
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
