# SchoolHub SA

Modern School Management System for South African schools, colleges, TVETs and training centres.

Built by **Cyber Developers** to replace the legacy LMS with a clean, fast, mobile-friendly SaaS platform.

## Features (Phase 1)

- Multi-role authentication (8 roles)
- Admin dashboard with KPIs and charts
- Student management with POPIA consent tracking
- SA ID and phone validation
- ZAR currency formatting
- Audit trail for compliance
- Multi-school SaaS-ready architecture

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT (httpOnly cookies) + bcrypt

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL (Docker)
docker compose up -d

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed demo data
npm run db:seed

# Start development server
npm run dev
```

Without Docker, install PostgreSQL 15+ locally and set `DATABASE_URL` in `.env`.

Open [http://localhost:3000](http://localhost:3000) and sign in with demo credentials.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| School Admin | admin@college.co.za | admin123 |
| Teacher | lecturer@college.co.za | lecturer123 |
| Student | student@college.co.za | student123 |
| Parent | parent@college.co.za | parent123 |
| Finance | finance@college.co.za | finance123 |

## Project Structure

```
docs/           Project plan, database schema, UI structure
prisma/         Schema, migrations, seed data
src/
  app/          Next.js pages and API routes
  components/   UI, layout, dashboard, feature components
  lib/          Auth, RBAC, validators, utilities
  generated/    Prisma client output
```

## Development Phases

| Phase | Status | Modules |
|-------|--------|---------|
| 1 | ✅ In progress | Auth, Admin dashboard, Students |
| 2 | Planned | Teacher/Student portals, Classes, Attendance |
| 3 | Planned | Marks, Assessments, Report cards |
| 4 | Planned | Finance, Invoices, Parent portal |
| 5 | Planned | Analytics, Notifications, Payment gateways |

See `docs/PROJECT_PLAN.md` for the full roadmap.

## South African Compliance

- POPIA consent tracking and audit logs
- 13-digit SA ID validation (Luhn algorithm)
- 10-digit phone validation (starting with 0)
- CAPS/NSC grade phases and TVET NQF modules
- ZAR currency with `en-ZA` locale
- `Africa/Johannesburg` timezone

## License

Proprietary — Cyber Developers © 2026
