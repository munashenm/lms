# SchoolHub SA — Complete User Manual

**Cyber Developers**  
https://www.cyberdevelopers.co.za  
**Product:** SchoolHub SA — School Management for South Africa  
**Audience:** Super Administrators, school and college administrators, principals, admissions, educators, learners, parents and sponsors, finance, HR, general staff, and security  
**Source:** application source at commit `ca8089b`  
**Date:** 9 October 2026

This manual explains how to operate SchoolHub SA. It is an institution management platform: admissions, academic records, teaching, fees, people, communication, a public website, campus access, and platform administration live in one tenant per institution.

Read [known-defects-for-remediation.md](./known-defects-for-remediation.md) before training anyone on payments, automatic jobs, or the security desk. Those limits are repeated in the relevant chapters.

---

## 1. How to use this manual

Each module chapter states what the module does, who can open it, how to get there, how to complete the main task, what it connects to, what information it stores, what it can print or export, the operational problem it addresses, and what must be configured first.

**Screenshot placeholder.** Where a picture is needed, the manual uses this form:

> **Screenshot:** route · role · screen · action

Do not invent the picture. The matching row is in [screenshot-checklist.md](./screenshot-checklist.md).

### 1.1 Words the product changes by institution type

SchoolHub SA relabels the same screens for schools and for colleges or training centres.

| Idea | School | College, TVET, training centre |
|---|---|---|
| Person studying | Learner | Student |
| Caregiver account | Parent / Guardian | Sponsor |
| Teaching group | Class | Group |
| Level | Grade | Year of study |
| Learning item | Subject | Module |
| Educator | Teacher | Lecturer |
| Academic slice | Term | Semester |
| Fees label | School fees | Fees |
| Progress document | Reports | Reports |
| Identity card | Learner card | Student card |

Institution types in the database are School, Primary School, High School, Combined School, College, TVET, Training Centre, and Training Institution. Curriculum types are CAPS, NSC, TVET/NQF, and Custom. Academic structure is four terms, two semesters, or custom.

### 1.2 Signing in

1. Open the institution address. A campus site can be `/{school-slug}` with staff, learner, and parent or sponsor login links.
2. Shared login is `/login`. Learner login is `/student/login`. Parent or sponsor login is `/parent/login`.
3. Use the email address and password issued for that person.
4. If the account is flagged to reset its password, the only useful destination is `/account/password` until the change succeeds.
5. Forgotten passwords use `/forgot-password` and the emailed link `/reset-password`. The link host for the known production Railway name is rewritten to `https://app.schoolhubsa.co.za`. Other hosts follow the configured application URL.

> **Screenshot:** `/login` · any role · Sign-in screen · Show the email and password fields before signing in.

After sign-in the product opens that role’s home:

| Role | Home |
|---|---|
| Super Admin, School Admin, Principal | `/admin/dashboard` |
| Admissions Officer | `/admin/applications` |
| Teacher / Lecturer | `/teacher/dashboard` |
| Learner | `/student/dashboard` |
| Parent / Guardian | `/parent/dashboard` |
| Finance Officer | `/finance/dashboard` |
| HR Officer | `/hr/dashboard` |
| Staff | `/staff/leave` |
| Security | `/security` |

Security is sent away from admin, finance, HR, payroll, marks administration, and school settings. A disabled module hides the related menu entries for everyone except the Super Admin permission bypass on vendor checks.

### 1.3 Invitations and passwords

A School Admin creates a user and sends an invitation. The person receives a temporary password and must change it at first login when `mustResetPassword` is set. The product does not store the temporary password in the communication log; the log is redacted.

Super Admin and School Admin can set a password from **Admin → Users → Set password**. A School Admin can do this only for users at their own institution and cannot change a Super Admin password. The password is at least 8 characters, existing sessions are signed out, reset tokens are cleared, and an audit row records only whether the next login must change the password. The password itself is not written to the audit log or the API response.

Other roles cannot set another user’s password, even if they can edit users.

> **Screenshot:** `/admin/users` · School Admin · Users directory · Open Set password for a staff member at the same school.

Email delivery requires a configured provider. See Communication. If mail is not configured, the invitation is not delivered.

---

## 2. Roles and a normal day

Twelve roles exist. Super Admin permission checks succeed for every permission. Other roles can receive extra grants or denies on **Users → Permissions** (`/admin/users/{id}/permissions`). A deny wins.

### 2.1 Super Admin

Cyber Developers’ control account. Home: `/admin/dashboard`.

Can open every school function plus vendor tools: institutions, licensing, module switches, roles, and the licence server (customers, plans, issued licences). Can set any user’s password. Sees scheduled jobs on System Health.

**Daily work:** confirm institutions are licensed, review system health, and leave school operations to the school admin unless support is required.

> **Screenshot:** `/admin/institutions` · Super Admin · Institutions list · Show more than one institution.

### 2.2 School Admin

Runs one institution. Same operational menus as the principal’s broader admin shell, with write access to learners, staff, classes, attendance, marks, finance, HR, payroll, communication, visitors, gate administration, settings, backup, and SA-SAMS.

