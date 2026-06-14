import { $ } from 'bun';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

import { vars, requireEnv, sh } from './lib';

const { GH_PAT, PR_NUMBER, RUN_ID, TEST_REPO } = requireEnv(
  'GH_PAT',
  'PR_NUMBER',
  'RUN_ID',
  'TEST_REPO',
);
const RUN_ATTEMPT = process.env.RUN_ATTEMPT ?? '1';
const HOST = vars.lfs.server;
const LFS_URL = `https://${HOST}/${TEST_REPO}`;
const BRANCH = `ci/pr-${PR_NUMBER}-${RUN_ID}-${RUN_ATTEMPT}`;
const FILE = `ci-${RUN_ID}-${RUN_ATTEMPT}.bin`;
const COMMIT_MSG = `ci: e2e test PR #${PR_NUMBER} run ${RUN_ID}`;
const CRED_HELPER = '!f() { echo "username=x-access-token"; echo "password=$GH_PAT"; }; f';

describe('e2e LFS push', () => {
  beforeAll(async () => {
    await sh($`git lfs install`);
    await sh(
      $`git clone --quiet \
        https://x-access-token:${GH_PAT}@github.com/${TEST_REPO}.git \
        test-repo`.env({ ...process.env, GIT_LFS_SKIP_SMUDGE: '1' }),
    );
    $.cwd('test-repo');
    await sh($`git config lfs.url ${LFS_URL}`);
    await sh($`git config credential.https://${HOST}.helper ${CRED_HELPER}`);
  });

  afterAll(async () => {
    await $`git push origin --delete refs/heads/${BRANCH}`.nothrow().quiet();
  });

  test('lfs.url matches vars.lfs.server', async () => {
    const url = (await sh($`git config lfs.url`)).stdout.toString().trim();
    expect(url).toBe(LFS_URL);
  });

  test('commit fresh LFS-tracked file', async () => {
    await Bun.write(
      `test-repo/${FILE}`,
      `ci pr-${PR_NUMBER} run-${RUN_ID} ${new Date().toISOString()}\n`,
    );
    await sh($`git add ${FILE}`);
    await sh($`git -c user.email=ci@git-lfs-hub.local -c user.name=lfs-hub-ci \
                commit --quiet -m ${COMMIT_MSG}`);
    const head = (await sh($`git log -1 --format=${'%h'}`)).stdout.toString().trim();
    expect(head).toMatch(/^[0-9a-f]+$/);
  });

  test('push branch + LFS objects to Worker', async () => {
    const out = (
      await sh($`git push --porcelain origin HEAD:refs/heads/${BRANCH}`)
    ).stdout.toString();
    expect(out, 'push output must reference the new branch').toContain(BRANCH);
  });
});
