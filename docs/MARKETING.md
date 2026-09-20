# SchoolHub SA — Marketing Product Brief

**Product:** SchoolHub SA  
**Vendor:** Cyber Developers  
**Category:** School, college and training-centre management (SIS + LMS + finance + HR)  
**Market:** South Africa  
**Document use:** Website copy, proposals, SGB packs, tenders, partner one-pagers  
**Last updated:** September 2026

This brief describes **what is in the live product**. It is written for principals, school governing bodies, college directors, finance officers and resellers — not for developers.

---

## 1. One-line pitch

SchoolHub SA is a South African platform for **schools, colleges, TVETs and training centres**: admissions, teaching, family portals, the fee office and payroll in one login family.

## 2. Elevator pitch (30 seconds)

Most institutions still split work across a legacy LMS, Excel fee lists, paper registers and a report-collection queue. SchoolHub SA replaces that patchwork. Educators capture attendance and assessments once. Learners or students, and parents or sponsors, log in on a phone to see progress, homework, results and reports. The bursar collects cash or EFT at the desk against a real ledger. HR runs payslips in the same system. It is built for CAPS schools and TVET/college language, with POPIA-minded records, ZAR billing, and Johannesburg timezone throughout.

## 3. Who it is for

| Institution | How the product speaks to them |
|---|---|
| Independent and public **schools** (primary, high, combined) | Learners, grades, classes, terms, report cards, parent portal |
| **Colleges and TVETs** | Students, programmes, modules, semesters, lecturers |
| **Training centres** | Cohorts, courses, certificates of completion |
| **Multi-campus groups** | Super Admin licences, per-institution branding, module toggles |

**Buyers:** Principal / director, SGB or board, finance officer, IT / systems administrator.  
**Daily users:** School admin, admissions, teachers/lecturers, finance, HR, parents, learners.

## 4. Problems it replaces

| Today | With SchoolHub SA |
|---|---|
| Fees in a spreadsheet, receipts in a triplicate book | Collect desk, unique receipts, statements of account, debtors |
| Families only see results on collection day | Parent/sponsor and learner/student portals: attendance, homework, assessments, reports |
| Bulk photocopying of reports, registers and homework packs | PDFs on demand — print when someone asks |
| Teachers mark on paper, then recapture | Live registers, CAPS symbols, homework, report-card PDFs |
| Payroll in a separate package | Employees, leave, timesheets, payslips in the same system |
| One shared admin login | Role-based portals (admin, teacher/lecturer, finance, HR, parent/sponsor, learner/student) |
| Lost application forms | Online apply with a public status tracker |

## 5. Product story (for a homepage)

**Headline:** One system for South African schools and colleges — from application to graduation.

**Subhead:** Families see attendance, assignments and results online. The office collects fees, cuts the photocopy bill, and pays staff. Built for POPIA, ZAR, CAPS and TVET.

**Primary CTA:** Book a demo  
**Secondary CTA:** See modules

---

## 6. Module catalogue (sales language)

Modules can be licensed and switched per school. Super Admin can enable or disable them without rebuilding the system.

### Admissions and the public school

- Public website (home, about, programmes, fees, news, calendar, gallery, contact)
- Online applications with a public status tracker
- Waitlist and admissions workflow for officers
- School-branded pages: logo, colours, principal’s message, campuses

### Learners and enrolment

- Learner / student records with SA ID and phone validation
- Admission numbers (auto `STD{year}####` when left blank)
- Grades, classes, courses and modules
- Academic sessions, terms or semesters, promotion and year-end rollover
- Learner identity card PDF
- Transfers and official letters
- POPIA consent tracking and learner data export

### Teaching and assessment

- Timetable with conflict checks and a “today” view
- Daily attendance registers (including sick), module registers, absence SMS
- Assessments, marks, CAPS 1–7 symbols
- Homework, study materials, submissions and grading
- Lesson plans and curriculum progress
- Online examinations
- Report cards, certificates and letters as branded PDFs
- Teacher reviews (where licensed)

