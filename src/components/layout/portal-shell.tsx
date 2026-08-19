"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { SessionPayload } from "@/lib/auth";
import type { NavItem } from "@/lib/navigation";
import type { SessionOption } from "@/lib/academic-session-shared";
import type { EvaluatedLicense } from "@/lib/licensing/types";
import { LicenseStatusBanner } from "@/components/enterprise/license-banner";

interface PortalShellProps {
  user: SessionPayload;
  title?: string;
  navItems: NavItem[];
  portalLabel: string;
  sessions?: SessionOption[];
  viewSessionId?: string | null;
  license?: EvaluatedLicense | null;
  canManageLicense?: boolean;
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
  children,
}: PortalShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={navItems}
        portalLabel={portalLabel}
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
          {children}
        </main>
      </div>
    </div>
  );
}
