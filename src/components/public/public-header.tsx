"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { resolveBrandLogo } from "@/lib/school-branding";
import { cn } from "@/lib/utils";

export type PublicNavLink = { href: string; label: string };

const LOGIN_LINKS = [
  { href: "/student/login", label: "Student login" },
  { href: "/login", label: "Staff login" },
] as const;

function placeLoginMenu(menu: HTMLElement, button: HTMLElement) {
  const rect = button.getBoundingClientRect();
  const width = Math.max(180, rect.width);
  const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
  menu.style.position = "fixed";
  menu.style.inset = "auto";
  menu.style.margin = "0";
  menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.width = `${Math.round(width)}px`;
  menu.style.right = "auto";
  menu.style.bottom = "auto";
}

function LoginMenu({
  onNavigate,
  buttonClassName,
}: {
  onNavigate?: () => void;
  buttonClassName?: string;
}) {
  const menuId = useId().replace(/:/g, "");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function place() {
      if (buttonRef.current && menuRef.current) placeLoginMenu(menuRef.current, buttonRef.current);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function onButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!menu || !button) return;
    const now = performance.now();
    const isOpen = menu.matches(":popover-open");
    // The opening click was immediately followed by a second click that closed the menu.
    if ((isOpen && now - openedAt.current < 450) || (openedAt.current > 0 && now - openedAt.current < 50)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!isOpen) openedAt.current = now;
    placeLoginMenu(menu, button);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={menuId}
        className={cn(
          "flex items-center font-semibold text-[var(--site-ink)] hover:text-primary",
          buttonClassName
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onButtonClick}
      >
        Login
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={menuId}
        ref={menuRef}
        popover="auto"
        role="menu"
        onToggle={(event) => setOpen(event.currentTarget.matches(":popover-open"))}
        className="z-50 m-0 min-w-[180px] rounded-[12px] border border-[var(--site-line)] bg-white p-0 py-1 text-[var(--site-ink)] shadow-lg"
      >
        {LOGIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-semibold text-[var(--site-ink)] hover:bg-[var(--site-paper-2)] hover:text-primary"
            onClick={() => {
              menuRef.current?.hidePopover();
              onNavigate?.();
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
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
            />
          </div>
        </nav>
      )}
    </header>
  );
}
