"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { resolveBrandLogo } from "@/lib/school-branding";
import { cn } from "@/lib/utils";

export type PublicNavLink = { href: string; label: string };

const LOGIN_LINKS = [
  { href: "/student/login", label: "Student login" },
  { href: "/login", label: "Staff login" },
] as const;

function LoginMenu({
  onNavigate,
  buttonClassName,
  menuClassName,
}: {
  onNavigate?: () => void;
  buttonClassName?: string;
  menuClassName?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex items-center font-semibold text-[var(--site-ink)] hover:text-primary",
          buttonClassName
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Login
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "z-50 min-w-[180px] rounded-[12px] border border-[var(--site-line)] bg-white py-1 shadow-lg",
            menuClassName
          )}
        >
          {LOGIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              className="block px-4 py-2.5 text-sm font-semibold text-[var(--site-ink)] hover:bg-[var(--site-paper-2)] hover:text-primary"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
          <LoginMenu
            buttonClassName="rounded-[10px] px-2 py-2 text-[0.82rem] whitespace-nowrap hover:bg-[var(--site-paper-2)] xl:px-3 xl:text-[0.92rem]"
            menuClassName="absolute right-0 top-full mt-1"
          />
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
          <div className="border-t border-[var(--site-line)] px-7 py-3.5">
            <LoginMenu
              onNavigate={() => setOpen(false)}
              buttonClassName="w-full justify-between text-base"
              menuClassName="static mt-2 w-full shadow-none"
            />
          </div>
        </nav>
      )}
    </header>
  );
}
