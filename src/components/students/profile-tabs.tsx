"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProfileTabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
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
        <div key={tab.id} hidden={active !== tab.id}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
