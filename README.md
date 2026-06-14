# Git LFS Hub — e2e

[![CI][ci-badge]][gh-wf-href]
[![CodeQL][codeql-badge]][codeql-href]
[![Socket][socket-badge]][socket-href]
[![License][license-badge]][license-href]

The end-to-end test harness that proves each [Git LFS Hub](https://github.com/git-lfs-hub) release works before it ships. A reusable GitHub Actions workflow (`staging.yml`) deploys a throwaway `-staging` Worker, and a vitest suite (`test-docs`, `test-git-lfs`) exercises a real `git lfs push` against it.

For the bigger picture (what the stack does, the deploy flow, the other repos) see the [org overview](https://github.com/git-lfs-hub).

Consumed by [git-lfs-hub/deploy](https://github.com/git-lfs-hub/deploy):

- as a **git submodule** at `deploy/e2e/` — gives test scripts to CI runners
- as a **reusable workflow** at `git-lfs-hub/e2e/.github/workflows/staging.yml@<ref>` — invoked from `deploy/.github/workflows/pr.yml`, re-run as a post-deploy smoke against the production Worker from `deploy/.github/workflows/main.yml`

## Reusable workflow

`.github/workflows/staging.yml` — `workflow_call`, two jobs:

- **`deploy`** — Checks out caller repo at PR head SHA, renders staging vars, sanity-checks Worker name, deploys via `wrangler`.
- **`test`** (needs `deploy`) — Runs `test-docs.test.ts` + `test-git-lfs.test.ts` against the deployed staging Worker.

Both jobs share concurrency group `lfs-server-staging` (queue-depth 1) because they share one Worker resource.

### Caller-side requirements

The workflow takes one input — the caller's existing `GLH_VARS_JSON` — and derives staging values internally by appending `-staging` to `cloudflare.workerName` and `s3.bucket`. **No separate `GLH_STAGING_VARS_JSON` needed.**

- **`inputs.vars-json`** → mutated to `vars.input.json` in both jobs. Caller's `GLH_VARS_JSON` (prod `vars.input.json` contents); workflow appends `-staging` suffix.
- **`secrets.CLOUDFLARE_API_TOKEN`** → `deploy` job env. Wrangler deploy auth.
- **`secrets.TURBO_TOKEN`** → `deploy` job env. Optional Turbo remote cache.
- **`secrets.GLH_STAGING_GITHUB_PAT`** → `test` job env (`GH_PAT`). Write on `git-lfs-hub/test`; org-mode requires `read:org`.
- **`secrets.GLH_STAGING_LOGIN_SECRET`** → `test` job env (`LOGIN_SECRET`). Must match `LOGIN_SECRET` Worker secret on `lfs-server-staging`.
- **`secrets.GLH_STAGING_ADMIN_LOGIN_SECRET`** → `test` job env (`ADMIN_LOGIN_SECRET`). Must match `LOGIN_SECRET` Worker secret on `lfs-admin-staging` (different value from the lfs-server secret).

### Caller example (`deploy/.github/workflows/pr.yml`)

```yaml
staging:
  needs: test
  if: github.event.pull_request.head.repo.full_name == github.repository
  uses: git-lfs-hub/e2e/.github/workflows/staging.yml@main
  with:
    vars-json: ${{ vars.GLH_VARS_JSON || secrets.GLH_VARS_JSON }}
  secrets: inherit
```

### What the workflow assumes about the caller repo

Checkout uses `repository: ${{ github.repository }}` — the caller. Then expects:

- `./.github/actions/init` — installs Bun, renders config artifacts via `bun turbo '//#config'`
- `e2e/` submodule — provides `test-docs.test.ts`, `test-git-lfs.test.ts`, `lib.ts`
- `server/` submodule — provides `server/wrangler.template.jsonc` and source for `wrangler deploy`

## Tests

The vitest suite (`test-docs`, `test-git-lfs`), required environment, local runs, and how to verify changes before they ship are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

[ci-badge]: https://badgen.net/github/checks/git-lfs-hub/e2e/main?icon=bun&label=CI
[gh-wf-href]: https://github.com/git-lfs-hub/e2e/actions/workflows/main.yml?query=branch%3Amain
[codeql-badge]: https://github.com/git-lfs-hub/e2e/actions/workflows/github-code-scanning/codeql/badge.svg
[codeql-href]: https://github.com/git-lfs-hub/e2e/actions/workflows/github-code-scanning/codeql?query=branch%3Amain
[socket-badge]: https://badgen.net/static/Socket/report/blue?icon=socket
[socket-href]: https://socket.dev/dashboard/org/git-lfs-hub/repo/@git-lfs-hub/e2e
[license-badge]: https://badgen.net/github/license/git-lfs-hub/e2e
[license-href]: LICENSE.md
