# DentalQuoteCreator

## Architecture
- Frontend: React + TypeScript (Vite), src/ root
- Backend: Fastify + Prisma + PostgreSQL, backend/ root
- Monorepo: frontend and backend share the same git repo but have separate tsconfig/package.json
- Backend runs on /backend prefix (frontend proxied via Vite)

## Key Patterns
- **Permissions**: ALL_PERMISSION_KEYS array in backend/src/server.ts drives RBAC; ROLE_PERMISSION_PRESETS maps roles to keys
- **Storage**: StorageRepository interface (src/repositories/StorageRepository.ts) -> LocalStorageRepository calls backend API via sync XHR (requestJsonSync)
- **Context**: AppContext.tsx holds all app state (patients, catalog, quotes); hooks (src/hooks/) wrap context with business logic
- **i18n**: hu.ts defines TranslationKeys type; en.ts and de.ts import and implement it -- add keys to hu.ts first
- **Navigation**: Layout.tsx uses children array pattern for sub-menus (see patients, quotes examples)
- **CSV parsing**: src/utils/catalogImportExport.ts has parseCsvLine/escapeCsvValue helpers -- reuse for new CSV features

## Prisma
- Schema: backend/prisma/schema.prisma
- `npx prisma migrate dev --name <name>` from backend/ dir
- `npx prisma migrate dev --create-only` to review SQL before applying
- Model PriceListCatalogItem maps to SQL table "PriceListCatalogItem"; catalogNameHu uses @map("catalogName") for column name
- After schema changes, always run `npx prisma generate` and restart backend (`cd backend && npm run dev`)
- prisma.priceListCatalogItem is the Prisma client accessor (not prisma.catalogItem)

## Build & Check
- `npx tsc -b --noEmit` from project root to check frontend types
- `cd backend && npx tsc -p tsconfig.json` to check backend types
- Backend dev: `cd backend && npm run dev` (tsx watch)
- Frontend dev: `npm run dev` (Vite)

## Archive CSV Data
- archive/pricelists.csv, archive/pricelist-categories.csv, archive/pricelist-catalogitems.csv
- Seed script: backend/prisma/seed.ts reads these CSVs
- Run seed: `cd backend && npx tsx prisma/seed.ts`

## Conventions
- Hungarian language is primary (hu.ts is the source of truth for i18n keys)
- IDs use prefixes: plistXXX (pricelists), pcatXXXX (categories), catXXXXX (catalog items)
- Backend uses upsert pattern for create/update in many routes
- Soft delete pattern: isDeleted/isArchived boolean fields
- server.ts is a single large file (~1700+ lines) -- all API routes live there
