-- Rename neakSectionId to catalogCategoryId (if old column exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NeakCatalogItem' AND column_name = 'neakSectionId') THEN
    ALTER TABLE "NeakCatalogItem" RENAME COLUMN "neakSectionId" TO "catalogCategoryId";
  END IF;
END $$;

-- Drop old index if exists, create new one
DROP INDEX IF EXISTS "NeakCatalogItem_neakSectionId_idx";
CREATE INDEX IF NOT EXISTS "NeakCatalogItem_catalogCategoryId_idx" ON "NeakCatalogItem"("catalogCategoryId");

-- Add isDeleted column if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NeakCatalogItem' AND column_name = 'isDeleted') THEN
    ALTER TABLE "NeakCatalogItem" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
