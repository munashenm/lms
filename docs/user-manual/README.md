# SchoolHub SA documentation set

**Product:** SchoolHub SA  
**Publisher:** Cyber Developers  
**Website:** https://www.cyberdevelopers.co.za  
**Tagline:** School Management for South Africa  
**Currency and time:** South African rand (ZAR), Africa/Johannesburg  
**Source reviewed:** application source at commit `ca8089b` (9 October 2026)

SchoolHub SA is an integrated management platform for schools, colleges, TVET colleges and training centres. It covers admissions, learner records, teaching, fees, people, communication, a public website, campus access and platform administration. It is not only a learning-management system.

## Documents

| Document | File |
|---|---|
| 1. Complete User Manual | [01-complete-user-manual.md](./01-complete-user-manual.md) |
| 2. Functional Capabilities Catalogue | [02-functional-capabilities-catalogue.md](./02-functional-capabilities-catalogue.md) |
| 3. Business Benefits and Cost-Saving Guide | [03-business-benefits-guide.md](./03-business-benefits-guide.md) |
| 4. Implementation and Training Manual | [04-implementation-and-training.md](./04-implementation-and-training.md) |
| Module inventory | [module-inventory.md](./module-inventory.md) |
| Feature verification matrix | [feature-verification-matrix.md](./feature-verification-matrix.md) |
| Screenshot checklist | [screenshot-checklist.md](./screenshot-checklist.md) |
| Defects held for a separate fix | [known-defects-for-remediation.md](./known-defects-for-remediation.md) |
| Page list taken from the source | [appendix-pages.txt](./appendix-pages.txt) |
| API route list taken from the source | [appendix-api-routes.txt](./appendix-api-routes.txt) |

## Status words used in every document

| Status | Meaning |
|---|---|
| Implemented and tested | The behaviour exists in source and is covered by automated tests, or it was exercised on the running product. |
| Implemented, not fully tested | The screen or workflow exists. End-to-end proof is incomplete. |
| Partially implemented | Part of the workflow exists. A related step is manual, held, or incomplete. |
| Requires configuration | The code exists and does nothing useful until credentials, a licence feature, or school settings are supplied. |
| Planned or unavailable | A label, licence flag, or menu concept exists without a working product feature. Do not sell it as available. |

## Accuracy limits

These manuals describe the source code. They do not describe a production data audit. Production Postgres was not queried for this documentation. Screenshots are placeholders only.

Three items must stay visible to anyone using the finance, scheduler, or security chapters:

1. Payment reversal, receipt numbering, and multi-step posting have confirmed defects. See [known-defects-for-remediation.md](./known-defects-for-remediation.md). Do not describe payment reversal as production-ready.
2. Only the licence heartbeat runs automatically inside the web process. Backups, fee reminders, SA-SAMS import cleanup, leave accrual, and recurring expenses stay on protected manual routes.
3. The existing security account for the college demonstration has not completed first login, forced password change, and role checks in this review.

Brand marks used by the product are `/brand/logo.png` and `/brand/mark.png`.

Word and PDF copies of these Markdown files are in [export/](./export/). The PDF header uses the SchoolHub SA logo and the colour `#1B4D6E` from the application theme. HTML files in that folder are the print source.
