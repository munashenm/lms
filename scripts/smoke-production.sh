#!/usr/bin/env bash
# Smoke-test a deployed SchoolHub production URL.
# Usage:
#   export APP_URL=https://your-app.up.railway.app
#   export CRON_SECRET=...
#   ./scripts/smoke-production.sh
#
# Optional (deeper checks — requires session cookies / known IDs):
#   export SCHOOL_A_BRANDING_PATH=/uploads/<schoolAId>/branding/logo.png
#   export PRIVATE_STUDENT_PATH=/uploads/<schoolAId>/students/<studentId>/doc.pdf

set -euo pipefail

if [[ -z "${APP_URL:-}" ]]; then
  echo "APP_URL is required (e.g. https://your-app.up.railway.app)" >&2
  exit 1
fi

APP_URL="${APP_URL%/}"
pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  $name"
    pass=$((pass + 1))
  else
    echo "FAIL  $name"
    fail=$((fail + 1))
  fi
}

echo "Smoke testing $APP_URL"
echo

# App is up
check "login page reachable" \
  curl -fsS -o /dev/null -w "%{http_code}" "$APP_URL/login" | grep -qE '200|302|303'

# Cron authorized
if [[ -n "${CRON_SECRET:-}" ]]; then
  check "cron backups authorized" \
    bash -c "code=\$(curl -sS -o /tmp/schoolhub-cron.json -w '%{http_code}' -H \"Authorization: Bearer ${CRON_SECRET}\" \"$APP_URL/api/cron/backups\"); test \"\$code\" = 200 && grep -q '\"ok\":true' /tmp/schoolhub-cron.json"
  check "cron backups rejects bad secret" \
    bash -c "code=\$(curl -sS -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer wrong' \"$APP_URL/api/cron/backups\"); test \"\$code\" = 401"
else
  echo "SKIP  cron checks (set CRON_SECRET)"
fi

# Unauthenticated private upload should not leak
if [[ -n "${PRIVATE_STUDENT_PATH:-}" ]]; then
  check "private student file denied without session" \
    bash -c "code=\$(curl -sS -o /dev/null -w '%{http_code}' \"$APP_URL${PRIVATE_STUDENT_PATH}\"); test \"\$code\" = 404"
else
  echo "SKIP  private file ACL (set PRIVATE_STUDENT_PATH)"
fi

# Branding public
if [[ -n "${SCHOOL_A_BRANDING_PATH:-}" ]]; then
  check "branding publicly reachable" \
    bash -c "code=\$(curl -sS -o /dev/null -w '%{http_code}' \"$APP_URL${SCHOOL_A_BRANDING_PATH}\"); test \"\$code\" = 200"
else
  echo "SKIP  branding public check (set SCHOOL_A_BRANDING_PATH)"
fi

echo
echo "Result: $pass passed, $fail failed"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi

echo
echo "Manual UI checks still required:"
echo "  1) System Health → backups/uploads durableStorageConfigured=true"
echo "  2) School A attendance/timetable with School B classId → no foreign data"
echo "  3) Student B cannot open Student A private upload URL"
echo "  4) Create institution backup; confirm S3 object + no passwordHash in payload"
echo "  5) Railway Postgres Backups tab → schedule + PITR healthy"
