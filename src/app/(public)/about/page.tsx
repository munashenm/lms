import Link from "next/link";
import {
  formatSchoolAddress,
  getFeaturedSchool,
  parseWhyChooseUs,
  defaultWhyChooseUs,
} from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { getTerminology, INSTITUTION_TYPE_LABELS, isCollegeLike } from "@/lib/terminology";
import { Card, CardContent } from "@/components/ui/card";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { MapPin, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <SchoolLogo src={school?.logoUrl} name={school?.name} size="lg" />
        <div>
          <h1 className="text-3xl font-bold">About {school?.name ?? "our institution"}</h1>
          <p className="text-muted mt-3 max-w-2xl leading-relaxed whitespace-pre-wrap">
            {school?.aboutText ||
              `${school?.name ?? "This institution"} serves ${terms.students.toLowerCase()} in ${
                school?.province ?? "South Africa"
              }.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Institution type</p>
            <p className="font-semibold mt-1">
              {school ? INSTITUTION_TYPE_LABELS[school.institutionType] : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Curriculum</p>
            <p className="font-semibold mt-1">{school?.curriculumType.replaceAll("_", " ") ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Registration</p>
            <p className="font-semibold mt-1">{school?.registrationNo ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Mission</h2>
            <p className="text-muted leading-relaxed mt-2 whitespace-pre-wrap">
              {school?.missionText || "Our mission will be published by the institution."}
            </p>
          </div>
          {school?.visionText ? (
            <div>
              <h2 className="text-xl font-semibold">Vision</h2>
              <p className="text-muted leading-relaxed mt-2 whitespace-pre-wrap">{school.visionText}</p>
            </div>
          ) : null}
          {values.length ? (
            <div>
              <h2 className="text-xl font-semibold">Values</h2>
              <ul className="mt-2 space-y-1 text-muted list-disc list-inside">
                {values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Campus</h2>
            <p className="font-medium">{campus?.name ?? school?.name}</p>
            <div className="space-y-2 text-sm text-muted">
              {formatSchoolAddress(school ?? {}) ? (
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  {formatSchoolAddress(school ?? {})}
                </p>
              ) : null}
              {school?.email ? (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  {school.email}
                </p>
              ) : null}
              {school?.phone ? (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  {school.phone}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {school?.principalMessage ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-xl font-semibold">
              Message from the {leaderTitle}
              {school.principalName ? ` — ${school.principalName}` : ""}
            </h2>
            <p className="text-muted leading-relaxed whitespace-pre-wrap">{school.principalMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="text-xl font-semibold mb-4">Why families choose us</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {why.map((item) => (
            <Card key={item.title}>
              <CardContent className="p-5">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted mt-2">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {school?.websiteFaqs.length ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {school.websiteFaqs.map((faq) => (
              <Card key={faq.id}>
                <CardContent className="p-5">
                  <p className="font-medium">{faq.question}</p>
                  <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Button asChild>
        <Link href="/contact">Contact us</Link>
      </Button>
    </div>
  );
}
