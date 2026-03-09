import { server, prisma, hashPassword, createShortId } from '../../src/server.js';
import type { UserRole } from '@prisma/client';

/**
 * Create a test user and return an auth token for API calls.
 */
export async function createTestUser(
  role: UserRole = 'admin',
  email?: string
): Promise<{ userId: string; token: string }> {
  const userEmail = email || `test-${role}-${Date.now()}@test.local`;
  const password = 'TestPass123!';
  const userId = createShortId();

  await prisma.user.create({
    data: {
      id: userId,
      email: userEmail,
      fullName: `Test ${role}`,
      passwordHash: await hashPassword(password),
      role,
      isActive: true,
    },
  });

  // Login to get session token
  const loginRes = await server.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: userEmail, password },
  });

  const body = loginRes.json() as { token?: string };
  if (!body.token) {
    throw new Error(`Login failed for ${userEmail}: ${loginRes.body}`);
  }

  return { userId, token: body.token };
}

/**
 * Make an authenticated request using server.inject()
 */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Cleanup test users by email pattern
 */
export async function cleanupTestUsers() {
  // Delete sessions first (FK constraint)
  await prisma.authSession.deleteMany({
    where: { user: { email: { contains: '@test.local' } } },
  });
  await prisma.userActivityLog.deleteMany({
    where: { user: { email: { contains: '@test.local' } } },
  });
  await prisma.permissionAuditLog.deleteMany({
    where: { changedByUser: { email: { contains: '@test.local' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: '@test.local' } },
  });
}
