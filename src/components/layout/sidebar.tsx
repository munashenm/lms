"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavHrefActive, navClusters, type NavItem } from "@/lib/navigation";
import { NavIcon } from "./nav-icon";
import { BrandMark } from "./brand-mark";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  portalLabel: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  schoolName?: string | null;
  logoUrl?: string | null;
}

function groupNav(items: NavItem[]) {
  const groups: { section?: string; sectionIcon?: NavItem["sectionIcon"]; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, sectionIcon: item.sectionIcon, items: [item] });
    }
  }
  return groups;
}

function NavItemList({
  items,
  pathname,
  allHrefs,
  collapsed,
  onClick,
  inset,
}: {
  items: NavItem[];
  pathname: string;
  allHrefs: string[];
  collapsed?: boolean;
  onClick: () => void;
  inset?: boolean;
}) {
  const clusters = navClusters(items);
  const showGroupLabels = clusters.some((cluster) => cluster.group) && clusters.length > 1;

  return (
    <>
      {clusters.map((cluster) => (
        <div key={cluster.group ?? cluster.items[0]?.href} className="space-y-0.5">
          {showGroupLabels && cluster.group ? (
            <p
              className={cn(
                "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40",
                inset && "pl-9"
              )}
            >
              {cluster.group}
            </p>
          ) : null}
          {cluster.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isNavHrefActive(pathname, item.href, allHrefs)}
              collapsed={collapsed}
              onClick={onClick}
              inset={inset}
            />
          ))}
        </div>
      ))}
    </>
  );
}
function NavLink({
  item,
  active,
  collapsed,
  onClick,
  inset,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
  inset?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={item.label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "lg:justify-center lg:px-0",
        inset && "pl-9",
        active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
      <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  open,
  onClose,
  navItems,
  portalLabel,
  collapsed = false,
  onToggleCollapsed,
  schoolName,
  logoUrl,
}: SidebarProps) {
  const pathname = usePathname();
  const groups = groupNav(navItems);
  const allHrefs = navItems.map((item) => item.href);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const [flyout, setFlyout] = useState<string | null>(null);

  function groupContainsActive(items: NavItem[]) {
    return items.some((item) => isNavHrefActive(pathname, item.href, allHrefs));
  }

  function isSectionOpen(section: string, items: NavItem[]) {
    if (section in manualOpen) return manualOpen[section];
    if (section === "Human Resource" || section === "Students") return true;
    return groupContainsActive(items);
  }

  function toggleSection(section: string, items: NavItem[]) {
    setManualOpen((current) => ({
      ...current,
      [section]: !isSectionOpen(section, items),
    }));
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-primary text-white transition-all duration-200 lg:static lg:translate-x-0",
          collapsed ? "lg:w-16" : "w-64",
          open ? "translate-x-0 w-64" : "-translate-x-full"
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "justify-between px-5")}>
          <div className={cn("flex items-center gap-2 min-w-0", collapsed && "lg:justify-center")}>
            {collapsed ? (
              logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 w-8 object-contain rounded bg-white/90 hidden lg:block" />
              ) : (
                <Building2 className="h-7 w-7 text-accent shrink-0 hidden lg:block" />
              )
            ) : null}
            <div className={cn(collapsed && "lg:hidden")}>
              <BrandMark logoUrl={logoUrl} name={schoolName} subtitle={portalLabel} inverted />
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {groups.map((group, index) => {
            const key = `${group.section ?? "root"}-${index}`;
            if (
              !group.section ||
              (group.items.length === 1 &&
                group.section !== "Human Resource" &&
                group.section !== "Students")
            ) {
              return (
                <div key={key} className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={isNavHrefActive(pathname, item.href, allHrefs)}
                      collapsed={collapsed}
                      onClick={onClose}
                    />
                  ))}
                </div>
              );
            }

            const expanded = isSectionOpen(group.section, group.items);
            const active = groupContainsActive(group.items);
            const accordion = (
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(group.section!, group.items)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <NavIcon name={group.sectionIcon ?? group.items[0].icon} className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{group.section}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded ? (
                  <NavItemList
                    items={group.items}
                    pathname={pathname}
                    allHrefs={allHrefs}
                    onClick={onClose}
                    inset
                  />
                ) : null}
              </div>
            );

            if (collapsed) {
              return (
                <div key={key}>
                  <div className="relative hidden lg:block">
                    <button
                      type="button"
                      title={group.section}
                      onClick={() => setFlyout((current) => (current === group.section ? null : group.section ?? null))}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg px-0 py-2.5 text-sm font-medium transition-colors",
                        active || flyout === group.section
                          ? "bg-white/15 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <NavIcon name={group.sectionIcon ?? group.items[0].icon} className="h-4 w-4" />
                    </button>
                    {flyout === group.section ? (
                      <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-lg border border-white/10 bg-primary py-2 shadow-xl">
                        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          {group.section}
                        </p>
                        <NavItemList
                          items={group.items}
                          pathname={pathname}
                          allHrefs={allHrefs}
                          onClick={() => {
                            setFlyout(null);
                            onClose();
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="lg:hidden">{accordion}</div>
                </div>
              );
            }

            return (
              <div key={key}>{accordion}</div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-2">
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden lg:flex w-full items-center justify-center rounded-lg px-2 py-2 text-white/60 hover:bg-white/10 hover:text-white"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          ) : null}
          <p className={cn("text-[10px] text-white/40 text-center", collapsed && "lg:hidden")}>
            © Cyber Developers
          </p>
        </div>
      </aside>
    </>
  );
}
