"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openFinancePdf } from "@/lib/open-finance-pdf";

interface InvoicePdfButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  label?: string;
  size?: "default" | "sm";
  variant?: "outline" | "default";
}

export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
  label = "Print invoice",
  size = "default",
  variant = "outline",
}: InvoicePdfButtonProps) {
  const [loading, setLoading] = useState(false);

  async function printInvoice() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      await openFinancePdf(res, `invoice-${invoiceNumber}.pdf`, "print");
    } catch {
      toast.error("Could not open invoice PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={printInvoice} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      {label}
    </Button>
  );
}