### Parent and learner portals

- **Learner portal:** timetable, homework, attendance, exams, reports, certificates, fees, messages, leave, downloads
- **Parent portal:** linked children, fees (including Pay Online), attendance, results, homework, messages
- Document holds when fees are outstanding (reports/certificates released when the account is clear)

### Finance (fee office)

- Fee schedules and structures (grade, class, course, hostel, transport)
- Invoices with line items, discounts, scholarships and instalment plans
- **Collect fees desk** — search by admission number, ID or name; record cash, card or EFT
- Proof of payment, unique bank references, EFT verification and approval
- Overpayments become student credit (no silent “extra” on the invoice)
- **Print invoice**, **print receipt**, and **print statement of account** after collection
- Online pay: **PayFast** and **Paystack** (verified server-side; webhooks, not “trust the redirect”)
- Ozow and Yoco remain available where a school already uses them
- Debtors, fee reminders (before due / overdue rules), bulk statement email
- Expenses, suppliers, income, general ledger, credits, bursaries, refunds
- CSV / Excel / PDF finance reports
- Payments are never hard-deleted; reversals keep an audit trail

### People (HR and payroll)

- Staff directory and employee records
- Leave applications (sick-note upload), policies and entitlements
- Staff attendance and timesheets
- Payroll runs, statutory rule sets, branded payslips
- Teachers and staff see **their own** leave, attendance, timesheets and payslips — not the whole payroll file

### Communication

- Announcements / notice board
- Internal messaging with privacy controls and unread counts
- Email (SendGrid) and SMS (Twilio or a generic REST gateway)
- Automated fee reminders and absence notifications

### Campus operations

- Visitors book (sign-in / sign-out)
- Gate / security and biometrics as licensed add-ons (clock punches can feed timesheets; vendor-specific biometric hardware is integrated per project)

### Platform and trust

- Multi-school SaaS: each school’s data is isolated
- Super Admin: institutions, modules, roles and licences
- Encrypted backup and restore (password re-auth on restore)
- SA-SAMS import for migrating learner data
- Audit log (POPIA-minded) with CSV export
- Licence heartbeat with offline grace for load-shedding and poor connectivity

---

## 7. Portals at a glance

| Portal | Typical user | They can |
|---|---|---|
| Admin | School admin, principal | Run the school |
| Teacher / lecturer | Educators | Classes, marks, attendance, homework |
| Finance | Bursar / finance officer | Fees, collections, books |
| HR | HR officer | Employees, leave, payroll |
| Admissions | Admissions officer | Applications and enrolment |
| Parent | Guardian | Children, fees, results, messages |
| Learner / student | Enrolled person | Own academics and fees |
| Staff | Non-teaching staff | Own leave, timesheets, payslips, visitors |
| Super Admin | Cyber Developers / group IT | All schools, licences, modules |

---

## 8. South African differentiators (use these in tenders)

1. **Built for SA institutions, not adapted from a US SIS.** CAPS/NSC grades and TVET NQF programmes live in the same product, with the right words (learner vs student, term vs semester).
2. **ZAR and Johannesburg time** everywhere — invoices, payroll, reminders, collection timestamps.
3. **SA ID (13-digit Luhn) and local phone** validation on capture.
4. **POPIA-oriented records:** consent timestamps, audit logs, learner data export, no silent hard-delete of receipts.
5. **Parents pay the way they already pay:** PayFast, Paystack, EFT with proof of payment — not PayPal-first.
6. **SA-SAMS import** so a school is not trapped in a spreadsheet migration.
7. **Load-shedding reality:** licence offline grace, draft autosave on attendance and marks, encrypted backups.
8. **School-branded PDFs:** invoices, receipts, statements of account, report cards, certificates, payslips, learner cards.

---

## 9. Packaging (how to sell it)

