"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR } from "@/lib/utils";
import Link from "next/link";

const CATEGORIES = [
  "EDUCATOR", "PRINCIPAL", "DEPUTY_PRINCIPAL", "ADMINISTRATION", "FINANCE", "HR",
  "LIBRARIAN", "IT", "CLEANER", "SECURITY", "DRIVER", "MAINTENANCE", "MANAGEMENT", "OTHER",
];

export function EmployeeManager(props: {
  employees: Array<{
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    category: string;
    department: string | null;
    status: string;
    userId?: string | null;
    campus?: { name: string } | null;
    salaryStructures?: Array<{ baseSalary: unknown }>;
  }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email") || undefined,
          category: form.get("category"),
          department: form.get("department") || undefined,
          position: form.get("position") || undefined,
          employmentType: form.get("employmentType") || "PERMANENT",
          startDate: form.get("startDate") || undefined,
          baseSalary: form.get("baseSalary") ? Number(form.get("baseSalary")) : undefined,
          bankAccountNumber: form.get("bankAccountNumber") || undefined,
          bankName: form.get("bankName") || undefined,
          portalRole: form.get("portalRole") || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not create employee");
      toast.success(
        data.provision?.invitesSent
          ? "Employee created. Password setup email sent."
          : "Employee created"
      );
      e.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("Could not create employee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Add employee</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" required /></div>
            <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" required /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select id="category" name="category" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label htmlFor="department">Department</Label><Input id="department" name="department" /></div>
            <div><Label htmlFor="position">Position</Label><Input id="position" name="position" /></div>
            <div>
              <Label htmlFor="employmentType">Employment type</Label>
              <select id="employmentType" name="employmentType" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="PERMANENT">Permanent</option>
                <option value="CONTRACT">Contract</option>
                <option value="TEMPORARY">Temporary</option>
                <option value="PART_TIME">Part-time</option>
                <option value="HOURLY">Hourly</option>
              </select>
            </div>
            <div><Label htmlFor="startDate">Start date</Label><Input id="startDate" name="startDate" type="date" /></div>
            <div>
              <Label htmlFor="portalRole">Portal role</Label>
              <select id="portalRole" name="portalRole" className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                <option value="STAFF">Staff (self-service)</option>
                <option value="TEACHER">Teacher / lecturer</option>
                <option value="FINANCE_OFFICER">Finance officer</option>
                <option value="HR_OFFICER">HR officer</option>
                <option value="ADMISSIONS_OFFICER">Admissions officer</option>
              </select>
              <p className="text-xs text-muted mt-1">Used only when an email is provided. Privileged officer roles are never inferred from category.</p>
            </div>
            <div><Label htmlFor="baseSalary">Base salary (ZAR)</Label><Input id="baseSalary" name="baseSalary" type="number" step="0.01" /></div>
            <div><Label htmlFor="bankName">Bank</Label><Input id="bankName" name="bankName" /></div>
            <div><Label htmlFor="bankAccountNumber">Account number</Label><Input id="bankAccountNumber" name="bankAccountNumber" autoComplete="off" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={loading}>Save employee</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Department</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Salary</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Portal</th>
              </tr>
            </thead>
            <tbody>
              {props.employees.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{e.employeeNumber}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/hr/employees/${e.id}`} className="text-primary hover:underline">
                      {e.firstName} {e.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{e.category}</td>
                  <td className="px-4 py-3 text-muted">{e.department ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(Number(e.salaryStructures?.[0]?.baseSalary ?? 0))}</td>
                  <td className="px-4 py-3"><Badge variant={e.status === "ACTIVE" ? "success" : "secondary"}>{e.status}</Badge></td>
                  <td className="px-4 py-3 text-muted">{e.userId ? "Linked" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
