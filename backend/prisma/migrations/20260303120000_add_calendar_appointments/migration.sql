-- CreateTable
CREATE TABLE "AppointmentType" (
    "typeId" TEXT NOT NULL,
    "nameHu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "nameDe" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "defaultDurationMin" INTEGER NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("typeId")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT,
    "chairIndex" INTEGER NOT NULL DEFAULT 0,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "appointmentTypeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "color" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "googleEventId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("appointmentId")
);

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_startDateTime_idx" ON "Appointment"("startDateTime");
CREATE INDEX "Appointment_endDateTime_idx" ON "Appointment"("endDateTime");
CREATE INDEX "Appointment_appointmentTypeId_idx" ON "Appointment"("appointmentTypeId");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("typeId") ON DELETE SET NULL ON UPDATE CASCADE;
