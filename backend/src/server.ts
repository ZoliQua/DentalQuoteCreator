import 'dotenv/config';
import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

type JsonRecord = Record<string, unknown>;

type ExportData = {
  version: string;
  exportedAt: string;
  patients: unknown[];
  catalog: unknown[];
  quotes: unknown[];
  settings: JsonRecord;
  dentalStatusSnapshots?: unknown[];
  invoices?: unknown[];
  neakChecks?: unknown[];
};

const DATA_VERSION = '2.0.0';

const defaultSettings: JsonRecord = {
  clinic: {
    name: 'Macko Dental Kft.',
    address: '9700 Szombathely, Fo ter 1.',
    phone: '+36 94 123 456',
    email: 'info@mackodental.hu',
    website: 'www.mackodental.hu',
  },
  doctors: [{ id: 'doc-1', name: 'Dr. Dul Zoltan', stampNumber: '' }],
  pdf: {
    footerText:
      'Az arajanlat tajekoztato jellegu es a fent jelolt ideig ervenyes.',
    warrantyText: 'Garancialis feltetelek a rendeloben.',
  },
  quote: {
    prefix: 'MDKD',
    counter: 0,
    deletedCount: 0,
  },
  invoice: {
    invoiceType: 'paper',
    defaultComment: '',
    defaultVatRate: 0,
  },
  patient: {
    defaultCountry: 'Magyarorszag',
    patientTypes: ['Privat paciens', 'NEAK paciens'],
  },
  language: 'hu',
  defaultValidityDays: 60,
  dateFormat: 'YYYY-MM-DD HH:MM:SS',
};

const toInputJson = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const toDate = (value: string | Date): Date => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date;
};

const parseJsonObject = <T extends JsonRecord>(value: Prisma.JsonValue | null | undefined, fallback: T): T => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }
  return value as T;
};

const server = Fastify({ logger: true });

server.get('/health', async () => ({ status: 'ok' }));

