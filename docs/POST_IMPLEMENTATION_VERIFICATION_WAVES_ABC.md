# Post-Implementation Verification — Waves A / B / C

**Date:** 2026-09-29  
**Branch:** `cursor/d6-gap-analysis-0c48`  
**Scope:** Verification only — no new features implemented in this review.  
**Environment:** Local PostgreSQL 16 + `prisma migrate deploy` on empty DB, then `npm run db:seed`, `next start` smoke tests.

---

## 1. Database / Prisma

### Schema changes introduced by these waves

**Enums added**
| Enum | Values |
|---|---|
| `PopulationGroup` | AFRICAN, COLOURED, INDIAN, WHITE, OTHER, UNSPECIFIED |
| `ComplianceExportKind` | SASAMS_PACKAGE, LURITS_PROMOTION, CEMIS_MARKS |
| `ComplianceExportStatus` | PENDING, READY, FAILED |
| `BudgetStatus` | DRAFT, ACTIVE, CLOSED |
| `FinanceProjectStatus` | OPEN, CLOSED |
| `ApplicationStatus` | **+** `OFFER_ISSUED` |

**`Student` columns added (all additive)**
- `preferredLanguage` (nullable text)
- `populationGroup` (nullable enum)
- `citizenship`, `countryOfBirth` (nullable text)
- `disabilityStatus` (boolean NOT NULL DEFAULT **false**)
- `sneStatus` (boolean NOT NULL DEFAULT **false**)
- `disabilityNotes` (nullable text)
- `luritsNumber`, `previousEmisSchool`, `transferReason` (nullable text)
- Index: `(schoolId, luritsNumber)`

**`Teacher` columns added**
- `luritsNumber`, `persalNumber` (nullable text)
- Index: `(schoolId, luritsNumber)`

**`Application` columns added**
- `offerSentAt`, `offerExpiresAt`, `offerAcceptedAt`, `depositPaidAt` (nullable timestamps)
- `depositAmount` (nullable decimal)
- `depositInvoiceId` (nullable FK → invoices, ON DELETE SET NULL)

**New models / tables**
- `ComplianceExportJob` → `compliance_export_jobs`
- `LuritsImportJob` → `lurits_import_jobs`
- `Budget` / `BudgetLine` → `budgets` / `budget_lines`
- `FinanceProject` / `FinanceProjectContribution` → `finance_projects` / `finance_project_contributions`

### Migrations created by these waves

| Migration | Path |
|---|---|
| **Only wave migration** | `prisma/migrations/20260929120000_compliance_finance_admissions/migration.sql` |

(Repo total after deploy in test: **37** migrations; 36 pre-existing + this one.)

### SQL inspection — destructive?

| Check | Result |
|---|---|
| `DROP TABLE` / `DROP COLUMN` | **None** |
| `DELETE` / `TRUNCATE` | **None** |
| Type-narrowing / rewrite of existing columns | **None** |
| Enum extend | `ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_ISSUED'` — additive |
| New NOT NULL columns without default | Only `disabilityStatus` / `sneStatus` with **DEFAULT false**; new tables’ required columns apply to new rows only |
| FK on delete | New school-scoped tables CASCADE with school; deposit invoice SET NULL |

**Verdict:** Migration is **non-destructive** for existing learner/staff/application data. Safe pattern for production is `prisma migrate deploy` after staging validation. **Do not use `prisma db push` in production.**

### Existing records with null EMIS fields

Verified on seeded DB after migrate:

| Field | Existing behaviour |
|---|---|
| Nullable EMIS strings / enum / LURITS | Remain `NULL` until edited or imported |
| `disabilityStatus` / `sneStatus` | Set to **`false`** by DEFAULT (not null) |
| Runtime impact | Records continue to load/edit; Compliance Centre flags missing required EMIS fields as ERROR/WARNING |
| Seed snapshot | 11/11 learners had `populationGroup` and `luritsNumber` null; disability flags false |

---

## 2. Command results

