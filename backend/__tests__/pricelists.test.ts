import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('PriceLists & Categories CRUD', () => {
  let adminToken: string;
  let userToken: string;
  let createdPriceListId: string;
  let createdCategoryId: string;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;
  });

  afterAll(async () => {
    if (createdCategoryId) {
      await prisma.priceListCategory.deleteMany({ where: { catalogCategoryId: createdCategoryId } });
    }
    if (createdPriceListId) {
      await prisma.priceList.deleteMany({ where: { priceListId: createdPriceListId } });
    }
    await cleanupTestUsers();
  });

  // ── PriceLists ──

  describe('POST /pricelists', () => {
    it('should create a pricelist for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/pricelists',
        headers: authHeaders(adminToken),
        payload: {
          priceListNameHu: 'Teszt Árlista',
          priceListNameEn: 'Test PriceList',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.priceListNameHu).toBe('Teszt Árlista');
      createdPriceListId = body.priceListId;
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/pricelists',
        headers: authHeaders(userToken),
        payload: { priceListNameHu: 'Denied' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /pricelists', () => {
    it('should return list for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/pricelists',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/pricelists',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /pricelists/:id', () => {
    it('should update a pricelist', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/pricelists/${createdPriceListId}`,
        headers: authHeaders(adminToken),
        payload: { priceListNameHu: 'Frissített Árlista' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().priceListNameHu).toBe('Frissített Árlista');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/pricelists/${createdPriceListId}`,
        headers: authHeaders(userToken),
        payload: { priceListNameHu: 'Denied' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent pricelist', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/pricelists/NONEXISTENT999',
        headers: authHeaders(adminToken),
        payload: { priceListNameHu: 'Test' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /pricelists/:id/categories', () => {
    it('should return categories for a pricelist', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/pricelists/${createdPriceListId}/categories`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('GET /pricelists/:id/items', () => {
    it('should return items for a pricelist', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/pricelists/${createdPriceListId}/items`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  // ── PriceList Categories ──

  describe('POST /pricelist-categories', () => {
    it('should create a category for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/pricelist-categories',
        headers: authHeaders(adminToken),
        payload: {
          priceListId: createdPriceListId,
          catalogCategoryHu: 'Teszt Kategória',
          catalogCategoryPrefix: 'TST',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.catalogCategoryHu).toBe('Teszt Kategória');
      createdCategoryId = body.catalogCategoryId;
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/pricelist-categories',
        headers: authHeaders(userToken),
        payload: {
          priceListId: createdPriceListId,
          catalogCategoryHu: 'Denied',
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /pricelist-categories/:id', () => {
    it('should update a category', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/pricelist-categories/${createdCategoryId}`,
        headers: authHeaders(adminToken),
        payload: { catalogCategoryHu: 'Frissített Kategória' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().catalogCategoryHu).toBe('Frissített Kategória');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/pricelist-categories/${createdCategoryId}`,
        headers: authHeaders(userToken),
        payload: { catalogCategoryHu: 'Denied' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /pricelist-categories/:id (soft delete)', () => {
    it('should soft-delete a category', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/pricelist-categories/${createdCategoryId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/pricelist-categories/${createdCategoryId}`,
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /pricelists/:id (soft delete)', () => {
    it('should soft-delete a pricelist', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/pricelists/${createdPriceListId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent pricelist', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/pricelists/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
