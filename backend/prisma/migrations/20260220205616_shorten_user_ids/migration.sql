-- AlterTable
ALTER TABLE "PriceListCatalogItem" RENAME CONSTRAINT "CatalogItem_pkey" TO "PriceListCatalogItem_pkey";

-- RenameForeignKey
ALTER TABLE "PriceListCatalogItem" RENAME CONSTRAINT "CatalogItem_catalogCategoryId_fkey" TO "PriceListCatalogItem_catalogCategoryId_fkey";

-- RenameForeignKey
ALTER TABLE "PriceListCatalogItem" RENAME CONSTRAINT "CatalogItem_priceListId_fkey" TO "PriceListCatalogItem_priceListId_fkey";

-- RenameIndex
ALTER INDEX "CatalogItem_catalogCategoryId_idx" RENAME TO "PriceListCatalogItem_catalogCategoryId_idx";

-- RenameIndex
ALTER INDEX "CatalogItem_priceListId_idx" RENAME TO "PriceListCatalogItem_priceListId_idx";

-- ============================================================
-- Shorten User IDs from UUID (36 chars) to 8 chars
-- ============================================================

-- Step 1: Drop FK constraints that reference User.id
ALTER TABLE "AuthSession" DROP CONSTRAINT "AuthSession_userId_fkey";
ALTER TABLE "UserPermissionOverride" DROP CONSTRAINT "UserPermissionOverride_userId_fkey";
ALTER TABLE "PermissionAuditLog" DROP CONSTRAINT "PermissionAuditLog_targetUserId_fkey";
ALTER TABLE "PermissionAuditLog" DROP CONSTRAINT "PermissionAuditLog_changedByUserId_fkey";
ALTER TABLE "UserActivityLog" DROP CONSTRAINT "UserActivityLog_userId_fkey";

-- Step 2: Shorten User.id
UPDATE "User" SET "id" = LEFT("id", 8);

-- Step 3: Shorten FK columns in tables with real FK constraints
UPDATE "AuthSession" SET "userId" = LEFT("userId", 8);
UPDATE "UserPermissionOverride" SET "userId" = LEFT("userId", 8);
UPDATE "PermissionAuditLog" SET "targetUserId" = LEFT("targetUserId", 8);
UPDATE "PermissionAuditLog" SET "changedByUserId" = LEFT("changedByUserId", 8);
UPDATE "UserActivityLog" SET "userId" = LEFT("userId", 8);

-- Step 4: Shorten soft-reference columns (no FK constraint)
UPDATE "Patient" SET "createdByUserId" = LEFT("createdByUserId", 8) WHERE "createdByUserId" IS NOT NULL;
UPDATE "Quote" SET "createdByUserId" = LEFT("createdByUserId", 8) WHERE "createdByUserId" IS NOT NULL;
UPDATE "Invoice" SET "createdByUserId" = LEFT("createdByUserId", 8) WHERE "createdByUserId" IS NOT NULL;

-- Step 5: Re-add FK constraints
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserActivityLog" ADD CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
