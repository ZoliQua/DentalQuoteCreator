-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "isHungarianPhone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Patient" ADD COLUMN "treatmentArchive" TEXT;
