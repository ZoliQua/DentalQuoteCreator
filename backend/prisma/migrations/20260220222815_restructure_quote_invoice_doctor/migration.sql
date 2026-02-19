-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "fulfillmentDate" TEXT,
ADD COLUMN     "invoiceType" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "quoteNumber" TEXT,
ADD COLUMN     "szamlazzInvoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "doctorId" TEXT,
ADD COLUMN     "quoteName" TEXT,
ADD COLUMN     "quoteNumber" TEXT,
ADD COLUMN     "validUntil" TEXT;

-- CreateTable
CREATE TABLE "Doctor" (
    "doctorId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "doctorNum" TEXT NOT NULL DEFAULT '',
    "doctorEESZTId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("doctorId")
);

-- ============================================================
-- 2a. Seed Doctor table from AppSettings.data->doctors[]
-- ============================================================
DO $$
DECLARE
  _settings_data jsonb;
  _doctors jsonb;
  _doc jsonb;
  _i int := 0;
  _doc_id text;
  _old_id text;
BEGIN
  SELECT data::jsonb INTO _settings_data
  FROM "AppSettings"
  WHERE id = 'default';

  IF _settings_data IS NOT NULL AND _settings_data ? 'doctors' THEN
    _doctors := _settings_data->'doctors';
    FOR _i IN 0..jsonb_array_length(_doctors) - 1 LOOP
      _doc := _doctors->_i;
      _doc_id := 'DOC' || LPAD((_i + 1)::text, 4, '0');
      INSERT INTO "Doctor" ("doctorId", "doctorName", "doctorNum", "createdAt")
      VALUES (
        _doc_id,
        COALESCE(_doc->>'name', ''),
        COALESCE(_doc->>'stampNumber', ''),
        NOW()
      )
      ON CONFLICT ("doctorId") DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ============================================================
-- 2b. Populate Quote columns from data JSON
-- ============================================================
UPDATE "Quote" SET
  "quoteName"   = data::jsonb->>'quoteName',
  "quoteNumber" = data::jsonb->>'quoteNumber',
  "validUntil"  = data::jsonb->>'validUntil',
  "currency"    = data::jsonb->>'currency',
  "doctorId"    = data::jsonb->>'doctorId';

-- ============================================================
-- 2c. Populate Invoice columns from data JSON
-- ============================================================
UPDATE "Invoice" SET
  "paymentMethod"         = data::jsonb->>'paymentMethod',
  "fulfillmentDate"       = data::jsonb->>'fulfillmentDate',
  "szamlazzInvoiceNumber" = data::jsonb->>'szamlazzInvoiceNumber',
  "quoteNumber"           = data::jsonb->>'quoteNumber',
  "invoiceType"           = data::jsonb->>'invoiceType';

-- ============================================================
-- 2d. Quote ID renaming: oldId -> {patientId}q{NNN}
-- ============================================================
-- Create temp mapping table
CREATE TEMP TABLE _quote_id_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL);

INSERT INTO _quote_id_map (old_id, new_id)
SELECT
  "quoteId" AS old_id,
  "patientId" || 'q' || LPAD(ROW_NUMBER() OVER (PARTITION BY "patientId" ORDER BY "createdAt")::text, 3, '0') AS new_id
FROM "Quote";

-- Step 1: Update Invoice.quoteId references using the mapping
UPDATE "Invoice" inv
SET "quoteId" = m.new_id
FROM _quote_id_map m
WHERE inv."quoteId" = m.old_id;

-- Step 2: Update Invoice data JSON quoteId references
UPDATE "Invoice" inv
SET data = jsonb_set(inv.data::jsonb, '{quoteId}', to_jsonb(m.new_id))
FROM _quote_id_map m
WHERE inv.data::jsonb->>'quoteId' = m.old_id;

-- Step 3: Update Quote data JSON quoteId
UPDATE "Quote" q
SET data = jsonb_set(q.data::jsonb, '{quoteId}', to_jsonb(m.new_id))
FROM _quote_id_map m
WHERE q."quoteId" = m.old_id;

-- Step 4: Update Quote PK - need to drop FK first, rename, then recreate
-- Drop the Patient->Quote FK relation index temporarily handled by renaming PK directly
-- Use a two-step approach: add new column, copy, drop old, rename
ALTER TABLE "Quote" ADD COLUMN "_new_quoteId" TEXT;

UPDATE "Quote" q
SET "_new_quoteId" = m.new_id
FROM _quote_id_map m
WHERE q."quoteId" = m.old_id;

