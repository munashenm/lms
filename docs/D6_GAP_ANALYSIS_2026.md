# SchoolHub SA vs d6 (2026) — Capability Gap & Differentiation Analysis

**Purpose:** Use d6’s publicly documented 2026 South African school-management capabilities as a **requirements benchmark** only. Do **not** copy d6’s interface, workflows, or proprietary implementation.  
**Audience:** Product, sales, engineering prioritisation  
**Sources:** SchoolHub codebase & docs (live product); d6 public site/help (capability signals); DBE/LURITS/CEMIS policy context  
**Date:** September 2026  
**Status:** Analysis — no UI or proprietary design claims about d6

---

## 1. Executive verdict

SchoolHub already covers a strong **operational SIS + LMS + finance + HR** stack for independent schools, colleges and TVETs. Against the **expected SA school-management bar** that d6-class systems set (DBE compliance path, parent/admin depth, GAAP school finance), the largest gaps are:

| Priority | Area | SchoolHub today | Expected SA bar | Risk if ignored |
|---|---|---|---|---|
| P0 | SA-SAMS → LURITS / CEMIS **export & compliance** | Import (CSV/XLSX/JSON); native DB placeholder; **no export / LURITS feedback / CEMIS** | Compliance checks → SA-SAMS DB export → LURITS Tx feedback import; WCape CEMIS path | Blocks public/subsidised school sales |
| P0 | Learner EMIS fields | Core demographics; missing ethnicity/population group, disability/SNE, LURITS numbers | Mandatory LURITS/CEMIS fields + validation before submit | Incomplete DBE submissions |
| P1 | Year-end / promotion ↔ EMIS | Rules, decisions, rollover wizard exist | Promotion decisions must feed LURITS Tx12-style maintenance | Manual re-entry at year-end |
| P1 | School finance depth | Strong fee office & ledger; light GL | GL + debtors age analysis + creditors + budget + projects | SGB/finance officer expectations |
| P2 | Discipline / conduct | Letters only | Behaviour tracking + parent visibility | Independent-school parent portal parity |
| — | LMS / admissions / website / college / pricing | **SchoolHub leads** | d6 is admin/comms-first, quote-based | Differentiation opportunity |

**Strategic posture:** Close P0/P1 compliance gaps enough to sell into public and Western Cape schools, then **win on differentiation** — full LMS student experience, digital admissions + institution website, college/TVET, and transparent SaaS packaging.

---

## 2. Method & boundaries

### In scope
- Capability presence vs absence for SA school management
- Compatibility with **SA-SAMS**, **LURITS**, **CEMIS** (and related DBE submission culture)
- Learner/parent records, academic year-end & promotion, finance, report cards, online admissions, communications, permissions

### Out of scope
- Cloning d6 screens, app UX, Communicator, or Integrate partner stack
- Claiming feature parity with unpublished d6 internals
- Visual redesign of SchoolHub

### How to read status labels
| Label | Meaning |
|---|---|
| **Strong** | Live and competitive for intended institutions |
| **Partial** | Exists but missing SA-expected depth or export path |
| **Gap** | Material missing capability for SA market expectations |
| **Lead** | SchoolHub differentiator vs typical d6-class SIS |

---

## 3. What the 2026 SA bar expects (from d6 public signals + policy)

d6’s public positioning (admin, curriculum, finance, communicator/app) and help articles describe the **market-expected compliance shape**, not something SchoolHub must imitate:

