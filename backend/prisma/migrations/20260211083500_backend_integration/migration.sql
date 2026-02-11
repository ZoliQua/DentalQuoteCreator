ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "birthPlace" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "isForeignAddress" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "patientType" TEXT;

CREATE TABLE IF NOT EXISTS "CatalogItem" (
  "catalogItemId" TEXT PRIMARY KEY,
  "catalogCode" TEXT NOT NULL,
  "catalogName" TEXT NOT NULL,
  "catalogUnit" TEXT NOT NULL,
  "catalogPrice" DOUBLE PRECISION NOT NULL,
  "catalogPriceCurrency" TEXT NOT NULL,
  "catalogVatRate" DOUBLE PRECISION NOT NULL,
  "catalogTechnicalPrice" DOUBLE PRECISION NOT NULL,
  "catalogCategory" TEXT NOT NULL,
  "hasTechnicalPrice" BOOLEAN NOT NULL DEFAULT false,
  "isFullMouth" BOOLEAN NOT NULL DEFAULT false,
  "isArch" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "Invoice_patientId_idx" ON "Invoice"("patientId");
CREATE INDEX IF NOT EXISTS "Invoice_quoteId_idx" ON "Invoice"("quoteId");

CREATE TABLE IF NOT EXISTS "NeakCheck" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "NeakCheck_patientId_idx" ON "NeakCheck"("patientId");
CREATE INDEX IF NOT EXISTS "NeakCheck_checkedAt_idx" ON "NeakCheck"("checkedAt");

CREATE TABLE IF NOT EXISTS "OdontogramCurrent" (
  "patientId" TEXT PRIMARY KEY,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS "OdontogramDaily" (
  "patientId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL,
  PRIMARY KEY ("patientId", "dateKey")
);
CREATE INDEX IF NOT EXISTS "OdontogramDaily_patientId_idx" ON "OdontogramDaily"("patientId");

CREATE TABLE IF NOT EXISTS "OdontogramTimeline" (
  "snapshotId" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "OdontogramTimeline_patientId_idx" ON "OdontogramTimeline"("patientId");
CREATE INDEX IF NOT EXISTS "OdontogramTimeline_updatedAt_idx" ON "OdontogramTimeline"("updatedAt");
