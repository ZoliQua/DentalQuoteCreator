-- Shorten NeakCheck.id to "NC" + first 10 hex chars of existing ID
UPDATE "NeakCheck" SET "id" = 'NC' || LEFT(REPLACE("id", '-', ''), 10);
