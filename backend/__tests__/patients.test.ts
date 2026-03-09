import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Patients CRUD', () => {
  let adminToken: string;
  const testPatientId = `P${Date.now()}`;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
  });

  afterAll(async () => {
    // Clean up test patient
    await prisma.dentalStatusSnapshot.deleteMany({ where: { patientId: testPatientId } });
    await prisma.patient.deleteMany({ where: { patientId: testPatientId } });
    await cleanupTestUsers();
  });

  describe('POST /patients', () => {
    it('should create a new patient', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/patients',
        headers: authHeaders(adminToken),
        payload: {
          patientId: testPatientId,
          lastName: 'Teszt',
          firstName: 'Elek',
          sex: 'male',
          birthDate: '1990-01-15',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.patientId).toBe(testPatientId);
      expect(body.lastName).toBe('Teszt');
      expect(body.firstName).toBe('Elek');
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/patients',
        payload: { lastName: 'X', firstName: 'Y', sex: 'male', birthDate: '2000-01-01' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /patients', () => {
    it('should return list of patients', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/patients',
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((p: { patientId: string }) => p.patientId === testPatientId)).toBe(true);
    });
  });

  describe('GET /patients/:patientId', () => {
    it('should return a specific patient', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/patients/${testPatientId}`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.patientId).toBe(testPatientId);
    });

    it('should return 404 for non-existent patient', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/patients/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /patients/:patientId', () => {
    it('should update patient fields', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/patients/${testPatientId}`,
        headers: authHeaders(adminToken),
        payload: { phone: '+36301234567' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.phone).toBe('+36301234567');
    });
  });

  describe('PATCH /patients/:patientId (archive)', () => {
    it('should archive a patient', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/patients/${testPatientId}`,
        headers: authHeaders(adminToken),
        payload: { isArchived: true },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.isArchived).toBe(true);
    });
  });

  describe('PATCH /patients/:patientId/restore', () => {
    it('should restore an archived patient', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/patients/${testPatientId}/restore`,
        headers: authHeaders(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.isArchived).toBe(false);
    });
  });
});
