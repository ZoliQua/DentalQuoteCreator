import 'dotenv/config';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from './db.js';
import rruleLib from 'rrule';
import Twilio from 'twilio';
import nodemailer from 'nodemailer';
import { calendar_v3, auth as googleAuth } from '@googleapis/calendar';
const { RRule } = rruleLib;

function parseUserAgent(ua: string) {
  let browser = '';
  let os = '';
  let device = 'desktop';

  // Browser detection
  if (/Edg\/(\S+)/i.test(ua)) browser = 'Edge ' + RegExp.$1;
  else if (/OPR\/(\S+)/i.test(ua)) browser = 'Opera ' + RegExp.$1;
  else if (/Chrome\/(\S+)/i.test(ua)) browser = 'Chrome ' + RegExp.$1;
  else if (/Firefox\/(\S+)/i.test(ua)) browser = 'Firefox ' + RegExp.$1;
  else if (/Version\/(\S+).*Safari/i.test(ua)) browser = 'Safari ' + RegExp.$1;
  else if (/MSIE (\S+)/i.test(ua)) browser = 'IE ' + RegExp.$1;

  // OS detection
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10+';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X (\d+[._]\d+)/i.test(ua)) os = 'macOS ' + RegExp.$1.replace(/_/g, '.');
  else if (/Android (\S+)/i.test(ua)) os = 'Android ' + RegExp.$1;
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Device detection
  if (/Mobile|Android.*Mobile/i.test(ua)) device = 'mobile';
  else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) device = 'tablet';

  return { browser: browser || null, os: os || null, device };
}

type JsonRecord = Record<string, unknown>;
type PermissionMap = Record<PermissionKey, boolean>;

const scrypt = promisify(scryptCallback);
const createShortId = (): string => randomBytes(4).toString('hex');
const createSessionId = (): string => 'AS' + randomBytes(4).toString('hex');
const createAuditId = (): string => 'PA' + randomBytes(4).toString('hex');
const createActivityId = (): string => 'UA' + randomBytes(4).toString('hex');
const createPermOverrideId = (): string => 'UP' + randomBytes(4).toString('hex');
const createNeakCheckId = (): string => 'NC' + randomBytes(5).toString('hex');
const createVisitorLogId = (): string => 'VL' + randomBytes(4).toString('hex');
const createAppointmentId = (): string => 'APT' + randomBytes(4).toString('hex');
const createAppointmentTypeId = (): string => 'atype' + randomBytes(3).toString('hex');
/** Format a Date as RRULE DTSTART value (YYYYMMDDTHHmmss) */
const formatRRuleDt = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const createChairId = (nr: number): string => `chair-${String(nr).padStart(2, '0')}`;
const createSmsLogId = (): string => 'SL' + randomBytes(4).toString('hex');
const createEmailLogId = (): string => 'EL' + randomBytes(4).toString('hex');

const MAX_ID_RETRIES = 5;
async function createWithUniqueId<T>(
  idFn: () => string,
  createFn: (id: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
    try {
      return await createFn(idFn());
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isUniqueViolation || attempt === MAX_ID_RETRIES - 1) throw err;
    }
  }
  throw new Error('Unreachable');
}

const ALL_PERMISSION_KEYS = [
  'quotes.view',
  'quotes.create',
  'quotes.delete',
  'invoices.view',
  'invoices.view.detail',
  'invoices.issue',
  'invoices.storno',
  'pricelist.view',
  'pricelist.create',
  'pricelist.update',
  'pricelist.delete',
  'pricelist.restore',
  'pricelist.category.create',
  'pricelist.category.update',
  'pricelist.category.delete',
  'pricelist.category.restore',
  'catalog.create',
  'catalog.update',
  'catalog.deactivate',
  'catalog.delete',
  'catalog.restore',
  'patients.update',
  'patients.create',
  'patients.delete',
  'lab.view',
  'settings.view',
  'settings.edit',
  'data.view',
  'data.browse',
  'calendar.view',
  'calendar.create',
  'calendar.delete',
  'sms.send',
  'sms.history',
  'sms.settings',
  'email.send',
  'email.history',
  'email.settings',
  'notifications.view',
  'admin.users.manage',
  'admin.permissions.manage',
] as const;

type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];
type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  permissions: PermissionMap;
};

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
  pricelists?: unknown[];
  pricelistCategories?: unknown[];
};

const DATA_VERSION = '2.0.0';

const defaultSettings: JsonRecord = {
  clinic: {
    name: 'Macko Dental Kft.',
    address: '9700 Szombathely, Fő tér 1.',
    phone: '+36 94 123 456',
    email: 'info@mackodental.hu',
    website: 'www.mackodental.hu',
  },
  doctors: [{ id: 'DOC0001', name: 'Dr. Dul Zoltán', stampNumber: '' }],
  pdf: {
    hu: {
      footerText: 'Az árajánlat tájékoztató jellegű és a fent jelölt ideig érvényes.',
      warrantyText: 'Garanciális feltételek a rendelőben.',
    },
    en: {
      footerText: 'This quote is for informational purposes only and valid until the date indicated above.',
      warrantyText: 'Warranty conditions at the clinic.',
    },
    de: {
      footerText: 'Dieses Angebot dient nur zur Information und ist bis zum oben angegebenen Datum gültig.',
      warrantyText: 'Garantiebedingungen in der Praxis.',
    },
  },
  quote: {
    prefix: 'MDKD',
    counter: 0,
    deletedCount: 0,
    quoteLang: 'hu',
  },
  invoice: {
    invoiceType: 'paper',
    defaultComment: '',
    defaultVatRate: 0,
  },
  patient: {
    defaultCountry: 'Magyarország',
    patientTypes: ['Privát páciens', 'NEAK páciens'],
  },
  calendar: {
    slotInterval: 15,
    slotIntervalOptions: [5, 10, 15, 30, 45, 60, 90, 120, 150],
    chairCount: 2,
    chairNames: ['1. szék', '2. szék'],
    showWeekends: true,
    defaultView: 'week',
    defaultDuration: 30,
    workingHours: [
      { dayOfWeek: 0, isWorkday: false, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 1, isWorkday: true, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 2, isWorkday: true, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 3, isWorkday: true, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 4, isWorkday: true, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 5, isWorkday: true, startTime: '08:00', endTime: '14:00' },
      { dayOfWeek: 6, isWorkday: false, startTime: '08:00', endTime: '14:00' },
    ],
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

const hashToken = (value: string): string => createHash('sha256').update(value).digest('hex');

const hashPassword = async (plainTextPassword: string): Promise<string> => {
  const normalized = plainTextPassword.trim();
  if (!normalized) {
    throw new Error('Password is required');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(normalized, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
};

const verifyPassword = async (plainTextPassword: string, storedHash: string): Promise<boolean> => {
  const [salt, keyHex] = String(storedHash || '').split(':');
  if (!salt || !keyHex) return false;
  const derived = (await scrypt(plainTextPassword, salt, 64)) as Buffer;
  const expected = Buffer.from(keyHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
};

const createToken = (): string => randomBytes(32).toString('hex');

const ROLE_PERMISSION_PRESETS: Record<UserRole, readonly PermissionKey[]> = {
  admin: [...ALL_PERMISSION_KEYS],
  beta_tester: [...ALL_PERMISSION_KEYS],
  receptionist: ALL_PERMISSION_KEYS.filter(k => !['admin.users.manage', 'admin.permissions.manage', 'lab.view', 'data.browse'].includes(k)),
  doctor: ['quotes.view', 'quotes.create', 'quotes.delete', 'invoices.view', 'invoices.view.detail', 'invoices.issue', 'invoices.storno', 'patients.create', 'patients.update', 'pricelist.view', 'catalog.deactivate', 'calendar.view', 'calendar.create', 'sms.send', 'sms.history', 'email.send', 'email.history', 'notifications.view'],
  assistant: ['quotes.view', 'quotes.create', 'quotes.delete', 'invoices.view', 'invoices.view.detail', 'invoices.issue', 'invoices.storno', 'patients.create', 'patients.update', 'patients.delete', 'pricelist.view', 'catalog.deactivate', 'calendar.view', 'calendar.create', 'sms.send', 'sms.history', 'email.send', 'email.history', 'notifications.view'],
  user: ['calendar.view', 'calendar.create'],
};

const VALID_ROLES: readonly string[] = ['admin', 'doctor', 'assistant', 'receptionist', 'user', 'beta_tester'];

const getDefaultPermissions = (role: UserRole): PermissionMap => {
  const preset = ROLE_PERMISSION_PRESETS[role] || [];
  return ALL_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = preset.includes(key);
    return acc;
  }, {} as PermissionMap);
};

const buildPermissionMap = (
  role: UserRole,
  overrides: Array<{ key: string; isAllowed: boolean }>
): PermissionMap => {
  const permissions = getDefaultPermissions(role);
  for (const override of overrides) {
    if (ALL_PERMISSION_KEYS.includes(override.key as PermissionKey)) {
      permissions[override.key as PermissionKey] = override.isAllowed;
    }
  }
  return permissions;
};

const toSafeUser = (user: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
};

const server = Fastify({
  logger: true,
  trustProxy: true,
  rewriteUrl: (req) => {
    const url = req.url || '/';
    return url.startsWith('/backend') ? url.slice('/backend'.length) || '/' : url;
  },
});

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: AuthenticatedUser | null;
    sessionId: string | null;
  }
}

const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS || 14);
const PUBLIC_ROUTE_PATTERNS = new Set(['/health', '/db-health', '/debug', '/auth/login', '/api/szamlazz/query-taxpayer', '/visitor-log', '/webhook/twilio', '/google-calendar/callback', '/google-calendar/webhook']);

const toClientPermissions = (permissions: PermissionMap) => {
  return ALL_PERMISSION_KEYS.map((key) => ({ key, isAllowed: permissions[key] }));
};

const resolveCurrentUser = async (token: string): Promise<{ user: AuthenticatedUser; sessionId: string } | null> => {
  const tokenHash = hashToken(token);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId: session.user.id },
  });
  const permissions = buildPermissionMap(session.user.role, overrides);
  const user: AuthenticatedUser = {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    role: session.user.role,
    isActive: session.user.isActive,
    permissions,
  };
  return { user, sessionId: session.id };
};

const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.currentUser) {
    await reply.code(401).send({ message: 'Authentication required' });
    return null;
  }
  return request.currentUser;
};

const hasPermission = (user: AuthenticatedUser, key: PermissionKey): boolean => {
  return Boolean(user.permissions[key]);
};

const requirePermission = async (
  request: FastifyRequest,
  reply: FastifyReply,
  key: PermissionKey
) => {
  const user = await requireAuth(request, reply);
  if (!user) return null;
  if (!hasPermission(user, key)) {
    await reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
    return null;
  }
  return user;
};

const requireAnyPermission = async (
  request: FastifyRequest,
  reply: FastifyReply,
  keys: PermissionKey[]
) => {
  const user = await requireAuth(request, reply);
  if (!user) return null;
  if (!keys.some((key) => hasPermission(user, key))) {
    await reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
    return null;
  }
  return user;
};

const logActivity = async (
  userId: string,
  action: string,
  opts?: { page?: string; entityType?: string; entityId?: string; details?: Record<string, unknown>; ipAddress?: string }
) => {
  try {
    await createWithUniqueId(createActivityId, (id) =>
      prisma.userActivityLog.create({
        data: {
          id,
          userId,
          action,
          page: opts?.page || null,
          entityType: opts?.entityType || null,
          entityId: opts?.entityId || null,
          details: opts?.details ? toInputJson(opts.details) : undefined,
          ipAddress: opts?.ipAddress || null,
        },
      }),
    );
  } catch {
    // Best-effort logging; do not break the main flow
  }
};

server.decorateRequest('currentUser', null as AuthenticatedUser | null);
server.decorateRequest('sessionId', null as string | null);

server.addHook('preHandler', async (request) => {
  request.currentUser = null;
  request.sessionId = null;

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return;

  const resolved = await resolveCurrentUser(token);
  if (!resolved) return;

  request.currentUser = resolved.user;
  request.sessionId = resolved.sessionId;

  await prisma.authSession.update({
    where: { id: resolved.sessionId },
    data: { lastSeenAt: new Date() },
  });
});

server.addHook('preHandler', async (request, reply) => {
  const routeUrl = request.routeOptions.url || request.url;
  if (PUBLIC_ROUTE_PATTERNS.has(routeUrl)) return;
  if (!request.currentUser) {
    await reply.code(401).send({ message: 'Authentication required' });
  }
});

server.get('/health', async () => ({ status: 'ok' }));

server.get('/db-health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

server.get('/debug', async () => {
  try {
    const [users, patients, quotes, invoices, pricelists, categories, catalogItems, sessions] =
      await Promise.all([
        prisma.user.count(),
        prisma.patient.count(),
        prisma.quote.count(),
        prisma.invoice.count(),
        prisma.priceList.count(),
        prisma.priceListCategory.count(),
        prisma.priceListCatalogItem.count(),
        prisma.authSession.count(),
      ]);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()) + 's',
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      counts: { users, patients, quotes, invoices, pricelists, categories, catalogItems, sessions },
      env: {
        NODE_ENV: process.env.NODE_ENV || '(not set)',
        DATABASE_URL: process.env.DATABASE_URL ? '***set***' : '***MISSING***',
      },
    };
  } catch (err) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

server.post('/seed', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.users.manage');
  if (!user) return;

  const { existsSync } = await import('fs');
  const { resolve, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const { readCsv: readCsvFromDir } = await import('./csvUtils.js');

  const __dir = dirname(fileURLToPath(import.meta.url));
  // In dev: __dir = backend/dist -> ../../src/data = src/data (monorepo root)
  // In prod: __dir = backend2/dist -> ../src/data = backend2/src/data
  let dataDir = resolve(__dir, '../../src/data');
  if (!existsSync(dataDir)) dataDir = resolve(__dir, '../src/data');

  function readCsv(filename: string): Record<string, string>[] {
    return readCsvFromDir(dataDir, filename);
  }

  const toBool = (val: string | undefined) => (val || '').toUpperCase() === 'TRUE' || val === '1';
  const toIntOrNull = (val: string): number | null => {
    if (!val || val === '') return null;
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : null;
  };

  try {
    const priceLists = readCsv('PriceList.csv');
    for (const row of priceLists) {
      const data = {
        priceListNameHu: row.priceListNameHu,
        priceListNameEn: row.priceListNameEn || '',
        priceListNameDe: row.priceListNameDe || '',
        isActive: toBool(row.isActive),
        isDeleted: toBool(row.isDeleted),
        isDefault: toBool(row.isDefault),
        isNeak: toBool(row.isNeak || 'FALSE'),
        isUserLocked: toBool(row.isUserLocked),
        listOfUsers: row.listOfUsers === '{}' ? [] : JSON.parse(row.listOfUsers || '[]'),
      };
      await prisma.priceList.upsert({ where: { priceListId: row.priceListId }, update: data, create: { priceListId: row.priceListId, ...data } });
    }

    const categories = readCsv('PriceListCategory.csv');
    for (const row of categories) {
      const data = {
        priceListId: row.priceListId,
        catalogCategoryPrefix: row.catalogCategoryPrefix,
        catalogCategoryHu: row.catalogCategoryHu,
        catalogCategoryEn: row.catalogCategoryEn || '',
        catalogCategoryDe: row.catalogCategoryDe || '',
        isActive: toBool(row.isActive),
        isDeleted: toBool(row.isDeleted),
      };
      await prisma.priceListCategory.upsert({ where: { catalogCategoryId: row.catalogCategoryId }, update: data, create: { catalogCategoryId: row.catalogCategoryId, ...data } });
    }

    const catLookup: Record<string, string> = {};
    for (const row of categories) catLookup[row.catalogCategoryId] = row.priceListId;

    const items = readCsv('PriceListCatalogItem.csv');
    for (const row of items) {
      const allowedTeeth = row.allowedTeeth ? row.allowedTeeth.split('|').map(Number).filter((n) => Number.isFinite(n)) : [];
      const catInfo = catLookup[row.catalogCategoryId];
      const data = {
        catalogCategoryId: row.catalogCategoryId || '',
        priceListId: catInfo || null,
        catalogCode: row.catalogCode,
        catalogNameHu: row.catalogNameHu,
        catalogNameEn: row.catalogNameEn || '',
        catalogNameDe: row.catalogNameDe || '',
        catalogUnit: row.catalogUnit,
        catalogPrice: Number(row.catalogPrice) || 0,
        catalogPriceCurrency: row.catalogPriceCurrency || 'HUF',
        catalogVatRate: Number(row.catalogVatRate) || 0,
        catalogTechnicalPrice: Number(row.catalogTechnicalPrice) || 0,
        svgLayer: row.svgLayer || '',
        hasLayer: toBool(row.hasLayer),
        hasTechnicalPrice: toBool(row.hasTechnicalPrice),
        isFullMouth: toBool(row.isFullMouth),
        isArch: toBool(row.isArch),
        isQuadrant: toBool(row.isQuadrant),
        maxTeethPerArch: row.maxTeethPerArch ? Number(row.maxTeethPerArch) : null,
        allowedTeeth,
        milkToothOnly: toBool(row.milkToothOnly),
        isActive: toBool(row.isActive),
      };
      await prisma.priceListCatalogItem.upsert({ where: { catalogItemId: row.catalogItemId }, update: data, create: { catalogItemId: row.catalogItemId, ...data } });
    }

    // Seed NeakDocumentType
    const neakDocs = readCsv('NeakDocumentType.csv');
    for (const row of neakDocs) {
      const data = {
        neakDocumentTypeCode: parseInt(row.neakDocumentTypeCode, 10) || 0,
        neakDocumentDetails: row.neakDocumentDetails || '',
      };
      await prisma.neakDocumentType.upsert({ where: { neakDocumentId: row.neakDocumentId }, update: data, create: { neakDocumentId: row.neakDocumentId, ...data } });
    }

    // Seed NeakLevel
    const neakLevels = readCsv('NeakLevel.csv');
    for (const row of neakLevels) {
      const data = {
        neakLevelInfoHu: row.NeakLevelInfoHu || '',
        neakLevelInfoEn: row.NeakLevelInfoEn || '',
        neakLevelInfoDe: row.NeakLevelInfoDe || '',
      };
      await prisma.neakLevel.upsert({ where: { neakLevelCode: row.NeakLevelCode }, update: data, create: { neakLevelCode: row.NeakLevelCode, ...data } });
    }

    // Seed NeakSpecial
    const neakSpecials = readCsv('NeakSpecial.csv');
    for (const row of neakSpecials) {
      const data = {
        neakSpecialMarkCode: row.neakSpecialMarkCode || '',
        neakSpecialDescHu: row.neakSpecialDescHu || '',
        neakSpecialDescEn: row.neakSpecialDescEn || '',
        neakSpecialDescDe: row.neakSpecialDescDe || '',
      };
      await prisma.neakSpecial.upsert({ where: { neakSpecialMark: parseInt(row.neakSpecialMark, 10) }, update: data, create: { neakSpecialMark: parseInt(row.neakSpecialMark, 10), ...data } });
    }

    // Seed NeakTerkat
    const neakTerkats = readCsv('NeakTerkat.csv');
    for (const row of neakTerkats) {
      const data = {
        neakTerKatInfoHu: row.NeakTerKatInfoHu || '',
        neakTerKatInfoEn: row.NeakTerKatInfoEn || '',
        neakTerKatInfoDe: row.NeakTerKatInfoDe || '',
      };
      await prisma.neakTerkat.upsert({ where: { neakTerKatCode: row.NeakTerKatCode }, update: data, create: { neakTerKatCode: row.NeakTerKatCode, ...data } });
    }

    // Seed NeakCatalogItem
    const neakItems = readCsv('NeakCatalogItem.csv');
    for (const row of neakItems) {
      const nData = {
        neakCode: row.neakCode,
        neakNameHu: row.neakNameHu,
        neakNameEn: row.neakNameEn || '',
        neakNameDe: row.neakNameDe || '',
        catalogCategoryId: row.catalogCategoryId,
        neakPoints: parseInt(row.neakPoints, 10) || 0,
        neakMinimumTimeMin: parseInt(row.neakMinimumTimeMin, 10) || 0,
        isFullMouth: toBool(row.isFullMouth),
        isTooth: toBool(row.isTooth),
        isArch: toBool(row.isArch),
        isQuadrant: toBool(row.isQuadrant),
        isSurface: toBool(row.isSurface),
        surfaceNum: row.surfaceNum || '',
        neakMaxQtyPerDay: toIntOrNull(row.neakMaxQtyPerDay),
        neakToothType: row.neakToothType || '',
        neakTimeLimitMonths: toIntOrNull(row.neakTimeLimitMonths),
        neakTimeLimitDays: toIntOrNull(row.neakTimeLimitDays),
        neakTimeLimitQty: toIntOrNull(row.neakTimeLimitQty),
        neakTimeLimitSchoolStart: row.neakTimeLimitSchoolStart || '',
        neakTimeLimitSchoolEnd: row.neakTimeLimitSchoolEnd || '',
        neakLevelA: toBool(row.neakLevelA),
        neakLevelS: toBool(row.neakLevelS),
        neakLevelT: toBool(row.neakLevelT),
        neakLevelE: toBool(row.neakLevelE),
        neakTerKatCodes: row.neakTerKatCodes || '',
        neakNotBillableWithCodes: row.neakNotBillableWithCodes || '',
        neakNotBillableIfRecentCodes: row.neakNotBillableIfRecentCodes || '',
        neakBillableWithCodes: row.neakBillableWithCodes || '',
        neakSpecialMark: parseInt(row.neakSpecialMark, 10) || 0,
        isActive: toBool(row.isActive),
        catalogUnit: row.catalogUnit || 'db',
        milkToothOnly: toBool(row.milkToothOnly),
        svgLayer: row.svgLayer || '',
        hasLayer: toBool(row.hasLayer),
        isDeleted: toBool(row.isDeleted || 'FALSE'),
      };
      await prisma.neakCatalogItem.upsert({ where: { neakCatalogItemId: row.neakCatalogItemId }, update: nData, create: { neakCatalogItemId: row.neakCatalogItemId, ...nData } });
    }

    // Seed Country
    const countries = readCsv('Country.csv');
    for (const row of countries) {
      const cData = {
        countryNameHu: row.CountryNameHu || '',
        countryNameEn: row.CountryNameEn || '',
        countryNameDe: row.CountryNameDe || '',
      };
      await prisma.country.upsert({ where: { countryId: parseInt(row.countryId, 10) }, update: cData, create: { countryId: parseInt(row.countryId, 10), ...cData } });
    }

    return {
      status: 'ok',
      seeded: {
        pricelists: priceLists.length,
        categories: categories.length,
        catalogItems: items.length,
        neakDocumentTypes: neakDocs.length,
        neakLevels: neakLevels.length,
        neakSpecials: neakSpecials.length,
        neakTerkats: neakTerkats.length,
        neakCatalogItems: neakItems.length,
        countries: countries.length,
      },
    };
  } catch (err) {
    return reply.code(500).send({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// -- Sequential ID generators for Quote / Invoice ----------------

async function nextQuoteId(patientId: string): Promise<string> {
  const last = await prisma.quote.findFirst({
    where: { patientId },
    orderBy: { quoteId: 'desc' },
    select: { quoteId: true },
  });
  const lastNum = last ? parseInt(last.quoteId.slice(-3), 10) : 0;
  const next = (Number.isNaN(lastNum) ? 0 : lastNum) + 1;
  if (next > 999) throw new Error('QUOTE_LIMIT_REACHED');
  return `${patientId}q${String(next).padStart(3, '0')}`;
}

async function nextInvoiceId(patientId: string): Promise<string> {
  const last = await prisma.invoice.findFirst({
    where: { patientId },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const lastNum = last ? parseInt(last.id.slice(-3), 10) : 0;
  const next = (Number.isNaN(lastNum) ? 0 : lastNum) + 1;
  if (next > 999) throw new Error('INVOICE_LIMIT_REACHED');
  return `${patientId}i${String(next).padStart(3, '0')}`;
}

async function nextDoctorId(): Promise<string> {
  const last = await prisma.doctor.findFirst({
    where: { doctorId: { startsWith: 'DOC' } },
    orderBy: { doctorId: 'desc' },
    select: { doctorId: true },
  });
  const lastNum = last ? parseInt(last.doctorId.slice(3), 10) : 0;
  const next = (Number.isNaN(lastNum) ? 0 : lastNum) + 1;
  return `DOC${String(next).padStart(4, '0')}`;
}

const BROWSABLE_TABLES = [
  'Patient',
  'Quote',
  'DentalStatusSnapshot',
  'PriceListCatalogItem',
  'PriceList',
  'PriceListCategory',
  'AppSettings',
  'Invoice',
  'NeakCheck',
  'OdontogramCurrent',
  'OdontogramDaily',
  'OdontogramTimeline',
  'User',
  'AuthSession',
  'UserPermissionOverride',
  'SmsLog',
  'SmsSettings',
  'EmailLog',
  'EmailSettings',
  'PermissionAuditLog',
  'UserActivityLog',
  'Doctor',
  'NeakDocumentType',
  'NeakLevel',
  'NeakSpecial',
  'NeakTerkat',
  'NeakCatalogItem',
  'VisitorLog',
  'InvoiceSettings',
  'Country',
  'AppointmentType',
  'AppointmentChair',
  'Appointment',
  'GoogleCalendarSync',
  'GoogleCalendarLog',
] as const;

const TABLE_PK_MAP: Record<string, string[]> = {
  Patient: ['patientId'],
  Quote: ['quoteId'],
  DentalStatusSnapshot: ['snapshotId'],
  PriceListCatalogItem: ['catalogItemId'],
  PriceList: ['priceListId'],
  PriceListCategory: ['catalogCategoryId'],
  AppSettings: ['id'],
  Invoice: ['id'],
  NeakCheck: ['id'],
  OdontogramCurrent: ['patientId'],
  OdontogramDaily: ['patientId', 'dateKey'],
  OdontogramTimeline: ['snapshotId'],
  User: ['id'],
  AuthSession: ['id'],
  UserPermissionOverride: ['id'],
  PermissionAuditLog: ['id'],
  UserActivityLog: ['id'],
  Doctor: ['doctorId'],
  NeakDocumentType: ['neakDocumentId'],
  NeakLevel: ['neakLevelCode'],
  NeakSpecial: ['neakSpecialMark'],
  NeakTerkat: ['neakTerKatCode'],
  NeakCatalogItem: ['neakCatalogItemId'],
  VisitorLog: ['id'],
  InvoiceSettings: ['id'],
  Country: ['countryId'],
  AppointmentType: ['typeId'],
  AppointmentChair: ['chairId'],
  Appointment: ['appointmentId'],
  SmsLog: ['id'],
  SmsSettings: ['id'],
  EmailLog: ['id'],
  EmailSettings: ['id'],
};

const serializeRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'bigint') {
      result[key] = Number(value);
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
};

const decodePkId = (encoded: string, pkColumns: string[]): string[] => {
  if (pkColumns.length === 1) return [encoded];
  return encoded.split('--');
};

const coercePkValues = async (table: string, pkColumns: string[], rawValues: string[]): Promise<unknown[]> => {
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    table
  );
  const typeMap = new Map(columns.map(c => [c.column_name, c.data_type]));
  return rawValues.map((val, i) => {
    const dataType = typeMap.get(pkColumns[i]) || 'text';
    if (dataType === 'integer' || dataType === 'bigint' || dataType === 'smallint') {
      return parseInt(val, 10);
    }
    if (dataType === 'double precision' || dataType === 'real' || dataType === 'numeric') {
      return parseFloat(val);
    }
    return val;
  });
};

const prepareValue = (value: unknown, dataType: string): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') {
    if (dataType.includes('int') || dataType.includes('float') || dataType.includes('numeric') || dataType.includes('double') || dataType.includes('decimal')) return null;
    if (dataType === 'boolean') return null;
    if (dataType === 'jsonb' || dataType === 'json') return null;
    return null;
  }
  if (dataType === 'jsonb' || dataType === 'json') {
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  }
  if (dataType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return Boolean(value);
  }
  if (dataType === 'integer' || dataType === 'bigint' || dataType === 'smallint') {
    return parseInt(String(value), 10);
  }
  if (dataType === 'double precision' || dataType === 'real' || dataType === 'numeric') {
    return parseFloat(String(value));
  }
  if (dataType.startsWith('ARRAY') || dataType === 'text[]' || dataType.endsWith('[]')) {
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  }
  return value;
};

server.get('/db/stats', async () => {
  const tableNames = BROWSABLE_TABLES;

  const dbMeta = await prisma.$queryRaw<Array<{ database_name: string; database_size: bigint | number }>>`
    SELECT current_database() AS database_name, pg_database_size(current_database()) AS database_size
  `;

  const tableStatsResults = await Promise.all(
    tableNames.map(async (tableName) => {
      try {
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
      } catch {
        // Table may not exist yet (e.g. pending migration)
        return null;
      }
    })
  );
  const tableStats = tableStatsResults.filter((s): s is NonNullable<typeof s> => s !== null);

  tableStats.sort((a, b) => a.tableName.localeCompare(b.tableName));

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

// ── Database Browser endpoints ──────────────────────────────────────────────

server.get('/db/browse/:table', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'data.browse');
  if (!currentUser) return;

  const { table } = request.params as { table: string };
  if (!BROWSABLE_TABLES.includes(table as (typeof BROWSABLE_TABLES)[number])) {
    return reply.code(400).send({ message: 'Invalid table name' });
  }

  const query = request.query as { page?: string; limit?: string; sortColumn?: string; sortDir?: string };
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '25', 10) || 25));
  const offset = (page - 1) * limit;

  const pkColumns = TABLE_PK_MAP[table] || ['id'];

  const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
    `SELECT COUNT(*)::bigint AS cnt FROM "${table}"`
  );
  const totalRows = Number(countResult[0]?.cnt || 0);

  // Validate sort column against actual table columns to prevent SQL injection
  const columnsForValidation = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    table
  );
  const validColumns = new Set(columnsForValidation.map(c => c.column_name));
  const sortColumn = query.sortColumn && validColumns.has(query.sortColumn) ? query.sortColumn : null;
  const sortDir = query.sortDir === 'desc' ? 'DESC' : 'ASC';
  const orderClause = sortColumn ? `"${sortColumn}" ${sortDir}` : '1';

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "${table}" ORDER BY ${orderClause} LIMIT $1 OFFSET $2`,
    limit,
    offset
  );

  const columns = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>
  >(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    table
  );

  return {
    table,
    pkColumns,
    totalRows,
    page,
    limit,
    totalPages: Math.ceil(totalRows / limit),
    columns: columns.map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES',
      default: c.column_default,
    })),
    rows: rows.map(serializeRow),
  };
});

server.get('/db/export/:table', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'data.browse');
  if (!currentUser) return;

  const { table } = request.params as { table: string };
  if (!BROWSABLE_TABLES.includes(table as (typeof BROWSABLE_TABLES)[number])) {
    return reply.code(400).send({ message: 'Invalid table name' });
  }

  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    table
  );
  const colNames = columns.map(c => c.column_name);

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "${table}" ORDER BY 1`
  );

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const headerLine = colNames.map(escapeCsv).join(',');
  const dataLines = rows.map(row =>
    colNames.map(col => escapeCsv(serializeRow(row)[col])).join(',')
  );
  const csv = [headerLine, ...dataLines].join('\r\n');

  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${table}.csv"`);
  return csv;
});

