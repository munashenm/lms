# SchoolHub SA — Complete Functional Capabilities Catalogue

**Cyber Developers · SchoolHub SA**  
https://www.cyberdevelopers.co.za  
**Source:** commit `ca8089b`, 9 October 2026  
**Companion:** [feature-verification-matrix.md](./feature-verification-matrix.md), [module-inventory.md](./module-inventory.md)

This catalogue lists what the software implements. Status words are defined in [README.md](./README.md). Items under “Planned or unavailable” must not be sold as working features.

---

## 1. Platform shape

- Multi-institution data. Each operational row is scoped to a school. Super Admin can cross institutions. Other roles cannot.
- Twelve roles: Super Admin, School Admin, Principal, Teacher/Lecturer, Learner, Parent/Guardian, Finance Officer, Admissions Officer, HR Officer, Staff, Security.
- Per-user permission grants and denies on top of the role.
- Modules can be disabled per school. A disabled module hides related permissions for non–Super Admin users.
- Terminology switches between school language and college language.
- Institution types: school, primary, high, combined, college, TVET, training centre, training institution.
- Curricula: CAPS, NSC, TVET/NQF, custom.
- Calendar structures: four terms, two semesters, custom.
- Time zone Africa/Johannesburg. Money in ZAR.
- Brand assets served from `/brand/logo.png` and `/brand/mark.png`.

**Authentication.** Email and password, session version for forced sign-out, invitation with temporary password, forced reset, forgot-password link, admin set-password for Super Admin and School Admin. School Admin cannot set a Super Admin password.

**Licence.** Signed licence check against the licence server. Statuses trial, active, grace, expired, suspended, revoked. Grace is 14 days. Heartbeat is automatic. Feature flags can turn commercial modules off.

---

## 2. Module catalogue

### Institution and identity

| Capability | Status | Notes |
|---|---|---|
| Admin dashboard | Implemented, not fully tested as a single production script | `/admin/dashboard` |
| School profile, province list, branding | Implemented and tested in settings tests | `/admin/settings` |
| Campuses | Implemented, not fully tested | No separate “departments” entity. Department is text on staff. |
| Academic sessions, terms, rollover | Implemented, not fully tested end to end | Rollover is staff-run |
| Grades, classes, subjects, courses, modules | Implemented | College labels differ |
| Users, invitations, role defaults | Implemented and tested in permission and mail tests | Delivery needs Resend or school SendGrid |
| Per-user grants and denies | Implemented and tested | `/admin/users/{id}/permissions` |
| Admin set password | Implemented and tested locally | On master via `#72`. Not a substitute for the invitation flow |
| Super Admin institutions | Implemented | Vendor only |

### Admissions

| Capability | Status | Notes |
|---|---|---|
| Public application form and status tracker | Implemented | `/apply`, `/{slug}/apply`, `/apply/status` |
| Staff pipeline with the statuses in the user manual | Implemented | Interview required is a status, not a scheduler |
| Application documents | Implemented | |
| Deposit invoice, paid flag, waiver | Implemented | Waiver needs `admissions.deposit_waive` |
| Create learner and enrolment on accept | Implemented | Grade or course name must match |
| Offer letters | Implemented as letters desk | Not auto-sent on status change |
| Interviews as appointments | Planned or unavailable | Status flag only |
| Automatic acceptance | Planned or unavailable | Staff set every status |

### Learner records

| Capability | Status | Notes |
|---|---|---|
| Registration, profile, guardians, documents | Implemented | |
| Statuses applicant through withdrawn | Implemented | |
| SA ID encryption and sensitive-field permission | Implemented | |
| Change log | Implemented | `StudentChangeLog` |
| Portal user link | Implemented, separate step | Learner row can exist without a login |
| Transfers | Partially implemented | Letters, status, and promotion outcome. No standalone transfer wizard that moves a learner between schools by itself |

### Teaching

| Capability | Status | Notes |
|---|---|---|
| Timetable with room, educator, meeting URL | Implemented | Join link is an external URL |
| Lesson plans and curriculum topics | Implemented | Completion is staff-updated |
| Class and session attendance | Implemented and tested in attendance areas | |
| Gate writes daily learner attendance | Implemented and covered by gate tests | Does not write period registers |
| Assessments and weighted marks | Implemented | Types listed in the user manual |
| Homework and submissions | Implemented | |
| Online exam attempt (MCQ, true/false, short answer) | Implemented | No proctoring |
| Report card PDF, skip rules, family notice | Implemented | Staff must issue |
| Certificates | Implemented | |
| Promotion rules and outcomes | Implemented | Staff confirm |
| Educator reviews by learners | Implemented | Licence feature defaults on |
| Hosted virtual classroom | Planned or unavailable | External URL only |
| AI marking or AI tutor | Planned or unavailable | `ai_features` defaults off and has no portal |

