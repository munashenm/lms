"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IdCard, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentCardButtonProps {
  href: string;
  studentNumber: string;
  label?: string;
  hasPhoto?: boolean;
}

export function StudentCardButton({
  href,
  studentNumber,
  label = "Learner Card",
  hasPhoto,
}: StudentCardButtonProps) {
  const [loading, setLoading] = useState<"download" | "print" | null>(null);

  async function generate(mode: "download" | "print") {
    setLoading(mode);
    try {
      const res = await fetch(href);
      const errBody = await res.clone().json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof errBody?.message === "string" ? errBody.message : `Could not generate ${label.toLowerCase()}`
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (hasPhoto === false) {
        toast.message(`${label} uses initials until a JPEG or PNG photo is uploaded`);
      }
      if (mode === "print") {
        const win = window.open(url, "_blank");
        if (!win) {
          toast.error("Allow pop-ups to print the card, or use Download");
        } else {
          toast.success(`Opened ${label.toLowerCase()} for printing`);
        }
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${label.toLowerCase().replace(/\s+/g, "-")}-${studentNumber}.pdf`;
        a.click();
        toast.success(`${label} downloaded`);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not generate ${label.toLowerCase()}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => generate("download")} disabled={loading !== null}>
        {loading === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
        {label}
      </Button>
      <Button type="button" variant="outline" onClick={() => generate("print")} disabled={loading !== null}>
        {loading === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        Print
      </Button>
    </span>
  );
}
