import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Doctors CRUD', () => {
  let adminToken: string;
  let userToken: string;
  let createdDoctorId: string;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;
  });

  afterAll(async () => {
    if (createdDoctorId) {
      await prisma.doctor.deleteMany({ where: { doctorId: createdDoctorId } });
    }
    await cleanupTestUsers();
  });

  describe('GET /doctors', () => {
    it('should return 403 for user role (no settings.view)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/doctors',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return list for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/doctors',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('POST /doctors', () => {
    it('should create a doctor', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/doctors',
        headers: authHeaders(adminToken),
        payload: {
          doctorName: 'Dr. Test Vitest',
          doctorNum: '999999',
          doctorEESZTId: 'EESZT-TEST',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.doctorName).toBe('Dr. Test Vitest');
      createdDoctorId = body.doctorId;
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/doctors',
        headers: authHeaders(userToken),
        payload: { doctorName: 'Denied', doctorNum: '0' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /doctors/:doctorId', () => {
    it('should update a doctor', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/doctors/${createdDoctorId}`,
        headers: authHeaders(adminToken),
        payload: { doctorName: 'Dr. Updated Vitest' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().doctorName).toBe('Dr. Updated Vitest');
    });
  });

  describe('DELETE /doctors/:doctorId', () => {
    it('should delete a doctor', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/doctors/${createdDoctorId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      createdDoctorId = ''; // prevent afterAll cleanup error
    });

    it('should return 404 for non-existent doctor', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/doctors/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
