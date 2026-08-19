"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintPageButton({ label = "Print / download" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}
