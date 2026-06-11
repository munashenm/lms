import { prisma } from "@/lib/db";
import { ApplyForm } from "@/components/applications/apply-form";

export const dynamic = "force-dynamic";

interface ApplyPageProps {
  searchParams: Promise<{ school?: string; course?: string }>;
}

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const params = await searchParams;
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    select: { slug: true, name: true, institutionType: true, city: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 lg:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Apply for Admission</h1>
        <p className="text-muted text-sm mt-2">
          Submit your application to a South African school or college. You will receive a
          reference number to track your application status.
        </p>
      </div>
      <ApplyForm
        schools={schools}
        initialSchoolSlug={params.school}
        initialCourse={params.course}
      />
    </div>
  );
}
