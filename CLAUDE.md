# DentalQuoteCreator

## Architecture
- Frontend: React + TypeScript (Vite), src/ root
- Backend: Fastify + Prisma + PostgreSQL, backend/ root
- Monorepo: frontend and backend share the same git repo but have separate tsconfig/package.json
- Backend runs on /backend prefix (frontend proxied via Vite)

## Git Submodules
- **Odontogram Engine**: `src/modules/odontogram/engine` → https://github.com/ZoliQua/React-Odontogram-Modul.git
- **DQ-Importer**: `src/modules/dq-importer` → https://github.com/ZoliQua/DQ-Importer.git (private repo)
- NEVER inline submodule files into the main repo — they must remain as git submodules
- After cloning, run `git submodule update --init --recursive`
- tsconfig.json excludes submodule server/build files: `"exclude": ["src/modules/odontogram/engine", "src/modules/dq-importer/server", "src/modules/dq-importer/vite.config.ts"]`
- Path aliases point to `src/` subdirectory within submodules: `@dq-importer` → `src/modules/dq-importer/src`
- If submodule code is modified, commit and push changes in the submodule repo first, then update the submodule reference in this repo

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

## Source Data CSV Files
- src/data/ directory contains authoritative CSV files for seeding reference data
- Files: PriceList.csv, PriceListCategory.csv, PriceListCatalogItem.csv, NeakDocumentType.csv, NeakLevel.csv, NeakSpecial.csv, NeakTerkat.csv, NeakCatalogItem.csv
- NEVER modify these CSV files unless explicitly instructed
- Backend seed.ts and /seed endpoint both read from src/data/
- Seed script: backend/prisma/seed.ts reads these CSVs
- Run seed: `cd backend && npx tsx prisma/seed.ts`
- Legacy archive/ directory still exists but is no longer used by seed

## Deployment (Production FTP)
- FTP credentials are stored in `backend/.env` (FTP_SERVER, FTP_USERNAME, FTP_PASSWORD)
- NEVER use `mirror -R --delete` on public_html — it deletes .htaccess files and other apps (e.g. /pdf)
- NEVER delete or overwrite files/directories on the server that are not part of this project
- NEVER delete or overwrite .htaccess files on the server — they contain critical Passenger and rewrite config
- Upload frontend files individually: `put dist/index.html`, `mirror -R dist/assets public_html/assets` (without --delete)
- Local .htaccess backups: `deploy/public_html.htaccess` and `deploy/passenger-backend.htaccess`
- See `deploy/README.txt` for full deployment guide

## Conventions
- Hungarian language is primary (hu.ts is the source of truth for i18n keys)
- IDs use prefixes: plistXXX (pricelists), pcatXXXX (categories), catXXXXX (catalog items)
- Backend uses upsert pattern for create/update in many routes
- Soft delete pattern: isDeleted/isArchived boolean fields
- server.ts is a single large file (~1700+ lines) -- all API routes live there