**Daily work:** open the dashboard, clear admissions and learner-leave queues, confirm registers and fee collections are moving, and answer messages.

Cannot change a Super Admin password. Cannot see another institution’s records.

### 2.3 Principal

Reads learners, staff, classes, attendance, marks, finance reports, HR, and payroll. Can write announcements and visitor records, read the gate, and read the audit log. Does not receive finance write, payroll finalise, or full settings write.

**Daily work:** dashboard, attendance overview, debtors or finance reports, announcements.

### 2.4 Admissions Officer

Home is the application queue. Can read and write learners, waive an admissions deposit, read reports, and work the visitors book. Does not run finance desks, payroll, or gate administration.

**Daily work:** move applications through review, documents, interview or assessment flags, offers, and enrolment.

### 2.5 Teacher / Lecturer

Home: `/teacher/dashboard`. Can read assigned learners and classes, mark the register, capture marks, create and grade homework, send messages, and post announcements. Also uses personal staff tools: own attendance, leave, payslips, and timesheets.

Does not open the finance office, payroll administration, user administration, or gate-card administration.

### 2.6 Learner

Sees own profile, documents, subjects or modules, timetable, lesson plans, curriculum progress, homework, attendance, examinations, results, reports, certificates, letters, fees, notices, messages, notifications, educator reviews, leave requests, downloads, and the academic calendar.

### 2.7 Parent / Guardian (or Sponsor)

Sees linked children only. Fees, attendance, assessments, messages, results, examinations, reports, materials, timetable, calendar, leave requests, notices, certificates, letters, and downloads.

A parent cannot open another family’s learner by typing an id. Unlinked requests are refused.

### 2.8 Finance Officer

Full fee, invoice, collection, expense, report, and approval permissions, plus learner read, deposit waiver, visitors, messages, and SMS send when SMS is configured. Personal staff tools sit in the same menu. Does not administer academics or users.

### 2.9 HR Officer

Employees, staff directory, attendance, leave, policies, timesheets, payroll, and HR reports, plus visitors and messages. Does not run the fee office.

### 2.10 Staff

A general employee. Visitor book, messages, own attendance, leave, timesheets, and payslips. No class register and no finance desk.

### 2.11 Security

Gate desk only: dashboard, scan, visitors, people currently on site, expected visitors, missing checkouts, incidents, and gate activity. Can record visitors and scans. Cannot issue cards, change gate policy, or open admin, finance, HR, payroll, marks, or school settings. Card administration stays with School Admin and Super Admin.

**Outstanding proof:** the college security invitation was accepted by the email provider. First login and the allow/deny walkthrough were not completed. Train security only after that check, or treat the chapter as implemented and not fully tested in production.

---

## 3. Institution management

### 3.1 Dashboard

**What it does.** Summarises the institution for administrators: counts and shortcuts into the work queues. It does not replace the specialist desks.

**Who.** Super Admin, School Admin, Principal. Admissions starts on applications. Other roles have their own homes.

**Path.** `/admin/dashboard`.

**Use.** Sign in and follow the cards into admissions, attendance, finance, or messages. Confirm the institution name and academic session are the ones you intend to edit.

**Connects to.** Every module that feeds a count.

**Solves.** A single morning view instead of opening separate spreadsheets.

> **Screenshot:** `/admin/dashboard` · School Admin · Admin dashboard · Land on the page after login.

### 3.2 School settings

**What it does.** Stores the institution profile: name, type, contact details, province, branding, terminology inputs, and integration settings.

**Who.** School Admin and Super Admin (`settings:write`). Principal can read settings.

**Path.** `/admin/settings`.

**Use.** Set the legal name, contact email, phone, physical address, province, website, and public WhatsApp number if the public site should show a chat link. Upload branding used on PDFs and the portal. Open integration settings on the same area to connect mail, SMS, and payment gateways.

**Information.** Institution profile and secrets for integrations. Secrets are stored encrypted and are not shown back in full.

**Configure first.** A School Admin must belong to one school. Super Admin selects the institution where the product asks for one.

**Limit.** `NEXT_PUBLIC_APP_URL` is a deployment setting, not a field on this screen. Changing it requires a rebuild before sitemap and licence domain text follow the new host.

> **Screenshot:** `/admin/settings` · School Admin · School settings · Show branding and contact fields.

### 3.3 Academic sessions, classes, subjects

**What it does.** Holds the year or session, terms or semesters, grades or years of study, classes or groups, subjects or modules, courses and programmes, and who teaches them.

**Who.** School Admin writes. Principal and educators read what they are allowed to see. Educators see **My classes** rather than the full setup desk.

**Paths.**

- Sessions and rollover: `/admin/academic`, `/admin/academic/rollover`
- Classes: `/admin/classes`
- Subjects: `/admin/subjects`
- Timetable: `/admin/timetable`

**Use.**

1. Create the academic session and mark one session active.
2. Add terms or semesters with dates.
3. Add grades or years, then classes or groups in those grades.
4. Add subjects or modules and attach them to classes with a teacher.
5. For a college, add programmes (courses) and modules, then enrol learners onto modules.

**Connects to.** Enrolment, registers, marks, timetable, report cards, promotion, and fee structures that target a grade or programme.

