# SchoolHub SA

Modern school management system for South African schools, colleges, TVETs and training centres.

Built by **Cyber Developers**. One platform for admissions, academics, fees (PayFast & Paystack), parent/learner portals, HR/payroll, and the public school website.

**Marketing pack (sales / website / tenders):** [`docs/MARKETING.md`](docs/MARKETING.md) · one-pager [`docs/SALES_ONE_PAGER.md`](docs/SALES_ONE_PAGER.md)

## Product highlights

- Portals for admin, teachers, finance, HR, parents, learners and Super Admin
- CAPS/NSC schools and TVET/college terminology in the same product
- Fee office: collect desk, invoices, EFT verification, statements of account
- Online payments: PayFast and Paystack (server-side verify + webhooks)
- Branded PDFs: invoices, receipts, report cards, certificates, payslips
- POPIA-minded audit logs, SA ID validation, encrypted backup, SA-SAMS import
- Multi-school tenancy with licensed modules

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
docs/           Marketing pack, project plan, schema, UI structure
prisma/         Schema, migrations, seed data
src/
  app/          Next.js pages and API routes
  components/   UI, layout, dashboard, feature components
  lib/          Auth, RBAC, validators, utilities
  generated/    Prisma client output
```

## Documentation

| Document | Use |
|----------|-----|
| [Marketing brief](docs/MARKETING.md) | Website copy, proposals, SGB packs |
| [Sales one-pager](docs/SALES_ONE_PAGER.md) | Email / print leave-behind |
| [Project plan](docs/PROJECT_PLAN.md) | Delivery scope |
| [Licensing, backup, SA-SAMS](docs/ENTERPRISE_LICENSING_BACKUP_SASAMS.md) | Hosting and IT |

See `docs/PROJECT_PLAN.md` for the full delivered module list.

## South African Compliance

- POPIA consent tracking and audit logs
- 13-digit SA ID validation (Luhn algorithm)
- 10-digit phone validation (starting with 0)
- CAPS/NSC grade phases and TVET NQF modules
- ZAR currency with `en-ZA` locale
- `Africa/Johannesburg` timezone

## License

Proprietary — Cyber Developers © 2026
