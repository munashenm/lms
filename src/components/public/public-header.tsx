"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PublicNavLink = { href: string; label: string };

export function PublicHeader({
  schoolName,
  logoUrl,
  academicsHref,
  academicsLabel,
  applyLabel,
}: {
  schoolName?: string;
  logoUrl?: string | null;
  academicsHref?: string;
  academicsLabel?: string;
  applyLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const programmesHref = academicsHref ?? "/programmes";
  const programmesLabel = academicsLabel ?? "Programmes";
  const applyText = applyLabel ?? "Apply Online";

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
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="flex min-w-0 items-center shrink-0">
          <BrandMark logoUrl={logoUrl} name={schoolName} size="md" />
        </Link>

        <nav className="hidden xl:flex min-w-0 flex-1 items-center justify-center gap-0.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground hover:bg-background"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden sm:flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/student/login">Student Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/apply">{applyText}</Link>
          </Button>
        </div>

        <button
          className="xl:hidden rounded-lg p-2 text-muted ml-auto sm:ml-0"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="xl:hidden border-t border-border bg-surface px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-background",
                isActive(link.href) ? "text-primary bg-primary/10" : "text-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col sm:flex-row gap-2 pt-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/student/login" onClick={() => setOpen(false)}>
                Student Login
              </Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/apply" onClick={() => setOpen(false)}>
                {applyText}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
