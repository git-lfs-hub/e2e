#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_URL:?}"
: "${GH_PAT:?}"
: "${LOGIN_SECRET:?}"
: "${DOCS_TITLE:?}"

COOKIE="$(bun staging/mint-session-cookie.ts)"
AUTH_HEADER="Cookie: gh_session_v2=${COOKIE}"

body="$(curl -sS -H "$AUTH_HEADER" "$STAGING_URL/")"
if ! echo "$body" | grep -q "$DOCS_TITLE"; then
  echo "docs title '$DOCS_TITLE' not found in response body:" >&2
  echo "$body" | head -50 >&2
  exit 1
fi

curl -sf -H "$AUTH_HEADER" "$STAGING_URL/tools/git-lfs/" >/dev/null
curl -sf -H "$AUTH_HEADER" "$STAGING_URL/assets/css/docmd-main.css" >/dev/null

code="$(curl -sS -o /dev/null -w '%{http_code}' "$STAGING_URL/")"
test "$code" = "302"
