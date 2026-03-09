import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Quotes CRUD', () => {
  let adminToken: string;
  let userToken: string;
  const testPatientId = `P${Date.now()}Q`;
  let createdQuoteId: string;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;

    // Create a test patient for quotes
    await server.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeaders(adminToken),
      payload: {
        patientId: testPatientId,
        lastName: 'QuoteTest',
        firstName: 'Patient',
        sex: 'female',
        birthDate: '1985-06-20',
      },
    });
  });

  afterAll(async () => {
    if (createdQuoteId) {
      await prisma.quote.deleteMany({ where: { quoteId: createdQuoteId } });
    }
    await prisma.dentalStatusSnapshot.deleteMany({ where: { patientId: testPatientId } });
    await prisma.patient.deleteMany({ where: { patientId: testPatientId } });
    await cleanupTestUsers();
  });

  describe('GET /quotes/next-id/:patientId', () => {
    it('should return a quote ID', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/quotes/next-id/${testPatientId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(typeof body.id).toBe('string');
      createdQuoteId = body.id;
    });
  });

  describe('POST /quotes', () => {
    it('should create a quote', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/quotes',
        headers: authHeaders(adminToken),
        payload: {
          quoteId: createdQuoteId,
          patientId: testPatientId,
          quoteStatus: 'draft',
          quoteName: 'Test Quote',
          quoteNumber: 'TEST-0001',
          items: [],
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/quotes',
        headers: authHeaders(userToken),
        payload: {
          patientId: testPatientId,
          quoteStatus: 'draft',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /quotes', () => {
    it('should return list of quotes', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/quotes',
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('GET /quotes/:quoteId', () => {
    it('should return a specific quote', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/quotes/${createdQuoteId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent quote', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/quotes/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /quotes/:quoteId', () => {
    it('should update a quote (requires quotes.create permission)', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/quotes/${createdQuoteId}`,
        headers: authHeaders(adminToken),
        payload: { quoteStatus: 'closed' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/quotes/${createdQuoteId}`,
        headers: authHeaders(userToken),
        payload: { quoteStatus: 'draft' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /quotes/:quoteId (soft delete)', () => {
    it('should soft-delete a quote', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/quotes/${createdQuoteId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /quotes/:quoteId/restore', () => {
    it('should restore a soft-deleted quote', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/quotes/${createdQuoteId}/restore`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);

      // Verify the quote is no longer deleted by fetching it
      const getRes = await server.inject({
        method: 'GET',
        url: `/quotes/${createdQuoteId}`,
        headers: authHeaders(adminToken),
      });
      expect(getRes.statusCode).toBe(200);
    });
  });
});
