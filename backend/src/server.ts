import 'dotenv/config';
import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from './db.js';

const FDI_TOOTH_IDS = [
  '11', '12', '13', '14', '15', '16', '17', '18',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48',
];

const createDefaultToothState = () => ({
  toothSelection: 'tooth-base',
  pulpInflam: false,
  endoResection: false,
  mods: [],
  endo: 'none',
  caries: [],
  fillingMaterial: 'none',
  fillingSurfaces: [],
  fissureSealing: false,
  contactMesial: false,
  contactDistal: false,
  bruxismWear: false,
  bruxismNeckWear: false,
  brokenMesial: false,
  brokenIncisal: false,
  brokenDistal: false,
  extractionWound: false,
  extractionPlan: false,
  bridgePillar: false,
  bridgeUnit: 'none',
  mobility: 'none',
  crownMaterial: 'natural',
});

const createDefaultOdontogramPayload = () => {
  const teeth = Object.fromEntries(
    FDI_TOOTH_IDS.map((toothId) => [toothId, createDefaultToothState()])
  );
  return {
    version: '1.1',
    globals: {
      wisdomVisible: true,
      showBase: true,
      occlusalVisible: true,
      showHealthyPulp: true,
      edentulous: false,
    },
    teeth,
  };
};

const server = Fastify({
  logger: true,
});

server.get('/health', async () => {
  return { status: 'ok' };
});

server.get('/db-health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

server.get('/patients', async (request) => {
  const { includeArchived } = request.query as { includeArchived?: string };
  const showArchived = includeArchived === 'true';
  const patients = await prisma.patient.findMany({
    where: showArchived ? undefined : { isArchived: false },
    orderBy: { createdAt: 'desc' },
  });
  return patients;
});

server.get('/patients/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const patient = await prisma.patient.findUnique({ where: { patientId } });
  if (!patient) {
    return reply.code(404).send({ message: 'Patient not found' });
  }
  return patient;
});

server.post('/patients', async (request, reply) => {
  const body = request.body as {
    lastName?: string;
    firstName?: string;
    sex?: 'male' | 'female' | 'other';
    birthDate?: string;
    insuranceNum?: string;
    phone?: string;
    email?: string;
    zipCode?: string;
    city?: string;
    street?: string;
    notes?: string;
  };

  if (!body.lastName || !body.firstName || !body.sex || !body.birthDate) {
    return reply.code(400).send({ message: 'Missing required fields' });
  }

  const birthDate = new Date(body.birthDate);
  if (Number.isNaN(birthDate.getTime())) {
    return reply.code(400).send({ message: 'Invalid birthDate' });
  }

  const patient = await prisma.patient.create({
    data: {
      patientId: randomUUID(),
      lastName: body.lastName,
      firstName: body.firstName,
      sex: body.sex,
      birthDate,
      insuranceNum: body.insuranceNum,
      phone: body.phone,
      email: body.email,
      zipCode: body.zipCode,
      city: body.city,
      street: body.street,
      notes: body.notes,
    },
  });

  return reply.code(201).send(patient);
});

server.patch('/patients/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const body = request.body as {
    lastName?: string;
    firstName?: string;
    sex?: 'male' | 'female' | 'other';
    birthDate?: string;
    insuranceNum?: string;
    phone?: string;
    email?: string;
    zipCode?: string;
    city?: string;
    street?: string;
    notes?: string;
    isArchived?: boolean;
  };

  const data: Record<string, unknown> = { ...body };
  if (body.birthDate !== undefined) {
    const birthDate = new Date(body.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      return reply.code(400).send({ message: 'Invalid birthDate' });
    }
    data.birthDate = birthDate;
  }

  try {
    const patient = await prisma.patient.update({
      where: { patientId },
      data,
    });
    return patient;
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

server.delete('/patients/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  try {
    const patient = await prisma.patient.update({
      where: { patientId },
      data: { isArchived: true },
    });
    return patient;
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

server.get('/patients/:patientId/snapshots', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const patient = await prisma.patient.findUnique({ where: { patientId } });
  if (!patient) {
    return reply.code(404).send({ message: 'Patient not found' });
  }
  const snapshots = await prisma.dentalStatusSnapshot.findMany({
    where: { patientId },
    orderBy: { takenAt: 'desc' },
  });
  return snapshots;
});

server.get('/patients/:patientId/snapshots/latest', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const patient = await prisma.patient.findUnique({ where: { patientId } });
  if (!patient) {
    return reply.code(404).send({ message: 'Patient not found' });
  }
  const snapshot = await prisma.dentalStatusSnapshot.findFirst({
    where: { patientId },
    orderBy: { takenAt: 'desc' },
  });
  return snapshot;
});

