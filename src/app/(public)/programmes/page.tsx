import Link from "next/link";
import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("Programmes", "Browse accredited courses and NQF programmes.");
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ProgrammesPage() {
  const school = await getFeaturedSchool();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Programmes & Courses</h1>
        <p className="text-muted mt-3 max-w-2xl">
          Explore our accredited programmes. Select a course when you apply online.
        </p>
      </div>

      {school?.grades.length ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Levels offered</h2>
          <div className="flex flex-wrap gap-2">
            {school.grades.map((g) => (
              <Badge key={g.id} variant="secondary">{g.name}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {school?.courses.map((course) => (
          <Card key={course.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{course.name}</CardTitle>
                <Badge>{course.code}</Badge>
              </div>
              {course.description && (
                <p className="text-sm text-muted">{course.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 text-sm text-muted">
                {course.nqfLevel && <span>NQF Level {course.nqfLevel}</span>}
                {course.durationMonths && <span>{course.durationMonths} months</span>}
              </div>
              {course.modules.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Modules</p>
                  <ul className="space-y-1">
                    {course.modules.map((m) => (
                      <li key={m.id} className="text-sm text-muted flex justify-between">
                        <span>{m.name}</span>
                        {m.credits && <span>{m.credits} credits</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button size="sm" asChild>
                <Link href={`/apply?school=${school.slug}&course=${encodeURIComponent(course.name)}`}>
                  Apply for this programme
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!school?.courses.length && (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            Programme information will be published soon.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