server.get('/db-health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

server.get('/db/stats', async () => {
  const tableNames = [
    'Patient',
    'Quote',
    'DentalStatusSnapshot',
    'CatalogItem',
    'AppSettings',
    'Invoice',
    'NeakCheck',
    'OdontogramCurrent',
    'OdontogramDaily',
    'OdontogramTimeline',
  ] as const;

  const dbMeta = await prisma.$queryRaw<Array<{ database_name: string; database_size: bigint | number }>>`
    SELECT current_database() AS database_name, pg_database_size(current_database()) AS database_size
  `;

  const tableStats = await Promise.all(
    tableNames.map(async (tableName) => {
      const rowCount = await prisma.$queryRawUnsafe<Array<{ row_count: bigint | number }>>(
        `SELECT COUNT(*)::bigint AS row_count FROM "${tableName}"`
      );
      const sizeRow = await prisma.$queryRawUnsafe<
        Array<{ total_bytes: bigint | number; data_bytes: bigint | number; index_bytes: bigint | number }>
      >(
        `SELECT
          pg_total_relation_size('"${tableName}"') AS total_bytes,
          pg_relation_size('"${tableName}"') AS data_bytes,
          pg_indexes_size('"${tableName}"') AS index_bytes`
      );

      return {
        tableName,
        rowCount: Number(rowCount[0]?.row_count || 0),
        totalBytes: Number(sizeRow[0]?.total_bytes || 0),
        dataBytes: Number(sizeRow[0]?.data_bytes || 0),
        indexBytes: Number(sizeRow[0]?.index_bytes || 0),
      };
    })
  );

  tableStats.sort((a, b) => b.totalBytes - a.totalBytes);

  return {
    generatedAt: new Date().toISOString(),
    databaseName: dbMeta[0]?.database_name || 'unknown',
    databaseSizeBytes: Number(dbMeta[0]?.database_size || 0),
    tableCount: tableStats.length,
    totalRows: tableStats.reduce((sum, item) => sum + item.rowCount, 0),
    totalTableBytes: tableStats.reduce((sum, item) => sum + item.totalBytes, 0),
    tables: tableStats,
  };
});

// Bootstrap endpoint for frontend startup
server.get('/bootstrap', async () => {
  const [patients, catalog, quotes, settingsRow, dentalStatusSnapshots, invoices, neakChecks] =
    await Promise.all([
      prisma.patient.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.catalogItem.findMany({ orderBy: { catalogCode: 'asc' } }),
      prisma.quote.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.dentalStatusSnapshot.findMany({ orderBy: { takenAt: 'desc' } }),
      prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.neakCheck.findMany({ orderBy: { checkedAt: 'desc' } }),
    ]);

  return {
    patients,
    catalog,
    quotes: quotes.map((q) => q.data),
    settings: parseJsonObject(settingsRow?.data, defaultSettings),
    dentalStatusSnapshots,
    invoices: invoices.map((inv) => inv.data),
    neakChecks: neakChecks.map((entry) => entry.data),
  };
});

// Patients
server.get('/patients', async (request) => {
  const { includeArchived } = request.query as { includeArchived?: string };
  const showArchived = includeArchived === 'true';
  return prisma.patient.findMany({
    where: showArchived ? undefined : { isArchived: false },
    orderBy: { createdAt: 'desc' },
  });
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
  const body = request.body as JsonRecord;
  if (!body.lastName || !body.firstName || !body.sex || !body.birthDate) {
    return reply.code(400).send({ message: 'Missing required fields' });
  }

  const patient = await prisma.patient.create({
    data: {
      patientId: String(body.patientId || randomUUID()),
      title: body.title ? String(body.title) : null,
      lastName: String(body.lastName),
      firstName: String(body.firstName),
      sex: body.sex as 'male' | 'female' | 'other',
      birthDate: toDate(String(body.birthDate)),
      birthPlace: body.birthPlace ? String(body.birthPlace) : null,
      insuranceNum: body.insuranceNum ? String(body.insuranceNum) : null,
      phone: body.phone ? String(body.phone) : null,
      email: body.email ? String(body.email) : null,
      country: body.country ? String(body.country) : null,
      isForeignAddress: Boolean(body.isForeignAddress),
      zipCode: body.zipCode ? String(body.zipCode) : null,
      city: body.city ? String(body.city) : null,
      street: body.street ? String(body.street) : null,
      patientType: body.patientType ? String(body.patientType) : null,
      notes: body.notes ? String(body.notes) : null,
      createdAt: body.createdAt ? toDate(String(body.createdAt)) : new Date(),
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      isArchived: Boolean(body.isArchived),
    },
  });

  return reply.code(201).send(patient);
});

server.patch('/patients/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const body = request.body as JsonRecord;

  const data: Prisma.PatientUpdateInput = {
    title: body.title === undefined ? undefined : (body.title ? String(body.title) : null),
    lastName: body.lastName === undefined ? undefined : String(body.lastName),
    firstName: body.firstName === undefined ? undefined : String(body.firstName),
    sex: body.sex === undefined ? undefined : (body.sex as 'male' | 'female' | 'other'),
    birthPlace: body.birthPlace === undefined ? undefined : (body.birthPlace ? String(body.birthPlace) : null),
    insuranceNum: body.insuranceNum === undefined ? undefined : (body.insuranceNum ? String(body.insuranceNum) : null),
    phone: body.phone === undefined ? undefined : (body.phone ? String(body.phone) : null),
    email: body.email === undefined ? undefined : (body.email ? String(body.email) : null),
    country: body.country === undefined ? undefined : (body.country ? String(body.country) : null),
    isForeignAddress: body.isForeignAddress === undefined ? undefined : Boolean(body.isForeignAddress),
    zipCode: body.zipCode === undefined ? undefined : (body.zipCode ? String(body.zipCode) : null),
    city: body.city === undefined ? undefined : (body.city ? String(body.city) : null),
    street: body.street === undefined ? undefined : (body.street ? String(body.street) : null),
    patientType: body.patientType === undefined ? undefined : (body.patientType ? String(body.patientType) : null),
    notes: body.notes === undefined ? undefined : (body.notes ? String(body.notes) : null),
    isArchived: body.isArchived === undefined ? undefined : Boolean(body.isArchived),
    updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
  };

  if (body.birthDate !== undefined) {
    data.birthDate = toDate(String(body.birthDate));
  }

  try {
    return await prisma.patient.update({ where: { patientId }, data });
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

server.delete('/patients/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  try {
    return await prisma.patient.update({
      where: { patientId },
      data: { isArchived: true, updatedAt: new Date() },
    });
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

// Catalog
server.get('/catalog', async () => {
  return prisma.catalogItem.findMany({ orderBy: { catalogCode: 'asc' } });
});

server.post('/catalog', async (request, reply) => {
  const body = request.body as JsonRecord;
  const item = await prisma.catalogItem.upsert({
    where: { catalogItemId: String(body.catalogItemId || randomUUID()) },
    update: {
      catalogCode: String(body.catalogCode || ''),
      catalogName: String(body.catalogName || ''),
      catalogUnit: String(body.catalogUnit || 'alkalom'),
      catalogPrice: Number(body.catalogPrice || 0),
      catalogPriceCurrency: String(body.catalogPriceCurrency || 'HUF'),
      catalogVatRate: Number(body.catalogVatRate || 0),
      catalogTechnicalPrice: Number(body.catalogTechnicalPrice || 0),
      catalogCategory: String(body.catalogCategory || 'Diagnosztika'),
      hasTechnicalPrice: Boolean(body.hasTechnicalPrice),
      isFullMouth: Boolean(body.isFullMouth),
      isArch: Boolean(body.isArch),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
    create: {
      catalogItemId: String(body.catalogItemId || randomUUID()),
      catalogCode: String(body.catalogCode || ''),
      catalogName: String(body.catalogName || ''),
      catalogUnit: String(body.catalogUnit || 'alkalom'),
      catalogPrice: Number(body.catalogPrice || 0),
      catalogPriceCurrency: String(body.catalogPriceCurrency || 'HUF'),
      catalogVatRate: Number(body.catalogVatRate || 0),
      catalogTechnicalPrice: Number(body.catalogTechnicalPrice || 0),
      catalogCategory: String(body.catalogCategory || 'Diagnosztika'),
      hasTechnicalPrice: Boolean(body.hasTechnicalPrice),
      isFullMouth: Boolean(body.isFullMouth),
      isArch: Boolean(body.isArch),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  });
  return reply.code(201).send(item);
});

server.patch('/catalog/:catalogItemId', async (request, reply) => {
  const { catalogItemId } = request.params as { catalogItemId: string };
  const body = request.body as JsonRecord;
  try {
    return await prisma.catalogItem.update({
      where: { catalogItemId },
      data: {
        catalogCode: body.catalogCode === undefined ? undefined : String(body.catalogCode),
        catalogName: body.catalogName === undefined ? undefined : String(body.catalogName),
        catalogUnit: body.catalogUnit === undefined ? undefined : String(body.catalogUnit),
        catalogPrice: body.catalogPrice === undefined ? undefined : Number(body.catalogPrice),
        catalogPriceCurrency:
          body.catalogPriceCurrency === undefined ? undefined : String(body.catalogPriceCurrency),
        catalogVatRate: body.catalogVatRate === undefined ? undefined : Number(body.catalogVatRate),
        catalogTechnicalPrice:
          body.catalogTechnicalPrice === undefined ? undefined : Number(body.catalogTechnicalPrice),
        catalogCategory:
          body.catalogCategory === undefined ? undefined : String(body.catalogCategory),
        hasTechnicalPrice:
          body.hasTechnicalPrice === undefined ? undefined : Boolean(body.hasTechnicalPrice),
        isFullMouth: body.isFullMouth === undefined ? undefined : Boolean(body.isFullMouth),
        isArch: body.isArch === undefined ? undefined : Boolean(body.isArch),
        isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
      },
    });
  } catch {
    return reply.code(404).send({ message: 'Catalog item not found' });
  }
});

server.delete('/catalog/:catalogItemId', async (request, reply) => {
  const { catalogItemId } = request.params as { catalogItemId: string };
  try {
    await prisma.catalogItem.delete({ where: { catalogItemId } });
    return { status: 'ok' };
  } catch {
    return reply.code(404).send({ message: 'Catalog item not found' });
  }
});

server.put('/catalog/reset', async (request) => {
  const body = request.body as { items?: JsonRecord[] };
  const items = Array.isArray(body.items) ? body.items : [];
  await prisma.$transaction([
    prisma.catalogItem.deleteMany({}),
    ...items.map((item) =>
      prisma.catalogItem.create({
        data: {
          catalogItemId: String(item.catalogItemId || randomUUID()),
          catalogCode: String(item.catalogCode || ''),
          catalogName: String(item.catalogName || ''),
          catalogUnit: String(item.catalogUnit || 'alkalom'),
          catalogPrice: Number(item.catalogPrice || 0),
          catalogPriceCurrency: String(item.catalogPriceCurrency || 'HUF'),
          catalogVatRate: Number(item.catalogVatRate || 0),
          catalogTechnicalPrice: Number(item.catalogTechnicalPrice || 0),
          catalogCategory: String(item.catalogCategory || 'Diagnosztika'),
          hasTechnicalPrice: Boolean(item.hasTechnicalPrice),
          isFullMouth: Boolean(item.isFullMouth),
          isArch: Boolean(item.isArch),
          isActive: item.isActive === undefined ? true : Boolean(item.isActive),
        },
      })
    ),
  ]);
  return { status: 'ok' };
});

// Quotes
server.get('/quotes', async () => {
  const quotes = await prisma.quote.findMany({ orderBy: { createdAt: 'desc' } });
  return quotes.map((q) => q.data);
});

server.post('/quotes', async (request, reply) => {
  const body = request.body as JsonRecord;
  const quoteId = String(body.quoteId || randomUUID());
  const createdAt = body.createdAt ? toDate(String(body.createdAt)) : new Date();
  const lastStatusChangeAt = body.lastStatusChangeAt
    ? toDate(String(body.lastStatusChangeAt))
    : createdAt;

  const row = await prisma.quote.upsert({
    where: { quoteId },
    update: {
      patientId: String(body.patientId || ''),
      quoteStatus: String(body.quoteStatus || 'draft'),
      lastStatusChangeAt,
      isDeleted: Boolean(body.isDeleted),
      data: toInputJson({ ...body, quoteId }),
    },
    create: {
      quoteId,
      patientId: String(body.patientId || ''),
      quoteStatus: String(body.quoteStatus || 'draft'),
      createdAt,
      lastStatusChangeAt,
      isDeleted: Boolean(body.isDeleted),
      data: toInputJson({ ...body, quoteId }),
    },
  });

  return reply.code(201).send(row.data);
});

server.patch('/quotes/:quoteId', async (request, reply) => {
  const { quoteId } = request.params as { quoteId: string };
  const body = request.body as JsonRecord;
  try {
    const row = await prisma.quote.update({
      where: { quoteId },
      data: {
        patientId: body.patientId === undefined ? undefined : String(body.patientId),
        quoteStatus: body.quoteStatus === undefined ? undefined : String(body.quoteStatus),
        lastStatusChangeAt:
          body.lastStatusChangeAt === undefined
            ? undefined
            : toDate(String(body.lastStatusChangeAt)),
        isDeleted: body.isDeleted === undefined ? undefined : Boolean(body.isDeleted),
        data: toInputJson(body),
      },
    });
    return row.data;
  } catch {
    return reply.code(404).send({ message: 'Quote not found' });
  }
});

server.delete('/quotes/:quoteId', async (request, reply) => {
  const { quoteId } = request.params as { quoteId: string };
  try {
    await prisma.quote.delete({ where: { quoteId } });
    return { status: 'ok' };
  } catch {
    return reply.code(404).send({ message: 'Quote not found' });
  }
});

// Settings
server.get('/settings', async () => {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
  return parseJsonObject(settings?.data, defaultSettings);
});

server.put('/settings', async (request) => {
  const body = request.body as JsonRecord;
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: { data: toInputJson(body) },
    create: { id: 'default', data: toInputJson(body) },
  });
  return { status: 'ok' };
});

// Dental status snapshots
server.get('/dental-status-snapshots', async (request) => {
  const { patientId } = request.query as { patientId?: string };
  return prisma.dentalStatusSnapshot.findMany({
    where: patientId ? { patientId } : undefined,
    orderBy: { takenAt: 'desc' },
  });
});

server.post('/dental-status-snapshots', async (request, reply) => {
  const body = request.body as JsonRecord;
  const snapshot = await prisma.dentalStatusSnapshot.create({
    data: {
      snapshotId: String(body.snapshotId || randomUUID()),
      patientId: String(body.patientId || ''),
      takenAt: body.takenAt ? toDate(String(body.takenAt)) : new Date(),
      note: body.note ? String(body.note) : null,
      teeth: toInputJson(body.teeth || {}),
    },
  });
  return reply.code(201).send(snapshot);
});

server.put('/dental-status-snapshots/:snapshotId', async (request, reply) => {
  const { snapshotId } = request.params as { snapshotId: string };
  const body = request.body as JsonRecord;
  try {
    return await prisma.dentalStatusSnapshot.update({
      where: { snapshotId },
      data: {
        patientId: body.patientId === undefined ? undefined : String(body.patientId),
        takenAt: body.takenAt === undefined ? undefined : toDate(String(body.takenAt)),
        note: body.note === undefined ? undefined : (body.note ? String(body.note) : null),
        teeth: body.teeth === undefined ? undefined : toInputJson(body.teeth),
      },
    });
  } catch {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
});

// Invoices
server.get('/invoices', async () => {
  const rows = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((row) => row.data);
});

server.put('/invoices/:invoiceId', async (request) => {
  const { invoiceId } = request.params as { invoiceId: string };
  const body = request.body as JsonRecord;
  const createdAt = body.createdAt ? toDate(String(body.createdAt)) : new Date();
  await prisma.invoice.upsert({
    where: { id: invoiceId },
    update: {
      patientId: String(body.patientId || ''),
      quoteId: String(body.quoteId || ''),
      status: String(body.status || 'draft'),
      createdAt,
      data: toInputJson({ ...body, id: invoiceId }),
    },
    create: {
      id: invoiceId,
      patientId: String(body.patientId || ''),
      quoteId: String(body.quoteId || ''),
      status: String(body.status || 'draft'),
      createdAt,
      data: toInputJson({ ...body, id: invoiceId }),
    },
  });
  return { status: 'ok' };
});

server.delete('/invoices', async () => {
  await prisma.invoice.deleteMany({});
  return { status: 'ok' };
});

// NEAK check history
server.get('/neak-checks', async (request) => {
  const { patientId } = request.query as { patientId?: string };
  const rows = await prisma.neakCheck.findMany({
    where: patientId ? { patientId } : undefined,
    orderBy: { checkedAt: 'desc' },
  });
  return rows.map((row) => row.data);
});

server.put('/neak-checks/:id', async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as JsonRecord;
  const checkedAt = body.checkedAt ? toDate(String(body.checkedAt)) : new Date();
  await prisma.neakCheck.upsert({
    where: { id },
    update: {
      patientId: String(body.patientId || ''),
      checkedAt,
      data: toInputJson({ ...body, id }),
    },
    create: {
      id,
      patientId: String(body.patientId || ''),
      checkedAt,
      data: toInputJson({ ...body, id }),
    },
  });
  return { status: 'ok' };
});

// Odontogram current/daily/history
server.get('/odontogram/current/:patientId', async (request) => {
  const { patientId } = request.params as { patientId: string };
  const row = await prisma.odontogramCurrent.findUnique({ where: { patientId } });
  if (!row) return null;
  return row.data;
});

server.put('/odontogram/current/:patientId', async (request) => {
  const { patientId } = request.params as { patientId: string };
  const body = request.body as JsonRecord;
  await prisma.odontogramCurrent.upsert({
    where: { patientId },
    update: {
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      data: toInputJson(body),
    },
    create: {
      patientId,
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      data: toInputJson(body),
    },
  });
  return { status: 'ok' };
});

server.get('/odontogram/daily/:patientId/:dateKey', async (request) => {
  const { patientId, dateKey } = request.params as { patientId: string; dateKey: string };
  const row = await prisma.odontogramDaily.findUnique({ where: { patientId_dateKey: { patientId, dateKey } } });
  return row?.data ?? null;
});

server.put('/odontogram/daily/:patientId/:dateKey', async (request) => {
  const { patientId, dateKey } = request.params as { patientId: string; dateKey: string };
  const body = request.body as JsonRecord;
  await prisma.odontogramDaily.upsert({
    where: { patientId_dateKey: { patientId, dateKey } },
    update: {
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      data: toInputJson(body),
    },
    create: {
      patientId,
      dateKey,
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      data: toInputJson(body),
    },
  });
  return { status: 'ok' };
});

server.get('/odontogram/history/:patientId', async (request) => {
  const { patientId } = request.params as { patientId: string };
  const rows = await prisma.odontogramDaily.findMany({
    where: { patientId },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map((row) => ({
    dateKey: row.dateKey,
    updatedAt: row.updatedAt.toISOString(),
  }));
});

// Odontogram timeline
server.get('/odontogram/timeline/:patientId', async (request) => {
  const { patientId } = request.params as { patientId: string };
  const rows = await prisma.odontogramTimeline.findMany({
    where: { patientId },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map((row) => ({ snapshotId: row.snapshotId, updatedAt: row.updatedAt.toISOString() }));
});

server.get('/odontogram/timeline/:patientId/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const row = await prisma.odontogramTimeline.findUnique({ where: { snapshotId } });
  if (!row || row.patientId !== patientId) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  return row.data;
});

server.post('/odontogram/timeline/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const body = request.body as JsonRecord;
  const snapshotId = String(body.snapshotId || randomUUID());
  const updatedAt = body.updatedAt ? toDate(String(body.updatedAt)) : new Date();
  await prisma.odontogramTimeline.create({
    data: {
      snapshotId,
      patientId,
      updatedAt,
      data: toInputJson(body),
    },
  });
  return reply.code(201).send({ snapshotId, updatedAt: updatedAt.toISOString() });
});

server.put('/odontogram/timeline/:patientId/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const body = request.body as JsonRecord;
  const updatedAt = body.updatedAt ? toDate(String(body.updatedAt)) : new Date();
  try {
    await prisma.odontogramTimeline.update({
      where: { snapshotId },
      data: {
        patientId,
        updatedAt,
        data: toInputJson(body),
      },
    });
    return { snapshotId, updatedAt: updatedAt.toISOString() };
  } catch {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
});

server.delete('/odontogram/timeline/:patientId/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const row = await prisma.odontogramTimeline.findUnique({ where: { snapshotId } });
  if (!row || row.patientId !== patientId) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  await prisma.odontogramTimeline.delete({ where: { snapshotId } });
  return { status: 'ok' };
});

// Data export/import
server.get('/data/export', async () => {
  const [patients, catalog, quotes, settings, dentalStatusSnapshots, invoices, neakChecks] =
    await Promise.all([
      prisma.patient.findMany(),
      prisma.catalogItem.findMany(),
      prisma.quote.findMany(),
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.dentalStatusSnapshot.findMany(),
      prisma.invoice.findMany(),
      prisma.neakCheck.findMany(),
    ]);

  const exportData: ExportData = {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    patients,
    catalog,
    quotes: quotes.map((q) => q.data),
    settings: parseJsonObject(settings?.data, defaultSettings),
    dentalStatusSnapshots,
    invoices: invoices.map((i) => i.data),
    neakChecks: neakChecks.map((n) => n.data),
  };

  return exportData;
});

server.post('/data/import', async (request, reply) => {
  const body = request.body as ExportData;
  if (!body || !Array.isArray(body.patients) || !Array.isArray(body.catalog) || !Array.isArray(body.quotes)) {
    return reply.code(400).send({ message: 'Invalid import payload' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.odontogramTimeline.deleteMany({});
    await tx.odontogramDaily.deleteMany({});
    await tx.odontogramCurrent.deleteMany({});
    await tx.neakCheck.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.dentalStatusSnapshot.deleteMany({});
    await tx.quote.deleteMany({});
    await tx.catalogItem.deleteMany({});
    await tx.patient.deleteMany({});

    for (const rawPatient of body.patients as JsonRecord[]) {
      await tx.patient.create({
        data: {
          patientId: String(rawPatient.patientId || randomUUID()),
          title: rawPatient.title ? String(rawPatient.title) : null,
          lastName: String(rawPatient.lastName || ''),
          firstName: String(rawPatient.firstName || ''),
          sex: String(rawPatient.sex || 'other') as 'male' | 'female' | 'other',
          birthDate: toDate(String(rawPatient.birthDate || new Date().toISOString())),
          birthPlace: rawPatient.birthPlace ? String(rawPatient.birthPlace) : null,
          insuranceNum: rawPatient.insuranceNum ? String(rawPatient.insuranceNum) : null,
          phone: rawPatient.phone ? String(rawPatient.phone) : null,
          email: rawPatient.email ? String(rawPatient.email) : null,
          country: rawPatient.country ? String(rawPatient.country) : null,
          isForeignAddress: Boolean(rawPatient.isForeignAddress),
          zipCode: rawPatient.zipCode ? String(rawPatient.zipCode) : null,
          city: rawPatient.city ? String(rawPatient.city) : null,
          street: rawPatient.street ? String(rawPatient.street) : null,
          patientType: rawPatient.patientType ? String(rawPatient.patientType) : null,
          notes: rawPatient.notes ? String(rawPatient.notes) : null,
          createdAt: rawPatient.createdAt ? toDate(String(rawPatient.createdAt)) : new Date(),
          updatedAt: rawPatient.updatedAt ? toDate(String(rawPatient.updatedAt)) : new Date(),
          isArchived: Boolean(rawPatient.isArchived),
        },
      });
    }

    for (const rawCatalog of body.catalog as JsonRecord[]) {
      await tx.catalogItem.create({
        data: {
          catalogItemId: String(rawCatalog.catalogItemId || randomUUID()),
          catalogCode: String(rawCatalog.catalogCode || ''),
          catalogName: String(rawCatalog.catalogName || ''),
          catalogUnit: String(rawCatalog.catalogUnit || 'alkalom'),
          catalogPrice: Number(rawCatalog.catalogPrice || 0),
          catalogPriceCurrency: String(rawCatalog.catalogPriceCurrency || 'HUF'),
          catalogVatRate: Number(rawCatalog.catalogVatRate || 0),
          catalogTechnicalPrice: Number(rawCatalog.catalogTechnicalPrice || 0),
          catalogCategory: String(rawCatalog.catalogCategory || 'Diagnosztika'),
          hasTechnicalPrice: Boolean(rawCatalog.hasTechnicalPrice),
          isFullMouth: Boolean(rawCatalog.isFullMouth),
          isArch: Boolean(rawCatalog.isArch),
          isActive: rawCatalog.isActive === undefined ? true : Boolean(rawCatalog.isActive),
        },
      });
    }

    for (const rawQuote of body.quotes as JsonRecord[]) {
      await tx.quote.create({
        data: {
          quoteId: String(rawQuote.quoteId || randomUUID()),
          patientId: String(rawQuote.patientId || ''),
          quoteStatus: String(rawQuote.quoteStatus || 'draft'),
          createdAt: rawQuote.createdAt ? toDate(String(rawQuote.createdAt)) : new Date(),
          lastStatusChangeAt: rawQuote.lastStatusChangeAt
            ? toDate(String(rawQuote.lastStatusChangeAt))
            : new Date(),
          isDeleted: Boolean(rawQuote.isDeleted),
          data: toInputJson(rawQuote),
        },
      });
    }

    for (const rawSnapshot of (body.dentalStatusSnapshots || []) as JsonRecord[]) {
      await tx.dentalStatusSnapshot.create({
        data: {
          snapshotId: String(rawSnapshot.snapshotId || randomUUID()),
          patientId: String(rawSnapshot.patientId || ''),
          takenAt: rawSnapshot.takenAt ? toDate(String(rawSnapshot.takenAt)) : new Date(),
          note: rawSnapshot.note ? String(rawSnapshot.note) : null,
          teeth: toInputJson(rawSnapshot.teeth || {}),
        },
      });
    }

    for (const rawInvoice of (body.invoices || []) as JsonRecord[]) {
      await tx.invoice.create({
        data: {
          id: String(rawInvoice.id || randomUUID()),
          patientId: String(rawInvoice.patientId || ''),
          quoteId: String(rawInvoice.quoteId || ''),
          status: String(rawInvoice.status || 'draft'),
          createdAt: rawInvoice.createdAt ? toDate(String(rawInvoice.createdAt)) : new Date(),
          data: toInputJson(rawInvoice),
        },
      });
    }

    for (const rawNeak of (body.neakChecks || []) as JsonRecord[]) {
      await tx.neakCheck.create({
        data: {
          id: String(rawNeak.id || randomUUID()),
          patientId: String(rawNeak.patientId || ''),
          checkedAt: rawNeak.checkedAt ? toDate(String(rawNeak.checkedAt)) : new Date(),
          data: toInputJson(rawNeak),
        },
      });
    }

    await tx.appSettings.upsert({
      where: { id: 'default' },
      update: { data: toInputJson(body.settings || defaultSettings) },
      create: { id: 'default', data: toInputJson(body.settings || defaultSettings) },
    });
  });

  return { status: 'ok' };
});

// Existing patient snapshot compatibility routes
server.get('/patients/:patientId/snapshots', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const patient = await prisma.patient.findUnique({ where: { patientId } });
  if (!patient) {
    return reply.code(404).send({ message: 'Patient not found' });
  }
  return prisma.dentalStatusSnapshot.findMany({
    where: { patientId },
    orderBy: { takenAt: 'desc' },
  });
});

server.get('/patients/:patientId/snapshots/latest', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const patient = await prisma.patient.findUnique({ where: { patientId } });
  if (!patient) {
    return reply.code(404).send({ message: 'Patient not found' });
  }
  return prisma.dentalStatusSnapshot.findFirst({
    where: { patientId },
    orderBy: { takenAt: 'desc' },
  });
});

server.get('/patients/:patientId/snapshots/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const snapshot = await prisma.dentalStatusSnapshot.findFirst({ where: { patientId, snapshotId } });
  if (!snapshot) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  return snapshot;
});

server.post('/patients/:patientId/snapshots', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  const body = request.body as JsonRecord;
  const snapshot = await prisma.dentalStatusSnapshot.create({
    data: {
      snapshotId: randomUUID(),
      patientId,
      takenAt: body.takenAt ? toDate(String(body.takenAt)) : new Date(),
      note: body.note ? String(body.note) : null,
      teeth: toInputJson(body.payload || body.teeth || {}),
    },
  });
  return reply.code(201).send(snapshot);
});

server.patch('/patients/:patientId/snapshots/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const body = request.body as JsonRecord;
  try {
    const snapshot = await prisma.dentalStatusSnapshot.update({
      where: { snapshotId },
      data: {
        patientId,
        note: body.note === undefined ? undefined : (body.note ? String(body.note) : null),
        takenAt: body.takenAt === undefined ? undefined : toDate(String(body.takenAt)),
        teeth: body.payload === undefined && body.teeth === undefined
          ? undefined
          : toInputJson(body.payload || body.teeth),
      },
    });
    return snapshot;
  } catch {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
});

server.delete('/patients/:patientId/snapshots/:snapshotId', async (request, reply) => {
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const snapshot = await prisma.dentalStatusSnapshot.findFirst({ where: { patientId, snapshotId } });
  if (!snapshot) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  await prisma.dentalStatusSnapshot.delete({ where: { snapshotId } });
  return { status: 'ok' };
});

// ---- Integrated Szamlazz + NEAK API (moved from server/) ----
const INVOICE_MODE = process.env.INVOICE_MODE || 'preview';
const SZAMLAZZ_ENDPOINT = 'https://www.szamlazz.hu/szamla/';
const AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || '';

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const escapeXml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toDateOnly = (value: string) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizePaymentMethod = (value: string) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'atutalas') return 'Atutalas';
  if (normalized === 'keszpenz') return 'Keszpenz';
  if (normalized === 'bankkartya') return 'Bankkartya';
  return value || 'Atutalas';
};

