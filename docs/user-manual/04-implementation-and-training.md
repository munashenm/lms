# SchoolHub SA — Implementation and Training Manual

**For the team putting an institution live**  
**Cyber Developers · SchoolHub SA**  
https://www.cyberdevelopers.co.za  
**Source:** commit `ca8089b`  
**Date:** 9 October 2026

This is the practical sequence. It assumes Cyber Developers hosts the platform and the institution supplies people, decisions, and historical data. It does not change licence grace, create extra security users, or turn on held scheduler jobs.

---

## 1. Roles in the project

| Person | Responsibility |
|---|---|
| Cyber Developers Super Admin | Create the institution, issue the licence, confirm system health |
| School or college project lead | Decisions, sign-off, data ownership |
| School Admin | Day-to-day configuration after handover |
| Admissions, finance, HR, academic leads | Their own desks and data |
| Educators, parents, learners, security | Trained after their data exists |

One named School Admin should exist before training day. Shared inboxes as logins are a later support problem.

---

## 2. Before configuration

Collect:

- Legal name, institution type, province, physical address, phone, email, and public website details
- Whether the language should be school (learner, term, class) or college (student, semester, module)
- Curriculum: CAPS, NSC, TVET/NQF, or custom
- Academic structure: four terms, two semesters, or custom dates
- Campuses, if any
- The active session’s dates
- Grades or years, classes or groups, subjects or modules, programmes
- Who teaches what
- Fee amounts, bank details, and whether a gateway will be used
- Employee list and who may see payroll
- Whether the public site and online applications go live on the same day
- Whether the gate is in the first release

Decide what will **not** be promised at go-live:

- Biometrics, NFC rollout, parent alerts on every scan, and early-release parent approval
- Automatic backups, automatic fee SMS, leave accrual, and recurring expenses
- Payment reversal as a routine cashier action
- Inbox delivery tracking for email
- A library, an AI assistant, or a public API

---

## 3. Platform setup (Cyber Developers)

