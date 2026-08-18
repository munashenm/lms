"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoicePdfButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  canEmail?: boolean;
  size?: "default" | "sm";
  downloadLabel?: string;
}

export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
  canEmail = false,
  size = "default",
  downloadLabel = "Download PDF",
}: InvoicePdfButtonProps) {
  const [loading, setLoading] = useState<"download" | "email" | null>(null);

  async function download() {
    setLoading("download");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download invoice PDF");
    } finally {
      setLoading(null);
    }
  }

  async function email() {
    setLoading("email");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(data.message || "Invoice emailed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not email invoice");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={download}
        disabled={!!loading}
      >
        {loading === "download" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {downloadLabel}
      </Button>
      {canEmail && (
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={email}
          disabled={!!loading}
        >
          {loading === "email" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Email PDF
        </Button>
      )}
    </div>
  );
}