const validateAndNormalizePayload = (input: JsonRecord) => {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { errors: ['Hianyzo payload'] };
  }

  const seller = (input.seller as JsonRecord) || {};
  const buyer = (input.buyer as JsonRecord) || {};
  const invoice = (input.invoice as JsonRecord) || {};
  const items = Array.isArray(input.items) ? (input.items as JsonRecord[]) : [];

  if (!seller.name) errors.push('Elado neve kotelezo');
  if (!buyer.name) errors.push('Vevo neve kotelezo');
  if (items.length === 0) errors.push('Legalabb egy tetel kotelezo');

  const normalizedItems = items.map((item, index) => {
    const qty = Number(item.qty);
    const unitPriceNet = Number(item.unitPriceNet ?? item.unitPrice ?? 0);
    const vatRate = Number(item.vatRate ?? 27);

    if (!Number.isFinite(qty) || qty <= 0) errors.push(`Tetel ${index + 1}: qty > 0 kotelezo`);
    if (!Number.isFinite(unitPriceNet) || unitPriceNet < 0)
      errors.push(`Tetel ${index + 1}: unitPriceNet >= 0 kotelezo`);
    if (!Number.isFinite(vatRate) || vatRate < 0)
      errors.push(`Tetel ${index + 1}: vatRate >= 0 kotelezo`);

    const net = round(qty * unitPriceNet);
    const vat = round((net * vatRate) / 100);
    const gross = round(net + vat);

    return {
      name: item.name || `Tetel ${index + 1}`,
      unit: item.unit || 'db',
      qty,
      unitPriceNet,
      vatRate,
      net,
      vat,
      gross,
      comment: item.comment || '',
    };
  });

  const totals = normalizedItems.reduce(
    (acc, item) => {
      acc.net = round(acc.net + item.net);
      acc.vat = round(acc.vat + item.vat);
      acc.gross = round(acc.gross + item.gross);
      return acc;
    },
    { net: 0, vat: 0, gross: 0 }
  );

  return {
    errors,
    payload: {
      seller,
      buyer,
      invoice: {
        paymentMethod: normalizePaymentMethod(String(invoice.paymentMethod || 'atutalas')),
        fulfillmentDate: toDateOnly(String(invoice.fulfillmentDate || '')),
        dueDate: toDateOnly(String(invoice.dueDate || '')),
        issueDate: toDateOnly(String(invoice.issueDate || '')),
        currency: String(invoice.currency || 'HUF'),
        comment: String(invoice.comment || ''),
        language: String(invoice.language || 'hu'),
        eInvoice: Boolean(invoice.eInvoice),
      },
      items: normalizedItems,
      totals,
    },
  };
};

