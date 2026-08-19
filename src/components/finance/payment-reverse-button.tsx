"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaymentReverseButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reverse() {
    if (!confirm("Reverse this receipt? The original receipt is kept and an audit reversal is posted to the ledger.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/reverse`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success("Payment reversed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reverse payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={reverse} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Reverse
    </Button>
  );
}
