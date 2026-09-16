import { admissionSummary, getFeaturedSchool } from "@/lib/public-site";
import { documentLabel, requiredDocumentTypes } from "@/lib/admissions";
import { publicPageMetadata } from "@/lib/site-metadata";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { CtaBand, EmptyNote, PageHero, SectionHead, SiteSection } from "@/components/public/site-ui";
import { formatDate } from "@/lib/utils";

export const metadata = publicPageMetadata("Admissions", "Application dates, intake information and how to apply.");
export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Enquire & visit", body: "Get in touch and book a walkabout to experience the campus." },
  { title: "Apply online", body: "Complete the online application and submit the required documents." },
  { title: "Review", body: "The admissions team reviews your application and may arrange a meeting." },
  { title: "Offer & enrolment", body: "Accept your place and complete enrolment with the campus office." },
];

export default async function AdmissionsPage() {
  const school = await getFeaturedSchool();
  const terms = getTerminology(school?.institutionType);
  const college = isCollegeLike(school?.institutionType);
  const admission = school ? admissionSummary(school) : null;
  const docs = school ? requiredDocumentTypes(school) : [];
  const grades = school?.grades.filter((grade) => grade.openForApplications) ?? [];
  const courses = school?.courses.filter((course) => course.openForApplications) ?? [];

  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title="Your journey starts here."
        description={
          admission?.instructions ||
          `Everything you need to apply to ${school?.name ?? "this institution"}: the steps, the dates and the documents.`
        }
        imageUrl={school?.heroImageUrl}
      />

      <SiteSection>
        <SectionHead
          eyebrow="How to apply"
          title="Four simple steps"
          description={`${school?.name ?? "This institution"} ${admission?.open ? `is accepting applications for ${admission.yearLabel}` : "processes applications when the intake window is open"}.`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, index) => (
            <div key={step.title} className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
              <span className="grid place-items-center w-11 h-11 rounded-full border-2 border-[var(--accent-dark)] text-[var(--accent-dark)] font-[family-name:var(--site-serif)] font-semibold mb-4">
                {index + 1}
              </span>
              <h3 className="text-[1.05rem] mb-1">{step.title}</h3>
              <p className="text-[0.9rem] text-[var(--site-muted)]">{step.body}</p>
            </div>
          ))}
        </div>
      </SiteSection>

      <SiteSection alt>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Intake", value: admission?.yearLabel ?? "—" },
            { label: "Status", value: admission?.open ? "Applications open" : "Applications closed" },
            {
              label: "Closing date",
              value: school?.applicationsOpenUntil ? formatDate(school.applicationsOpenUntil) : "See admissions office",
            },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-[var(--site-line)] rounded-[14px] p-6">
              <p className="site-eyebrow">{item.label}</p>
              <p className="mt-2 text-xl text-primary">{item.value}</p>
            </div>
          ))}
        </div>
        {admission && !admission.open ? (
          <EmptyNote>{admission.message}</EmptyNote>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">{college ? terms.programmes : terms.grades} available</h3>
            {college ? (
              <ul className="space-y-2 text-[var(--site-muted)]">
                {courses.map((course) => (
                  <li key={course.id}>{course.name}</li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2 text-[var(--site-muted)]">
                {grades.map((grade) => (
                  <li key={grade.id}>{grade.name}</li>
                ))}
              </ul>
            )}
            {!courses.length && !grades.length ? (
              <p className="text-sm text-[var(--site-muted)]">The admissions office will confirm available places.</p>
            ) : null}
          </div>
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">Required documents</h3>
            <ul className="space-y-2 text-[var(--site-muted)]">
              {docs.map((doc) => (
                <li key={doc} className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-[var(--accent-dark)] before:font-bold">
                  {documentLabel(doc)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SiteSection>

      {school?.websiteFaqs.length ? (
        <SiteSection>
          <SectionHead eyebrow="Questions" title="Frequently asked questions" />
          <div className="site-accordion">
            {school.websiteFaqs.map((faq) => (
              <details key={faq.id}>
                <summary>{faq.question}</summary>
                <div className="ac-body whitespace-pre-wrap">{faq.answer}</div>
              </details>
            ))}
          </div>
        </SiteSection>
      ) : null}

      <CtaBand
        title={admission?.open ? "Start your application" : "Speak to admissions"}
        description="You will receive a reference number such as APP-YYYY-00001 to track your application."
        primaryHref={admission?.open ? "/apply" : "/contact"}
        primaryLabel={admission?.open ? "Apply online" : "Contact us"}
        secondaryHref="/apply/status"
        secondaryLabel="Track application"
      />
    </>
  );
}
