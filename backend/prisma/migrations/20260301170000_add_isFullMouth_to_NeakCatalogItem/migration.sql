-- AlterTable
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NeakCatalogItem' AND column_name = 'isFullMouth') THEN
    ALTER TABLE "NeakCatalogItem" ADD COLUMN "isFullMouth" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
