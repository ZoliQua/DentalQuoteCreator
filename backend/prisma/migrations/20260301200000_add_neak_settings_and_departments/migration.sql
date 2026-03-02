-- CreateTable
CREATE TABLE IF NOT EXISTS "NeakSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "dentalPraxisId" TEXT NOT NULL DEFAULT 'DP001',
    "neakOjoteKey" TEXT NOT NULL DEFAULT '',
    "neakWssUser" TEXT NOT NULL DEFAULT '',
    "neakWssPassword" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeakSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NeakDepartment" (
    "id" TEXT NOT NULL,
    "dentalPraxisId" TEXT NOT NULL DEFAULT 'DP001',
    "neakDepartmentNameHu" TEXT NOT NULL,
    "neakDepartmentNameEn" TEXT NOT NULL DEFAULT '',
    "neakDepartmentNameDe" TEXT NOT NULL DEFAULT '',
    "neakDepartmentCode" TEXT NOT NULL,
    "neakDepartmentHours" INTEGER NOT NULL,
    "neakDepartmentMaxPoints" INTEGER NOT NULL,
    "neakDepartmentPrefix" TEXT NOT NULL DEFAULT '',
    "neakDepartmentLevel" TEXT NOT NULL DEFAULT 'A',
    "neakDepartmentIndicator" TEXT NOT NULL DEFAULT 'adult',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeakDepartment_pkey" PRIMARY KEY ("id")
);
