# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-08

Major feature release adding calendar/appointment management, notifications (SMS & email), Google Calendar integration, dark/light mode theming, patient detail redesign, and comprehensive admin tooling.

### Added

#### Calendar & Appointment Management
- Custom multi-chair calendar module (`dq-calendar`) with day, week, and month views
- Drag & drop appointment creation, moving, and resizing
- Appointment types with custom colors, durations, and multilingual names
- Multi-chair support with chair-specific calendar columns
- Chair management UI in calendar settings
- Appointment recurrence support (RRULE/RFC 5545)
- Auto-open appointment modal from URL search params (`?action=new&patientId=xxx&date=yyyy-mm-dd`)

#### Google Calendar Integration
- OAuth 2.0 authentication flow with Google Calendar API
- Bidirectional sync modes: push-only, pull-only, or bidirectional
- Chair-to-Google-Calendar mapping (each chair syncs to a separate Google Calendar)
- Webhook-based real-time sync for production (HTTPS required)
- Polling-based incremental sync with `syncToken` for development
- Automatic token refresh on expiry
- Google Calendar sync log with success/error tracking
- Switched from `googleapis` (194MB) to `@googleapis/calendar` (824KB) for smaller deployment

#### SMS Notifications (Twilio)
- Twilio SMS integration with send and delivery tracking
- SMS settings management (account SID, auth token, phone number)
- SMS history table with status tracking (sent, delivered, failed)
- Send SMS directly from patient card
- SMS send modal with patient phone pre-fill
- Custom SMS templates with variable substitution
- Twilio webhook endpoint for delivery status updates
- `dq-sms` backend module

#### Email Notifications (Nodemailer)
- SMTP email integration via Nodemailer
- Email settings management (SMTP host, port, user, password, from address)
- Email history table with delivery tracking
- Send email directly from patient card
- Email send modal with patient email pre-fill
- Custom email templates with variable substitution

#### Notifications Hub
- Notifications overview page with pending message summary
- Pending messages view (scheduled SMS and emails)
- SMS history page with filtering
- Email history page with filtering
- Sidebar navigation for notifications section

#### Dark/Light Mode
- CSS custom properties-based theming system (`--color-bg-primary`, `--color-text-primary`, etc.)
- Three modes: Light, Dark, System (auto-detect from OS preference)
- Theme selector in Settings > General
- Flash-prevention inline script in `index.html`
- Multi-tab theme synchronization via `localStorage` events
- Smooth transition animation on theme switch (200ms)
- All common components migrated to theme variables
- All page components migrated to theme variables
- `dq-calendar` module dark mode support (`.dark` CSS variable overrides)
- `dq-importer` module dark mode support (CSS `var()` references in inline styles)
- Removed dead FullCalendar CSS overrides from `index.css`

#### Patient Detail Redesign
- Tabbed layout with PageTabBar: Státusz, Karton, Kezelések, Naptár, Értesítések, Árajánlatok, Számlák, NEAK
- SVG icons on all tab labels
- Route-based tab switching (`/patients/:patientId/status`, `/patients/:patientId/card`, etc.)
- **Karton tab**: Full-width card with 2-column grid, icon action buttons (Duplicate, Archive, Delete, Edit), billing data, timestamps
- **Kezelések tab**: Shows quotes with status 'started' or 'completed'
- **Naptár tab**: Upcoming and past appointments with clickable event links navigating to calendar with proper date context
- **Értesítések tab**: SMS and Email cards with history tables and send buttons
- Dynamic sidebar showing patient name when viewing patient detail
- Auto-expand sidebar menu for active patient routes
- "Új időpont" button that opens calendar with patient pre-filled

#### Admin & Permissions
- Granular RBAC permission system with `ALL_PERMISSION_KEYS` array
- Role presets: admin, doctor, assistant, receptionist, user, beta_tester
- Per-user permission overrides (`UserPermissionOverride` model)
- Permission audit logging (`PermissionAuditLog` model)
- User activity logging (`UserActivityLog` model)
- Admin page with user management, permission editing, and audit trail
- Permission groups: quotes, invoices, pricelist, catalog, patients, settings, calendar, sms, email, admin, data, lab, notifications

