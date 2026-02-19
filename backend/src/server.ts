import 'dotenv/config';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from './db.js';

type JsonRecord = Record<string, unknown>;
type PermissionMap = Record<PermissionKey, boolean>;

const scrypt = promisify(scryptCallback);
const createShortId = (): string => randomBytes(4).toString('hex');
const createSessionId = (): string => 'AS' + randomBytes(4).toString('hex');
const createAuditId = (): string => 'PA' + randomBytes(4).toString('hex');
const createActivityId = (): string => 'UA' + randomBytes(4).toString('hex');
const createPermOverrideId = (): string => 'UP' + randomBytes(4).toString('hex');
const createNeakCheckId = (): string => 'NC' + randomBytes(5).toString('hex');

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
  'invoices.issue',
  'invoices.storno',
  'catalog.view',
  'catalog.create',
  'catalog.update',
  'catalog.delete',
  'pricelist.view',
  'pricelist.create',
  'pricelist.update',
  'pricelist.delete',
  'pricelist.category.create',
  'pricelist.category.delete',
  'pricelist.restore',
  'pricelist.category.restore',
  'patients.update',
  'patients.create',
  'patients.delete',
  'lab.view',
  'settings.view',
  'data.view',
  'data.browse',
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
  doctors: [{ id: 'doc-1', name: 'Dr. Dul Zoltán', stampNumber: '' }],
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
  doctor: ['quotes.view', 'quotes.create', 'quotes.delete', 'invoices.view', 'invoices.issue', 'invoices.storno', 'patients.create', 'patients.update', 'pricelist.view', 'catalog.view'],
  assistant: ['quotes.view', 'quotes.create', 'quotes.delete', 'invoices.view', 'invoices.issue', 'invoices.storno', 'patients.create', 'patients.update', 'patients.delete', 'pricelist.view', 'catalog.view'],
  user: [],
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

const server = Fastify({ logger: true });

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: AuthenticatedUser | null;
    sessionId: string | null;
  }
}

const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS || 14);
const PUBLIC_ROUTE_PATTERNS = new Set(['/health', '/db-health', '/auth/login']);

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
  'PermissionAuditLog',
  'UserActivityLog',
  'Doctor',
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

  const whereClauses: string[] = [];
  for (let i = 0; i < pkColumns.length; i++) {
    whereClauses.push(`"${pkColumns[i]}" = $${paramIdx}`);
    params.push(pkValues[i]);
    paramIdx++;
  }

  const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
  await prisma.$executeRawUnsafe(sql, ...params);

  return { success: true };
});

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

  const whereClauses: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < pkColumns.length; i++) {
    whereClauses.push(`"${pkColumns[i]}" = $${i + 1}`);
    params.push(pkValues[i]);
  }

  const sql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')}`;
  await prisma.$executeRawUnsafe(sql, ...params);

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

  await logActivity(user.id, 'login', { ipAddress: request.ip || undefined });

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

  await logActivity(currentUser.id, 'logout', { ipAddress: request.ip || undefined });

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
  const [patients, catalog, quotes, settingsRow, dentalStatusSnapshots, invoices, neakChecks, pricelists, pricelistCategories, doctors] =
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
      createdAt: body.createdAt ? toDate(String(body.createdAt)) : new Date(),
      updatedAt: body.updatedAt ? toDate(String(body.updatedAt)) : new Date(),
      isArchived: Boolean(body.isArchived),
      createdByUserId: user.id,
    },
  });

  await logActivity(user.id, 'patient.create', {
    entityType: 'Patient',
    entityId: patient.patientId,
    details: { patientName: `${patient.lastName} ${patient.firstName}` },
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
  const user = await requirePermission(request, reply, 'patients.delete');
  if (!user) return;

  const { patientId } = request.params as { patientId: string };
  try {
    const patient = await prisma.patient.update({
      where: { patientId },
      data: { isArchived: true, updatedAt: new Date() },
    });

    await logActivity(user.id, 'patient.delete', {
      entityType: 'Patient',
      entityId: patientId,
      details: { patientName: `${patient.lastName} ${patient.firstName}` },
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
  const catalogCategoryIdValue = body.catalogCategoryId ? String(body.catalogCategoryId) : null;
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
      catalogCategory: String(body.catalogCategory || ''),
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
      catalogCategory: String(body.catalogCategory || ''),
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
  const user = await requirePermission(request, reply, 'catalog.update');
  if (!user) return;

  const { catalogItemId } = request.params as { catalogItemId: string };
  const body = request.body as JsonRecord;
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
        catalogCategory:
          body.catalogCategory === undefined ? undefined : String(body.catalogCategory),
        catalogCategoryId: body.catalogCategoryId === undefined ? undefined : (body.catalogCategoryId ? String(body.catalogCategoryId) : null),
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
    await prisma.priceListCatalogItem.delete({ where: { catalogItemId } });
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
          catalogCategory: String(item.catalogCategory || ''),
          catalogCategoryId: item.catalogCategoryId ? String(item.catalogCategoryId) : null,
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
        catalogCategory: String(item.catalogCategory || ''),
        catalogCategoryId: item.catalogCategoryId ? String(item.catalogCategoryId) : null,
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
      isUserLocked: Boolean(body.isUserLocked),
      listOfUsers: toInputJson(body.listOfUsers || []),
    },
  });
  return reply.code(201).send(item);
});

