import Link from "next/link";
import { COMPANY_NAME } from "@/lib/constants";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { socialLinks, whatsappHref } from "@/lib/public-site";
import { resolveBrandLogo } from "@/lib/school-branding";

interface PublicFooterProps {
  schoolName?: string;
  logoUrl?: string | null;
  aboutText?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  website?: string | null;
  academicsHref?: string;
  academicsLabel?: string;
}

export function PublicFooter({
  schoolName,
  logoUrl,
  aboutText,
  email,
  phone,
  whatsapp,
  address,
  facebookUrl,
  instagramUrl,
  twitterUrl,
  linkedinUrl,
  youtubeUrl,
  website,
  academicsHref = "/programmes",
  academicsLabel = "Programmes",
}: PublicFooterProps) {
  const social = socialLinks({ facebookUrl, instagramUrl, twitterUrl, linkedinUrl, youtubeUrl, website });
  const wa = whatsappHref(whatsapp);
  const blurb = aboutText
    ? aboutText.replace(/\s+/g, " ").trim().slice(0, 160)
    : `${schoolName ?? "This institution"} — an independent South African campus.`;

  return (
    <footer className="mt-auto bg-[var(--site-footer)] text-white/70 text-[0.92rem] pt-16 pb-8">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-9">
          <div>
            <Link href="/" className="inline-flex mb-3.5">
              <span className="inline-block bg-white px-3.5 py-2.5 rounded-xl">
                <SchoolLogo
                  src={resolveBrandLogo(logoUrl)}
                  name={schoolName}
                  size="lg"
                  className="h-[72px] max-h-[72px] max-w-[220px]"
                />
              </span>
            </Link>
            <p className="max-w-[24em] leading-relaxed">{blurb}{aboutText && aboutText.length > 160 ? "…" : ""}</p>
            {social.length ? (
              <div className="flex flex-col gap-2 mt-4">
                {social.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-white/20 px-3 py-1.5 text-[0.78rem] font-semibold hover:text-[var(--accent)] hover:border-[var(--accent)]"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <h4 className="!font-[family-name:var(--site-sans)] !text-[0.8rem] uppercase tracking-[0.12em] !text-white mb-4 !font-bold">
              Explore
            </h4>
            <Link href="/about" className="block py-1 hover:text-[var(--accent)]">About us</Link>
            <Link href={academicsHref} className="block py-1 hover:text-[var(--accent)]">{academicsLabel}</Link>
            <Link href="/news" className="block py-1 hover:text-[var(--accent)]">News</Link>
            <Link href="/calendar" className="block py-1 hover:text-[var(--accent)]">Calendar</Link>
            <Link href="/gallery" className="block py-1 hover:text-[var(--accent)]">Gallery</Link>
          </div>
          <div>
            <h4 className="!font-[family-name:var(--site-sans)] !text-[0.8rem] uppercase tracking-[0.12em] !text-white mb-4 !font-bold">
              Admissions
            </h4>
            <Link href="/apply" className="block py-1 hover:text-[var(--accent)]">Apply online</Link>
            <Link href="/fees" className="block py-1 hover:text-[var(--accent)]">Fees</Link>
            <Link href="/admissions" className="block py-1 hover:text-[var(--accent)]">Admissions</Link>
            <Link href="/apply/status" className="block py-1 hover:text-[var(--accent)]">Track application</Link>
            <Link href="/contact" className="block py-1 hover:text-[var(--accent)]">Book a visit</Link>
            <p className="!font-[family-name:var(--site-sans)] !text-[0.8rem] uppercase tracking-[0.12em] !text-white mt-6 mb-3 font-bold">
              Portals
            </p>
            <Link href="/student/login" className="block py-1 hover:text-[var(--accent)]">Student Portal</Link>
            <Link href="/parent/login" className="block py-1 hover:text-[var(--accent)]">Parent Portal</Link>
            <Link href="/login" className="block py-1 hover:text-[var(--accent)]">Staff Portal</Link>
          </div>
          <div>
            <h4 className="!font-[family-name:var(--site-sans)] !text-[0.8rem] uppercase tracking-[0.12em] !text-white mb-4 !font-bold">
              Contact
            </h4>
            {phone ? (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="block py-1 hover:text-[var(--accent)]">
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="block py-1 hover:text-[var(--accent)]">
                {email}
              </a>
            ) : null}
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="block py-1 hover:text-[var(--accent)]">
                WhatsApp
              </a>
            ) : null}
            {address ? <p className="py-1 leading-relaxed">{address}</p> : null}
          </div>
        </div>
        <div className="border-t border-white/12 mt-12 pt-5 flex flex-wrap gap-3.5 justify-between text-[0.84rem] text-white/50">
          <span>
            © {new Date().getFullYear()} {schoolName ?? COMPANY_NAME}. All rights reserved.
          </span>
          <span>
            <Link href="/privacy" className="hover:text-[var(--accent)]">Privacy</Link>
            {" · "}
            Powered by {COMPANY_NAME}
          </span>
        </div>
      </div>
    </footer>
  );
}