**Solves.** One register of “who is in which group this session” instead of a workbook per grade.

**Limit.** There is no separate Departments module. Department is a text field on staff and employee records.

> **Screenshot:** `/admin/academic` · School Admin · Academic sessions · Show a session with its terms or semesters.

### 3.4 Campuses

**What it does.** Optional sites under one institution. Visitors and some records can name a campus.

**Who.** School Admin, while editing school structure and visitors.

**Use.** Create a campus when one college has more than one site. Pick it when signing a visitor in.

**Limit.** Campuses are not separate licensed institutions. A second legal entity is a second institution, created by Super Admin.

### 3.5 Users, roles, and permissions

**What it does.** Creates portal accounts, assigns one role, optionally grants or denies individual permissions, sends an invitation, and lets Super Admin or School Admin set a password.

**Who.** School Admin and Super Admin.

**Paths.** `/admin/users`, `/admin/users/{id}/permissions`, `/admin/roles` (Super Admin).

**Use.**

1. Add the person with name, email, role, and school.
2. Send the invitation. Confirm mail is configured before relying on it.
3. If the person cannot receive mail, a School Admin or Super Admin may set a password and, if required, force a change at next login.
4. Open Permissions only when the role default is too wide or too narrow.

**Information.** Name, email, role, active flag, school, permission grants and denies, session version. Password hashes are stored. Passwords are never shown again.

**Connects to.** Every portal, audit log, invitations, and staff or learner profiles linked by user id.

**Solves.** One account per person, with a role that matches the job, instead of shared office logins.

> **Screenshot:** `/admin/roles` · Super Admin · Roles and permissions · Show the role list.

---

## 4. Admissions

**What it does.** Publishes an application form, tracks the file, stores documents, flags interviews or assessments, issues an offer, tracks a deposit, and can create the learner record when the offer is accepted or the status becomes enrolled.

**Who.** Admissions Officer, School Admin, Super Admin. Applicants use the public form without a staff login. Principal does not run the write queue.

**Paths.**

- Public form: `/apply` and `/{school-slug}/apply`
- Applicant tracker: `/apply/status`
- Staff queue: `/admin/applications`
- Public admissions page content: `/admin/website/admissions`
- Registration of a learner who did not apply online: `/admin/students/new`

**Statuses staff can set.** Submitted, Under review, Documents outstanding, Interview required, Assessment required, Waitlisted, Provisionally accepted, Offer issued, Deposit pending, Deposit paid, Accepted, Rejected, Enrolled, Withdrawn.

**How to process an application.**

1. The applicant completes the public form and uploads the documents the form asks for. They receive a way to check status.
2. Admissions opens the queue and moves the file to Under review.
3. If a document is missing, set Documents outstanding. The status text tells the applicant what to do next. The product does not book a calendar interview by itself. Interview required means staff will contact the applicant. There is no separate interview-scheduling module.
4. When the institution is ready, set Offer issued. If a deposit is required, the offer stays blocked from enrolment until the deposit is paid or waived by someone with `admissions.deposit_waive` (Admissions, Finance, School Admin, Super Admin, Principal).
5. On Accepted or Enrolled, if no learner is linked yet, the product creates the learner, allocates a student number, and enrols them into the active session when the applied grade or programme name matches an existing grade or course. Hostel and transport flags can be stored on that enrolment.
6. If the SA ID already belongs to a learner at that school, the application links to that learner instead of creating a second record.

**Information.** Names, contact details, grade or programme applied for, identity number, documents, status, deposit invoice, deposit paid or waived timestamps.

**Documents.** Offer and admission letters are produced from the letters desk (`/admin/letters`), not automatically at the moment of status change.

**Connects to.** Learner records, enrolment, fee deposits, the public website, and the audit log.

**Solves.** Paper application packs and a manual status board. Staff still decide every status. The product does not auto-accept anyone.

**Example.** A training centre publishes `/{slug}/apply`. An applicant chooses a programme. Admissions sets Offer issued. Finance raises or links the deposit. When the deposit is marked paid, admissions sets Accepted. The student record appears with a student number and an enrolment when the programme name matches.

> **Screenshot:** `/admin/applications` · Admissions Officer · Application queue · Open one application and show its status control.

> **Screenshot:** `/{school-slug}/apply` · public · Online application · Show the form before submit.

---

## 5. Learner and student records

**What it does.** The permanent record: identity, contacts, guardians, class, status, documents, change history, and links to attendance, marks, fees, and cards.

**Who.** School Admin and Admissions write. Educators read learners they teach. Learners see their own profile. Parents see linked children.

**Paths.** `/admin/students`, `/admin/students/new`, `/admin/students/{id}`, learner `/student/profile` and `/student/documents`.

**Statuses.** Applicant, Active, Suspended, Graduated, Withdrawn.

**Use.**

1. Register a walk-in learner at `/admin/students/new`, or arrive from an accepted application.
2. Attach guardians. Parent portal access is a user with the Parent role linked to those learners. Creating a learner does not automatically create a parent login.
3. Upload registration documents. SA ID values are handled with the institution’s encryption and hash fields. Staff need `students.emis_sensitive` to see sensitive EMIS-related values. That permission belongs to Super Admin and School Admin, not to educators.
4. Set the class or group for the active session.
5. Record a transfer or withdrawal through status, letters, and promotion outcomes. Letter types include transfer and related official letters on `/admin/letters`.