1. **Operate day-to-day in the SMS**, then **export to an SA-SAMS database** for district/DDD/Valistractor submission (SA-SAMS and Valistractor remain DBE tools).
2. **Pre-export compliance tasks** — incomplete mandatory learner fields (e.g. ethnicity/gender for LURITS/CEMIS) block clean exports.
3. **Import LURITS XML feedback** (Tx4/5/7/9/12/13/14/16) to update learner/educator LURITS numbers — typically in the SMS, not only in SA-SAMS.
4. **CEMIS** path for Western Cape curriculum/mark reporting (alongside CAPS, IEB, Cambridge, SNE frameworks).
5. **Curriculum:** mark capture, configurable promotion criteria, report cards with remarks, certificates.
6. **Administration:** learner/parent registration & verification, attendance/absenteeism, discipline/conduct, SGB reporting.
7. **Finance:** school-oriented GAAP — GL, debtors, creditors, budget, cash book, projects, cashless parent pay.
8. **Communications:** multi-channel (SMS/email/in-app), targeted groups, parent portal for marks/attendance/discipline/pay.
9. **Pricing culture:** quotation-based enterprise deals (opaque to buyers).

Policy backdrop (2026 draft NEIAS regulations / LURITS practice): institutions must keep **minimum EMIS fields** complete and accurate; quarterly LURITS-related uploads and promotion collections remain the compliance rhythm for ordinary schools.

---

## 4. SchoolHub current feature map (as-built)

Summarised from `docs/MARKETING.md`, `docs/PROJECT_PLAN.md`, `docs/ENTERPRISE_LICENSING_BACKUP_SASAMS.md`, and schema/portals.

### Already strong
- Multi-portal RBAC: Super Admin, School Admin, Principal, Teacher, Student, Parent, Finance, Admissions, HR, Staff
- Learner/student + guardian records; SA ID Luhn; POPIA consent/audit/export
- Academic sessions, terms/semesters, enrolments, promotion rules/decisions, year-end rollover
- Attendance (incl. sick), absence SMS, timetable with conflicts
- Assessments, CAPS 1–7 symbols, **assignments + submissions**, materials, lesson plans, online exams
- Report card & certificate PDFs; fee holds on academic documents
- Fee office: schedules, invoices, collect desk, PayFast/Paystack, statements, debtors, reminders
- HR/leave/payroll/payslips (own-record visibility for teachers)
- Public website CMS pages + online apply + status tracker
- College/TVET terminology (student/lecturer/module/semester)
- Licensing modules, encrypted backup, multi-tenant isolation
- SA-SAMS **import** wizard (CSV/TSV/JSON/XLSX; native `.mdb`/`.accdb` placeholder)

### Learner portal (LMS-shaped — differentiation base)
Dashboard, timetable, subjects, attendance, assignments, materials, exams, results, progress, report cards, certificates, fees, messages, announcements, documents, downloads, calendar, leave, letters, reviews, profile.

---

## 5. Priority gap matrix

### 5.1 SA-SAMS / LURITS / CEMIS compatibility — **P0 Gap**

| Expected capability | SchoolHub | Gap |
|---|---|---|
| Import learners/parents/educators from SA-SAMS extracts | **Partial → Strong** for tabular formats | Native Access DB parse still placeholder |
| Pre-submission **compliance checklist** (mandatory EMIS fields) | **Gap** | No LURITS/CEMIS readiness screen |
| **Export** school data to deployable SA-SAMS DB / district workflow | **Gap** | Explicitly positioned as import/migration only (`MARKETING.md` FAQ) |
| LURITS **feedback XML import** (Tx series) → store LURITS numbers | **Gap** | No `luritsNumber` on Student/Teacher; no Tx importer |
| Western Cape **CEMIS** mark/curriculum export or import | **Gap** | No CEMIS adapter or WCape-specific mark packing |
| NSC / FET registration assistance (Gr 10–12) | **Gap** | Not modelled |
| Quarterly submission calendar / reminders for EMIS officers | **Gap** | No compliance calendar |

**Recommended product stance (non-copy):**  
SchoolHub remains the **operational system of record**. For public schools, deliver a **Compliance Centre**: field completeness → export package consumed by SA-SAMS/Valistractor → LURITS feedback re-import. Document that DBE filing tools stay DBE’s; SchoolHub owns accuracy and reduced double-capture.