const buildInvoiceXml = (params: {
  seller: JsonRecord;
  buyer: JsonRecord;
  invoice: JsonRecord;
  items: Array<{
    name: unknown;
    unit: unknown;
    qty: number;
    unitPriceNet: number;
    vatRate: number;
    net: number;
    vat: number;
    gross: number;
    comment: unknown;
  }>;
}) => {
  const { seller, buyer, invoice, items } = params;
  const tetelXml = items
    .map(
      (item) => `
      <tetel>
        <megnevezes>${escapeXml(item.name)}</megnevezes>
        <mennyiseg>${item.qty}</mennyiseg>
        <mennyisegiEgyseg>${escapeXml(item.unit)}</mennyisegiEgyseg>
        <nettoEgysegar>${item.unitPriceNet.toFixed(2)}</nettoEgysegar>
        <afakulcs>${item.vatRate}</afakulcs>
        <nettoErtek>${item.net.toFixed(2)}</nettoErtek>
        <afaErtek>${item.vat.toFixed(2)}</afaErtek>
        <bruttoErtek>${item.gross.toFixed(2)}</bruttoErtek>
        <megjegyzes>${escapeXml(item.comment)}</megjegyzes>
      </tetel>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>${invoice.eInvoice ? 'true' : 'false'}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <aggregator></aggregator>
    <szamlaKulsoAzon></szamlaKulsoAzon>
  </beallitasok>
  <fejlec>
    <teljesitesDatum>${escapeXml(invoice.fulfillmentDate)}</teljesitesDatum>
    <fizetesiHataridoDatum>${escapeXml(invoice.dueDate)}</fizetesiHataridoDatum>
    <fizmod>${escapeXml(invoice.paymentMethod)}</fizmod>
    <penznem>${escapeXml(invoice.currency)}</penznem>
    <szamlaNyelve>${escapeXml(invoice.language || 'hu')}</szamlaNyelve>
    <megjegyzes>${escapeXml(invoice.comment)}</megjegyzes>
    <arfolyamBank></arfolyamBank>
    <arfolyam>0</arfolyam>
    <rendelesSzam></rendelesSzam>
    <dijbekeroSzamlaszam></dijbekeroSzamlaszam>
    <elolegszamla>false</elolegszamla>
    <vegszamla>false</vegszamla>
    <helyesbitoszamla>false</helyesbitoszamla>
    <helyesbitettSzamlaszam></helyesbitettSzamlaszam>
    <dijbekero>false</dijbekero>
  </fejlec>
  <elado>
    <bank>${escapeXml(seller.bank || '')}</bank>
    <bankszamlaszam>${escapeXml(seller.bankAccount || '')}</bankszamlaszam>
    <emailReplyto>${escapeXml(seller.email || '')}</emailReplyto>
    <emailTargy></emailTargy>
    <emailSzoveg></emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(buyer.name || '')}</nev>
    <irsz>${escapeXml(buyer.zip || '')}</irsz>
    <telepules>${escapeXml(buyer.city || '')}</telepules>
    <cim>${escapeXml(buyer.address || '')}</cim>
    <email>${escapeXml(buyer.email || '')}</email>
    <sendEmail>false</sendEmail>
    <adoszam></adoszam>
    <postazasiNev></postazasiNev>
    <postazasiIrsz></postazasiIrsz>
    <postazasiTelepules></postazasiTelepules>
    <postazasiCim></postazasiCim>
    <azonosito></azonosito>
    <telefonszam></telefonszam>
    <megjegyzes></megjegyzes>
  </vevo>
  <fuvarlevel>
    <uticel></uticel>
    <futarSzolgalat></futarSzolgalat>
  </fuvarlevel>
  <tetelek>${tetelXml}
  </tetelek>
</xmlszamla>`;
};

const parseSzamlazzResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  const headerInvoiceNumber = response.headers.get('szlahu_szamlaszam');
  const headerError = response.headers.get('szlahu_error');
  const headerErrorCode = response.headers.get('szlahu_error_code');

  const decodedInvoiceNumber = headerInvoiceNumber
    ? decodeURIComponent(headerInvoiceNumber.replace(/\+/g, ' '))
    : null;
  const decodedError = headerError ? decodeURIComponent(headerError.replace(/\+/g, ' ')) : null;

  if (contentType.includes('application/pdf')) {
    return {
      success: true,
      pdfBase64: rawBuffer.toString('base64'),
      rawResponse: null,
      invoiceNumber: decodedInvoiceNumber,
      providerSuccess: true,
    };
  }

  const rawText = rawBuffer.toString('utf8');
  const sikeresTag = rawText.match(/<sikeres>\s*(true|false)\s*<\/sikeres>/i)?.[1]?.toLowerCase();
  const xmlSuccess = sikeresTag === 'true';
  const xmlInvoiceNumber = rawText.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)?.[1] || null;
  const pdfBase64Match = rawText.match(/<pdf>([^<]+)<\/pdf>/i);
  const pdfBase64 = pdfBase64Match?.[1] || null;

  const hibauzenetMatch =
    rawText.match(/<hibauzenet><!\[CDATA\[([\s\S]*?)\]\]><\/hibauzenet>/i) ||
    rawText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i);
  const hibakodMatch =
    rawText.match(/<hibakod><!\[CDATA\[([\s\S]*?)\]\]><\/hibakod>/i) ||
    rawText.match(/<hibakod>([^<]+)<\/hibakod>/i);

  const hasSzamlazzErrorCode =
    Boolean(hibakodMatch?.[1]) && String(hibakodMatch?.[1]).trim() !== '0';
  const hasHeaderError = Boolean(headerErrorCode) && String(headerErrorCode).trim() !== '0';

  const providerSuccess =
    response.ok && (sikeresTag ? xmlSuccess : !hasHeaderError) && !hasSzamlazzErrorCode;

  const invoiceNumber = decodedInvoiceNumber || xmlInvoiceNumber || null;

  const message = providerSuccess
    ? undefined
    : decodedError ||
      [hibakodMatch?.[1] ? `Hibakod: ${hibakodMatch?.[1]}` : '', hibauzenetMatch?.[1] || 'Szamlazz.hu hiba']
        .filter(Boolean)
        .join(' - ');

  return {
    success: providerSuccess,
    invoiceNumber,
    pdfBase64,
    rawResponse: rawText,
    providerSuccess,
    message,
  };
};