server.put('/db/browse/:table/:id', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'data.browse');
  if (!currentUser) return;

  const { table, id } = request.params as { table: string; id: string };
  if (!BROWSABLE_TABLES.includes(table as (typeof BROWSABLE_TABLES)[number])) {
    return reply.code(400).send({ message: 'Invalid table name' });
  }

  const pkColumns = TABLE_PK_MAP[table] || ['id'];
  const pkValues = decodePkId(id, pkColumns);
  if (pkValues.length !== pkColumns.length) {
    return reply.code(400).send({ message: 'Invalid primary key' });
  }

  const body = request.body as Record<string, unknown>;
  if (!body || typeof body !== 'object') {
    return reply.code(400).send({ message: 'Body must be a JSON object' });
  }

  // Get column info for validation and type coercion
  const columns = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string }>
  >(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    table
  );
  const columnMap = new Map(columns.map(c => [c.column_name, c.data_type]));

  // Filter out PK columns and non-existent columns
  const updateEntries = Object.entries(body).filter(
    ([col]) => !pkColumns.includes(col) && columnMap.has(col)
  );

  if (updateEntries.length === 0) {
    return reply.code(400).send({ message: 'No valid columns to update' });
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const [col, rawValue] of updateEntries) {
    const dataType = columnMap.get(col)!;
    setClauses.push(`"${col}" = $${paramIdx}`);
    try {
      params.push(prepareValue(rawValue, dataType));
    } catch {
      return reply.code(400).send({ message: `Invalid value for column "${col}"` });
    }
    paramIdx++;
  }

  const coercedPkValues = await coercePkValues(table, pkColumns, pkValues);
  const whereClauses: string[] = [];
  for (let i = 0; i < pkColumns.length; i++) {
    whereClauses.push(`"${pkColumns[i]}" = $${paramIdx}`);
    params.push(coercedPkValues[i]);
    paramIdx++;
  }

  const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
  await prisma.$executeRawUnsafe(sql, ...params);

  return { success: true };
});

// FK dependency map: parent table -> [{ child table, FK column in child that references parent PK }]
const FK_CASCADE_MAP: Record<string, { table: string; fkColumn: string }[]> = {
  PriceList: [
    { table: 'PriceListCatalogItem', fkColumn: 'priceListId' },
    { table: 'PriceListCategory', fkColumn: 'priceListId' },
  ],
  PriceListCategory: [
    { table: 'PriceListCatalogItem', fkColumn: 'catalogCategoryId' },
  ],
};

server.delete('/db/browse/:table/:id', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'data.browse');
  if (!currentUser) return;

  const { table, id } = request.params as { table: string; id: string };
  if (!BROWSABLE_TABLES.includes(table as (typeof BROWSABLE_TABLES)[number])) {
    return reply.code(400).send({ message: 'Invalid table name' });
  }

  const pkColumns = TABLE_PK_MAP[table] || ['id'];
  const pkValues = decodePkId(id, pkColumns);
  if (pkValues.length !== pkColumns.length) {
    return reply.code(400).send({ message: 'Invalid primary key' });
  }

  const coercedPkValues = await coercePkValues(table, pkColumns, pkValues);
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < pkColumns.length; i++) {
    whereClauses.push(`"${pkColumns[i]}" = $${i + 1}`);
    params.push(coercedPkValues[i]);
  }

  const cascadeDeps = FK_CASCADE_MAP[table];
  if (cascadeDeps && pkColumns.length === 1) {
    // Use a transaction to delete child rows first, then the parent
    const pkValue = coercedPkValues[0];
    await prisma.$transaction(async (tx) => {
      for (const dep of cascadeDeps) {
        await tx.$executeRawUnsafe(
          `DELETE FROM "${dep.table}" WHERE "${dep.fkColumn}" = $1`,
          pkValue
        );
      }
      const sql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')}`;
      await tx.$executeRawUnsafe(sql, ...params);
    });
  } else {
    const sql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')}`;
    await prisma.$executeRawUnsafe(sql, ...params);
  }

  return { success: true };
});

server.post('/auth/login', async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return reply.code(400).send({ message: 'E-mail és jelszó kötelező.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return reply.code(401).send({ message: 'Hibás belépési adatok.' });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return reply.code(401).send({ message: 'Hibás belépési adatok.' });
  }

  const token = createToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await createWithUniqueId(createSessionId, (id) =>
    prisma.authSession.create({
      data: {
        id,
        userId: user.id,
        tokenHash,
        createdAt: now,
        expiresAt,
        lastSeenAt: now,
        userAgent: request.headers['user-agent'] ? String(request.headers['user-agent']) : null,
        ipAddress: request.ip || null,
      },
    }),
  );

  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: user.id } });
  const permissions = buildPermissionMap(user.role, overrides);

  await logActivity(user.id, 'login', { page: 'login', ipAddress: request.ip || undefined });

  return {
    token,
    expiresAt: session.expiresAt.toISOString(),
    user: toSafeUser(user),
    permissions: toClientPermissions(permissions),
  };
});

server.post('/auth/logout', async (request, reply) => {
  const currentUser = await requireAuth(request, reply);
  if (!currentUser) return;

  if (request.sessionId) {
    await prisma.authSession.update({
      where: { id: request.sessionId },
      data: { revokedAt: new Date() },
    });
  }

  await logActivity(currentUser.id, 'logout', { page: 'logout', ipAddress: request.ip || undefined });

  return { status: 'ok' };
});

server.get('/auth/me', async (request, reply) => {
  const currentUser = await requireAuth(request, reply);
  if (!currentUser) return;

  const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
  if (!user) {
    return reply.code(401).send({ message: 'Authentication required' });
  }

  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: user.id } });
  const permissions = buildPermissionMap(user.role, overrides);
  return {
    user: toSafeUser(user),
    permissions: toClientPermissions(permissions),
  };
});

server.get('/admin/users', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.users.manage');
  if (!currentUser) return;

  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
  const userIds = users.map((user) => user.id);
  const allOverrides = await prisma.userPermissionOverride.findMany({
    where: { userId: { in: userIds } },
  });
  const grouped = allOverrides.reduce((acc, override) => {
    acc[override.userId] ||= [];
    acc[override.userId].push(override);
    return acc;
  }, {} as Record<string, Array<{ key: string; isAllowed: boolean }>>);

  return users.map((user) => {
    const permissions = buildPermissionMap(user.role, grouped[user.id] || []);
    return {
      ...toSafeUser(user),
      permissions: toClientPermissions(permissions),
    };
  });
});

server.post('/admin/users', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.users.manage');
  if (!currentUser) return;

  const body = request.body as {
    email?: string;
    fullName?: string;
    password?: string;
    role?: UserRole;
    isActive?: boolean;
  };
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const password = String(body.password || '');
  const role = (body.role && VALID_ROLES.includes(body.role)) ? body.role : 'user';

  if (!email || !fullName || !password) {
    return reply.code(400).send({ message: 'E-mail, név és jelszó kötelező.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.isActive) {
      return reply.code(409).send({ message: 'Ez az e-mail már foglalt.' });
    }
    // Reactivate inactive user with new data
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName,
        passwordHash: await hashPassword(password),
        role,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    const permissions = getDefaultPermissions(updated.role);
    return reply.code(201).send({
      ...toSafeUser(updated),
      permissions: toClientPermissions(permissions),
    });
  }

  const user = await createWithUniqueId(createShortId, async (id) =>
    prisma.user.create({
      data: {
        id,
        email,
        fullName,
        passwordHash: await hashPassword(password),
        role,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      },
    }),
  );

  const permissions = getDefaultPermissions(user.role);
  return reply.code(201).send({
    ...toSafeUser(user),
    permissions: toClientPermissions(permissions),
  });
});

server.patch('/admin/users/:userId', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.users.manage');
  if (!currentUser) return;

  const { userId } = request.params as { userId: string };
  const body = request.body as {
    email?: string;
    fullName?: string;
    password?: string;
    role?: UserRole;
    isActive?: boolean;
  };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return reply.code(404).send({ message: 'Felhasználó nem található.' });
  }

  if (body.role && !VALID_ROLES.includes(body.role)) {
    return reply.code(400).send({ message: 'Érvénytelen szerepkör.' });
  }
  if (body.role && body.role !== target.role && target.id === currentUser.id) {
    return reply.code(400).send({ message: 'Saját admin szerepkör nem vonható vissza.' });
  }
  if (body.isActive === false && target.id === currentUser.id) {
    return reply.code(400).send({ message: 'Saját fiók nem tiltható le.' });
  }
  if (body.isActive === false && target.role === 'admin' && currentUser.role === 'beta_tester') {
    return reply.code(403).send({ message: 'Béta tesztelő nem deaktiválhat admin felhasználót.' });
  }

  const email = body.email === undefined ? undefined : String(body.email).trim().toLowerCase();
  if (email) {
    const duplicate = await prisma.user.findUnique({ where: { email } });
    if (duplicate && duplicate.id !== userId) {
      return reply.code(409).send({ message: 'Ez az e-mail már foglalt.' });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      email: email === undefined ? undefined : email,
      fullName: body.fullName === undefined ? undefined : String(body.fullName).trim(),
      role: body.role === undefined ? undefined : body.role,
      isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
      passwordHash: body.password ? await hashPassword(String(body.password)) : undefined,
    },
  });

  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: user.id } });
  const permissions = buildPermissionMap(user.role, overrides);
  return {
    ...toSafeUser(user),
    permissions: toClientPermissions(permissions),
  };
});

server.get('/admin/permissions/:userId', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.permissions.manage');
  if (!currentUser) return;

  const { userId } = request.params as { userId: string };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return reply.code(404).send({ message: 'Felhasználó nem található.' });
  }
  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId } });
  const permissions = buildPermissionMap(user.role, overrides);
  return {
    user: toSafeUser(user),
    permissions: toClientPermissions(permissions),
  };
});

server.put('/admin/permissions/:userId', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.permissions.manage');
  if (!currentUser) return;

  const { userId } = request.params as { userId: string };
  const body = request.body as { permissions?: Array<{ key?: string; isAllowed?: boolean }> };
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return reply.code(404).send({ message: 'Felhasználó nem található.' });
  }
  if (currentUser.id === userId && user.role === 'admin') {
    return reply.code(400).send({ message: 'Saját admin jogosultságok nem módosíthatók.' });
  }

  const normalized = permissions
    .map((entry) => ({
      key: String(entry.key || ''),
      isAllowed: Boolean(entry.isAllowed),
    }))
    .filter((entry) => ALL_PERMISSION_KEYS.includes(entry.key as PermissionKey));

  // Build old permission map for audit diff
  const oldOverrides = await prisma.userPermissionOverride.findMany({ where: { userId } });
  const oldPermissionMap = buildPermissionMap(user.role, oldOverrides);

  // Build new permission map from incoming data
  const newPermissionMap = buildPermissionMap(user.role, normalized);

  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { userId } });
    for (const entry of normalized) {
      await createWithUniqueId(createPermOverrideId, (id) =>
        tx.userPermissionOverride.create({
          data: {
            id,
            userId,
            key: entry.key,
            isAllowed: entry.isAllowed,
          },
        }),
      );
    }

    // Audit log: record each permission that changed
    for (const key of ALL_PERMISSION_KEYS) {
      if (oldPermissionMap[key] !== newPermissionMap[key]) {
        await createWithUniqueId(createAuditId, (id) =>
          tx.permissionAuditLog.create({
            data: {
              id,
              targetUserId: userId,
              changedByUserId: currentUser.id,
              key,
              oldValue: oldPermissionMap[key],
              newValue: newPermissionMap[key],
            },
          }),
        );
      }
    }
  });

  const applied = await prisma.userPermissionOverride.findMany({ where: { userId } });
  const permissionMap = buildPermissionMap(user.role, applied);
  return {
    user: toSafeUser(user),
    permissions: toClientPermissions(permissionMap),
  };
});

server.get('/admin/audit-log/:userId', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.permissions.manage');
  if (!currentUser) return;

  const { userId } = request.params as { userId: string };
  const entries = await prisma.permissionAuditLog.findMany({
    where: { targetUserId: userId },
    include: { changedByUser: { select: { fullName: true } } },
    orderBy: { changedAt: 'desc' },
    take: 500,
  });

  return entries.map((e) => ({
    id: e.id,
    key: e.key,
    oldValue: e.oldValue,
    newValue: e.newValue,
    changedAt: e.changedAt.toISOString(),
    changedByName: e.changedByUser.fullName,
  }));
});

// ── Visitor Log ──────────────────────────────────────────────────────
server.post('/visitor-log', async (request) => {
  const uaString = (request.headers['user-agent'] as string) || '';
  const { browser: browserName, os: osName, device: deviceType } = parseUserAgent(uaString);

  const ip =
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    request.ip;

  const id = createVisitorLogId();
  await prisma.visitorLog.create({
    data: {
      id,
      userId: request.currentUser?.id ?? null,
      sessionId: request.sessionId ?? null,
      ipAddress: ip,
      userAgent: uaString || null,
      browser: browserName,
      os: osName,
      device: deviceType,
    },
  });

  return { status: 'ok', id };
});

server.patch('/visitor-log/:id', async (request) => {
  const { id } = request.params as { id: string };
  if (!request.currentUser) return { status: 'ok' };

  try {
    await prisma.visitorLog.update({
      where: { id },
      data: {
        userId: request.currentUser.id,
        sessionId: request.sessionId ?? null,
      },
    });
  } catch {
    // Entry may have been deleted or doesn't exist — ignore
  }
  return { status: 'ok' };
});

server.get('/visitor-log', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.users.manage');
  if (!currentUser) return;

  const { year, month, day, period, userId } = request.query as {
    year?: string;
    month?: string;
    day?: string;
    period?: string;
    userId?: string;
  };

  const where: Prisma.VisitorLogWhereInput = {};

  if (period === 'last30days') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    where.createdAt = { gte: d };
  } else if (period === 'last365days') {
    const d = new Date();
    d.setDate(d.getDate() - 365);
    where.createdAt = { gte: d };
  } else if (year) {
    const y = parseInt(year, 10);
    const m = month ? parseInt(month, 10) - 1 : 0;
    const d = day ? parseInt(day, 10) : 1;
    const start = new Date(y, month ? m : 0, day ? d : 1);
    const end = day
      ? new Date(y, m, d + 1)
      : month
      ? new Date(y, m + 1, 1)
      : new Date(y + 1, 0, 1);
    where.createdAt = { gte: start, lt: end };
  }

  if (userId) {
    where.userId = userId;
  }

  const entries = await prisma.visitorLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: { user: { select: { fullName: true } } },
  });

  return entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: e.user?.fullName ?? null,
    sessionId: e.sessionId,
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
    browser: e.browser,
    os: e.os,
    device: e.device,
    createdAt: e.createdAt.toISOString(),
  }));
});

server.get('/visitor-log/stats', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.users.manage');
  if (!currentUser) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Monday of this week
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTotal, weekTotal, monthTotal, todayUnique, weekUnique, monthUnique] =
    await Promise.all([
      prisma.visitorLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.visitorLog.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.visitorLog.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.visitorLog.groupBy({ by: ['userId'], where: { createdAt: { gte: todayStart }, userId: { not: null } } }).then((r) => r.length),
      prisma.visitorLog.groupBy({ by: ['userId'], where: { createdAt: { gte: weekStart }, userId: { not: null } } }).then((r) => r.length),
      prisma.visitorLog.groupBy({ by: ['userId'], where: { createdAt: { gte: monthStart }, userId: { not: null } } }).then((r) => r.length),
    ]);

  return {
    today: { total: todayTotal, unique: todayUnique },
    week: { total: weekTotal, unique: weekUnique },
    month: { total: monthTotal, unique: monthUnique },
  };
});

server.get('/admin/activity-log/:userId', async (request, reply) => {
  const currentUser = await requirePermission(request, reply, 'admin.users.manage');
  if (!currentUser) return;

  const { userId } = request.params as { userId: string };
  const entries = await prisma.userActivityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    page: e.page,
    entityType: e.entityType,
    entityId: e.entityId,
    details: e.details,
    createdAt: e.createdAt.toISOString(),
    ipAddress: e.ipAddress,
  }));
});

// Bootstrap endpoint for frontend startup
server.get('/bootstrap', async () => {
  const [patients, catalog, quotes, settingsRow, dentalStatusSnapshots, invoices, neakChecks, pricelists, pricelistCategories, doctors, neakCatalogItems] =
    await Promise.all([
      prisma.patient.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.priceListCatalogItem.findMany({ orderBy: { catalogCode: 'asc' } }),
      prisma.quote.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.dentalStatusSnapshot.findMany({ orderBy: { takenAt: 'desc' } }),
      prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.neakCheck.findMany({ orderBy: { checkedAt: 'desc' } }),
      prisma.priceList.findMany({ orderBy: { priceListId: 'asc' } }),
      prisma.priceListCategory.findMany({ orderBy: { catalogCategoryPrefix: 'asc' } }),
      prisma.doctor.findMany({ orderBy: { doctorId: 'asc' } }),
      prisma.neakCatalogItem.findMany({ orderBy: { neakCode: 'asc' } }),
    ]);

  return {
    patients,
    catalog: catalog.map((i) => mapCatalogItem(i as unknown as Record<string, unknown>)),
    quotes: quotes.map((q) => q.data),
    settings: parseJsonObject(settingsRow?.data, defaultSettings),
    dentalStatusSnapshots,
    invoices: invoices.map((inv) => inv.data),
    neakChecks: neakChecks.map((entry) => entry.data),
    pricelists,
    pricelistCategories,
    doctors,
    neakCatalog: neakCatalogItems.map((i) => mapNeakCatalogItem(i as unknown as Record<string, unknown>)),
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

server.get('/neak-document-types', async () => {
  return prisma.neakDocumentType.findMany();
});

server.post('/patients', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.create');
  if (!user) return;

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
      mothersName: body.mothersName ? String(body.mothersName) : null,
      neakDocumentType: body.neakDocumentType !== undefined ? Number(body.neakDocumentType) : 1,
      patientVATName: body.patientVATName ? String(body.patientVATName) : null,
      patientVATNumber: body.patientVATNumber ? String(body.patientVATNumber) : null,
      patientVATAddress: body.patientVATAddress ? String(body.patientVATAddress) : null,
      patientDiscount: body.patientDiscount != null ? Number(body.patientDiscount) : null,
      isHungarianPhone: body.isHungarianPhone !== undefined ? Boolean(body.isHungarianPhone) : true,
      treatmentArchive: body.treatmentArchive ? String(body.treatmentArchive) : null,
      createdAt: body.createdAt ? toDate(String(body.createdAt)) : new Date(),
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      isArchived: Boolean(body.isArchived),
      createdByUserId: user.id,
    },
  });

  await logActivity(user.id, 'patient.create', {
    page: `patients/${patient.patientId}`,
    entityType: 'Patient',
    entityId: patient.patientId,
    details: { patientName: `${patient.lastName} ${patient.firstName}` },
    ipAddress: request.ip || undefined,
  });

  return reply.code(201).send(patient);
});

