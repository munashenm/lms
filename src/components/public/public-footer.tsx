import Link from "next/link";
import { COMPANY_NAME } from "@/lib/constants";
import { BrandMark } from "@/components/layout/brand-mark";
import { formatSchoolAddress, socialLinks, whatsappHref } from "@/lib/public-site";

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

  return (
    <footer className="border-t border-border bg-primary text-white mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <BrandMark
              logoUrl={logoUrl}
              name={schoolName ?? "Institution"}
              inverted
              size="md"
            />
            {aboutText ? (
              <p className="text-sm text-white/70 mt-3 max-w-md line-clamp-4">{aboutText}</p>
            ) : null}
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Quick Links</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href={academicsHref} className="hover:text-white">{academicsLabel}</Link></li>
              <li><Link href="/fees" className="hover:text-white">Fees</Link></li>
              <li><Link href="/news" className="hover:text-white">News</Link></li>
              <li><Link href="/calendar" className="hover:text-white">Calendar</Link></li>
              <li><Link href="/gallery" className="hover:text-white">Gallery</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Admissions</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/admissions" className="hover:text-white">Admissions</Link></li>
              <li><Link href="/apply" className="hover:text-white">Apply Online</Link></li>
              <li><Link href="/apply/status" className="hover:text-white">Track Application</Link></li>
            </ul>
            <p className="font-semibold text-sm mb-3 mt-6">Portals</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/student/login" className="hover:text-white">Student Portal</Link></li>
              <li><Link href="/parent/login" className="hover:text-white">Parent Portal</Link></li>
              <li><Link href="/login" className="hover:text-white">Staff Portal</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Contact</p>
            <ul className="space-y-2 text-sm text-white/70">
              {address ? <li>{address}</li> : null}
              {phone ? (
                <li>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-white">{phone}</a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className="hover:text-white">{email}</a>
                </li>
              ) : null}
              {wa ? (
                <li>
                  <a href={wa} target="_blank" rel="noreferrer" className="hover:text-white">
                    WhatsApp
                  </a>
                </li>
              ) : null}
            </ul>
            {social.length > 0 ? (
              <ul className="flex flex-wrap gap-3 mt-4 text-sm text-white/70">
                {social.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} target="_blank" rel="noreferrer" className="hover:text-white">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {schoolName ?? COMPANY_NAME}. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-white">Privacy / POPIA</Link>
            <span>Powered by {COMPANY_NAME}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
