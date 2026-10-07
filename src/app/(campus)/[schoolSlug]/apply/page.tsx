import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyWizard } from "@/components/applications/apply-form";
import { getSchoolBySlug, institutionApplicationsOpen, institutionHomePath } from "@/lib/institution-portal";
import { admissionYearLabel, requiredDocumentTypes } from "@/lib/admissions";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";
import { PublicShell } from "@/components/public/public-shell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ course?: string }>;
}

export default async function InstitutionApplyPage({ params, searchParams }: PageProps) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const window = institutionApplicationsOpen(school);
  const terms = getTerminology(school.institutionType);
  const college = isCollegeLike(school.institutionType);
  const yearLabel = admissionYearLabel(school.admissionYear);

  return (
    <PublicShell
      schoolName={school.name}
      logoUrl={school.logoUrl}
      primaryColor={school.primaryColor}
      accentColor={school.accentColor}
    >
      <PageHero
        eyebrow="Apply"
        title={`Apply for ${yearLabel}.`}
        description={`Apply to ${school.name}. You will receive a reference number to track your application.`}
        imageUrl={school.heroImageUrl}
      />
      <SiteSection>
        <div className="max-w-3xl mx-auto">
          {!window.open ? (
            <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-10 text-center space-y-4">
              <h2>Applications are closed</h2>
              <p className="text-[var(--site-muted)]">{window.message}</p>
              <div className="flex justify-center gap-3">
                <Link href={institutionHomePath(school.slug)} className="site-btn site-btn-outline">
                  Back to {school.name}
                </Link>
              </div>
            </div>
          ) : (
            <ApplyWizard
              school={{
                slug: school.slug,
                name: school.name,
                college,
                popiaConsentText: school.popiaConsentText,
                yearLabel,
                gradeLabel: terms.grade,
                programmeLabel: terms.programme,
                guardianLabel: terms.guardian,
                grades: school.grades.map((grade) => ({ id: grade.id, name: grade.name })),
                courses: school.courses.map((course) => ({ id: course.id, name: course.name })),
                campuses: school.campuses.map((campus) => ({ id: campus.id, name: campus.name })),
                requiredDocuments: requiredDocumentTypes(school),
                instructions: school.applicationInstructions || school.admissionsText,
              }}
              initialCourse={query.course}
            />
          )}
          {!window.open && !school.admissionsText ? (
            <EmptyNote>Online applications are not open for this institution.</EmptyNote>
          ) : null}
        </div>
      </SiteSection>
    </PublicShell>
  );
}
