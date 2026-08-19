"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR, formatDate } from "@/lib/utils";

const DOC_TYPES = [
  "ID_PASSPORT",
  "CONTRACT",
  "QUALIFICATION",
  "CERTIFICATE",
  "CV",
  "DISCIPLINARY",
  "POLICY_ACK",
  "OTHER",
];

export function EmployeeRecord(props: {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string | null;
    category: string;
    department: string | null;
    position: string | null;
    employmentType: string;
    status: string;
    bankName: string | null;
    bankAccountLast4: string | null;
  };
  salaryStructures: Array<{
    id: string;
    payType: string;
    baseSalary: unknown;
    hourlyRate: unknown;
    effectiveFrom: Date | string;
    effectiveTo: Date | string | null;
  }>;
  documents: Array<{
    id: string;
    type: string;
    title: string;
    fileUrl: string;
    expiresAt: Date | string | null;
  }>;
  entitlements: Array<{
    id: string;
    cycleYear: number;
    openingBalance: unknown;
    accrued: unknown;
    taken: unknown;
    leavePolicy: { name: string; leaveType: string };
  }>;
  contracts: Array<{
    id: string;
    title: string;
    startDate: Date | string;
    endDate: Date | string | null;
    notes: string | null;
  }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function changeSalary(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("salary");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/employees/${props.employee.id}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payType: form.get("payType"),
          baseSalary: Number(form.get("baseSalary") || 0),
          hourlyRate: form.get("hourlyRate") ? Number(form.get("hourlyRate")) : null,
          effectiveFrom: form.get("effectiveFrom"),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Salary change recorded");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save salary change");
    } finally {
      setLoading(null);
    }
  }

  async function uploadDocument(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("doc");
    const form = e.currentTarget;
    try {
      const res = await fetch(`/api/employees/${props.employee.id}/documents`, {
        method: "POST",
        body: new FormData(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Document uploaded");
      form.reset();
      router.refresh();
    } catch {
      toast.error("Could not upload document");
    } finally {
      setLoading(null);
    }
  }

  async function addContract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("contract");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/employees/${props.employee.id}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate") || null,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Contract recorded");
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not save contract");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {props.employee.firstName} {props.employee.lastName}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-muted">Number:</span> {props.employee.employeeNumber}</p>
          <p><span className="text-muted">Category:</span> {props.employee.category}</p>
          <p><span className="text-muted">Department:</span> {props.employee.department ?? "—"}</p>
          <p><span className="text-muted">Position:</span> {props.employee.position ?? "—"}</p>
          <p><span className="text-muted">Type:</span> {props.employee.employmentType}</p>
          <p><span className="text-muted">Status:</span> <Badge>{props.employee.status}</Badge></p>
          <p><span className="text-muted">Bank:</span> {props.employee.bankName ?? "—"} {props.employee.bankAccountLast4 ? `••••${props.employee.bankAccountLast4}` : ""}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Salary change</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changeSalary} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="payType">Pay type</Label>
              <select id="payType" name="payType" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="MONTHLY">Monthly</option>
                <option value="HOURLY">Hourly</option>
              </select>
            </div>
            <div><Label htmlFor="effectiveFrom">Effective from</Label><Input id="effectiveFrom" name="effectiveFrom" type="date" required /></div>
            <div><Label htmlFor="baseSalary">Base salary</Label><Input id="baseSalary" name="baseSalary" type="number" step="0.01" required /></div>
            <div><Label htmlFor="hourlyRate">Hourly rate</Label><Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading === "salary"}>Record change</Button></div>
          </form>
          <table className="w-full text-sm mt-6">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted">From</th>
                <th className="text-left py-2 font-medium text-muted">To</th>
                <th className="text-left py-2 font-medium text-muted">Type</th>
                <th className="text-right py-2 font-medium text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {props.salaryStructures.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="py-2">{formatDate(row.effectiveFrom)}</td>
                  <td className="py-2">{row.effectiveTo ? formatDate(row.effectiveTo) : "Current"}</td>
                  <td className="py-2">{row.payType}</td>
                  <td className="py-2 text-right">
                    {row.payType === "HOURLY"
                      ? `${formatZAR(Number(row.hourlyRate ?? 0))}/h`
                      : formatZAR(Number(row.baseSalary))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={uploadDocument} className="grid gap-4 sm:grid-cols-2 mb-6">
            <div><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
            <div>
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label htmlFor="expiresAt">Expires</Label><Input id="expiresAt" name="expiresAt" type="date" /></div>
            <div><Label htmlFor="file">File</Label><Input id="file" name="file" type="file" required /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading === "doc"}>Upload</Button></div>
          </form>
          <ul className="space-y-2 text-sm">
            {props.documents.length === 0 ? <li className="text-muted">No documents yet.</li> : null}
            {props.documents.map((doc) => (
              <li key={doc.id} className="flex justify-between gap-4">
                <a href={doc.fileUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  {doc.title} <span className="text-muted">({doc.type})</span>
                </a>
                {doc.expiresAt ? <span className="text-muted">Expires {formatDate(doc.expiresAt)}</span> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contracts</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addContract} className="grid gap-4 sm:grid-cols-2 mb-6">
            <div><Label htmlFor="contractTitle">Title</Label><Input id="contractTitle" name="title" required placeholder="Permanent educator" /></div>
            <div><Label htmlFor="contractStart">Start</Label><Input id="contractStart" name="startDate" type="date" required /></div>
            <div><Label htmlFor="contractEnd">End (optional)</Label><Input id="contractEnd" name="endDate" type="date" /></div>
            <div><Label htmlFor="contractNotes">Notes</Label><Input id="contractNotes" name="notes" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading === "contract"}>Save contract</Button></div>
          </form>
          <ul className="space-y-2 text-sm">
            {props.contracts.length === 0 ? <li className="text-muted">No contracts recorded.</li> : null}
            {props.contracts.map((row) => (
              <li key={row.id}>
                {row.title} · {formatDate(row.startDate)}
                {row.endDate ? ` – ${formatDate(row.endDate)}` : " – open"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leave balances</CardTitle></CardHeader>
        <CardContent>
          {props.entitlements.length === 0 ? (
            <p className="text-sm text-muted">No entitlements accrued yet. Balances are created when leave is requested against a policy.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted">Policy</th>
                  <th className="text-right py-2 font-medium text-muted">Opening</th>
                  <th className="text-right py-2 font-medium text-muted">Accrued</th>
                  <th className="text-right py-2 font-medium text-muted">Taken</th>
                  <th className="text-right py-2 font-medium text-muted">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {props.entitlements.map((row) => {
                  const remaining = Number(row.openingBalance) + Number(row.accrued) - Number(row.taken);
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="py-2">{row.leavePolicy.name} ({row.cycleYear})</td>
                      <td className="py-2 text-right">{Number(row.openingBalance)}</td>
                      <td className="py-2 text-right">{Number(row.accrued)}</td>
                      <td className="py-2 text-right">{Number(row.taken)}</td>
                      <td className="py-2 text-right font-medium">{remaining}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
