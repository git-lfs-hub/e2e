import { describe, test, expect, beforeAll } from 'vitest';

import { encryptSession } from '@git-lfs-hub/lib/auth/session';

import { vars, requireEnv } from './lib';

const { GH_PAT, ADMIN_LOGIN_SECRET, TEST_REPO } = requireEnv(
  'GH_PAT',
  'ADMIN_LOGIN_SECRET',
  'TEST_REPO',
);
const BASE_URL = `https://${new URL(vars.github.adminHome).host}`;
const [STAGING_ORG, TEST_REPO_NAME] = TEST_REPO.split('/'); // bot admins this throwaway org only
// production org; bot is never an admin here
const REAL_ORG = (vars.github.orgs?.split(' ')[0] ?? vars.github.org)!;

describe('e2e admin', () => {
  let Cookie: string;

  beforeAll(async () => {
    const cookieValue = await encryptSession({ access: GH_PAT }, ADMIN_LOGIN_SECRET, 86400);
    expect(cookieValue, 'encryptSession returned empty').toBeTruthy();
    Cookie = `gh_session_v2=${cookieValue}`;
    // Smoke tests run seconds after CD redeploys; the first request to the REGISTRY DO
    // races Cloudflare's post-deploy cold start and 500s. Warm it before asserting.
    for (let i = 0; i < 10; i++) {
      if ((await req('/api/repos', true)).status < 500) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  async function req(path: string, withCookie: boolean, method = 'GET') {
    const r = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: withCookie ? { Cookie } : {},
      redirect: 'manual',
    });
    return { status: r.status, body: await r.text() };
  }

  test.each(['/api/me', '/api/repos'])('GET %s without session → 401', async (path) => {
    const { status } = await req(path, false);
    expect(status, '200 means /api auth is bypassed').toBe(401);
  });

  test('GET /api/me with admin session → 200 + admin login + scoped orgs', async () => {
    const { status, body } = await req('/api/me', true);
    expect(status, body).toBe(200);
    const me = JSON.parse(body);
    expect(me.admin, 'admin login missing — PAT user not org admin?').toBeTruthy();
    // The CI bot is an owner of the throwaway staging org only — never the real org.
    expect(me.orgs, 'orgs[] missing').toContain(STAGING_ORG);
    expect(me.orgs, 'bot must not be an admin of the real org').not.toContain(REAL_ORG);
  });

  test('GET /api/repos with admin session → 200 + repos array', async () => {
    const { status, body } = await req('/api/repos', true);
    expect(status, body).toBe(200);
    expect(Array.isArray(JSON.parse(body).repos)).toBe(true);
  });

  test('GET /api/storage with admin session → 200 + storage array', async () => {
    const { status, body } = await req('/api/storage', true);
    expect(status, body).toBe(200);
    expect(Array.isArray(JSON.parse(body).storage)).toBe(true);
  });

  // Per-org scoping. Both probes hit `backup`. On staging this starts a real backup workflow
  // (202); the no-admin org is rejected by the guard before any work (403).
  test('mutation on an org the bot admins (staging) passes the owner guard', async () => {
    const { status, body } = await req(`/api/storage/${TEST_REPO}/backup`, true, 'POST');
    expect(status, body).not.toBe(403); // guard admits; 202 (started), 404 (no prefix), 409 (busy)
    expect([202, 404, 409], body).toContain(status);
  });

  test('mutation on an org the bot does not admin (real org) → 403', async () => {
    const { status, body } = await req(
      `/api/storage/${REAL_ORG}/${TEST_REPO_NAME}/backup`,
      true,
      'POST',
    );
    expect(status, body).toBe(403);
  });

  test('POST /api/reconcile with admin session → 202', async () => {
    const { status, body } = await req('/api/reconcile', true, 'POST');
    expect(status, body).toBe(202);
    expect(JSON.parse(body).status).toBe('reconciling');
  });

  test('GET / serves the SPA shell (public, no session) → 200', async () => {
    const { status, body } = await req('/', false);
    expect(status, body.split('\n').slice(0, 50).join('\n')).toBe(200);
    expect(body).toContain('<div id="app">');
  });
});
