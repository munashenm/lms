# SchoolHub SA — Licensing, Backup/Restore & SA-SAMS

Enterprise modules added on top of the existing multi-tenant LMS. Existing portals, finance, academics and auth are unchanged.

## Environment variables

Never commit secrets. Set these on the server (Railway/Docker/.env).

### Licensing (LMS client)

| Variable | Purpose |
|---|---|
| `LICENSE_PUBLIC_KEY` | Ed25519 SPKI PEM used to **verify** signed licences. Required in production. |
| `LICENSE_SERVER_URL` | Central licence server base URL, e.g. `https://licenses.example.com` or `https://app.example.com/api/license-server` |
| `LICENSE_HEARTBEAT_HOURS` | How often to contact the server (default `24`) |
| `LICENSE_OFFLINE_GRACE_DAYS` | Continue on cached licence if the server is unreachable (default `14`) |
| `LICENSE_TRUST_LOCAL` | `true`/`false`. Defaults to true outside production so unsigned local trials work in development |
| `LICENSE_SERVER_INSTANCE_ID` | Optional server instance binding |
| `NEXT_PUBLIC_APP_URL` | Used as the registered domain during activation |

### Licensing (vendor licence server only)

These must **not** be present on customer LMS installations.

| Variable | Purpose |
|---|---|
| `LICENSE_SERVER_ENABLED` | Set `true` to enable `/api/license-server/*` |
| `LICENSE_SIGNING_PRIVATE_KEY` | Ed25519 PKCS8 PEM. Signs licence tokens. |

Generate a key pair:

```bash
node -e "const {generateKeyPair} = require('crypto'); const {publicKey, privateKey} = generateKeyPair('ed25519', {publicKeyEncoding:{type:'spki',format:'pem'}, privateKeyEncoding:{type:'pkcs8',format:'pem'}}); console.log(publicKey); console.log(privateKey);"
```

### Backup & restore

| Variable | Purpose |
|---|---|
| `BACKUP_ENCRYPTION_KEY` | 64-char hex (32 bytes) or passphrase. AES-256-GCM for `.lmsbackup` packages |
| `BACKUP_STORAGE_PROVIDER` | `local` (default) or `s3` |
| `BACKUP_LOCAL_PATH` | Local directory (default `./data/backups`) |
| `BACKUP_S3_ENDPOINT` | S3-compatible endpoint |
| `BACKUP_S3_REGION` | Default `us-east-1` |
| `BACKUP_S3_BUCKET` | Bucket name |
| `BACKUP_S3_ACCESS_KEY_ID` | Access key (server-side only) |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Secret key (server-side only) |
| `BACKUP_S3_FORCE_PATH_STYLE` | Default `true` |

### SA-SAMS imports

| Variable | Purpose |
|---|---|
| `IMPORT_ENCRYPTION_KEY` | Optional; falls back to `BACKUP_ENCRYPTION_KEY` |
| `IMPORT_TEMP_DIR` | Encrypted staging files (default `./data/imports`) |
| `IMPORT_MAX_FILE_BYTES` | Default 50MB |
| `IMPORT_FILE_TTL_HOURS` | Auto-delete temp files (default 24) |

### Existing

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | Session signing |
| `CRON_SECRET` | Authorises `/api/cron/*` |

## Cron endpoints

All require `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret` / `?secret=`).

- `GET /api/cron/license-heartbeat`
- `GET /api/cron/backups`
- `GET /api/cron/import-cleanup`
- `GET /api/cron/fee-reminders` (existing)

## Public API (authenticated)

### Licence
- `GET /api/license`
- `POST /api/license` activate
- `POST /api/license/check`

### Vendor licence server
- `POST /api/license-server/v1/licenses/check`
- `GET/POST /api/license-server/v1/licenses` (Super Admin)

### Backups
- `GET /api/backups`
- `POST /api/backups` create cloud/offline
- `PATCH /api/backups` schedules
- `GET /api/backups/:id?download=1`
- `POST /api/backups/:id` verify
- `DELETE /api/backups/:id`
- `GET/POST /api/restore`

### SA-SAMS
- `GET /api/integrations/sasams`
- `POST /api/integrations/sasams` (multipart upload or JSON actions)
- `GET /api/integrations/sasams/:id`

### Health
- `GET /api/system-health`

## UI

- Settings → Licence (`/admin/settings/licence`)
- Super Admin → Issue licences (`/admin/settings/licence-server`)
- Settings → Backup & Restore (`/admin/settings/backup`)
- Restore (`/admin/settings/backup/restore`)
- Administration → Integrations → SA-SAMS (`/admin/integrations/sa-sams`)
- System Health (`/admin/system-health`) plus cards on the admin dashboard

Restricted / grace banners appear in every portal shell. Login, licence, backup and contact support remain available. Student, parent and teacher portals honour licence feature flags. Write APIs refuse work in restricted mode except licence and backup routes.

SA-SAMS duplicate detection lets an admin choose Skip, Update existing, Create new, or Review manually per row. Review-manually rows are not imported.

## SA-SAMS native database (placeholder)

The import **engine** is complete for CSV/TSV/JSON/XLSX. A native SA-SAMS database adapter is registered as a **placeholder** (`sa-sams-native-db-placeholder`).

It recognises `.mdb`, `.accdb` and `.bak` files and Access Jet/ACE magic bytes, then stops. Files are **not parsed**. Table names are **not guessed**.

When the authorised sample arrives, implement `parse()` in `src/lib/integrations/sasams/native-database.ts` against that sample only. Mapping, validation, duplicates, execute and rollback stay as they are.

Please include dummy (non-live) data with:

1. SA-SAMS version (Help → About, or installer version).
2. Export type actually used by the school: CSV, Excel workbook, Access `.mdb`/`.accdb`, official backup, or other.
3. One anonymised file per major area if possible: learners, parents/guardians, educators, classes/subjects.
4. If it is a database backup: a schema dump or table list — **do not** send production ID numbers.
5. Confirmation of the provincial system (if any) and whether an official API exists.

## Testing

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Manual checks:

1. Sign in as School Admin → Settings → Licence → Activate / Verify.
2. Create an offline backup and download the `.lmsbackup` file.
3. Validate then restore (confirm the pre-restore backup is created).
4. Upload a CSV of learners in SA-SAMS Migration Centre and walk the wizard.
5. Confirm a second school cannot open the first school's licence, backups or import jobs.
