import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server, prisma } from '../src/server.js';
import { createTestUser, authHeaders, cleanupTestUsers } from './helpers/auth.js';

describe('Appointments, Types & Chairs', () => {
  let adminToken: string;
  let userToken: string;
  let createdTypeId: string;
  let createdChairId: string;
  let createdAppointmentId: string;
  const testPatientId = `PAPPT${Date.now()}`;

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
        lastName: 'Appt',
        firstName: 'Test',
        sex: 'female',
        birthDate: '1988-05-15',
      },
    });
  });

  afterAll(async () => {
    if (createdAppointmentId) {
      await prisma.appointment.deleteMany({ where: { appointmentId: createdAppointmentId } });
    }
    if (createdTypeId) {
      await prisma.appointmentType.deleteMany({ where: { typeId: createdTypeId } });
    }
    if (createdChairId) {
      const count = await prisma.appointmentChair.count();
      if (count > 1) {
        await prisma.appointmentChair.deleteMany({ where: { chairId: createdChairId } });
      }
    }
    await prisma.dentalStatusSnapshot.deleteMany({ where: { patientId: testPatientId } });
    await prisma.patient.deleteMany({ where: { patientId: testPatientId } });
    await cleanupTestUsers();
  });

  // ── Appointment Types ──
  // user role has calendar.view + calendar.create, so types/chairs/appointments are accessible

  describe('POST /appointment-types', () => {
    it('should create an appointment type for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/appointment-types',
        headers: authHeaders(adminToken),
        payload: {
          nameHu: 'Teszt típus',
          nameEn: 'Test type',
          color: '#FF0000',
          defaultDurationMin: 45,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.nameHu).toBe('Teszt típus');
      createdTypeId = body.typeId;
    });

    it('should also work for user role (has calendar.create)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/appointment-types',
        headers: authHeaders(userToken),
        payload: { nameHu: 'User Type', color: '#00FF00' },
      });
      expect(res.statusCode).toBe(200);
      // Clean up the extra type
      const body = res.json();
      await prisma.appointmentType.deleteMany({ where: { typeId: body.typeId } });
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/appointment-types',
        payload: { nameHu: 'Denied' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /appointment-types', () => {
    it('should return types for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/appointment-types',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return types for user role (has calendar.view)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/appointment-types',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /appointment-types/:typeId', () => {
    it('should update a type', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/appointment-types/${createdTypeId}`,
        headers: authHeaders(adminToken),
        payload: { nameHu: 'Frissített típus' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().nameHu).toBe('Frissített típus');
    });
  });

  describe('DELETE /appointment-types/:typeId', () => {
    it('should return 404 for non-existent type', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/appointment-types/NONEXISTENT999',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 403 for user role (no calendar.delete)', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/appointment-types/${createdTypeId}`,
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Appointment Chairs ──

  describe('POST /appointment-chairs', () => {
    it('should create a chair for admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/appointment-chairs',
        headers: authHeaders(adminToken),
        payload: { chairNameHu: 'Teszt szék' },
      });
      // May return 400 if already at 7 chairs
      if (res.statusCode === 200) {
        const body = res.json();
        expect(body.chairNameHu).toBe('Teszt szék');
        createdChairId = body.chairId;
      } else {
        expect(res.statusCode).toBe(400);
      }
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/appointment-chairs',
        payload: { chairNameHu: 'Denied' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /appointment-chairs', () => {
    it('should return chairs for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/appointment-chairs',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return chairs for user role (has calendar.view)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/appointment-chairs',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── Appointments ──

  describe('POST /appointments', () => {
    it('should create an appointment for admin', async () => {
      const start = new Date();
      start.setHours(start.getHours() + 1);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      const res = await server.inject({
        method: 'POST',
        url: '/appointments',
        headers: authHeaders(adminToken),
        payload: {
          patientId: testPatientId,
          title: 'Test appointment',
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          chairIndex: 0,
          status: 'scheduled',
          appointmentTypeId: createdTypeId || null,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      createdAppointmentId = body.appointmentId;
      expect(body.title).toBe('Test appointment');
    });

    it('should return 401 without auth', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/appointments',
        payload: {
          title: 'Denied',
          startDateTime: new Date().toISOString(),
          endDateTime: new Date().toISOString(),
        },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /appointments', () => {
    it('should return appointments for admin', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/appointments',
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('should return appointments for user role (has calendar.view)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/appointments',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /appointments/by-patient/:patientId', () => {
    it('should return appointments for a patient', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/appointments/by-patient/${testPatientId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('PATCH /appointments/:appointmentId', () => {
    it('should update an appointment', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/appointments/${createdAppointmentId}`,
        headers: authHeaders(adminToken),
        payload: { title: 'Updated appointment' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /appointments/:appointmentId', () => {
    it('should delete an appointment (soft archive)', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/appointments/${createdAppointmentId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      createdAppointmentId = '';
    });

    it('should return 403 for user role (no calendar.delete)', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/appointments/NONEXISTENT',
        headers: authHeaders(userToken),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // Cleanup: delete type at end
  describe('DELETE /appointment-types/:typeId (cleanup)', () => {
    it('should delete the test type', async () => {
      if (!createdTypeId) return;
      const res = await server.inject({
        method: 'DELETE',
        url: `/appointment-types/${createdTypeId}`,
        headers: authHeaders(adminToken),
      });
      expect(res.statusCode).toBe(200);
      createdTypeId = '';
    });
  });
});