1. Create the institution and the School Admin.
2. Issue a licence for product `lms` and confirm a successful verification. Leave grace at 14 days.
3. Confirm the public application URL. Invitation links rewrite the known Railway host. Sitemap and the stored licence domain follow `NEXT_PUBLIC_APP_URL` only after that value is the full `https://` address and the app is rebuilt.
4. Set platform mail: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_REPLY_TO`. Never send the API key by email or put it in a manual.
5. Send one harmless test message and confirm the provider accepts it. Confirm the inbox if you have access to that mailbox. Do not treat a message id alone as proof of inbox delivery.
6. Open System Health. Licence heartbeat should be the only automatic job. The other five jobs should be held.
7. Take a manual backup once the school has data worth keeping. Do not enable the backup scheduler as part of go-live.

> **Screenshot:** `/admin/system-health` · Super Admin · Scheduled jobs · Automatic column shows only the licence heartbeat.

---

## 4. Institution configuration (School Admin)

Work in this order. Later steps depend on earlier ones.

1. **School settings.** Name, type, contacts, province, branding, terminology.  
   > **Screenshot:** `/admin/settings` · School Admin · Settings · Save the profile.
2. **Academic session.** Create the session, terms or semesters, and mark the session active.  
   > **Screenshot:** `/admin/academic` · School Admin · Sessions · Active session visible.
3. **Structure.** Grades or years, classes or groups, subjects or modules, programmes for a college.
4. **People.** Teaching assignments on classes.
5. **Timetable.** Only after classes and subjects exist.
6. **Fees.** Public schedule, structures, then a single test charge and draft invoice on a test learner. Cancel or keep it out of the real age analysis.
7. **Users.** Invite the admissions officer, finance officer, HR officer, a pilot educator, and a pilot parent. Confirm each invitation only after the test email has already succeeded.
8. **Website.** Home, programmes, admissions text, contact. Point admissions at the real form.
9. **Modules.** Switch off any licensed module the institution is not using, so menus stay honest.
10. **Gate, if in scope.** Policy times, one checkpoint, cards for the pilot, then a scan. Do not enable biometrics.

### Mail and SMS at the school

If the institution wants its own SendGrid, it must be enabled, have a key, and use a From address that is not `noreply@schoolhub.local`. Otherwise leave it off and use platform Resend.

SMS stays off unless the licence includes it and Twilio is filled in. Test SMS once, to a number the project lead controls.

### Payments at the school

Configure a gateway only in the provider’s sandbox or with a one-rand agreed test. Do not use a personal card in training screenshots. Manual cash and EFT procedures should be written by the finance lead, including “do not reverse a referenced payment until Cyber Developers ships the repair”.

---

## 5. Data migration

### 5.1 SA-SAMS

Use `/admin/integrations/sa-sams`.

1. Upload into staging.
2. Map fields.
3. Read the error list.
4. Execute only when the project lead accepts the errors.
5. Keep rollback permission with School Admin, not with every officer.
6. Expired staging cleanup is not running nightly. Delete old imports from the desk when the import is finished.

This path is for SA-SAMS packages. It is not a general CSV loader for every module.

### 5.2 What is usually typed or prepared by hand

- Classes and the timetable, even if learners arrive from SA-SAMS
- Fee structures and opening balances, checked against the old age analysis
- Employees, salary structures, and leave balances. Do not expect the held accrual job to correct an opening balance
- Parent links and portal emails
- Visitors and cards, which start empty

### 5.3 Reconciliation before go-live

- Learner counts by grade match the source
- No duplicate active cards for one holder
- A sample of invoices: line totals, amount paid, and the ledger tell the same story
- A sample of marks appears on a draft report for one class
- Users who must change password cannot wander into a portal first

If historical payments are imported, review them with the finance defect list in mind. Do not run a mass reversal to “clean” them.

---

## 6. Training plan

Train on the institution’s own terminology and a copied class, not on production payment reversal.

| Session | Audience | Outcome |
|---|---|---|
| 1. Sign-in and password | All | Each person can sign in and knows the forced-reset screen |
| 2. Academic structure | School Admin, academic head | Session, class, subject, timetable |
| 3. Admissions | Admissions | One application from public form to accepted learner |
| 4. Register and marks | Educators | One class marked, one assessment captured |
| 5. Reports and promotion | Academic head | One report issued, one promotion preview |
| 6. Fees | Finance | One invoice, one approved collection, statement, age analysis. Show reversal only as “not for live use yet” |
| 7. Families | Pilot parents and learners | See attendance, a report, and a fee balance |
| 8. HR | HR | Employee, leave decision, payroll states without finalising a real run in training |
| 9. Front desk | Staff who sign visitors in | Visitor in and out |
| 10. Gate | Security, after the account test | Scan, on site, missing checkout, and a demonstration that finance and settings are refused |

> **Screenshot:** `/teacher/attendance` · Teacher · Register · Training class, not a full production roll if the picture will be published.

### Security account check (must be real, once)

Use the existing security user. Do not create a second one.

1. Open the latest invitation.
2. Sign in.
3. Change the temporary password when asked.
4. Land on `/security`.
5. Confirm scan, visitors, on site, expected visitors, missing checkouts, and activity open.
6. Confirm admin, finance, HR, payroll, marks administration, school settings, and card administration do not.

Until that list is done, mark security training as not fully tested for that institution.

---

## 7. Go-live checks

**Academic**

- [ ] One active session
- [ ] Every class that starts on Monday exists
- [ ] Educators see their classes
- [ ] Timetable published for the pilot grades

**People**

- [ ] School Admin, admissions, finance, and a pilot educator have signed in
- [ ] Invitations that failed have been re-sent after mail was fixed, not copied out of a log
- [ ] Parent pilot can see only their child

**Money**

- [ ] Fee structure matches the published schedule
- [ ] Test invoice is cancelled or isolated
- [ ] Gateway, if used, has had one agreed test and the invoice balance moved once
- [ ] Cashiers have written instructions not to reverse referenced receipts yet
- [ ] Age analysis reviewed by the finance lead

**Communication and site**

- [ ] Public home and apply page open
- [ ] Test email accepted, and inbox confirmed where a mailbox is available
- [ ] SMS left off, or one successful test completed

**Safety**

- [ ] Licence status active or an agreed trial, with a future next verification
- [ ] Manual backup taken after the data load
- [ ] Held jobs still held
- [ ] Audit log shows the setup actions and no passwords
- [ ] Security walkthrough completed or explicitly deferred in the launch note

**Rollback**

- [ ] The backup file can be downloaded by a person who is allowed to restore
- [ ] Everyone knows a restore replaces data and is a Cyber Developers and School Admin decision

---

## 8. After go-live

- Week one: School Admin watches admissions, registers, and the fee desk daily.
- Super Admin watches the licence heartbeat on System Health. A missed check should warn before the school is restricted. Do not “fix” a healthy future `nextVerificationAt` by forcing a check.
- Take manual backups on the institution’s agreed rhythm until scheduled backups are reviewed and enabled on purpose.
- Collect finance incidents (failed reversal, duplicate receipt, double approval) for the remediation task. Do not patch balances by hand without a written adjustment.
- Add the remaining staff and parents in batches so support can absorb password resets.

---

## 9. Training materials to capture later

Use [screenshot-checklist.md](./screenshot-checklist.md). Drop the real images into the user manual placeholders. Do not fabricate screens, and do not include licence keys, API keys, ID numbers, or temporary passwords in the pictures.