server.post('/api/szamlazz/preview-invoice', async (request, reply) => {
  try {
    const { errors, payload } = validateAndNormalizePayload(request.body as JsonRecord);
    if (errors.length > 0 || !payload) {
      return reply.code(400).send({ success: false, message: 'Ervenytelen adatok', errors });
    }

    const xml = buildInvoiceXml(payload as never);
    return {
      mode: 'preview',
      success: true,
      xml,
      totals: payload.totals,
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      message: 'Szerver hiba a preview-invoice feldolgozas kozben.',
    });
  }
});

server.post('/api/szamlazz/create-invoice', async (request, reply) => {
  try {
    const { errors, payload } = validateAndNormalizePayload(request.body as JsonRecord);
    if (errors.length > 0 || !payload) {
      return reply.code(400).send({ success: false, message: 'Ervenytelen adatok', errors });
    }

    const xml = buildInvoiceXml(payload as never);

    if (INVOICE_MODE !== 'live') {
      return {
        mode: 'preview',
        success: true,
        xml,
        totals: payload.totals,
      };
    }

    if (!AGENT_KEY) {
      return reply.code(500).send({ success: false, message: 'Hianyzik a SZAMLAZZ_AGENT_KEY' });
    }

    const form = new FormData();
    form.append('action-xmlagentxmlfile', new Blob([xml], { type: 'application/xml' }), 'invoice.xml');

    const response = await fetch(SZAMLAZZ_ENDPOINT, { method: 'POST', body: form });
    const parsed = await parseSzamlazzResponse(response);
    return reply.code(response.ok ? 200 : 502).send({ mode: 'live', ...parsed });
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({
      mode: 'live',
      success: false,
      message: 'A szamla letrehozas szerver oldalon sikertelen.',
    });
  }
});

