-- CreateTable
CREATE TABLE "InvoiceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "invoiceType" TEXT NOT NULL DEFAULT 'paper',
    "defaultComment" TEXT NOT NULL DEFAULT '',
    "defaultVatRate" TEXT NOT NULL DEFAULT 'TAM',
    "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'bankkártya',
    "invoiceMode" TEXT NOT NULL DEFAULT 'test',
    "agentKeyLive" TEXT NOT NULL DEFAULT '',
    "agentKeyTest" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSettings_pkey" PRIMARY KEY ("id")
);
