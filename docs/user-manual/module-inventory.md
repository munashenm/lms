# SchoolHub SA — module inventory

**Cyber Developers · SchoolHub SA**  
Generated from navigation, `SYSTEM_MODULES`, pages, and scheduled jobs at commit `ca8089b`.  
Page and API file lists: [appendix-pages.txt](./appendix-pages.txt), [appendix-api-routes.txt](./appendix-api-routes.txt).

## Product modules that can be switched

From `src/lib/modules.ts`:

| Key | Label | Licence feature | Notes |
|---|---|---|---|
| students | Students | Core | |
| admissions | Admissions | admissions | |
| academics | Academics | Core | |
| attendance | Attendance | attendance | |
| assessments | Assessments | assessments | Includes homework permission mapping |
| finance | Finance | finance | |
| communications | Communications | Core menu | Announcements and calendar |
| parent_portal | Parent Portal | parent_portal | |
| student_portal | Student Portal | student_portal | |
| website | Website Management | Core | |
| hr | HR | hr_payroll | |
| payroll | Payroll | hr_payroll | |
| student_cards | Student Cards | Core mapping via cards permission | Issued under security admin |
| transfers | Transfers | — | Letters and promotion outcomes, not a full transfer product |
| online_classes | Online Classes | online_exams | Meeting URL plus online exam attempts |
| biometrics | Biometrics | biometrics | Flag only. Scans that carry a template are denied |
| gate_security | Gate/Security | — | |
| visitor_management | Visitor Management | visitor_management | |
| reports | Reports | reporting | Also used for compliance menu mapping |
| messaging | Internal Messaging | messaging | |
| sms | SMS Gateway | sms | Off until configured |
| backup | Backup & Restore | Core | Scheduled run held |

Licence flags that are not product modules and default **off**: library, ai_features, whatsapp, api_access, advanced_analytics. SMS and biometrics also default off.

## Menus

### Admin (`getAdminNav`)

Dashboard.

Students: Online applications, Registration, Student details, Student absent request.

Human Resource: Staff, Employees, Staff attendance, Staff leave, Timesheets, Payroll, Leave policies, HR reports.

Academics: Academic sessions, Classes, Subjects, Timetable, Attendance, Assessments, Homework and study materials, Reports, Certificates, Letters, Promotion, Promotion rules.

Finance: Overview, Fee schedule, Fee structures, Charges and plans, Invoices, New invoice, Collect fees, Payments, Student accounts, Debtors, Age analysis, Fee reminders, Expenses, Credits and aid, Budgets and projects, Income and expenses, Reports.

Communication: Announcements, Messages, Calendar, Email and SMS, SMS.

Website: Website, Admissions content.

School: Documents.

Security: Gate desk, Gates, Cards, Gate settings, Gate reports, Visitors book.

Insights: Reports.

Settings: Users, School settings, Licence, Backup and restore, System health, Compliance centre, SA-SAMS, Audit log.

Super Admin control: Institutions, Licensing, Modules, Roles and permissions, Customers and licences.

Also present as pages and not all repeated as top-level labels: academic rollover, learner profile, assessment detail, invoice detail, payroll detail, employee detail, user permissions, SA-SAMS job detail, backup restore.

### Finance officer

Dashboard, fee schedule, structures, charges, invoices, new invoice, collect, payments, student accounts, debtors, age analysis, reminders, letters, expenses, credits and aid, ledger, reports, income, suppliers, accounts, plus own attendance, visitors, messages, leave, payslips, timesheets.

Budgets and projects are on the admin finance menu.

### HR officer

Dashboard, staff, employees, staff attendance, leave, timesheets, payroll, leave policies, HR reports, plus own attendance, visitors, messages, leave, payslips, timesheets.

### Educator

Today. Daily: attendance, assessments, homework, messages. Classwork: my classes, reports, timetable, materials, lesson plans, curriculum. Campus: learner leave, announcements. My work: attendance, leave, payslips, timesheets.

`/teacher/visitors` exists as a page. It is not in `getTeacherNav`.

### Learner

Dashboard, profile, documents, subjects, timetable, lesson plan, curriculum progress, homework, attendance, examinations, results, reports, certificates, letters, fees, notice board, messages, notifications, educator reviews, apply leave, download centre, academic calendar.

### Parent or sponsor

Home, my children, fees, attendance, assessments, messages, results, examinations, reports, materials, timetable, academic calendar, apply leave, notice board, certificates, letters, download centre.

### Staff

Visitor book, messages, my attendance, my leave, my timesheets, my payslips.

### Security

Dashboard, scan, visitors book, currently on site, expected visitors, missing checkouts, incidents, gate activity.

## Public and account pages

`/login`, `/student/login`, `/parent/login`, `/{school-slug}`, `/{school-slug}/login`, `/{school-slug}/student/login`, `/{school-slug}/parent/login`, `/{school-slug}/apply`, `/apply`, `/apply/status`, `/forgot-password`, `/reset-password`, `/account/password`.

Public content: home, about, academics, admissions, calendar, contact, fees, gallery, news, privacy, programmes.

## Scheduled jobs

| Job | Intended rhythm | Automatic |
|---|---|---|
| Licence heartbeat | Daily 15:00 UTC, startup only if already due | Yes |
| Backups | Hourly check of due schedules | No |
| Fee reminders | Daily | No |
| Import cleanup | Daily | No |
| Leave accrual | Monthly | No |
| Recurring expenses | Daily | No |

## Data areas

The Prisma schema covers school, campus, user, academic year, term, grade, subject, course, module, class, enrolment, application, attendance, timetable, assessment, assignment, exam, mark, report card, invoice, payment, ledger, communication, announcement, certificate, letter, leave, staff attendance, employee, payroll, visitor, gate, access card, licence, backup, SA-SAMS import, compliance export, budget, and audit. There is no Department table and no Library table.
