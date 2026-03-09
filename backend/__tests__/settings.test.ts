import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Settings endpoints', () => {
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

  // ── General Settings ──

  describe('GET /settings', () => {
    it('should return settings with auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/settings',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toBeDefined();
      expect(typeof body).toBe('object');
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/settings',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /settings', () => {
    it('should update settings', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/settings',
        headers: authHeaders(adminToken),
        payload: {
          clinic: { name: 'Test Clinic' },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/settings',
        payload: { clinic: { name: 'Denied' } },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Invoice Settings ──

  describe('GET /invoice-settings', () => {
    it('should return invoice settings for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/invoice-settings',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('invoiceType');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/invoice-settings',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /invoice-settings', () => {
    it('should update invoice settings for admin', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/invoice-settings',
        headers: authHeaders(adminToken),
        payload: {
          invoiceType: 'electronic',
          defaultComment: 'Test comment',
          defaultVatRate: 'TAM',
          defaultPaymentMethod: 'bankkártya',
          invoiceMode: 'test',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/invoice-settings',
        headers: authHeaders(userToken),
        payload: { invoiceType: 'paper' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Bootstrap ──

  describe('GET /bootstrap', () => {
    it('should return bootstrap data with auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/bootstrap',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
