"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { SessionPayload } from "@/lib/auth";
import type { NavItem } from "@/lib/navigation";
import type { SessionOption } from "@/lib/academic-session-shared";
import type { EvaluatedLicense } from "@/lib/licensing/types";
import { LicenseStatusBanner } from "@/components/enterprise/license-banner";
import { NavGroupTabs } from "./nav-group-tabs";
import { schoolThemeCssVars, type SchoolPortalBrand } from "@/lib/school-branding";

const COLLAPSE_KEY = "schoolhub-sidebar-collapsed";

interface PortalShellProps {
  user: SessionPayload;
  title?: string;
  navItems: NavItem[];
  portalLabel: string;
  sessions?: SessionOption[];
  viewSessionId?: string | null;
  license?: EvaluatedLicense | null;
  canManageLicense?: boolean;
  branding?: SchoolPortalBrand | null;
  children: React.ReactNode;
}

export function PortalShell({
  user,
  title,
  navItems,
  portalLabel,
  sessions = [],
  viewSessionId = null,
  license = null,
  canManageLicense = false,
  branding = null,
  children,
}: PortalShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      className="flex h-screen overflow-hidden bg-background"
      style={schoolThemeCssVars(branding?.primaryColor, branding?.accentColor)}
    >
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={navItems}
        portalLabel={portalLabel}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        schoolName={branding?.schoolName}
        logoUrl={branding?.logoUrl}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          sessions={sessions}
          viewSessionId={viewSessionId}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <LicenseStatusBanner evaluation={license} canManage={canManageLicense} />
          <NavGroupTabs items={navItems} />
          {children}
        </main>
      </div>
    </div>
  );
}
