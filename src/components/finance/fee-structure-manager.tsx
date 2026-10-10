"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR } from "@/lib/utils";
import {
  BILLING_FREQUENCY_LABELS,
  chargeSourceLabel,
  periodCountFor,
  periodUnit,
  yearlySettlementAmount,
  type RecurringFrequency,
} from "@/lib/fee-pricing";

type FeeKind = "registration" | "grade" | "programme" | "course";

const KINDS: { value: FeeKind; label: string; hint: string }[] = [
  {
    value: "registration",
    label: "Registration",
    hint: "Charged once when the student is enrolled, for the whole enrolment.",
  },
  {
    value: "grade",
    label: "Grade",
    hint: "A fee for learners in one grade.",
  },
  {
    value: "programme",
    label: "Programme",
    hint: "A fee for students on one programme.",
  },
  {
    value: "course",
    label: "Course",
    hint: "A fee for one course inside a programme.",
  },
];

const CYCLES: { value: RecurringFrequency; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "YEARLY", label: "Yearly" },
];

export interface FeeStructureRow {
  id: string;
  name: string;
  chargeSource: string;
  amount: number;
  billingFrequency: string;
  allowInstalments: boolean;
  isActive: boolean;
  priceIsPerPeriod: boolean;
  invoiceYearly: boolean;
  yearlyDiscountPercent: number | null;
  gradeName: string | null;
  courseName: string | null;
  moduleName: string | null;
}

interface Lookup {
  id: string;
  name: string;
}

export interface CourseLookup extends Lookup {
  courseId: string;
  courseName: string;
}

const selectClass = "w-full h-10 rounded-md border border-border bg-background px-3 text-sm";

