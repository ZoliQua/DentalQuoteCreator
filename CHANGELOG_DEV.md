# CHANGELOG DEV

Development changelog tracking all incremental changes between releases.

## v1.2.0-dev.1 (2026-03-13)

### Added
- **NAS Scraper Integration**: Docker deployment on Synology DS918+ for Flexi-dent scraper
  - Dockerfile + docker-compose.yml for containerized Playwright + Chromium
  - HTTPS via DSM Reverse Proxy (Let's Encrypt cert)
  - CORS middleware for fogorvosa.hu cross-origin requests
  - Production URL: `https://zoli-nas.diskstation.me:3335/api/importer/`
- **Dev script**: Scraper backend auto-starts with `npm run dev` (concurrently)
- **Version display**: App version shown below logout button in sidebar
- **CHANGELOG_DEV**: Development changelog for tracking incremental changes
- **Odontogram theme config**: Added `OdontogramThemeConfig` type for color overrides

### Fixed
- **PatientFormModal crash**: `settings.patient` undefined on initial render — added optional chaining (`?.`) across PatientsPage, PatientDetailPage, QuoteEditorPage, VisualQuoteEditorPage
- **Importer JSON parse error**: Wrapped fetch/json calls in try-catch with Hungarian error messages
- **Docker Chromium**: Added missing `libxfixes3`, `libx11-xcb1` and other X11 libs to Dockerfile

### Changed
- Page title changed from "Fogaszati Arajanlat-keszito" to "DentalQuoter"
- Frontend API URL is now environment-aware (localhost → local proxy, production → NAS HTTPS)