**Schema/field readiness (minimum):**
- Learner: population group / ethnicity, citizenship, disability & SNE flags, home language (exists), preferred language of learning, LURITS number, transfer-in/out reasons, previous EMIS school
- Educator: LURITS number, PERSAL/employment category where relevant
- Enrolment: grade/class aligned to EMIS codes; promotion outcome coded for Tx12-equivalent

### 5.2 Learner & parent records — **Partial**

| Expected | SchoolHub | Notes |
|---|---|---|
| Learner biographical + contact | Strong | SA ID, address, medical, emergency |
| Parent/guardian links | Strong | `Guardian` / `StudentGuardian` |
| Online data verification / re-registration | Partial | Apply + docs; no annual parent data-verify campaign UX |
| POPIA | Strong | Consent, audit, export |
| Discipline / merit / demerit | **Gap** | No behaviour module; parent portal cannot show conduct |
| Code of conduct setup | Gap | Letter templates only |
| Afrikaans / bilingual UI | Gap | Product is English; market often bilingual |

### 5.3 Academic year-end & promotion — **Partial (ops Strong, EMIS Gap)**

| Expected | SchoolHub | Notes |
|---|---|---|
| Configurable promotion criteria | Strong | `PromotionRule` (average, attendance, subjects passed) |
| Decisions + override with reason | Strong | `PromotionDecision` |
| Year-end rollover wizard | Strong | `/admin/academic/rollover` |
| Promotion report PDF | Strong | `pdf-promotion` |
| Feed promotion into LURITS maintenance | **Gap** | No export of promotion batch |
| Progressive / conditional promote / retain workflows for SGB packs | Partial | Outcomes exist; packaging for district packs thinner |

### 5.4 Finance — **Partial (fee office Strong; school GL depth Partial)**

| Expected | SchoolHub | Notes |
|---|---|---|
| Fee structures, invoices, debtors | Strong | Collect desk, ledger, reminders |
| Parent online pay | Strong | PayFast / Paystack (+ Ozow/Yoco hooks) |
| Statements & age analysis | Partial | Statements strong; dedicated age-analysis UX thinner than market |
| General ledger | Partial | Income/expenses ledger present; not full GAAP chart/cash book |
| Creditors / suppliers AP | Partial | Suppliers/expenses exist; AP depth lighter |
| Budget planning | **Gap** | No budget module |
| Finance “projects” (tours, civvies, ad hoc pay) | Partial | Charges/aid exist; project fundraising UX not first-class |
| Fee exemption (SASA) workflows | **Gap** | Scholarships/discounts ≠ statutory exemption process |
| SGB finance packs | Partial | CSV/PDF reports; not a dedicated SGB pack |

### 5.5 Report cards — **Strong / Partial**

| Expected | SchoolHub | Notes |
|---|---|---|
| Branded PDF report cards | Strong | Snapshot + publish + fee hold |
| Teacher remarks | Partial | Comments field; no structured remark banks / learning-outcome comments |
| CAPS symbols | Strong | Grades 1–7 |
| IEB / Cambridge / SNE report variants | **Gap** | Curriculum enum includes CAPS/NSC/TVET/CUSTOM; not full framework packs |
| Parent/learner portal download | Strong | With clearance holds |

### 5.6 Online admissions — **Lead (deepen to “fully digital”)**

| Expected | SchoolHub | Differentiation opportunity |
|---|---|---|
| Online application form | Strong | `/apply` |
| Status tracker | Strong | Public reference |
| Document upload | Strong | `ApplicationDocument` |
| Waitlist / review workflow | Strong | Admissions officer portal |
| Interview / document-outstanding states | Strong | Status machine |
| Parent account auto-provision on accept | Partial | Enrolment path exists; tighten end-to-end |
| Fee deposit + online pay on offer | Partial | Finance exists; wire to offer acceptance |
| Digital offer letter + e-sign / accept | Partial → Lead | Letters exist; make offer→enrol one click |
| Multi-campus programme select | Strong | Campus + grade/course |

