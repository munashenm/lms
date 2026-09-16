import Link from "next/link";
import {
  formatSchoolAddress,
  getFeaturedSchool,
  parseWhyChooseUs,
  defaultWhyChooseUs,
} from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { getTerminology, INSTITUTION_TYPE_LABELS, isCollegeLike } from "@/lib/terminology";
import { CtaBand, FeatureCard, PageHero, SectionHead, SiteSection } from "@/components/public/site-ui";
import { Clock, Mail, MapPin, Phone, Shield } from "lucide-react";

export const metadata = publicPageMetadata("About Us", "Learn about our institution, mission and campus.");
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const school = await getFeaturedSchool();
  const terms = getTerminology(school?.institutionType);
  const campus = school?.campuses.find((item) => item.isMain) ?? school?.campuses[0];
  const values = (school?.valuesText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const why = parseWhyChooseUs(school?.whyChooseUs).length
    ? parseWhyChooseUs(school?.whyChooseUs)
    : defaultWhyChooseUs(isCollegeLike(school?.institutionType));
  const leaderTitle =
    school?.principalTitle || (isCollegeLike(school?.institutionType) ? "Director" : "Principal");
  const aboutImage = school?.heroImageUrl || school?.websiteGallery[0]?.imageUrl;

  return (
    <>
      <PageHero
        eyebrow="About us"
        title={school?.heroHeadline || `One campus, shaped around every ${terms.student.toLowerCase()}.`}
        description={
          school?.heroSubtitle ||
          school?.aboutText ||
          `${school?.name ?? "This institution"} serves ${terms.students.toLowerCase()} in ${school?.province ?? "South Africa"}.`
        }
        imageUrl={aboutImage}
        align="center"
        emphasize
      />

      <SiteSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <SectionHead
              eyebrow="Our story"
              title={`Founded on a simple idea: every ${terms.student.toLowerCase()} matters`}
            />
            <p className="text-[var(--site-muted)] leading-relaxed whitespace-pre-wrap -mt-8">
              {school?.aboutText ||
                `${school?.name ?? "This institution"} is committed to the wellbeing and growth of every ${terms.student.toLowerCase()}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[
              { label: "Institution type", value: school ? INSTITUTION_TYPE_LABELS[school.institutionType] : "—" },
              { label: "Curriculum", value: school?.curriculumType.replaceAll("_", " ") ?? "—" },
              { label: "Registration", value: school?.registrationNo ?? "Published by the institution" },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-[var(--site-line)] rounded-[14px] p-6">
                <p className="site-eyebrow">{item.label}</p>
                <p className="mt-2 text-lg text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </SiteSection>

      <SiteSection alt>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">Mission</h3>
            <p className="text-[var(--site-muted)] leading-relaxed whitespace-pre-wrap">
              {school?.missionText || "Our mission will be published by the institution."}
            </p>
          </div>
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">Vision</h3>
            <p className="text-[var(--site-muted)] leading-relaxed whitespace-pre-wrap">
              {school?.visionText || "Our vision will be published by the institution."}
            </p>
          </div>
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">Values</h3>
            {values.length ? (
              <ul className="space-y-2 text-[var(--site-muted)]">
                {values.map((value) => (
                  <li key={value} className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-[var(--accent-dark)] before:font-bold">
                    {value}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--site-muted)]">Kindness, confidence and excellence shape everything we do.</p>
            )}
          </div>
        </div>
      </SiteSection>

      {school?.principalMessage ? (
        <SiteSection>
          <blockquote className="font-[family-name:var(--site-serif)] text-[clamp(1.3rem,2.2vw,1.85rem)] leading-[1.35] text-primary italic max-w-4xl">
            “{school.principalMessage}”
          </blockquote>
          <p className="mt-5 font-[family-name:var(--site-serif)] text-lg text-primary">
            {school.principalName || leaderTitle}
            {school.principalName ? <span className="block text-sm font-[family-name:var(--site-sans)] text-[var(--site-muted)] mt-1 not-italic">{leaderTitle}</span> : null}
          </p>
        </SiteSection>
      ) : null}

      <SiteSection alt={Boolean(school?.principalMessage)}>
        <SectionHead eyebrow="Campus" title={campus?.name ?? school?.name ?? "Our campus"} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 text-[var(--site-muted)]">
            {formatSchoolAddress(school ?? {}) ? (
              <p className="flex items-start gap-3">
                <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-[var(--accent-dark)]" />
                {formatSchoolAddress(school ?? {})}
              </p>
            ) : null}
            {school?.email ? (
              <p className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-[var(--accent-dark)]" />
                <a href={`mailto:${school.email}`}>{school.email}</a>
              </p>
            ) : null}
            {school?.phone ? (
              <p className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-[var(--accent-dark)]" />
                <a href={`tel:${school.phone.replace(/\s/g, "")}`}>{school.phone}</a>
              </p>
            ) : null}
            <p className="flex items-start gap-3">
              <Clock className="h-5 w-5 shrink-0 mt-0.5 text-[var(--accent-dark)]" />
              {school?.officeHours || "Mon–Fri: 08:00 – 16:30 (SAST)"}
            </p>
          </div>
          {school?.websiteGallery[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.websiteGallery[0].imageUrl}
              alt={school.websiteGallery[0].altText || school.name}
              className="w-full rounded-[26px] object-cover max-h-80"
            />
          ) : null}
        </div>
      </SiteSection>

      <SiteSection>
        <SectionHead eyebrow="Why families choose us" title="What sets us apart" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {why.map((item) => (
            <FeatureCard
              key={item.title}
              icon={<Shield className="h-[22px] w-[22px]" />}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </SiteSection>

      {school?.websiteFaqs.length ? (
        <SiteSection alt>
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
        title="Come and see for yourself"
        description="Book a visit or start an application with the admissions team."
        primaryHref="/contact"
        primaryLabel="Book a visit"
        secondaryHref="/apply"
        secondaryLabel="Apply online"
      />
    </>
  );
}
