import Link from "next/link";
import { getFeaturedSchool, publicAcademicsHref } from "@/lib/public-site";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { CtaBand, EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";

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
  const title = heading ?? (college ? "Programmes" : "Academics");

  return (
    <>
      <PageHero
        eyebrow={title}
        title={college ? "Programmes that lead somewhere." : "A clear academic path."}
        description={
          intro ??
          (college
            ? `Explore ${terms.programmes.toLowerCase()} offered by ${school?.name ?? "this institution"}.`
            : `Grades, ${terms.subjects.toLowerCase()} and academic structure at ${school?.name ?? "this school"}.`)
        }
        imageUrl={school?.heroImageUrl}
      />

      {grades.length ? (
        <SiteSection>
          <h2 className="section-title mb-6">{college ? "Levels offered" : terms.grades}</h2>
          <div className="flex flex-wrap gap-2">
            {grades.map((grade) => (
              <span
                key={grade.id}
                className="rounded-full border border-[var(--site-line)] bg-white px-4 py-2 text-sm font-semibold text-primary"
              >
                {grade.name}
              </span>
            ))}
          </div>
        </SiteSection>
      ) : null}

      {!college && subjects.length ? (
        <SiteSection alt>
          <h2 className="section-title mb-6">{terms.subjects}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map((subject) => (
              <div key={subject.id} className="bg-white border border-[var(--site-line)] rounded-[14px] p-5">
                <p className="font-semibold text-primary">{subject.name}</p>
                <p className="text-xs text-[var(--site-muted)] mt-1">{subject.code}</p>
              </div>
            ))}
          </div>
        </SiteSection>
      ) : null}

      {courses.length ? (
        <SiteSection alt={Boolean(grades.length) && (college || !subjects.length)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {courses.map((course) => (
              <article key={course.id} className="bg-white border border-[var(--site-line)] rounded-[14px] p-7 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl">{course.name}</h3>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)]">{course.code}</span>
                </div>
                {course.description ? <p className="text-[var(--site-muted)] mt-3">{course.description}</p> : null}
                <div className="flex gap-4 text-sm text-[var(--site-muted)] mt-4">
                  {course.nqfLevel ? <span>NQF Level {course.nqfLevel}</span> : null}
                  {course.durationMonths ? <span>{course.durationMonths} months</span> : null}
                </div>
                {course.modules.length > 0 ? (
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-primary mb-2">{terms.modules}</p>
                    <ul className="space-y-1">
                      {course.modules.map((module) => (
                        <li key={module.id} className="text-sm text-[var(--site-muted)] flex justify-between gap-3">
                          <span>{module.name}</span>
                          {module.credits ? <span>{module.credits} credits</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {course.openForApplications && school ? (
                  <Link href={`/apply?course=${encodeURIComponent(course.name)}`} className="site-btn site-btn-gold site-btn-arrow mt-6 self-start">
                    Apply for this {college ? "programme" : "course"}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </SiteSection>
      ) : null}

      {!courses.length && !grades.length && !subjects.length ? (
        <SiteSection>
          <EmptyNote>{college ? "Programme" : "Academic"} information will be published soon.</EmptyNote>
        </SiteSection>
      ) : null}

      <p className="mx-auto max-w-[1180px] px-7 pb-8 text-xs text-[var(--site-muted)]">
        Looking for {href === "/programmes" ? "school grades" : "college programmes"}? This page follows the
        institution type configured for {school?.name ?? "this campus"}.
      </p>

      <CtaBand
        title="Ready to join?"
        primaryHref="/apply"
        primaryLabel="Apply online"
        secondaryHref="/admissions"
        secondaryLabel="Admissions"
      />
    </>
  );
}
