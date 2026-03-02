-- CreateTable
CREATE TABLE "Country" (
    "countryId" INTEGER NOT NULL,
    "countryNameHu" TEXT NOT NULL,
    "countryNameEn" TEXT NOT NULL DEFAULT '',
    "countryNameDe" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Country_pkey" PRIMARY KEY ("countryId")
);
