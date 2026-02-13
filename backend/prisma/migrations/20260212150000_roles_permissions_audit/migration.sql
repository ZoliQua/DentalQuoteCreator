-- Add new UserRole enum values (safe ADD VALUE, no drop+recreate)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'receptionist';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'beta_tester';

-- PermissionAuditLog
CREATE TABLE "PermissionAuditLog" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "key" TEXT NOT NULL,
  "oldValue" BOOLEAN NOT NULL,
  "newValue" BOOLEAN NOT NULL,

  CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PermissionAuditLog_targetUserId_idx" ON "PermissionAuditLog"("targetUserId");
CREATE INDEX "PermissionAuditLog_changedAt_idx" ON "PermissionAuditLog"("changedAt");

ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserActivityLog
CREATE TABLE "UserActivityLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "page" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,

  CONSTRAINT "UserActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserActivityLog_userId_idx" ON "UserActivityLog"("userId");
CREATE INDEX "UserActivityLog_createdAt_idx" ON "UserActivityLog"("createdAt");

ALTER TABLE "UserActivityLog" ADD CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- createdByUserId on Patient, Quote, Invoice
ALTER TABLE "Patient" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Quote" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "createdByUserId" TEXT;
