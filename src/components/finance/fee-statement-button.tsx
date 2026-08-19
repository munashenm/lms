"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeeStatementButton({
  studentId,
  label = "Download statement",
}: {
  studentId?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const qs = studentId ? `?studentId=${studentId}` : "";
      const res = await fetch(`/api/student-ledger/statement${qs}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fee-statement.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download statement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {label}
    </Button>
  );
}