#### Data Management
- CSV export from Database Browser
- Database statistics (table sizes, row counts)
- Usage tracking section with visitor analytics
- Full export/import for patients, quotes, and catalog data

#### Deployment & Infrastructure
- Startup migration system (`runPendingMigrations()`) with `CREATE TABLE IF NOT EXISTS` for all new tables
- Auto-seed SMS and Email settings from environment variables on first startup (`seedSettingsFromEnv()`)
- Szamlazz.hu dual API key support (`SZAMLAZZ_AGENT_KEY_TEST` and `SZAMLAZZ_AGENT_KEY_LIVE`)
- Production FTP deployment workflow documentation

### Changed

#### Backend
- Bumped backend version to `0.2.0`
- Replaced `googleapis` (194MB) with `@googleapis/calendar` (824KB) — same API, 200x smaller
- Import changed: `import { google } from 'googleapis'` → `import { calendar_v3, auth as googleAuth } from '@googleapis/calendar'`
- Google OAuth: `google.auth.OAuth2` → `googleAuth.OAuth2`
- Google Calendar client: `google.calendar({ version: 'v3', auth })` → `new calendar_v3.Calendar({ auth })`
- Szamlazz.hu settings now use separate test/live API key env vars

#### Frontend
- Sidebar active state changed from `dental-200` to `dental-100` (lighter blue in light mode)
- Odontogram engine updated to v1.2.0
- Importer module restructured from submodule (`submodules/dq-importer`) to local module (`src/modules/dq-importer`)
- All hardcoded gray/slate colors replaced with semantic theme variables across ~35 files

#### Database Schema
- Added `googleCalendarId` field to `Appointment` model
- Added `emailLogs` relation to `Patient` model
- Added new models: `SmsSettings`, `EmailSettings`, `GoogleCalendarSync`, `GoogleCalendarLog`, `EmailLog`

### Fixed
- Settings page crash when invoicing settings were not initialized
- Szamlazz.hu API test card functionality
- Login page production corrections
- Seed endpoint compatibility with updated Prisma client schema
- Calendar event links from patient detail now navigate to correct date
- "Új időpont" button from patient card now pre-fills patient in appointment modal

### Removed
- FullCalendar CSS overrides (dead code in `index.css`, lines 57-158)
- `submodules/dq-importer` git submodule (replaced by local `src/modules/dq-importer`)

---

## [1.0.0] - 2026-02-21

First stable release of DentalQuoteCreator — a dental clinic management and quote creation application.

### Added

#### Frontend (React + TypeScript + Vite)
- Interactive odontogram editor with SVG-based tooth visualization and annotation system
- Patient management with patient cards, timeline, and chart integration
- Dental quote creation and workflow management
- Invoicing module with invoice generation and management
- Configurable price lists with category system and CSV import/export
- NEAK (Hungarian national health insurance) module scaffold
- Multi-language support (i18n) — Hungarian (primary), English, German
- Date-time format settings

#### Backend (Fastify + Prisma + PostgreSQL)
- PostgreSQL database with Prisma ORM and migrations
- Full migration from local storage to database-backed storage
- Role-based access control (RBAC) with admin authentication
- REST API for patients, quotes, invoices, catalogs, and price lists
- CSV seed data import for price lists and catalog items

#### Odontogram Engine
- SVG-based dental chart layers: radix, endo-filling-incomplete, parapulpal pin, crown replace, crown needed, missing closed
- Multi-tooth annotation and selection system
- Odontogram integrated into the quote editor
- Submodule-based architecture for the odontogram engine

[1.1.0]: https://github.com/ZoliQua/DentalQuoteCreator/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ZoliQua/DentalQuoteCreator/releases/tag/v1.0.0
