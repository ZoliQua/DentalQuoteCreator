-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "mothersName" TEXT,
ADD COLUMN     "neakDocumentType" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "patientDiscount" INTEGER,
ADD COLUMN     "patientVATName" TEXT,
ADD COLUMN     "patientVATNumber" TEXT;

-- CreateTable
CREATE TABLE "NeakDocumentType" (
    "neakDocumentId" TEXT NOT NULL,
    "neakDocumentTypeCode" INTEGER NOT NULL,
    "neakDocumentDetails" TEXT NOT NULL,

    CONSTRAINT "NeakDocumentType_pkey" PRIMARY KEY ("neakDocumentId")
);

-- Seed NeakDocumentType
INSERT INTO "NeakDocumentType" VALUES
('10000001',0,'a személyazonosító jel nincs kitöltve'),
('10000002',1,'TAJ szám'),
('10000003',2,'3 hónapnál fiatalabb gyermek képzett TAJ száma'),
('10000004',3,'útlevélszám'),
('10000005',5,'menedékes, kérelmező, befogadó igazolvány száma'),
('10000006',6,'ismeretlen TAJ számú elhunyt személy'),
('10000007',7,'ismeretlen beteg'),
('10000008',8,'Európai egészségbiztosítási kártya'),
('10000009',9,'személyazonosító a menekült státusz kérelmezését megelőzően');

-- Random mothers names for existing patients
UPDATE "Patient" SET "mothersName" = (
  ARRAY['Kiss Mária','Nagy Erzsébet','Tóth Katalin','Szabó Ilona',
        'Horváth Judit','Varga Anna','Kovács Éva','Molnár Zsuzsanna']
)[1 + floor(random()*8)::int];
