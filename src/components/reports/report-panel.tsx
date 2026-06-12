"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
}

interface ReportPanelProps {
  title: string;
  description: string;
  columns: Column[];
  rows: Record<string, string | number>[];
  exportType: string;
  summary?: { label: string; value: string }[];
}

export function ReportPanel({
  title,
  description,
  columns,
  rows,
  exportType,
  summary,
}: ReportPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/reports/${exportType}?format=csv`} download>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/reports/${exportType}?format=pdf`} download>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </a>
          </Button>
        </div>
      </div>

      {summary && summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summary.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted">{s.label}</p>
                <p className="text-lg font-bold mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 font-medium text-muted ${
                          col.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                        >
                          {row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
