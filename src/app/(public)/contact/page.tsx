import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("Contact", "Get in touch with our admissions and admin team.");
import { ContactForm } from "@/components/public/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Mail, Phone, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const school = await getFeaturedSchool();
  const campus = school?.campuses[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold">Contact Us</h1>
        <p className="text-muted mt-3">
          Get in touch with our admissions and admin team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">{school?.name}</h2>
              {campus?.address && (
                <p className="flex items-start gap-3 text-sm text-muted">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  {[campus.address, campus.city, campus.province, school?.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
              {school?.phone && (
                <p className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${school.phone.replace(/\s/g, "")}`} className="hover:text-primary">{school.phone}</a>
                </p>
              )}
              {school?.email && (
                <p className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${school.email}`} className="hover:text-primary">{school.email}</a>
                </p>
              )}
              <p className="flex items-start gap-3 text-sm text-muted">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                Mon–Fri: 08:00 – 16:30 (SAST)
              </p>
            </CardContent>
          </Card>
        </div>

        <ContactForm schoolEmail={school?.email ?? undefined} />
      </div>
    </div>
  );
}
