"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavHrefActive, navPageTabs, type NavItem } from "@/lib/navigation";

export function NavGroupTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const tabs = navPageTabs(pathname, items);
  if (tabs.length < 2) return null;
  const hrefs = tabs.map((tab) => tab.href);

  return (
    <nav
      aria-label="Section"
      className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
    >
      {tabs.map((tab) => {
        const active = isNavHrefActive(pathname, tab.href, hrefs);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "text-muted hover:bg-background hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
