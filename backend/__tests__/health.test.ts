import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Health, debug & seed endpoints', () => {
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

  describe('GET /health', () => {
    it('should return ok (public)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });
  });

  describe('GET /db-health', () => {
    it('should return ok (public)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/db-health',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });
  });

  describe('GET /debug', () => {
    it('should return ok (public)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/debug',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('counts');
    });
  });

  describe('POST /seed', () => {
    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/seed',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/seed',
      });
      expect(res.statusCode).toBe(401);
    });

    // Note: Not testing actual seed execution as it would overwrite real data
    it('should be accessible for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/seed',
        headers: authHeaders(adminToken),
      });
      // Seed may return 200 or 500 depending on CSV file availability
      // The point is it doesn't return 401 or 403
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('GET /countries', () => {
    it('should return countries for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/countries',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return 403 for user role (no patients.create)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/countries',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /neak-document-types', () => {
    it('should return document types for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/neak-document-types',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });
});
