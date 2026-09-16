import { formatSchoolAddress, getFeaturedSchool, socialLinks, whatsappHref } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { ContactForm } from "@/components/public/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Mail, Phone, Clock, MessageCircle } from "lucide-react";

export const metadata = publicPageMetadata("Contact", "Get in touch with our admissions and admin team.");
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const school = await getFeaturedSchool();
  const address = school ? formatSchoolAddress(school) : "";
  const wa = whatsappHref(school?.whatsapp);
  const social = school ? socialLinks(school) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold">Contact us</h1>
        <p className="text-muted mt-3">Speak to admissions or the campus office.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">{school?.name}</h2>
              {address ? (
                <p className="flex items-start gap-3 text-sm text-muted">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  {address}
                </p>
              ) : null}
              {school?.phone ? (
                <p className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${school.phone.replace(/\s/g, "")}`} className="hover:text-primary">
                    {school.phone}
                  </a>
                </p>
              ) : null}
              {school?.email ? (
                <p className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${school.email}`} className="hover:text-primary">
                    {school.email}
                  </a>
                </p>
              ) : null}
              {wa ? (
                <p className="flex items-center gap-3 text-sm">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <a href={wa} target="_blank" rel="noreferrer" className="hover:text-primary">
                    WhatsApp {school?.whatsapp}
                  </a>
                </p>
              ) : null}
              <p className="flex items-start gap-3 text-sm text-muted">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                {school?.officeHours || "Mon–Fri: 08:00 – 16:30 (SAST)"}
              </p>
              {social.length ? (
                <div className="flex flex-wrap gap-3 pt-2 text-sm">
                  {social.map((item) => (
                    <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {item.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {school?.websiteFaqs.length ? (
            <div className="space-y-3">
              <h2 className="font-semibold">FAQs</h2>
              {school.websiteFaqs.map((faq) => (
                <Card key={faq.id}>
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>

        <ContactForm schoolEmail={school?.email ?? undefined} />
      </div>
    </div>
  );
}