**Identity cards.** Cards are issued under Security administration (`/admin/security/cards`), not on the learner form alone. See chapter 12.

**Connects to.** Enrolment, register, marks, fees, gate, documents, and parent portal.

**Solves.** A second capture of the same child in a spreadsheet, a card file, and a fee book.

**Limit.** Learners created for gate demonstrations may have no portal user. A portal login is a separate user linked to the learner.

> **Screenshot:** `/admin/students/{id}` · School Admin · Learner profile · Show guardians, class, and status together.

---

## 6. Academic management

### 6.1 Programmes, courses, subjects, modules

**Paths.** `/admin/subjects` and the academic setup screens. College terminology shows programmes and modules.

**Use.** Define the curriculum structure before timetable and enrolment. A class subject row says which educator teaches which subject to which class.

**Connects to.** Timetable slots, assessments, enrolments, and report cards.

### 6.2 Timetable

**Path.** `/admin/timetable`. Educators, learners, and parents have read-only timetable pages.

**Use.** Add slots with day, start, end, room, subject or module, class, and educator. A slot may store an online meeting URL. The learner dashboard shows **Join online class** only when that URL exists. SchoolHub SA does not host the meeting.

**Solves.** Printed timetable clashes and “which room” questions.

> **Screenshot:** `/admin/timetable` · School Admin · Timetable editor · Show one week with a room and educator.

### 6.3 Academic calendar

**Paths.** `/admin/calendar` for staff events. Learners and parents use `/student/calendar` and `/parent/calendar`. The public site has `/calendar` when the website is published.

**Use.** Add school events and term dates. This is a calendar of events, not an automatic generator of teaching weeks.

### 6.4 Curriculum topics and lesson plans

**Educator paths.** `/teacher/curriculum`, `/teacher/lesson-plans`. Learners read `/student/lesson-plans` and `/student/progress`.

**Use.** The educator records topics and lesson plans. Progress shown to learners reflects published results and curriculum topic status. Nothing marks a topic complete because a lesson plan was saved. Staff update topic status.

---

## 7. Teaching and learning

### 7.1 Attendance

**What it does.** A class or daily register with Present, Absent, Late, Excused, and Sick.

**Who.** Educators write registers for their classes. Admins have `/admin/attendance` and `/admin/attendance/dashboard`. Learners and parents read.

**Educator path.** `/teacher/attendance`.

**Use.** Choose the class and date, mark each learner, and save. A second capture updates the same register rather than creating an uncontrolled duplicate for that session.

**Gate link.** A successful learner arrival at the gate can write the **daily** attendance row (`sessionKey` daily) as Present or Late, with arrival time, in the same transaction as the gate event. A failed attendance write rolls the gate event back. Period or subject registers are still marked by the educator. The gate does not know which lesson the learner attended.

**Staff.** Staff attendance is a different register (`/admin/staff-attendance`, `/hr/staff-attendance`, self-service `/staff/attendance`) with Present, Absent, Late, On leave, and Remote. A staff gate arrival can fill check-in, and departure can fill check-out.

**Solves.** Paper registers and end-of-day recapture. It does not remove the need for lesson attendance where the institution requires it.

> **Screenshot:** `/teacher/attendance` · Teacher · Class register · Mark one learner present and one absent.

### 7.2 Assessments and mark capture

**Paths.** `/teacher/assessments`, `/teacher/assessments/{id}`, admin `/admin/assessments`.

**Types.** Assignment, Test, Exam, Project, Practical, Oral.

**Use.** Create the assessment with a maximum mark, weight, subject, class, and term. Enter marks. Learners see results when the product’s publication rules for that screen allow it. Parents see linked children’s results on `/parent/results` and `/parent/assignments`.

**Connects to.** Report cards, which average captured marks. Promotion rules can read subject marks and attendance.

**Solves.** Mark books that are retyped into a report template.

### 7.3 Homework, materials, examinations

**Homework.** Educators use `/teacher/homework` and `/teacher/materials`. Admins have `/admin/homework`. Learners submit on `/student/assignments`. Submissions have their own status. Grading is an educator action (`homework.grade`).

**Online examinations.** A learner opens `/student/exams` and `/student/exams/{id}`. Question types implemented are multiple choice, true/false, and short answer. Attempts move from in progress to submitted. This is not a proctoring system. The licence feature key is `online_exams`. The module label “Online Classes” in the module list is the meeting-link behaviour, not a virtual classroom.

**Solves.** Loose worksheets and unmarked homework piles, for institutions that choose to collect work in the portal.

> **Screenshot:** `/student/assignments` · Learner · Homework list · Show an open assignment.

### 7.4 Report cards, promotion, certificates

**Report cards.** Staff issue them from `/admin/report-cards` and educators from `/teacher/report-cards`. Issuing builds a PDF from captured marks, stores a snapshot, and can notify the family. A batch skips a learner who already has a card for that year and term, or who has no marks. Symbols come from the percentage bands in the grading helper. Issuing is a staff action. Saving a mark does not publish a report by itself.

