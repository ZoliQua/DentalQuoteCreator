import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

function readCsv(filename: string): Record<string, string>[] {
  const filePath = resolve(__dirname, '../../archive', filename);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function toBool(val: string): boolean {
  return val.toUpperCase() === 'TRUE' || val === '1';
}

async function main() {
  console.log('Seeding PriceLists...');
  const priceLists = readCsv('pricelists.csv');
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
        isUserLocked: toBool(row.isUserLocked),
        listOfUsers: row.listOfUsers === '{}' ? [] : JSON.parse(row.listOfUsers || '[]'),
      },
    });
  }
  console.log(`  ${priceLists.length} price lists seeded.`);

  console.log('Seeding PriceListCategories...');
  const categories = readCsv('pricelist-categories.csv');
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

  // Build a lookup: catalogCategoryId -> { catalogCategoryHu, priceListId }
  const catLookup: Record<string, { hu: string; priceListId: string }> = {};
  for (const row of categories) {
    catLookup[row.catalogCategoryId] = {
      hu: row.catalogCategoryHu,
      priceListId: row.priceListId,
    };
  }

  console.log('Seeding PriceListCatalogItems...');
  const items = readCsv('pricelist-catalogitems.csv');
  for (const row of items) {
    const allowedTeeth = row.allowedTeeth
      ? row.allowedTeeth.split('|').map(Number).filter((n) => Number.isFinite(n))
      : [];
    const catInfo = catLookup[row.catalogCategoryId];
    const catalogCategory = catInfo?.hu || '';
    const priceListId = catInfo?.priceListId || null;

    await prisma.priceListCatalogItem.upsert({
      where: { catalogItemId: row.catalogItemId },
      update: {
        catalogCategoryId: row.catalogCategoryId || null,
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
        catalogCategory,
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
        catalogCategoryId: row.catalogCategoryId || null,
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
        catalogCategory,
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
