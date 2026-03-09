import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Data export/import', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  describe('GET /data/export', () => {
    it('should return export data for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/data/export',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('exportedAt');
      expect(body).toHaveProperty('patients');
      expect(body).toHaveProperty('catalog');
      expect(body).toHaveProperty('quotes');
      expect(body).toHaveProperty('settings');
      expect(Array.isArray(body.patients)).toBe(true);
      expect(Array.isArray(body.catalog)).toBe(true);
    });

    it('should return 403 for user role (no data.view)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/data/export',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/data/export',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /data/import', () => {
    it('should return 403 for user role (no admin.users.manage)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/data/import',
        headers: authHeaders(userToken),
        payload: {
          patients: [],
          catalog: [],
          quotes: [],
          settings: {},
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/data/import',
        payload: { patients: [], catalog: [], quotes: [] },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid payload', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/data/import',
        headers: authHeaders(adminToken),
        payload: { invalid: true },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