Do not sell “all modules on day one” unless the school asks for it. Sell a core, then add.

| Package (suggested) | Includes | Typical buyer |
|---|---|---|
| **Core Campus** | Learners, academics, attendance, assessments, website, reports, backup | Small independent school |
| **Core + Family** | Core + parent portal + learner portal + SMS | Schools that need parent buy-in |
| **Core + Fees** | Core + finance, invoices, PayFast/Paystack, statements, debtors | Any school that bills fees |
| **Professional** | Family + Fees + HR/payroll + messaging | Growing independent / combined school |
| **College** | Professional + programmes/modules language + online exams + certificates | TVET / private college |
| **Group** | Multi-institution Super Admin, licence server, module control | School groups / vendor-hosted SaaS |

Licence features already exist for portals, finance, HR/payroll, SMS, reporting, visitors, messaging, online exams, biometrics, and more. Quote from the live licence sheet; do not promise WhatsApp, library or AI as standard — those flags are reserved for later or project work.

---

## 10. Competitive talk track

**Versus a legacy LMS**  
Faster, mobile-friendly, fee office and parent portal in the same login. Website and applications included. You are not paying a second vendor for “the new website”.

**Versus Excel + WhatsApp**  
Audit trail, unique receipts, EFT verification, statements of account, and parents who can pay online at 21:00 without calling the office.

**Versus an international SIS**  
Local payments, SA ID, CAPS symbols, SA-SAMS, POPIA export, and terminology that does not call a Grade 4 a “sophomore”.

**Versus stitching five apps**  
One tenancy, one backup, one set of roles. Finance cannot see payroll unless they are allowed to. Teachers cannot reverse fees.

---

## 11. Proof points for a proposal

- Role-based access: Super Admin, School Admin, Principal, Teacher, Student, Parent, Finance Officer, Admissions Officer, HR Officer, Staff.
- Server-side payment verification for PayFast ITN and Paystack (HMAC) — collections are not recorded from a browser “success” page alone.
- Student account balance is the ledger, not a number someone typed in a cell.
- Branded **Statement of Account** with debit, credit and running balance.
- Encrypted `.lmsbackup` packages; restore requires the acting user to re-enter their password.
- Public application reference that parents can look up without a staff login.

---

## 12. Website copy snippets (ready to paste)

**Hero**  
Run your South African school or college in one system — teaching, family portals, the fee office and payroll.

**Families**  
Learners and students, parents and sponsors, log in on a phone. Attendance, assignments, assessments, progress and reports — without a collection-day queue.

**Fee office**  
Collect cash or EFT at the desk against a real ledger. Unique receipts and a statement of account before the guardian leaves. Fewer disputes than a notebook.

**Paper**  
Registers, homework, report cards, invoices, letters and payslips as PDFs. Print on demand instead of a bulk run for every household.

**Educators**  
Mark the register, capture assessments, issue homework. Payslip and leave live in the same app — their own record only.

**Trust**  
POPIA-minded audit logs, SA ID validation, encrypted backups, written hosting SLA, and licences that still work when the line is down.

---

## 13. Demo script (20 minutes)

Ordered by what closes the sale. Campus extras after the office is sold.

1. Say schools **and** colleges; show terminology if a college tenant is available.  
2. Parent/sponsor or learner/student login → attendance, assignments, results (not Pay Online).  
3. Teacher/lecturer → register + a mark + timetable.  
4. Messages / announcement (not WhatsApp).  
5. Finance → collect by admission number → receipt + statement of account → SMS reminder.  
6. Paper: open a report PDF and an invoice PDF. “Print when asked.” Backup + cloud.  
7. Campus (pick what they asked for): student card PDF, certificate PDF, payroll payslip, leave apply/approve, visitors book.  
8. Trust: SA-SAMS import (schools) + written Cyber Developers SLA. Switch off modules they do not want.

---

## 13a. What helps close (use in proposals)

