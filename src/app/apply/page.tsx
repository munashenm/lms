import { ApplyWizard } from "@/components/applications/apply-form";
import { getFeaturedSchool } from "@/lib/public-site";
import { admissionYearLabel, isApplicationsOpen, requiredDocumentTypes } from "@/lib/admissions";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface ApplyPageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const params = await searchParams;
  const school = await getFeaturedSchool();

  if (!school) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted">
            The institution website is not configured yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  const window = isApplicationsOpen(school);
  const terms = getTerminology(school.institutionType);
  const college = isCollegeLike(school.institutionType);
  const yearLabel = admissionYearLabel(school.admissionYear);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Apply for {yearLabel}</h1>
        <p className="text-muted text-sm mt-2">
          Apply to {school.name}. You will receive a reference number such as APP-{yearLabel.replace(/\D/g, "").slice(-4) || yearLabel}-00001 to track your application.
        </p>
      </div>
      {!window.open ? (
        <Card>
          <CardContent className="py-10 space-y-4 text-center">
            <p className="font-medium">Applications are closed</p>
            <p className="text-sm text-muted">{window.message}</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" asChild>
                <Link href="/admissions">Admissions information</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/contact">Contact us</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
  );
}
