#!/usr/bin/env bash
# Generate production secrets for Railway Variables (do not commit output).
set -euo pipefail

echo "# Paste into Railway → web app service → Variables"
echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "BACKUP_STORAGE_PROVIDER=s3"
echo "UPLOAD_STORAGE_PROVIDER=s3"
echo "BACKUP_ALLOW_LOCAL=false"
echo "UPLOAD_ALLOW_LOCAL=false"
echo "BACKUP_S3_FORCE_PATH_STYLE=true"
echo "BACKUP_S3_REGION=auto"
echo
echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo
echo "# Fill these from Cloudflare R2 (or AWS S3 / Backblaze):"
echo "BACKUP_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
echo "BACKUP_S3_BUCKET=schoolhub-prod"
echo "BACKUP_S3_ACCESS_KEY_ID="
echo "BACKUP_S3_SECRET_ACCESS_KEY="
echo
echo "# Your live app URL (no trailing slash):"
echo "NEXT_PUBLIC_APP_URL=https://<your-app>.up.railway.app"
echo
echo "# Cron service start command (separate Railway service, image curlimages/curl:latest):"
echo '# /bin/sh -c '\''exec curl -fsS -X GET "$APP_URL/api/cron/backups" -H "Authorization: Bearer $CRON_SECRET"'\'''
echo "# Cron schedule (UTC): 0 * * * *"
