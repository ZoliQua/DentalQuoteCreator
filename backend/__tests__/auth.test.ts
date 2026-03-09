import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma, hashPassword, createShortId } from '../src/server.js';
import { cleanupTestUsers } from './helpers/auth.js';

describe('Auth endpoints', () => {
  const testEmail = `auth-test-${Date.now()}@test.local`;
  const testPassword = 'SecurePass123!';

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: createShortId(),
        email: testEmail,
        fullName: 'Auth Test User',
        passwordHash: await hashPassword(testPassword),
        role: 'admin',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  describe('POST /auth/login', () => {
    it('should return token on valid credentials', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: testEmail, password: testPassword },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe('string');
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testEmail);
    });

    it('should return 401 on wrong password', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: testEmail, password: 'WrongPass!' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 on non-existent email', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nonexistent@test.local', password: testPassword },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 on missing fields', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user info with valid token', async () => {
      // First login
      const loginRes = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: testEmail, password: testPassword },
      });
      const { token } = loginRes.json();

      const res = await server.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.email).toBe(testEmail);
    });

    it('should return 401 without token', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: 'Bearer invalid-token-12345' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should invalidate the session token', async () => {
      const loginRes = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: testEmail, password: testPassword },
      });
      const { token } = loginRes.json();

      // Logout
      const logoutRes = await server.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Token should no longer work
      const meRes = await server.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(meRes.statusCode).toBe(401);
    });
  });
});
