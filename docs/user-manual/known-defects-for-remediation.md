# SchoolHub SA — defects held for a separate remediation task

**Cyber Developers · SchoolHub SA**  
**Reviewed:** 9 October 2026, against source commit `ca8089b`  
**This file is not a user manual.** It records defects so they are not lost inside the documentation work and are not described as production-ready.

Do not mix the repairs into the documentation. The recommended follow-up is a separate change that adds atomic database transactions, protection against duplicate approvals, safe payment reversals, reliable receipt-number generation, and automated tests. Before calling finance resolved, compare existing payment, invoice, allocation, and learner-ledger rows for inconsistencies.

## 1. Payment reversal can fail when a reference exists

**Status:** Confirmed in source. Not production-ready.

The database index `payments_invoice_reference_live_uidx` allows one live payment per invoice and reference. A row is live when `reference` is set and `reversedAt` is null.

`src/app/api/payments/[id]/reverse/route.ts` inserts the reversal with the original reference, then marks the original payment reversed. The insert happens while the original row is still live, so Postgres can reject the reversal. Gateway collections store a reference, so those reversals are the ones most likely to fail. A payment with no reference can still be reversed.

## 2. Receipt numbers break after a suffixed receipt

**Status:** Confirmed in source. Not production-ready.

`nextReceiptNumber` in `src/lib/finance-catalog.ts` takes the last `RCP-YYYY-…` value in alphabetical order and parses the tail as a number. Reversals are stored as `RCP-YYYY-00002-REV`. A collision retry in `createManualPayment` uses an `-R` suffix.

`Number("00002-REV")` is not a finite number. The function then falls back to sequence `1`, which collides with `RCP-YYYY-00001`. Manual collection retries once. The next collection can hit the unique receipt constraint. Gateway recording in `src/lib/payment-gateways/record-payment.ts` has the same numbering approach and no equivalent retry.

## 3. Reversing an unposted payment still reduces the invoice

**Status:** Confirmed in source. Not production-ready.

Invoice `amountPaid` increases when a payment is posted. The reversal route always subtracts the payment amount. It does not check `captureStatus` or `postedAt`. Reversing a pending or verified payment can understate what the learner has paid.

## 4. Posting and reversal are several separate writes

**Status:** Confirmed design risk. Not production-ready for concurrent use.

`postApprovedPayment` updates the invoice, allocations, learner ledger, credit note, and `postedAt` as separate steps. The payment row is not locked first. Two overlapping approvals of the same pending payment can both pass the status check in `src/app/api/payments/[id]/route.ts` before either sets `postedAt`. A failure halfway through can leave the invoice and the ledger apart.

Gateway recording updates the invoice inside a transaction, then allocates and posts the ledger after that transaction commits.

## 5. Scheduler automation is incomplete

**Status:** By design until reviewed. Do not enable the held jobs from documentation.

| Job | Automatic | Why it is held |
|---|---|---|
| Licence heartbeat | Yes. Daily at 15:00 UTC, plus a startup catch-up only when a licence is already due | None |
| Backups | No | Creates backup objects and can delete older scheduled backups |
| Fee reminders | No | Can email or SMS parents |
| Import cleanup | No | Deletes expired SA-SAMS staging files |
| Leave accrual | No | Updates staff leave balances |
| Recurring expenses | No | Creates finance expense rows |

The protected HTTP routes remain for a manual trigger with the cron secret. The in-process scheduler does not run the held jobs.

The first automatic licence check after the 9 October 2026 verification was still in the future at the time of the operational review (`nextVerificationAt` `2026-10-10T14:42:58Z`, scheduler slot `2026-10-10T15:00:00Z`). That first due run had not yet been observed.

## 6. Security account first login is outstanding

**Status:** Account exists. Portal proof is outstanding.

One security user, `security@college.co.za`, was invited through the normal invitation flow. Resend accepted the later invitation. Inbox delivery to that mailbox was not confirmed from the controlled mailbox used for the platform test. First login, the mandatory password change, the security desk, and the deny list for admin, finance, HR, marks, and settings were not completed. Do not create a second security user to finish that test. Do not bypass `mustResetPassword`.

## 7. Canonical public URL still needs a rebuild

**Status:** Requires configuration.

Invitation and password-reset links rewrite the known production Railway host to `https://app.schoolhubsa.co.za`. Sitemap, robots, and the stored licence domain still follow `NEXT_PUBLIC_APP_URL`. If that build value is the bare Railway host, those surfaces show the Railway host until the variable is the full `https://` address and the application is rebuilt.

## 8. Stale automated test

`tests/teacher-classes.test.ts` expects Attendance and Assessments in the Classwork group. `getTeacherNav` places them in Daily. Timetable remains in Classwork. The menu is the product behaviour. The test expectation is stale. The last full run during the audit was 437 passed and this 1 failed.

## What the remediation task should include

- One database transaction for approve, post, and reverse.
- A row lock so the same payment cannot be approved twice.
- Reversal that does not violate the live reference index and does not change `amountPaid` unless the payment was posted.
- Receipt numbers that ignore `-REV` and `-R` suffixes and do not restart at `00001`.
- Tests for those cases.
- A read-only check of existing finance rows before any data repair.
- Leave the 14-day licence grace unchanged.
- Leave the held scheduler jobs off until each one is reviewed on its own.