| Command | Result |
|---|---|
| `npx prisma validate` | **Pass** — schema valid |
| `npx prisma generate` | **Pass** |
| `npx prisma migrate status` | **Up to date** after deploy on test DB (37/37) |
| `npx prisma migrate deploy` (test DB) | **Pass** — wave migration applied cleanly |
| `npm run typecheck` | **Pass** (0 errors) |
| `npm run lint` | **Fail** — 12 errors / 23 warnings (includes new wave UI `setState-in-effect` errors + pre-existing issues) |
| `npm test` | **315 passed / 0 failed / 0 skipped** (31 files) |
| `tests/compliance-waves.test.ts` | **12 passed / 0 failed / 0 skipped** |
| `npm run build` | **Pass** — routes include `/admin/compliance`, `/admin/finance/debtors/age`, `/admin/finance/budgets`, `/api/compliance/*`, `/pricing` |

---

## 3. Compliance Centre (`/admin/compliance`)

| Check | Result | Notes |
|---|---|---|
| Tenant isolation | **Pass (API)** | Queries scoped via `getSchoolFilter` → `schoolId`; Super Admin without school gets **400 Select a school** |
| Module access | **Partial** | Nav maps `/compliance` → `reports` module; `sasams.*` permissions themselves are **not** module-gated in `permissionModule()` (returns null for `sasams.*`) |
| Permission checks | **Pass** | Page/API require `sasams.view`; export `sasams.execute`; LURITS import `sasams.import`. Finance/Teacher/Student/Parent → 403 / redirect |
| Direct URL protection | **Pass** | Unauthenticated → redirect login / API 401; non-admin roles redirected from `/admin/*` |
| Academic session selection | **Missing in UI** | Export API accepts `academicYearId`/`termId` for CEMIS/promotion; Compliance Centre UI does **not** expose selectors |
| Readiness counts | **Pass** | Smoke: 11 learners / 1 educator; blocking errors counted |
| Validation errors | **Pass** | ERROR vs WARNING list returned (gender, population group, DOB, identity, etc.) |
| Export history | **API only** | `GET /api/compliance/export` lists jobs; **UI does not render history** (only last filename string) |
| Import history | **API only** | `GET /api/compliance/lurits` lists jobs; **UI does not render history** |

---

## 4. SA-SAMS — A vs B

### A. Implemented internal / tabular export — **YES**

SchoolHub generates an **internal package**:
- JSON package + CSV bundle keys: `learners.csv`, `educators.csv`, `guardians.csv`, `manifest.json`
- Column names are **SchoolHub camelCase**, not official SA-SAMS Access table/field names
- Native `.mdb`/`.accdb` adapter remains a **placeholder** (import path only; no official DB export)

### B. Official SA-SAMS-compatible exchange format — **NOT validated**

**Do not describe the product as fully SA-SAMS integrated.**

| Item | Detail |
|---|---|
| Exported learner fields | admissionNumber, firstName, lastName, saIdNumber, passportNumber, dateOfBirth, gender, populationGroup, citizenship, homeLanguage, preferredLanguage, disability, sne, luritsNumber, grade, className, status, previousEmisSchool, transferReason |
| Educator fields | employeeNumber, firstName, lastName, saIdNumber, luritsNumber, persalNumber, department, status |
| Guardian fields | learnerAdmissionNumber, firstName, lastName, relationship, phone, email, saIdNumber, isPrimary |
| Mapping logic | Direct field copy from Prisma → export row; disability/sne as `Y`/`N`; dates ISO `YYYY-MM-DD` |
| Sample output (header + row) | `admissionNumber,firstName,lastName,saIdNumber,...,gender,populationGroup,...`<br>`ADM001,Thabo,Mokoena,8001015009087,,2010-01-15,MALE,AFRICAN,...` |
| Validation rules | Pre-export EMIS checks; blocking errors prevent export unless `allowWithErrors` |
| Still missing vs official workflow | Deployable SA-SAMS DB file; Valistractor packing; official EMIS codes; LURITS approval module parity; IQMS/NSC packs; native Access schema |
| Assumptions | Districts can remap CSV/JSON into SA-SAMS; SchoolHub is operational SoR, not DBE filing tool |

**Category: FUNCTIONAL — VALIDATION REQUIRED**

---

## 5. LURITS

