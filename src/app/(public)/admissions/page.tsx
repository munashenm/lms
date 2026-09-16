import Link from "next/link";
import { admissionSummary, getFeaturedSchool } from "@/lib/public-site";
import { applyCtaLabel, documentLabel, requiredDocumentTypes } from "@/lib/admissions";
import { publicPageMetadata } from "@/lib/site-metadata";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata = publicPageMetadata("Admissions", "Application dates, intake information and how to apply.");
export const dynamic = "force-dynamic";

export default async function AdmissionsPage() {
  const school = await getFeaturedSchool();
  const terms = getTerminology(school?.institutionType);
  const college = isCollegeLike(school?.institutionType);
  const admission = school ? admissionSummary(school) : null;
  const applyLabel = applyCtaLabel(admission?.yearLabel ?? String(new Date().getFullYear()));
  const docs = school ? requiredDocumentTypes(school) : [];
  const grades = school?.grades.filter((grade) => grade.openForApplications) ?? [];
  const courses = school?.courses.filter((course) => course.openForApplications) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admissions</h1>
        <p className="text-muted mt-3 max-w-2xl">
          {admission?.instructions ||
            `Apply online for the ${admission?.yearLabel ?? ""} intake at ${school?.name ?? "this institution"}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Intake</p>
            <p className="font-semibold mt-1">{admission?.yearLabel ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Status</p>
            <p className="font-semibold mt-1">{admission?.open ? "Applications open" : "Applications closed"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Closing date</p>
            <p className="font-semibold mt-1">
              {school?.applicationsOpenUntil ? formatDate(school.applicationsOpenUntil) : "See admissions office"}
            </p>
          </CardContent>
        </Card>
      </div>

      {admission && !admission.open ? (
        <Card>
          <CardContent className="p-6 text-sm">{admission.message}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">{college ? terms.programmes : terms.grades} available</h2>
            {college ? (
              <ul className="text-sm space-y-1">
                {courses.map((course) => (
                  <li key={course.id}>{course.name}</li>
                ))}
              </ul>
            ) : (
              <ul className="text-sm space-y-1">
                {grades.map((grade) => (
                  <li key={grade.id}>{grade.name}</li>
                ))}
              </ul>
            )}
            {!courses.length && !grades.length ? (
              <p className="text-sm text-muted">The admissions office will confirm available places.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Required documents</h2>
            <ul className="text-sm space-y-1 list-disc list-inside">
              {docs.map((doc) => (
                <li key={doc}>{documentLabel(doc)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/apply">{applyLabel}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/apply/status">Track application</Link>
        </Button>
      </div>
    </div>
  );
}