server.post('/api/szamlazz/storno-invoice', async (request, reply) => {
  try {
    const body = request.body as JsonRecord;
    const invoiceNumber = String(body.invoiceNumber || '');
    if (!invoiceNumber) {
      return reply.code(400).send({ success: false, message: 'Hianyzik a szamlaszam (invoiceNumber)' });
    }

    if (INVOICE_MODE !== 'live') {
      return {
        mode: 'preview',
        success: true,
        message: 'Sztorno preview mod - nem kuldtuk el.',
      };
    }

    if (!AGENT_KEY) {
      return reply.code(500).send({ success: false, message: 'Hianyzik a SZAMLAZZ_AGENT_KEY' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const stornoXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <szamlaLetoltesPld>1</szamlaLetoltesPld>
    <szamlaKulsoAzon></szamlaKulsoAzon>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
    <keltDatum>${today}</keltDatum>
    <tipus>SS</tipus>
  </fejlec>
  <elado>
    <emailReplyto></emailReplyto>
    <emailTargy></emailTargy>
    <emailSzoveg></emailSzoveg>
  </elado>
  <vevo>
    <email></email>
  </vevo>
</xmlszamlast>`;

    const form = new FormData();
    form.append('action-szamla_agent_st', new Blob([stornoXml], { type: 'application/xml' }), 'storno.xml');

    const response = await fetch(SZAMLAZZ_ENDPOINT, { method: 'POST', body: form });
    const parsed = await parseSzamlazzResponse(response);
    return reply.code(response.ok ? 200 : 502).send({ mode: 'live', ...parsed });
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({
      mode: 'live',
      success: false,
      message: 'A sztorno szamla letrehozas szerver oldalon sikertelen.',
    });
  }
});

server.get('/api/szamlazz/health', async () => ({ ok: true, mode: INVOICE_MODE }));

const NEAK_OJOTE_KEY = process.env.NEAK_OJOTE_KEY || '';
const NEAK_OJOTE_ENV = process.env.NEAK_OJOTE_ENV || 'production';
const NEAK_WSS_USER = process.env.NEAK_WSS_USER || '';
const NEAK_WSS_PASS = process.env.NEAK_WSS_PASS || '';
const NEAK_ENDPOINT =
  NEAK_OJOTE_ENV === 'test'
    ? 'https://tesztjogviszony.neak.gov.hu/ojote/jogviszonyV12'
    : 'https://jogviszony.neak.gov.hu/ojote/jogviszonyV12';
const NEAK_PING_URL =
  NEAK_OJOTE_ENV === 'test'
    ? 'https://tesztjogviszony.neak.gov.hu/ojote/ping'
    : 'https://jogviszony.neak.gov.hu/ojote/ping';

server.get('/api/neak/ping', async (_request, reply) => {
  try {
    const response = await fetch(NEAK_PING_URL);
    const text = await response.text();
    return { ok: response.ok, response: text };
  } catch (error) {
    return reply.code(502).send({ ok: false, response: String(error) });
  }
});

server.post('/api/neak/jogviszony', async (request, reply) => {
  try {
    const body = request.body as JsonRecord;
    const taj = String(body.taj || '').replace(/-/g, '');

    if (!/^\d{9}$/.test(taj)) {
      return reply
        .code(400)
        .send({ success: false, hibaKod: '4', message: 'TAJ must be exactly 9 digits' });
    }
    if (!NEAK_OJOTE_KEY) {
      return reply
        .code(500)
        .send({ success: false, hibaKod: '8', message: 'Missing NEAK_OJOTE_KEY in server config' });
    }
    if (!NEAK_WSS_USER || !NEAK_WSS_PASS) {
      return reply
        .code(500)
        .send({ success: false, hibaKod: '8', message: 'Missing NEAK_WSS_USER / NEAK_WSS_PASS in server config' });
    }

    const soapXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ojot="http://ojote/">
  <soapenv:Header>
    <wsse:Security soapenv:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(NEAK_WSS_USER)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(NEAK_WSS_PASS)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ojot:jogviszonyTAJV12Element>
      <ojot:program_azon>${escapeXml(NEAK_OJOTE_KEY)}</ojot:program_azon>
      <ojot:ruser></ojot:ruser>
      <ojot:taj>${escapeXml(taj)}</ojot:taj>
    </ojot:jogviszonyTAJV12Element>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(NEAK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://ojote//jogviszonyTAJV12',
      },
      body: soapXml,
    });

    const rawText = await response.text();
    const extractTag = (tag: string) => {
      const re = new RegExp(`<(?:[\\w]+:)?${tag}(?:\\s[^>]*)?>([^<]+)<\\/(?:[\\w]+:)?${tag}>`);
      return rawText.match(re)?.[1] || undefined;
    };

    const jogviszony = extractTag('jogviszony');
    const hibaKod = extractTag('hibaKod') || '0';
    const hibaSzoveg = extractTag('hibaSzoveg');
    const torlesNapja = extractTag('torlesNapja');
    const kozlemeny = extractTag('kozlemeny');

    const success = hibaKod === '0' && response.ok;
    return { success, jogviszony, hibaKod, hibaSzoveg, torlesNapja, kozlemeny };
  } catch (_error) {
    return reply
      .code(502)
      .send({ success: false, hibaKod: '2', message: 'NEAK jogviszony request failed' });
  }
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
