-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "hasLayer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "svgLayer" TEXT NOT NULL DEFAULT '';
