-- Shorten UserPermissionOverride.id to "UP" + first 8 hex chars of existing UUID
UPDATE "UserPermissionOverride" SET "id" = 'UP' || LEFT(REPLACE("id", '-', ''), 8);
