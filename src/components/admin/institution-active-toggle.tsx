"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InstitutionActiveToggle({
  schoolId,
  schoolName,
  isActive,
}: {
  schoolId: string;
  schoolName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !isActive;
    if (
      !next &&
      !window.confirm(
        `Deactivate “${schoolName}”? Users will be blocked from normal access. Data is retained — this is not a hard delete.`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/institutions/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Could not update institution");
        return;
      }
      toast.success(next ? "Institution reactivated" : "Institution deactivated");
      router.refresh();
    } catch {
      toast.error("Could not update institution");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "default"}
      size="sm"
      disabled={loading}
      onClick={toggle}
    >
      {loading ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
