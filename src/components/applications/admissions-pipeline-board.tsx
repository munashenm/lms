"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import {
  ADMISSIONS_PIPELINE_STAGES,
  ADMISSIONS_TERMINAL_STAGES,
  canAcceptOffer,
  canIssueOffer,
  canMarkDepositPaid,
} from "@/lib/admissions-pipeline";
import { formatDate, formatZAR } from "@/lib/utils";

type AppRow = {
  id: string;
  referenceNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  gradeApplied: string | null;
  courseApplied: string | null;
  status: string;
  submittedAt: string | Date;
  depositAmount: string | number | null;
  depositPaidAt: string | Date | null;
  depositWaivedAt?: string | Date | null;
  depositInvoiceId?: string | null;
  offerSentAt: string | Date | null;
  offerExpiresAt: string | Date | null;
  studentId: string | null;
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "secondary" | "default"> = {
  SUBMITTED: "default",
  UNDER_REVIEW: "warning",
  DOCUMENTS_OUTSTANDING: "warning",
  INTERVIEW_REQUIRED: "warning",
  ASSESSMENT_REQUIRED: "warning",
  WAITLISTED: "secondary",
  PROVISIONALLY_ACCEPTED: "success",
  OFFER_ISSUED: "success",
  DEPOSIT_PENDING: "warning",
  DEPOSIT_PAID: "success",
  ACCEPTED: "success",
  ENROLLED: "success",
  REJECTED: "danger",
  WITHDRAWN: "secondary",
};

export function AdmissionsPipelineBoard({ applications }: { applications: AppRow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [depositDraft, setDepositDraft] = useState<Record<string, string>>({});

  const columns = useMemo(() => {
    const stages = [...ADMISSIONS_PIPELINE_STAGES, ...ADMISSIONS_TERMINAL_STAGES];
    return stages.map((status) => ({
      status,
      items: applications.filter((a) => a.status === status),
    }));
  }, [applications]);

  async function patch(id: string, body: Record<string, unknown>) {
    setLoading(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Update failed");
      toast.success("Application updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <Card key={col.status} className="min-w-[260px] max-w-[280px] flex-shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span>{APPLICATION_STATUS_LABELS[col.status] ?? col.status}</span>
                <Badge variant="secondary">{col.items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {col.items.length === 0 ? (
                <p className="text-xs text-muted">No applications</p>
              ) : (
                col.items.map((app) => (
                  <div key={app.id} className="rounded-md border border-border p-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {app.firstName} {app.lastName}
                        </p>
                        <p className="text-xs text-muted">{app.referenceNo}</p>
                      </div>
                      <Badge variant={statusVariant[app.status] ?? "default"}>
                        {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {app.gradeApplied || app.courseApplied || "—"} · {formatDate(app.submittedAt)}
                    </p>
                    {app.depositAmount != null ? (
                      <p className="text-xs">
                        Deposit {formatZAR(Number(app.depositAmount))}
                        {app.depositPaidAt ? " · paid" : " · unpaid"}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {canIssueOffer(app.status) ? (
                        <>
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Deposit ZAR"
                            value={depositDraft[app.id] ?? ""}
                            onChange={(e) =>
                              setDepositDraft((prev) => ({ ...prev, [app.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            disabled={loading === app.id}
                            onClick={() =>
                              void patch(app.id, {
                                status: "OFFER_ISSUED",
                                depositAmount: Number(depositDraft[app.id] || 0),
                              })
                            }
                          >
                            Issue offer
                          </Button>
                        </>
                      ) : null}
                      {canMarkDepositPaid(app) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading === app.id}
                          onClick={() =>
                            void patch(app.id, {
                              status: app.status === "DEPOSIT_PENDING" ? "DEPOSIT_PENDING" : "OFFER_ISSUED",
                              markDepositPaid: true,
                            })
                          }
                        >
                          Record deposit payment
                        </Button>
                      ) : null}
                      {canMarkDepositPaid(app) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={loading === app.id}
                          onClick={() => {
                            const reason = window.prompt("Waiver reason (required for audit):");
                            if (!reason?.trim()) return;
                            void patch(app.id, {
                              status: "DEPOSIT_PAID",
                              waiveDeposit: true,
                              waiverReason: reason.trim(),
                            });
                          }}
                        >
                          Waive deposit
                        </Button>
                      ) : null}
                      {canAcceptOffer(app.status) || app.status === "DEPOSIT_PAID" ? (
                        <Button
                          size="sm"
                          disabled={loading === app.id}
                          onClick={() => void patch(app.id, { status: "ACCEPTED" })}
                        >
                          Accept & enrol
                        </Button>
                      ) : null}
                      {app.depositInvoiceId ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/admin/finance/invoices/${app.depositInvoiceId}`}>Deposit invoice</Link>
                        </Button>
                      ) : null}
                      {app.studentId ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/admin/students/${app.studentId}`}>Student</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}