server.patch('/patients/:patientId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;

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
    mothersName: body.mothersName === undefined ? undefined : (body.mothersName ? String(body.mothersName) : null),
    neakDocumentType: body.neakDocumentType === undefined ? undefined : Number(body.neakDocumentType),
    patientVATName: body.patientVATName === undefined ? undefined : (body.patientVATName ? String(body.patientVATName) : null),
    patientVATNumber: body.patientVATNumber === undefined ? undefined : (body.patientVATNumber ? String(body.patientVATNumber) : null),
    patientVATAddress: body.patientVATAddress === undefined ? undefined : (body.patientVATAddress ? String(body.patientVATAddress) : null),
    patientDiscount: body.patientDiscount === undefined ? undefined : (body.patientDiscount != null ? Number(body.patientDiscount) : null),
    isHungarianPhone: body.isHungarianPhone === undefined ? undefined : Boolean(body.isHungarianPhone),
    treatmentArchive: body.treatmentArchive === undefined ? undefined : (body.treatmentArchive ? String(body.treatmentArchive) : null),
    isArchived: body.isArchived === undefined ? undefined : Boolean(body.isArchived),
    updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
  };

  if (body.birthDate !== undefined) {
    data.birthDate = toDate(String(body.birthDate));
  }

  try {
    const updated = await prisma.patient.update({ where: { patientId }, data });

    await logActivity(user.id, 'patient.update', {
      page: `patients/${patientId}`,
      entityType: 'Patient',
      entityId: patientId,
      details: { patientName: `${updated.lastName} ${updated.firstName}` },
      ipAddress: request.ip || undefined,
    });

    return updated;
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

server.delete('/patients/:patientId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.delete');
  if (!user) return;

  const { patientId } = request.params as { patientId: string };
  try {
    const patient = await prisma.patient.update({
      where: { patientId },
      data: { isArchived: true, updatedAt: new Date() },
    });

    await logActivity(user.id, 'patient.delete', {
      page: `patients/${patientId}`,
      entityType: 'Patient',
      entityId: patientId,
      details: { patientName: `${patient.lastName} ${patient.firstName}` },
      ipAddress: request.ip || undefined,
    });

    return patient;
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

server.patch('/patients/:patientId/restore', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.delete');
  if (!user) return;

  const { patientId } = request.params as { patientId: string };
  try {
    const patient = await prisma.patient.update({
      where: { patientId },
      data: { isArchived: false, updatedAt: new Date() },
    });
    return patient;
  } catch {
    return reply.code(404).send({ message: 'Patient not found' });
  }
});

// Helper: map Prisma's catalogNameHu back to catalogName for frontend backward compat
function mapCatalogItem(item: Record<string, unknown>): Record<string, unknown> {
  return { ...item, catalogName: item.catalogNameHu ?? item.catalogName ?? '' };
}

// Helper: map NeakCatalogItem → CatalogItem-compatible object for frontend
function mapNeakCatalogItem(item: Record<string, unknown>): Record<string, unknown> {
  return {
    catalogItemId: item.neakCatalogItemId,
    catalogCode: item.neakCode,
    catalogName: item.neakNameHu ?? '',
    catalogNameHu: item.neakNameHu ?? '',
    catalogNameEn: item.neakNameEn ?? '',
    catalogNameDe: item.neakNameDe ?? '',
    catalogCategoryId: item.catalogCategoryId,
    catalogUnit: item.catalogUnit ?? 'db',
    svgLayer: item.svgLayer ?? '',
    hasLayer: Boolean(item.hasLayer),
    isActive: Boolean(item.isActive),
    isDeleted: Boolean(item.isDeleted),
    isArch: Boolean(item.isArch),
    isQuadrant: Boolean(item.isQuadrant),
    milkToothOnly: Boolean(item.milkToothOnly),
    neakPoints: item.neakPoints ?? 0,
    neakMinimumTimeMin: item.neakMinimumTimeMin ?? 0,
    isFullMouth: Boolean(item.isFullMouth),
    isTooth: Boolean(item.isTooth),
    isSurface: Boolean(item.isSurface),
    isNeakItem: true,
    catalogPrice: 0,
    catalogVatRate: 0,
    catalogTechnicalPrice: 0,
    catalogPriceCurrency: 'HUF',
    hasTechnicalPrice: false,
    priceListId: null,
  };
}

// Catalog
server.get('/catalog', async () => {
  const items = await prisma.priceListCatalogItem.findMany({ orderBy: { catalogCode: 'asc' } });
  return items.map((i) => mapCatalogItem(i as unknown as Record<string, unknown>));
});

server.post('/catalog', async (request, reply) => {
  const user = await requirePermission(request, reply, 'catalog.create');
  if (!user) return;

  const body = request.body as JsonRecord;
  const catalogNameHuValue = String(body.catalogNameHu || body.catalogName || '');
  const catalogCategoryIdValue = String(body.catalogCategoryId || '');
  const priceListIdValue = body.priceListId ? String(body.priceListId) : null;
  let catalogItemId = body.catalogItemId ? String(body.catalogItemId) : '';
  if (!catalogItemId || !catalogItemId.startsWith('cat')) {
    const last = await prisma.priceListCatalogItem.findMany({ where: { catalogItemId: { startsWith: 'cat' } }, orderBy: { catalogItemId: 'desc' }, take: 1 });
    const lastNum = last.length > 0 ? parseInt(last[0].catalogItemId.replace('cat', ''), 10) || 0 : 0;
    catalogItemId = `cat${String(lastNum + 1).padStart(5, '0')}`;
  }
  const item = await prisma.priceListCatalogItem.upsert({
    where: { catalogItemId },
    update: {
      catalogCode: String(body.catalogCode || ''),
      catalogNameHu: catalogNameHuValue,
      catalogNameEn: String(body.catalogNameEn || ''),
      catalogNameDe: String(body.catalogNameDe || ''),
      catalogUnit: String(body.catalogUnit || 'alkalom'),
      catalogPrice: Number(body.catalogPrice || 0),
      catalogPriceCurrency: String(body.catalogPriceCurrency || 'HUF'),
      catalogVatRate: Number(body.catalogVatRate || 0),
      catalogTechnicalPrice: Number(body.catalogTechnicalPrice || 0),
      catalogCategoryId: catalogCategoryIdValue,
      priceListId: priceListIdValue,
      svgLayer: String(body.svgLayer || ''),
      hasLayer: Boolean(body.hasLayer),
      hasTechnicalPrice: Boolean(body.hasTechnicalPrice),
      isFullMouth: Boolean(body.isFullMouth),
      isArch: Boolean(body.isArch),
      isQuadrant: Boolean(body.isQuadrant),
      maxTeethPerArch: body.maxTeethPerArch != null ? Number(body.maxTeethPerArch) : null,
      allowedTeeth: Array.isArray(body.allowedTeeth) ? (body.allowedTeeth as number[]).map(Number) : [],
      milkToothOnly: Boolean(body.milkToothOnly),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
    create: {
      catalogItemId,
      catalogCode: String(body.catalogCode || ''),
      catalogNameHu: catalogNameHuValue,
      catalogNameEn: String(body.catalogNameEn || ''),
      catalogNameDe: String(body.catalogNameDe || ''),
      catalogUnit: String(body.catalogUnit || 'alkalom'),
      catalogPrice: Number(body.catalogPrice || 0),
      catalogPriceCurrency: String(body.catalogPriceCurrency || 'HUF'),
      catalogVatRate: Number(body.catalogVatRate || 0),
      catalogTechnicalPrice: Number(body.catalogTechnicalPrice || 0),
      catalogCategoryId: catalogCategoryIdValue,
      priceListId: priceListIdValue,
      svgLayer: String(body.svgLayer || ''),
      hasLayer: Boolean(body.hasLayer),
      hasTechnicalPrice: Boolean(body.hasTechnicalPrice),
      isFullMouth: Boolean(body.isFullMouth),
      isArch: Boolean(body.isArch),
      isQuadrant: Boolean(body.isQuadrant),
      maxTeethPerArch: body.maxTeethPerArch != null ? Number(body.maxTeethPerArch) : null,
      allowedTeeth: Array.isArray(body.allowedTeeth) ? (body.allowedTeeth as number[]).map(Number) : [],
      milkToothOnly: Boolean(body.milkToothOnly),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  });
  return reply.code(201).send(mapCatalogItem(item as unknown as Record<string, unknown>));
});

server.patch('/catalog/:catalogItemId', async (request, reply) => {
  const currentUser = await requireAuth(request, reply);
  if (!currentUser) return;
  const canUpdate = hasPermission(currentUser, 'catalog.update');
  const canDeactivate = hasPermission(currentUser, 'catalog.deactivate');
  const canRestore = hasPermission(currentUser, 'catalog.restore');
  if (!canUpdate && !canDeactivate && !canRestore) {
    return reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
  }

  const { catalogItemId } = request.params as { catalogItemId: string };
  const body = request.body as JsonRecord;

  // If user has no catalog.update, restrict to allowed fields only
  if (!canUpdate) {
    const data: Record<string, unknown> = {};
    if (canDeactivate && body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (canRestore && body.isDeleted !== undefined) {
      data.isDeleted = Boolean(body.isDeleted);
    }
    if (Object.keys(data).length === 0) {
      return reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
    }
    try {
      const updated = await prisma.priceListCatalogItem.update({
        where: { catalogItemId },
        data,
      });
      return mapCatalogItem(updated as unknown as Record<string, unknown>);
    } catch {
      return reply.code(404).send({ message: 'Catalog item not found' });
    }
  }

  const nameHuVal = body.catalogNameHu !== undefined ? String(body.catalogNameHu) : (body.catalogName !== undefined ? String(body.catalogName) : undefined);
  try {
    const updated = await prisma.priceListCatalogItem.update({
      where: { catalogItemId },
      data: {
        catalogCode: body.catalogCode === undefined ? undefined : String(body.catalogCode),
        catalogNameHu: nameHuVal,
        catalogNameEn: body.catalogNameEn === undefined ? undefined : String(body.catalogNameEn),
        catalogNameDe: body.catalogNameDe === undefined ? undefined : String(body.catalogNameDe),
        catalogUnit: body.catalogUnit === undefined ? undefined : String(body.catalogUnit),
        catalogPrice: body.catalogPrice === undefined ? undefined : Number(body.catalogPrice),
        catalogPriceCurrency:
          body.catalogPriceCurrency === undefined ? undefined : String(body.catalogPriceCurrency),
        catalogVatRate: body.catalogVatRate === undefined ? undefined : Number(body.catalogVatRate),
        catalogTechnicalPrice:
          body.catalogTechnicalPrice === undefined ? undefined : Number(body.catalogTechnicalPrice),
        catalogCategoryId: body.catalogCategoryId === undefined ? undefined : String(body.catalogCategoryId),
        priceListId: body.priceListId === undefined ? undefined : (body.priceListId ? String(body.priceListId) : null),
        svgLayer: body.svgLayer === undefined ? undefined : String(body.svgLayer),
        hasLayer: body.hasLayer === undefined ? undefined : Boolean(body.hasLayer),
        hasTechnicalPrice:
          body.hasTechnicalPrice === undefined ? undefined : Boolean(body.hasTechnicalPrice),
        isFullMouth: body.isFullMouth === undefined ? undefined : Boolean(body.isFullMouth),
        isArch: body.isArch === undefined ? undefined : Boolean(body.isArch),
        isQuadrant: body.isQuadrant === undefined ? undefined : Boolean(body.isQuadrant),
        maxTeethPerArch: body.maxTeethPerArch === undefined ? undefined : (body.maxTeethPerArch != null ? Number(body.maxTeethPerArch) : null),
        allowedTeeth: body.allowedTeeth === undefined ? undefined : (Array.isArray(body.allowedTeeth) ? (body.allowedTeeth as number[]).map(Number) : []),
        milkToothOnly: body.milkToothOnly === undefined ? undefined : Boolean(body.milkToothOnly),
        isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
        isDeleted: body.isDeleted === undefined ? undefined : Boolean(body.isDeleted),
      },
    });
    return mapCatalogItem(updated as unknown as Record<string, unknown>);
  } catch {
    return reply.code(404).send({ message: 'Catalog item not found' });
  }
});

server.delete('/catalog/:catalogItemId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'catalog.delete');
  if (!user) return;

  const { catalogItemId } = request.params as { catalogItemId: string };
  try {
    await prisma.priceListCatalogItem.update({ where: { catalogItemId }, data: { isDeleted: true } });
    return { status: 'ok' };
  } catch {
    return reply.code(404).send({ message: 'Catalog item not found' });
  }
});

server.put('/catalog/reset', async (request, reply) => {
  const user = await requirePermission(request, reply, 'catalog.update');
  if (!user) return;

  const body = request.body as { items?: JsonRecord[] };
  const items = Array.isArray(body.items) ? body.items : [];
  await prisma.$transaction([
    prisma.priceListCatalogItem.deleteMany({}),
    ...items.map((item) =>
      prisma.priceListCatalogItem.create({
        data: {
          catalogItemId: String(item.catalogItemId || randomUUID()),
          catalogCode: String(item.catalogCode || ''),
          catalogNameHu: String(item.catalogNameHu || item.catalogName || ''),
          catalogNameEn: String(item.catalogNameEn || ''),
          catalogNameDe: String(item.catalogNameDe || ''),
          catalogUnit: String(item.catalogUnit || 'alkalom'),
          catalogPrice: Number(item.catalogPrice || 0),
          catalogPriceCurrency: String(item.catalogPriceCurrency || 'HUF'),
          catalogVatRate: Number(item.catalogVatRate || 0),
          catalogTechnicalPrice: Number(item.catalogTechnicalPrice || 0),
          catalogCategoryId: String(item.catalogCategoryId || ''),
          priceListId: item.priceListId ? String(item.priceListId) : null,
          svgLayer: String(item.svgLayer || ''),
          hasLayer: Boolean(item.hasLayer),
          hasTechnicalPrice: Boolean(item.hasTechnicalPrice),
          isFullMouth: Boolean(item.isFullMouth),
          isArch: Boolean(item.isArch),
          isQuadrant: Boolean(item.isQuadrant),
          maxTeethPerArch: item.maxTeethPerArch != null ? Number(item.maxTeethPerArch) : null,
          allowedTeeth: Array.isArray(item.allowedTeeth) ? (item.allowedTeeth as number[]).map(Number) : [],
          milkToothOnly: Boolean(item.milkToothOnly),
          isActive: item.isActive === undefined ? true : Boolean(item.isActive),
        },
      })
    ),
  ]);
  return { status: 'ok' };
});

// NEAK Catalog
server.get('/neak-catalog', async () => {
  const items = await prisma.neakCatalogItem.findMany({ orderBy: { neakCode: 'asc' } });
  return items.map((i) => mapNeakCatalogItem(i as unknown as Record<string, unknown>));
});

server.patch('/neak-catalog/:neakCatalogItemId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'catalog.update');
  if (!user) return;

  const { neakCatalogItemId } = request.params as { neakCatalogItemId: string };
  const body = request.body as JsonRecord;

  try {
    const updated = await prisma.neakCatalogItem.update({
      where: { neakCatalogItemId },
      data: {
        svgLayer: body.svgLayer !== undefined ? String(body.svgLayer) : undefined,
        hasLayer: body.hasLayer !== undefined ? Boolean(body.hasLayer) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      },
    });
    return mapNeakCatalogItem(updated as unknown as Record<string, unknown>);
  } catch {
    return reply.code(404).send({ message: 'NEAK catalog item not found' });
  }
});

// Reset pricelists, categories, and catalog items to defaults (hard delete + re-seed)
server.put('/pricelists/reset', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.delete');
  if (!user) return;

  const body = request.body as {
    pricelists?: JsonRecord[];
    categories?: JsonRecord[];
    items?: JsonRecord[];
  };

  const pricelists = Array.isArray(body.pricelists) ? body.pricelists : [];
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const items = Array.isArray(body.items) ? body.items : [];

  // Hard delete everything, then re-create from defaults
  await prisma.$transaction([
    prisma.priceListCatalogItem.deleteMany({}),
    prisma.priceListCategory.deleteMany({}),
    prisma.priceList.deleteMany({}),
  ]);

  // Re-create pricelists
  for (const pl of pricelists) {
    await prisma.priceList.create({
      data: {
        priceListId: String(pl.priceListId),
        priceListNameHu: String(pl.priceListNameHu || ''),
        priceListNameEn: String(pl.priceListNameEn || ''),
        priceListNameDe: String(pl.priceListNameDe || ''),
        isActive: pl.isActive !== false,
        isDeleted: Boolean(pl.isDeleted),
        isDefault: Boolean(pl.isDefault),
        isNeak: Boolean(pl.isNeak),
        isUserLocked: Boolean(pl.isUserLocked),
        listOfUsers: Array.isArray(pl.listOfUsers) ? pl.listOfUsers : [],
      },
    });
  }

  // Re-create categories
  for (const cat of categories) {
    await prisma.priceListCategory.create({
      data: {
        catalogCategoryId: String(cat.catalogCategoryId),
        priceListId: String(cat.priceListId),
        catalogCategoryPrefix: String(cat.catalogCategoryPrefix || ''),
        catalogCategoryHu: String(cat.catalogCategoryHu || ''),
        catalogCategoryEn: String(cat.catalogCategoryEn || ''),
        catalogCategoryDe: String(cat.catalogCategoryDe || ''),
        isActive: cat.isActive !== false,
        isDeleted: Boolean(cat.isDeleted),
      },
    });
  }

  // Re-create catalog items
  for (const item of items) {
    await prisma.priceListCatalogItem.create({
      data: {
        catalogItemId: String(item.catalogItemId || randomUUID()),
        catalogCode: String(item.catalogCode || ''),
        catalogNameHu: String(item.catalogNameHu || item.catalogName || ''),
        catalogNameEn: String(item.catalogNameEn || ''),
        catalogNameDe: String(item.catalogNameDe || ''),
        catalogUnit: String(item.catalogUnit || 'alkalom'),
        catalogPrice: Number(item.catalogPrice || 0),
        catalogPriceCurrency: String(item.catalogPriceCurrency || 'HUF'),
        catalogVatRate: Number(item.catalogVatRate || 0),
        catalogTechnicalPrice: Number(item.catalogTechnicalPrice || 0),
        catalogCategoryId: String(item.catalogCategoryId || ''),
        priceListId: item.priceListId ? String(item.priceListId) : null,
        svgLayer: String(item.svgLayer || ''),
        hasLayer: Boolean(item.hasLayer),
        hasTechnicalPrice: Boolean(item.hasTechnicalPrice),
        isFullMouth: Boolean(item.isFullMouth),
        isArch: Boolean(item.isArch),
        isQuadrant: Boolean(item.isQuadrant),
        maxTeethPerArch: item.maxTeethPerArch != null ? Number(item.maxTeethPerArch) : null,
        allowedTeeth: Array.isArray(item.allowedTeeth) ? (item.allowedTeeth as number[]).map(Number) : [],
        milkToothOnly: Boolean(item.milkToothOnly),
        isActive: item.isActive === undefined ? true : Boolean(item.isActive),
      },
    });
  }

  return { status: 'ok' };
});

// PriceLists
server.get('/pricelists', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.view');
  if (!user) return;
  return prisma.priceList.findMany({ orderBy: { priceListId: 'asc' } });
});

server.post('/pricelists', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.create');
  if (!user) return;

  const body = request.body as JsonRecord;
  let priceListId = body.priceListId ? String(body.priceListId) : '';
  if (!priceListId || !priceListId.startsWith('plist')) {
    const last = await prisma.priceList.findMany({ where: { priceListId: { startsWith: 'plist' } }, orderBy: { priceListId: 'desc' }, take: 1 });
    const lastNum = last.length > 0 ? parseInt(last[0].priceListId.replace('plist', ''), 10) || 0 : 0;
    priceListId = `plist${String(lastNum + 1).padStart(3, '0')}`;
  }
  const item = await prisma.priceList.upsert({
    where: { priceListId },
    update: {
      priceListNameHu: String(body.priceListNameHu || ''),
      priceListNameEn: String(body.priceListNameEn || ''),
      priceListNameDe: String(body.priceListNameDe || ''),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      isDeleted: Boolean(body.isDeleted),
      isDefault: Boolean(body.isDefault),
      isNeak: body.isNeak === undefined ? false : Boolean(body.isNeak),
      isUserLocked: Boolean(body.isUserLocked),
      listOfUsers: toInputJson(body.listOfUsers || []),
    },
    create: {
      priceListId,
      priceListNameHu: String(body.priceListNameHu || ''),
      priceListNameEn: String(body.priceListNameEn || ''),
      priceListNameDe: String(body.priceListNameDe || ''),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      isDeleted: Boolean(body.isDeleted),
      isDefault: Boolean(body.isDefault),
      isNeak: body.isNeak === undefined ? false : Boolean(body.isNeak),
      isUserLocked: Boolean(body.isUserLocked),
      listOfUsers: toInputJson(body.listOfUsers || []),
    },
  });
  return reply.code(201).send(item);
});

server.patch('/pricelists/:id', async (request, reply) => {
  const currentUser = await requireAuth(request, reply);
  if (!currentUser) return;
  const canUpdate = hasPermission(currentUser, 'pricelist.update');
  const canRestore = hasPermission(currentUser, 'pricelist.restore');
  if (!canUpdate && !canRestore) {
    return reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
  }

  const { id } = request.params as { id: string };
  const body = request.body as JsonRecord;

  // If user has no pricelist.update, restrict to allowed fields only
  if (!canUpdate) {
    const data: Record<string, unknown> = {};
    if (canRestore && body.isDeleted !== undefined) {
      data.isDeleted = Boolean(body.isDeleted);
    }
    if (Object.keys(data).length === 0) {
      return reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
    }
    try {
      return await prisma.priceList.update({
        where: { priceListId: id },
        data,
      });
    } catch {
      return reply.code(404).send({ message: 'Price list not found' });
    }
  }

  try {
    return await prisma.priceList.update({
      where: { priceListId: id },
      data: {
        priceListNameHu: body.priceListNameHu === undefined ? undefined : String(body.priceListNameHu),
        priceListNameEn: body.priceListNameEn === undefined ? undefined : String(body.priceListNameEn),
        priceListNameDe: body.priceListNameDe === undefined ? undefined : String(body.priceListNameDe),
        isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
        isDeleted: body.isDeleted === undefined ? undefined : Boolean(body.isDeleted),
        isDefault: body.isDefault === undefined ? undefined : Boolean(body.isDefault),
        isNeak: body.isNeak === undefined ? undefined : Boolean(body.isNeak),
        isUserLocked: body.isUserLocked === undefined ? undefined : Boolean(body.isUserLocked),
        listOfUsers: body.listOfUsers === undefined ? undefined : toInputJson(body.listOfUsers),
      },
    });
  } catch {
    return reply.code(404).send({ message: 'Price list not found' });
  }
});

server.delete('/pricelists/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.delete');
  if (!user) return;

  const { id } = request.params as { id: string };
  try {
    return await prisma.priceList.update({
      where: { priceListId: id },
      data: { isDeleted: true },
    });
  } catch {
    return reply.code(404).send({ message: 'Price list not found' });
  }
});

server.get('/pricelists/:id/categories', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.view');
  if (!user) return;

  const { id } = request.params as { id: string };
  return prisma.priceListCategory.findMany({
    where: { priceListId: id },
    orderBy: { catalogCategoryPrefix: 'asc' },
  });
});

server.get('/pricelists/:id/items', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.view');
  if (!user) return;

  const { id } = request.params as { id: string };
  const items = await prisma.priceListCatalogItem.findMany({
    where: { priceListId: id },
    orderBy: { catalogCode: 'asc' },
  });
  return items.map((i) => mapCatalogItem(i as unknown as Record<string, unknown>));
});

// PriceList Categories
server.post('/pricelist-categories', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.category.create');
  if (!user) return;

  const body = request.body as JsonRecord;
  let catalogCategoryId = body.catalogCategoryId ? String(body.catalogCategoryId) : '';
  if (!catalogCategoryId || !catalogCategoryId.startsWith('pcat')) {
    const last = await prisma.priceListCategory.findMany({ where: { catalogCategoryId: { startsWith: 'pcat' } }, orderBy: { catalogCategoryId: 'desc' }, take: 1 });
    const lastNum = last.length > 0 ? parseInt(last[0].catalogCategoryId.replace('pcat', ''), 10) || 0 : 0;
    catalogCategoryId = `pcat${String(lastNum + 1).padStart(4, '0')}`;
  }
  const item = await prisma.priceListCategory.upsert({
    where: { catalogCategoryId },
    update: {
      priceListId: String(body.priceListId || ''),
      catalogCategoryPrefix: String(body.catalogCategoryPrefix || ''),
      catalogCategoryHu: String(body.catalogCategoryHu || ''),
      catalogCategoryEn: String(body.catalogCategoryEn || ''),
      catalogCategoryDe: String(body.catalogCategoryDe || ''),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      isDeleted: Boolean(body.isDeleted),
    },
    create: {
      catalogCategoryId,
      priceListId: String(body.priceListId || ''),
      catalogCategoryPrefix: String(body.catalogCategoryPrefix || ''),
      catalogCategoryHu: String(body.catalogCategoryHu || ''),
      catalogCategoryEn: String(body.catalogCategoryEn || ''),
      catalogCategoryDe: String(body.catalogCategoryDe || ''),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      isDeleted: Boolean(body.isDeleted),
    },
  });
  return reply.code(201).send(item);
});

