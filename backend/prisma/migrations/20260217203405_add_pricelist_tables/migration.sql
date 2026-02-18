-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "catalogCategoryId" TEXT,
ADD COLUMN     "priceListId" TEXT;

-- CreateTable
CREATE TABLE "PriceList" (
    "priceListId" TEXT NOT NULL,
    "priceListNameHu" TEXT NOT NULL,
    "priceListNameEn" TEXT NOT NULL DEFAULT '',
    "priceListNameDe" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isUserLocked" BOOLEAN NOT NULL DEFAULT false,
    "listOfUsers" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("priceListId")
);

-- CreateTable
CREATE TABLE "PriceListCategory" (
    "catalogCategoryId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "catalogCategoryPrefix" TEXT NOT NULL,
    "catalogCategoryHu" TEXT NOT NULL,
    "catalogCategoryEn" TEXT NOT NULL DEFAULT '',
    "catalogCategoryDe" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PriceListCategory_pkey" PRIMARY KEY ("catalogCategoryId")
);

-- CreateIndex
CREATE INDEX "PriceListCategory_priceListId_idx" ON "PriceListCategory"("priceListId");

-- CreateIndex
CREATE INDEX "CatalogItem_catalogCategoryId_idx" ON "CatalogItem"("catalogCategoryId");

-- CreateIndex
CREATE INDEX "CatalogItem_priceListId_idx" ON "CatalogItem"("priceListId");

-- AddForeignKey
ALTER TABLE "PriceListCategory" ADD CONSTRAINT "PriceListCategory_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("priceListId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("priceListId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_catalogCategoryId_fkey" FOREIGN KEY ("catalogCategoryId") REFERENCES "PriceListCategory"("catalogCategoryId") ON DELETE SET NULL ON UPDATE CASCADE;
