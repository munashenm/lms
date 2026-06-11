# SchoolHub SA — Project Plan

**Product:** Modern School Management System for South African institutions  
**Client:** Cyber Developers  
**Stack:** Next.js 16 · React 19 · PostgreSQL · Prisma · JWT Auth  
**Timezone:** Africa/Johannesburg · **Currency:** ZAR

---

## Vision

Replace the legacy Cyber Developers LMS with a clean, fast, mobile-first SaaS platform suitable for:

- Public & private schools (CAPS/NSC)
- Colleges & TVET institutions (NQF modules)
- Training centres

The reference LMS at `lms.cyberdevelopers.co.za` informs feature scope only — SchoolHub SA is a ground-up rebuild with modern UX, POPIA compliance, and multi-school tenancy.

---

## Development Phases

### Phase 1 — Foundation ✅
- [x] Project scaffolding & folder structure
- [x] Database schema (Prisma)
- [x] UI design system & layout shell
- [x] Authentication (JWT + httpOnly cookies)
- [x] Role-based access control (RBAC)
- [x] Admin dashboard with KPI cards & charts
- [x] Student management (list, create, view)
- [x] Seed demo data
- [x] Docker Compose for PostgreSQL

### Phase 2 — Academic Core ✅
- [x] Teacher/Lecturer portal (dashboard, classes, timetable, attendance)
- [x] Student portal (dashboard, timetable, subjects, attendance)
- [x] Class, grade, subject & module management
- [x] Timetable builder
- [x] Attendance capture (daily bulk marking)
- [x] Announcements (create + role-filtered views)
- [x] Staff listing page

### Phase 3 — Assessment & Academics ✅
- [x] Assessments, assignments & submissions
- [x] Marks capture & CAPS grade symbols (1–7)
- [x] Report card PDF generation (pdf-lib)
- [x] Document upload & learning materials
- [x] Online application portal (/apply)

### Phase 4 — Finance & Parents ✅
- [x] Fee structures & invoicing (line items, discounts/scholarships)
- [x] Payment recording (Cash, EFT, Card, PayFast/Ozow/Yoco-ready)
- [x] Parent/Guardian portal (children, fees, attendance, results)
- [x] Finance Officer portal (dashboard, invoices, payments, debtors)
- [x] Admin finance module (overview, invoices, debtors)
- [x] Student fees view
- [x] Debtor reports (aggregated by student)

### Phase 5 — Polish & Scale ✅
- [x] Reports & analytics (`/admin/reports` with CSV export)
- [x] In-app notifications (bell + triggers on invoices, payments, applications)
- [x] School settings page with POPIA consent text
- [x] Offline draft autosave (attendance & marks — localStorage)
- [x] PayFast gateway stub + ITN webhook
- [x] Real dashboard chart data from database
- [x] Multi-school overview for Super Admin settings
- [ ] Live email/SMS (SendGrid/Twilio) — wire `logOutboundMessage` in production
- [ ] Ozow / Yoco live integration
- [ ] PDF report exports (CSV done; PDF in future iteration)

### Phase 6 — Public Website & Admissions ✅
- [x] Public marketing site (`/`, `/about`, `/programmes`, `/fees`, `/contact`)
- [x] Shared public shell (header, footer, staff login CTA)
- [x] Application status tracker (`/apply/status` + public API)
- [x] Email/SMS confirmation on application submit (via `logOutboundMessage`)
- [x] Status update notifications when admissions changes application status
- [x] Contact form with outbound email logging
- [x] Apply page integrated with public navigation
- [x] SEO metadata, sitemap.xml, robots.txt, branded 404 page
- [x] Admin admissions polish (waitlist, copy ref, public status link)
- [x] Structured outbound logging (Railway-ready; SendGrid/Twilio env hooks)

### Phase 7 — Suggested Next
- [ ] Certificates of completion / graduation documents
- [ ] Timetable v2 (student view enhancements, room conflicts)
- [ ] HR leave applications & staff attendance
- [ ] Full income/expense accounting (beyond student fees)
- [ ] Live SendGrid/Twilio integration
- [ ] Ozow / Yoco live payment integration

---

## Role Matrix

| Role | Portal | Key Permissions |
|------|--------|-----------------|
| Super Admin | Platform | All schools, system config |
| School Admin | Admin | Full school management |
| Principal | Admin | Oversight, reports, staff |
| Teacher | Teacher | Classes, marks, attendance |
| Student | Student | Own academic & fee data |
| Parent | Parent | Linked children's data |
| Finance Officer | Finance | Invoices, payments, debtors |
| Admissions Officer | Admin | Applications, enrolments |

---

## South African Compliance

| Requirement | Implementation |
|-------------|----------------|
| POPIA | Consent timestamps, audit logs, data minimisation |
| SA ID | 13-digit Luhn validation on capture |
| Phone | 10-digit starting with 0 |
| CAPS/NSC | Grade phases, subject codes, term structure |
| TVET/NQF | Course → Module hierarchy |
| ZAR | Decimal(12,2) amounts, `R` formatting |
| Timezone | `Africa/Johannesburg` default |
| Load-shedding | Autosave drafts, optimistic UI, offline queue (Phase 5) |

---

## Folder Structure

```
schoolhub-sa/
├── docs/                    # Architecture & planning
├── prisma/
│   ├── schema.prisma        # Full data model
│   ├── seed.ts              # Demo data
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, forgot password
│   │   ├── (portals)/
│   │   │   ├── admin/       # School administration
│   │   │   ├── teacher/     # Lecturer portal
│   │   │   ├── student/     # Learner portal
│   │   │   ├── parent/      # Guardian portal
│   │   │   └── finance/     # Billing portal
│   │   └── api/             # REST API routes
│   ├── components/
│   │   ├── ui/              # Reusable primitives
│   │   ├── layout/          # Sidebar, header, shell
│   │   └── dashboard/       # Charts, stat cards
│   ├── lib/                 # Auth, DB, RBAC, validators
│   └── generated/prisma/    # Prisma client output
└── public/
```

---

## API Routes (Planned)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/students` | List / create students |
| GET/PATCH/DELETE | `/api/students/[id]` | Student CRUD |
| GET | `/api/dashboard/stats` | Admin KPIs |

---

## Demo Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@cyberdevelopers.co.za` | `Admin@2026` |
| School Admin | `admin@college.co.za` | `admin123` |
| Principal | `principal@college.co.za` | `principal123` |
| Teacher | `lecturer@college.co.za` | `lecturer123` |
| Student | `student@college.co.za` | `student123` |
| Parent | `parent@college.co.za` | `parent123` |
| Finance | `finance@college.co.za` | `finance123` |

---

## Success Criteria

1. Faster page loads than legacy LMS (< 2s on 3G)
2. Fully responsive on mobile (320px+)
3. Role-appropriate dashboards with zero clutter
4. POPIA audit trail on all student data changes
5. Ready for multi-school SaaS deployment

*Document version: 1.0 — June 2026*