server.patch('/pricelists/:id', async (request, reply) => {
  const user = await requirePermission(request, reply, 'pricelist.update');
  if (!user) return;

  const { id } = request.params as { id: string };
  const body = request.body as JsonRecord;
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
  const user = await requirePermission(request, reply, 'catalog.view');
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
  const user = await requirePermission(request, reply, 'pricelist.update');
  if (!user) return;

  const { id } = request.params as { id: string };
  const body = request.body as JsonRecord;
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
    entityType: 'Quote',
    entityId: quoteId,
    details: { patientId },
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
        quoteName: body.quoteName === undefined ? undefined : (body.quoteName ? String(body.quoteName) : null),
        quoteNumber: body.quoteNumber === undefined ? undefined : (body.quoteNumber ? String(body.quoteNumber) : null),
        validUntil: body.validUntil === undefined ? undefined : (body.validUntil ? String(body.validUntil) : null),
        currency: body.currency === undefined ? undefined : (body.currency ? String(body.currency) : null),
        doctorId: body.doctorId === undefined ? undefined : (body.doctorId ? String(body.doctorId) : null),
      },
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
      entityType: 'Quote',
      entityId: quoteId,
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
  const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
  const result = parseJsonObject(settings?.data, defaultSettings);
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
  return result;
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

server.put('/invoices/:invoiceId', async (request, reply) => {
  const user = await requirePermission(request, reply, 'invoices.issue');
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
    entityType: 'Invoice',
    entityId: invoiceId,
  });

  return { status: 'ok', id: invoiceId };
});

server.delete('/invoices', async () => {
  await prisma.invoice.deleteMany({});
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
server.get('/doctors', async () => {
  return prisma.doctor.findMany({ orderBy: { doctorId: 'asc' } });
});

server.post('/doctors', async (request, reply) => {
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

server.put('/neak-checks/:id', async (request) => {
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
  const body = request.body as ExportData;
  if (!body || !Array.isArray(body.patients) || !Array.isArray(body.catalog) || !Array.isArray(body.quotes)) {
    return reply.code(400).send({ message: 'Invalid import payload' });
  }

  const importUserId = request.currentUser?.id || null;

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
          catalogCategory: String(rawCatalog.catalogCategory || ''),
          catalogCategoryId: rawCatalog.catalogCategoryId ? String(rawCatalog.catalogCategoryId) : null,
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
    const vatRate = Number(item.vatRate ?? 27);

    if (!Number.isFinite(qty) || qty <= 0) errors.push(`Tétel ${index + 1}: qty > 0 kötelező`);
    if (!Number.isFinite(unitPriceNet) || (!isVegszamla && unitPriceNet < 0))
      errors.push(`Tétel ${index + 1}: unitPriceNet >= 0 kötelező`);
    if (!Number.isFinite(vatRate) || vatRate < 0)
      errors.push(`Tétel ${index + 1}: vatRate >= 0 kötelező`);

    const net = round(qty * unitPriceNet);
    const vat = round((net * vatRate) / 100);
    const gross = round(net + vat);

    return {
      name: item.name || `Tétel ${index + 1}`,
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
      return reply.code(500).send({ success: false, message: 'Hiányzik a SZAMLAZZ_AGENT_KEY' });
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

    if (!AGENT_KEY) {
      return reply.code(500).send({ success: false, message: 'Hiányzik a SZAMLAZZ_AGENT_KEY' });
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

    if (parsed.success) {
      await logActivity(user.id, 'invoice.storno', {
        entityType: 'Invoice',
        details: { invoiceNumber },
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

const start = async () => {
  try {
    await prisma.$connect();
    await ensureBootstrapAdmin();
    await server.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
