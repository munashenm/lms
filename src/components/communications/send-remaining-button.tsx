"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function SendRemainingButton({
  batchId,
  queuedCount,
}: {
  batchId: string;
  queuedCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function send() {
    setLoading(true);
    try {
      const res = await fetch(`/api/communications/${batchId}/process`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not send remaining notices");
        return;
      }
      toast.success(
        json.processed
          ? `Sent a batch of ${json.processed} remaining notices`
          : "No queued notices left to send"
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={loading} onClick={send}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Send remaining ({queuedCount})
    </Button>
  );
}
