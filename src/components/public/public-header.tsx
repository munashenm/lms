"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { resolveBrandLogo } from "@/lib/school-branding";
import { cn } from "@/lib/utils";

export type PublicNavLink = { href: string; label: string };

export function PublicHeader({
  schoolName,
  logoUrl,
  academicsHref,
  academicsLabel,
}: {
  schoolName?: string;
  logoUrl?: string | null;
  academicsHref?: string;
  academicsLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const programmesHref = academicsHref ?? "/programmes";
  const programmesLabel = academicsLabel ?? "Programmes";

  const navLinks: PublicNavLink[] = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/admissions", label: "Admissions" },
    { href: programmesHref, label: programmesLabel },
    { href: "/fees", label: "Fees" },
    { href: "/news", label: "News" },
    { href: "/calendar", label: "Calendar" },
    { href: "/contact", label: "Contact" },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/programmes" || href === "/academics") {
      return pathname === "/programmes" || pathname === "/academics";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--site-line)] bg-[rgba(250,248,244,0.86)] backdrop-blur-[12px]">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-5 py-2 lg:px-7">
        <Link href="/" className="flex min-w-0 items-center shrink-0">
          <SchoolLogo
            src={resolveBrandLogo(logoUrl)}
            name={schoolName}
            size="lg"
            className="h-12 max-h-12 max-w-[160px] lg:h-[68px] lg:max-h-[68px] lg:max-w-[210px]"
          />
        </Link>

        <nav className="ml-auto hidden lg:flex min-w-0 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-[10px] px-2 py-2 text-[0.82rem] font-semibold transition-colors whitespace-nowrap xl:px-3 xl:text-[0.92rem]",
                isActive(link.href)
                  ? "text-primary bg-[var(--site-paper-2)]"
                  : "text-[var(--site-ink)] hover:text-primary hover:bg-[var(--site-paper-2)]"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/student/login"
            className="rounded-[10px] px-2 py-2 text-[0.82rem] font-semibold text-[var(--site-ink)] hover:text-primary hover:bg-[var(--site-paper-2)] whitespace-nowrap xl:px-3 xl:text-[0.92rem]"
          >
            Student Login
          </Link>
          <Link href="/apply" className="site-btn site-btn-gold ml-2 !py-2 !px-3.5 xl:!py-2.5 xl:!px-4">
            Apply
          </Link>
        </nav>

        <div className="ml-auto lg:hidden">
          <Link href="/apply" className="site-btn site-btn-gold !py-2.5 !px-4">
            Apply
          </Link>
        </div>
        <button
          className="lg:hidden rounded-[10px] bg-primary p-2.5 text-white"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-[var(--site-line)] bg-white">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block border-t border-[var(--site-line)] px-7 py-3.5 font-semibold",
                isActive(link.href) ? "text-primary" : "text-[var(--site-ink)]"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/student/login"
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--site-line)] px-7 py-3.5 font-semibold"
          >
            Student Login
          </Link>
        </nav>
      )}
    </header>
  );
}
