"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatZAR } from "@/lib/utils";
import {
  calculateEmployeePay,
  namedAmountText,
  namedMoneyLines,
  parseNamedAmountText,
  type PayrollRules,
} from "@/lib/payroll-engine";
import { PayBreakdown } from "@/components/hr/pay-breakdown";

export function SalaryPackageFields(props: {
  current?: {
    payType: string;
    baseSalary: unknown;
    hourlyRate: unknown;
    allowancesJson?: unknown;
    deductionsJson?: unknown;
  } | null;
  payrollRules?: PayrollRules;
}) {
  const current = props.current;
  const [payType, setPayType] = useState(current?.payType === "HOURLY" ? "HOURLY" : "MONTHLY");
  const [baseSalary, setBaseSalary] = useState(String(Number(current?.baseSalary ?? 0) || ""));
  const [hourlyRate, setHourlyRate] = useState(
    current?.hourlyRate != null ? String(Number(current.hourlyRate)) : ""
  );
  const [allowancesText, setAllowancesText] = useState(namedAmountText(namedMoneyLines(current?.allowancesJson)));
  const [deductionsText, setDeductionsText] = useState(namedAmountText(namedMoneyLines(current?.deductionsJson)));

  const preview = useMemo(
    () =>
      calculateEmployeePay(
        {
          payType: payType === "HOURLY" ? "HOURLY" : "MONTHLY",
          baseSalary: Number(baseSalary || 0),
          hourlyRate: hourlyRate ? Number(hourlyRate) : null,
          hoursWorked: payType === "HOURLY" ? 160 : undefined,
          allowances: parseNamedAmountText(allowancesText),
          extraDeductions: parseNamedAmountText(deductionsText),
        },
        props.payrollRules ?? {}
      ),
    [allowancesText, baseSalary, deductionsText, hourlyRate, payType, props.payrollRules]
  );

  return (
    <>
      <div>
        <Label htmlFor="payType">Pay type</Label>
        <select
          id="payType"
          name="payType"
          value={payType}
          onChange={(e) => setPayType(e.target.value)}
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="MONTHLY">Monthly</option>
          <option value="HOURLY">Hourly</option>
        </select>
      </div>
      <div>
        <Label htmlFor="effectiveFrom">Effective from</Label>
        <Input id="effectiveFrom" name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div>
        <Label htmlFor="baseSalary">Base salary (monthly)</Label>
        <Input
          id="baseSalary"
          name="baseSalary"
          type="number"
          step="0.01"
          min="0"
          required
          value={baseSalary}
          onChange={(e) => setBaseSalary(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="hourlyRate">Hourly rate</Label>
        <Input
          id="hourlyRate"
          name="hourlyRate"
          type="number"
          step="0.01"
          min="0"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="allowancesText">Allowances (one per line, e.g. Housing: 2000)</Label>
        <textarea
          id="allowancesText"
          name="allowancesText"
          rows={3}
          value={allowancesText}
          onChange={(e) => setAllowancesText(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Housing: 2000"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="deductionsText">Extra deductions (one per line, e.g. Staff loan: 500)</Label>
        <textarea
          id="deductionsText"
          name="deductionsText"
          rows={3}
          value={deductionsText}
          onChange={(e) => setDeductionsText(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Staff loan: 500"
        />
      </div>
      <div className="sm:col-span-2 rounded-md border border-border bg-background/50 p-4">
        <p className="text-sm font-medium mb-1">Estimated take-home</p>
        <p className="text-xs text-muted mb-3">
          Gross minus statutory rates{payType === "HOURLY" ? " (preview uses 160 hours)" : ""} and extra deductions.
          Payroll uses this same calculation when a run is calculated.
        </p>
        <p className="text-2xl font-semibold mb-3">{formatZAR(preview.netPay)}</p>
        <PayBreakdown
          earnings={preview.earnings}
          deductions={preview.deductions}
          employer={preview.employer}
          grossPay={preview.grossPay}
          totalDeductions={preview.totalDeductions}
          netPay={preview.netPay}
          employerContributions={preview.employerContributions}
        />
      </div>
    </>
  );
}