| Area | Status |
|---|---|
| Learner identifier storage | `students.luritsNumber` (+ teacher `luritsNumber`) — operational |
| Promotion → LURITS batch | Tabular CSV/JSON from `PromotionDecision` — operational SchoolHub export |
| Feedback import | Parses XML/CSV-ish Tx feedback; matches by SA ID **or** admission/employee number; updates LURITS number |
| Accepted/rejected records | **Not modelled** — only matched/updated/unmatched counts |
| Validation errors | Minimal; parse failures → job FAILED; no per-row reject codes from DBE |
| Duplicate prevention | **Weak** — no unique constraint on LURITS number; re-import overwrites; no conflict detection if two learners get same number |
| Tenant isolation | **Pass** — import/export scoped to session `schoolId` |
| Academic-session history | Export job can store `academicYearId` for promotion kind; **no dedicated session history UI** |

Smoke: admission-number match updated `STD2026001` → `LUR-BY-ADM-001`. Seed had null SA IDs so SA-ID match path not exercised on seed data.

**Operational vs external validation**
- Operational: store numbers, import feedback files, export promotion maintenance CSV
- Still requires validation against real district Tx feedback files and LURITS submission process

**Category: FUNCTIONAL — VALIDATION REQUIRED**

---

## 6. CEMIS (optional / jurisdiction-specific)

| Check | Result |
|---|---|
| Which institutions see it | **All** institutions with `sasams.execute` — **no Western Cape / province gate** |
| Export | Marks → CEMIS-oriented CSV (admission, LURITS, subject, score, term, etc.) |
| Import | **Not implemented** |
| Academic session | API filters by `termId` / `term.academicYearId` if provided; UI does not select |
| Label | Correctly labelled **CEMIS MVP** in UI copy |

**Category: MVP**

---

## 7. Finance

### Debtors age (`/admin/finance/debtors/age`)

Ageing is based on **invoice `dueDate` vs as-of date**, allocated by outstanding amount per invoice — **not** a single undifferentiated balance.

| Requested bucket | Implementation |
|---|---|
| Current | `current` (not due / due today) |
| 30 days | `1_30` |
| 60 days | `31_60` |
| 90 days | `61_90` |
| 120+ days | **No separate bucket** — falls into `90_plus` |

Smoke API (admin + finance): `totalOutstanding=22500`.  
UI page is under `/admin/...` — **Finance Officer is redirected away** (middleware `canAccessAdmin`); finance role can still call the API.

### Budgets & projects

- Separate tables from `StudentLedgerEntry` / invoices / charges
- Smoke: create budget + project contribution → **student ledger row count unchanged** (0→0 in seed; no ledger writes in budget/project code paths)

**Category:** Age analysis **PRODUCTION READY** (with noted 120+ gap / finance UI path). Budgets/projects **PRODUCTION READY** for internal planning (not full GAAP).

---

## 8. Admissions pipeline

Smoke path exercised:

`SUBMITTED → UNDER_REVIEW → OFFER_ISSUED (deposit 500) → markDepositPaid → ACCEPTED (enrol)`

| Check | Result |
|---|---|
| `OFFER_ISSUED` backend + UI | **Supported** (enum, validator, pipeline board, status labels) |
| Duplicate learners on re-accept | **Pass** — second `ACCEPTED` did not create another student (`shouldCreateStudentOnAccept` requires null `studentId`) |
| Idempotent deposit flag | **Pass** — `depositPaidAt` preserved via `existing ?? new Date()` |
| Payment/deposit duplication | **Gap** — deposit is a **status flag only**; `depositInvoiceId` never set; **no invoice/payment/ledger posting** |
| Student number safety | Uses `generateStudentNumber` with collision loop + unique `(schoolId, studentNumber)` |
| Documents/history after enrol | Application row retained with `studentId` link; documents relation unchanged (seed app had 0 docs) |

**Category: FUNCTIONAL — VALIDATION REQUIRED** (pipeline OK; deposit not real finance)

---

## 9. Security

| Scenario | Result |
|---|---|
| Cross-tenant | Existing suite `tests/security-isolation.test.ts` **17 passed**; compliance APIs bind to session school |
| Unauthenticated | `/api/compliance/*` → **401**; `/admin/compliance` → login redirect |
| Disabled users / institution suspension | Covered by existing auth/licensing suites (not re-broken by wave code paths) |
| Module disabled | Compliance nav tied loosely to `reports`; `sasams.*` not hard-blocked by module key |
| Permission denied | Teacher/Student/Parent/Finance blocked from compliance export; Teacher blocked from debtors-age API |
| Sensitive EMIS/SNE | Editable by `students.edit`; exported in compliance packages to permitted roles — **no field-level redaction** for SNE in export |
| Compliance export permissions | `sasams.execute` required — OK for admin; not for finance |
| Finance permissions | Debtors-age API uses `finance.view` |

