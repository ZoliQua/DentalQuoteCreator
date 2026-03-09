import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Permission checks on protected endpoints', () => {
  let adminToken: string;
  let userToken: string; // 'user' role has minimal permissions

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  // ── Unauthenticated access should return 401 ──
  describe('Unauthenticated requests return 401', () => {
    const protectedEndpoints: [string, string][] = [
      ['GET', '/auth/me'],
      ['POST', '/doctors'],
      ['PUT', '/doctors/test'],
      ['DELETE', '/doctors/test'],
      ['POST', '/dental-status-snapshots'],
      ['PUT', '/dental-status-snapshots/test'],
      ['PUT', '/neak-checks/test'],
      ['PUT', '/odontogram/current/test'],
      ['PUT', '/odontogram/daily/test/2025-01-01'],
      ['POST', '/odontogram/timeline/test'],
      ['PUT', '/odontogram/timeline/test/snap1'],
      ['DELETE', '/odontogram/timeline/test/snap1'],
      ['DELETE', '/invoices'],
      ['GET', '/data/export'],
      ['POST', '/data/import'],
      ['PATCH', '/quotes/test'],
    ];

    for (const [method, url] of protectedEndpoints) {
      it(`${method} ${url} → 401`, async () => {
        const res = await server.inject({ method: method as 'GET', url });
        expect(res.statusCode).toBe(401);
      });
    }
  });

  // ── 'user' role (minimal permissions) should get 403 ──
  describe('User role gets 403 on restricted endpoints', () => {
    const restrictedForUser: [string, string][] = [
      ['POST', '/doctors'],
      ['DELETE', '/invoices'],
      ['POST', '/data/import'],
      ['PATCH', '/quotes/test'],
      ['POST', '/dental-status-snapshots'],
      ['PUT', '/neak-checks/test'],
      ['PUT', '/odontogram/current/test'],
    ];

    for (const [method, url] of restrictedForUser) {
      it(`${method} ${url} → 403 for user role`, async () => {
        const res = await server.inject({
          method: method as 'GET',
          url,
          headers: authHeaders(userToken),
          ...(method !== 'GET' && method !== 'DELETE' ? { payload: {} } : {}),
        });
        expect(res.statusCode).toBe(403);
      });
    }
  });

  // ── Admin should have access ──
  describe('Admin role has access to protected endpoints', () => {
    it('GET /doctors → 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/doctors',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });

    it('GET /data/export → 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/data/export',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });

    it('GET /invoices → 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/invoices',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
