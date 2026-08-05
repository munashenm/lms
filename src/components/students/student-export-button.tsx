"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentExportButtonProps {
  studentId: string;
}

export function StudentExportButton({ studentId }: StudentExportButtonProps) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={`/api/students/${studentId}/export`} download>
        <Download className="h-4 w-4 mr-2" />
        Export POPIA data
      </a>
    </Button>
  );
}
