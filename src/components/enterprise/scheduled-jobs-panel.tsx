import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export function ScheduledJobsPanel({
  jobs,
}: {
  jobs: {
    job: string;
    name: string;
    intendedSchedule: string;
    automatic: boolean;
    holdReason: string | null;
    status: string;
    lastSuccessfulRun: Date | string | null;
    lastFailure: Date | string | null;
    lastError: string | null;
    nextRun: Date | string | null;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scheduled jobs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {jobs.map((job) => (
          <div key={job.job} className="border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{job.name}</span>
              <Badge variant={job.status === "ok" ? "success" : job.status === "failed" ? "danger" : job.status === "held" ? "warning" : "secondary"}>
                {job.status}
              </Badge>
            </div>
            <p className="text-muted text-xs mt-1">{job.intendedSchedule}</p>
            <p>Last success: {job.lastSuccessfulRun ? formatDate(job.lastSuccessfulRun) : "Never"}</p>
            <p>Last failure: {job.lastFailure ? formatDate(job.lastFailure) : "None"}</p>
            <p>Next: {job.nextRun ? formatDate(job.nextRun) : "Not automatic"}</p>
            {job.holdReason ? <p className="text-xs text-muted">{job.holdReason}</p> : null}
            {job.lastError ? <p className="text-xs">{job.lastError}</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
