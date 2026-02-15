-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "allowedTeeth" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "milkToothOnly" BOOLEAN NOT NULL DEFAULT false;
