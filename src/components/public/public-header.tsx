"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/programmes", label: "Programmes" },
  { href: "/fees", label: "Fees" },
  { href: "/contact", label: "Contact" },
  { href: "/apply/status", label: "Track Application" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          <span className="font-bold text-primary">{APP_NAME}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground hover:bg-background"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Staff Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/apply">Apply Now</Link>
          </Button>
        </div>

        <button
          className="md:hidden rounded-lg p-2 text-muted"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium hover:bg-background",
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
                  ? "text-primary bg-primary/10"
                  : "text-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href="/login">Staff Login</Link>
            </Button>
            <Button size="sm" className="flex-1" asChild>
              <Link href="/apply">Apply Now</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
