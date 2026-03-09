import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('NEAK endpoints', () => {
  let adminToken: string;
  let userToken: string;
  let createdDeptId: string;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;
  });

  afterAll(async () => {
    if (createdDeptId) {
      await prisma.neakDepartment.deleteMany({ where: { id: createdDeptId } });
    }
    await cleanupTestUsers();
  });

  // ── NEAK Catalog ──

  describe('GET /neak-catalog', () => {
    it('should return NEAK catalog items with auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-catalog',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-catalog',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── NEAK Settings ──

  describe('GET /neak-settings', () => {
    it('should return NEAK settings for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-settings',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('neakOjoteKey');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-settings',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /neak-settings', () => {
    it('should update NEAK settings for admin', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/neak-settings',
        headers: authHeaders(adminToken),
        payload: {
          neakOjoteKey: 'test-key',
          neakWssUser: 'test-user',
          neakWssPassword: 'test-pass',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/neak-settings',
        headers: authHeaders(userToken),
        payload: { neakOjoteKey: 'denied' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── NEAK Departments ──

  describe('POST /neak-departments', () => {
    it('should create a department for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/neak-departments',
        headers: authHeaders(adminToken),
        payload: {
          neakDepartmentNameHu: 'Teszt Osztály',
          neakDepartmentCode: 'TCODE',
          neakDepartmentHours: 20,
          neakDepartmentMaxPoints: 50000,
          neakDepartmentPrefix: 'T',
          neakDepartmentLevel: 'A',
          neakDepartmentIndicator: 'adult',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.neakDepartmentNameHu).toBe('Teszt Osztály');
      createdDeptId = body.id;
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/neak-departments',
        headers: authHeaders(userToken),
        payload: { neakDepartmentNameHu: 'Denied' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /neak-departments', () => {
    it('should return departments for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-departments',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-departments',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /neak-departments/:id', () => {
    it('should delete a department', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/neak-departments/${createdDeptId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
      createdDeptId = ''; // prevent afterAll cleanup error
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/neak-departments/nonexistent',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── NEAK Levels ──

  describe('GET /neak-levels', () => {
    it('should return NEAK levels for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-levels',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-levels',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── NEAK Checks ──

  describe('GET /neak-checks', () => {
    it('should return NEAK checks with auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-checks',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  // ── NEAK Test connection ──

  describe('POST /api/neak/test', () => {
    it('should return test result for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/neak/test',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.success).toBe('boolean');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/neak/test',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