**“Fully digital admissions” target:** apply → upload → review → interview → offer → pay deposit → auto-enrol → portal credentials — zero paper re-key.

### 5.7 Communications — **Partial**

| Expected | SchoolHub | Notes |
|---|---|---|
| Announcements | Strong | Role-filtered |
| In-app messaging | Strong | Privacy controls |
| Email / SMS | Strong | SendGrid / Twilio / REST SMS |
| Absence & fee reminders | Strong | Automated rules |
| Targeted groups (grade/class/activity) | Partial | Audience filters; less rich than dedicated communicator apps |
| Native parent mobile app / push | **Gap** (by choice) | Browser-first; do not chase app store unless sold |
| Polls / rich media newsletter | Gap | Not core; keep optional |

**Positioning:** Prefer **one record, audited channels** over WhatsApp-style sprawl (already in marketing talk track).

### 5.8 Permissions — **Strong**

| Expected | SchoolHub | Notes |
|---|---|---|
| Role portals | Strong | Matrix in project plan |
| Action-level permissions | Strong | `permissions.ts` + Super Admin |
| Module licensing | Strong | Feature flags per school |
| Finance ≠ payroll leakage | Strong | Documented |
| Parent scoped to linked children | Strong | Parent scope helpers |

**Minor gaps:** finer “EMIS officer” / “SGB read-only finance” personas; bilingual labels for permission names.

---

## 6. Differentiation strategy (where SchoolHub should win)

Do **not** compete as “another d6”. Compete as **SIS + full LMS + public digital campus + college**, with **honest SaaS pricing**.

### 6.1 Full LMS student experience — **Lead → Double down**

Already present: assignments, multi-file submissions, grading/feedback, materials, lesson plans, online exams, progress, downloads, messages.

**Next bets:**
1. Assignment rubric / late policies polish and parent visibility of homework status  
2. Learning path per subject (materials → homework → assessment → results) as one student timeline  
3. Offline-friendly draft continuity for learners on poor connectivity (mirrors educator autosave)  
4. College: module outcomes + continuous assessment weights in the same learner UX  

### 6.2 Assignment submissions & learning materials — **Lead**

Keep as demo centrepiece vs admin-first competitors: teacher issues → student submits → grade + feedback → parent sees status — without leaving SchoolHub.

### 6.3 Fully digital admissions — **Lead**

Ship a single **Admissions Pipeline** view: stages, SLA timers, document checklist, offer PDF, deposit payment link, one-click enrol into active session/class.

### 6.4 Integrated institution website — **Lead**

Public site already ships (home, about, programmes, fees, news, calendar, gallery, contact, apply).

**Next bets:** CMS completeness, SEO per campus, events synced from academic calendar, “Apply” always in sync with open intake sessions — so schools cancel the second website vendor.

### 6.5 College / TVET support — **Lead**

Terminology layer, programmes/modules, semesters, certificates, online exams.

**Next bets:** NQF level on programmes, results statements for DHET-style needs (without claiming DHET certification), sponsor portal language parity with parents, cohort/block intake.

### 6.6 Transparent SaaS pricing — **Lead vs quote-only culture**

Marketing already suggests packages (Core Campus → Family → Fees → Professional → College → Group) but **published ZAR price cards are not in-repo**.

**Recommended public packaging:**

| Tier | Includes (summary) | Pricing principle |
|---|---|---|
| **Core Campus** | Records, academics, attendance, assessments, website, reports, backup | Per active learner / month, published band |
| **Family** | + parent & learner portals, messaging | Add-on % or fixed uplift |
| **Fees** | + collect desk, PayFast/Paystack, statements, debtors, reminders | Add-on |
| **Professional** | Family + Fees + HR/payroll + SMS bundle | Bundle discount |
| **College** | Professional + modules/exams/certificates language | Same base + college flag |
| **Compliance Pack** | SA-SAMS export, LURITS feedback, CEMIS (WCape) | Paid add-on — fund P0 work |
| **Group** | Multi-institution Super Admin + licence server | Per campus + volume discount |

