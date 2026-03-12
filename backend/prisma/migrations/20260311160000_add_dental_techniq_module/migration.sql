-- CreateEnum
CREATE TYPE "LabWorkOrderStatus" AS ENUM ('draft', 'sent', 'in_progress', 'ready', 'delivered', 'accepted', 'revision', 'cancelled');

-- CreateTable
CREATE TABLE "LabPartner" (
    "labPartnerId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabPartner_pkey" PRIMARY KEY ("labPartnerId")
);

-- CreateTable
CREATE TABLE "LabWorkOrder" (
    "workOrderId" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "labPartnerId" TEXT NOT NULL,
    "doctorId" TEXT,
    "quoteId" TEXT,
    "status" "LabWorkOrderStatus" NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "toothNotation" TEXT,
    "shade" TEXT,
    "material" TEXT,
    "upperImpression" BOOLEAN NOT NULL DEFAULT false,
    "lowerImpression" BOOLEAN NOT NULL DEFAULT false,
    "bite" BOOLEAN NOT NULL DEFAULT false,
    "facebow" BOOLEAN NOT NULL DEFAULT false,
    "photos" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "labNotes" TEXT,
    "requestedDeadline" TIMESTAMP(3),
    "promisedDeadline" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "totalPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "LabWorkOrder_pkey" PRIMARY KEY ("workOrderId")
);

-- CreateTable
CREATE TABLE "LabWorkOrderItem" (
    "itemId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "description" TEXT NOT NULL,
    "tooth" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LabWorkOrderItem_pkey" PRIMARY KEY ("itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabWorkOrder_workOrderNumber_key" ON "LabWorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "LabWorkOrder_patientId_idx" ON "LabWorkOrder"("patientId");

-- CreateIndex
CREATE INDEX "LabWorkOrder_labPartnerId_idx" ON "LabWorkOrder"("labPartnerId");

-- CreateIndex
CREATE INDEX "LabWorkOrder_status_idx" ON "LabWorkOrder"("status");

-- CreateIndex
CREATE INDEX "LabWorkOrder_workOrderNumber_idx" ON "LabWorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "LabWorkOrder_createdAt_idx" ON "LabWorkOrder"("createdAt");

-- CreateIndex
CREATE INDEX "LabWorkOrderItem_workOrderId_idx" ON "LabWorkOrderItem"("workOrderId");

-- AddForeignKey
ALTER TABLE "LabWorkOrder" ADD CONSTRAINT "LabWorkOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabWorkOrder" ADD CONSTRAINT "LabWorkOrder_labPartnerId_fkey" FOREIGN KEY ("labPartnerId") REFERENCES "LabPartner"("labPartnerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabWorkOrderItem" ADD CONSTRAINT "LabWorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "LabWorkOrder"("workOrderId") ON DELETE CASCADE ON UPDATE CASCADE;
