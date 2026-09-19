"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ProfileTab = {
  id: string;
  label: string;
  hashes?: string[];
  content: React.ReactNode;
};

export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const tabKey = useMemo(() => tabs.map((tab) => tab.id).join("|"), [tabs]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const match = tabs.find((tab) => tab.id === hash || tab.hashes?.includes(hash));
      if (match) setActive(match.id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [tabKey, tabs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
              active === tab.id ? "border-primary text-primary" : "border-transparent text-muted"
            )}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} id={`profile-tab-${tab.id}`} hidden={active !== tab.id}>
          {active === tab.id ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
