# Finance + HR/Payroll — implementation plan

Inspected the existing SchoolHub SA LMS (Next.js App Router, Prisma/PostgreSQL, JWT RBAC, multi-tenant `schoolId`). This plan extends current modules. It does not replace invoices, the student ledger, fee reminders, payment gateways, leave requests, or staff attendance.

## Existing functionality to reuse

| Area | Reuse |
|---|---|
| Student billing | `Invoice`, `InvoiceLineItem`, `Payment`, student/parent fee portals, branded invoice PDF |
| Student ledger | `StudentLedgerEntry` already calculates balance from signed entries (CHARGE/PAYMENT/CREDIT/DISCOUNT/BURSARY/SPONSORSHIP/ADJUSTMENT/REFUND). **No mutable `student.balance` field exists.** |
| Fee catalogue | `FeeScheduleItem` stays as the public/simple list. Charging uses new `FeeStructure` rules. |
| Institution GL | `LedgerEntry` (INCOME/EXPENSE) — extended, not replaced |
| Payments | Cash/EFT/Card/PayFast/Ozow/Yoco + provider interface in `src/lib/payment-gateways` |
| Receipts | `generatePaymentReceiptPdf` — unique receipt numbers added on `Payment` |
| Statements | `generateFeeStatementPdf` |
| Enrolment | `ensureStudentEnrolment` — fee engine hooks after create/update |
| Academic structure | Grade, Class, Course, Module, AcademicYear, Term |
| HR today | `Teacher` (academic only), `LeaveRequest`, `StaffAttendanceRecord` (check-in/out) |
| Licensing | Feature flag `finance` already exists. Add `hr_payroll`. |
| Audit | `logAudit` |
| Tenancy | `getSchoolFilter` / `canAccessSchool` |

## New / extended database entities

Finance: `FeeStructure`, `StudentCharge`, `ChargeInstalment`, `PaymentAllocation`, `Supplier`, `ExpenseCategory`, `IncomeCategory`, `FinancialAccount`, `RecurringExpense`. Extend `Payment` (receipt no, reversal), `StudentLedgerEntry` (source, charge, reversal), `LedgerEntry` (supplier, VAT, account, payroll run, approval).

HR: `Employee` (all staff, optional link to `Teacher`/`User`), `EmploymentContract`, `SalaryStructure`, `LeavePolicy`, `LeaveEntitlement`, `EmployeeDocument`, `PayrollRuleSet`, `PayrollRun`, `PayrollItem`, `Payslip`.

## Permissions (teachers do not inherit finance/payroll)

`finance.view`, `finance.fees.manage`, `finance.payments.create`, `finance.payments.reverse`, `finance.receipts.view`, `finance.expenses.manage`, `finance.reports.view`, `hr.view`, `hr.employees.manage`, `hr.documents.manage`, `hr.leave.manage`, `hr.leave.approve`, `payroll.view`, `payroll.prepare`, `payroll.approve`, `payroll.finalise`.

Granted to Super Admin, School Admin, Finance Officer (finance only), and the new `HR_OFFICER` role (HR/payroll). Teachers keep academic + own leave/payslips only.

## Integrations

Registration → enrolment → fee engine (idempotent per student + fee + year) → invoice + ledger + instalments → payment (oldest instalment or manual) → receipt.

Employee → contract/salary/leave → payroll draft/calculate/approve/finalise → payslip PDF → `LedgerEntry` expense with `payrollRunId` (no double post).

## Licensing

`finance` and `hr_payroll` are separate licence flags. A smaller school can run Core LMS + Finance. A larger institution can add HR/Payroll (and later analytics/AI) without rewriting the product. `hr_payroll` defaults to off for new licences.

## Permissions

Teachers do not inherit finance or payroll access. Finance officers do not inherit payroll. HR officers do not inherit student billing writes.

## Student ledger

Balances are always the sum of `StudentLedgerEntry.signedAmount`. Payments, credit notes, bursaries and reversals append rows. Receipts are never deleted; reversals create a linked audit payment.

## Follow-on (this increment)

Leave remaining balances accrue from configurable `LeavePolicy.daysPerYear` (NONE / MONTHLY / YEARLY). Unpaid leave does not consume days. Approval increments `taken`; reject/cancel after approval restores it.

Employee documents upload under HR. Disciplinary files are hidden from the employee and from view-only roles.

Timesheets capture hours/overtime. Approved timesheets feed hourly payroll. Missing hours raise a payroll exception instead of inventing pay.

Recurring expenses generate draft/pending expenses (`POST /api/cron/recurring-expenses` with `CRON_SECRET`, or Finance “Generate due now”). Credit notes, refunds and bursaries have a Finance adjustments screen.

Payroll run review lists exception notes. Salary changes are recorded on the employee record without logging amounts or full bank numbers.

Payroll statutory percents are versioned in `PayrollRuleSet` and edited in the payroll UI. Defaults stay at 0 until configured.

Manual, hostel and transport charges are created from `/finance/charges`. Instalment plans are created only when the instalment count is greater than 1. Draft expenses can be posted to the ledger later.

Employment contracts sit on the employee record. Clock/attendance punches import into draft timesheets through a generic punch payload (`POST /api/timesheets/from-clock`). Vendor-native biometric schemas are not invented.

Hostel and transport flags live on the enrolment (student create form and the student record). Matching fee structures auto-apply only when those flags are on. Finance can still apply an existing fee structure or reverse the unpaid remainder of a charge from `/finance/charges` without deleting receipts.

Student and parent fee portals show the instalment schedule. Recording a payment can allocate to specific instalments; otherwise the oldest outstanding instalment is used.

The HR dashboard lists pending leave, open timesheets and documents expiring in 90 days.