server.patch('/pricelist-categories/:id', async (request, reply) => {
  const currentUser = await requireAuth(request, reply);
  if (!currentUser) return;
  const canUpdate = hasPermission(currentUser, 'pricelist.category.update');
  const canRestore = hasPermission(currentUser, 'pricelist.category.restore');
  if (!canUpdate && !canRestore) {
    return reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
  }

  const { id } = request.params as { id: string };
  const body = request.body as JsonRecord;

  // If user has no category.update, restrict to allowed fields only
  if (!canUpdate) {
    const data: Record<string, unknown> = {};
    if (canRestore && body.isDeleted !== undefined) {
      data.isDeleted = Boolean(body.isDeleted);
    }
    if (Object.keys(data).length === 0) {
      return reply.code(403).send({ message: 'Nincs jogosultság ehhez a művelethez.' });
    }
    try {
      return await prisma.priceListCategory.update({
        where: { catalogCategoryId: id },
        data,
      });
    } catch {
      return reply.code(404).send({ message: 'Category not found' });
    }
  }

  try {
    return await prisma.priceListCategory.update({
      where: { catalogCategoryId: id },
      data: {
        priceListId: body.priceListId === undefined ? undefined : String(body.priceListId),
        catalogCategoryPrefix: body.catalogCategoryPrefix === undefined ? undefined : String(body.catalogCategoryPrefix),
        catalogCategoryHu: body.catalogCategoryHu === undefined ? undefined : String(body.catalogCategoryHu),
        catalogCategoryEn: body.catalogCategoryEn === undefined ? undefined : String(body.catalogCategoryEn),
        catalogCategoryDe: body.catalogCategoryDe === undefined ? undefined : String(body.catalogCategoryDe),
        isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
        isDeleted: body.isDeleted === undefined ? undefined : Boolean(body.isDeleted),
      },
    });
  } catch {
    return reply.code(404).send({ message: 'Category not found' });
  }
});

server.delete('/pricelist-categories/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.category.delete');
  if (!user) return;

  const { id } = request.params as { id: string };
  try {
    return await prisma.priceListCategory.update({
      where: { catalogCategoryId: id },
      data: { isDeleted: true },
    });
  } catch {
    return reply.code(404).send({ message: 'Category not found' });
  }
});

// Quotes
server.get('/quotes', async () => {
  const quotes = await prisma.quote.findMany({ orderBy: { createdAt: 'desc' } });
  return quotes.map((q) => q.data);
});

server.get('/quotes/:quoteId', async (request, reply) => {
  const { quoteId } = request.params as { quoteId: string };
  const row = await prisma.quote.findUnique({ where: { quoteId } });
  if (!row) return reply.code(404).send({ message: 'Quote not found' });
  return row.data;
});

server.post('/quotes', async (request, reply) => {
  const user = await requirePermission(request, reply, 'quotes.create');
  if (!user) return;

  const body = request.body as JsonRecord;
  const patientId = String(body.patientId || '');

  // Accept client-provided quoteId (pre-fetched via next-id) or generate one
  let quoteId: string;
  if (body.quoteId && typeof body.quoteId === 'string') {
    quoteId = body.quoteId;
  } else {
    try {
      quoteId = await nextQuoteId(patientId);
    } catch (err) {
      if (err instanceof Error && err.message === 'QUOTE_LIMIT_REACHED') {
        return reply.code(400).send({ message: 'QUOTE_LIMIT_REACHED' });
      }
      throw err;
    }
  }

  const createdAt = body.createdAt ? toDate(String(body.createdAt)) : new Date();
  const lastStatusChangeAt = body.lastStatusChangeAt
    ? toDate(String(body.lastStatusChangeAt))
    : createdAt;

  const row = await prisma.quote.upsert({
    where: { quoteId },
    update: {
      patientId,
      quoteStatus: String(body.quoteStatus || 'draft'),
      lastStatusChangeAt,
      isDeleted: Boolean(body.isDeleted),
      data: toInputJson({ ...body, quoteId }),
      quoteName: body.quoteName ? String(body.quoteName) : null,
      quoteNumber: body.quoteNumber ? String(body.quoteNumber) : null,
      validUntil: body.validUntil ? String(body.validUntil) : null,
      currency: body.currency ? String(body.currency) : null,
      doctorId: body.doctorId ? String(body.doctorId) : null,
    },
    create: {
      quoteId,
      patientId,
      quoteStatus: String(body.quoteStatus || 'draft'),
      createdAt,
      lastStatusChangeAt,
      isDeleted: Boolean(body.isDeleted),
      data: toInputJson({ ...body, quoteId }),
      createdByUserId: user.id,
      quoteName: body.quoteName ? String(body.quoteName) : null,
      quoteNumber: body.quoteNumber ? String(body.quoteNumber) : null,
      validUntil: body.validUntil ? String(body.validUntil) : null,
      currency: body.currency ? String(body.currency) : null,
      doctorId: body.doctorId ? String(body.doctorId) : null,
    },
  });

  await logActivity(user.id, 'quote.create', {
    page: `patients/${patientId}/quotes/${quoteId}`,
    entityType: 'Quote',
    entityId: quoteId,
    details: { patientId, quoteStatus: String(body.quoteStatus || 'draft') },
    ipAddress: request.ip || undefined,
  });

  return reply.code(201).send(row.data);
});

server.patch('/quotes/:quoteId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'quotes.create');
  if (!user) return;
  const { quoteId } = request.params as { quoteId: string };
  const body = request.body as JsonRecord;
  try {
    const oldRow = await prisma.quote.findUnique({ where: { quoteId }, select: { quoteStatus: true } });
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
        quoteName: body.quoteName === undefined ? undefined : (body.quoteName ? String(body.quoteName) : null),
        quoteNumber: body.quoteNumber === undefined ? undefined : (body.quoteNumber ? String(body.quoteNumber) : null),
        validUntil: body.validUntil === undefined ? undefined : (body.validUntil ? String(body.validUntil) : null),
        currency: body.currency === undefined ? undefined : (body.currency ? String(body.currency) : null),
        doctorId: body.doctorId === undefined ? undefined : (body.doctorId ? String(body.doctorId) : null),
      },
    });

    const details: Record<string, unknown> = { patientId: row.patientId };
    if (body.quoteStatus !== undefined && oldRow && String(body.quoteStatus) !== oldRow.quoteStatus) {
      details.statusChange = `${oldRow.quoteStatus} → ${body.quoteStatus}`;
      details.oldStatus = oldRow.quoteStatus;
      details.newStatus = String(body.quoteStatus);
    }
    await logActivity(user.id, 'quote.update', {
      page: `patients/${row.patientId}/quotes/${quoteId}`,
      entityType: 'Quote',
      entityId: quoteId,
      details,
      ipAddress: request.ip || undefined,
    });

    return row.data;
  } catch {
    return reply.code(404).send({ message: 'Quote not found' });
  }
});

server.delete('/quotes/:quoteId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'quotes.delete');
  if (!user) return;

  const { quoteId } = request.params as { quoteId: string };
  try {
    const row = await prisma.quote.update({
      where: { quoteId },
      data: { isDeleted: true },
    });

    await logActivity(user.id, 'quote.delete', {
      page: `patients/${row.patientId}/quotes/${quoteId}`,
      entityType: 'Quote',
      entityId: quoteId,
      details: { patientId: row.patientId },
      ipAddress: request.ip || undefined,
    });

    return row.data;
  } catch {
    return reply.code(404).send({ message: 'Quote not found' });
  }
});

server.patch('/quotes/:quoteId/restore', async (request, reply) => {
  const user = await requirePermission(request, reply, 'quotes.delete');
  if (!user) return;

  const { quoteId } = request.params as { quoteId: string };
  try {
    const row = await prisma.quote.update({
      where: { quoteId },
      data: { isDeleted: false },
    });
    return row.data;
  } catch {
    return reply.code(404).send({ message: 'Quote not found' });
  }
});

// Settings
server.get('/settings', async () => {
  const [settingsRow, doctors, invoiceRow] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 'default' } }),
    prisma.doctor.findMany({ orderBy: { doctorId: 'asc' } }),
    prisma.invoiceSettings.findUnique({ where: { id: 'default' } }),
  ]);
  const result = parseJsonObject(settingsRow?.data, defaultSettings);
  // Migrate old flat pdf format { footerText, warrantyText } to per-language { hu: {...}, en: {...}, de: {...} }
  const pdf = result.pdf as Record<string, unknown> | undefined;
  if (pdf && (typeof pdf.footerText === 'string' || typeof pdf.warrantyText === 'string')) {
    const defPdf = defaultSettings.pdf as Record<string, unknown>;
    result.pdf = {
      hu: { footerText: pdf.footerText || '', warrantyText: pdf.warrantyText || '' },
      en: Object.assign({}, defPdf.en),
      de: Object.assign({}, defPdf.de),
    };
  }
  // Ensure quote.quoteLang exists
  const quote = result.quote as Record<string, unknown> | undefined;
  if (quote && !quote.quoteLang) {
    quote.quoteLang = 'hu';
  }
  // Override doctors from Doctor table
  if (doctors.length > 0) {
    result.doctors = doctors.map((d) => ({ id: d.doctorId, name: d.doctorName, stampNumber: d.doctorNum }));
  }
  // Override invoice from InvoiceSettings table
  if (invoiceRow) {
    result.invoice = {
      invoiceType: invoiceRow.invoiceType,
      defaultComment: invoiceRow.defaultComment,
      defaultVatRate: invoiceRow.defaultVatRate,
      defaultPaymentMethod: invoiceRow.defaultPaymentMethod,
      invoiceMode: invoiceRow.invoiceMode,
      agentKeyLive: invoiceRow.agentKeyLive,
      agentKeyTest: invoiceRow.agentKeyTest,
    };
  } else if (!result.invoice) {
    result.invoice = defaultSettings.invoice;
  }
  return result;
});

server.put('/settings', async (request) => {
  const body = request.body as JsonRecord;
  // Strip invoice settings and doctors — they live in dedicated tables
  const { invoice: _invoice, doctors: _doctors, ...cleanBody } = body;
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: { data: toInputJson(cleanBody) },
    create: { id: 'default', data: toInputJson(cleanBody) },
  });
  return { status: 'ok' };
});

// Invoice Settings
server.get('/invoice-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  const row = await prisma.invoiceSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    return {
      invoiceType: 'paper',
      defaultComment: '',
      defaultVatRate: 'TAM',
      defaultPaymentMethod: 'bankkártya',
      invoiceMode: 'test',
      agentKeyLive: '',
      agentKeyTest: '',
    };
  }
  return row;
});

server.put('/invoice-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const body = request.body as JsonRecord;
  const data = {
    invoiceType: String(body.invoiceType || 'paper'),
    defaultComment: String(body.defaultComment || ''),
    defaultVatRate: String(body.defaultVatRate || 'TAM'),
    defaultPaymentMethod: String(body.defaultPaymentMethod || 'bankkártya'),
    invoiceMode: String(body.invoiceMode || 'test'),
    agentKeyLive: String(body.agentKeyLive || ''),
    agentKeyTest: String(body.agentKeyTest || ''),
  };
  await prisma.invoiceSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  return { status: 'ok' };
});

// ── SMS Helpers ──────────────────────────────────────────────

const HUNGARIAN_MOBILE_PREFIXES = ['20', '30', '31', '50', '70'];
const HUNGARIAN_LANDLINE_PREFIXES = ['1'];

function normalizePhoneNumber(phone: string, isHungarian = true): string {
  const hasPlus = phone.trim().startsWith('+');
  const digits = phone.replace(/\D/g, '');
  if (hasPlus && digits.startsWith('36') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('36') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('06') && digits.length >= 10) return `+36${digits.slice(2)}`;
  if (isHungarian && !digits.startsWith('06') && !digits.startsWith('36')) {
    const prefix2 = digits.slice(0, 2);
    const prefix1 = digits.slice(0, 1);
    if (HUNGARIAN_MOBILE_PREFIXES.includes(prefix2) || HUNGARIAN_LANDLINE_PREFIXES.includes(prefix1)) {
      return `+36${digits}`;
    }
  }
  if (hasPlus) return `+${digits}`;
  throw new Error(`Cannot normalize phone number: ${phone}`);
}

function isValidE164(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
}

interface SmsTemplateEntry {
  id: string;
  name: string;
  text: string;
  variables: string[];
}

const SMS_TEMPLATES: SmsTemplateEntry[] = [
  {
    id: 'appointment_reminder',
    name: 'Időpont-emlékeztető',
    text: 'Kedves {{patientName}}! Emlékeztetjük, hogy {{appointmentDate}} napon {{appointmentTime}} órára időpontja van rendelőnkben. Kérjük, jelezzen, ha nem tud jönni. Üdvözlettel, {{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'clinicName'],
  },
  {
    id: 'appointment_confirmation',
    name: 'Időpont-megerősítés',
    text: 'Kedves {{patientName}}! Időpontját rögzítettük: {{appointmentDate}}, {{appointmentTime}}. Helyszín: {{clinicName}}. Ha kérdése van, hívjon minket! Üdvözlettel, {{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'clinicName'],
  },
  {
    id: 'quote_ready',
    name: 'Árajánlat kész',
    text: 'Kedves {{patientName}}! Az Ön árajánlata elkészült. Kérjük, tekintse meg rendelőnkben vagy vegye fel velünk a kapcsolatot. Üdvözlettel, {{clinicName}}',
    variables: ['patientName', 'clinicName'],
  },
];

function renderSmsTemplate(template: SmsTemplateEntry, variables: Record<string, string>): string {
  let text = template.text;
  for (const [key, value] of Object.entries(variables)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  const unresolved = text.match(/\{\{(\w+)\}\}/g);
  if (unresolved) {
    throw new Error(`Missing template variables: ${unresolved.join(', ')}`);
  }
  return text;
}

let twilioClient: ReturnType<typeof Twilio> | null = null;
let twilioSettings: { accountSid: string; authToken: string; phoneNumber: string; webhookUrl: string } | null = null;

async function getTwilioClient() {
  const settings = await prisma.smsSettings.findUnique({ where: { id: 'default' } });
  if (!settings || !settings.isEnabled) throw new Error('SMS is not enabled');
  if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
    throw new Error('Twilio credentials not configured');
  }
  if (!twilioClient || twilioSettings?.accountSid !== settings.twilioAccountSid || twilioSettings?.authToken !== settings.twilioAuthToken) {
    twilioClient = Twilio(settings.twilioAccountSid, settings.twilioAuthToken);
    twilioSettings = {
      accountSid: settings.twilioAccountSid,
      authToken: settings.twilioAuthToken,
      phoneNumber: settings.twilioPhoneNumber,
      webhookUrl: settings.twilioWebhookUrl || '',
    };
  }
  return { client: twilioClient, settings: twilioSettings! };
}

async function sendSmsViaTwilio(params: {
  to: string; message: string; patientId?: string; patientName?: string; context?: string; templateId?: string;
}) {
  const { client, settings } = await getTwilioClient();
  const smsLog = await createWithUniqueId(createSmsLogId, (id) =>
    prisma.smsLog.create({
      data: {
        id,
        toNumber: params.to,
        fromNumber: settings.phoneNumber,
        message: params.message,
        templateId: params.templateId,
        status: 'pending',
        patientId: params.patientId || null,
        patientName: params.patientName || null,
        context: params.context || null,
      },
    }),
  );

  try {
    const twilioMessage = await client.messages.create({
      body: params.message,
      from: settings.phoneNumber,
      to: params.to,
      statusCallback: settings.webhookUrl || undefined,
    });
    const updated = await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: { twilioSid: twilioMessage.sid, status: twilioMessage.status },
    });

    // Poll Twilio for final status if no webhook configured
    if (!settings.webhookUrl && twilioMessage.sid) {
      setTimeout(async () => {
        try {
          for (const delay of [3000, 5000, 10000]) {
            await new Promise(r => setTimeout(r, delay));
            const msg = await client.messages(twilioMessage.sid).fetch();
            if (['delivered', 'sent', 'failed', 'undelivered'].includes(msg.status)) {
              await prisma.smsLog.update({
                where: { id: smsLog.id },
                data: {
                  status: msg.status,
                  errorCode: msg.errorCode?.toString() || null,
                  errorMessage: msg.errorMessage || null,
                },
              });
              break;
            }
          }
        } catch { /* ignore polling errors */ }
      }, 0);
    }

    return updated;
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    const updated = await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        status: 'failed',
        errorCode: err.code?.toString() || 'UNKNOWN',
        errorMessage: err.message || 'Unknown error',
      },
    });
    throw { smsLog: updated, error };
  }
}

// ── SMS Settings Routes ──────────────────────────────────────────────

server.get('/sms-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.settings');
  if (!user) return;
  const row = await prisma.smsSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    return {
      twilioAccountSid: '',
      twilioAuthToken: '',
      twilioPhoneNumber: '',
      twilioWebhookUrl: '',
      isEnabled: false,
      clinicName: '',
    };
  }
  return {
    twilioAccountSid: row.twilioAccountSid,
    twilioAuthToken: row.twilioAuthToken ? '••••' + row.twilioAuthToken.slice(-4) : '',
    twilioPhoneNumber: row.twilioPhoneNumber,
    twilioWebhookUrl: row.twilioWebhookUrl,
    isEnabled: row.isEnabled,
    clinicName: row.clinicName,
  };
});

server.put('/sms-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.settings');
  if (!user) return;
  const body = request.body as JsonRecord;

  // If authToken is masked, keep the existing one
  let authToken = String(body.twilioAuthToken || '');
  if (authToken.startsWith('••••')) {
    const existing = await prisma.smsSettings.findUnique({ where: { id: 'default' } });
    authToken = existing?.twilioAuthToken || '';
  }

  const data = {
    twilioAccountSid: String(body.twilioAccountSid || ''),
    twilioAuthToken: authToken,
    twilioPhoneNumber: String(body.twilioPhoneNumber || ''),
    twilioWebhookUrl: String(body.twilioWebhookUrl || ''),
    isEnabled: Boolean(body.isEnabled),
    clinicName: String(body.clinicName || ''),
  };
  await prisma.smsSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  // Invalidate cached Twilio client
  twilioClient = null;
  twilioSettings = null;
  return { status: 'ok' };
});

server.post('/sms-settings/test', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.settings');
  if (!user) return;
  const body = request.body as JsonRecord;
  const phone = String(body.phone || '');
  if (!phone) return reply.code(400).send({ error: 'Phone number required' });

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhoneNumber(phone, true);
  } catch {
    return reply.code(400).send({ error: `Invalid phone number: ${phone}` });
  }

  try {
    const smsLog = await sendSmsViaTwilio({
      to: normalizedPhone,
      message: 'DentalQuoteCreator: Teszt SMS sikeres!',
      context: 'test',
    });
    return { success: true, smsId: smsLog.id, status: smsLog.status };
  } catch (err: unknown) {
    const e = err as { smsLog?: { id: string }; error?: { message?: string } };
    return reply.code(500).send({ success: false, error: e.error?.message || 'SMS send failed' });
  }
});

// ── SMS Send Routes ──────────────────────────────────────────────

server.post('/sms/send', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.send');
  if (!user) return;
  const body = request.body as JsonRecord;
  const to = String(body.to || '');
  const message = String(body.message || '');
  if (!to || !message) return reply.code(400).send({ error: 'Missing required fields: to, message' });
  if (message.length > 1600) return reply.code(400).send({ error: 'Message too long (max 1600 characters)' });

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhoneNumber(to, body.isHungarian !== false);
  } catch {
    return reply.code(400).send({ error: `Invalid phone number: ${to}` });
  }
  if (!isValidE164(normalizedPhone)) {
    return reply.code(400).send({ error: `Invalid E.164 phone number: ${normalizedPhone}` });
  }

  try {
    const smsLog = await sendSmsViaTwilio({
      to: normalizedPhone,
      message,
      patientId: body.patientId ? String(body.patientId) : undefined,
      patientName: body.patientName ? String(body.patientName) : undefined,
      context: body.context ? String(body.context) : undefined,
    });
    return { success: true, smsId: smsLog.id, twilioSid: smsLog.twilioSid, status: smsLog.status };
  } catch (err: unknown) {
    const e = err as { smsLog?: { id: string }; error?: { message?: string } };
    return reply.code(500).send({ success: false, smsId: e.smsLog?.id, error: e.error?.message || 'SMS send failed' });
  }
});

server.post('/sms/send-template', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.send');
  if (!user) return;
  const body = request.body as JsonRecord;
  const to = String(body.to || '');
  const templateId = String(body.templateId || '');
  const variables = body.variables as Record<string, string> | undefined;

  if (!to || !templateId || !variables) {
    return reply.code(400).send({ error: 'Missing required fields: to, templateId, variables' });
  }

  const allTemplates = await getEffectiveTemplates();
  const template = allTemplates.find(t => t.id === templateId);
  if (!template) return reply.code(400).send({ error: `Unknown template: ${templateId}` });

  let message: string;
  try {
    message = renderSmsTemplate(template, variables);
  } catch (err: unknown) {
    return reply.code(400).send({ error: (err as Error).message });
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhoneNumber(to, body.isHungarian !== false);
  } catch {
    return reply.code(400).send({ error: `Invalid phone number: ${to}` });
  }
  if (!isValidE164(normalizedPhone)) {
    return reply.code(400).send({ error: `Invalid E.164 phone number: ${normalizedPhone}` });
  }

  try {
    const smsLog = await sendSmsViaTwilio({
      to: normalizedPhone,
      message,
      patientId: body.patientId ? String(body.patientId) : undefined,
      patientName: body.patientName ? String(body.patientName) : undefined,
      context: body.context ? String(body.context) : undefined,
      templateId,
    });
    return { success: true, smsId: smsLog.id, twilioSid: smsLog.twilioSid, status: smsLog.status, renderedMessage: message };
  } catch (err: unknown) {
    const e = err as { smsLog?: { id: string }; error?: { message?: string } };
    return reply.code(500).send({ success: false, smsId: e.smsLog?.id, error: e.error?.message || 'SMS send failed' });
  }
});

// ── SMS Templates Routes ──────────────────────────────────────────────

async function getEffectiveTemplates(): Promise<SmsTemplateEntry[]> {
  const row = await prisma.smsSettings.findUnique({ where: { id: 'default' }, select: { customTemplates: true } });
  let custom: SmsTemplateEntry[] = [];
  try { custom = JSON.parse(row?.customTemplates || '[]'); } catch { /* ignore */ }
  // Merge: custom overrides defaults by id, then append any custom-only
  const merged = SMS_TEMPLATES.map(def => {
    const override = custom.find(c => c.id === def.id);
    return override ? { ...def, name: override.name, text: override.text, variables: override.variables } : def;
  });
  for (const c of custom) {
    if (!SMS_TEMPLATES.find(d => d.id === c.id)) merged.push(c);
  }
  return merged;
}

server.get('/sms/templates', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.send');
  if (!user) return;
  return getEffectiveTemplates();
});

server.get('/sms/templates/editable', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.settings');
  if (!user) return;
  const effective = await getEffectiveTemplates();
  return { defaults: SMS_TEMPLATES, templates: effective };
});

server.put('/sms/templates', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.settings');
  if (!user) return;
  const body = request.body as { templates: SmsTemplateEntry[] };
  if (!Array.isArray(body.templates)) return reply.code(400).send({ error: 'templates must be an array' });
  // Validate each template
  for (const tmpl of body.templates) {
    if (!tmpl.id || !tmpl.name || !tmpl.text) return reply.code(400).send({ error: 'Each template must have id, name, and text' });
    // Extract variables from text
    const vars = [...tmpl.text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    tmpl.variables = [...new Set(vars)];
  }
  await prisma.smsSettings.update({
    where: { id: 'default' },
    data: { customTemplates: JSON.stringify(body.templates) },
  });
  return { success: true, templates: body.templates };
});

// ── SMS Enabled check (lightweight, for UI) ──────────────────────────

server.get('/sms/enabled', async (request, reply) => {
  const user = await requireAuth(request, reply);
  if (!user) return;
  const row = await prisma.smsSettings.findUnique({ where: { id: 'default' }, select: { isEnabled: true } });
  return { isEnabled: row?.isEnabled || false };
});

// ── SMS History Routes ──────────────────────────────────────────────

server.get('/sms/history', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.history');
  if (!user) return;
  const query = request.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = new Date(query.to);
    where.createdAt = createdAt;
  }

  const take = Math.min(parseInt(query.limit || '50', 10), 200);
  const skip = parseInt(query.offset || '0', 10);

  const [logs, total] = await Promise.all([
    prisma.smsLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.smsLog.count({ where }),
  ]);
  return { logs, total, limit: take, offset: skip };
});

server.get('/sms/history/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'sms.history');
  if (!user) return;
  const { id } = request.params as { id: string };
  const log = await prisma.smsLog.findUnique({ where: { id } });
  if (!log) return reply.code(404).send({ error: 'SMS log not found' });
  return log;
});

// ── SMS Webhook (Twilio delivery status) ──────────────────────────

server.post('/webhook/twilio', async (request, reply) => {
  const body = request.body as Record<string, string>;
  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = body;
  if (!MessageSid || !MessageStatus) {
    return reply.code(400).send({ error: 'Missing MessageSid or MessageStatus' });
  }

  // Validate Twilio signature if possible
  const settings = await prisma.smsSettings.findUnique({ where: { id: 'default' } });
  if (settings?.twilioWebhookUrl && settings?.twilioAuthToken) {
    const signature = request.headers['x-twilio-signature'] as string;
    if (signature) {
      const isValid = Twilio.validateRequest(settings.twilioAuthToken, signature, settings.twilioWebhookUrl, body);
      if (!isValid) return reply.code(403).send({ error: 'Invalid Twilio signature' });
    }
  }

  const existing = await prisma.smsLog.findFirst({ where: { twilioSid: MessageSid } });
  if (!existing) {
    server.log.warn({ MessageSid }, 'Webhook received for unknown SMS');
    return reply.code(200).send({ ok: true });
  }
  await prisma.smsLog.update({
    where: { id: existing.id },
    data: {
      status: MessageStatus,
      errorCode: ErrorCode || existing.errorCode,
      errorMessage: ErrorMessage || existing.errorMessage,
    },
  });
  return reply.code(200).send({ ok: true });
});

// ── Email Infrastructure ──────────────────────────────────────────────

