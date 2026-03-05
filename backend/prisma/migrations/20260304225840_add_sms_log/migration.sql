-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "twilioSid" TEXT,
    "toNumber" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "patientId" TEXT,
    "patientName" TEXT,
    "context" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_patientId_idx" ON "SmsLog"("patientId");

-- CreateIndex
CREATE INDEX "SmsLog_twilioSid_idx" ON "SmsLog"("twilioSid");

-- CreateIndex
CREATE INDEX "SmsLog_status_idx" ON "SmsLog"("status");

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE SET NULL ON UPDATE CASCADE;
