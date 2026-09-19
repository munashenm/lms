"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openFinancePdf } from "@/lib/open-finance-pdf";

export function FeeStatementButton({
  studentId,
  label = "Print statement of account",
  size = "default",
}: {
  studentId?: string;
  label?: string;
  size?: "default" | "sm";
}) {
  const [loading, setLoading] = useState(false);

  async function printStatement() {
    setLoading(true);
    try {
      const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
      const res = await fetch(`/api/student-ledger/statement${qs}`);
      await openFinancePdf(res, "statement-of-account.pdf", "print");
    } catch {
      toast.error("Could not open statement of account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={printStatement} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      {label}
    </Button>
  );
}