interface EmailTemplateEntry {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

const EMAIL_TEMPLATES: EmailTemplateEntry[] = [
  {
    id: 'appointment_reminder',
    name: 'Időpont-emlékeztető',
    subject: 'Időpont-emlékeztető – {{clinicName}}',
    body: 'Kedves {{patientName}}!\n\nEmlékeztetjük, hogy {{appointmentDate}} napon {{appointmentTime}} órára időpontja van rendelőnkben.\n\nKérjük, jelezzen, ha nem tud jönni.\n\nÜdvözlettel,\n{{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'clinicName'],
  },
  {
    id: 'appointment_confirmation',
    name: 'Időpont-megerősítés',
    subject: 'Időpont megerősítése – {{clinicName}}',
    body: 'Kedves {{patientName}}!\n\nIdőpontját rögzítettük: {{appointmentDate}}, {{appointmentTime}}.\n\nHelyszín: {{clinicName}}\n\nHa kérdése van, hívjon minket!\n\nÜdvözlettel,\n{{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'clinicName'],
  },
  {
    id: 'quote_ready',
    name: 'Árajánlat kész',
    subject: 'Árajánlata elkészült – {{clinicName}}',
    body: 'Kedves {{patientName}}!\n\nAz Ön árajánlata elkészült. Kérjük, tekintse meg rendelőnkben vagy vegye fel velünk a kapcsolatot.\n\nÜdvözlettel,\n{{clinicName}}',
    variables: ['patientName', 'clinicName'],
  },
];

function renderEmailTemplate(template: EmailTemplateEntry, variables: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replaceAll(`{{${key}}}`, value);
    body = body.replaceAll(`{{${key}}}`, value);
  }
  const unresolvedSubject = subject.match(/\{\{(\w+)\}\}/g);
  const unresolvedBody = body.match(/\{\{(\w+)\}\}/g);
  const unresolved = [...(unresolvedSubject || []), ...(unresolvedBody || [])];
  if (unresolved.length > 0) {
    throw new Error(`Missing template variables: ${[...new Set(unresolved)].join(', ')}`);
  }
  return { subject, body };
}

let emailTransporter: nodemailer.Transporter | null = null;
let emailTransporterConfig: string | null = null;

async function getEmailTransporter() {
  const settings = await prisma.emailSettings.findUnique({ where: { id: 'default' } });
  if (!settings || !settings.isEnabled) throw new Error('Email is not enabled');
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    throw new Error('SMTP credentials not configured');
  }
  const configKey = `${settings.smtpHost}:${settings.smtpPort}:${settings.smtpUser}`;
  if (!emailTransporter || emailTransporterConfig !== configKey) {
    emailTransporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    });
    emailTransporterConfig = configKey;
  }
  return { transporter: emailTransporter, settings };
}

async function getEffectiveEmailTemplates(): Promise<EmailTemplateEntry[]> {
  const row = await prisma.emailSettings.findUnique({ where: { id: 'default' }, select: { customTemplates: true } });
  let custom: EmailTemplateEntry[] = [];
  try { custom = JSON.parse(row?.customTemplates || '[]'); } catch { /* ignore */ }
  const merged = EMAIL_TEMPLATES.map(def => {
    const override = custom.find(c => c.id === def.id);
    return override ? { ...def, name: override.name, subject: override.subject, body: override.body, variables: override.variables } : def;
  });
  for (const c of custom) {
    if (!EMAIL_TEMPLATES.find(d => d.id === c.id)) merged.push(c);
  }
  return merged;
}

async function sendEmailViaSmtp(params: {
  to: string; subject: string; body: string; patientId?: string; patientName?: string; context?: string; templateId?: string;
}) {
  const { transporter, settings } = await getEmailTransporter();
  const emailLog = await createWithUniqueId(createEmailLogId, (id) =>
    prisma.emailLog.create({
      data: {
        id,
        toEmail: params.to,
        fromEmail: settings.fromEmail || settings.smtpUser,
        subject: params.subject,
        body: params.body,
        templateId: params.templateId || null,
        status: 'pending',
        patientId: params.patientId || null,
        patientName: params.patientName || null,
        context: params.context || null,
      },
    }),
  );

  try {
    await transporter.sendMail({
      from: settings.fromName ? `"${settings.fromName}" <${settings.fromEmail || settings.smtpUser}>` : (settings.fromEmail || settings.smtpUser),
      to: params.to,
      subject: params.subject,
      text: params.body,
    });
    const updated = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: 'sent' },
    });
    return updated;
  } catch (error: unknown) {
    const err = error as { message?: string };
    const updated = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: 'failed', errorMessage: err.message || 'Unknown error' },
    });
    throw { emailLog: updated, error };
  }
}

// ── Email Settings Routes ──────────────────────────────────────────────

server.get('/email-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.settings');
  if (!user) return;
  const row = await prisma.emailSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    return { smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPass: '', fromEmail: '', fromName: '', isEnabled: false, clinicName: '' };
  }
  return {
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass ? '••••' + row.smtpPass.slice(-4) : '',
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    isEnabled: row.isEnabled,
    clinicName: row.clinicName,
  };
});

server.put('/email-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.settings');
  if (!user) return;
  const body = request.body as JsonRecord;

  let smtpPass = String(body.smtpPass || '');
  if (smtpPass.startsWith('••••')) {
    const existing = await prisma.emailSettings.findUnique({ where: { id: 'default' } });
    smtpPass = existing?.smtpPass || '';
  }

  const data = {
    smtpHost: String(body.smtpHost || ''),
    smtpPort: Number(body.smtpPort) || 587,
    smtpSecure: Boolean(body.smtpSecure),
    smtpUser: String(body.smtpUser || ''),
    smtpPass,
    fromEmail: String(body.fromEmail || ''),
    fromName: String(body.fromName || ''),
    isEnabled: Boolean(body.isEnabled),
    clinicName: String(body.clinicName || ''),
  };
  await prisma.emailSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  emailTransporter = null;
  emailTransporterConfig = null;
  return { status: 'ok' };
});

server.post('/email-settings/test', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.settings');
  if (!user) return;
  const body = request.body as JsonRecord;
  const email = String(body.email || '');
  if (!email) return reply.code(400).send({ error: 'Email address required' });

  try {
    const emailLog = await sendEmailViaSmtp({
      to: email,
      subject: 'DentalQuoteCreator: Teszt e-mail',
      body: 'Ha ezt az e-mailt megkapta, az SMTP konfiguráció helyes!',
      context: 'test',
    });
    return { success: true, emailId: emailLog.id, status: emailLog.status };
  } catch (err: unknown) {
    const e = err as { emailLog?: { id: string }; error?: { message?: string } };
    return reply.code(500).send({ success: false, error: e.error?.message || 'Email send failed' });
  }
});

// ── Email Send Routes ──────────────────────────────────────────────

server.post('/email/send', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.send');
  if (!user) return;
  const body = request.body as JsonRecord;
  const to = String(body.to || '');
  const subject = String(body.subject || '');
  const message = String(body.body || '');
  if (!to || !subject || !message) return reply.code(400).send({ error: 'Missing required fields: to, subject, body' });

  try {
    const emailLog = await sendEmailViaSmtp({
      to, subject, body: message,
      patientId: body.patientId ? String(body.patientId) : undefined,
      patientName: body.patientName ? String(body.patientName) : undefined,
      context: body.context ? String(body.context) : undefined,
    });
    return { success: true, emailId: emailLog.id, status: emailLog.status };
  } catch (err: unknown) {
    const e = err as { emailLog?: { id: string }; error?: { message?: string } };
    return reply.code(500).send({ success: false, emailId: e.emailLog?.id, error: e.error?.message || 'Email send failed' });
  }
});

server.post('/email/send-template', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.send');
  if (!user) return;
  const body = request.body as JsonRecord;
  const to = String(body.to || '');
  const templateId = String(body.templateId || '');
  const variables = body.variables as Record<string, string> | undefined;

  if (!to || !templateId || !variables) {
    return reply.code(400).send({ error: 'Missing required fields: to, templateId, variables' });
  }

  const allTemplates = await getEffectiveEmailTemplates();
  const template = allTemplates.find(t => t.id === templateId);
  if (!template) return reply.code(400).send({ error: `Unknown template: ${templateId}` });

  let rendered: { subject: string; body: string };
  try {
    rendered = renderEmailTemplate(template, variables);
  } catch (err: unknown) {
    return reply.code(400).send({ error: (err as Error).message });
  }

  try {
    const emailLog = await sendEmailViaSmtp({
      to, subject: rendered.subject, body: rendered.body,
      patientId: body.patientId ? String(body.patientId) : undefined,
      patientName: body.patientName ? String(body.patientName) : undefined,
      context: body.context ? String(body.context) : undefined,
      templateId,
    });
    return { success: true, emailId: emailLog.id, status: emailLog.status };
  } catch (err: unknown) {
    const e = err as { emailLog?: { id: string }; error?: { message?: string } };
    return reply.code(500).send({ success: false, emailId: e.emailLog?.id, error: e.error?.message || 'Email send failed' });
  }
});

// ── Email Templates Routes ──────────────────────────────────────────────

server.get('/email/templates', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.send');
  if (!user) return;
  return getEffectiveEmailTemplates();
});

server.get('/email/templates/editable', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.settings');
  if (!user) return;
  const effective = await getEffectiveEmailTemplates();
  return { defaults: EMAIL_TEMPLATES, templates: effective };
});

server.put('/email/templates', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.settings');
  if (!user) return;
  const body = request.body as { templates: EmailTemplateEntry[] };
  if (!Array.isArray(body.templates)) return reply.code(400).send({ error: 'templates must be an array' });
  for (const tmpl of body.templates) {
    if (!tmpl.id || !tmpl.name || !tmpl.subject || !tmpl.body) return reply.code(400).send({ error: 'Each template must have id, name, subject, and body' });
    const vars = [...tmpl.body.matchAll(/\{\{(\w+)\}\}/g), ...tmpl.subject.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    tmpl.variables = [...new Set(vars)];
  }
  await prisma.emailSettings.upsert({
    where: { id: 'default' },
    update: { customTemplates: JSON.stringify(body.templates) },
    create: { id: 'default', customTemplates: JSON.stringify(body.templates) },
  });
  return { success: true, templates: body.templates };
});

// ── Email Enabled check (lightweight, for UI) ──────────────────────────

server.get('/email/enabled', async (request, reply) => {
  const user = await requireAuth(request, reply);
  if (!user) return;
  const row = await prisma.emailSettings.findUnique({ where: { id: 'default' }, select: { isEnabled: true } });
  return { isEnabled: row?.isEnabled || false };
});

// ── Email History Routes ──────────────────────────────────────────────

server.get('/email/history', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.history');
  if (!user) return;
  const query = request.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = new Date(query.to);
    where.createdAt = createdAt;
  }

  const take = Math.min(parseInt(query.limit || '50', 10), 200);
  const skip = parseInt(query.offset || '0', 10);

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.emailLog.count({ where }),
  ]);
  return { logs, total, limit: take, offset: skip };
});

server.get('/email/history/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'email.history');
  if (!user) return;
  const { id } = request.params as { id: string };
  const log = await prisma.emailLog.findUnique({ where: { id } });
  if (!log) return reply.code(404).send({ error: 'Email log not found' });
  return log;
});

// ── Notifications: Pending Messages ──────────────────────────────────

server.get('/notifications/pending', async (request, reply) => {
  const user = await requirePermission(request, reply, 'notifications.view');
  if (!user) return;
  const query = request.query as Record<string, string | undefined>;

  // Default to tomorrow, but allow any date via ?date= param
  let targetDate: Date;
  if (query.date) {
    targetDate = new Date(query.date);
  } else {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      startDateTime: { gte: dayStart, lte: dayEnd },
      isArchived: false,
    },
    include: {
      patient: { select: { patientId: true, lastName: true, firstName: true, phone: true, email: true } },
      appointmentType: { select: { nameHu: true, nameEn: true, nameDe: true, color: true } },
    },
    orderBy: { startDateTime: 'asc' },
  });

  // Check SMS and Email logs for each appointment
  const results = await Promise.all(appointments.map(async (apt) => {
    let smsSent = false;
    let emailSent = false;
    let smsLogId: string | null = null;
    let emailLogId: string | null = null;

    if (apt.patientId) {
      const dateStr = dayStart.toISOString().slice(0, 10);
      // Check for SMS sent for this patient on this date with appointment_reminder context
      const smsLog = await prisma.smsLog.findFirst({
        where: {
          patientId: apt.patientId,
          context: { in: ['appointment_reminder', 'appointment_confirmation'] },
          createdAt: { gte: new Date(dateStr + 'T00:00:00Z') },
          status: { notIn: ['failed'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (smsLog) { smsSent = true; smsLogId = smsLog.id; }

      const emailLog = await prisma.emailLog.findFirst({
        where: {
          patientId: apt.patientId,
          context: { in: ['appointment_reminder', 'appointment_confirmation'] },
          createdAt: { gte: new Date(dateStr + 'T00:00:00Z') },
          status: { notIn: ['failed'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (emailLog) { emailSent = true; emailLogId = emailLog.id; }
    }

    return {
      appointmentId: apt.appointmentId,
      startDateTime: apt.startDateTime.toISOString(),
      endDateTime: apt.endDateTime.toISOString(),
      title: apt.title,
      description: apt.description,
      status: apt.status,
      patient: apt.patient,
      appointmentType: apt.appointmentType,
      smsSent,
      emailSent,
      smsLogId,
      emailLogId,
    };
  }));

  return {
    date: dayStart.toISOString().slice(0, 10),
    appointments: results,
  };
});

// ── NEAK Settings ──────────────────────────────────────────────
server.get('/neak-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  const row = await prisma.neakSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    return {
      neakOjoteKey: process.env.NEAK_OJOTE_KEY || '',
      neakWssUser: process.env.NEAK_WSS_USER || '',
      neakWssPassword: process.env.NEAK_WSS_PASS || '',
    };
  }
  return {
    neakOjoteKey: row.neakOjoteKey || process.env.NEAK_OJOTE_KEY || '',
    neakWssUser: row.neakWssUser || process.env.NEAK_WSS_USER || '',
    neakWssPassword: row.neakWssPassword || process.env.NEAK_WSS_PASS || '',
  };
});

server.put('/neak-settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const body = request.body as JsonRecord;
  const data = {
    neakOjoteKey: String(body.neakOjoteKey || ''),
    neakWssUser: String(body.neakWssUser || ''),
    neakWssPassword: String(body.neakWssPassword || ''),
  };
  await prisma.neakSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  return { status: 'ok' };
});

// ── NEAK Departments ──────────────────────────────────────────
server.get('/neak-departments', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  return prisma.neakDepartment.findMany({ orderBy: { neakDepartmentNameHu: 'asc' } });
});

server.post('/neak-departments', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const body = request.body as JsonRecord;
  const dept = await prisma.neakDepartment.create({
    data: {
      neakDepartmentNameHu: String(body.neakDepartmentNameHu || ''),
      neakDepartmentNameEn: String(body.neakDepartmentNameEn || ''),
      neakDepartmentNameDe: String(body.neakDepartmentNameDe || ''),
      neakDepartmentCode: String(body.neakDepartmentCode || ''),
      neakDepartmentHours: Number(body.neakDepartmentHours || 20),
      neakDepartmentMaxPoints: Number(body.neakDepartmentMaxPoints || 100000),
      neakDepartmentPrefix: String(body.neakDepartmentPrefix || ''),
      neakDepartmentLevel: String(body.neakDepartmentLevel || 'A'),
      neakDepartmentIndicator: String(body.neakDepartmentIndicator || 'adult'),
    },
  });
  return reply.code(201).send(dept);
});

server.delete('/neak-departments/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const { id } = request.params as { id: string };
  await prisma.neakDepartment.delete({ where: { id } });
  return { status: 'ok' };
});

// ── NEAK Levels (for dropdown) ────────────────────────────────
server.get('/neak-levels', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  return prisma.neakLevel.findMany({ orderBy: { neakLevelCode: 'asc' } });
});

// ── Countries ─────────────────────────────────────────────────
server.get('/countries', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.create');
  if (!user) return;
  return prisma.country.findMany({ orderBy: { countryNameHu: 'asc' } });
});

// ── Appointment Types CRUD ─────────────────────────────────────
server.get('/appointment-types', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.view');
  if (!user) return;
  return prisma.appointmentType.findMany({ orderBy: { sortOrder: 'asc' } });
});

server.post('/appointment-types', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;
  const body = request.body as JsonRecord;
  const typeId = createAppointmentTypeId();
  const type = await prisma.appointmentType.create({
    data: {
      typeId,
      nameHu: String(body.nameHu || ''),
      nameEn: String(body.nameEn || ''),
      nameDe: String(body.nameDe || ''),
      color: String(body.color || '#3B82F6'),
      defaultDurationMin: Number(body.defaultDurationMin) || 30,
      isSystem: false,
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder) || 0,
    },
  });
  return type;
});

server.patch('/appointment-types/:typeId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;
  const { typeId } = request.params as { typeId: string };
  const body = request.body as JsonRecord;
  const data: Record<string, unknown> = {};
  if (body.nameHu !== undefined) data.nameHu = String(body.nameHu);
  if (body.nameEn !== undefined) data.nameEn = String(body.nameEn);
  if (body.nameDe !== undefined) data.nameDe = String(body.nameDe);
  if (body.color !== undefined) data.color = String(body.color);
  if (body.defaultDurationMin !== undefined) data.defaultDurationMin = Number(body.defaultDurationMin);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
  return prisma.appointmentType.update({ where: { typeId }, data });
});

server.delete('/appointment-types/:typeId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.delete');
  if (!user) return;
  const { typeId } = request.params as { typeId: string };
  const existing = await prisma.appointmentType.findUnique({ where: { typeId } });
  if (!existing) return reply.status(404).send({ error: 'Not found' });
  if (existing.isSystem) return reply.status(400).send({ error: 'Cannot delete system appointment type' });
  await prisma.appointmentType.delete({ where: { typeId } });
  return { success: true };
});

// ── Appointment Chairs CRUD ────────────────────────────────────
server.get('/appointment-chairs', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.view');
  if (!user) return;
  return prisma.appointmentChair.findMany({ orderBy: { chairNr: 'asc' } });
});

server.post('/appointment-chairs', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;
  const count = await prisma.appointmentChair.count();
  if (count >= 7) return reply.status(400).send({ error: 'Maximum 7 chairs allowed' });
  const maxNr = await prisma.appointmentChair.aggregate({ _max: { chairNr: true } });
  const nextNr = (maxNr._max.chairNr || 0) + 1;
  const body = request.body as JsonRecord;
  const chair = await prisma.appointmentChair.create({
    data: {
      chairId: createChairId(nextNr),
      chairNr: nextNr,
      chairNameHu: String(body.chairNameHu || `${nextNr}. szék`),
      chairNameEn: String(body.chairNameEn || ''),
      chairNameDe: String(body.chairNameDe || ''),
      isActive: body.isActive !== false,
      createdBy: user.id,
    },
  });
  return chair;
});

server.patch('/appointment-chairs/:chairId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;
  const { chairId } = request.params as { chairId: string };
  const body = request.body as JsonRecord;
  const data: Record<string, unknown> = {};
  if (body.chairNameHu !== undefined) data.chairNameHu = String(body.chairNameHu);
  if (body.chairNameEn !== undefined) data.chairNameEn = String(body.chairNameEn);
  if (body.chairNameDe !== undefined) data.chairNameDe = String(body.chairNameDe);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return prisma.appointmentChair.update({ where: { chairId }, data });
});

server.delete('/appointment-chairs/:chairId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.delete');
  if (!user) return;
  const { chairId } = request.params as { chairId: string };
  const count = await prisma.appointmentChair.count();
  if (count <= 1) return reply.status(400).send({ error: 'Must have at least 1 chair' });
  const existing = await prisma.appointmentChair.findUnique({ where: { chairId } });
  if (!existing) return reply.status(404).send({ error: 'Not found' });
  await prisma.appointmentChair.delete({ where: { chairId } });
  return { success: true };
});

// ── Appointments CRUD ─────────────────────────────────────────
server.get('/appointments', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.view');
  if (!user) return;
  const query = request.query as Record<string, string>;
  const where: Record<string, unknown> = { isArchived: false };
  if (query.start && query.end) {
    where.startDateTime = { gte: new Date(query.start) };
    where.endDateTime = { lte: new Date(query.end) };
  }
  if (query.chairIndex !== undefined) where.chairIndex = Number(query.chairIndex);
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;
  return prisma.appointment.findMany({
    where,
    orderBy: { startDateTime: 'asc' },
    include: {
      patient: { select: { patientId: true, lastName: true, firstName: true } },
      appointmentType: true,
    },
  });
});

server.get('/appointments/by-patient/:patientId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.view');
  if (!user) return;
  const { patientId } = request.params as { patientId: string };
  return prisma.appointment.findMany({
    where: { patientId, isArchived: false },
    orderBy: { startDateTime: 'asc' },
    include: { appointmentType: true },
  });
});

server.post('/appointments', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;
  const body = request.body as JsonRecord;
  const appointmentId = createAppointmentId();
  const recurrenceRule = body.recurrenceRule ? String(body.recurrenceRule) : null;

  const baseData = {
    patientId: body.patientId ? String(body.patientId) : null,
    chairIndex: Number(body.chairIndex) || 0,
    title: String(body.title || ''),
    description: body.description ? String(body.description) : null,
    appointmentTypeId: body.appointmentTypeId ? String(body.appointmentTypeId) : null,
    status: String(body.status || 'scheduled'),
    color: body.color ? String(body.color) : null,
    notes: body.notes ? String(body.notes) : null,
    createdByUserId: user.id,
  };

  const startDt = new Date(String(body.startDateTime));
  const endDt = new Date(String(body.endDateTime));
  const durationMs = endDt.getTime() - startDt.getTime();

  // Create the parent appointment
  const appointment = await prisma.appointment.create({
    data: {
      ...baseData,
      appointmentId,
      startDateTime: startDt,
      endDateTime: endDt,
      recurrenceRule,
    },
    include: {
      patient: { select: { patientId: true, lastName: true, firstName: true } },
      appointmentType: true,
    },
  });

  // Async Google Calendar push (non-blocking)
  pushAppointmentToGoogle(appointmentId).catch(() => {});

  // If recurrence rule is set, generate child instances
  if (recurrenceRule) {
    try {
      const rule = RRule.fromString(`DTSTART:${formatRRuleDt(startDt)}\n${recurrenceRule}`);
      const maxDate = new Date(startDt.getTime() + 365 * 24 * 60 * 60 * 1000); // max 1 year
      const dates = rule.between(startDt, maxDate, true);
      // Skip the first date (it's the parent) and limit to 365 instances
      const childDates = dates.slice(1, 366);

      if (childDates.length > 0) {
        const childData = childDates.map(date => ({
          appointmentId: createAppointmentId(),
          ...baseData,
          startDateTime: date,
          endDateTime: new Date(date.getTime() + durationMs),
          recurrenceParentId: appointmentId,
        }));
        await prisma.appointment.createMany({ data: childData });
      }
    } catch (e) {
      server.log.warn('Failed to expand RRULE: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  return appointment;
});

server.patch('/appointments/:appointmentId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;
  const { appointmentId } = request.params as { appointmentId: string };
  const body = request.body as JsonRecord;
  const scope = String(body.scope || 'single'); // single | future | all

  const data: Record<string, unknown> = {};
  if (body.patientId !== undefined) data.patientId = body.patientId ? String(body.patientId) : null;
  if (body.chairIndex !== undefined) data.chairIndex = Number(body.chairIndex);
  if (body.startDateTime !== undefined) data.startDateTime = new Date(String(body.startDateTime));
  if (body.endDateTime !== undefined) data.endDateTime = new Date(String(body.endDateTime));
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.appointmentTypeId !== undefined) data.appointmentTypeId = body.appointmentTypeId ? String(body.appointmentTypeId) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.color !== undefined) data.color = body.color ? String(body.color) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  if (scope === 'single') {
    // Mark as exception if it's a recurrence child
    const existing = await prisma.appointment.findUnique({ where: { appointmentId } });
    if (existing?.recurrenceParentId) {
      data.isRecurrenceException = true;
    }
    const result = await prisma.appointment.update({
      where: { appointmentId },
      data,
      include: {
        patient: { select: { patientId: true, lastName: true, firstName: true } },
        appointmentType: true,
      },
    });
    // Async Google Calendar push
    pushAppointmentToGoogle(appointmentId).catch(() => {});
    return result;
  }

  // For scope=future or scope=all, find the parent and siblings
  const current = await prisma.appointment.findUnique({ where: { appointmentId } });
  if (!current) return reply.code(404).send({ message: 'Not found' });

  const parentId = current.recurrenceParentId || current.appointmentId;

  // Build filter for which siblings to update
  const siblingWhere: Record<string, unknown> = { isArchived: false };
  if (scope === 'future') {
    siblingWhere.OR = [
      { appointmentId, },
      { recurrenceParentId: parentId, startDateTime: { gte: current.startDateTime } },
    ];
    // Also update parent if this IS the parent
    if (!current.recurrenceParentId) {
      siblingWhere.OR = [
        { appointmentId: parentId },
        { recurrenceParentId: parentId, startDateTime: { gte: current.startDateTime } },
      ];
    }
  } else {
    // scope=all — update parent + all children
    siblingWhere.OR = [
      { appointmentId: parentId },
      { recurrenceParentId: parentId },
    ];
  }

  // For time-based fields, compute the delta and apply to each sibling
  // For non-time fields, apply directly
  const nonTimeData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k !== 'startDateTime' && k !== 'endDateTime') {
      nonTimeData[k] = v;
    }
  }

  if (Object.keys(nonTimeData).length > 0) {
    await prisma.appointment.updateMany({ where: siblingWhere, data: nonTimeData });
  }

  // If time fields changed, apply delta to each sibling individually
  if (data.startDateTime || data.endDateTime) {
    const siblings = await prisma.appointment.findMany({ where: siblingWhere });
    const startDelta = data.startDateTime
      ? (data.startDateTime as Date).getTime() - current.startDateTime.getTime()
      : 0;
    const endDelta = data.endDateTime
      ? (data.endDateTime as Date).getTime() - current.endDateTime.getTime()
      : 0;

    for (const sib of siblings) {
      const timeUpdate: Record<string, unknown> = {};
      if (startDelta) timeUpdate.startDateTime = new Date(sib.startDateTime.getTime() + startDelta);
      if (endDelta) timeUpdate.endDateTime = new Date(sib.endDateTime.getTime() + endDelta);
      await prisma.appointment.update({ where: { appointmentId: sib.appointmentId }, data: timeUpdate });
    }
  }

  // Async Google push for updated appointments
  pushAppointmentToGoogle(appointmentId).catch(() => {});

  return prisma.appointment.findUnique({
    where: { appointmentId },
    include: {
      patient: { select: { patientId: true, lastName: true, firstName: true } },
      appointmentType: true,
    },
  });
});

