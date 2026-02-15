-- AlterTable
ALTER TABLE "AppSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NeakCheck" ADD COLUMN     "neakHibakod" TEXT,
ADD COLUMN     "neakJogviszony" TEXT,
ADD COLUMN     "neakSuccess" BOOLEAN,
ADD COLUMN     "neakTranKod" TEXT,
ADD COLUMN     "taj" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserPermissionOverride" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "NeakCheck_neakTranKod_idx" ON "NeakCheck"("neakTranKod");