Existing security tests remain green as part of full **315** suite.

---

## 10. Manual smoke (roles)

| Role | Result |
|---|---|
| Super Admin | Login OK; compliance APIs need school context (400 without) |
| Institution Admin | Dashboard, applications, compliance, debtors age, budgets, pricing (authed) OK |
| Finance | Finance dashboard OK; compliance denied; debtors-age **API** OK / **admin UI** redirected |
| Teacher | Compliance denied; dashboards OK |
| Student | Assignments/dashboard OK; admin compliance redirected |
| Parent | Login OK; admin compliance redirected |

**Public `/pricing`:** anonymous → **307 to login** (`/pricing` not in middleware `PUBLIC_PATHS`). Not truly public SaaS pricing yet.

---

## 11. Final scorecard

| Feature | Status | Tested? | Production ready? | External validation required? | Known limitations |
|---|---|---|---|---|---|
| Prisma wave migration | **PRODUCTION READY** | Yes (deploy on test DB) | Yes (additive) | No | Use `migrate deploy` only; never `db push` in prod |
| EMIS fields on learner/staff | **PRODUCTION READY** | Yes | Yes (storage/edit) | Partial (field set vs Annexure A) | Existing rows null until captured; disability defaults false |
| Compliance Centre readiness checks | **PRODUCTION READY** | Yes (API + unit) | Mostly | No for internal ops | No session picker; history UI missing; lint errors on client |
| SA-SAMS tabular export (A) | **FUNCTIONAL — VALIDATION REQUIRED** | Yes | Ops export only | **Yes** vs official SA-SAMS | Not official DB/exchange format |
| Official SA-SAMS exchange (B) | **INCOMPLETE** | N/A | No | **Yes** | Native DB placeholder; no Valistractor pack |
| LURITS number store + feedback import | **FUNCTIONAL — VALIDATION REQUIRED** | Yes (adm# match) | Partial | **Yes** vs real Tx files | No accept/reject rows; weak duplicate rules; SA-ID match depends on PII reveal |
| Promotion → LURITS batch | **FUNCTIONAL — VALIDATION REQUIRED** | Yes (API) | Ops CSV only | **Yes** | Codes/outcomes not district-validated |
| CEMIS marks export | **MVP** | Yes | No | **Yes** (WCape) | Shown to all schools; no import; no province gate |
| Debtors age analysis | **PRODUCTION READY** | Yes | Yes* | No | \*No dedicated 120+ bucket; finance UI path under `/admin` |
| Budgets & finance projects | **PRODUCTION READY** | Yes | Yes (internal) | No | Not full GAAP; no ledger coupling (intentional) |
| Admissions offer→deposit→enrol | **FUNCTIONAL — VALIDATION REQUIRED** | Yes | Partial | No for status machine | Deposit not invoiced/paid in ledger; `depositInvoiceId` unused |
| LMS assignment summary polish | **PRODUCTION READY** | Yes (page 200 + unit) | Yes | No | Cosmetic/summary only |
| Public SaaS pricing page | **INCOMPLETE** (as public page) | Yes | No for anonymous buyers | No | Blocked by auth middleware |
| Website intake sync copy | **PRODUCTION READY** | Code review | Yes | No | Copy/UX only |

---

## 12. Recommendation

**Do not start Wave D until product approves this report.**

Highest-priority gaps before calling compliance “market-ready for public schools”:
1. Validate SA-SAMS tabular mapping against a real school deploy/Valistractor path (or finish official DB export).
2. Validate LURITS feedback against real district Tx files; add uniqueness/conflict handling.
3. Gate CEMIS to Western Cape (or hide behind explicit flag) until templates validated.
4. Wire deposit to real invoice/payment **or** clearly label deposit as administrative acknowledgement only.
5. Make `/pricing` public if it is meant for buyers.
6. Clear lint errors in new client panels before treating CI as green.