**Promotion.** `/admin/academic/promotion` and `/admin/academic/promotion/rules`. Rules can require a minimum mark or attendance. Outcomes are Promoted, Repeated, Progressed, Graduated, Completed, Transferred, Withdrawn, and Deferred. Staff confirm the outcome. The screen can show who meets the rule. It does not promote the whole school overnight.

**Rollover.** `/admin/academic/rollover` carries enrolments into the next session when staff run it. It is not part of the automatic scheduler.

**Certificates and letters.** `/admin/certificates` and `/admin/letters`. Learners and parents download issued copies from their portals. Letter types cover official correspondence such as offers and transfers. Staff choose the type and generate the PDF.

> **Screenshot:** `/admin/report-cards` · School Admin · Report cards · Start an issue for one class and term.

> **Screenshot:** `/admin/academic/promotion` · School Admin · Promotion · Show eligibility next to a confirm action.

---

## 8. Financial management

**Read this first.** Collection, invoicing, and statements exist and are used as operational screens. Reversal, receipt sequencing after a reversal, and concurrent approval are not production-ready. Train staff to record collections carefully and to avoid reversal until the remediation in [known-defects-for-remediation.md](./known-defects-for-remediation.md) is released. Do not promise that every gateway retry or reversal will balance the learner account.

**Who.** Finance Officer, School Admin, Super Admin. Principal can view reports. Learners and parents see their own invoices and receipts.

**Finance Officer paths** (School Admin has the same desks under `/admin/finance/…`):

| Task | Path |
|---|---|
| Overview | `/finance/dashboard` |
| Public fee amounts | `/finance/fee-schedule` |
| Fee structures | `/finance/structures` |
| Charges and instalments | `/finance/charges` |
| Invoices | `/finance/invoices`, `/finance/invoices/new`, `/finance/invoices/{id}` |
| Collect | `/finance/collect` |
| Payment list and verification | `/finance/payments` |
| Learner accounts | `/finance/student-accounts` |
| Debtors and age analysis | `/finance/debtors`, `/finance/debtors/age` |
| Reminders | `/finance/reminders` |
| Letters | `/finance/letters` |
| Expenses | `/finance/expenses` |
| Credits and aid | `/finance/adjustments` |
| Income, suppliers, accounts | `/finance/income`, `/finance/suppliers`, `/finance/accounts` |
| Ledger and reports | `/finance/ledger`, `/finance/reports` |

School Admin also has budgets and projects at `/admin/finance/budgets`.

### 8.1 Fee structures and charges

1. Enter amounts families should see on the public schedule, if you publish fees.
2. Build fee structures for a grade, programme, or year.
3. Raise charges against a learner. Charges can be split into instalments.
4. Generate or create an invoice. Draft and cancelled invoices do not take collections. Statuses then run Sent, Partially paid, Paid, and Overdue.

### 8.2 Collecting a payment

Methods include cash, EFT, bank deposit, card, PayFast, Ozow, Yoco, Paystack, mobile, scholarship, and other. PayPal remains a method name from an earlier model. The current gateway integration path is Paystack together with the hosted options configured per school. A gateway does nothing until that provider’s keys are saved and enabled.

**Manual collection.**

1. Open Collect fees and choose the invoice.
2. Enter the amount, method, date, and bank reference.
3. A duplicate bank reference at the same school is rejected.
4. Cash can be approved immediately. EFT and similar methods can stay Pending until a finance user verifies and approves them.
5. On approval the product adds the applied amount to the invoice, allocates it to the oldest open amounts unless staff picked instalments, writes the learner ledger, and can raise a credit note for a genuine overpayment.
6. The receipt number looks like `RCP-2026-00001`.

**Online payment.** A parent or learner can start a hosted payment from their invoice when a gateway is configured. A successful provider confirmation calls the gateway recorder, which locks the invoice, ignores a repeated reference, and then posts the ledger.

**Verification.** Pending → Verified → Approved, or Rejected. Only pending or verified payments can be approved. The approver needs `finance.payments.approve`.

**Receipts and statements.** Open the payment receipt or the invoice PDF. Learner accounts show the statement of charges, payments, and credits.

### 8.3 Debtors, reminders, expenses

Debtors and age analysis list who still owes money and how old the balance is. Staff open the report. It is not emailed by itself.

Fee reminder rules can target days before due, the due date, or days overdue, by email, SMS, or both. The rule screen exists. The daily job that would send them is **held**. Staff can send a bulk reminder from the communication tools when mail or SMS is configured. A reminder is a staff or manual-route action until that job is reviewed.

Expenses, suppliers, income categories, and financial accounts support the institution’s own books. Recurring expenses can be defined. The job that would create them each day is **held**.

### 8.4 What finance connects to

Admissions deposits, document release when fees block academic documents, parent and learner portals, and the audit log (`PAYMENT_RECEIVED`, `PAYMENT_CAPTURED`, `PAYMENT_APPROVED`, and related actions).

### 8.5 What it solves, and what it does not

