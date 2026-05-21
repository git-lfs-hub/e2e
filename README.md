# git-lfs-hub/staging

Scripts that test a deployed `lfs-server-staging` Worker from CI.

Consumed by [`git-lfs-hub/deploy`](https://github.com/git-lfs-hub/deploy) as a git submodule at `deploy/staging/`. Workflows live in `deploy`; this repo is **scripts only** for v1.

| File | Run by | What it does |
|------|--------|---------------|
| `mint-session-cookie.ts` | `docs-test.sh` | Encrypts `{ token: GH_PAT }` with `LOGIN_SECRET` → `gh_session_v2` cookie value |
| `docs-test.sh` | `staging-test` job in `deploy/.github/workflows/pr.yml` | Tier 2: authenticated HTML + assets + unauth 302 redirect |
| `lfs-push-test.sh` | same | Real `git lfs push` against staging Worker to `git-lfs-hub/test` repo |

## Required environment

| Variable | Used by | Source in CI |
|----------|---------|--------------|
| `STAGING_URL` | `docs-test.sh` | `https://${vars.lfs.server}` from rendered `vars.json` |
| `DOCS_TITLE` | `docs-test.sh` | `vars.title` from rendered `vars.json` |
| `LFS_URL` | `lfs-push-test.sh` | `${STAGING_URL}/git-lfs-hub/test` |
| `GH_PAT` | both | `secrets.GLH_STAGING_GITHUB_PAT` |
| `LOGIN_SECRET` | `docs-test.sh` | `secrets.GLH_STAGING_LOGIN_SECRET` (must match Worker secret) |
| `PR_NUMBER`, `RUN_ID` | `lfs-push-test.sh` | `github.event.pull_request.number`, `github.run_id` |

## Local smoke run

From a `deploy` checkout with submodules:

```sh
export STAGING_URL=https://lfs-server-staging.pasha-1dc.workers.dev
export DOCS_TITLE="Git LFS Hub Hub"   # whatever vars.json `title` renders to
export GH_PAT=ghp_...
export LOGIN_SECRET=<64-hex>

./staging/docs-test.sh

export LFS_URL="$STAGING_URL/git-lfs-hub/test"
export PR_NUMBER=local
export RUN_ID=$(date +%s)
./staging/lfs-push-test.sh
```

## Cross-repo import

`mint-session-cookie.ts` imports `encryptCode` from `../server/src/login/utils.ts` (the `server` submodule in `deploy`). It runs under Bun on a CI runner; `utils.ts` only depends on `jose`, no Workers runtime needed.

If `server/src/login/utils.ts` is moved or its `encryptCode` signature changes, this script must be updated in lockstep.
