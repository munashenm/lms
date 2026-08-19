"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CurriculumStatusButtons({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(status: "PLANNED" | "CURRENT" | "COMPLETED") {
    setLoading(true);
    try {
      const res = await fetch(`/api/curriculum-topics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success("Topic updated");
      router.refresh();
    } catch {
      toast.error("Could not update topic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-1">
      <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setStatus("CURRENT")}>
        Current
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setStatus("COMPLETED")}>
        Done
      </Button>
    </div>
  );
}