### Finance

| Capability | Status | Notes |
|---|---|---|
| Fee schedule, structures, charges, instalments | Implemented | |
| Invoices and PDFs | Implemented | Draft and cancelled reject collections |
| Manual collection, bank-reference duplicate check | Implemented | |
| Pending, verified, approved, rejected | Implemented | |
| Ledger, allocations, credit notes, aid | Implemented | |
| Debtors and age analysis | Implemented | On demand |
| Budgets and projects | Implemented on admin finance | |
| Expenses, suppliers, income, accounts | Implemented | |
| PayFast, Ozow, Yoco, Paystack settings | Requires configuration | Paystack is the current replacement path for the older PayPal method name |
| Gateway idempotency on reference | Implemented | |
| Receipt numbering after a normal first receipt | Implemented | |
| Reversal of a referenced payment | Partially implemented | Defect. Not production-ready |
| Receipt number after `-REV` or `-R` | Partially implemented | Defect. Not production-ready |
| Concurrent approval lock | Partially implemented | Status check is not row-locked |
| Automatic fee reminders | Partially implemented | Rules and manual send exist. Daily job held |
| Automatic recurring expenses | Partially implemented | Definition exists. Daily job held |

### People

| Capability | Status | Notes |
|---|---|---|
| Employee file, contract, documents, salary structure | Implemented | |
| Staff attendance including remote and on-leave | Implemented | Gate can stamp check-in and check-out |
| Leave requests, policies, entitlements | Implemented | |
| Monthly leave accrual job | Partially implemented | Route exists. Scheduler held |
| Timesheets | Implemented | |
| Payroll prepare, approve, finalise, payslip PDF | Implemented | Finalise can post to finance once |
| Biometric clock import | Planned or unavailable | Explicitly not implemented |

### Communication and website

| Capability | Status | Notes |
|---|---|---|
| Announcements with audiences | Implemented | |
| Internal messages | Implemented | Security has no mailbox |
| In-app notifications | Implemented | |
| Platform email via Resend | Requires configuration | Acceptance is not inbox delivery. No webhook |
| School SendGrid | Requires configuration | Used only when enabled, keyed, and From is deliverable |
| SMS via Twilio | Requires configuration | Licence feature defaults off |
| Bulk fee email/SMS | Requires configuration | Manual |
| Public website, gallery, FAQ, admissions copy | Implemented | |
| WhatsApp click-to-chat on the public site | Requires configuration | Number on the school profile. No inbox |
| WhatsApp messaging product | Planned or unavailable | Flag defaults off |

### Campus access

| Capability | Status | Notes |
|---|---|---|
| Gates, policy, day boundary, duplicate window | Implemented and tested | |
| Cards for learners and staff, deactivate | Implemented | Admin issue. Security scans |
| QR, barcode, camera, manual scan | Implemented and tested | |
| RFID/NFC as a method name resolved to a person | Partially implemented | No device fleet certified in this review |
| Biometric capture | Planned or unavailable | Request is rejected |
| Visitors book, expected visitors, sign-out | Implemented | |
| On site and missing checkout | Implemented and tested | Prior-day IN is missing, not still on site |
| Early departure reasons | Implemented | Parent approval workflow for early release is reserved, not the security desk’s current path |
| Gate incidents list | Implemented, not fully tested as a case system | |
| Security role isolation | Implemented in middleware and tests | Live college account first login not completed |
| Parent SMS on gate scan | Planned or unavailable | Not part of the scan |

### Platform operations

| Capability | Status | Notes |
|---|---|---|
| Audit log | Implemented | |
| Compliance exports: SA-SAMS package, LURITS promotion, CEMIS marks | Implemented, not fully tested against a department portal | Staff-run |
| SA-SAMS staging, map, execute, rollback | Implemented | |
| Import staging cleanup job | Partially implemented | Held |
| Backup create, download, restore | Implemented | Restore is destructive |
| Scheduled backups | Partially implemented | Held |
| Licence heartbeat | Implemented and tested | Automatic, due-only |
| System health job panel | Implemented | Super Admin |
| POPIA field controls and redacted mail logs | Implemented | Not a compliance certificate |
| Library catalogue | Planned or unavailable | Flag defaults off |
| Public API for third parties | Planned or unavailable | `api_access` defaults off |
| Advanced analytics product | Planned or unavailable | Flag defaults off |

