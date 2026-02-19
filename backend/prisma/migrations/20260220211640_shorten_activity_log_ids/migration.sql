-- Shorten UserActivityLog.id to "UA" + first 8 hex chars of existing UUID
UPDATE "UserActivityLog" SET "id" = 'UA' || LEFT(REPLACE("id", '-', ''), 8);
