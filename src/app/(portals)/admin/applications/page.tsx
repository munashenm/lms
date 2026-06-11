import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { ApplicationReview } from "@/components/applications/application-review";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ApplicationsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const applications = await prisma.application.findMany({
    where: filter,
    orderBy: { submittedAt: "desc" },
  });

  const pending = applications.filter(
    (a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admissions</h1>
          <p className="text-muted text-sm mt-1">
            {applications.length} applications · {pending} pending review
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/apply" target="_blank">View Public Form</Link>
        </Button>
      </div>
      <ApplicationReview applications={applications} />
    </div>
  );
}
