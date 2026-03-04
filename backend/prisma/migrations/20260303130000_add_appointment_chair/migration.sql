-- CreateTable
CREATE TABLE "AppointmentChair" (
    "chairId" TEXT NOT NULL,
    "chairNr" INTEGER NOT NULL,
    "chairNameHu" TEXT NOT NULL,
    "chairNameEn" TEXT NOT NULL DEFAULT '',
    "chairNameDe" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "AppointmentChair_pkey" PRIMARY KEY ("chairId")
);