It gives the bursar one invoice, one receipt sequence, and a statement families can open. It reduces a second cashbook for day-to-day collections.

It does not yet guarantee a safe reversal or a unique next receipt after a reversal. It does not post recurring expenses or fee reminders on a schedule.

> **Screenshot:** `/finance/collect` · Finance Officer · Collect fees · Record a cash amount against an invoice without submitting a real card number.

> **Screenshot:** `/finance/debtors/age` · Finance Officer · Age analysis · Show ageing bands.

---

## 9. Human resources and payroll

**Who.** HR Officer, School Admin, Super Admin. Principal can view. Every employee uses **My work** for their own attendance, leave, timesheets, and payslips.

**Paths.**

| Task | HR path | Admin path |
|---|---|---|
| Home | `/hr/dashboard` | `/admin/hr` |
| Staff directory | `/hr/staff` | `/admin/staff` |
| Employees | `/hr/employees`, `/hr/employees/{id}` | `/admin/hr/employees/{id}` |
| Attendance | `/hr/staff-attendance` | `/admin/staff-attendance` |
| Leave | `/hr/leave` | `/admin/leave` |
| Leave policies | `/hr/leave-policies` | `/admin/hr/leave-policies` |
| Timesheets | `/hr/timesheets` | `/admin/hr/timesheets` |
| Payroll | `/hr/payroll`, `/hr/payroll/{id}` | `/admin/payroll` |
| Reports | `/hr/reports` | `/admin/hr/reports` |
| Own payslip | `/staff/payslips`, `/staff/payslips/{id}` | same |

**Employee record.** Personal details, category, employment type, department text, contract, salary structure, and documents. Creating an employee does not create a payroll run.

**Leave.** Types and statuses are stored on requests. Policies and entitlements exist. Monthly accrual is a **held** scheduler job. HR approves or declines. Staff apply from `/staff/leave`. Learners and parents apply for learner absence on their own leave screens. Those requests are not staff leave.

**Timesheets.** Staff enter time. HR reviews. A clock helper can read staff attendance. It does not ingest a biometric clock vendor file. The product comment on clock payloads says vendor biometric schemas are not invented here.

**Payroll.** HR prepares a run, approves it, and finalises it. Those are separate permissions: `payroll.prepare`, `payroll.approve`, `payroll.finalise`. Finalising can post to finance. A run that is already posted cannot be posted again. Payslips are PDF documents. An employee sees their own payslip, not a colleague’s.

**Solves.** A leave file and a separate payslip template that is retyped each month, once HR maintains employees and salary structures.

**Limit.** Gate check-in can fill staff attendance times. It does not calculate pay. Pay needs a prepared and finalised run.

> **Screenshot:** `/hr/employees` · HR Officer · Employee directory · Open one employee.

> **Screenshot:** `/hr/payroll` · HR Officer · Payroll runs · Show prepare, approve, and finalise as separate steps.

---

## 10. Communication

**Channels that exist.** In-app notifications, announcements, internal messages, email, and SMS.

**Who.**

- Announcements: roles with `announcements:write` (admins, principal, educators).
- Messages: each portal’s Messages item. Learners, parents, educators, finance, and HR can send where `messaging.send` is granted. Security has no message desk. Their home is the gate.
- Email and SMS desks: `/admin/communications` and `/admin/sms`.
- Notices for families: `/student/announcements`, `/parent/announcements`.

**Email.** Platform mail uses Resend when `RESEND_API_KEY` and a real `RESEND_FROM_EMAIL` are set. A school may instead use its own SendGrid when that integration is enabled, the key is set, and the From address is deliverable. `noreply@schoolhub.local` is not a deliverable sender. If school SendGrid is disabled, the product falls through to Resend. It does not use a platform SendGrid environment variable as a third path.

A provider acceptance is stored as sent to the provider. It is not an inbox delivery. There is no Resend webhook in this version, so the product cannot mark a message delivered from a provider event.

Invitations and password resets are sent as sensitive mail. The stored log does not keep the password or the full body.

**SMS.** Twilio settings live on the school integration record. SMS sends only when the licence includes SMS and the provider is configured. The default licence leaves SMS off.

**WhatsApp.** The public website can show a click-to-chat link from a number stored on the school. That is not a WhatsApp business inbox. The licence flag `whatsapp` defaults to off and there is no conversation module.

**Fee communication.** Staff can send a bulk email or SMS about fees when the channel is configured. The unattended daily reminder job is held.

**Solves.** A notice that previously needed a paper circular, once families use the portal. Postal and SMS cost remain the institution’s, and only when those channels are turned on.

> **Screenshot:** `/admin/announcements` · School Admin · Announcements · Compose a notice and choose an audience.

> **Screenshot:** `/admin/communications` · School Admin · Email and SMS settings · Show provider status without revealing keys.

---

## 11. Website management

**What it does.** A public site for the institution: home, about, academics, programmes, admissions, fees, calendar, news, gallery, contact, and privacy.

**Who.** School Admin edits `/admin/website` and `/admin/website/admissions`. The public reads `/{school-slug}` and the shared public pages.

