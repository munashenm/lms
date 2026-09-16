import Link from "next/link";
import { getFeaturedSchool, publicAcademicsHref } from "@/lib/public-site";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export async function AcademicOfferings({
  heading,
  intro,
}: {
  heading?: string;
  intro?: string;
}) {
  const school = await getFeaturedSchool();
  const college = isCollegeLike(school?.institutionType);
  const terms = getTerminology(school?.institutionType);
  const href = publicAcademicsHref(school?.institutionType);
  const grades = school?.grades.filter((grade) => grade.isActive) ?? [];
  const courses = school?.courses.filter((course) => course.isActive) ?? [];
  const subjects = school?.subjects.filter((subject) => subject.isActive) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">{heading ?? (college ? "Programmes" : "Academics")}</h1>
        <p className="text-muted mt-3 max-w-2xl">
          {intro ??
            (college
              ? `Explore ${terms.programmes.toLowerCase()} offered by ${school?.name ?? "this institution"}.`
              : `Grades, ${terms.subjects.toLowerCase()} and academic structure at ${school?.name ?? "this school"}.`)}
        </p>
      </div>

      {grades.length ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">{college ? "Levels offered" : terms.grades}</h2>
          <div className="flex flex-wrap gap-2">
            {grades.map((grade) => (
              <Badge key={grade.id} variant="secondary">
                {grade.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {!college && subjects.length ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">{terms.subjects}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map((subject) => (
              <Card key={subject.id}>
                <CardContent className="p-4">
                  <p className="font-medium">{subject.name}</p>
                  <p className="text-xs text-muted mt-1">{subject.code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {courses.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{course.name}</CardTitle>
                  <Badge>{course.code}</Badge>
                </div>
                {course.description ? <p className="text-sm text-muted">{course.description}</p> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 text-sm text-muted">
                  {course.nqfLevel ? <span>NQF Level {course.nqfLevel}</span> : null}
                  {course.durationMonths ? <span>{course.durationMonths} months</span> : null}
                </div>
                {course.modules.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2">{terms.modules}</p>
                    <ul className="space-y-1">
                      {course.modules.map((module) => (
                        <li key={module.id} className="text-sm text-muted flex justify-between">
                          <span>{module.name}</span>
                          {module.credits ? <span>{module.credits} credits</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {course.openForApplications && school ? (
                  <Button size="sm" asChild>
                    <Link href={`/apply?course=${encodeURIComponent(course.name)}`}>
                      Apply for this {college ? "programme" : "course"}
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!courses.length && !grades.length && !subjects.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            {college ? "Programme" : "Academic"} information will be published soon.
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted">
        Looking for {href === "/programmes" ? "school grades" : "college programmes"}? This page follows the
        institution type configured for {school?.name ?? "this campus"}.
      </p>
    </div>
  );
}
