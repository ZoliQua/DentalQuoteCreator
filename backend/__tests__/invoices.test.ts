import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Invoices', () => {
  let adminToken: string;
  let userToken: string;
  const testInvoiceId = `INV-TEST-${Date.now()}`;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { id: testInvoiceId } });
    await cleanupTestUsers();
  });

  describe('PUT /invoices/:invoiceId (create via upsert)', () => {
    it('should create an invoice', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/invoices/${testInvoiceId}`,
        headers: authHeaders(adminToken),
        payload: {
          patientId: 'P00000001',
          quoteId: 'Q00000001',
          status: 'draft',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.id).toBe(testInvoiceId);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/invoices/INV-NOPERM`,
        headers: authHeaders(userToken),
        payload: {
          patientId: 'P00000001',
          quoteId: 'Q00000001',
          status: 'draft',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /invoices', () => {
    it('should return list of invoices for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/invoices',
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('should return 403 for user role (no invoices.view permission)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/invoices',
        headers: authHeaders(userToken),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /invoices/:invoiceId', () => {
    it('should return a specific invoice', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/invoices/${testInvoiceId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent invoice', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/invoices/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /invoices (delete all — admin only)', () => {
    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/invoices',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/invoices',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should succeed for admin', async () => {
      // Create a throwaway invoice first
      await server.inject({
        method: 'PUT',
        url: `/invoices/INV-THROWAWAY-${Date.now()}`,
        headers: authHeaders(adminToken),
        payload: { patientId: 'P1', quoteId: 'Q1', status: 'draft' },
      });

      const res = await server.inject({
        method: 'DELETE',
        url: '/invoices',
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });
  });
});
