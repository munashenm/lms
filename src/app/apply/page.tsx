import { ApplyWizard } from "@/components/applications/apply-form";
import { getFeaturedSchool } from "@/lib/public-site";
import { admissionYearLabel, isApplicationsOpen, requiredDocumentTypes } from "@/lib/admissions";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface ApplyPageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const params = await searchParams;
  const school = await getFeaturedSchool();

  if (!school) {
    return (
      <SiteSection>
        <EmptyNote>The institution website is not configured yet.</EmptyNote>
      </SiteSection>
    );
  }

  const window = isApplicationsOpen(school);
  const terms = getTerminology(school.institutionType);
  const college = isCollegeLike(school.institutionType);
  const yearLabel = admissionYearLabel(school.admissionYear);

  return (
    <>
      <PageHero
        eyebrow="Apply"
        title={`Apply for ${yearLabel}.`}
        description={`Apply to ${school.name}. You will receive a reference number such as APP-${yearLabel.replace(/\D/g, "").slice(-4) || yearLabel}-00001 to track your application.`}
        imageUrl={school.heroImageUrl}
      />
      <SiteSection>
        <div className="max-w-3xl mx-auto">
          {!window.open ? (
            <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-10 text-center space-y-4">
              <h2>Applications are closed</h2>
              <p className="text-[var(--site-muted)]">{window.message}</p>
              <div className="flex justify-center gap-3">
                <Link href="/admissions" className="site-btn site-btn-outline">
                  Admissions information
                </Link>
                <Link href="/contact" className="site-btn site-btn-navy">
                  Contact us
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
                grades: school.grades.filter((grade) => grade.openForApplications).map((grade) => ({ id: grade.id, name: grade.name })),
                courses: school.courses.filter((course) => course.openForApplications).map((course) => ({ id: course.id, name: course.name })),
                campuses: school.campuses.map((campus) => ({ id: campus.id, name: campus.name })),
                requiredDocuments: requiredDocumentTypes(school),
                instructions: school.applicationInstructions || school.admissionsText,
              }}
              initialCourse={params.course}
            />
          )}
        </div>
      </SiteSection>
    </>
  );
}
