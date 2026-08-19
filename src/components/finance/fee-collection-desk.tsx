"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentForm } from "@/components/finance/payment-form";
import { InvoicePdfButton } from "@/components/finance/invoice-pdf-button";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
} from "@/lib/finance";
import { formatDate, formatZAR } from "@/lib/utils";
import type { PublicFeeCollectionStudent } from "@/lib/fee-collection";

type ClassOption = { id: string; name: string; gradeName: string | null };

interface FeeCollectionDeskProps {
  schoolName: string;
  schoolLines: string[];
  classes: ClassOption[];
  invoiceHref: (id: string) => string;
  newInvoiceHref: string;
  initialStudentId?: string;
}

export function FeeCollectionDesk({
  schoolName,
  schoolLines,
  classes: initialClasses,
  invoiceHref,
  newInvoiceHref,
  initialStudentId,
}: FeeCollectionDeskProps) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>(initialClasses);
  const [students, setStudents] = useState<PublicFeeCollectionStudent[]>([]);
  const [hint, setHint] = useState<string | null>(
    "Search by admission number, ID number, name, or choose a class."
  );
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId ?? null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const selected = useMemo(
    () => students.find((row) => row.id === selectedId) ?? null,
    [students, selectedId]
  );
  const selectedInvoice = selected?.invoices.find((row) => row.id === invoiceId) ?? null;

  async function search(opts?: { studentId?: string; nextQuery?: string; nextClassId?: string }) {
    const q = opts?.nextQuery ?? query;
    const nextClassId = opts?.nextClassId ?? classId;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (nextClassId) params.set("classId", nextClassId);
      if (opts?.studentId) params.set("studentId", opts.studentId);
      const res = await fetch(`/api/finance/fee-collection?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Search failed");
      const rows = (data.students ?? []) as PublicFeeCollectionStudent[];
      setClasses(data.classes ?? []);
      setStudents(rows);
      setHint(data.message ?? (rows.length === 0 ? "No matching learners found." : null));
      if (opts?.studentId && rows[0]) {
        setSelectedId(rows[0].id);
        setInvoiceId(rows[0].invoices[0]?.id ?? null);
      } else if (rows.length === 1) {
        setSelectedId(rows[0].id);
        setInvoiceId(rows[0].invoices[0]?.id ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialStudentId) return;
    void search({ studentId: initialStudentId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudentId]);

  function pickStudent(student: PublicFeeCollectionStudent) {
    setSelectedId(student.id);
    setInvoiceId(student.invoices[0]?.id ?? null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{schoolName}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted space-y-1">
          {schoolLines.length === 0 ? (
            <p>School details will print on the invoice header and footer.</p>
          ) : (
            schoolLines.map((line) => <p key={line}>{line}</p>)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find learner</CardTitle>
          <p className="text-sm text-muted">
            Search by admission number, ID number, first or last name, or class.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="fee-search">Admission no, ID, or name</Label>
              <Input
                id="fee-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. STD20260001, 8001015009087, Thabo Mokoena"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-class">Class</Label>
              <Select
                id="fee-class"
                value={classId}
                onChange={(e) => {
                  const next = e.target.value;
                  setClassId(next);
                  void search({ nextClassId: next });
                }}
              >
                <option value="">All classes</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.gradeName ? `${row.gradeName} · ${row.name}` : row.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Learners</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {students.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted text-center">
                {hint ?? "Search to list learners with outstanding invoices."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {students.map((student) => {
                  const active = student.id === selectedId;
                  return (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => pickStudent(student)}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-background/40 ${
                          active ? "bg-background/50" : ""
                        }`}
                      >
                        <p className="font-medium">
                          {student.lastName}, {student.firstName}
                        </p>
                        <p className="text-xs text-muted">
                          {student.studentNumber}
                          {student.grade ? ` · ${student.grade}` : ""}
                          {student.className ? ` · ${student.className}` : ""}
                          {student.identityNumber ? ` · ID ${student.identityNumber}` : ""}
                        </p>
                        <p className="text-xs mt-1">
                          Outstanding {formatZAR(student.outstandingTotal)}
                          {student.invoices.length === 0 ? " · no open invoices" : ""}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-3 space-y-6">
          {!selected ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted text-center">
                Select a learner to record a collection.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selected.firstName} {selected.lastName}
                  </CardTitle>
                  <p className="text-sm text-muted">
                    {selected.studentNumber}
                    {selected.grade ? ` · ${selected.grade}` : ""}
                    {selected.className ? ` · ${selected.className}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    Outstanding total:{" "}
                    <span className="font-semibold">{formatZAR(selected.outstandingTotal)}</span>
                  </p>
                  {selected.invoices.length === 0 ? (
                    <p className="text-sm text-muted">
                      No collectable invoices.{" "}
                      <Link href={newInvoiceHref} className="text-primary hover:underline">
                        Create an invoice
                      </Link>
                      .
                    </p>
                  ) : (
                    <div className="border border-border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted border-b border-border bg-background/50">
                            <th className="text-left px-3 py-2 font-medium">Invoice</th>
                            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Issued</th>
                            <th className="text-right px-3 py-2 font-medium">Outstanding</th>
                            <th className="text-left px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.invoices.map((invoice) => (
                            <tr
                              key={invoice.id}
                              className={`border-b border-border last:border-0 ${
                                invoice.id === invoiceId ? "bg-background/40" : ""
                              }`}
                            >
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="font-medium text-primary hover:underline"
                                  onClick={() => setInvoiceId(invoice.id)}
                                >
                                  {invoice.invoiceNumber}
                                </button>
                                <p className="text-xs text-muted">{invoice.description ?? "Fees"}</p>
                              </td>
                              <td className="px-3 py-2 hidden sm:table-cell text-muted">
                                {formatDate(invoice.issuedAt)}
                              </td>
                              <td className="px-3 py-2 text-right">{formatZAR(invoice.outstanding)}</td>
                              <td className="px-3 py-2">
                                <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
                                  {INVOICE_STATUS_LABELS[invoice.status]}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedInvoice ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <InvoicePdfButton
                      invoiceId={selectedInvoice.id}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={invoiceHref(selectedInvoice.id)}>Open invoice</Link>
                    </Button>
                  </div>
                  <PaymentForm
                    key={`${selectedInvoice.id}-${selectedInvoice.outstanding}`}
                    invoiceId={selectedInvoice.id}
                    invoiceNumber={selectedInvoice.invoiceNumber}
                    outstanding={selectedInvoice.outstanding}
                    onRecorded={() => void search({ studentId: selected.id })}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
