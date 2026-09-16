import { formatSchoolAddress, getFeaturedSchool, socialLinks, whatsappHref } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { ContactForm } from "@/components/public/contact-form";
import { PageHero, SiteSection } from "@/components/public/site-ui";
import { MapPin, Mail, Phone, Clock, MessageCircle } from "lucide-react";

export const metadata = publicPageMetadata("Contact", "Get in touch with our admissions and admin team.");
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const school = await getFeaturedSchool();
  const address = school ? formatSchoolAddress(school) : "";
  const wa = whatsappHref(school?.whatsapp);
  const social = school ? socialLinks(school) : [];

  const rows = [
    address
      ? { icon: MapPin, label: "Campus", value: address }
      : null,
    school?.phone
      ? { icon: Phone, label: "Telephone", value: school.phone, href: `tel:${school.phone.replace(/\s/g, "")}` }
      : null,
    school?.email
      ? { icon: Mail, label: "Email", value: school.email, href: `mailto:${school.email}` }
      : null,
    wa
      ? { icon: MessageCircle, label: "WhatsApp", value: school?.whatsapp ?? "WhatsApp", href: wa }
      : null,
    { icon: Clock, label: "Office hours", value: school?.officeHours || "Mon–Fri: 08:00 – 16:30 (SAST)" },
  ].filter(Boolean) as Array<{
    icon: typeof MapPin;
    label: string;
    value: string;
    href?: string;
  }>;

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We would love to hear from you."
        description="Speak to admissions or the campus office — or send a message and we will come back to you."
        imageUrl={school?.heroImageUrl}
      />

      <SiteSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h2 className="section-title mb-6">{school?.name}</h2>
            <div>
              {rows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex gap-3.5 py-4 border-b border-[var(--site-line)]">
                    <div className="w-[42px] h-[42px] rounded-[10px] bg-[var(--site-paper-2)] text-[var(--accent-dark)] grid place-items-center shrink-0">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <b className="block font-[family-name:var(--site-serif)] text-primary font-medium">{row.label}</b>
                      {row.href ? (
                        <a href={row.href} target={row.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-[0.93rem] text-[var(--site-muted)]">
                          {row.value}
                        </a>
                      ) : (
                        <span className="text-[0.93rem] text-[var(--site-muted)]">{row.value}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {social.length ? (
              <div className="flex flex-wrap gap-3 pt-6">
                {social.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[10px] border border-[var(--site-line)] px-3 py-2 text-sm font-semibold text-primary hover:border-[var(--accent-dark)]"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}

            {school?.websiteFaqs.length ? (
              <div className="mt-10">
                <h3 className="mb-4">FAQs</h3>
                <div className="site-accordion">
                  {school.websiteFaqs.map((faq) => (
                    <details key={faq.id}>
                      <summary>{faq.question}</summary>
                      <div className="ac-body whitespace-pre-wrap">{faq.answer}</div>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <ContactForm schoolEmail={school?.email ?? undefined} />
        </div>
      </SiteSection>
    </>
  );
}