**Use.** Enter the story, contact details, gallery, FAQs, and admissions instructions. Publish fee schedule items marked public if families should see prices before they apply. The apply button leads to the application form.

**Connects to.** Admissions and the public fee schedule.

**Solves.** A separate brochure website that drifts away from the admission form.

**Limit.** This is an institution site inside SchoolHub SA, not a free-form web design tool.

> **Screenshot:** `/{school-slug}` · public · Institution home · Show the public header and an admissions link.

---

## 12. Security and access

**What it does.** Issues cards, defines gates and policy, scans people in and out, records visitors, and shows who is still on site.

**Who.**

| Person | Can |
|---|---|
| Security | Scan, visitors, on site, expected visitors, missing checkouts, incidents, activity |
| School Admin, Super Admin | All of the above plus gates, cards, gate settings, gate reports, and the admin visitors book |
| Principal | Read gate and reports, visitor read and write, no card administration |
| Finance, HR, Admissions, Staff | Visitors book where their menu includes it |

**Security paths.** `/security`, `/security/scan`, `/security/visitors`, `/security/on-site`, `/security/expected`, `/security/missing`, `/security/incidents`, `/security/activity`.

**Admin paths.** `/admin/security`, `/admin/security/gates`, `/admin/security/cards`, `/admin/security/settings`, `/admin/security/reports`, `/admin/visitors`.

**Cards.** A card has an opaque token, a holder (learner or staff), and a status (active or deactivated). Printing an identity card is an admin action. Security does not administer cards.

**Scan.** The desk accepts QR, barcode, or camera presentation of a card, and manual entry with a reason. RFID, NFC, and biometric method names exist on the scan contract. A body that contains a biometric template is rejected with “Biometric capture is not enabled.” Do not tell a school that fingerprint readers are supported.

**What a recorded arrival does.** For a learner, the daily attendance row can be set to Present or Late. For staff, check-in and check-out can be stored. Duplicate scans inside the policy window are stored as duplicates and do not double-count. Early departure asks for a reason: parent collection, medical, school activity, authorized leave, emergency, or other.

**On site and missing checkouts.** Someone is on site when their latest recorded movement is IN and the school day has not passed the day-boundary time (default 18:00 Africa/Johannesburg). A prior day’s unmatched IN becomes a missing checkout, not a person still on campus. Staff can reconcile a missing checkout with a reason.

**Visitors.** Sign-in captures identity type, host, purpose, and optional campus. Status moves through checked in and checked out. Expected visitors are those recorded ahead of arrival. A reference number is allocated per school and year.

**Incidents.** `/security/incidents` is the security note of gate exceptions. It is not a full case-management system.

**Solves.** A paper visitor book and an unknown answer to “who is still here?”. It does not replace a class register.

**Production limit.** The security user’s first login was not completed in the operational test. Card printing and scan behaviour are implemented in source and covered by gate tests. Treat the live security account as not fully tested until that walkthrough is done.

> **Screenshot:** `/security/scan` · Security · Gate check · Show a successful in scan with the person’s name. Use a test card, not a real child’s ID number.

> **Screenshot:** `/admin/security/cards` · School Admin · Access cards · Show issue and deactivate, with the token masked if it is visible.

---

## 13. Documents, reports, and compliance

**Documents.** `/admin/documents` stores files targeted at a school, grade, class, or learner. Learners use Download Centre (`/student/downloads`). Parents have the same idea on `/parent/downloads`.

**Reports.** `/admin/reports` and finance and HR report pages assemble operational lists: attendance, finance, and people. Exports depend on the report and on `finance.reports.export` where money is involved. These are on-demand reports. There is no unattended report emailer.

**Compliance centre.** `/admin/compliance` covers POPIA-oriented exports and the jobs for SA-SAMS packages, LURITS promotion files, and CEMIS marks. Generating a file is a staff action. The product records the export job. It does not file the pack with a department for you.

**SA-SAMS.** `/admin/integrations/sa-sams` and `/admin/integrations/sa-sams/{id}` import a package through staging, field mapping, and execute. Staff review errors before execute. Rollback exists as a permission (`sasams.rollback`). Expired staging files can be deleted by the import-cleanup job, which is **held**, or by a manual authorised call.

**Audit log.** `/admin/audit` is readable by Super Admin, School Admin, and Principal. Sensitive actions such as password set, payment, licence changes, and gate denials write rows. Password values are not stored in those rows.

**POPIA practice in the product.** SA ID material is encrypted at rest in the fields built for that purpose. Communication logs for invitations are redacted. Access to sensitive learner fields is a separate permission. This is a control set, not a legal opinion. The institution remains the responsible party for its own POPIA duties.

> **Screenshot:** `/admin/compliance` · School Admin · Compliance centre · Show export types without downloading personal data into the picture.

> **Screenshot:** `/admin/audit` · Principal · Audit log · Show action names with no secrets visible.

---

## 14. Licensing, backup, and system health

### 14.1 Licensing

Each institution has a licence: trial, active, grace, expired, suspended, or revoked. The grace period in this product is 14 days after the verification failure window. Do not change that period as part of ordinary setup.

