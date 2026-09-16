import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { WebsiteAdmissionsForm } from "@/components/website/website-admissions-form";
import { getTerminology } from "@/lib/terminology";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function WebsiteAdmissionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : null;
  if (!schoolId) notFound();

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      academicYears: { orderBy: { startDate: "desc" } },
      grades: { orderBy: { sortOrder: "asc" } },
      courses: { orderBy: { name: "asc" } },
    },
  });
  if (!school) notFound();
  const terms = getTerminology(school.institutionType);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/website" className="text-sm text-muted hover:text-primary">
          ← Website Management
        </Link>
        <h1 className="text-2xl font-bold mt-2">Admissions</h1>
        <p className="text-muted text-sm mt-1">Control the public application window for {school.name}.</p>
      </div>
      <WebsiteAdmissionsForm
        schoolId={session!.role === UserRole.SUPER_ADMIN && !session!.schoolId ? school.id : undefined}
        applicationsOpen={school.applicationsOpen}
        applicationsOpenFrom={school.applicationsOpenFrom}
        applicationsOpenUntil={school.applicationsOpenUntil}
        admissionYearId={school.admissionYearId}
        applicationInstructions={school.applicationInstructions}
        requiredApplicationDocuments={school.requiredApplicationDocuments}
        years={school.academicYears}
        grades={school.grades}
        courses={school.courses}
        gradeLabel={terms.grade}
        programmeLabel={terms.programme}
      />
    </div>
  );
}
