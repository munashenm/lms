"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { NavItem } from "@/lib/navigation";
import { NavIcon } from "./nav-icon";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  portalLabel: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function groupNav(items: NavItem[]) {
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }
  return groups;
}

export function Sidebar({
  open,
  onClose,
  navItems,
  portalLabel,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const groups = groupNav(navItems);

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
            <Building2 className="h-7 w-7 text-accent shrink-0" />
            <div className={cn(collapsed && "lg:hidden")}>
              <p className="text-sm font-bold leading-tight">{APP_NAME}</p>
              <p className="text-[10px] text-white/60 truncate">{portalLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-3">
          {groups.map((group, index) => (
            <div key={`${group.section ?? "root"}-${index}`} className="space-y-0.5">
              {group.section && !collapsed ? (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {group.section}
                </p>
              ) : null}
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "lg:justify-center lg:px-0",
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
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
