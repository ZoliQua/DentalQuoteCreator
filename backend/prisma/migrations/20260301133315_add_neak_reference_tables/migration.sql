-- CreateTable
CREATE TABLE "NeakLevel" (
    "neakLevelCode" TEXT NOT NULL,
    "neakLevelInfoHu" TEXT NOT NULL,
    "neakLevelInfoEn" TEXT NOT NULL DEFAULT '',
    "neakLevelInfoDe" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "NeakLevel_pkey" PRIMARY KEY ("neakLevelCode")
);

-- CreateTable
CREATE TABLE "NeakSpecial" (
    "neakSpecialMark" INTEGER NOT NULL,
    "neakSpecialMarkCode" TEXT NOT NULL DEFAULT '',
    "neakSpecialDescHu" TEXT NOT NULL,
    "neakSpecialDescEn" TEXT NOT NULL DEFAULT '',
    "neakSpecialDescDe" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "NeakSpecial_pkey" PRIMARY KEY ("neakSpecialMark")
);

-- CreateTable
CREATE TABLE "NeakTerkat" (
    "neakTerKatCode" TEXT NOT NULL,
    "neakTerKatInfoHu" TEXT NOT NULL,
    "neakTerKatInfoEn" TEXT NOT NULL DEFAULT '',
    "neakTerKatInfoDe" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "NeakTerkat_pkey" PRIMARY KEY ("neakTerKatCode")
);

-- CreateTable
CREATE TABLE "NeakCatalogItem" (
    "neakCatalogItemId" TEXT NOT NULL,
    "neakCode" TEXT NOT NULL,
    "neakNameHu" TEXT NOT NULL,
    "neakNameEn" TEXT NOT NULL DEFAULT '',
    "neakNameDe" TEXT NOT NULL DEFAULT '',
    "neakSectionId" TEXT NOT NULL,
    "neakPoints" INTEGER NOT NULL DEFAULT 0,
    "neakMinimumTimeMin" INTEGER NOT NULL DEFAULT 0,
    "isTooth" BOOLEAN NOT NULL DEFAULT false,
    "isArch" BOOLEAN NOT NULL DEFAULT false,
    "isQuadrant" BOOLEAN NOT NULL DEFAULT false,
    "isSurface" BOOLEAN NOT NULL DEFAULT false,
    "surfaceNum" TEXT NOT NULL DEFAULT '',
    "neakMaxQtyPerDay" INTEGER,
    "neakToothType" TEXT NOT NULL DEFAULT '',
    "neakTimeLimitMonths" INTEGER,
    "neakTimeLimitDays" INTEGER,
    "neakTimeLimitQty" INTEGER,
    "neakTimeLimitSchoolStart" TEXT NOT NULL DEFAULT '',
    "neakTimeLimitSchoolEnd" TEXT NOT NULL DEFAULT '',
    "neakLevelA" BOOLEAN NOT NULL DEFAULT false,
    "neakLevelS" BOOLEAN NOT NULL DEFAULT false,
    "neakLevelT" BOOLEAN NOT NULL DEFAULT false,
    "neakLevelE" BOOLEAN NOT NULL DEFAULT false,
    "neakTerKatCodes" TEXT NOT NULL DEFAULT '',
    "neakNotBillableWithCodes" TEXT NOT NULL DEFAULT '',
    "neakNotBillableIfRecentCodes" TEXT NOT NULL DEFAULT '',
    "neakBillableWithCodes" TEXT NOT NULL DEFAULT '',
    "neakSpecialMark" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "catalogUnit" TEXT NOT NULL DEFAULT 'db',
    "milkToothOnly" BOOLEAN NOT NULL DEFAULT false,
    "svgLayer" TEXT NOT NULL DEFAULT '',
    "hasLayer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NeakCatalogItem_pkey" PRIMARY KEY ("neakCatalogItemId")
);

-- CreateIndex
CREATE INDEX "NeakCatalogItem_neakCode_idx" ON "NeakCatalogItem"("neakCode");

-- CreateIndex
CREATE INDEX "NeakCatalogItem_neakSectionId_idx" ON "NeakCatalogItem"("neakSectionId");
