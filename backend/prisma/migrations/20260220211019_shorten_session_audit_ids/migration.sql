-- Shorten AuthSession.id to "AS" + first 8 chars of existing UUID
UPDATE "AuthSession" SET "id" = 'AS' || LEFT(REPLACE("id", '-', ''), 8);

-- Shorten PermissionAuditLog.id to "PA" + first 8 chars of existing UUID
UPDATE "PermissionAuditLog" SET "id" = 'PA' || LEFT(REPLACE("id", '-', ''), 8);
