"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PaymentReviewActions({
  paymentId,
  status,
  canApprove,
}: {
  paymentId: string;
  status: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  if (!canApprove) return null;
  if (status !== "PENDING" && status !== "VERIFIED") return null;

  async function run(action: "verify" | "approve" | "reject") {
    setLoading(action);
    try {
      const reason =
        action === "reject" ? window.prompt("Rejection reason") ?? "Rejected" : undefined;
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Update failed");
      toast.success(action === "approve" ? "Payment posted" : action === "verify" ? "Payment verified" : "Payment rejected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      {status === "PENDING" ? (
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => run("verify")}>
          Verify
        </Button>
      ) : null}
      <Button size="sm" disabled={loading !== null} onClick={() => run("approve")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => run("reject")}>
        Reject
      </Button>
    </div>
  );
}
