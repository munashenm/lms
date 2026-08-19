"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IdCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentCardButtonProps {
  href: string;
  studentNumber: string;
  label?: string;
}

export function StudentCardButton({
  href,
  studentNumber,
  label = "Learner Card",
}: StudentCardButtonProps) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.toLowerCase().replace(/\s+/g, "-")}-${studentNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} downloaded`);
    } catch {
      toast.error(`Could not generate ${label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
      {label}
    </Button>
  );
}
