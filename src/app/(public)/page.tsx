import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ROLE_DASHBOARD } from "@/lib/constants";
import {
  admissionSummary,
  defaultWhyChooseUs,
  emphasizeLastWord,
  formatSchoolAddress,
  getFeaturedSchool,
  homeHighlights,
  journeyCards,
  parseWhyChooseUs,
  publicAcademicsHref,
  publicAcademicsLabel,
} from "@/lib/public-site";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { getPublicCalendarItems, getPublicNews } from "@/lib/public-calendar";
import { CtaBand, FeatureCard, SectionHead, SiteEyebrow, SiteLink, SiteSection } from "@/components/public/site-ui";
import { formatDate } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  CheckCircle,
  GraduationCap,
  Home,
  Shield,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

const WHY_ICONS = [Shield, BookOpen, Users, GraduationCap, CheckCircle, Home];

export default async function HomePage() {
  const [session, school] = await Promise.all([getSession(), getFeaturedSchool()]);
  const terms = getTerminology(school?.institutionType);
  const college = isCollegeLike(school?.institutionType);
  const academicsHref = publicAcademicsHref(school?.institutionType);
  const academicsLabel = publicAcademicsLabel(school?.institutionType);
  const admission = school ? admissionSummary(school) : null;
  const why = school ? parseWhyChooseUs(school.whyChooseUs) : [];
  const whyItems = why.length ? why : defaultWhyChooseUs(college);
  const highlights = school ? homeHighlights(school) : [];
  const journey = school ? journeyCards(school) : [];
  const welcomeImage = school?.websiteGallery[0]?.imageUrl || school?.heroImageUrl || null;
  const principalImage = school?.websiteGallery[1]?.imageUrl || school?.websiteGallery[0]?.imageUrl || null;
  const [news, calendar] = school
    ? await Promise.all([getPublicNews(school.id), getPublicCalendarItems(school.id)])
    : [[], []];
  const events = calendar.filter((item) => item.kind === "event").slice(0, 4);
  const address = school ? formatSchoolAddress(school) : "";
  const headline = school?.heroHeadline || school?.name || "Welcome";
  const { lead, emphasis } = emphasizeLastWord(headline);
  const subtitle =
    school?.heroSubtitle ||
    school?.aboutText ||
    `${school?.name ?? "Our institution"} serves ${terms.students.toLowerCase()} and families across South Africa.`;
  const leaderTitle =
    school?.principalTitle || (college ? "Director" : "Principal");

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        {school?.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: school?.heroImageUrl
              ? "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 72%, #000), color-mix(in srgb, var(--primary) 55%, #000))"
              : "radial-gradient(1100px 500px at 78% -10%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 60%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-[860px] px-7 py-[120px] text-center">
          <SiteEyebrow className="text-[var(--accent)]">
            {school?.city ? `${school.city}` : "Believe in yourself"}
          </SiteEyebrow>
          <h1 className="hero-title">
            {lead}
            <em>{emphasis}</em>
          </h1>
          <p className="text-[length:var(--site-lead)] text-white/80 max-w-[30em] mx-auto mb-8">{subtitle}</p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <Link href="/apply" className="site-btn site-btn-gold site-btn-arrow">
              Apply online
            </Link>
            <Link href="/contact" className="site-btn site-btn-ghost">
              Book a visit
            </Link>
            {session ? (
              <Link href={ROLE_DASHBOARD[session.role]} className="site-btn site-btn-ghost">
                My Dashboard
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {highlights.length ? (
        <div className="bg-white border-b border-[var(--site-line)]">
          <div className="mx-auto max-w-[1180px] px-7 py-[30px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 text-center">
            {highlights.map((item) => (
              <div key={`${item.value}-${item.label}`} className="flex flex-col gap-0.5">
                <b className="font-[family-name:var(--site-serif)] text-[1.7rem] text-primary font-semibold leading-none">
                  {item.value}
                </b>
                <span className="text-[0.86rem] text-[var(--site-muted)] font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <SiteSection>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-start">
          <div>
            <SiteEyebrow>Welcome to {school?.name ?? "our campus"}</SiteEyebrow>
            <h2 className="section-title mt-[0.35em] mb-5">
              A place to grow, learn and thrive
            </h2>
            <p className="text-[var(--site-muted)] leading-relaxed whitespace-pre-wrap">
              {school?.aboutText ||
                `${school?.name ?? "This institution"} is committed to quality education for South African ${terms.students.toLowerCase()}.`}
            </p>
            <SiteLink href="/about" className="inline-block mt-6">
              Read our story →
            </SiteLink>
          </div>
          {welcomeImage ? (
            <div className="rounded-[26px] overflow-hidden shadow-[0_18px_50px_-22px_rgba(12,63,115,0.42)] aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={welcomeImage}
                alt={school?.websiteGallery[0]?.altText || school?.name || "Campus"}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className="rounded-[26px] min-h-[280px]"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--accent) 28%, transparent), color-mix(in srgb, var(--primary) 70%, #16243f))",
              }}
            />
          )}
        </div>
      </SiteSection>

      {journey.length ? (
        <SiteSection alt>
          <SectionHead
            eyebrow={college ? "Programmes" : "Learning journey"}
            title={college ? `One path through ${academicsLabel.toLowerCase()}` : "One journey, through every stage"}
            description={`A continuous, supported path at ${school?.name ?? "this institution"}.`}
          />
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${journey.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-5`}>
            {journey.map((card) => (
              <Link
                key={card.href + card.title}
                href={card.href}
                className="group flex flex-col bg-white border border-[var(--site-line)] rounded-[14px] overflow-hidden transition-transform hover:-translate-y-1 hover:border-[var(--accent-dark)] hover:shadow-[0_18px_50px_-22px_rgba(12,63,115,0.42)]"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[var(--site-paper-2)]">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        background:
                          "linear-gradient(135deg, color-mix(in srgb, var(--accent) 25%, #d8cdb4), var(--primary))",
                      }}
                    />
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <span className="text-[0.82rem] text-[var(--accent-dark)] font-bold tracking-wide uppercase">
                    {card.kicker}
                  </span>
                  <h3 className="text-[1.18rem] mt-1 mb-1">{card.title}</h3>
                  <p className="text-[0.92rem] text-[var(--site-muted)] mt-2 flex-1">{card.description}</p>
                  <span className="inline-block mt-4 text-[0.82rem] font-bold text-[var(--accent-dark)] tracking-wide">
                    Learn more →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </SiteSection>
      ) : null}

      {school?.principalMessage ? (
        <SiteSection>
          <SiteEyebrow className="block mb-6">Our {leaderTitle}</SiteEyebrow>
          <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-8 md:gap-14 items-center">
            {principalImage ? (
              <div className="aspect-square rounded-[26px] overflow-hidden max-w-[360px] shadow-[0_18px_50px_-22px_rgba(12,63,115,0.42)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={principalImage} alt={school.principalName || leaderTitle} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div
                className="aspect-square rounded-[26px] max-w-[360px]"
                style={{
                  background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--accent) 40%, var(--primary)))",
                }}
              />
            )}
            <div>
              <blockquote className="font-[family-name:var(--site-serif)] text-[clamp(1.3rem,2.2vw,1.85rem)] leading-[1.35] text-primary font-normal italic">
                “{school.principalMessage}”
              </blockquote>
              {school.principalName ? (
                <p className="mt-[18px] font-[family-name:var(--site-serif)] text-[1.15rem] text-primary">{school.principalName}</p>
              ) : null}
              <SiteLink href="/about" className="inline-block mt-5">
                About {school.name} →
              </SiteLink>
            </div>
          </div>
        </SiteSection>
      ) : null}

      <SiteSection alt={!school?.principalMessage}>
        <SectionHead eyebrow={`Why ${school?.name ?? "us"}`} title="An education that opens doors" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {whyItems.map((item, index) => {
            const Icon = WHY_ICONS[index % WHY_ICONS.length];
            return (
              <FeatureCard
                key={item.title}
                icon={<Icon className="h-[22px] w-[22px]" />}
                title={item.title}
                description={item.description}
              />
            );
          })}
        </div>
        <div className="mt-9">
          <Link href="/about" className="site-btn site-btn-navy site-btn-arrow">
            Discover more
          </Link>
        </div>
      </SiteSection>

      <SiteSection>
        <SiteEyebrow>Continue exploring</SiteEyebrow>
        <h2 className="section-title mt-[0.2em] mb-[1.4em]">Where to next?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            href="/contact"
            className="flex flex-col bg-white border border-[var(--site-line)] rounded-[26px] p-8 no-underline transition-shadow hover:shadow-[0_18px_50px_-22px_rgba(12,63,115,0.42)]"
          >
            <Home className="h-[22px] w-[22px] text-[var(--accent-dark)] mb-3.5" />
            <h3 className="text-[1.55rem] font-normal text-primary mb-2">Come and see for yourself</h3>
            <p className="text-[0.95rem] leading-relaxed text-[var(--site-muted)] flex-1">
              {address
                ? `Visit us at ${address}. Book a visit and we will take care of the rest.`
                : "The best way to get a feel for campus is to walk it with our team."}
            </p>
            <span className="site-read mt-6 inline-block">Book a visit →</span>
          </Link>
          <Link
            href={admission?.open ? "/apply" : "/admissions"}
            className="flex flex-col bg-white border border-[var(--site-line)] rounded-[26px] p-8 no-underline transition-shadow hover:shadow-[0_18px_50px_-22px_rgba(12,63,115,0.42)]"
          >
            <GraduationCap className="h-[22px] w-[22px] text-[var(--accent-dark)] mb-3.5" />
            <h3 className="text-[1.55rem] font-normal text-primary mb-2">
              {admission?.open ? "Applications are now open" : "Admissions"}
            </h3>
            <p className="text-[0.95rem] leading-relaxed text-[var(--site-muted)] flex-1">
              {admission?.instructions ||
                `Start an online application for the ${admission?.yearLabel ?? ""} intake, or speak to admissions.`}
            </p>
            <span className="site-read mt-6 inline-block">
              {admission?.open ? "Start your application →" : "Admissions information →"}
            </span>
          </Link>
        </div>
      </SiteSection>

      {(news.length > 0 || events.length > 0) && (
        <SiteSection alt>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <div className="flex items-end justify-between mb-6">
                <h2 className="section-title">Latest news</h2>
                <SiteLink href="/news">All news →</SiteLink>
              </div>
              {news.slice(0, 3).length === 0 ? (
                <p className="text-sm text-[var(--site-muted)]">No public news has been published yet.</p>
              ) : (
                <div className="space-y-4">
                  {news.slice(0, 3).map((item) => (
                    <article key={item.id} className="bg-white border border-[var(--site-line)] rounded-[14px] p-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-dark)]">
                        {formatDate(item.publishAt)}
                      </p>
                      <h3 className="text-xl mt-2">{item.title}</h3>
                      <p className="text-sm text-[var(--site-muted)] mt-2 line-clamp-3 whitespace-pre-wrap">{item.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[var(--accent-dark)]" /> Upcoming
              </h2>
              {events.length === 0 ? (
                <p className="text-sm text-[var(--site-muted)]">No upcoming public events.</p>
              ) : (
                <ul className="space-y-4">
                  {events.map((item) => (
                    <li key={`${item.title}-${item.date.toISOString()}`} className="border-b border-[var(--site-line)] pb-3">
                      <p className="font-semibold text-primary">{item.title}</p>
                      <p className="text-xs text-[var(--site-muted)] mt-1">{formatDate(item.date)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <SiteLink href="/calendar" className="inline-block mt-4">
                Full calendar →
              </SiteLink>
            </div>
          </div>
        </SiteSection>
      )}

      <CtaBand
        eyebrow="Admissions"
        title={admission?.open ? `Applications for ${admission.yearLabel}` : "Speak to admissions"}
        description={
          admission && !admission.open
            ? admission.message
            : `Submit an online application and track your progress with a reference number.`
        }
        primaryHref={admission?.open ? "/apply" : "/contact"}
        primaryLabel={admission?.open ? "Apply online" : "Contact us"}
        secondaryHref="/admissions"
        secondaryLabel="Admissions information"
      />
    </>
  );
}