server.delete('/appointments/:appointmentId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.delete');
  if (!user) return;
  const { appointmentId } = request.params as { appointmentId: string };
  const query = request.query as Record<string, string>;
  const scope = query.scope || 'single'; // single | future | all

  const current = await prisma.appointment.findUnique({ where: { appointmentId } });
  if (!current) return reply.code(404).send({ message: 'Not found' });

  if (scope === 'single') {
    await prisma.appointment.update({ where: { appointmentId }, data: { isArchived: true } });
  } else {
    const parentId = current.recurrenceParentId || current.appointmentId;
    const archiveWhere: Record<string, unknown> = { isArchived: false };

    if (scope === 'future') {
      archiveWhere.OR = [
        { appointmentId },
        { recurrenceParentId: parentId, startDateTime: { gte: current.startDateTime } },
      ];
      if (!current.recurrenceParentId) {
        archiveWhere.OR = [
          { appointmentId: parentId },
          { recurrenceParentId: parentId, startDateTime: { gte: current.startDateTime } },
        ];
      }
    } else {
      // scope=all — archive parent + all children
      archiveWhere.OR = [
        { appointmentId: parentId },
        { recurrenceParentId: parentId },
      ];
    }

    await prisma.appointment.updateMany({ where: archiveWhere, data: { isArchived: true } });
  }

  // Async Google Calendar delete
  if (current.googleEventId) {
    deleteAppointmentFromGoogle(appointmentId, current.googleEventId, current.googleCalendarId).catch(() => {});
  }

  return { success: true };
});

// ── Google Calendar Integration ──────────────────────────────────────

const GOOGLE_CLIENT_ID_ENV = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET_ENV = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI_ENV = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/backend/google-calendar/callback';
const DQ_PATIENT_TAG_RE = /#DQ:PAT-(\S+)/;

async function getGoogleCredentials(): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  return {
    clientId: settings?.clientId || GOOGLE_CLIENT_ID_ENV,
    clientSecret: settings?.clientSecret || GOOGLE_CLIENT_SECRET_ENV,
    redirectUri: settings?.redirectUri || GOOGLE_REDIRECT_URI_ENV,
  };
}

async function createGoogleOAuth2Client() {
  const creds = await getGoogleCredentials();
  return new googleAuth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
}

async function getAuthedGoogleClient() {
  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  if (!settings || !settings.refreshToken) return null;
  const oauth2 = await createGoogleOAuth2Client();
  oauth2.setCredentials({
    access_token: settings.accessToken || undefined,
    refresh_token: settings.refreshToken,
    expiry_date: settings.tokenExpiresAt?.getTime(),
  });
  // Auto-refresh — save new tokens if refreshed
  oauth2.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = {};
    if (tokens.access_token) update.accessToken = tokens.access_token;
    if (tokens.expiry_date) update.tokenExpiresAt = new Date(tokens.expiry_date);
    if (tokens.refresh_token) update.refreshToken = tokens.refresh_token;
    if (Object.keys(update).length > 0) {
      await prisma.googleCalendarSync.update({ where: { id: 'default' }, data: update });
    }
  });
  return oauth2;
}

function buildGoogleEventBody(apt: {
  appointmentId: string;
  title: string;
  description?: string | null;
  startDateTime: Date;
  endDateTime: Date;
  patientId?: string | null;
  notes?: string | null;
  status?: string;
  recurrenceRule?: string | null;
}, patientName?: string) {
  const descParts: string[] = [];
  if (apt.patientId) descParts.push(`#DQ:PAT-${apt.patientId}`);
  if (patientName) descParts.push(patientName);
  if (apt.description) descParts.push(apt.description);
  if (apt.notes) descParts.push(apt.notes);

  const event: Record<string, unknown> = {
    summary: apt.title + (patientName ? ` — ${patientName}` : ''),
    description: descParts.join('\n'),
    start: { dateTime: apt.startDateTime.toISOString(), timeZone: 'Europe/Budapest' },
    end: { dateTime: apt.endDateTime.toISOString(), timeZone: 'Europe/Budapest' },
    extendedProperties: {
      private: { dqAppointmentId: apt.appointmentId },
    },
  };

  if (apt.recurrenceRule) {
    event.recurrence = [apt.recurrenceRule];
  }

  return event;
}

function getCalendarIdForChair(chairCalendarMap: string, chairIndex: number): string | null {
  try {
    const map = JSON.parse(chairCalendarMap) as Array<{ chairId: string; calendarId: string; chairNr?: number }>;
    // Match by chairNr (0-based chairIndex → 1-based chairNr) or by array index
    const entry = map.find(m => (m.chairNr ?? 0) === chairIndex + 1) || map[chairIndex];
    return entry?.calendarId || null;
  } catch {
    return null;
  }
}

async function logGoogleSync(data: {
  direction: string;
  action: string;
  appointmentId?: string;
  googleEventId?: string;
  chairId?: string;
  calendarId?: string;
  status?: string;
  errorMessage?: string;
  details?: string;
}) {
  try {
    await prisma.googleCalendarLog.create({ data });
  } catch {
    // Non-critical
  }
}

// Push a single appointment to Google Calendar
async function pushAppointmentToGoogle(appointmentId: string) {
  const oauth2 = await getAuthedGoogleClient();
  if (!oauth2) return;

  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  if (!settings?.isEnabled || (settings.syncMode !== 'push' && settings.syncMode !== 'bidirectional')) return;

  const apt = await prisma.appointment.findUnique({
    where: { appointmentId },
    include: { patient: { select: { patientId: true, lastName: true, firstName: true } } },
  });
  if (!apt || apt.isArchived) return;

  const calendarId = getCalendarIdForChair(settings.chairCalendarMap, apt.chairIndex);
  if (!calendarId) return;

  const calendar = new calendar_v3.Calendar({ auth: oauth2 });
  const patientName = apt.patient ? `${apt.patient.lastName} ${apt.patient.firstName}` : undefined;
  const eventBody = buildGoogleEventBody(apt, patientName);

  try {
    if (apt.googleEventId) {
      // Update existing
      const res = await calendar.events.patch({
        calendarId,
        eventId: apt.googleEventId,
        requestBody: eventBody,
      });
      await logGoogleSync({
        direction: 'push', action: 'update', appointmentId, googleEventId: apt.googleEventId,
        calendarId, status: 'success',
      });
    } else {
      // Create new
      const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
      const googleEventId = res.data.id || undefined;
      if (googleEventId) {
        await prisma.appointment.update({
          where: { appointmentId },
          data: { googleEventId, googleCalendarId: calendarId },
        });
      }
      await logGoogleSync({
        direction: 'push', action: 'create', appointmentId, googleEventId,
        calendarId, status: 'success',
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logGoogleSync({
      direction: 'push', action: apt.googleEventId ? 'update' : 'create',
      appointmentId, calendarId, status: 'error', errorMessage: msg,
    });
    server.log.warn(`Google push failed for ${appointmentId}: ${msg}`);
  }
}

// Delete from Google Calendar
async function deleteAppointmentFromGoogle(appointmentId: string, googleEventId: string, googleCalendarId?: string | null) {
  const oauth2 = await getAuthedGoogleClient();
  if (!oauth2 || !googleEventId) return;

  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  if (!settings?.isEnabled) return;

  const calendarId = googleCalendarId || 'primary';
  const calendar = new calendar_v3.Calendar({ auth: oauth2 });

  try {
    await calendar.events.delete({ calendarId, eventId: googleEventId });
    await logGoogleSync({
      direction: 'push', action: 'delete', appointmentId, googleEventId, calendarId, status: 'success',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logGoogleSync({
      direction: 'push', action: 'delete', appointmentId, googleEventId, calendarId,
      status: 'error', errorMessage: msg,
    });
  }
}

// Pull changes from Google Calendar (incremental sync)
async function pullFromGoogle() {
  const oauth2 = await getAuthedGoogleClient();
  if (!oauth2) return { imported: 0, updated: 0, errors: 0 };

  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  if (!settings?.isEnabled || (settings.syncMode !== 'pull' && settings.syncMode !== 'bidirectional')) {
    return { imported: 0, updated: 0, errors: 0 };
  }

  const calendar = new calendar_v3.Calendar({ auth: oauth2 });
  let chairMap: Array<{ chairId: string; calendarId: string; chairNr: number }> = [];
  try { chairMap = JSON.parse(settings.chairCalendarMap); } catch { /* empty */ }

  let imported = 0, updated = 0, errors = 0;

  for (const mapping of chairMap) {
    const chairIndex = (mapping.chairNr || 1) - 1;
    try {
      const params: Record<string, unknown> = {
        calendarId: mapping.calendarId,
        singleEvents: true,
        maxResults: 250,
      };

      // Use syncToken for incremental sync, or timeMin for initial sync
      if (settings.syncToken) {
        params.syncToken = settings.syncToken;
      } else {
        const now = new Date();
        params.timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // last 30 days
        params.timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // next 365 days
      }

      let pageToken: string | undefined;
      let nextSyncToken: string | undefined;

      do {
        if (pageToken) params.pageToken = pageToken;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: { data: { items?: any[]; nextSyncToken?: string | null; nextPageToken?: string | null } };
        try {
          response = await calendar.events.list(params as any);
        } catch (syncErr: unknown) {
          // If syncToken is invalid (410 Gone), reset and do full sync
          const errObj = syncErr as { code?: number };
          if (errObj.code === 410) {
            await prisma.googleCalendarSync.update({ where: { id: 'default' }, data: { syncToken: null } });
            // Retry without syncToken
            delete params.syncToken;
            const now = new Date();
            params.timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            params.timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
            response = await calendar.events.list(params as any);
          } else {
            throw syncErr;
          }
        }

        const events = response.data.items || [];
        nextSyncToken = response.data.nextSyncToken || undefined;
        pageToken = response.data.nextPageToken || undefined;

        for (const event of events) {
          if (!event.id) continue;

          // Skip cancelled events
          if (event.status === 'cancelled') {
            // Find and archive matching appointment
            const existing = await prisma.appointment.findFirst({
              where: { googleEventId: event.id, isArchived: false },
            });
            if (existing) {
              await prisma.appointment.update({
                where: { appointmentId: existing.appointmentId },
                data: { isArchived: true },
              });
              await logGoogleSync({
                direction: 'pull', action: 'delete', appointmentId: existing.appointmentId,
                googleEventId: event.id, calendarId: mapping.calendarId, status: 'success',
              });
              updated++;
            }
            continue;
          }

          const startDt = event.start?.dateTime ? new Date(event.start.dateTime) : null;
          const endDt = event.end?.dateTime ? new Date(event.end.dateTime) : null;
          if (!startDt || !endDt) continue; // Skip all-day events

          // Check if we already have this event
          const existing = await prisma.appointment.findFirst({
            where: { googleEventId: event.id, isArchived: false },
          });

          // Try to match patient from description tag #DQ:PAT-xxxxx
          let patientId: string | null = null;
          if (event.description) {
            const match = event.description.match(DQ_PATIENT_TAG_RE);
            if (match) {
              const patient = await prisma.patient.findUnique({ where: { patientId: match[1] } });
              if (patient) patientId = patient.patientId;
            }
          }

          // Check extended properties for DQ appointment ID
          const dqApptId = event.extendedProperties?.private?.dqAppointmentId;

          if (existing) {
            // Update existing appointment from Google
            await prisma.appointment.update({
              where: { appointmentId: existing.appointmentId },
              data: {
                title: event.summary || existing.title,
                startDateTime: startDt,
                endDateTime: endDt,
                ...(patientId && { patientId }),
              },
            });
            await logGoogleSync({
              direction: 'pull', action: 'update', appointmentId: existing.appointmentId,
              googleEventId: event.id, calendarId: mapping.calendarId, status: 'success',
            });
            updated++;
          } else if (dqApptId) {
            // This was created by our app but googleEventId wasn't saved — link it
            const appAppt = await prisma.appointment.findUnique({ where: { appointmentId: dqApptId } });
            if (appAppt) {
              await prisma.appointment.update({
                where: { appointmentId: dqApptId },
                data: { googleEventId: event.id, googleCalendarId: mapping.calendarId },
              });
              updated++;
            }
          } else {
            // Import as new appointment
            const newId = createAppointmentId();
            await prisma.appointment.create({
              data: {
                appointmentId: newId,
                patientId,
                chairIndex,
                startDateTime: startDt,
                endDateTime: endDt,
                title: event.summary || 'Google event',
                description: event.description || null,
                status: 'scheduled',
                googleEventId: event.id,
                googleCalendarId: mapping.calendarId,
              },
            });
            await logGoogleSync({
              direction: 'pull', action: 'import', appointmentId: newId,
              googleEventId: event.id, calendarId: mapping.calendarId, status: 'success',
            });
            imported++;
          }
        }
      } while (pageToken);

      // Save sync token for incremental sync next time
      if (nextSyncToken) {
        await prisma.googleCalendarSync.update({
          where: { id: 'default' },
          data: { syncToken: nextSyncToken, lastSyncAt: new Date() },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logGoogleSync({
        direction: 'pull', action: 'import', calendarId: mapping.calendarId,
        status: 'error', errorMessage: msg,
      });
      errors++;
      server.log.warn(`Google pull failed for calendar ${mapping.calendarId}: ${msg}`);
    }
  }

  return { imported, updated, errors };
}

// ── Google Calendar: OAuth2 Flow ──

server.get('/google-calendar/auth-url', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;

  const creds = await getGoogleCredentials();
  if (!creds.clientId || !creds.clientSecret) {
    return reply.code(400).send({ message: 'Google OAuth credentials not configured' });
  }

  const oauth2 = await createGoogleOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  return { url };
});

server.get('/google-calendar/callback', async (request, reply) => {
  const query = request.query as Record<string, string>;
  const code = query.code;
  if (!code) return reply.code(400).send({ message: 'Missing authorization code' });

  const oauth2 = await createGoogleOAuth2Client();
  try {
    const { tokens } = await oauth2.getToken(code);
    await prisma.googleCalendarSync.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isEnabled: false, // User must enable manually after mapping chairs
      },
      update: {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    // Redirect to frontend settings page
    return reply.redirect('/?googleCalendarConnected=1#/settings/calendar');
  } catch (e) {
    server.log.error('Google Calendar OAuth error: ' + (e instanceof Error ? e.message : String(e)));
    return reply.redirect('/?googleCalendarError=1#/settings/calendar');
  }
});

server.delete('/google-calendar/disconnect', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;

  await prisma.googleCalendarSync.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {
      accessToken: '',
      refreshToken: '',
      tokenExpiresAt: null,
      isEnabled: false,
      syncToken: null,
      lastSyncAt: null,
    },
  });
  return { success: true };
});

// ── Google Calendar: Settings ──

server.get('/google-calendar/settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;

  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  const creds = await getGoogleCredentials();
  const isConnected = !!(settings?.refreshToken);
  return {
    isConnected,
    isEnabled: settings?.isEnabled || false,
    syncMode: settings?.syncMode || 'bidirectional',
    pollIntervalMin: settings?.pollIntervalMin || 5,
    lastSyncAt: settings?.lastSyncAt?.toISOString() || null,
    chairCalendarMap: settings?.chairCalendarMap || '[]',
    hasCredentials: !!(creds.clientId && creds.clientSecret),
    clientId: settings?.clientId || GOOGLE_CLIENT_ID_ENV,
    clientSecret: settings?.clientSecret ? '••••••••' : (GOOGLE_CLIENT_SECRET_ENV ? '••••••••' : ''),
    clientSecretSet: !!(settings?.clientSecret || GOOGLE_CLIENT_SECRET_ENV),
    redirectUri: settings?.redirectUri || GOOGLE_REDIRECT_URI_ENV,
  };
});

server.put('/google-calendar/settings', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  const body = request.body as JsonRecord;

  const data: Record<string, unknown> = {};
  if (body.clientId !== undefined) data.clientId = String(body.clientId);
  if (body.clientSecret !== undefined && String(body.clientSecret) !== '••••••••') data.clientSecret = String(body.clientSecret);
  if (body.redirectUri !== undefined) data.redirectUri = String(body.redirectUri);
  if (body.isEnabled !== undefined) data.isEnabled = Boolean(body.isEnabled);
  if (body.syncMode !== undefined) data.syncMode = String(body.syncMode);
  if (body.pollIntervalMin !== undefined) data.pollIntervalMin = Number(body.pollIntervalMin);
  if (body.chairCalendarMap !== undefined) data.chairCalendarMap = typeof body.chairCalendarMap === 'string' ? body.chairCalendarMap : JSON.stringify(body.chairCalendarMap);

  const settings = await prisma.googleCalendarSync.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  });
  return settings;
});

// ── Google Calendar: List calendars (for chair mapping) ──

server.get('/google-calendar/calendars', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;

  const oauth2 = await getAuthedGoogleClient();
  if (!oauth2) return reply.code(400).send({ message: 'Not connected to Google Calendar' });

  const calendar = new calendar_v3.Calendar({ auth: oauth2 });
  try {
    const res = await calendar.calendarList.list();
    const calendars = (res.data.items || []).map(c => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary || false,
      backgroundColor: c.backgroundColor,
      accessRole: c.accessRole,
    }));
    return { calendars };
  } catch (e) {
    return reply.code(500).send({ message: 'Failed to list calendars: ' + (e instanceof Error ? e.message : String(e)) });
  }
});

// ── Google Calendar: Manual sync trigger ──

server.post('/google-calendar/sync', async (request, reply) => {
  const user = await requirePermission(request, reply, 'calendar.create');
  if (!user) return;

  const body = request.body as JsonRecord;
  const direction = String(body.direction || 'pull'); // pull | push | both

  const results: Record<string, unknown> = {};

  if (direction === 'push' || direction === 'both') {
    // Push all non-archived appointments that have no googleEventId
    const unpushed = await prisma.appointment.findMany({
      where: { isArchived: false, googleEventId: null },
      take: 500,
    });
    let pushed = 0;
    for (const apt of unpushed) {
      await pushAppointmentToGoogle(apt.appointmentId);
      pushed++;
    }
    results.pushed = pushed;
  }

  if (direction === 'pull' || direction === 'both') {
    const pullResult = await pullFromGoogle();
    results.pull = pullResult;
  }

  return { success: true, ...results };
});

// ── Google Calendar: Sync log ──

server.get('/google-calendar/log', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;

  const query = request.query as Record<string, string>;
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));

  const [logs, total] = await Promise.all([
    prisma.googleCalendarLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.googleCalendarLog.count(),
  ]);

  return { logs, total, page, limit };
});

// ── Google Calendar: Webhook endpoint (for production push notifications) ──

server.post('/google-calendar/webhook', async (request, reply) => {
  // Google sends push notifications here
  // Validate channel token header
  const channelToken = (request.headers as Record<string, string>)['x-goog-channel-token'];
  if (channelToken !== 'dq-gcal-sync') {
    return reply.code(403).send({ message: 'Invalid channel token' });
  }

  // Trigger a pull sync
  const resourceState = (request.headers as Record<string, string>)['x-goog-resource-state'];
  if (resourceState === 'sync') {
    // Initial sync confirmation — just acknowledge
    return { ok: true };
  }

  // Resource changed — do incremental sync
  try {
    await pullFromGoogle();
  } catch (e) {
    server.log.warn('Webhook-triggered sync failed: ' + (e instanceof Error ? e.message : String(e)));
  }
  return { ok: true };
});

// ── Google Calendar: Register webhook (production only) ──

server.post('/google-calendar/webhook/register', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;

  const body = request.body as JsonRecord;
  const webhookUrl = String(body.webhookUrl || '');
  if (!webhookUrl.startsWith('https://')) {
    return reply.code(400).send({ message: 'Webhook URL must be HTTPS' });
  }

  const oauth2 = await getAuthedGoogleClient();
  if (!oauth2) return reply.code(400).send({ message: 'Not connected to Google Calendar' });

  const settings = await prisma.googleCalendarSync.findUnique({ where: { id: 'default' } });
  let chairMap: Array<{ chairId: string; calendarId: string }> = [];
  try { chairMap = JSON.parse(settings?.chairCalendarMap || '[]'); } catch { /* empty */ }

  const results: Array<{ calendarId: string; channelId: string; expiration: string }> = [];
  const calendar = new calendar_v3.Calendar({ auth: oauth2 });

  for (const mapping of chairMap) {
    try {
      const channelId = randomUUID();
      const res = await calendar.events.watch({
        calendarId: mapping.calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: 'dq-gcal-sync',
          params: { ttl: '604800' }, // 7 days
        },
      });
      results.push({
        calendarId: mapping.calendarId,
        channelId,
        expiration: res.data.expiration || '',
      });
    } catch (e) {
      server.log.warn('Webhook registration failed for ' + mapping.calendarId + ': ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  return { channels: results };
});

// ── NEAK API Test ─────────────────────────────────────────────
server.post('/api/neak/test', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  // Dummy connection test — actual OJOTE integration will come later
  const row = await prisma.neakSettings.findUnique({ where: { id: 'default' } });
  const hasCredentials = !!(row?.neakWssUser && row?.neakWssPassword);
  if (!hasCredentials) {
    return { success: false, message: 'Nincs megadva NEAK felhasználónév vagy jelszó.' };
  }
  return { success: true, message: 'NEAK kapcsolat beállítva. (Teszt mód — valós API hívás hamarosan.)' };
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
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
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
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
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
server.get('/invoices', async (request, reply) => {
  const user = await requireAnyPermission(request, reply, ['invoices.view', 'invoices.view.detail']);
  if (!user) return;
  const rows = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((row) => row.data);
});

server.get('/invoices/:invoiceId', async (request, reply) => {
  const user = await requireAnyPermission(request, reply, ['invoices.view', 'invoices.view.detail']);
  if (!user) return;
  const { invoiceId } = request.params as { invoiceId: string };
  const row = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!row) return reply.code(404).send({ message: 'Invoice not found' });
  return row.data;
});

server.put('/invoices/:invoiceId', async (request, reply) => {
  const user = await requireAnyPermission(request, reply, ['invoices.issue', 'invoices.storno']);
  if (!user) return;

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
      paymentMethod: body.paymentMethod ? String(body.paymentMethod) : undefined,
      fulfillmentDate: body.fulfillmentDate ? String(body.fulfillmentDate) : undefined,
      szamlazzInvoiceNumber: body.szamlazzInvoiceNumber ? String(body.szamlazzInvoiceNumber) : undefined,
      quoteNumber: body.quoteNumber ? String(body.quoteNumber) : undefined,
      invoiceType: body.invoiceType ? String(body.invoiceType) : undefined,
    },
    create: {
      id: invoiceId,
      patientId: String(body.patientId || ''),
      quoteId: String(body.quoteId || ''),
      status: String(body.status || 'draft'),
      createdAt,
      data: toInputJson({ ...body, id: invoiceId }),
      createdByUserId: user.id,
      paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
      fulfillmentDate: body.fulfillmentDate ? String(body.fulfillmentDate) : null,
      szamlazzInvoiceNumber: body.szamlazzInvoiceNumber ? String(body.szamlazzInvoiceNumber) : null,
      quoteNumber: body.quoteNumber ? String(body.quoteNumber) : null,
      invoiceType: body.invoiceType ? String(body.invoiceType) : null,
    },
  });

  await logActivity(user.id, 'invoice.create', {
    page: `patients/${String(body.patientId || '')}/quotes/${String(body.quoteId || '')}`,
    entityType: 'Invoice',
    entityId: invoiceId,
    details: { patientId: String(body.patientId || ''), quoteId: String(body.quoteId || ''), status: String(body.status || 'draft'), invoiceType: body.invoiceType ? String(body.invoiceType) : undefined },
    ipAddress: request.ip || undefined,
  });

  return { status: 'ok', id: invoiceId };
});

server.delete('/invoices', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.users.manage');
  if (!user) return;
  await prisma.invoice.deleteMany({});
  await logActivity(user.id, 'invoice.deleteAll', {
    entityType: 'Invoice',
    details: { action: 'Deleted all invoices' },
    ipAddress: request.ip || undefined,
  });
  return { status: 'ok' };
});

// Next-ID endpoints for frontend
server.get('/quotes/next-id/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  try {
    const id = await nextQuoteId(patientId);
    return { id };
  } catch (err) {
    if (err instanceof Error && err.message === 'QUOTE_LIMIT_REACHED') {
      return reply.code(400).send({ message: 'QUOTE_LIMIT_REACHED' });
    }
    throw err;
  }
});