Publish: learner bands, what is metered (SMS, storage), implementation fee vs self-serve, and what is **not** included (WhatsApp, biometric hardware, AI). Opacity is a competitor weakness; clarity is the wedge for independent schools and small colleges.

---

## 7. Prioritised roadmap (product, not calendar estimates)

### Wave A — Sell to public / WCape without embarrassment (P0)
1. EMIS-mandatory fields on learner/educator + validation  
2. Compliance Centre (completeness scores, blocking issues)  
3. SA-SAMS **export** pipeline (start with documented tabular/DB format schools actually deploy; finish native adapter when sample DB arrives)  
4. LURITS feedback import + persist LURITS numbers  
5. CEMIS export path for Western Cape marks (scoped MVP)

### Wave B — Year-end & finance trust (P1)
1. Promotion batch export aligned to LURITS promotion maintenance  
2. Debtors age analysis + SGB finance pack PDFs  
3. Budget + finance projects (tours/levies)  
4. SASA fee-exemption workflow (if selling into fee-paying public schools)

### Wave C — Differentiation amplification (parallel, marketing-led)
1. Admissions pipeline → offer → deposit → enrol  
2. Student LMS timeline UX polish  
3. Website CMS depth + intake sync  
4. Public pricing page + licence-aligned packages  
5. Optional discipline module (only if independent-school deals require parent conduct visibility)

### Explicit non-goals (near term)
- Rebuilding a d6 Communicator-style native app  
- Claiming to **replace** SA-SAMS as the DBE filing tool  
- Feature-matching every IEB/Cambridge report variant before Compliance Pack ships  

---

## 8. Competitive talk track (updated)

**Close the compliance story honestly**  
“SchoolHub runs the school every day. For DBE submissions we give you a Compliance Centre and SA-SAMS/LURITS-ready export and feedback import — so you are not retyping learners into a second system.”

**Win the demo**  
Learner portal: assignment submit → materials → exam → report download. Then admissions apply→status. Then public website. Then college terminology switch. Then show the price card.

**Against quote-only incumbents**  
“Published SaaS packages. Turn modules on when you need them. Colleges and schools on one platform.”

---

## 9. Traceability to SchoolHub docs

| Topic | Primary internal refs |
|---|---|
| Live modules | `docs/MARKETING.md` |
| Delivery phases | `docs/PROJECT_PLAN.md` |
| SA-SAMS import / licence / backup | `docs/ENTERPRISE_LICENSING_BACKUP_SASAMS.md` |
| Schema entities | `prisma/schema.prisma` (`Student`, `Application`, `Assignment*`, `Promotion*`, `ReportCard`) |
| Permissions | `src/lib/permissions.ts` |
| Learner LMS routes | `src/app/(portals)/student/*` |

---

## 10. Summary scorecard

| Domain | vs SA expected bar | vs differentiation ambition |
|---|---|---|
| SA-SAMS / LURITS / CEMIS | **Gap (P0)** | Must fund Compliance Pack |
| Learner/parent records | Partial | Add EMIS fields; optional discipline |
| Year-end / promotion | Ops Strong / EMIS Gap | Wire to LURITS |
| Finance | Fee office Strong | Deepen GL/budget/projects |
| Report cards | Strong | Framework variants later |
| Online admissions | Strong → Lead | Fully digital pipeline |
| Communications | Partial | Keep audited channels; skip app race |
| Permissions | Strong | Niche personas |
| LMS student experience | **Lead** | Double down |
| Institution website | **Lead** | Deepen CMS |
| College / TVET | **Lead** | NQF / cohort polish |
| Transparent SaaS pricing | **Lead (if published)** | Ship public price bands |

**Bottom line:** Treat d6 as the checklist for **South African administrative and compliance expectations**. Close the **export/compliance** hole first. Differentiate everywhere else with **LMS + digital admissions + website + college + transparent pricing** — strengths SchoolHub already has in product form.
