"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openFinancePdf } from "@/lib/open-finance-pdf";

interface PaymentReceiptButtonProps {
  paymentId: string;
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
  label?: string;
}

export function PaymentReceiptButton({
  paymentId,
  variant = "outline",
  size = "sm",
  label = "Print receipt",
}: PaymentReceiptButtonProps) {
  const [loading, setLoading] = useState(false);

  async function printReceipt() {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/receipt`);
      await openFinancePdf(res, `payment-receipt-${paymentId.slice(-8)}.pdf`, "print");
    } catch {
      toast.error("Could not open receipt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={printReceipt} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
      {size !== "icon" && label}
    </Button>
  );
}