server.get('/invoices/next-id/:patientId', async (request, reply) => {
  const { patientId } = request.params as { patientId: string };
  try {
    const id = await nextInvoiceId(patientId);
    return { id };
  } catch (err) {
    if (err instanceof Error && err.message === 'INVOICE_LIMIT_REACHED') {
      return reply.code(400).send({ message: 'INVOICE_LIMIT_REACHED' });
    }
    throw err;
  }
});

// Doctor CRUD
server.get('/doctors', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  return prisma.doctor.findMany({ orderBy: { doctorId: 'asc' } });
});

server.post('/doctors', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const body = request.body as JsonRecord;
  const doctorId = await nextDoctorId();
  const doctor = await prisma.doctor.create({
    data: {
      doctorId,
      doctorName: String(body.doctorName || ''),
      doctorNum: String(body.doctorNum || ''),
      doctorEESZTId: String(body.doctorEESZTId || ''),
      createdByUserId: request.currentUser?.id || null,
    },
  });
  return reply.code(201).send(doctor);
});

server.put('/doctors/:doctorId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const { doctorId } = request.params as { doctorId: string };
  const body = request.body as JsonRecord;
  try {
    const doctor = await prisma.doctor.update({
      where: { doctorId },
      data: {
        doctorName: body.doctorName === undefined ? undefined : String(body.doctorName),
        doctorNum: body.doctorNum === undefined ? undefined : String(body.doctorNum),
        doctorEESZTId: body.doctorEESZTId === undefined ? undefined : String(body.doctorEESZTId),
      },
    });
    return doctor;
  } catch {
    return reply.code(404).send({ message: 'Doctor not found' });
  }
});

server.delete('/doctors/:doctorId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.edit');
  if (!user) return;
  const { doctorId } = request.params as { doctorId: string };
  try {
    await prisma.doctor.delete({ where: { doctorId } });
    return { status: 'ok' };
  } catch {
    return reply.code(404).send({ message: 'Doctor not found' });
  }
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

server.put('/neak-checks/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
  const { id } = request.params as { id: string };
  const body = request.body as JsonRecord;
  const checkedAt = body.checkedAt ? toDate(String(body.checkedAt)) : new Date();
  const result = (body.result || {}) as JsonRecord;
  const shared = {
    patientId: String(body.patientId || ''),
    taj: body.taj ? String(body.taj) : null,
    checkedAt,
    neakHibakod: result.hibaKod ? String(result.hibaKod) : null,
    neakSuccess: result.success === true,
    neakJogviszony: result.jogviszony ? String(result.jogviszony) : null,
    neakTranKod: result.tranKod ? String(result.tranKod) : null,
    data: toInputJson({ ...body, id }),
  };
  await prisma.neakCheck.upsert({
    where: { id },
    update: shared,
    create: { id, ...shared },
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

server.put('/odontogram/current/:patientId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
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

server.put('/odontogram/daily/:patientId/:dateKey', async (request, reply) => {
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
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
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
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
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
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
  const user = await requirePermission(request, reply, 'patients.update');
  if (!user) return;
  const { patientId, snapshotId } = request.params as { patientId: string; snapshotId: string };
  const row = await prisma.odontogramTimeline.findUnique({ where: { snapshotId } });
  if (!row || row.patientId !== patientId) {
    return reply.code(404).send({ message: 'Snapshot not found' });
  }
  await prisma.odontogramTimeline.delete({ where: { snapshotId } });
  return { status: 'ok' };
});

// Data export/import
server.get('/data/export', async (request, reply) => {
  const user = await requirePermission(request, reply, 'data.view');
  if (!user) return;
  const [patients, catalog, quotes, settings, dentalStatusSnapshots, invoices, neakChecks, pricelists, pricelistCategories, doctors] =
    await Promise.all([
      prisma.patient.findMany(),
      prisma.priceListCatalogItem.findMany(),
      prisma.quote.findMany(),
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.dentalStatusSnapshot.findMany(),
      prisma.invoice.findMany(),
      prisma.neakCheck.findMany(),
      prisma.priceList.findMany(),
      prisma.priceListCategory.findMany(),
      prisma.doctor.findMany({ orderBy: { doctorId: 'asc' } }),
    ]);

  const exportData: ExportData & { doctors?: unknown[] } = {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    patients,
    catalog: catalog.map((i) => mapCatalogItem(i as unknown as Record<string, unknown>)),
    quotes: quotes.map((q) => q.data),
    settings: parseJsonObject(settings?.data, defaultSettings),
    dentalStatusSnapshots,
    invoices: invoices.map((i) => i.data),
    neakChecks: neakChecks.map((n) => n.data),
    pricelists,
    pricelistCategories,
    doctors,
  };

  return exportData;
});

server.post('/data/import', async (request, reply) => {
  const user = await requirePermission(request, reply, 'admin.users.manage');
  if (!user) return;
  const body = request.body as ExportData;
  if (!body || !Array.isArray(body.patients) || !Array.isArray(body.catalog) || !Array.isArray(body.quotes)) {
    return reply.code(400).send({ message: 'Invalid import payload' });
  }

  const importUserId = user.id;

  try {
  await prisma.$transaction(async (tx) => {
    await tx.odontogramTimeline.deleteMany({});
    await tx.odontogramDaily.deleteMany({});
    await tx.odontogramCurrent.deleteMany({});
    await tx.neakCheck.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.dentalStatusSnapshot.deleteMany({});
    await tx.quote.deleteMany({});
    await tx.priceListCatalogItem.deleteMany({});
    await tx.priceListCategory.deleteMany({});
    await tx.priceList.deleteMany({});
    await tx.patient.deleteMany({});
    await tx.doctor.deleteMany({});

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
          mothersName: rawPatient.mothersName ? String(rawPatient.mothersName) : null,
          neakDocumentType: rawPatient.neakDocumentType !== undefined ? Number(rawPatient.neakDocumentType) : 1,
          patientVATName: rawPatient.patientVATName ? String(rawPatient.patientVATName) : null,
          patientVATNumber: rawPatient.patientVATNumber ? String(rawPatient.patientVATNumber) : null,
          patientVATAddress: rawPatient.patientVATAddress ? String(rawPatient.patientVATAddress) : null,
          patientDiscount: rawPatient.patientDiscount != null ? Number(rawPatient.patientDiscount) : null,
          createdAt: rawPatient.createdAt ? toDate(String(rawPatient.createdAt)) : new Date(),
          updatedAt: rawPatient.updatedAt ? toDate(String(rawPatient.updatedAt)) : new Date(),
          isArchived: Boolean(rawPatient.isArchived),
          createdByUserId: importUserId,
        },
      });
    }

    // Import pricelists if present
    if (Array.isArray((body as JsonRecord).pricelists)) {
      await tx.priceListCategory.deleteMany({});
      await tx.priceList.deleteMany({});
      for (const rawPl of (body as JsonRecord).pricelists as JsonRecord[]) {
        await tx.priceList.create({
          data: {
            priceListId: String(rawPl.priceListId || randomUUID()),
            priceListNameHu: String(rawPl.priceListNameHu || ''),
            priceListNameEn: String(rawPl.priceListNameEn || ''),
            priceListNameDe: String(rawPl.priceListNameDe || ''),
            isActive: rawPl.isActive === undefined ? true : Boolean(rawPl.isActive),
            isDeleted: Boolean(rawPl.isDeleted),
            isDefault: Boolean(rawPl.isDefault),
            isNeak: Boolean(rawPl.isNeak),
            isUserLocked: Boolean(rawPl.isUserLocked),
            listOfUsers: toInputJson(rawPl.listOfUsers || []),
          },
        });
      }
    }

    // Import pricelist categories if present
    if (Array.isArray((body as JsonRecord).pricelistCategories)) {
      for (const rawCat of (body as JsonRecord).pricelistCategories as JsonRecord[]) {
        await tx.priceListCategory.create({
          data: {
            catalogCategoryId: String(rawCat.catalogCategoryId || randomUUID()),
            priceListId: String(rawCat.priceListId || ''),
            catalogCategoryPrefix: String(rawCat.catalogCategoryPrefix || ''),
            catalogCategoryHu: String(rawCat.catalogCategoryHu || ''),
            catalogCategoryEn: String(rawCat.catalogCategoryEn || ''),
            catalogCategoryDe: String(rawCat.catalogCategoryDe || ''),
            isActive: rawCat.isActive === undefined ? true : Boolean(rawCat.isActive),
            isDeleted: Boolean(rawCat.isDeleted),
          },
        });
      }
    }

    for (const rawCatalog of body.catalog as JsonRecord[]) {
      await tx.priceListCatalogItem.create({
        data: {
          catalogItemId: String(rawCatalog.catalogItemId || randomUUID()),
          catalogCode: String(rawCatalog.catalogCode || ''),
          catalogNameHu: String(rawCatalog.catalogNameHu || rawCatalog.catalogName || ''),
          catalogNameEn: String(rawCatalog.catalogNameEn || ''),
          catalogNameDe: String(rawCatalog.catalogNameDe || ''),
          catalogUnit: String(rawCatalog.catalogUnit || 'alkalom'),
          catalogPrice: Number(rawCatalog.catalogPrice || 0),
          catalogPriceCurrency: String(rawCatalog.catalogPriceCurrency || 'HUF'),
          catalogVatRate: Number(rawCatalog.catalogVatRate || 0),
          catalogTechnicalPrice: Number(rawCatalog.catalogTechnicalPrice || 0),
          catalogCategoryId: String(rawCatalog.catalogCategoryId || ''),
          priceListId: rawCatalog.priceListId ? String(rawCatalog.priceListId) : null,
          svgLayer: String(rawCatalog.svgLayer || ''),
          hasLayer: Boolean(rawCatalog.hasLayer),
          hasTechnicalPrice: Boolean(rawCatalog.hasTechnicalPrice),
          isFullMouth: Boolean(rawCatalog.isFullMouth),
          isArch: Boolean(rawCatalog.isArch),
          isQuadrant: Boolean(rawCatalog.isQuadrant),
          maxTeethPerArch: rawCatalog.maxTeethPerArch != null ? Number(rawCatalog.maxTeethPerArch) : null,
          allowedTeeth: Array.isArray(rawCatalog.allowedTeeth) ? (rawCatalog.allowedTeeth as number[]).map(Number) : [],
          milkToothOnly: Boolean(rawCatalog.milkToothOnly),
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
          createdByUserId: importUserId,
          quoteName: rawQuote.quoteName ? String(rawQuote.quoteName) : null,
          quoteNumber: rawQuote.quoteNumber ? String(rawQuote.quoteNumber) : null,
          validUntil: rawQuote.validUntil ? String(rawQuote.validUntil) : null,
          currency: rawQuote.currency ? String(rawQuote.currency) : null,
          doctorId: rawQuote.doctorId ? String(rawQuote.doctorId) : null,
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
          createdByUserId: importUserId,
          paymentMethod: rawInvoice.paymentMethod ? String(rawInvoice.paymentMethod) : null,
          fulfillmentDate: rawInvoice.fulfillmentDate ? String(rawInvoice.fulfillmentDate) : null,
          szamlazzInvoiceNumber: rawInvoice.szamlazzInvoiceNumber ? String(rawInvoice.szamlazzInvoiceNumber) : null,
          quoteNumber: rawInvoice.quoteNumber ? String(rawInvoice.quoteNumber) : null,
          invoiceType: rawInvoice.invoiceType ? String(rawInvoice.invoiceType) : null,
        },
      });
    }

    for (const rawNeak of (body.neakChecks || []) as JsonRecord[]) {
      await createWithUniqueId(createNeakCheckId, (id) =>
        tx.neakCheck.create({
          data: {
            id: String(rawNeak.id || id),
            patientId: String(rawNeak.patientId || ''),
            checkedAt: rawNeak.checkedAt ? toDate(String(rawNeak.checkedAt)) : new Date(),
            data: toInputJson(rawNeak),
          },
        }),
      );
    }

    // Import doctors if present
    if (Array.isArray((body as JsonRecord).doctors)) {
      for (const rawDoc of (body as JsonRecord).doctors as JsonRecord[]) {
        await tx.doctor.create({
          data: {
            doctorId: String(rawDoc.doctorId || randomUUID()),
            doctorName: String(rawDoc.doctorName || ''),
            doctorNum: String(rawDoc.doctorNum || ''),
            doctorEESZTId: String(rawDoc.doctorEESZTId || ''),
            createdByUserId: importUserId,
          },
        });
      }
    }

    await tx.appSettings.upsert({
      where: { id: 'default' },
      update: { data: toInputJson(body.settings || defaultSettings) },
      create: { id: 'default', data: toInputJson(body.settings || defaultSettings) },
    });
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    server.log.error({ err }, 'Data import failed');
    return reply.code(500).send({ message: `Import hiba: ${message}` });
  }

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
const INVOICE_MODE = process.env.INVOICE_MODE || 'test';
const SZAMLAZZ_ENDPOINT = 'https://www.szamlazz.hu/szamla/';
const AGENT_KEY_TEST_ENV = process.env.SZAMLAZZ_AGENT_KEY_TEST || '';
const AGENT_KEY_LIVE_ENV = process.env.SZAMLAZZ_AGENT_KEY_LIVE || '';

async function getActiveAgentKey(): Promise<string> {
  const row = await prisma.invoiceSettings.findUnique({ where: { id: 'default' } });
  if (!row) return INVOICE_MODE === 'live' ? AGENT_KEY_LIVE_ENV : AGENT_KEY_TEST_ENV;
  const key = row.invoiceMode === 'live' ? row.agentKeyLive : row.agentKeyTest;
  return key || (row.invoiceMode === 'live' ? AGENT_KEY_LIVE_ENV : AGENT_KEY_TEST_ENV);
}

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
  if (normalized === 'atutalas' || normalized === 'átutalás') return 'Átutalás';
  if (normalized === 'keszpenz' || normalized === 'készpénz') return 'Készpénz';
  if (normalized === 'bankkartya' || normalized === 'bankkártya') return 'Bankkártya';
  return value || 'Bankkártya';
};

const validateAndNormalizePayload = (input: JsonRecord) => {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { errors: ['Hiányzó payload'] };
  }

  const seller = (input.seller as JsonRecord) || {};
  const buyer = (input.buyer as JsonRecord) || {};
  const invoice = (input.invoice as JsonRecord) || {};
  const items = Array.isArray(input.items) ? (input.items as JsonRecord[]) : [];

  if (!seller.name) errors.push('Eladó neve kötelező');
  if (!buyer.name) errors.push('Vevő neve kötelező');
  if (items.length === 0) errors.push('Legalább egy tétel kötelező');

  const isVegszamla = Boolean((invoice as JsonRecord).vegszamla);
  const normalizedItems = items.map((item, index) => {
    const qty = Number(item.qty);
    const unitPriceNet = Number(item.unitPriceNet ?? item.unitPrice ?? 0);
    const isTAM = item.vatRate === 'TAM';
    const vatRateNum = isTAM ? 0 : Number(item.vatRate ?? 27);
    const vatRateLabel: number | string = isTAM ? 'TAM' : vatRateNum;

    if (!Number.isFinite(qty) || qty <= 0) errors.push(`Tétel ${index + 1}: qty > 0 kötelező`);
    if (!Number.isFinite(unitPriceNet) || (!isVegszamla && unitPriceNet < 0))
      errors.push(`Tétel ${index + 1}: unitPriceNet >= 0 kötelező`);
    if (!isTAM && (!Number.isFinite(vatRateNum) || vatRateNum < 0))
      errors.push(`Tétel ${index + 1}: vatRate >= 0 kötelező`);

    const net = round(qty * unitPriceNet);
    const vat = round((net * vatRateNum) / 100);
    const gross = round(net + vat);

    return {
      name: item.name || `Tétel ${index + 1}`,
      unit: item.unit || 'db',
      qty,
      unitPriceNet,
      vatRate: vatRateLabel,
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
        paymentMethod: normalizePaymentMethod(String(invoice.paymentMethod || 'bankkártya')),
        fulfillmentDate: toDateOnly(String(invoice.fulfillmentDate || '')),
        dueDate: toDateOnly(String(invoice.dueDate || '')),
        issueDate: toDateOnly(String(invoice.issueDate || '')),
        currency: String(invoice.currency || 'HUF'),
        comment: String(invoice.comment || ''),
        language: String(invoice.language || 'hu'),
        eInvoice: Boolean(invoice.eInvoice),
        elolegszamla: Boolean(invoice.elolegszamla),
        vegszamla: Boolean(invoice.vegszamla),
        rendelesSzam: String(invoice.rendelesSzam || ''),
        dijbekeroSzamlaszam: String(invoice.dijbekeroSzamlaszam || ''),
        elolegSzamlaszam: String(invoice.elolegSzamlaszam || ''),
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
    vatRate: number | string;
    net: number;
    vat: number;
    gross: number;
    comment: unknown;
  }>;
  agentKey?: string;
}) => {
  const { seller, buyer, invoice, items, agentKey = '' } = params;
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
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
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
    <rendelesSzam>${escapeXml(invoice.rendelesSzam || '')}</rendelesSzam>
    <dijbekeroSzamlaszam>${escapeXml(invoice.dijbekeroSzamlaszam || '')}</dijbekeroSzamlaszam>
    <elolegszamla>${invoice.elolegszamla ? 'true' : 'false'}</elolegszamla>
    <vegszamla>${invoice.vegszamla ? 'true' : 'false'}</vegszamla>
    <elolegSzamlaszam>${escapeXml(invoice.elolegSzamlaszam || '')}</elolegSzamlaszam>
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
    <adoszam>${escapeXml(buyer.taxNumber || '')}</adoszam>
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
      return reply.code(400).send({ success: false, message: 'Érvénytelen adatok', errors });
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
      message: 'Szerverhiba a preview-invoice feldolgozás közben.',
    });
  }
});

server.post('/api/szamlazz/create-invoice', async (request, reply) => {
  const user = await requirePermission(request, reply, 'invoices.issue');
  if (!user) return;

  try {
    const { errors, payload } = validateAndNormalizePayload(request.body as JsonRecord);
    if (errors.length > 0 || !payload) {
      return reply.code(400).send({ success: false, message: 'Érvénytelen adatok', errors });
    }

    const activeAgentKey = await getActiveAgentKey();
    const xml = buildInvoiceXml({ ...(payload as Record<string, unknown>), agentKey: activeAgentKey } as never);

    if (INVOICE_MODE !== 'live') {
      return {
        mode: 'preview',
        success: true,
        xml,
        totals: payload.totals,
      };
    }

    if (!activeAgentKey) {
      return reply.code(500).send({ success: false, message: 'Hiányzik a SZAMLAZZ_AGENT_KEY' });
    }

    const form = new FormData();
    form.append('action-xmlagentxmlfile', new Blob([xml], { type: 'application/xml' }), 'invoice.xml');

    const response = await fetch(SZAMLAZZ_ENDPOINT, { method: 'POST', body: form });
    const parsed = await parseSzamlazzResponse(response);

    if (parsed.success) {
      const invoiceBody = request.body as JsonRecord;
      await logActivity(user.id, 'invoice.szamlazz', {
        page: invoiceBody.patientId ? `patients/${String(invoiceBody.patientId)}/quotes/${String(invoiceBody.quoteId || '')}` : undefined,
        entityType: 'Invoice',
        details: { szamlazzInvoiceNumber: parsed.invoiceNumber || undefined, mode: 'live' },
        ipAddress: request.ip || undefined,
      });
    }

    return reply.code(response.ok ? 200 : 502).send({ mode: 'live', ...parsed });
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({
      mode: 'live',
      success: false,
      message: 'A számla létrehozás szerver oldalon sikertelen.',
    });
  }
});

server.post('/api/szamlazz/storno-invoice', async (request, reply) => {
  const user = await requirePermission(request, reply, 'invoices.storno');
  if (!user) return;

  try {
    const body = request.body as JsonRecord;
    const invoiceNumber = String(body.invoiceNumber || '');
    if (!invoiceNumber) {
      return reply.code(400).send({ success: false, message: 'Hiányzik a számlaszám (invoiceNumber)' });
    }

    if (INVOICE_MODE !== 'live') {
      return {
        mode: 'preview',
        success: true,
        message: 'Sztornó preview mód - nem küldtük el.',
      };
    }

    const stornoAgentKey = await getActiveAgentKey();
    if (!stornoAgentKey) {
      return reply.code(500).send({ success: false, message: 'Hiányzik a SZAMLAZZ_AGENT_KEY' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const stornoXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(stornoAgentKey)}</szamlaagentkulcs>
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

    if (parsed.success) {
      await logActivity(user.id, 'invoice.storno', {
        page: 'invoices',
        entityType: 'Invoice',
        details: { invoiceNumber },
        ipAddress: request.ip || undefined,
      });
    }

    return reply.code(response.ok ? 200 : 502).send({ mode: 'live', ...parsed });
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({
      mode: 'live',
      success: false,
      message: 'A sztornó számla létrehozás szerver oldalon sikertelen.',
    });
  }
});

server.get('/api/szamlazz/health', async () => ({ ok: true, mode: INVOICE_MODE }));

server.post('/api/szamlazz/test', async (request, reply) => {
  const user = await requirePermission(request, reply, 'settings.view');
  if (!user) return;
  const body = (request.body || {}) as JsonRecord;
  const invoiceRow = await prisma.invoiceSettings.findUnique({ where: { id: 'default' } });
  // Allow overriding mode/key from request body (for testing unsaved form values)
  const mode = String(body.mode || invoiceRow?.invoiceMode || 'test');
  const agentKey = String(body.agentKey || '') || (mode === 'live' ? invoiceRow?.agentKeyLive : invoiceRow?.agentKeyTest);
  if (!agentKey) {
    return { success: false, mode, message: `Nincs megadva ${mode === 'live' ? 'éles' : 'teszt'} Agent kulcs.` };
  }
  try {
    // Use a known valid Hungarian tax number (NAV) to test API connectivity
    const testTorzsszam = '15789934';
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <beallitasok>
        <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
    </beallitasok>
    <torzsszam>${testTorzsszam}</torzsszam>
</xmltaxpayer>`;
    const form = new FormData();
    form.append('action-szamla_agent_taxpayer', new Blob([xml], { type: 'application/xml' }), 'taxpayer.xml');
    const response = await fetch(SZAMLAZZ_ENDPOINT, { method: 'POST', body: form });
    const text = await response.text();
    const errorMatch = text.match(/<hibakod>([^<]*)<\/hibakod>/);
    const errorMsgMatch = text.match(/<hibauzenet>([^<]*)<\/hibauzenet>/);
    if (errorMatch && errorMatch[1] !== '0') {
      return { success: false, mode, message: errorMsgMatch?.[1] || `Hiba: ${errorMatch[1]}`, httpStatus: response.status };
    }
    const validityMatch = text.match(/<ns2:taxpayerValidity>(true|false)<\/ns2:taxpayerValidity>/);
    return {
      success: true,
      mode,
      message: `API kapcsolat sikeres. Adószám lekérdezés: ${validityMatch ? 'OK' : 'válasz érkezett'}`,
      httpStatus: response.status,
    };
  } catch (err) {
    return { success: false, mode, message: `Kapcsolódási hiba: ${err instanceof Error ? err.message : String(err)}` };
  }
});

server.post('/api/szamlazz/query-taxpayer', async (request, reply) => {
  const body = request.body as JsonRecord;
  const taxNumber = String(body.taxNumber || '');
  // Extract first 8 digits (törzsszám)
  const torzsszam = taxNumber.replace(/\D/g, '').slice(0, 8);
  if (torzsszam.length !== 8) {
    return reply.code(400).send({ success: false, message: 'Az adószám törzsszáma 8 számjegyből kell álljon.' });
  }
  const taxpayerAgentKey = await getActiveAgentKey();
  if (!taxpayerAgentKey) {
    return reply.code(500).send({ success: false, message: 'Hiányzik a SZAMLAZZ_AGENT_KEY' });
  }
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmltaxpayer http://www.szamlazz.hu/docs/xsds/agent/xmltaxpayer.xsd">
    <beallitasok>
        <szamlaagentkulcs>${escapeXml(taxpayerAgentKey)}</szamlaagentkulcs>
    </beallitasok>
    <torzsszam>${escapeXml(torzsszam)}</torzsszam>
</xmltaxpayer>`;
    const form = new FormData();
    form.append('action-szamla_agent_taxpayer', new Blob([xml], { type: 'application/xml' }), 'taxpayer.xml');
    const response = await fetch(SZAMLAZZ_ENDPOINT, { method: 'POST', body: form });
    const text = await response.text();

    // Parse relevant fields from XML response
    const validityMatch = text.match(/<ns2:taxpayerValidity>(true|false)<\/ns2:taxpayerValidity>/);
    const isValid = validityMatch?.[1] === 'true';

    if (!isValid) {
      return { success: true, valid: false };
    }

    const nameMatch = text.match(/<ns2:taxpayerName>([^<]+)<\/ns2:taxpayerName>/);
    const shortNameMatch = text.match(/<ns2:taxpayerShortName>([^<]+)<\/ns2:taxpayerShortName>/);

    // Parse HQ address
    const hqBlock = text.match(/<ns2:taxpayerAddressType>HQ<\/ns2:taxpayerAddressType>\s*<ns2:taxpayerAddress>([\s\S]*?)<\/ns2:taxpayerAddress>/);
    let address: { postalCode?: string; city?: string; street?: string } = {};
    if (hqBlock) {
      const addr = hqBlock[1];
      const postalCode = addr.match(/<ns3:postalCode>([^<]+)<\/ns3:postalCode>/)?.[1];
      const city = addr.match(/<ns3:city>([^<]+)<\/ns3:city>/)?.[1];
      const streetName = addr.match(/<ns3:streetName>([^<]+)<\/ns3:streetName>/)?.[1];
      const placeCategory = addr.match(/<ns3:publicPlaceCategory>([^<]+)<\/ns3:publicPlaceCategory>/)?.[1];
      const number = addr.match(/<ns3:number>([^<]+)<\/ns3:number>/)?.[1];
      const floor = addr.match(/<ns3:floor>([^<]+)<\/ns3:floor>/)?.[1];
      const door = addr.match(/<ns3:door>([^<]+)<\/ns3:door>/)?.[1];
      const streetParts = [streetName, placeCategory?.toLowerCase(), number].filter(Boolean);
      if (floor) streetParts.push(floor + (door ? '/' + door : ''));
      else if (door) streetParts.push(door);
      address = { postalCode, city, street: streetParts.join(' ') };
    }

    return {
      success: true,
      valid: true,
      taxpayerName: nameMatch?.[1] || '',
      taxpayerShortName: shortNameMatch?.[1] || '',
      address,
    };
  } catch (err) {
    return reply.code(500).send({ success: false, message: 'Adószám lekérdezés sikertelen.' });
  }
});

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
    const tranKod = extractTag('tranKod');

    const success = hibaKod === '0' && response.ok;
    return { success, jogviszony, hibaKod, hibaSzoveg, torlesNapja, kozlemeny, tranKod };
  } catch (_error) {
    return reply
      .code(502)
      .send({ success: false, hibaKod: '2', message: 'NEAK jogviszony request failed' });
  }
});

