import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("About Us", "Learn about our institution, mission and campus.");
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Mail, Phone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const school = await getFeaturedSchool();
  const campus = school?.campuses[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">About {school?.name ?? "Our Institution"}</h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">
          We are a leading {school?.institutionType.toLowerCase().replace("_", " ")} in{" "}
          {school?.province ?? "South Africa"}, committed to delivering quality education
          that prepares learners for the workplace and further study.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Institution Type</p>
            <p className="font-semibold mt-1">{school?.institutionType.replace("_", " ") ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted">Curriculum</p>
            <p className="font-semibold mt-1">{school?.curriculumType.replace("_", " ") ?? "—"}</p>
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
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Our Mission</h2>
          <p className="text-muted leading-relaxed">
            To provide accessible, high-quality education that empowers South African
            youth with the skills, knowledge and values needed to succeed in a changing
            economy — from foundation learning through to NQF qualifications.
          </p>
          <h2 className="text-xl font-semibold pt-4">What we offer</h2>
          <div className="flex flex-wrap gap-2">
            {["CAPS / NSC pathways", "TVET & NQF programmes", "Digital learning materials", "Career guidance", "POPIA-safe records"].map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Campus</h2>
            {campus && (
              <>
                <p className="font-medium">{campus.name}</p>
                <div className="space-y-2 text-sm text-muted">
                  {campus.address && (
                    <p className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      {[campus.address, campus.city, campus.province].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {school?.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0" />
                      {school.email}
                    </p>
                  )}
                  {school?.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" />
                      {school.phone}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