export function FeeStructureManager(props: {
  items: FeeStructureRow[];
  grades: Lookup[];
  courses: Lookup[];
  modules: CourseLookup[];
  years: Lookup[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FeeKind>("registration");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<RecurringFrequency>("MONTHLY");
  const [discount, setDiscount] = useState("");
  const [invoiceYearly, setInvoiceYearly] = useState(false);
  const [gradeId, setGradeId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");

  const recurring = kind !== "registration";
  const yearly = cycle === "YEARLY";
  const coursesForProgramme = props.modules.filter((mod) => !programmeId || mod.courseId === programmeId);
  const periodAmount = Number(amount);
  const discountPercent = discount === "" ? 0 : Number(discount);
  const periods = periodCountFor(cycle);
  const settlement = useMemo(() => {
    if (!recurring || !Number.isFinite(periodAmount) || periodAmount <= 0) return null;
    return yearlySettlementAmount(periodAmount, periods, yearly ? 0 : discountPercent);
  }, [recurring, periodAmount, periods, yearly, discountPercent]);

  function resetForm() {
    setKind("registration");
    setName("");
    setAmount("");
    setCycle("MONTHLY");
    setDiscount("");
    setInvoiceYearly(false);
    setGradeId("");
    setProgrammeId("");
    setModuleId("");
    setAcademicYearId("");
    setError(null);
  }

  async function createItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = buildPayload();
    try {
      const res = await fetch("/api/fee-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof body.message === "string" ? body.message : "Could not save fee structure";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Fee structure saved");
      resetForm();
      router.refresh();
    } catch {
      setError("Could not save fee structure");
      toast.error("Could not save fee structure");
    } finally {
      setLoading(false);
    }
  }

  function buildPayload() {
    const shared = {
      name,
      amount: Number(amount),
      academicYearId: recurring ? academicYearId || null : null,
      applyOnEnrolment: true,
    };
    if (kind === "registration") {
      return {
        ...shared,
        chargeSource: "REGISTRATION_FEE",
        billingFrequency: "ONCE",
        priceIsPerPeriod: false,
        invoiceYearly: false,
        yearlyDiscountPercent: null,
        gradeId: gradeId || null,
        courseId: programmeId || null,
        moduleId: null,
      };
    }
    if (kind === "grade") {
      return {
        ...shared,
        chargeSource: "GRADE_FEE",
        billingFrequency: cycle,
        priceIsPerPeriod: true,
        invoiceYearly: yearly ? false : invoiceYearly,
        yearlyDiscountPercent: yearly || discount === "" ? null : Number(discount),
        gradeId,
        courseId: null,
        moduleId: null,
      };
    }
    if (kind === "programme") {
      return {
        ...shared,
        chargeSource: "COURSE_FEE",
        billingFrequency: cycle,
        priceIsPerPeriod: true,
        invoiceYearly: yearly ? false : invoiceYearly,
        yearlyDiscountPercent: yearly || discount === "" ? null : Number(discount),
        gradeId: null,
        courseId: programmeId,
        moduleId: null,
      };
    }
    return {
      ...shared,
      chargeSource: "MODULE_FEE",
      billingFrequency: cycle,
      priceIsPerPeriod: true,
      invoiceYearly: yearly ? false : invoiceYearly,
      yearlyDiscountPercent: yearly || discount === "" ? null : Number(discount),
      gradeId: null,
      courseId: null,
      moduleId,
    };
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New fee structure</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createItem} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="fee-kind">Fee type</Label>
              <select
                id="fee-kind"
                className={selectClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as FeeKind)}
              >
                {KINDS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">{KINDS.find((item) => item.value === kind)?.hint}</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === "registration" ? "Student registration" : "Grade 10 tuition"}
              />
            </div>
            <div>
              <Label htmlFor="amount">
                {kind === "registration"
                  ? "Once-off amount (ZAR)"
                  : yearly
                    ? "Amount for the year (ZAR)"
                    : `Amount per ${periodUnit(cycle)} (ZAR)`}
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {recurring ? (
              <div>
                <Label htmlFor="billingFrequency">Paid</Label>
                <select
                  id="billingFrequency"
                  className={selectClass}
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value as RecurringFrequency)}
                >
                  {CYCLES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <Label htmlFor="registration-when">When it is charged</Label>
                <Input id="registration-when" value="Once, for the whole enrolment" readOnly />
              </div>
            )}

            {kind === "registration" && (
              <>
                <div>
                  <Label htmlFor="gradeId">Limit to grade (optional)</Label>
                  <select id="gradeId" className={selectClass} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                    <option value="">All grades</option>
                    {props.grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>{grade.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="programmeId">Limit to programme (optional)</Label>
                  <select id="programmeId" className={selectClass} value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
                    <option value="">All programmes</option>
                    {props.courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {kind === "grade" && (
              <div>
                <Label htmlFor="gradeId">Grade</Label>
                <select id="gradeId" className={selectClass} required value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                  <option value="">Choose a grade</option>
                  {props.grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>{grade.name}</option>
                  ))}
                </select>
              </div>
            )}

            {kind === "programme" && (
              <div>
                <Label htmlFor="programmeId">Programme</Label>
                <select id="programmeId" className={selectClass} required value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
                  <option value="">Choose a programme</option>
                  {props.courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
            )}

            {kind === "course" && (
              <>
                <div>
                  <Label htmlFor="programmeFilter">Programme</Label>
                  <select
                    id="programmeFilter"
                    className={selectClass}
                    value={programmeId}
                    onChange={(e) => {
                      setProgrammeId(e.target.value);
                      setModuleId("");
                    }}
                  >
                    <option value="">All programmes</option>
                    {props.courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="moduleId">Course</Label>
                  <select id="moduleId" className={selectClass} required value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                    <option value="">Choose a course</option>
                    {coursesForProgramme.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {programmeId ? mod.name : `${mod.courseName} · ${mod.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {recurring && (
              <div>
                <Label htmlFor="academicYearId">Academic year</Label>
                <select id="academicYearId" className={selectClass} value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
                  <option value="">Every year</option>
                  {props.years.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </select>
              </div>
            )}

            {recurring && !yearly && (
              <>
                <div>
                  <Label htmlFor="yearlyDiscount">Discount for paying the year (%)</Label>
                  <Input
                    id="yearlyDiscount"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <input
                    id="invoiceYearly"
                    type="checkbox"
                    className="mt-1"
                    checked={invoiceYearly}
                    onChange={(e) => setInvoiceYearly(e.target.checked)}
                  />
                  <Label htmlFor="invoiceYearly" className="font-normal leading-snug">
                    Invoice the yearly amount on enrolment
                    {settlement != null ? ` (${formatZAR(settlement)})` : ""}. Leave this off to bill each {periodUnit(cycle)} at the period price.
                  </Label>
                </div>
              </>
            )}

            {recurring && settlement != null && (
              <p id="yearly-settlement" className="sm:col-span-2 text-sm text-muted" role="status">
                {yearly || invoiceYearly
                  ? `Enrolment raises one invoice of ${formatZAR(settlement)}.`
                  : `${periods} payments of ${formatZAR(periodAmount)}. Paying the year up front is ${formatZAR(settlement)}${discountPercent > 0 ? ` after ${discountPercent}% discount` : ""}.`}
              </p>
            )}

            {error && (
              <p className="sm:col-span-2 text-sm text-danger" role="alert">{error}</p>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save structure"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Applies to</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Yearly</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => {
                const scope = scopeText(item);
                const periodsForItem = periodCountFor(item.billingFrequency);
                const perPeriod = item.priceIsPerPeriod && periodsForItem > 1;
                const yearlyAmount = perPeriod
                  ? yearlySettlementAmount(item.amount, periodsForItem, item.yearlyDiscountPercent)
                  : item.amount;
                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{chargeSourceLabel(item.chargeSource)}</Badge>
                      {scope ? <span className="ml-2 text-muted"> {scope}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {BILLING_FREQUENCY_LABELS[item.billingFrequency] ?? item.billingFrequency}
                      {item.invoiceYearly && perPeriod ? " · invoiced yearly" : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatZAR(item.amount)}
                      {perPeriod ? ` / ${periodUnit(item.billingFrequency)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {perPeriod ? (
                        <>
                          {formatZAR(yearlyAmount)}
                          {item.yearlyDiscountPercent ? (
                            <span className="block text-xs text-muted">{item.yearlyDiscountPercent}% off</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {props.items.length === 0 && (
            <p className="py-12 text-center text-muted text-sm">No fee structures yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function scopeText(item: FeeStructureRow): string | null {
  if (item.chargeSource === "MODULE_FEE") return item.moduleName;
  if (item.chargeSource === "COURSE_FEE") return item.courseName;
  if (item.chargeSource === "GRADE_FEE") return item.gradeName;
  const limits = [item.gradeName, item.courseName].filter(Boolean);
  return limits.length ? limits.join(" · ") : null;
}