const port = Number(process.env.PORT || 4000);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@dentalquote.local').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || 'System Admin';

const ensureBootstrapAdmin = async () => {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) return;

  await createWithUniqueId(createShortId, async (id) =>
    prisma.user.create({
      data: {
        id,
        email: ADMIN_EMAIL,
        fullName: ADMIN_FULL_NAME,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        role: 'admin',
        isActive: true,
      },
    }),
  );
  server.log.info(`Bootstrap admin created: ${ADMIN_EMAIL}`);
};

const runPendingMigrations = async () => {
  // Auto-create VisitorLog table if it doesn't exist (for deployments without prisma migrate)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VisitorLog" (
        "id" TEXT NOT NULL,
        "userId" TEXT,
        "sessionId" TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "browser" TEXT,
        "os" TEXT,
        "device" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VisitorLog_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VisitorLog_createdAt_idx" ON "VisitorLog"("createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VisitorLog_userId_idx" ON "VisitorLog"("userId")`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VisitorLog_userId_fkey') THEN
          ALTER TABLE "VisitorLog" ADD CONSTRAINT "VisitorLog_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('VisitorLog migration skipped (may already exist): ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create InvoiceSettings table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "InvoiceSettings" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "invoiceType" TEXT NOT NULL DEFAULT 'paper',
        "defaultComment" TEXT NOT NULL DEFAULT '',
        "defaultVatRate" TEXT NOT NULL DEFAULT 'TAM',
        "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'bankkártya',
        "invoiceMode" TEXT NOT NULL DEFAULT 'test',
        "agentKeyLive" TEXT NOT NULL DEFAULT '',
        "agentKeyTest" TEXT NOT NULL DEFAULT '',
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InvoiceSettings_pkey" PRIMARY KEY ("id")
      )
    `);
  } catch (e) {
    server.log.warn('InvoiceSettings migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Migrate invoice data from AppSettings.data → InvoiceSettings (one-time)
  try {
    const existing = await prisma.invoiceSettings.findUnique({ where: { id: 'default' } });
    // Check if AppSettings has invoice data to migrate
    const appSettings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
    const data = appSettings?.data as Record<string, unknown> | null;
    const inv = data?.invoice as Record<string, unknown> | undefined;

    if (!existing && inv) {
      // Row doesn't exist yet but AppSettings has data → create with migrated data
      await prisma.invoiceSettings.create({
        data: {
          id: 'default',
          invoiceType: String(inv.invoiceType || 'paper'),
          defaultComment: String(inv.defaultComment || ''),
          defaultVatRate: String(inv.defaultVatRate || 'TAM'),
          defaultPaymentMethod: String(inv.defaultPaymentMethod || 'bankkártya'),
          invoiceMode: String(inv.invoiceMode || 'test'),
          agentKeyLive: String(inv.agentKeyLive || ''),
          agentKeyTest: String(inv.agentKeyTest || ''),
        },
      });
      server.log.info('Migrated invoice data from AppSettings → InvoiceSettings');
    } else if (!existing) {
      // No row and no AppSettings data → seed from .env with test mode
      await prisma.invoiceSettings.create({
        data: {
          id: 'default',
          invoiceMode: 'test',
          agentKeyTest: AGENT_KEY_TEST_ENV,
          agentKeyLive: AGENT_KEY_LIVE_ENV,
        },
      });
      if (AGENT_KEY_TEST_ENV || AGENT_KEY_LIVE_ENV) {
        server.log.info('Created default InvoiceSettings from .env (test mode)');
      }
    } else if (existing && inv && !existing.defaultComment && !existing.agentKeyLive && !existing.agentKeyTest) {
      // Row exists with empty defaults but AppSettings has real data → update
      await prisma.invoiceSettings.update({
        where: { id: 'default' },
        data: {
          invoiceType: String(inv.invoiceType || existing.invoiceType),
          defaultComment: String(inv.defaultComment || existing.defaultComment),
          defaultVatRate: String(inv.defaultVatRate || existing.defaultVatRate),
          defaultPaymentMethod: String(inv.defaultPaymentMethod || existing.defaultPaymentMethod),
          invoiceMode: String(inv.invoiceMode || existing.invoiceMode),
          agentKeyLive: String(inv.agentKeyLive || existing.agentKeyLive),
          agentKeyTest: String(inv.agentKeyTest || existing.agentKeyTest),
        },
      });
      server.log.info('Updated InvoiceSettings from AppSettings data');
    }

    // Strip invoice & doctors from AppSettings.data (they have dedicated tables)
    if (data && (data.invoice || data.doctors)) {
      const { invoice: _i, doctors: _d, ...cleanData } = data;
      await prisma.appSettings.update({
        where: { id: 'default' },
        data: { data: cleanData as never },
      });
      server.log.info('Stripped invoice/doctors from AppSettings.data');
    }
  } catch (e) {
    server.log.warn('InvoiceSettings seed/migrate skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create NeakLevel table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NeakLevel" (
        "neakLevelCode" TEXT NOT NULL,
        "neakLevelInfoHu" TEXT NOT NULL,
        "neakLevelInfoEn" TEXT NOT NULL DEFAULT '',
        "neakLevelInfoDe" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "NeakLevel_pkey" PRIMARY KEY ("neakLevelCode")
      )
    `);
  } catch (e) {
    server.log.warn('NeakLevel migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create NeakSpecial table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NeakSpecial" (
        "neakSpecialMark" INTEGER NOT NULL,
        "neakSpecialMarkCode" TEXT NOT NULL DEFAULT '',
        "neakSpecialDescHu" TEXT NOT NULL,
        "neakSpecialDescEn" TEXT NOT NULL DEFAULT '',
        "neakSpecialDescDe" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "NeakSpecial_pkey" PRIMARY KEY ("neakSpecialMark")
      )
    `);
  } catch (e) {
    server.log.warn('NeakSpecial migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create NeakTerkat table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NeakTerkat" (
        "neakTerKatCode" TEXT NOT NULL,
        "neakTerKatInfoHu" TEXT NOT NULL,
        "neakTerKatInfoEn" TEXT NOT NULL DEFAULT '',
        "neakTerKatInfoDe" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "NeakTerkat_pkey" PRIMARY KEY ("neakTerKatCode")
      )
    `);
  } catch (e) {
    server.log.warn('NeakTerkat migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create NeakCatalogItem table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NeakCatalogItem" (
        "neakCatalogItemId" TEXT NOT NULL,
        "neakCode" TEXT NOT NULL,
        "neakNameHu" TEXT NOT NULL,
        "neakNameEn" TEXT NOT NULL DEFAULT '',
        "neakNameDe" TEXT NOT NULL DEFAULT '',
        "catalogCategoryId" TEXT NOT NULL,
        "neakPoints" INTEGER NOT NULL DEFAULT 0,
        "neakMinimumTimeMin" INTEGER NOT NULL DEFAULT 0,
        "isFullMouth" BOOLEAN NOT NULL DEFAULT false,
        "isTooth" BOOLEAN NOT NULL DEFAULT false,
        "isArch" BOOLEAN NOT NULL DEFAULT false,
        "isQuadrant" BOOLEAN NOT NULL DEFAULT false,
        "isSurface" BOOLEAN NOT NULL DEFAULT false,
        "surfaceNum" TEXT NOT NULL DEFAULT '',
        "neakMaxQtyPerDay" INTEGER,
        "neakToothType" TEXT NOT NULL DEFAULT '',
        "neakTimeLimitMonths" INTEGER,
        "neakTimeLimitDays" INTEGER,
        "neakTimeLimitQty" INTEGER,
        "neakTimeLimitSchoolStart" TEXT NOT NULL DEFAULT '',
        "neakTimeLimitSchoolEnd" TEXT NOT NULL DEFAULT '',
        "neakLevelA" BOOLEAN NOT NULL DEFAULT false,
        "neakLevelS" BOOLEAN NOT NULL DEFAULT false,
        "neakLevelT" BOOLEAN NOT NULL DEFAULT false,
        "neakLevelE" BOOLEAN NOT NULL DEFAULT false,
        "neakTerKatCodes" TEXT NOT NULL DEFAULT '',
        "neakNotBillableWithCodes" TEXT NOT NULL DEFAULT '',
        "neakNotBillableIfRecentCodes" TEXT NOT NULL DEFAULT '',
        "neakBillableWithCodes" TEXT NOT NULL DEFAULT '',
        "neakSpecialMark" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "catalogUnit" TEXT NOT NULL DEFAULT 'db',
        "milkToothOnly" BOOLEAN NOT NULL DEFAULT false,
        "svgLayer" TEXT NOT NULL DEFAULT '',
        "hasLayer" BOOLEAN NOT NULL DEFAULT false,
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "NeakCatalogItem_pkey" PRIMARY KEY ("neakCatalogItemId")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NeakCatalogItem_neakCode_idx" ON "NeakCatalogItem"("neakCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NeakCatalogItem_catalogCategoryId_idx" ON "NeakCatalogItem"("catalogCategoryId")`);
  } catch (e) {
    server.log.warn('NeakCatalogItem migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Rename neakSectionId -> catalogCategoryId in NeakCatalogItem (if old column exists)
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NeakCatalogItem' AND column_name = 'neakSectionId') THEN
          ALTER TABLE "NeakCatalogItem" RENAME COLUMN "neakSectionId" TO "catalogCategoryId";
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('NeakCatalogItem rename neakSectionId skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add isDeleted column to NeakCatalogItem if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NeakCatalogItem' AND column_name = 'isDeleted') THEN
          ALTER TABLE "NeakCatalogItem" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('NeakCatalogItem add isDeleted skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add isFullMouth column to NeakCatalogItem if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NeakCatalogItem' AND column_name = 'isFullMouth') THEN
          ALTER TABLE "NeakCatalogItem" ADD COLUMN "isFullMouth" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('NeakCatalogItem add isFullMouth skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create NeakSettings table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NeakSettings" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "dentalPraxisId" TEXT NOT NULL DEFAULT 'DP001',
        "neakOjoteKey" TEXT NOT NULL DEFAULT '',
        "neakWssUser" TEXT NOT NULL DEFAULT '',
        "neakWssPassword" TEXT NOT NULL DEFAULT '',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NeakSettings_pkey" PRIMARY KEY ("id")
      )
    `);
  } catch (e) {
    server.log.warn('NeakSettings migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Seed default NeakSettings row from .env if missing
  try {
    const existing = await prisma.neakSettings.findUnique({ where: { id: 'default' } });
    if (!existing) {
      await prisma.neakSettings.create({
        data: {
          id: 'default',
          neakOjoteKey: process.env.NEAK_OJOTE_KEY || '',
          neakWssUser: process.env.NEAK_WSS_USER || '',
          neakWssPassword: process.env.NEAK_WSS_PASS || '',
        },
      });
      server.log.info('Created default NeakSettings row from .env');
    }
  } catch (e) {
    server.log.warn('NeakSettings seed skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create NeakDepartment table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NeakDepartment" (
        "id" TEXT NOT NULL,
        "dentalPraxisId" TEXT NOT NULL DEFAULT 'DP001',
        "neakDepartmentNameHu" TEXT NOT NULL,
        "neakDepartmentNameEn" TEXT NOT NULL DEFAULT '',
        "neakDepartmentNameDe" TEXT NOT NULL DEFAULT '',
        "neakDepartmentCode" TEXT NOT NULL,
        "neakDepartmentHours" INTEGER NOT NULL,
        "neakDepartmentMaxPoints" INTEGER NOT NULL,
        "neakDepartmentPrefix" TEXT NOT NULL DEFAULT '',
        "neakDepartmentLevel" TEXT NOT NULL DEFAULT 'A',
        "neakDepartmentIndicator" TEXT NOT NULL DEFAULT 'adult',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NeakDepartment_pkey" PRIMARY KEY ("id")
      )
    `);
  } catch (e) {
    server.log.warn('NeakDepartment migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add isHungarianPhone column to Patient if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Patient' AND column_name = 'isHungarianPhone') THEN
          ALTER TABLE "Patient" ADD COLUMN "isHungarianPhone" BOOLEAN NOT NULL DEFAULT true;
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('Patient add isHungarianPhone skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add treatmentArchive column to Patient if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Patient' AND column_name = 'treatmentArchive') THEN
          ALTER TABLE "Patient" ADD COLUMN "treatmentArchive" TEXT;
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('Patient add treatmentArchive skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create Country table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Country" (
        "countryId" INTEGER NOT NULL,
        "countryNameHu" TEXT NOT NULL,
        "countryNameEn" TEXT NOT NULL DEFAULT '',
        "countryNameDe" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "Country_pkey" PRIMARY KEY ("countryId")
      )
    `);
  } catch (e) {
    server.log.warn('Country migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create AppointmentType table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppointmentType" (
        "typeId" TEXT NOT NULL,
        "nameHu" TEXT NOT NULL,
        "nameEn" TEXT NOT NULL DEFAULT '',
        "nameDe" TEXT NOT NULL DEFAULT '',
        "color" TEXT NOT NULL,
        "defaultDurationMin" INTEGER NOT NULL,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("typeId")
      )
    `);
  } catch (e) {
    server.log.warn('AppointmentType migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create Appointment table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Appointment" (
        "appointmentId" TEXT NOT NULL,
        "patientId" TEXT,
        "chairIndex" INTEGER NOT NULL DEFAULT 0,
        "startDateTime" TIMESTAMP(3) NOT NULL,
        "endDateTime" TIMESTAMP(3) NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "appointmentTypeId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'scheduled',
        "color" TEXT,
        "notes" TEXT,
        "isArchived" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdByUserId" TEXT,
        "googleEventId" TEXT,
        CONSTRAINT "Appointment_pkey" PRIMARY KEY ("appointmentId"),
        CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Appointment_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("typeId") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Appointment_startDateTime_idx" ON "Appointment"("startDateTime")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Appointment_endDateTime_idx" ON "Appointment"("endDateTime")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Appointment_appointmentTypeId_idx" ON "Appointment"("appointmentTypeId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status")`);
  } catch (e) {
    server.log.warn('Appointment migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add recurrence columns to Appointment if they don't exist
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Appointment' AND column_name = 'recurrenceRule') THEN
          ALTER TABLE "Appointment" ADD COLUMN "recurrenceRule" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Appointment' AND column_name = 'recurrenceParentId') THEN
          ALTER TABLE "Appointment" ADD COLUMN "recurrenceParentId" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Appointment' AND column_name = 'isRecurrenceException') THEN
          ALTER TABLE "Appointment" ADD COLUMN "isRecurrenceException" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Appointment_recurrenceParentId_idx" ON "Appointment"("recurrenceParentId")`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_recurrenceParentId_fkey') THEN
          ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_recurrenceParentId_fkey"
            FOREIGN KEY ("recurrenceParentId") REFERENCES "Appointment"("appointmentId") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);
  } catch (e) {
    server.log.warn('Appointment recurrence migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Seed default appointment types
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "AppointmentType" ("typeId", "nameHu", "nameEn", "nameDe", "color", "defaultDurationMin", "isSystem", "isActive", "sortOrder")
      VALUES
        ('atype001', 'Kontroll', 'Check-up', 'Kontrolle', '#3B82F6', 30, true, true, 1),
        ('atype002', 'Kezelés', 'Treatment', 'Behandlung', '#10B981', 60, true, true, 2),
        ('atype003', 'Konzultáció', 'Consultation', 'Beratung', '#8B5CF6', 30, true, true, 3),
        ('atype004', 'Sürgősségi', 'Emergency', 'Notfall', '#EF4444', 30, true, true, 4),
        ('atype005', 'Fogkő-eltávolítás', 'Scaling', 'Zahnsteinentfernung', '#14B8A6', 45, true, true, 5),
        ('atype006', 'Implantátum', 'Implant', 'Implantat', '#F59E0B', 90, true, true, 6)
      ON CONFLICT ("typeId") DO NOTHING
    `);
  } catch (e) {
    server.log.warn('AppointmentType seed skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create AppointmentChair table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppointmentChair" (
        "chairId" TEXT NOT NULL,
        "chairNr" INTEGER NOT NULL,
        "chairNameHu" TEXT NOT NULL,
        "chairNameEn" TEXT NOT NULL DEFAULT '',
        "chairNameDe" TEXT NOT NULL DEFAULT '',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        CONSTRAINT "AppointmentChair_pkey" PRIMARY KEY ("chairId")
      )
    `);
  } catch (e) {
    server.log.warn('AppointmentChair migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create SmsSettings table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SmsSettings" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "twilioAccountSid" TEXT NOT NULL DEFAULT '',
        "twilioAuthToken" TEXT NOT NULL DEFAULT '',
        "twilioPhoneNumber" TEXT NOT NULL DEFAULT '',
        "twilioWebhookUrl" TEXT NOT NULL DEFAULT '',
        "isEnabled" BOOLEAN NOT NULL DEFAULT false,
        "clinicName" TEXT NOT NULL DEFAULT '',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
      )
    `);
  } catch (e) {
    server.log.warn('SmsSettings migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add customTemplates column to SmsSettings if missing
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "SmsSettings" ADD COLUMN IF NOT EXISTS "customTemplates" TEXT NOT NULL DEFAULT '[]'`);
  } catch (e) {
    server.log.warn('SmsSettings customTemplates column skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create SmsLog table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SmsLog" (
        "id" TEXT NOT NULL,
        "twilioSid" TEXT,
        "toNumber" TEXT NOT NULL,
        "fromNumber" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "templateId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "patientId" TEXT,
        "patientName" TEXT,
        "context" TEXT,
        "errorCode" TEXT,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SmsLog_patientId_idx" ON "SmsLog"("patientId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SmsLog_twilioSid_idx" ON "SmsLog"("twilioSid")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SmsLog_status_idx" ON "SmsLog"("status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SmsLog_createdAt_idx" ON "SmsLog"("createdAt")`);
  } catch (e) {
    server.log.warn('SmsLog migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create EmailSettings table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmailSettings" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "smtpHost" TEXT NOT NULL DEFAULT '',
        "smtpPort" INTEGER NOT NULL DEFAULT 587,
        "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
        "smtpUser" TEXT NOT NULL DEFAULT '',
        "smtpPass" TEXT NOT NULL DEFAULT '',
        "fromEmail" TEXT NOT NULL DEFAULT '',
        "fromName" TEXT NOT NULL DEFAULT '',
        "isEnabled" BOOLEAN NOT NULL DEFAULT false,
        "clinicName" TEXT NOT NULL DEFAULT '',
        "customTemplates" TEXT NOT NULL DEFAULT '[]',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id")
      )
    `);
  } catch (e) {
    server.log.warn('EmailSettings migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create EmailLog table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmailLog" (
        "id" TEXT NOT NULL,
        "toEmail" TEXT NOT NULL,
        "fromEmail" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "templateId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "patientId" TEXT,
        "patientName" TEXT,
        "context" TEXT,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailLog_patientId_idx" ON "EmailLog"("patientId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt")`);
  } catch (e) {
    server.log.warn('EmailLog migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Add googleCalendarId column to Appointment if missing
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT`);
  } catch (e) {
    server.log.warn('Appointment googleCalendarId column skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create GoogleCalendarSync table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GoogleCalendarSync" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "clientId" TEXT NOT NULL DEFAULT '',
        "clientSecret" TEXT NOT NULL DEFAULT '',
        "redirectUri" TEXT NOT NULL DEFAULT '',
        "accessToken" TEXT NOT NULL DEFAULT '',
        "refreshToken" TEXT NOT NULL DEFAULT '',
        "tokenExpiresAt" TIMESTAMP(3),
        "isEnabled" BOOLEAN NOT NULL DEFAULT false,
        "syncMode" TEXT NOT NULL DEFAULT 'bidirectional',
        "pollIntervalMin" INTEGER NOT NULL DEFAULT 5,
        "lastSyncAt" TIMESTAMP(3),
        "syncToken" TEXT,
        "chairCalendarMap" TEXT NOT NULL DEFAULT '[]',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GoogleCalendarSync_pkey" PRIMARY KEY ("id")
      )
    `);
    // Add credential columns if table already existed without them
    await prisma.$executeRawUnsafe(`ALTER TABLE "GoogleCalendarSync" ADD COLUMN IF NOT EXISTS "clientId" TEXT NOT NULL DEFAULT ''`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "GoogleCalendarSync" ADD COLUMN IF NOT EXISTS "clientSecret" TEXT NOT NULL DEFAULT ''`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "GoogleCalendarSync" ADD COLUMN IF NOT EXISTS "redirectUri" TEXT NOT NULL DEFAULT ''`);
  } catch (e) {
    server.log.warn('GoogleCalendarSync migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Auto-create GoogleCalendarLog table if it doesn't exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GoogleCalendarLog" (
        "id" TEXT NOT NULL,
        "direction" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "appointmentId" TEXT,
        "googleEventId" TEXT,
        "chairId" TEXT,
        "calendarId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'success',
        "errorMessage" TEXT,
        "details" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GoogleCalendarLog_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GoogleCalendarLog_createdAt_idx" ON "GoogleCalendarLog"("createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GoogleCalendarLog_appointmentId_idx" ON "GoogleCalendarLog"("appointmentId")`);
  } catch (e) {
    server.log.warn('GoogleCalendarLog migration skipped: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Seed default chairs
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "AppointmentChair" ("chairId", "chairNr", "chairNameHu", "chairNameEn", "chairNameDe", "isActive", "updatedAt")
      VALUES
        ('chair-01', 1, '1. szék', '1st chair', '1. Stuhl', true, NOW()),
        ('chair-02', 2, '2. szék', '2nd chair', '2. Stuhl', true, NOW())
      ON CONFLICT ("chairId") DO NOTHING
    `);
  } catch (e) {
    server.log.warn('AppointmentChair seed skipped: ' + (e instanceof Error ? e.message : String(e)));
  }
};

// ── Seed settings from env vars (first-run only) ──────────────────────

const seedSettingsFromEnv = async () => {
  // SMS (Twilio) — seed if DB record missing or has empty accountSid
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
  if (twilioSid) {
    try {
      const existing = await prisma.smsSettings.findUnique({ where: { id: 'default' } });
      if (!existing || !existing.twilioAccountSid) {
        await prisma.smsSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            twilioAccountSid: twilioSid,
            twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
            twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
            isEnabled: true,
          },
          update: {
            twilioAccountSid: twilioSid,
            twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
            twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
            isEnabled: true,
          },
        });
        server.log.info('SMS settings seeded from env vars');
      }
    } catch (e) {
      server.log.warn('SMS settings seed failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Email (SMTP) — seed if DB record missing or has empty smtpHost
  const smtpHost = process.env.SMTP_HOST || '';
  if (smtpHost) {
    try {
      const existing = await prisma.emailSettings.findUnique({ where: { id: 'default' } });
      if (!existing || !existing.smtpHost) {
        await prisma.emailSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            smtpHost,
            smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
            smtpSecure: process.env.SMTP_SECURE === 'true',
            smtpUser: process.env.SMTP_USER || '',
            smtpPass: process.env.SMTP_PASS || '',
            fromEmail: process.env.SMTP_FROM_EMAIL || '',
            fromName: process.env.SMTP_FROM_NAME || '',
            isEnabled: true,
          },
          update: {
            smtpHost,
            smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
            smtpSecure: process.env.SMTP_SECURE === 'true',
            smtpUser: process.env.SMTP_USER || '',
            smtpPass: process.env.SMTP_PASS || '',
            fromEmail: process.env.SMTP_FROM_EMAIL || '',
            fromName: process.env.SMTP_FROM_NAME || '',
            isEnabled: true,
          },
        });
        server.log.info('Email settings seeded from env vars');
      }
    } catch (e) {
      server.log.warn('Email settings seed failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }
};

// Export for testing — tests use server.inject() without calling start()
export { server, prisma, hashPassword, createShortId, buildPermissionMap };
export type { PermissionKey, AuthenticatedUser };

const start = async () => {
  try {
    await prisma.$connect();
    await runPendingMigrations();
    await seedSettingsFromEnv();
    await ensureBootstrapAdmin();
    await server.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

// Only start when run directly (not imported by tests)
const isDirectRun = !process.env.VITEST;
if (isDirectRun) start();

