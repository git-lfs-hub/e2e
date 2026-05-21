#!/usr/bin/env bash
set -euo pipefail

: "${GH_PAT:?}"
: "${LFS_URL:?}"
: "${PR_NUMBER:?}"
: "${RUN_ID:?}"

export GH_PAT  # credential helper subprocess reads from env

BRANCH="ci/pr-${PR_NUMBER}-${RUN_ID}"
STAGING_HOST="$(echo "$LFS_URL" | sed -E 's#^https?://([^/]+)/.*#\1#')"

git lfs install
GIT_LFS_SKIP_SMUDGE=1 git clone \
  "https://x-access-token:${GH_PAT}@github.com/git-lfs-hub/test.git" test-repo
cd test-repo

git config lfs.url "$LFS_URL"
git config "credential.https://${STAGING_HOST}.helper" \
  '!f() { echo "username=x-access-token"; echo "password=$GH_PAT"; }; f'

FILE="ci-${RUN_ID}.bin"
printf 'ci pr-%s run-%s %s\n' "$PR_NUMBER" "$RUN_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$FILE"
git add "$FILE"
git -c user.email=ci@git-lfs-hub.local -c user.name="lfs-hub-ci" \
  commit -m "ci: staging test PR #${PR_NUMBER} run ${RUN_ID}"
git push origin "HEAD:refs/heads/${BRANCH}"