The application checks the licence server on a schedule inside the running web process: daily at 15:00 UTC, and on startup only if the next check is already due. A successful check moves the next check forward. A network or server failure is classified and does not immediately lock the school. Invalid signatures are treated as revoked. Repeated failure can warn Super Admin in the app after the warning threshold. It does not shorten the grace period.

School Admin opens `/admin/settings/licence` to see status and activate a key. Super Admin opens `/admin/licensing` and `/admin/settings/licence-server` to issue and inspect licences. Licence keys must not be pasted into training screenshots.

**Feature flags** that default off, and should be described as unavailable or off until Cyber Developers enables them: library, AI features, WhatsApp messaging, biometrics, API access, advanced analytics. SMS defaults off. There is no AI assistant in the portals.

### 14.2 Backup and restore

**Paths.** `/admin/settings/backup` and `/admin/settings/backup/restore`.

School Admin can create, download, restore, and delete backups when they have those permissions. A restore overwrites operational data and must be rehearsed, not tried first on a Monday morning.

Scheduled backups are defined in the product and are **not** started automatically. The hold is deliberate: a scheduled run can create files and delete older scheduled backups.

### 14.3 System health and scheduled jobs

**Path.** `/admin/system-health` (Super Admin sees the job panel).

The panel lists each job, whether it is automatic, the last success, the last failure, and the next run. Only the licence heartbeat should show as automatic. The other five should show as held.

> **Screenshot:** `/admin/system-health` · Super Admin · Scheduled jobs · Show licence heartbeat automatic and the other jobs held. Hide any secret.

> **Screenshot:** `/admin/settings/licence` · School Admin · Licence status · Show status and dates with the key masked.

---

## 15. How a learner moves through the platform

This is the implemented chain. Steps marked **staff** wait for a person.

1. Applicant submits the public form. **Automatic:** the application is stored and can be tracked.
2. Admissions reviews documents and sets status, including interview required. **Staff.** No interview calendar is created.
3. Offer issued. **Staff.** Deposit invoice can be linked. A paid or waived deposit is detected when finance records the payment or a waiver. **Automatic** status help exists for the deposit flags. Enrolment is still blocked until the deposit rule passes.
4. Accepted or Enrolled. **Automatic:** create or link the learner, student number, and session enrolment when the grade or programme matches. **Staff** must have created that grade or programme first. Class placement can still need a staff edit.
5. Timetable. **Staff** build slots. Learners then see them.
6. Teaching. **Staff** mark lesson registers, homework, and assessments. Gate arrival can fill **daily** attendance only.
7. Reports. **Staff** issue the report card from marks already captured. The PDF and family notice follow that action.
8. Promotion and rollover. **Staff** confirm. Rules only suggest eligibility.
9. Fees. **Staff** raise invoices. A configured gateway can record a successful online payment onto the invoice and ledger. Receipts are generated as part of that recording. Debtor lists are available immediately after balances change. Reminders are not sent by themselves.
10. Gate card. **Staff** issue the card. Later scans can update daily attendance.

Staff records follow a similar split. The employee file is manual. Gate check-in can stamp attendance. Payroll is prepared, approved, and finalised by HR. It is not calculated from the gate.

---

## 16. Documents the product can generate

On demand, when a person runs the action:

- Invoice PDF and receipt PDF
- Statement information on the learner account
- Report card PDF
- Certificate PDF
- Official letters, including admissions and transfer letters
- Payslip PDF
- Learner or student identity card
- Attendance and finance report exports where the screen offers them
- Compliance packs for SA-SAMS, LURITS promotion, and CEMIS marks
- Backup files

None of these print themselves on a schedule, except that a report-card issue and a payment posting create their documents as part of that staff or gateway action.

---

## 17. Common problems

| What you see | What it usually means |
|---|---|
| Invitation never arrives | Mail is not configured, or the school From address is `noreply@schoolhub.local` and Resend is also missing. Check Email and SMS status. Do not look for the password in the audit log. |
| User is stuck on change password | `mustResetPassword` is on. Finish `/account/password`. Admins can set a new password if policy allows. |
| Application will not enrol | Deposit not paid or waived, or the applied grade or programme text does not match a grade or course name. |
| Report card skipped | No marks for that term, or a card was already issued. |
| Online class link missing | The timetable slot has no meeting URL. |
| SMS button fails | SMS is off on the licence or Twilio is not configured. |
| Fee reminders did not go out overnight | The reminder job is held. Send from the desk or wait for a reviewed scheduler change. |
| Backup did not run at night | The backup job is held. Create a backup from the backup screen. |
| Payment reversal errors | Known defect when the payment has a reference. Do not keep retrying against live balances. Record the receipt number and follow the remediation task. |
| Security user cannot open finance | That is the intended restriction. |
| Biometric scanner does nothing | Biometric capture is rejected on purpose. |

---

## 18. Support

Cyber Developers publishes SchoolHub SA.  
Website: https://www.cyberdevelopers.co.za

Put the institution’s own support email and phone on the school settings and public contact page. This manual does not invent a sales phone number.

When something touches licensing, a suspended or revoked licence tells the user to contact Cyber Developers. A school admin cannot unblock a revoked licence from the school screen.
