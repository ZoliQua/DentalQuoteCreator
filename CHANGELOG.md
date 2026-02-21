# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/ZoliQua/DentalQuoteCreator/releases/tag/v1.0.0
