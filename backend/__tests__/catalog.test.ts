import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Catalog (CatalogItem) CRUD', () => {
  let adminToken: string;
  let userToken: string;
  let createdItemId: string;
  const testPriceListId = `plistTEST${Date.now()}`;
  const testCategoryId = `pcatTEST${Date.now()}`;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;

    // Create prerequisite pricelist and category for FK constraints
    await prisma.priceList.create({
      data: {
        priceListId: testPriceListId,
        priceListNameHu: 'Test PriceList',
        isActive: true,
      },
    });
    await prisma.priceListCategory.create({
      data: {
        catalogCategoryId: testCategoryId,
        priceListId: testPriceListId,
        catalogCategoryHu: 'Test Category',
        catalogCategoryPrefix: 'TST',
      },
    });
  });

  afterAll(async () => {
    if (createdItemId) {
      await prisma.priceListCatalogItem.deleteMany({ where: { catalogItemId: createdItemId } });
    }
    await prisma.priceListCategory.deleteMany({ where: { catalogCategoryId: testCategoryId } });
    await prisma.priceList.deleteMany({ where: { priceListId: testPriceListId } });
    await cleanupTestUsers();
  });

  describe('GET /catalog', () => {
    it('should return catalog items with auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/catalog',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/catalog',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /catalog', () => {
    it('should create a catalog item for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/catalog',
        headers: authHeaders(adminToken),
        payload: {
          catalogCode: 'TEST-001',
          catalogNameHu: 'Teszt tétel',
          catalogNameEn: 'Test item',
          catalogUnit: 'alkalom',
          catalogPrice: 5000,
          catalogCategoryId: testCategoryId,
          priceListId: testPriceListId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.catalogNameHu).toBe('Teszt tétel');
      createdItemId = body.catalogItemId;
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/catalog',
        headers: authHeaders(userToken),
        payload: {
          catalogCode: 'NOPERM',
          catalogNameHu: 'Denied',
          catalogCategoryId: testCategoryId,
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /catalog/:catalogItemId', () => {
    it('should update a catalog item', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/catalog/${createdItemId}`,
        headers: authHeaders(adminToken),
        payload: { catalogNameHu: 'Frissített tétel' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().catalogNameHu).toBe('Frissített tétel');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/catalog/${createdItemId}`,
        headers: authHeaders(userToken),
        payload: { catalogNameHu: 'Denied' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent item', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/catalog/NONEXISTENT999',
        headers: authHeaders(adminToken),
        payload: { catalogNameHu: 'Test' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /catalog/:catalogItemId (soft delete)', () => {
    it('should soft-delete a catalog item', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/catalog/${createdItemId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/catalog/${createdItemId}`,
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent item', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/catalog/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
