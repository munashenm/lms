# SchoolHub — Railway production checklist

Use this after merging the production-tenant-hardening PR.  
Do **not** commit real secrets into git.

App release already runs `npx prisma migrate deploy` (`railway.toml` → `releaseCommand`), so migration `20261007220000_require_academic_school_id` applies on the next successful deploy.

---

## 1. Postgres automated backups + PITR

Open your **Postgres** service in Railway (not the web app).

### A. Volume backups (scheduled snapshots)

1. Postgres service → **Backups** (or **Data** → Backups).
2. Enable / confirm an automatic **volume backup schedule**.
3. Prefer at least **daily** retention of several days (Railway UI options vary by plan).
4. Optionally create a **manual backup** now so you have a known restore point before onboarding schools.

Docs: [Postgres backups & restores](https://docs.railway.com/guides/postgres-backups-restores)

### B. Point-in-Time Recovery (recommended)

1. Same Postgres service → **Backups**.
2. Enable **Point-in-Time Recovery / PITR**.
3. Railway creates a private bucket and sets `WAL_ARCHIVE_*` on the service, then redeploys Postgres.
4. Wait until the first base backup completes — the datetime restore picker appears only after that.
5. Note: the restore window starts **from the moment PITR is enabled** (you cannot restore to before enablement).

CLI alternative (if logged in with Railway CLI):

```bash
railway link   # select project + Postgres service
railway postgres pitr status
railway postgres pitr enable --service <postgres-service-name>
railway postgres pitr status
```

Restore later creates a **new sibling** Postgres service at a chosen timestamp; it does not overwrite production automatically.

---

## 2. S3 backup + upload storage

SchoolHub institution backups and school file uploads both use S3-compatible storage in production.

### Recommended: one Cloudflare R2 (or AWS S3 / Backblaze B2) bucket

1. Create a private bucket, e.g. `schoolhub-prod`.
2. Create an API token / access key with read+write on that bucket.
3. Note:
   - Endpoint (R2 example: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
   - Region (often `auto` for R2; use `us-east-1` if a region is required)
   - Bucket name
   - Access key id
   - Secret access key

### Set these on the **web app** Railway service → Variables

```bash
BACKUP_STORAGE_PROVIDER=s3
BACKUP_ENCRYPTION_KEY=<64-char-hex — generate with: openssl rand -hex 32>
BACKUP_S3_ENDPOINT=https://<your-endpoint>
BACKUP_S3_REGION=auto
BACKUP_S3_BUCKET=schoolhub-prod
BACKUP_S3_ACCESS_KEY_ID=<key>
BACKUP_S3_SECRET_ACCESS_KEY=<secret>
BACKUP_S3_FORCE_PATH_STYLE=true

# Uploads follow backup provider when UPLOAD_STORAGE_PROVIDER is empty.
# Explicit is clearer in production:
UPLOAD_STORAGE_PROVIDER=s3
# UPLOAD_S3_* optional — falls back to BACKUP_S3_* above

CRON_SECRET=<64-char-hex — openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=https://<your-production-hostname>
```

Also confirm `DATABASE_URL`, `JWT_SECRET`, and licensing keys are set.

Redeploy the app after saving variables.

---

## 3. Schedule `/api/cron/backups`

School schedules (daily/weekly/monthly) only run when something hits the cron endpoint.

### Option A — dedicated Railway cron service (recommended)

1. In the same Railway project: **New** → **Empty service** / **Docker image**.
2. Image: `curlimages/curl:latest`
3. Variables on this cron service:
   - `CRON_SECRET` = same value as the web app (or `${{ web.CRON_SECRET }}` if using Railway references)
   - `APP_URL` = `https://<your-app-hostname>` (public URL is fine)
4. **Settings → Custom Start Command**:

```bash
/bin/sh -c 'exec curl -fsS -X GET "$APP_URL/api/cron/backups" -H "Authorization: Bearer $CRON_SECRET"'
```

5. **Settings → Cron Schedule** (UTC), e.g. hourly:

```text
0 * * * *
```

6. Deploy. Confirm the service **exits** after curl (Railway cron requires exit).
7. Check web app logs for backup job activity after the first run.

### Manual smoke (any machine)

```bash
curl -fsS -X GET "https://<your-app>/api/cron/backups" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expect JSON like `{ "ok": true, "results": [...] }`.

Also keep these crons if you use them: `/api/cron/license-heartbeat`, `/api/cron/fee-reminders`, `/api/cron/import-cleanup`.

---

## 4. Deploy migration

No separate migrate step if you deploy via Railway with the current `railway.toml`:

```toml
releaseCommand = "npx prisma migrate deploy"
```

1. Merge / deploy the hardening branch.
2. Open the deploy → **Release** logs.
3. Confirm `20261007220000_require_academic_school_id` applied.
4. If the release **fails** with undetermined `schoolId` ownership, stop onboarding and fix orphan rows before retrying (migration intentionally refuses arbitrary school assignment).

---

## 5. Smoke-test after deploy

Use `scripts/smoke-production.sh` (see script header for env vars), or run manually:

### A. System health / storage

1. Sign in as Super Admin or School Admin.
2. Open **System Health** (or `GET /api/system-health`).
3. Confirm:
   - `backups.storageProvider` = `s3`
   - `backups.durableStorageConfigured` = true
   - `backups.configurationError` = null
   - `uploads.storageProvider` = `s3`
   - `uploads.durableStorageConfigured` = true

### B. Tenant isolation

1. Create or use School A and School B.
2. As School A admin, open attendance with School B’s `classId` in the query string → must **not** show School B learners.
3. Same for `/admin/timetable?classId=<school-b-class-id>`.

### C. File ACL

1. Upload a private learner document for Student A.
2. Sign in as Student B → `/uploads/<schoolId>/students/<studentA-id>/...` → **404**.
3. Parent of Student A → allowed for that learner path.
4. Branding `/uploads/<schoolId>/branding/logo.png` → public **200** without login.
5. Payment proof URL as a student → **404**.

### D. Institution backup

1. School Admin → Settings → Backup → create **offline** or **cloud** backup.
2. Download `.lmsbackup` if offline.
3. Confirm job succeeded in UI and object appears under `s3://bucket/<schoolId>/...`.
4. Optional: unpack in a secure environment and confirm payload has `"passwordHash": null` for users.

### E. Cron

1. Trigger cron manually (section 3).
2. Confirm scheduled backup jobs appear for schools with enabled schedules.

---

## Quick “done” definition

| Item | Done when |
|------|-----------|
| Postgres volume backups | Schedule visible on Postgres Backups tab |
| PITR | Status healthy + datetime picker available |
| S3 vars | System health shows durable backup + upload storage |
| Cron | Hourly service succeeds; backups run without manual click |
| Migration | Release log shows migration applied |
| Smoke | Isolation + ACL + backup checks above pass |
