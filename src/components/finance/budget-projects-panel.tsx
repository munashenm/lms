"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatZAR } from "@/lib/utils";

type Budget = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  lines: Array<{ id: string; category: string; description: string | null; amount: string | number }>;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  targetAmount: string | number;
  amountRaised: string | number;
  status: string;
  _count?: { contributions: number };
};

export function BudgetProjectsPanel() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [bRes, pRes] = await Promise.all([
      fetch("/api/finance/budgets"),
      fetch("/api/finance/projects"),
    ]);
    const bData = await bRes.json();
    const pData = await pRes.json();
    if (bRes.ok) setBudgets(bData.budgets ?? []);
    if (pRes.ok) setProjects(pData.projects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // Defer so setState after fetch is not synchronous inside the effect body.
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function createBudget(form: HTMLFormElement) {
    const fd = new FormData(form);
    const name = String(fd.get("name") || "");
    const category = String(fd.get("category") || "General");
    const amount = Number(fd.get("amount") || 0);
    const res = await fetch("/api/finance/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        status: "ACTIVE",
        lines: [{ category, amount, description: String(fd.get("description") || "") }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Could not create budget");
      return;
    }
    toast.success("Budget created");
    form.reset();
    await refresh();
  }

  async function createProject(form: HTMLFormElement) {
    const fd = new FormData(form);
    const res = await fetch("/api/finance/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") || ""),
        description: String(fd.get("description") || ""),
        targetAmount: Number(fd.get("targetAmount") || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Could not create project");
      return;
    }
    toast.success("Finance project created");
    form.reset();
    await refresh();
  }

  async function contribute(projectId: string, form: HTMLFormElement) {
    const fd = new FormData(form);
    const res = await fetch("/api/finance/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contribute",
        projectId,
        amount: Number(fd.get("amount") || 0),
        payerName: String(fd.get("payerName") || ""),
        reference: String(fd.get("reference") || ""),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Could not record contribution");
      return;
    }
    toast.success("Contribution recorded");
    form.reset();
    await refresh();
  }

  if (loading) return <p className="text-sm text-muted">Loading budgets and projects…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New budget</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createBudget(e.currentTarget);
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="budget-name">Name</Label>
                <Input id="budget-name" name="name" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget-category">Category</Label>
                <Input id="budget-category" name="category" defaultValue="Operating" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget-amount">Amount (ZAR)</Label>
                <Input id="budget-amount" name="amount" type="number" min={0} step="0.01" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget-description">Description</Label>
                <Input id="budget-description" name="description" />
              </div>
              <Button type="submit">Create budget</Button>
            </form>
          </CardContent>
        </Card>
        {budgets.map((budget) => {
          const total = budget.lines.reduce((s, l) => s + Number(l.amount), 0);
          return (
            <Card key={budget.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {budget.name}{" "}
                  <span className="text-xs font-normal text-muted">({budget.status})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-semibold">{formatZAR(total)}</p>
                {budget.lines.map((line) => (
                  <p key={line.id} className="text-muted">
                    {line.category}: {formatZAR(Number(line.amount))}
                    {line.description ? ` — ${line.description}` : ""}
                  </p>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New finance project</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createProject(e.currentTarget);
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="project-name">Name</Label>
                <Input id="project-name" name="name" required placeholder="Grade 7 tour" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="project-target">Target (ZAR)</Label>
                <Input id="project-target" name="targetAmount" type="number" min={0} step="0.01" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="project-description">Description</Label>
                <Input id="project-description" name="description" />
              </div>
              <Button type="submit">Create project</Button>
            </form>
          </CardContent>
        </Card>
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {project.name}{" "}
                <span className="text-xs font-normal text-muted">({project.status})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Raised {formatZAR(Number(project.amountRaised))} of{" "}
                {formatZAR(Number(project.targetAmount))}
                {project._count ? ` · ${project._count.contributions} contributions` : ""}
              </p>
              {project.description ? <p className="text-muted">{project.description}</p> : null}
              {project.status === "OPEN" ? (
                <form
                  className="grid gap-2 sm:grid-cols-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void contribute(project.id, e.currentTarget);
                  }}
                >
                  <Input name="amount" type="number" min={0.01} step="0.01" placeholder="Amount" required />
                  <Input name="payerName" placeholder="Payer" />
                  <Input name="reference" placeholder="Reference" />
                  <Button type="submit" className="sm:col-span-3">
                    Record contribution
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}