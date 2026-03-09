import { PrismaClient } from '@prisma/client';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readCsv as readCsvFromDir } from '../src/csvUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const dataDir = __dirname + '/../../src/data';
function readCsv(filename: string): Record<string, string>[] {
  return readCsvFromDir(dataDir, filename);
}

function toBool(val: string): boolean {
  return val.toUpperCase() === 'TRUE' || val === '1';
}

function toIntOrNull(val: string): number | null {
  if (!val || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log('Seeding PriceLists...');
  const priceLists = readCsv('PriceList.csv');
  for (const row of priceLists) {
    await prisma.priceList.upsert({
      where: { priceListId: row.priceListId },
      update: {
        priceListNameHu: row.priceListNameHu,
        priceListNameEn: row.priceListNameEn || '',
        priceListNameDe: row.priceListNameDe || '',
        isActive: toBool(row.isActive),
        isDeleted: toBool(row.isDeleted),
        isDefault: toBool(row.isDefault),
        isNeak: toBool(row.isNeak || 'FALSE'),
        isUserLocked: toBool(row.isUserLocked),
        listOfUsers: row.listOfUsers === '{}' ? [] : JSON.parse(row.listOfUsers || '[]'),
      },
      create: {
        priceListId: row.priceListId,
        priceListNameHu: row.priceListNameHu,
        priceListNameEn: row.priceListNameEn || '',
        priceListNameDe: row.priceListNameDe || '',
        isActive: toBool(row.isActive),
        isDeleted: toBool(row.isDeleted),
        isDefault: toBool(row.isDefault),
        isNeak: toBool(row.isNeak || 'FALSE'),
        isUserLocked: toBool(row.isUserLocked),
        listOfUsers: row.listOfUsers === '{}' ? [] : JSON.parse(row.listOfUsers || '[]'),
      },
    });
  }
  console.log(`  ${priceLists.length} price lists seeded.`);

  console.log('Seeding PriceListCategories...');
  const categories = readCsv('PriceListCategory.csv');
  for (const row of categories) {
    await prisma.priceListCategory.upsert({
      where: { catalogCategoryId: row.catalogCategoryId },
      update: {
        priceListId: row.priceListId,
        catalogCategoryPrefix: row.catalogCategoryPrefix,
        catalogCategoryHu: row.catalogCategoryHu,
        catalogCategoryEn: row.catalogCategoryEn || '',
        catalogCategoryDe: row.catalogCategoryDe || '',
        isActive: toBool(row.isActive),
        isDeleted: toBool(row.isDeleted),
      },
      create: {
        catalogCategoryId: row.catalogCategoryId,
        priceListId: row.priceListId,
        catalogCategoryPrefix: row.catalogCategoryPrefix,
        catalogCategoryHu: row.catalogCategoryHu,
        catalogCategoryEn: row.catalogCategoryEn || '',
        catalogCategoryDe: row.catalogCategoryDe || '',
        isActive: toBool(row.isActive),
        isDeleted: toBool(row.isDeleted),
      },
    });
  }
  console.log(`  ${categories.length} categories seeded.`);

  // Build a lookup: catalogCategoryId -> priceListId
  const catLookup: Record<string, string> = {};
  for (const row of categories) {
    catLookup[row.catalogCategoryId] = row.priceListId;
  }

  console.log('Seeding PriceListCatalogItems...');
  const items = readCsv('PriceListCatalogItem.csv');
  for (const row of items) {
    const allowedTeeth = row.allowedTeeth
      ? row.allowedTeeth.split('|').map(Number).filter((n) => Number.isFinite(n))
      : [];
    const priceListId = catLookup[row.catalogCategoryId] || null;

    await prisma.priceListCatalogItem.upsert({
      where: { catalogItemId: row.catalogItemId },
      update: {
        catalogCategoryId: row.catalogCategoryId || '',
        priceListId,
        catalogCode: row.catalogCode,
        catalogNameHu: row.catalogNameHu,
        catalogNameEn: row.catalogNameEn || '',
        catalogNameDe: row.catalogNameDe || '',
        catalogUnit: row.catalogUnit,
        catalogPrice: Number(row.catalogPrice) || 0,
        catalogPriceCurrency: row.catalogPriceCurrency || 'HUF',
        catalogVatRate: Number(row.catalogVatRate) || 0,
        catalogTechnicalPrice: Number(row.catalogTechnicalPrice) || 0,
        svgLayer: row.svgLayer || '',
        hasLayer: toBool(row.hasLayer),
        hasTechnicalPrice: toBool(row.hasTechnicalPrice),
        isFullMouth: toBool(row.isFullMouth),
        isArch: toBool(row.isArch),
        isQuadrant: toBool(row.isQuadrant),
        maxTeethPerArch: row.maxTeethPerArch ? Number(row.maxTeethPerArch) : null,
        allowedTeeth,
        milkToothOnly: toBool(row.milkToothOnly),
        isActive: toBool(row.isActive),
      },
      create: {
        catalogItemId: row.catalogItemId,
        catalogCategoryId: row.catalogCategoryId || '',
        priceListId,
        catalogCode: row.catalogCode,
        catalogNameHu: row.catalogNameHu,
        catalogNameEn: row.catalogNameEn || '',
        catalogNameDe: row.catalogNameDe || '',
        catalogUnit: row.catalogUnit,
        catalogPrice: Number(row.catalogPrice) || 0,
        catalogPriceCurrency: row.catalogPriceCurrency || 'HUF',
        catalogVatRate: Number(row.catalogVatRate) || 0,
        catalogTechnicalPrice: Number(row.catalogTechnicalPrice) || 0,
        svgLayer: row.svgLayer || '',
        hasLayer: toBool(row.hasLayer),
        hasTechnicalPrice: toBool(row.hasTechnicalPrice),
        isFullMouth: toBool(row.isFullMouth),
        isArch: toBool(row.isArch),
        isQuadrant: toBool(row.isQuadrant),
        maxTeethPerArch: row.maxTeethPerArch ? Number(row.maxTeethPerArch) : null,
        allowedTeeth,
        milkToothOnly: toBool(row.milkToothOnly),
        isActive: toBool(row.isActive),
      },
    });
  }
  console.log(`  ${items.length} catalog items seeded.`);

  // Seed NeakDocumentType
  console.log('Seeding NeakDocumentType...');
  const neakDocs = readCsv('NeakDocumentType.csv');
  for (const row of neakDocs) {
    await prisma.neakDocumentType.upsert({
      where: { neakDocumentId: row.neakDocumentId },
      update: {
        neakDocumentTypeCode: parseInt(row.neakDocumentTypeCode, 10) || 0,
        neakDocumentDetails: row.neakDocumentDetails || '',
      },
      create: {
        neakDocumentId: row.neakDocumentId,
        neakDocumentTypeCode: parseInt(row.neakDocumentTypeCode, 10) || 0,
        neakDocumentDetails: row.neakDocumentDetails || '',
      },
    });
  }
  console.log(`  ${neakDocs.length} NEAK document types seeded.`);

  // Seed NeakLevel
  console.log('Seeding NeakLevel...');
  const neakLevels = readCsv('NeakLevel.csv');
  for (const row of neakLevels) {
    await prisma.neakLevel.upsert({
      where: { neakLevelCode: row.NeakLevelCode },
      update: {
        neakLevelInfoHu: row.NeakLevelInfoHu || '',
        neakLevelInfoEn: row.NeakLevelInfoEn || '',
        neakLevelInfoDe: row.NeakLevelInfoDe || '',
      },
      create: {
        neakLevelCode: row.NeakLevelCode,
        neakLevelInfoHu: row.NeakLevelInfoHu || '',
        neakLevelInfoEn: row.NeakLevelInfoEn || '',
        neakLevelInfoDe: row.NeakLevelInfoDe || '',
      },
    });
  }
  console.log(`  ${neakLevels.length} NEAK levels seeded.`);

  // Seed NeakSpecial
  console.log('Seeding NeakSpecial...');
  const neakSpecials = readCsv('NeakSpecial.csv');
  for (const row of neakSpecials) {
    await prisma.neakSpecial.upsert({
      where: { neakSpecialMark: parseInt(row.neakSpecialMark, 10) },
      update: {
        neakSpecialMarkCode: row.neakSpecialMarkCode || '',
        neakSpecialDescHu: row.neakSpecialDescHu || '',
        neakSpecialDescEn: row.neakSpecialDescEn || '',
        neakSpecialDescDe: row.neakSpecialDescDe || '',
      },
      create: {
        neakSpecialMark: parseInt(row.neakSpecialMark, 10),
        neakSpecialMarkCode: row.neakSpecialMarkCode || '',
        neakSpecialDescHu: row.neakSpecialDescHu || '',
        neakSpecialDescEn: row.neakSpecialDescEn || '',
        neakSpecialDescDe: row.neakSpecialDescDe || '',
      },
    });
  }
  console.log(`  ${neakSpecials.length} NEAK specials seeded.`);

  // Seed NeakTerkat
  console.log('Seeding NeakTerkat...');
  const neakTerkats = readCsv('NeakTerkat.csv');
  for (const row of neakTerkats) {
    await prisma.neakTerkat.upsert({
      where: { neakTerKatCode: row.NeakTerKatCode },
      update: {
        neakTerKatInfoHu: row.NeakTerKatInfoHu || '',
        neakTerKatInfoEn: row.NeakTerKatInfoEn || '',
        neakTerKatInfoDe: row.NeakTerKatInfoDe || '',
      },
      create: {
        neakTerKatCode: row.NeakTerKatCode,
        neakTerKatInfoHu: row.NeakTerKatInfoHu || '',
        neakTerKatInfoEn: row.NeakTerKatInfoEn || '',
        neakTerKatInfoDe: row.NeakTerKatInfoDe || '',
      },
    });
  }
  console.log(`  ${neakTerkats.length} NEAK terkats seeded.`);

  // Seed NeakCatalogItem
  console.log('Seeding NeakCatalogItem...');
  const neakItems = readCsv('NeakCatalogItem.csv');
  for (const row of neakItems) {
    const data = {
      neakCode: row.neakCode,
      neakNameHu: row.neakNameHu,
      neakNameEn: row.neakNameEn || '',
      neakNameDe: row.neakNameDe || '',
      catalogCategoryId: row.catalogCategoryId,
      neakPoints: parseInt(row.neakPoints, 10) || 0,
      neakMinimumTimeMin: parseInt(row.neakMinimumTimeMin, 10) || 0,
      isFullMouth: toBool(row.isFullMouth),
      isTooth: toBool(row.isTooth),
      isArch: toBool(row.isArch),
      isQuadrant: toBool(row.isQuadrant),
      isSurface: toBool(row.isSurface),
      surfaceNum: row.surfaceNum || '',
      neakMaxQtyPerDay: toIntOrNull(row.neakMaxQtyPerDay),
      neakToothType: row.neakToothType || '',
      neakTimeLimitMonths: toIntOrNull(row.neakTimeLimitMonths),
      neakTimeLimitDays: toIntOrNull(row.neakTimeLimitDays),
      neakTimeLimitQty: toIntOrNull(row.neakTimeLimitQty),
      neakTimeLimitSchoolStart: row.neakTimeLimitSchoolStart || '',
      neakTimeLimitSchoolEnd: row.neakTimeLimitSchoolEnd || '',
      neakLevelA: toBool(row.neakLevelA),
      neakLevelS: toBool(row.neakLevelS),
      neakLevelT: toBool(row.neakLevelT),
      neakLevelE: toBool(row.neakLevelE),
      neakTerKatCodes: row.neakTerKatCodes || '',
      neakNotBillableWithCodes: row.neakNotBillableWithCodes || '',
      neakNotBillableIfRecentCodes: row.neakNotBillableIfRecentCodes || '',
      neakBillableWithCodes: row.neakBillableWithCodes || '',
      neakSpecialMark: parseInt(row.neakSpecialMark, 10) || 0,
      isActive: toBool(row.isActive),
      catalogUnit: row.catalogUnit || 'db',
      milkToothOnly: toBool(row.milkToothOnly),
      svgLayer: row.svgLayer || '',
      hasLayer: toBool(row.hasLayer),
      isDeleted: toBool(row.isDeleted || 'FALSE'),
    };
    await prisma.neakCatalogItem.upsert({
      where: { neakCatalogItemId: row.neakCatalogItemId },
      update: data,
      create: { neakCatalogItemId: row.neakCatalogItemId, ...data },
    });
  }
  console.log(`  ${neakItems.length} NEAK catalog items seeded.`);

  // Seed Country
  console.log('Seeding Countries...');
  const countries = readCsv('Country.csv');
  for (const row of countries) {
    const data = {
      countryNameHu: row.CountryNameHu || '',
      countryNameEn: row.CountryNameEn || '',
      countryNameDe: row.CountryNameDe || '',
    };
    await prisma.country.upsert({
      where: { countryId: parseInt(row.countryId, 10) },
      update: data,
      create: { countryId: parseInt(row.countryId, 10), ...data },
    });
  }
  console.log(`  ${countries.length} countries seeded.`);

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
