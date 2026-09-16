import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ROLE_DASHBOARD } from "@/lib/constants";
import {
  admissionSummary,
  defaultWhyChooseUs,
  formatSchoolAddress,
  getFeaturedSchool,
  parseWhyChooseUs,
  publicAcademicsHref,
  publicAcademicsLabel,
  publishedStats,
  whatsappHref,
} from "@/lib/public-site";
import { applyCtaLabel } from "@/lib/admissions";
import { getTerminology, isCollegeLike } from "@/lib/terminology";
import { getPublicCalendarItems, getPublicNews } from "@/lib/public-calendar";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle,
  GraduationCap,
  MapPin,
  Megaphone,
  Newspaper,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, school] = await Promise.all([getSession(), getFeaturedSchool()]);
  const terms = getTerminology(school?.institutionType);
  const college = isCollegeLike(school?.institutionType);
  const academicsHref = publicAcademicsHref(school?.institutionType);
  const academicsLabel = publicAcademicsLabel(school?.institutionType);
  const admission = school ? admissionSummary(school) : null;
  const applyLabel = applyCtaLabel(admission?.yearLabel ?? String(new Date().getFullYear()));
  const stats = school ? publishedStats(school) : null;
  const why = school ? parseWhyChooseUs(school.whyChooseUs) : [];
  const whyItems = why.length ? why : defaultWhyChooseUs(college);
  const courseOfferings = school?.courses.filter((course) => course.openForApplications).slice(0, 4) ?? [];
  const gradeOfferings = school?.grades.filter((grade) => grade.openForApplications).slice(0, 8) ?? [];
  const [news, calendar] = school
    ? await Promise.all([getPublicNews(school.id), getPublicCalendarItems(school.id)])
    : [[], []];
  const events = calendar.filter((item) => item.kind === "event").slice(0, 4);
  const dates = calendar.filter((item) => item.kind === "term" || item.kind === "event").slice(0, 6);
  const address = school ? formatSchoolAddress(school) : "";
  const wa = whatsappHref(school?.whatsapp);

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        {school?.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={school.heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        ) : null}
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-20 lg:px-6 lg:py-28">
          <div className="max-w-2xl">
            {school?.logoUrl ? (
              <SchoolLogo src={school.logoUrl} name={school.name} size="xl" framed className="mb-6" />
            ) : null}
            <p className="text-accent font-semibold text-sm uppercase tracking-wide mb-3">
              {school?.institutionType.replaceAll("_", " ") ?? "Institution"}
              {school?.city ? ` · ${school.city}` : ""}
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              {school?.heroHeadline || school?.name || "Welcome"}
            </h1>
            <p className="mt-4 text-lg text-white/80 leading-relaxed">
              {school?.heroSubtitle ||
                school?.aboutText ||
                `${school?.name ?? "Our institution"} serves learners and families across South Africa.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-accent text-primary hover:bg-accent/90" asChild>
                <Link href="/apply">
                  {applyLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                <Link href="/student/login">Student Login</Link>
              </Button>
              {session ? (
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                  <Link href={ROLE_DASHBOARD[session.role]}>My Dashboard</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {stats ? (
        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
          <div className={stats.length === 1 ? "grid grid-cols-1 gap-4" : stats.length === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-1 sm:grid-cols-3 gap-4"}>
            {stats.map((item) => (
              <Card key={item.label}>
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">{item.value}</p>
                  <p className="text-sm text-muted mt-1">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-2xl font-bold">About {school?.name ?? "us"}</h2>
            <p className="text-muted mt-3 leading-relaxed whitespace-pre-wrap">
              {school?.aboutText ||
                `${school?.name ?? "This institution"} is committed to quality education for South African ${terms.students.toLowerCase()}.`}
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/about">Read more</Link>
            </Button>
          </div>
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                {academicsLabel}
              </h3>
              {college ? (
                <ul className="space-y-2 text-sm">
                  {courseOfferings.map((course) => (
                    <li key={course.id} className="flex justify-between gap-3">
                      <span>{course.name}</span>
                      {course.nqfLevel ? <span className="text-muted">NQF {course.nqfLevel}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {gradeOfferings.map((grade) => (
                    <span key={grade.id} className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm">
                      {grade.name}
                    </span>
                  ))}
                </div>
              )}
              {!(college ? courseOfferings.length : gradeOfferings.length) ? (
                <p className="text-sm text-muted">{academicsLabel} will be published by the institution.</p>
              ) : null}
              <Button size="sm" className="mt-2" asChild>
                <Link href={academicsHref}>View {academicsLabel.toLowerCase()}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-surface border-y border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
          <h2 className="text-2xl font-bold text-center mb-10">Why choose us</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyItems.map((item) => (
              <div key={item.title} className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="rounded-2xl bg-primary text-white p-8 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold">{applyLabel}</h2>
            <p className="text-white/80 mt-2 max-w-xl">
              {admission?.instructions ||
                `Submit an online application for the ${admission?.yearLabel ?? ""} intake and track your progress with a reference number.`}
            </p>
            {admission && !admission.open ? (
              <p className="text-accent mt-3 text-sm">{admission.message}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="bg-accent text-primary hover:bg-accent/90" asChild>
              <Link href="/apply">{applyLabel}</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/admissions">Admissions information</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" /> Latest news
            </h2>
            <Link href="/news" className="text-sm text-primary hover:underline">
              All news
            </Link>
          </div>
          {news.slice(0, 3).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted text-center">
                No public news has been published yet.
              </CardContent>
            </Card>
          ) : (
            news.slice(0, 3).map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6 space-y-2">
                  <p className="text-xs text-muted">{formatDate(item.publishAt)}</p>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted line-clamp-3 whitespace-pre-wrap">{item.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Megaphone className="h-5 w-5 text-primary" /> Upcoming events
            </h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No upcoming public events.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((item) => (
                  <li key={`${item.title}-${item.date.toISOString()}`}>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted">{formatDate(item.date)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/calendar" className="text-sm text-primary hover:underline mt-3 inline-block">
              Full calendar
            </Link>
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <CalendarDays className="h-5 w-5 text-primary" /> Important dates
            </h2>
            {dates.length === 0 ? (
              <p className="text-sm text-muted">Term dates will appear here when published.</p>
            ) : (
              <ul className="space-y-3">
                {dates.map((item) => (
                  <li key={`${item.kind}-${item.title}`} className="text-sm">
                    <span className="text-muted">{formatDate(item.date)} · </span>
                    {item.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="bg-surface border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold">Campus & contact</h2>
            {address ? (
              <p className="mt-3 text-muted flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 shrink-0" />
                {address}
              </p>
            ) : null}
            <div className="mt-4 space-y-1 text-sm">
              {school?.phone ? <p>{school.phone}</p> : null}
              {school?.email ? <p>{school.email}</p> : null}
              {school?.officeHours ? <p>{school.officeHours}</p> : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/contact">Contact us</Link>
              </Button>
              {wa ? (
                <Button variant="outline" asChild>
                  <a href={wa} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          {school?.websiteGallery[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.websiteGallery[0].imageUrl}
              alt={school.websiteGallery[0].altText || school.websiteGallery[0].caption || school.name}
              className="w-full rounded-2xl object-cover max-h-80"
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