Ordered by what closes the sale. Lead with family and teaching. Campus extras after the office is sold.

**Must-win**
- **Family visibility:** attendance, homework, assessments and reports online — the reason SGBs buy, not a new homepage.
- **One capture:** educators do not recapture marks into Excel.
- **College-ready language:** student, lecturer, semester, module, sponsor.
- **Smoother communication:** announcements, in-system inbox, optional SMS — one record, not a public group. Not WhatsApp.
- **Fee collection at the institution:** search by admission number, cash/EFT with proof, unique receipts, statement of account, debtors. The ledger is the balance.
- **SMS + email fee reminders** (before due, on due, overdue) so families pay at the office before reports are held. Not WhatsApp.
- **Paper and staff time:** stop termly bulk report printing, triplicate receipt books, photocopied registers and homework packs. PDFs on demand.
- **Cloud-hosted:** browser access from campus or home. No school server under the desk.
- **Hosted document store:** homework, registration files and photos stay on the tenant — not a USB stick. (This is SchoolHub file storage, not a consumer Drive.)
- **Cloud backups** and encrypted `.lmsbackup` packages; restore re-asks the user’s password.

**Campus operations**
- **Learner / student identity cards** as branded PDFs from the profile.
- **Certificates** as branded PDFs (completion and similar), with optional fee hold.
- **Educator payroll** with digital payslips; teachers never see the full payroll file.
- **Leave:** staff apply in the portal; HR approves against policy; sick-note upload.
- **Visitors book:** sign-in / sign-out at reception. Biometrics remain a licensed add-on.

**Migrate / trust**
- **SA-SAMS import** for schools migrating records (not DBE filing).
- **Written Cyber Developers SLA** with hosting: named support, business-hours response, encrypted backups, load-shedding licence grace.

---

## 14. FAQ (sales)

**Is this only for schools?**  
No. The same product switches language for colleges and training centres (student/lecturer/semester/module).

**Can we keep our current website?**  
You can. SchoolHub also ships a CMS-style public site so applications, fees and news stay in sync with the office.

**Do parents need an app store download?**  
No. Portals are mobile-friendly in the browser.

**What about SA-SAMS?**  
Learner data can be imported. SchoolHub is not a replacement filing tool for DBE SA-SAMS submissions; it is the operational system of record for the institution.

**PayPal?**  
Not offered. South African collections use PayFast, Paystack, EFT and cash.

**Can a teacher see payroll?**  
No. Teachers see their own payslip and leave only.

**What if the internet drops?**  
Attendance and marks drafts autosave in the browser. Licences have an offline grace period. Take encrypted backups on a schedule.

**Is student data mixed between schools?**  
No. Each school is a tenant. Super Admin is the only role that spans institutions.

---

## 15. Words to use / avoid

| Use | Avoid |
|---|---|
| SchoolHub SA | “The LMS” as the only name |
| Learner *or* student (match the institution) | Mixing US grade names |
| Statement of account | “Account dump” |
| Collect fees | “POS” unless they asked for a till |
| PayFast and Paystack | Leading with PayPal |
| POPIA-minded / audit trail | Claiming a full legal POPIA certification unless you hold one |
| Encrypted backup | “We never lose data” |
| Optional modules | “Unlimited everything included” |

---

## 16. Related internal documents

| Document | Audience |
|---|---|
| [Sales one-pager](./SALES_ONE_PAGER.md) | Email attachments and SGB packs |
| [Project plan](./PROJECT_PLAN.md) | Delivery / implementation |
| [Finance & HR notes](./FINANCE_HR_PAYROLL.md) | Specialists |
| [Licensing, backup, SA-SAMS](./ENTERPRISE_LICENSING_BACKUP_SASAMS.md) | IT / hosting |
| [UI structure](./UI_STRUCTURE.md) | Design / brand |

**Vendor:** Cyber Developers · Proprietary © 2026
