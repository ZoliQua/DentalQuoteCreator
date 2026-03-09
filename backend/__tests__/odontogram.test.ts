import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Odontogram endpoints', () => {
  let adminToken: string;
  let userToken: string;
  const testPatientId = `PODON${Date.now()}`;
  let createdSnapshotId: string;

  beforeAll(async () => {
    const admin = await createTestUser('admin');
    adminToken = admin.token;
    const user = await createTestUser('user');
    userToken = user.token;

    // Create a test patient
    await server.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeaders(adminToken),
      payload: {
        patientId: testPatientId,
        lastName: 'Odonto',
        firstName: 'Test',
        sex: 'male',
        birthDate: '1990-01-01',
      },
    });
  });

  afterAll(async () => {
    await prisma.odontogramTimeline.deleteMany({ where: { patientId: testPatientId } });
    await prisma.odontogramDaily.deleteMany({ where: { patientId: testPatientId } });
    await prisma.odontogramCurrent.deleteMany({ where: { patientId: testPatientId } });
    await prisma.dentalStatusSnapshot.deleteMany({ where: { patientId: testPatientId } });
    await prisma.patient.deleteMany({ where: { patientId: testPatientId } });
    await cleanupTestUsers();
  });

  // ── Current ──

  describe('GET /odontogram/current/:patientId', () => {
    it('should return null for patient with no odontogram', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/current/${testPatientId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PUT /odontogram/current/:patientId', () => {
    it('should save current odontogram', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/odontogram/current/${testPatientId}`,
        headers: authHeaders(adminToken),
        payload: { teeth: { 11: { status: 'caries' } } },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/odontogram/current/${testPatientId}`,
        headers: authHeaders(userToken),
        payload: { teeth: {} },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /odontogram/current/:patientId (after save)', () => {
    it('should return saved odontogram data', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/current/${testPatientId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.teeth).toBeDefined();
    });
  });

  // ── Daily ──

  describe('PUT /odontogram/daily/:patientId/:dateKey', () => {
    it('should save daily odontogram', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/odontogram/daily/${testPatientId}/2026-03-09`,
        headers: authHeaders(adminToken),
        payload: { teeth: { 21: { status: 'filled' } } },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/odontogram/daily/${testPatientId}/2026-03-09`,
        headers: authHeaders(userToken),
        payload: { teeth: {} },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /odontogram/daily/:patientId/:dateKey', () => {
    it('should return daily odontogram data', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/daily/${testPatientId}/2026-03-09`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.teeth).toBeDefined();
    });

    it('should return null for non-existent date', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/daily/${testPatientId}/1999-01-01`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── History ──

  describe('GET /odontogram/history/:patientId', () => {
    it('should return history list', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/history/${testPatientId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  // ── Timeline ──

  describe('POST /odontogram/timeline/:patientId', () => {
    it('should create a timeline snapshot', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/odontogram/timeline/${testPatientId}`,
        headers: authHeaders(adminToken),
        payload: { teeth: { 31: { status: 'crown' } } },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.snapshotId).toBeDefined();
      createdSnapshotId = body.snapshotId;
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/odontogram/timeline/${testPatientId}`,
        headers: authHeaders(userToken),
        payload: { teeth: {} },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /odontogram/timeline/:patientId', () => {
    it('should return timeline list', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/timeline/${testPatientId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /odontogram/timeline/:patientId/:snapshotId', () => {
    it('should return a specific snapshot', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/timeline/${testPatientId}/${createdSnapshotId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/odontogram/timeline/${testPatientId}/NONEXISTENT999`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /odontogram/timeline/:patientId/:snapshotId', () => {
    it('should update a timeline snapshot', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/odontogram/timeline/${testPatientId}/${createdSnapshotId}`,
        headers: authHeaders(adminToken),
        payload: { teeth: { 31: { status: 'bridge' } } },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().snapshotId).toBe(createdSnapshotId);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/odontogram/timeline/${testPatientId}/NONEXISTENT999`,
        headers: authHeaders(adminToken),
        payload: { teeth: {} },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /odontogram/timeline/:patientId/:snapshotId', () => {
    it('should delete a timeline snapshot', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/odontogram/timeline/${testPatientId}/${createdSnapshotId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
      createdSnapshotId = '';
    });

    it('should return 404 for non-existent snapshot', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/odontogram/timeline/${testPatientId}/NONEXISTENT999`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/odontogram/timeline/${testPatientId}/anysnapshot`,
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Dental Status Snapshots ──

  describe('POST /dental-status-snapshots', () => {
    it('should create a snapshot', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/dental-status-snapshots',
        headers: authHeaders(adminToken),
        payload: {
          patientId: testPatientId,
          teeth: { 11: { conditions: ['caries'] } },
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().patientId).toBe(testPatientId);
    });

    it('should return 403 for user role', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/dental-status-snapshots',
        headers: authHeaders(userToken),
        payload: { patientId: testPatientId, teeth: {} },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /dental-status-snapshots', () => {
    it('should return snapshots', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/dental-status-snapshots?patientId=${testPatientId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });
});