-- Drop PK constraint, rename column, add PK back
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_pkey";
ALTER TABLE "Quote" DROP COLUMN "quoteId";
ALTER TABLE "Quote" RENAME COLUMN "_new_quoteId" TO "quoteId";
ALTER TABLE "Quote" ALTER COLUMN "quoteId" SET NOT NULL;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_pkey" PRIMARY KEY ("quoteId");

-- Recreate the patientId index
DROP INDEX IF EXISTS "Quote_patientId_idx";
CREATE INDEX "Quote_patientId_idx" ON "Quote" ("patientId");

DROP TABLE _quote_id_map;

-- ============================================================
-- 2e. Invoice ID renaming: oldId -> {patientId}i{NNN}
-- ============================================================
CREATE TEMP TABLE _invoice_id_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL);

INSERT INTO _invoice_id_map (old_id, new_id)
SELECT
  "id" AS old_id,
  "patientId" || 'i' || LPAD(ROW_NUMBER() OVER (PARTITION BY "patientId" ORDER BY "createdAt")::text, 3, '0') AS new_id
FROM "Invoice";

-- Step 1: Update Quote data JSON events where invoiceId references exist
-- This handles the events[] array in Quote.data that may reference invoice IDs
-- We need to iterate through each quote's events and update invoiceId
DO $$
DECLARE
  _map RECORD;
BEGIN
  FOR _map IN SELECT old_id, new_id FROM _invoice_id_map LOOP
    -- Update any Quote data JSON that contains this invoice ID in events
    UPDATE "Quote"
    SET data = regexp_replace(
      data::text,
      '"invoiceId"\s*:\s*"' || regexp_replace(_map.old_id, '([.\\+*?\[^\]$(){}=!<>|:\-])', '\\\1', 'g') || '"',
      '"invoiceId":"' || _map.new_id || '"',
      'g'
    )::jsonb
    WHERE data::text LIKE '%' || _map.old_id || '%';
  END LOOP;
END $$;

-- Step 2: Update Invoice data JSON id
UPDATE "Invoice" inv
SET data = jsonb_set(inv.data::jsonb, '{id}', to_jsonb(m.new_id))
FROM _invoice_id_map m
WHERE inv."id" = m.old_id;

-- Step 3: Update Invoice PK
ALTER TABLE "Invoice" ADD COLUMN "_new_id" TEXT;

UPDATE "Invoice" inv
SET "_new_id" = m.new_id
FROM _invoice_id_map m
WHERE inv."id" = m.old_id;

ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_pkey";
ALTER TABLE "Invoice" DROP COLUMN "id";
ALTER TABLE "Invoice" RENAME COLUMN "_new_id" TO "id";
ALTER TABLE "Invoice" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id");

-- Recreate indexes
DROP INDEX IF EXISTS "Invoice_patientId_idx";
CREATE INDEX "Invoice_patientId_idx" ON "Invoice" ("patientId");
DROP INDEX IF EXISTS "Invoice_quoteId_idx";
CREATE INDEX "Invoice_quoteId_idx" ON "Invoice" ("quoteId");

DROP TABLE _invoice_id_map;

-- ============================================================
-- 2f. Doctor ID mapping: old "doc-N" -> new "DOC000N" in Quotes
-- ============================================================
DO $$
DECLARE
  _settings_data jsonb;
  _doctors jsonb;
  _doc jsonb;
  _i int;
  _old_doc_id text;
  _new_doc_id text;
BEGIN
  SELECT data::jsonb INTO _settings_data
  FROM "AppSettings"
  WHERE id = 'default';

  IF _settings_data IS NOT NULL AND _settings_data ? 'doctors' THEN
    _doctors := _settings_data->'doctors';
    FOR _i IN 0..jsonb_array_length(_doctors) - 1 LOOP
      _doc := _doctors->_i;
      _old_doc_id := _doc->>'id';
      _new_doc_id := 'DOC' || LPAD((_i + 1)::text, 4, '0');

      -- Update Quote.doctorId column
      UPDATE "Quote"
      SET "doctorId" = _new_doc_id
      WHERE "doctorId" = _old_doc_id;

      -- Update Quote data JSON doctorId
      UPDATE "Quote"
      SET data = jsonb_set(data::jsonb, '{doctorId}', to_jsonb(_new_doc_id))
      WHERE data::jsonb->>'doctorId' = _old_doc_id;
    END LOOP;
  END IF;
END $$;
