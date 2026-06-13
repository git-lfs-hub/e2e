# Contributing — e2e

Developer guide for the e2e harness: the vitest suite, the environment it needs,
and how to test changes before they ship.

## Tests (vitest)

- **`test-docs.test.ts`** — Tier 2: authenticated HTML + assets + unauth 302 redirect.
- **`test-git-lfs.test.ts`** — Real `git lfs push` against the deployed Worker to the `TEST_REPO` repo.
- **`lib.ts`** — Shared: typed `vars.json` loader (absolute path), `requireEnv`.

Run from `e2e/` cwd:

```sh
bun run e2e-test
```

Caller workflow uses `working-directory: e2e` + `bun run e2e-test`. Tests pull `STAGING_URL`, `DOCS_TITLE`, `LFS_URL` from `../vars.json` (deploy root) via `lib.vars`.

## Required environment

Tests throw on missing env via `lib.requireEnv` — fail loudly at module load.

- **`GH_PAT`** — both tests. Write on the `TEST_REPO`; org-mode requires `read:org`.
- **`LOGIN_SECRET`** — `test-docs`. Must match the `LOGIN_SECRET` Worker secret on `lfs-server`.
- **`ADMIN_LOGIN_SECRET`** — `test-admin`. Must match the `LOGIN_SECRET` Worker secret on `lfs-admin` (different value from the lfs-server secret).
- **`PR_NUMBER`**, **`RUN_ID`** — `test-git-lfs`; build the branch name + filename.
- **`TEST_REPO`** — `test-git-lfs`; `owner/repo` to clone and push against. From the caller's `GLH_TEST_REPO` repo variable.

## Caller-side `e2e` workspace

The harness is registered as a `bun` workspace in `deploy/package.json`, so root `bun install --frozen-lockfile` installs vitest into `e2e/node_modules`. Fork users must add `"e2e"` to their `package.json` `workspaces` array.

## Cross-repo import

`test-docs.test.ts` imports `encryptSession` from `@git-lfs-hub/lib/auth/session` (the `lib` workspace in `deploy`). The lib package only depends on `jose`, `hono`, and `@octokit/rest`, no Workers runtime needed — runs in vitest's default node environment.

If `@git-lfs-hub/lib`'s `encryptSession` signature changes, `test-docs.test.ts` must be updated in lockstep.

## Testing

How to verify the harness before the CI workflows (`pr.yml`, `main.yml`, `staging.yml`) consume it.

### 1. Local suite run

Runs the vitest suite against an already-deployed Worker. Verifies the test logic only — **not** the workflow YAML wiring.

- Make sure `git-lfs` is installed locally.
- Recommended: set `GH_ENV=dev` to test against the `lfs-server-dev` worker.

1. **Render vars.json.** `vars.json` is rendered by `turbo config` from `vars.input.json` (e.g. `lfs-server.<accountSlug>.workers.dev`). To retarget, edit `vars.input.json` and re-run `turbo config`.
2. **Get the login secrets**: `LOGIN_SECRET` is what you passed for `wrangler secret put LOGIN_SECRET` on `lfs-server`; `ADMIN_LOGIN_SECRET` is the same for `lfs-admin` (different value). Reuse `GLH_LOGIN_SECRET` / `GLH_ADMIN_LOGIN_SECRET` (prod) / `GLH_STAGING_LOGIN_SECRET` / `GLH_STAGING_ADMIN_LOGIN_SECRET` (staging). To skip them, run only the LFS test (step 5, with the filter).
3. **Run from `e2e/`:**
   ```sh
   cd e2e
   PR_NUMBER=local \
   TEST_REPO=git-lfs-hub/test \
   LOGIN_SECRET=<64-hex> \
   ADMIN_LOGIN_SECRET=<64-hex> \
   GH_PAT=$(gh auth token) \
   RUN_ID=$(date +%s) \
   bun e2e-test          # whole suite; needs LOGIN_SECRET + ADMIN_LOGIN_SECRET
   bun --bun run e2e-test test-git-lfs # or, LFS test only (runs w/o LOGIN_SECRET):
   ```
   `TEST_REPO` is the `owner/repo` to push against — swap it to confirm the param flows end-to-end. `PR_NUMBER`/`RUN_ID` only build the branch name (`ci/pr-local-<ts>`) and filename. The test clones the repo, commits an LFS file, and pushes a branch to the Worker.

### 2. Branch-pin a throwaway run

Verifies the full `test-repo` input threading through the reusable workflows (which step 1 can't). `pr.yml`/`main.yml` pin `uses: git-lfs-hub/ci-cd/...@main`, so CI always pulls `ci-cd` **main** — the new plumbing can't run until merged. To exercise an unmerged `ci-cd` branch:

1. On a test/fork deploy repo, change the `@main` refs to `@<your-ci-cd-branch>`.
2. Set the repo variable `GLH_TEST_REPO`.
3. Trigger via `workflow_dispatch` — a real GitHub run against that branch.
4. Revert the pin.

### Merge ordering

`ci-cd` (`e2e.yml`, `staging.yml`, `e2e-test` action) must merge to `main` **before** `pr.yml`/`main.yml` start passing `test-repo` — else callers pass an input the live reusable workflow doesn't declare yet ("invalid input" error). Or land both, then set `GLH_E2E_TEST_REPO` last.
