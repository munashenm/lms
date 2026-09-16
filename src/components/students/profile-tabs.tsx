"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ProfileTabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      if (tabs.some((tab) => tab.id === hash)) {
        setActive(hash);
        return;
      }
      const el = document.getElementById(hash);
      const owner = tabs.find((tab) => {
        const panel = document.getElementById(`profile-tab-${tab.id}`);
        return Boolean(el && panel?.contains(el));
      });
      if (owner) setActive(owner.id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [tabs]);

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
          {tab.content}
        </div>
      ))}
    </div>
  );
}
