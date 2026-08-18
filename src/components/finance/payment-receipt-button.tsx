"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentReceiptButtonProps {
  paymentId: string;
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
  label?: string;
  canEmail?: boolean;
}

export function PaymentReceiptButton({
  paymentId,
  variant = "outline",
  size = "sm",
  label = "Receipt",
  canEmail = false,
}: PaymentReceiptButtonProps) {
  const [loading, setLoading] = useState<"download" | "email" | null>(null);

  async function download() {
    setLoading("download");
    try {
      const res = await fetch(`/api/payments/${paymentId}/receipt`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payment-receipt-${paymentId.slice(-8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download receipt");
    } finally {
      setLoading(null);
    }
  }

  async function email() {
    setLoading("email");
    try {
      const res = await fetch(`/api/payments/${paymentId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(data.message || "Receipt emailed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not email receipt");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={download}
        disabled={!!loading}
      >
        {loading === "download" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {size !== "icon" && label}
      </Button>
      {canEmail && (
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={email}
          disabled={!!loading}
        >
          {loading === "email" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {size !== "icon" && "Email"}
        </Button>
      )}
    </div>
  );
}
