import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { SaSamsJobDetail } from "@/components/enterprise/sasams-job-detail";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function SaSamsJobPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.view")) {
    redirect("/admin/dashboard");
  }
  const { id } = await params;
  const { schoolId: requested } = await searchParams;
  const schoolId = await resolveLicenseSchoolId(session, requested);
  if (!schoolId || !canAccessSchool(session, schoolId)) redirect("/admin/dashboard");

  const job = await prisma.importJob.findFirst({
    where: { id, schoolId },
    include: {
      errors: { take: 200, orderBy: { createdAt: "desc" } },
      stagingRecords: { take: 50 },
      batches: true,
    },
  });
  if (!job) notFound();

  return <SaSamsJobDetail job={job} schoolId={schoolId} />;
}
