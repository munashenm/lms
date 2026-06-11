# SchoolHub SA — Database Schema

PostgreSQL database designed for multi-tenant SaaS with `schoolId` scoping on all tenant data.

---

## Entity Relationship Overview

```mermaid
erDiagram
    School ||--o{ Campus : has
    School ||--o{ User : employs
    School ||--o{ Student : enrolls
    School ||--o{ Teacher : employs
    School ||--o{ Grade : defines
    School ||--o{ Subject : offers
    School ||--o{ Course : offers
    School ||--o{ Class : runs
    School ||--o{ Invoice : bills
    School ||--o{ Announcement : publishes
    School ||--o{ AuditLog : tracks

    Course ||--o{ Module : contains
    Grade ||--o{ Subject : maps
    Class ||--o{ ClassSubject : teaches
    Class ||--o{ ClassTeacher : assigned
    Class ||--o{ TimetableSlot : schedules

    Student ||--o{ StudentGuardian : linked
    Guardian ||--o{ StudentGuardian : linked
    Student ||--o{ AttendanceRecord : tracked
    Student ||--o{ Mark : receives
    Student ||--o{ Invoice : billed
    Student ||--o{ ReportCard : receives

    Assessment ||--o{ Mark : scored
    Assessment ||--o| Assignment : optional
    Invoice ||--o{ InvoiceLineItem : contains
    Invoice ||--o{ Payment : receives

    AcademicYear ||--o{ Term : contains
    AcademicYear ||--o{ Class : scopes
    Term ||--o{ Assessment : scopes
```

---

## Core Tables

### `schools`
Multi-tenant root. Each school/college/TVET is an isolated tenant.

| Column | Type | Notes |
|--------|------|-------|
| institutionType | enum | SCHOOL, COLLEGE, TVET, TRAINING_CENTRE |
| curriculumType | enum | CAPS, NSC, TVET_NQF, CUSTOM |
| timezone | string | Default `Africa/Johannesburg` |
| currency | string | Default `ZAR` |
| popiaConsentText | text | Customisable consent wording |

### `users`
Authentication identity. `schoolId` is null for Super Admin.

| Column | Type | Notes |
|--------|------|-------|
| role | enum | 8 roles (see PROJECT_PLAN.md) |
| passwordHash | string | bcrypt, cost factor 12 |

### `students`
Learner records. May link to `users` for portal access.

| Column | Type | Notes |
|--------|------|-------|
| studentNumber | string | Unique per school |
| saIdNumber | string | 13-digit SA ID (POPIA sensitive) |
| popiaConsentAt | datetime | Consent timestamp |
| status | enum | APPLICANT → ACTIVE → GRADUATED |

---

## Academic Tables

| Table | Purpose |
|-------|---------|
| `academic_years` | e.g. "2026" |
| `terms` | Term 1–4 (schools) or Semester 1–2 (colleges) |
| `grades` | Grade 8–12, NQF levels |
| `subjects` | CAPS subjects linked to grades |
| `courses` | College/TVET programmes |
| `modules` | Course subdivisions with credits |
| `classes` | Physical/virtual class groups |
| `class_subjects` | Subject assigned to class + teacher |
| `class_teachers` | Homeroom / class teacher assignment |
| `timetable_slots` | Weekly schedule grid |
| `enrolments` | Student ↔ course/year linkage |

---

## Assessment Tables

| Table | Purpose |
|-------|---------|
| `assessments` | Tests, exams, assignments |
| `assignments` | Submission-enabled assessments |
| `assignment_submissions` | Student work |
| `marks` | Scores per student per assessment |
| `report_cards` | Term/year summaries with PDF URL |

---

## Finance Tables

| Table | Purpose |
|-------|---------|
| `invoices` | Student billing documents |
| `invoice_line_items` | Fee breakdown lines |
| `payments` | Cash, EFT, PayFast, Ozow, Yoco |

Amounts use `Decimal(12, 2)` for ZAR precision.

---

## Compliance Tables

| Table | Purpose |
|-------|---------|
| `audit_logs` | POPIA-compliant action trail |
| `documents` | Uploaded files with type classification |
| `applications` | Online admission workflow |

---

## Indexing Strategy

- All `schoolId` foreign keys indexed for tenant isolation
- Composite unique constraints scoped per school (`schoolId + code`)
- `audit_logs` indexed by `(schoolId, createdAt)` for reporting
- `attendance_records` unique on `(studentId, date, classId)`

---

## Multi-School SaaS Model

```
Super Admin (no schoolId)
    └── School A (tenant)
    └── School B (tenant)
    └── School C (tenant)
```

Every query from tenant users includes `WHERE schoolId = ?` enforced at the API layer via RBAC middleware.

*See `prisma/schema.prisma` for the authoritative schema definition.*
