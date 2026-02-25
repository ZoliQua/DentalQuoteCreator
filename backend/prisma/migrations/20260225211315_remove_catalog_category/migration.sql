-- Update any remaining NULL catalogCategoryId values before making column required
UPDATE "PriceListCatalogItem" SET "catalogCategoryId" = 'pcat0001' WHERE "catalogCategoryId" IS NULL;

-- Drop the denormalized catalogCategory column
ALTER TABLE "PriceListCatalogItem" DROP COLUMN "catalogCategory";

-- Make catalogCategoryId required (NOT NULL)
ALTER TABLE "PriceListCatalogItem" ALTER COLUMN "catalogCategoryId" SET NOT NULL;
