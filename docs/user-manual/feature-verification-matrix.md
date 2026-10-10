# SchoolHub SA — feature verification matrix

**Cyber Developers · SchoolHub SA**  
**Commit:** `ca8089b` · **Date:** 9 October 2026

Status key: **Tested** = implemented and covered by automated tests or an observed production check. **Built** = implemented, end-to-end proof incomplete. **Partial** = incomplete or held. **Config** = works only after credentials or a licence switch. **Unavailable** = do not describe as production-ready.

| Area | Capability | Status | Evidence |
|---|---|---|---|
| Access | Email and password session | Built | Auth pages and session version |
| Access | Forced password change | Built | `/account/password`, `mustResetPassword` |
| Access | Invitation email | Config | Resend or school SendGrid. Production test mail was accepted and seen in a controlled inbox during the October 2026 mail check |
| Access | Admin set password | Tested | `tests/admin-password.test.ts`, role limits in `canSetUserPassword` |
| Access | Permission grants and denies | Tested | `tests/permissions.test.ts` |
| Access | Tenant scoping | Tested | Tenant helpers and permission tests |
| Licence | Public check path | Tested | Licence check tests |
| Licence | 14-day grace and failure classes | Tested | Licensing tests. Do not change grace |
| Licence | In-process daily heartbeat | Tested | Scheduler tests. Production panel showed a successful no-op before the next due time |
| Licence | First due check after 9 Oct 2026 14:42 UTC | Built | Scheduled for the 15:00 UTC slot on 10 Oct 2026. Not observed in that review |
| Institution | Settings and branding | Tested | Settings and branding tests |
| Institution | Terminology school vs college | Built | `src/lib/terminology.ts` |
| Institution | Campuses | Built | Campus model and visitor campus |
| Institution | Departments as an entity | Unavailable | Text field only |
| Admissions | Public apply and status | Built | Pages and application status copy |
| Admissions | Deposit block and waiver | Built | `admissions-deposit.ts` |
| Admissions | Learner created on accept | Built | `application-enrolment.ts` |
| Admissions | Interview appointments | Unavailable | Status label only |
| Records | Learner file, documents, guardians | Built | Admin and portal pages |
| Records | SA ID protection | Built | Encryption fields and sensitive permission |
| Academics | Sessions, classes, subjects, timetable | Built | Admin pages |
| Teaching | Educator register | Built | Teacher attendance page |
| Teaching | Gate updates daily attendance | Tested | Gate service and store. Period registers stay manual |
| Teaching | Assessments, homework, materials | Built | Teacher and learner pages |
| Teaching | Online exam questions | Built | MCQ, true/false, short answer |
| Teaching | Report card issue and skip rules | Tested | `reportCardBatchSkipReason` and issue flow |
| Teaching | Promotion rules | Built | `src/lib/promotion.ts` |
| Teaching | Educator nav groups | Built | Daily / Classwork / Campus. One stale test expects Classwork for attendance |
| Finance | Invoice, collect, approve, ledger | Built | Finance pages and `postApprovedPayment` |
| Finance | Gateway idempotent capture | Built | `record-payment.ts` row lock and reference check |
| Finance | Debtors and age analysis | Built | Finance pages |
| Finance | Reversal with a reference | Partial | Unique index conflict. Not production-ready |
| Finance | Receipt sequence after suffix | Partial | Falls back to `00001`. Not production-ready |
| Finance | Reverse unposted payment | Partial | Subtracts `amountPaid` without a posted check |
| Finance | Concurrent double approval | Partial | No row lock around `postedAt` |
| Finance | Fee reminder rules | Built | Screen exists |
| Finance | Fee reminder schedule | Partial | Job held |
| Finance | Recurring expense schedule | Partial | Job held |
| Finance | PayFast, Ozow, Yoco, Paystack | Config | School integration secrets |
| HR | Employees, leave, timesheets | Built | HR pages |
| HR | Payroll prepare, approve, finalise | Built | Separate permissions. Double post blocked by `postedAt` |
| HR | Leave accrual schedule | Partial | Job held |
| HR | Biometric clock file | Unavailable | Comment in clock helper |
| Comms | Announcements and messages | Built | Portal pages |
| Comms | Resend platform mail | Config | Resolver tests. Production sender confirmed without printing the key |
| Comms | Inbox delivery events | Unavailable | No webhook. Acceptance is not delivered |
| Comms | Twilio SMS | Config | Defaults off |
| Comms | WhatsApp inbox | Unavailable | Public click-to-chat only |
| Website | Public pages and CMS | Built | `(public)` and `/{schoolSlug}` |
| Security | Scan, visitors, on site, missing checkout | Tested | Gate tests |
| Security | Biometric payload | Unavailable | Denied on purpose |
| Security | Card administration | Built | Admin only |
| Security | Live security user first login | Partial | Invitation accepted by the provider. Portal walkthrough not done |
| Compliance | Audit log | Built | `/admin/audit` |
| Compliance | SA-SAMS import | Built | Staging and execute |
| Compliance | SA-SAMS cleanup schedule | Partial | Job held |
| Compliance | LURITS and CEMIS export jobs | Built | Compliance centre |
| Platform | Manual backup and restore | Built | Backup pages |
| Platform | Scheduled backup | Partial | Job held |
| Platform | Library, AI, public API, advanced analytics | Unavailable | Flags default off |
| Quality | Full automated suite | Partial | 437 passed, 1 failed (`teacher-classes` group name) |

Production Postgres was not opened for this matrix. Empty local fixture data is not evidence that customer balances are clean.
