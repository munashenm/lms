# SchoolHub SA — screenshot checklist

**Cyber Developers · SchoolHub SA**  
Place each capture beside the matching placeholder in the user manual. Do not draw a fake screen. Hide licence keys, API keys, SA ID numbers, card tokens, bank references, and temporary passwords.

| ID | Document placeholder | Route | Role | Screen | Action to illustrate |
|---|---|---|---|---|---|
| S01 | Sign-in | `/login` | Public | Sign-in | Fields visible, before submit |
| S02 | Users and set password | `/admin/users` | School Admin | Users | Open Set password. Do not show the password typed |
| S03 | Institutions | `/admin/institutions` | Super Admin | Institutions | More than one institution if the account has them |
| S04 | Dashboard | `/admin/dashboard` | School Admin | Dashboard | First screen after login |
| S05 | School settings | `/admin/settings` | School Admin | Settings | Branding and contact fields |
| S06 | Academic session | `/admin/academic` | School Admin | Sessions | Active session and terms or semesters |
| S07 | Roles | `/admin/roles` | Super Admin | Roles | Role list |
| S08 | Applications | `/admin/applications` | Admissions Officer | Queue | One application and its status |
| S09 | Public apply | `/{school-slug}/apply` | Public | Application | Form before submit |
| S10 | Learner profile | `/admin/students/{id}` | School Admin | Profile | Guardians, class, status. Mask identity numbers |
| S11 | Timetable | `/admin/timetable` | School Admin | Timetable | A week with room and educator |
| S12 | Register | `/teacher/attendance` | Teacher | Register | One present and one absent on a training class |
| S13 | Homework | `/student/assignments` | Learner | Homework | An open assignment |
| S14 | Report cards | `/admin/report-cards` | School Admin | Reports | Issue action for a class and term |
| S15 | Promotion | `/admin/academic/promotion` | School Admin | Promotion | Eligibility and confirm |
| S16 | Collect fees | `/finance/collect` | Finance Officer | Collect | Amount and method. No real card data |
| S17 | Age analysis | `/finance/debtors/age` | Finance Officer | Ageing | Bands visible |
| S18 | Employees | `/hr/employees` | HR Officer | Directory | One employee row |
| S19 | Payroll | `/hr/payroll` | HR Officer | Runs | Prepare, approve, and finalise visible as separate steps |
| S20 | Announcements | `/admin/announcements` | School Admin | Notice | Audience selector |
| S21 | Email status | `/admin/communications` | School Admin | Email and SMS | Provider name and ready state. No secrets |
| S22 | Public site | `/{school-slug}` | Public | Home | Header and admissions link |
| S23 | Gate scan | `/security/scan` | Security | Scan | Successful in scan on a test card |
| S24 | Cards | `/admin/security/cards` | School Admin | Cards | Issue and deactivate. Mask the token |
| S25 | Compliance | `/admin/compliance` | School Admin | Compliance | Export types, no downloaded personal file |
| S26 | Audit | `/admin/audit` | Principal | Audit | Action names only |
| S27 | Scheduled jobs | `/admin/system-health` | Super Admin | Jobs | Heartbeat automatic, five jobs held |
| S28 | Licence | `/admin/settings/licence` | School Admin | Licence | Status and dates. Key masked |
| S29 | Parent home | `/parent/dashboard` | Parent | Home | Linked child only |
| S30 | Learner fees | `/student/fees` | Learner | Fees | Own invoices |
| S31 | Visitors | `/security/visitors` | Security | Visitors | Sign-in form |
| S32 | On site | `/security/on-site` | Security | On site | Current presence list |
| S33 | Backup | `/admin/settings/backup` | School Admin | Backup | Create action, no file contents |
| S34 | SA-SAMS | `/admin/integrations/sa-sams` | School Admin | Import | Staging list, no raw ID file |
| S35 | Website admin | `/admin/website` | School Admin | Website | Editable public content |
| S36 | Messages | `/teacher/messages` | Teacher | Messages | Thread list |
| S37 | Leave | `/hr/leave` | HR Officer | Leave | A request awaiting a decision |
| S38 | Staff payslip | `/staff/payslips` | Staff | Payslips | Own payslip only |
| S39 | Password change | `/account/password` | Any first login | Change password | Empty fields |
| S40 | Educator today | `/teacher/dashboard` | Teacher | Today | Daily menu groups Attendance under Daily |

Optional later, still without secrets: finance payments verification, invoice PDF preview, report PDF preview, identity card print preview, expected visitors, missing checkouts, parent attendance, student timetable with a meeting link, compliance export result, restore warning.
