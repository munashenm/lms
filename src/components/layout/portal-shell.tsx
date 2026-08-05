"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { SessionPayload } from "@/lib/auth";
import type { NavItem } from "@/lib/navigation";
import type { SessionOption } from "@/lib/academic-session-shared";

interface PortalShellProps {
  user: SessionPayload;
  title?: string;
  navItems: NavItem[];
  portalLabel: string;
  sessions?: SessionOption[];
  viewSessionId?: string | null;
  children: React.ReactNode;
}

export function PortalShell({
  user,
  title,
  navItems,
  portalLabel,
  sessions = [],
  viewSessionId = null,
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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
