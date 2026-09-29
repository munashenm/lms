import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { ApplicationReview } from "@/components/applications/application-review";
import { AdmissionsPipelineBoard } from "@/components/applications/admissions-pipeline-board";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ApplicationsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const applications = await prisma.application.findMany({
    where: filter,
    include: {
      student: { select: { id: true, studentNumber: true, userId: true } },
      documents: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  const pending = applications.filter((a) =>
    [
      "SUBMITTED",
      "UNDER_REVIEW",
      "DOCUMENTS_OUTSTANDING",
      "INTERVIEW_REQUIRED",
      "ASSESSMENT_REQUIRED",
      "WAITLISTED",
      "PROVISIONALLY_ACCEPTED",
      "OFFER_ISSUED",
    ].includes(a.status)
  ).length;

  const pipelineApps = applications.map((a) => ({
    id: a.id,
    referenceNo: a.referenceNo,
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    gradeApplied: a.gradeApplied,
    courseApplied: a.courseApplied,
    status: a.status,
    submittedAt: a.submittedAt,
    depositAmount: a.depositAmount != null ? Number(a.depositAmount) : null,
    depositPaidAt: a.depositPaidAt,
    offerSentAt: a.offerSentAt,
    offerExpiresAt: a.offerExpiresAt,
    studentId: a.studentId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Online applications</h1>
          <p className="text-muted text-sm mt-1">
            {applications.length} applications · {pending} in pipeline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/apply" target="_blank">Public Form</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/apply/status" target="_blank">Status Tracker</Link>
          </Button>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">Admissions pipeline</h2>
        <AdmissionsPipelineBoard applications={pipelineApps} />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">All applications</h2>
        <ApplicationReview applications={applications} />
      </div>
    </div>
  );
}
