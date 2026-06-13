import { describe, test, expect, beforeAll } from 'vitest';

import { encryptSession } from '@git-lfs-hub/lib/auth/session';

import { vars, requireEnv } from './lib';

const { GH_PAT, ADMIN_LOGIN_SECRET } = requireEnv('GH_PAT', 'ADMIN_LOGIN_SECRET');
const BASE_URL = `https://${new URL(vars.github.adminHome).host}`;

describe('e2e admin', () => {
  let Cookie: string;

  beforeAll(async () => {
    const cookieValue = await encryptSession({ access: GH_PAT }, ADMIN_LOGIN_SECRET, 86400);
    expect(cookieValue, 'encryptSession returned empty').toBeTruthy();
    Cookie = `gh_session_v2=${cookieValue}`;
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

  test('GET /api/me with admin session → 200 + admin login', async () => {
    const { status, body } = await req('/api/me', true);
    expect(status, body).toBe(200);
    expect(JSON.parse(body).admin, 'admin login missing — PAT user not org admin?').toBeTruthy();
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