server.get('/patients/:patientId/snapshots/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const snapshot = await prisma.dentalStatusSnapshot.findFirst({
    where: { patientId, snapshotId },
  });
  if (!snapshot) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  return snapshot;
});

server.post('/patients/:patientId/snapshots', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const body = request.body as {
    note?: string;
    takenAt?: string;
    teeth?: Record<string, unknown>;
    payload?: {
      version?: string;
      globals?: Record<string, unknown>;
      teeth?: Record<string, unknown>;
    };
    baseSnapshotId?: string;
  };

  const patient = await prisma.patient.findUnique({ where: { patientId } });
  if (!patient) {
    return reply.code(404).send({ message: 'Patient not found' });
  }

  let payload = body.payload ?? (body.teeth ? { teeth: body.teeth } : undefined);
  if (!payload && body.baseSnapshotId) {
    const base = await prisma.dentalStatusSnapshot.findFirst({
      where: { patientId, snapshotId: body.baseSnapshotId },
    });
    if (base?.teeth) {
      payload = base.teeth as { version?: string; globals?: Record<string, unknown>; teeth?: Record<string, unknown> };
    }
  }

  const now = new Date();
  const takenAt = body.takenAt ? new Date(body.takenAt) : now;
  if (Number.isNaN(takenAt.getTime())) {
    return reply.code(400).send({ message: 'Invalid takenAt' });
  }

  const snapshot = await prisma.dentalStatusSnapshot.create({
    data: {
      snapshotId: randomUUID(),
      patientId,
      takenAt,
      note: body.note,
      teeth: payload ?? createDefaultOdontogramPayload(),
    },
  });

  return reply.code(201).send(snapshot);
});

server.patch('/patients/:patientId/snapshots/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const body = request.body as {
    note?: string;
    takenAt?: string;
    teeth?: Record<string, unknown>;
    payload?: {
      version?: string;
      globals?: Record<string, unknown>;
      teeth?: Record<string, unknown>;
    };
  };

  const data: Record<string, unknown> = {};
  if (body.note !== undefined) data.note = body.note;
  if (body.payload !== undefined) data.teeth = body.payload;
  if (body.payload === undefined && body.teeth !== undefined) {
    data.teeth = { teeth: body.teeth };
  }
  if (body.takenAt !== undefined) {
    const takenAt = new Date(body.takenAt);
    if (Number.isNaN(takenAt.getTime())) {
      return reply.code(400).send({ message: 'Invalid takenAt' });
    }
    data.takenAt = takenAt;
  }

  try {
    const snapshot = await prisma.dentalStatusSnapshot.update({
      where: { snapshotId },
      data,
    });
    if (snapshot.patientId !== patientId) {
      return reply.code(404).send({ message: 'Snapshot not found' });
    }
    return snapshot;
  } catch {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
});

server.delete('/patients/:patientId/snapshots/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const snapshot = await prisma.dentalStatusSnapshot.findFirst({
    where: { patientId, snapshotId },
  });
  if (!snapshot) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  await prisma.dentalStatusSnapshot.delete({ where: { snapshotId } });
  return { status: 'ok' };
});

const port = Number(process.env.PORT || 4000);

const start = async () => {
  try {
    await prisma.$connect();
    await server.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
