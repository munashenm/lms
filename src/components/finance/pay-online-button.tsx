"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface PayOnlineButtonProps {
  invoiceId: string;
  outstanding: number;
}

export function PayOnlineButton({ invoiceId, outstanding }: PayOnlineButtonProps) {
  const [loading, setLoading] = useState(false);

  if (outstanding <= 0) return null;

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/gateway/payfast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!data.configured) {
        toast.info(data.message ?? "Online payments not configured yet");
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast.error("Could not initiate payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <CreditCard className="h-4 w-4 mr-2" />
      )}
      Pay Online (PayFast)
    </Button>
  );
}