---

## 3. Automation, stated exactly

| Chain | What the software does without a person clicking | What still needs a person |
|---|---|---|
| Application to learner | On Accepted or Enrolled, creates or links the learner and enrols them when names match and the deposit rule allows | Every status before that, including interview and offer |
| Enrolment to class | Stores the enrolment | Class placement and timetable slots |
| Timetable to learner | Shows slots and an external meeting link | Building the timetable |
| Marks to report | Calculates averages when staff issue the card | Issuing the card |
| Invoice to gateway receipt | After the provider confirms, locks the invoice, records the payment, updates the balance, allocates, and writes the ledger | Gateway keys, and the payer completing the hosted page |
| Manual receipt | Allocates and writes the ledger when the payment is approved or captured as approved | The cashier, and verification for pending methods |
| Balance to debtor list | Ageing reads current balances | Opening the report, and any reminder send |
| Gate to daily attendance | Recorded learner IN/OUT updates the daily row in the same transaction | Card issue, and any period register |
| Gate to staff time | Recorded staff movement can set check-in and check-out | Payroll |
| Employee to pay | Nothing | Prepare, approve, finalise |
| Clock to backups | Nothing automatic | Backup screen, or a future reviewed scheduler |
| Clock to fee reminders | Nothing automatic | Manual send |
| Clock to licence | Heartbeat when due | Licence server availability |

---

## 4. Integrations

| Integration | Direction | Status |
|---|---|---|
| Resend | Platform transactional email | Requires configuration. Official `resend` package |
| SendGrid | Optional per-school email | Requires configuration. Disabled school config does not block Resend |
| Twilio | SMS | Requires configuration and licence |
| Paystack, PayFast, Ozow, Yoco | Hosted fee collection | Requires configuration per school |
| Licence server | Signed licence check | Required for ongoing verification |
| SA-SAMS file | Import and export package | Staff-run |
| LURITS / CEMIS | Export files | Staff-run |
| WhatsApp | Public click-to-chat link | Optional number |
| Biometric terminals | — | Unavailable |
| Resend webhooks | Delivery events | Unavailable |

Secrets are encrypted on the school integration record. Screens return configured, sender validity, and provider name. They must not display API keys. This catalogue does not contain any key.

---

## 5. Background work

In-process scheduler, started from `instrumentation.ts` on the Node.js runtime, without blocking server startup. A database lease (`scheduler_job_states`) stops two replicas doing the same job. Lease failure is logged and does not crash the process.

Automatic: `license-heartbeat` at 15:00 UTC.

Held: `backups`, `fee-reminders`, `import-cleanup`, `leave-accrual`, `recurring-expenses`.

Protected HTTP routes under `/api/cron/*` remain for an operator who presents the cron secret. Query-string secrets are not accepted.

---

## 6. Generated documents

Invoice PDF, receipt PDF, report card PDF, certificate PDF, official letter PDF, payslip PDF, identity card, compliance export files, backup archive. All are on demand except where a payment post or report issue creates the file as part of that action.

---

## 7. API surface

212 route modules live under `src/app/api`. The file list is [appendix-api-routes.txt](./appendix-api-routes.txt). 213 pages are listed in [appendix-pages.txt](./appendix-pages.txt). Those lists were generated from the source tree at this commit. They are the inventory. They are not a public API contract. `api_access` is off by default and these routes are the application’s own UI backend.

---

## 8. Tests that support this catalogue

Automated tests cover permissions, licensing, the public licence check, mail provider selection, the scheduler lease and due-only heartbeat, gate behaviour, school branding, and settings, among other suites. A full run during the audit passed 437 tests and failed 1: `tests/teacher-classes.test.ts` still expects the educator groups “Classwork” for attendance and assessments, while the menu uses “Daily”. The menu is the product.

Payment reversal and receipt regeneration after a suffix do not have tests that would catch the defects in [known-defects-for-remediation.md](./known-defects-for-remediation.md). That absence is why those features are not marked production-ready.
