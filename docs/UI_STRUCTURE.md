# SchoolHub SA — UI Structure

Professional SaaS dashboard design optimised for South African schools.

---

## Design System

### Colour Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#1B4D6E` | Sidebar, buttons, links |
| `--primary-light` | `#2A6F9E` | Hover states |
| `--accent` | `#E8A317` | Highlights, badges, CTAs |
| `--success` | `#16A34A` | Paid, present, active |
| `--warning` | `#D97706` | Overdue, late |
| `--danger` | `#DC2626` | Absent, rejected |
| `--background` | `#F1F5F9` | Page background |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--muted` | `#64748B` | Secondary text |
| `--border` | `#E2E8F0` | Dividers |

### Typography
- **Font:** Inter (via Google Fonts) — clean, readable on mobile
- **Headings:** Semibold, tight tracking
- **Body:** Regular 14–16px

### Components
- Stat cards with icon, value, trend indicator
- Data tables with search, filters, pagination
- Sidebar navigation (collapsible on mobile)
- Breadcrumb header with user menu
- Toast notifications (Sonner)
- Form fields with inline validation

---

## Layout Shell

```
┌─────────────────────────────────────────────────────┐
│  [Logo] SchoolHub SA          [🔔] [👤 User Menu]  │  ← Top bar (mobile: hamburger)
├──────────┬──────────────────────────────────────────┤
│          │  Breadcrumb: Admin / Students            │
│ Sidebar  ├──────────────────────────────────────────┤
│          │                                          │
│ Dashboard│         Main Content Area                │
│ Students │         (cards, tables, forms)           │
│ Staff    │                                          │
│ Classes  │                                          │
│ ...      │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Mobile (< 768px)
- Sidebar becomes slide-over drawer
- Stat cards stack vertically (1 column)
- Tables become card lists with key fields

---

## Portal Navigation

### Admin Portal (`/admin/*`)
```
Dashboard
├── Overview (KPIs, charts)
Students
├── All Students
├── Add Student
├── Applications
Staff
├── Teachers
├── All Staff
Academics
├── Grades & Subjects
├── Classes
├── Courses & Modules
├── Timetable
├── Attendance
├── Assessments
├── Report Cards
Finance
├── Invoices
├── Payments
Communications
├── Announcements
├── Documents
Settings
├── School Profile
├── Campuses
├── Users & Roles
├── Audit Logs
```

### Teacher Portal (`/teacher/*`)
```
Dashboard
My Classes
Timetable
Attendance
Assessments
Marks
Resources
Messages
```

### Student Portal (`/student/*`)
```
Dashboard
Timetable
Subjects / Modules
Assignments
Results
Report Cards
Fees
Attendance
Announcements
Materials
```

### Parent Portal (`/parent/*`)
```
Dashboard
My Children
Attendance
Results
Fees & Statements
Announcements
Messages
```

### Finance Portal (`/finance/*`)
```
Dashboard
Invoices
Payments
Debtors
Scholarships
Reports
Exports
```

---

## Page Templates

### Dashboard Page
1. Welcome banner with school name & current term
2. 4× stat cards (students, staff, fees, attendance)
3. 2-column chart row (enrolment trend, fee collection)
4. Recent activity table

### List Page (e.g. Students)
1. Page title + "Add" button
2. Filter bar (search, grade, status, campus)
3. Data table with actions (view, edit, delete)
4. Pagination footer

### Form Page (e.g. Add Student)
1. Breadcrumb back link
2. Sectioned form (Personal, Academic, Guardian, POPIA)
3. Sticky save/cancel footer
4. Autosave indicator (Phase 5)

### Detail Page (e.g. Student Profile)
1. Header with photo, name, status badge
2. Tab navigation (Overview, Academic, Attendance, Fees, Documents)
3. Tab content panels

---

## Role-Based Dashboard Routing

| Role | Login Redirect |
|------|----------------|
| SUPER_ADMIN | `/admin/dashboard` |
| SCHOOL_ADMIN | `/admin/dashboard` |
| PRINCIPAL | `/admin/dashboard` |
| TEACHER | `/teacher/dashboard` |
| STUDENT | `/student/dashboard` |
| PARENT | `/parent/dashboard` |
| FINANCE_OFFICER | `/finance/dashboard` |
| ADMISSIONS_OFFICER | `/admin/applications` |

---

## Accessibility & UX

- Minimum 44px touch targets on mobile
- High contrast text (WCAG AA)
- Loading skeletons on data fetch
- Empty states with helpful CTAs
- Confirmation dialogs on destructive actions
- ZAR amounts formatted as `R 1 234,56`

*Document version: 1.0 — June 2026*
