-- DropForeignKey
ALTER TABLE "PriceListCatalogItem" DROP CONSTRAINT "PriceListCatalogItem_catalogCategoryId_fkey";

-- AlterTable
ALTER TABLE "PriceList" ADD COLUMN     "isNeak" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "PriceListCatalogItem" ADD CONSTRAINT "PriceListCatalogItem_catalogCategoryId_fkey" FOREIGN KEY ("catalogCategoryId") REFERENCES "PriceListCategory"("catalogCategoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
