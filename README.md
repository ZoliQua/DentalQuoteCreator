# DentalQuoteCreator

**Fogászati rendelőkezelő és árajánlat-készítő rendszer**
**Dental Practice Management & Quote Creator**
**Zahnarztpraxis-Verwaltung & Kostenvoranschlag-Ersteller**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/ZoliQua/DentalQuoteCreator/releases/tag/v1.1.0)
[![Backend](https://img.shields.io/badge/backend-0.2.0-green.svg)](https://github.com/ZoliQua/DentalQuoteCreator/releases/tag/v1.1.0)
[![License](https://img.shields.io/badge/license-Private-red.svg)]()

---

<details>
<summary>🇭🇺 <b>Magyar dokumentáció</b></summary>

## Áttekintés

A DentalQuoteCreator egy teljes körű fogászati rendelőkezelő rendszer, amely árajánlat-készítést, pácienskezelést, időpont-foglalást, számlázást és fogászati státusz-nyilvántartást biztosít. Magyar fogászati rendelők számára készült, NEAK-integrációval és többnyelvű felülettel.

## Technológiai stack

### Frontend
- **React 18.3** + **TypeScript 5.5** — SPA architektúra
- **Vite 7.3** — fejlesztői szerver és build rendszer
- **React Router 6** — kliens oldali útvonalkezelés
- **Tailwind CSS 3.4** — utility-first CSS keretrendszer, egyedi témaváltozókkal
- **React Hook Form** — űrlapkezelés validációval
- **jsPDF + html2canvas** — PDF generálás (árajánlatok, számlák)
- **XLSX** — Excel import/export

### Backend
- **Fastify 5.7** — nagy teljesítményű HTTP szerver
- **Prisma 5.19** — ORM PostgreSQL adatbázissal
- **TypeScript 5.6** — típusbiztos szerverfejlesztés
- **Twilio** — SMS értesítések
- **Nodemailer** — e-mail értesítések
- **Google Calendar API** (`@googleapis/calendar`) — naptár szinkronizáció
- **Szamlazz.hu API** — magyar elektronikus számlázás

### Adatbázis
- **PostgreSQL** — relációs adatbázis Prisma ORM-mel
- 30+ adatmodell (páciensek, árajánlatok, számlák, időpontok, NEAK, stb.)

## Funkciók

### Pácienskezelés
- Páciens nyilvántartás részletes demográfiai adatokkal (név, születési hely/idő, anyja neve, TAJ szám, lakcím)
- Számlázási adatok kezelése (cégnév, adószám, számlázási cím)
- Páciens karton fülekkel: Státusz, Karton, Kezelések, Naptár, Értesítések, Árajánlatok, Számlák, NEAK
- NEAK jogviszony-ellenőrzés TAJ szám alapján
- Páciens archiválás és duplikálás
- Páciens típusok és kedvezmények kezelése
- Dinamikus oldalsáv a páciens nevével

### Árajánlat-készítés
- Többtételes árajánlatok katalógus-keresővel
- Tételes vagy globális kedvezmény kezelés
- Státusz munkafolyamat: Piszkozat → Megkezdett → Befejezett / Elutasított / Lezárt
- Számlagenerálás árajánlatból
- PDF export egyedi formázással (logo, fejléc, lábléc)
- Odontogram integráció fogspecifikus tételekhez
- Vizuális árajánlat-szerkesztő SVG fogdiagrammal

### Odontogram (Fogászati státusz)
- Interaktív fogdiagram-szerkesztő SVG alapon
- Kezelés-dokumentáció: tömés, korona, endodontia, gyökérkezelés, hiányzó fog, stb.
- Fogállapot-pillanatképek idővonallal
- Automatikus mentés (localStorage/IndexedDB)
- Import/export JSON formátumban

### Naptár és időpontkezelés
- Többszékes rendelői naptár (napi, heti, hónavi nézet)
- Drag & drop időpont-kezelés
- Google Naptár szinkronizáció (push/pull/kétirányú)
- Webhook alapú valós idejű szinkron (HTTPS production környezetben)
- Polling alapú szinkron (fejlesztői környezetben)
- Időponttípusok egyedi színekkel és időtartamokkal
- Páciens kartonból közvetlenül új időpont létrehozása

### Számlázás
- Szamlazz.hu API integráció (teszt és éles mód)
- Számlakészítés árajánlatból
- Sztornó (érvénytelenítés) támogatás
- PDF előnézet küldés előtt
- NAV-kompatibilis XML formátum
- Fizetési módok kezelése (készpénz, átutalás, kártya)

### Értesítések
- **SMS** — Twilio integráció küldéssel és előzménynaplóval
- **E-mail** — SMTP (Nodemailer) integráció küldéssel és előzménynaplóval
- Függőben lévő üzenetek áttekintése
- Sablonrendszer változó-behelyettesítéssel
- Páciens kartonból közvetlenül SMS/e-mail küldés

### NEAK integráció
- TAJ szám alapú jogviszony-ellenőrzés (OJOTE)
- NEAK katalógustételek kezelése időkorlátokkal és fog-megkötésekkel
- NEAK árlista automatikus importálása
- NEAK dokumentumtípusok, szintek, speciális kódok kezelése

### Katalógus és árlisták
- Többféle árlista kezelése (alapértelmezett, NEAK, felhasználói)
- Többnyelvű tételnevek és leírások
- SVG rétegek vizuális fog-kijelöléshez
- Kategóriarendszer árlistánként
- Katalógustétel aktiválás/archiválás
- CSV import/export

### Felhasználói felület
- **Sötét/világos mód** — automatikus (rendszer), kézi váltás, CSS változókkal
- **Háromnyelvű felület** — Magyar (elsődleges), Angol, Német
- Reszponzív design oldalsáv-navigációval
- Téma-átmeneti animáció módváltáskor

### Adminisztráció
- Felhasználókezelés (admin, orvos, asszisztens, recepciós, felhasználó, béta tesztelő)
- Granulált jogosultságkezelés (RBAC) felhasználónkénti felülírással
- Jogosultság-módosítási auditnapló
- Felhasználói tevékenységnapló
- Látogatói analitika

### Adatkezelés
- Teljes export/import (páciensek, árajánlatok, katalógus)
- CSV és JSON formátumok
- Adatbázis-statisztikák (táblaméret, sorszámok)
- Adatbázis-böngésző közvetlen táblalekérdezéssel
- Használat nyomon követése

## Telepítés és futtatás

### Előfeltételek
- Node.js 20+
- PostgreSQL 14+
- npm vagy yarn

### Fejlesztői környezet

```bash
# Klónozás
git clone https://github.com/ZoliQua/DentalQuoteCreator.git
cd DentalQuoteCreator

# Frontend függőségek telepítése
npm install

# Backend függőségek telepítése
cd backend && npm install && cd ..

# Környezeti változók beállítása
cp backend/.env.example backend/.env
# Szerkeszd a backend/.env fájlt a saját adataiddal

# Adatbázis migrációk futtatása
cd backend && npx prisma migrate dev && cd ..

# Fejlesztői szerver indítása (frontend + backend)
npm run dev
```

A frontend elérhető: `http://localhost:5173`
A backend API elérhető: `http://localhost:4000/backend`

### Környezeti változók

| Változó | Leírás |
|---------|--------|
| `DATABASE_URL` | PostgreSQL kapcsolati string |
| `PORT` | Backend port (alapértelmezett: 4000) |
| `ADMIN_EMAIL` | Kezdő admin e-mail cím |
| `ADMIN_PASSWORD` | Kezdő admin jelszó |
| `SZAMLAZZ_AGENT_KEY_TEST` | Szamlazz.hu teszt API kulcs |
| `SZAMLAZZ_AGENT_KEY_LIVE` | Szamlazz.hu éles API kulcs |
| `INVOICE_MODE` | Számlázási mód: `test` vagy `live` |
| `TWILIO_ACCOUNT_SID` | Twilio fiók azonosító |
| `TWILIO_AUTH_TOKEN` | Twilio hitelesítési token |
| `TWILIO_PHONE_NUMBER` | Twilio telefonszám |
| `SMTP_HOST` | SMTP szerver (pl. smtp.gmail.com) |
| `SMTP_PORT` | SMTP port (alapértelmezett: 587) |
| `SMTP_USER` | SMTP felhasználónév |
| `SMTP_PASS` | SMTP jelszó |
| `SMTP_FROM_EMAIL` | Küldő e-mail cím |
| `SMTP_FROM_NAME` | Küldő neve |
| `NEAK_OJOTE_KEY` | NEAK OJOTE API kulcs |
| `NEAK_OJOTE_ENV` | NEAK környezet: `test` vagy `production` |

### Build és élesítés

```bash
# Frontend build
npm run build

# Backend build
cd backend && npm run build

# Szerver indítása
cd backend && npm start
```

## Projektstruktúra

```
DentalQuoteCreator/
├── src/                          # Frontend forráskód
│   ├── components/               # React komponensek
│   │   ├── calendar/             # Időpont-kezelő modal
│   │   ├── common/               # Újrahasználható UI komponensek
│   │   ├── email/                # E-mail küldés és előzmények
│   │   ├── layout/               # Oldalsáv, navigáció
│   │   ├── notifications/        # Értesítés-megjelenítés
│   │   ├── odontogram/           # Fogállapot-szerkesztő
│   │   ├── pdf/                  # PDF generátorok
│   │   └── sms/                  # SMS küldés és előzmények
│   ├── context/                  # React kontextusok (App, Auth, Settings)
│   ├── hooks/                    # Egyedi hookok (usePatients, useQuotes, stb.)
│   ├── i18n/                     # Fordítások (hu, en, de)
│   ├── modules/                  # Önálló modulok
│   │   ├── dq-calendar/          # Egyedi naptár komponens
│   │   ├── dq-importer/          # Páciens importáló
│   │   ├── dq-sms/               # SMS backend modul
│   │   └── odontogram/           # Odontogram motor
│   ├── pages/                    # Oldal-komponensek
│   └── types/                    # TypeScript típusdefiníciók
├── backend/                      # Backend forráskód
│   ├── src/server.ts             # Fastify szerver (API útvonalak)
│   ├── prisma/schema.prisma      # Adatbázis séma
│   └── prisma/seed.ts            # Adatbázis feltöltő
├── deploy/                       # Élesítési konfigurációk
└── src/data/                     # CSV referencia-adatok
```

## Jogosultsági rendszer

| Szerep | Leírás |
|--------|--------|
| `admin` | Teljes hozzáférés minden funkcióhoz |
| `doctor` | Orvosi funkciók (páciensek, árajánlatok, számlák, naptár) |
| `assistant` | Asszisztensi funkciók (páciensek, naptár, korlátozott szerkesztés) |
| `receptionist` | Recepciós funkciók (páciensek megtekintése, naptár) |
| `user` | Alapszintű olvasási jogosultság |
| `beta_tester` | Tesztelői hozzáférés kísérleti funkciókhoz |

A jogosultságok felhasználónként felülírhatók az Admin oldalon.

</details>

---

<details>
<summary>🇬🇧 <b>English documentation</b></summary>

## Overview

DentalQuoteCreator is a comprehensive dental practice management system providing quote creation, patient management, appointment scheduling, invoicing, and dental status tracking. Built for Hungarian dental clinics with NEAK (national health insurance) integration and multilingual interface support.

## Tech Stack

### Frontend
- **React 18.3** + **TypeScript 5.5** — SPA architecture
- **Vite 7.3** — dev server and build system
- **React Router 6** — client-side routing
- **Tailwind CSS 3.4** — utility-first CSS framework with custom theme variables
- **React Hook Form** — form handling with validation
- **jsPDF + html2canvas** — PDF generation (quotes, invoices)
- **XLSX** — Excel import/export

### Backend
- **Fastify 5.7** — high-performance HTTP server
- **Prisma 5.19** — ORM with PostgreSQL
- **TypeScript 5.6** — type-safe server development
- **Twilio** — SMS notifications
- **Nodemailer** — email notifications
- **Google Calendar API** (`@googleapis/calendar`) — calendar synchronization
- **Szamlazz.hu API** — Hungarian electronic invoicing

### Database
- **PostgreSQL** — relational database with Prisma ORM
- 30+ data models (patients, quotes, invoices, appointments, NEAK, etc.)

## Features

### Patient Management
- Patient records with detailed demographics (name, birthplace/date, mother's name, TAJ number, address)
- Billing information management (company name, tax ID, billing address)
- Tabbed patient detail view: Status, Card, Treatments, Calendar, Notifications, Quotes, Invoices, NEAK
- NEAK eligibility verification via TAJ number
- Patient archival and duplication
- Patient types and discount management
- Dynamic sidebar displaying patient name

### Quote Creation
- Multi-item quotes with catalog search
- Per-item or global discount management
- Status workflow: Draft → Started → Completed / Rejected / Closed
- Invoice generation from quotes
- PDF export with custom formatting (logo, header, footer)
- Odontogram integration for tooth-specific items
- Visual quote editor with SVG tooth diagram

### Odontogram (Dental Status)
- Interactive SVG-based tooth chart editor
- Treatment documentation: fillings, crowns, endodontics, root treatment, missing teeth, etc.
- Tooth status snapshots with timeline history
- Auto-save (localStorage/IndexedDB)
- JSON import/export

### Calendar & Appointments
- Multi-chair clinic calendar (day, week, month views)
- Drag & drop appointment management
- Google Calendar sync (push/pull/bidirectional)
- Webhook-based real-time sync (HTTPS production environments)
- Polling-based sync (development environments)
- Appointment types with custom colors and durations
- Create appointments directly from patient card

### Invoicing
- Szamlazz.hu API integration (test and live modes)
- Invoice creation from quotes
- Storno (reversal) support
- PDF preview before sending
- NAV-compatible XML format
- Payment method tracking (cash, transfer, card)

### Notifications
- **SMS** — Twilio integration with sending and history log
- **Email** — SMTP (Nodemailer) integration with sending and history log
- Pending messages overview
- Template system with variable substitution
- Send SMS/email directly from patient card

### NEAK Integration
- TAJ number-based eligibility verification (OJOTE)
- NEAK catalog items with time limits and tooth restrictions
- Automatic NEAK price list import
- NEAK document types, levels, special codes

### Catalog & Price Lists
- Multiple price list management (default, NEAK, user-locked)
- Multilingual item names and descriptions
- SVG layers for visual tooth selection
- Category system per price list
- Catalog item activation/archival
- CSV import/export

### User Interface
- **Dark/light mode** — automatic (system), manual toggle, CSS custom properties
- **Trilingual interface** — Hungarian (primary), English, German
- Responsive design with sidebar navigation
- Theme transition animation on mode switch

### Administration
- User management (admin, doctor, assistant, receptionist, user, beta tester)
- Granular permission management (RBAC) with per-user overrides
- Permission change audit log
- User activity log
- Visitor analytics

### Data Management
- Full export/import (patients, quotes, catalog)
- CSV and JSON formats
- Database statistics (table sizes, row counts)
- Database browser with direct table querying
- Usage tracking

## Installation & Running

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Development

```bash
# Clone
git clone https://github.com/ZoliQua/DentalQuoteCreator.git
cd DentalQuoteCreator

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your own values

# Run database migrations
cd backend && npx prisma migrate dev && cd ..

# Start development server (frontend + backend)
npm run dev
```

Frontend: `http://localhost:5173`
Backend API: `http://localhost:4000/backend`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Backend port (default: 4000) |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Bootstrap admin password |
| `SZAMLAZZ_AGENT_KEY_TEST` | Szamlazz.hu test API key |
| `SZAMLAZZ_AGENT_KEY_LIVE` | Szamlazz.hu live API key |
| `INVOICE_MODE` | Invoice mode: `test` or `live` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `SMTP_HOST` | SMTP server (e.g., smtp.gmail.com) |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM_EMAIL` | Sender email address |
| `SMTP_FROM_NAME` | Sender display name |
| `NEAK_OJOTE_KEY` | NEAK OJOTE API key |
| `NEAK_OJOTE_ENV` | NEAK environment: `test` or `production` |

### Build & Deploy

```bash
# Frontend build
npm run build

# Backend build
cd backend && npm run build

# Start server
cd backend && npm start
```

## Project Structure

```
DentalQuoteCreator/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── calendar/             # Appointment modal
│   │   ├── common/               # Reusable UI components
│   │   ├── email/                # Email sending & history
│   │   ├── layout/               # Sidebar, navigation
│   │   ├── notifications/        # Notification display
│   │   ├── odontogram/           # Dental status editor
│   │   ├── pdf/                  # PDF generators
│   │   └── sms/                  # SMS sending & history
│   ├── context/                  # React contexts (App, Auth, Settings)
│   ├── hooks/                    # Custom hooks (usePatients, useQuotes, etc.)
│   ├── i18n/                     # Translations (hu, en, de)
│   ├── modules/                  # Standalone modules
│   │   ├── dq-calendar/          # Custom calendar component
│   │   ├── dq-importer/          # Patient importer
│   │   ├── dq-sms/               # SMS backend module
│   │   └── odontogram/           # Odontogram engine
│   ├── pages/                    # Page components
│   └── types/                    # TypeScript type definitions
├── backend/                      # Backend source code
│   ├── src/server.ts             # Fastify server (API routes)
│   ├── prisma/schema.prisma      # Database schema
│   └── prisma/seed.ts            # Database seeder
├── deploy/                       # Deployment configs
└── src/data/                     # CSV reference data
```

## Permission System

| Role | Description |
|------|-------------|
| `admin` | Full access to all features |
| `doctor` | Medical functions (patients, quotes, invoices, calendar) |
| `assistant` | Assistant functions (patients, calendar, limited editing) |
| `receptionist` | Reception functions (view patients, calendar) |
| `user` | Basic read-only access |
| `beta_tester` | Test access to experimental features |

Permissions can be overridden per user on the Admin page.

</details>

---

<details>
<summary>🇩🇪 <b>Deutsche Dokumentation</b></summary>

## Überblick

DentalQuoteCreator ist ein umfassendes Zahnarztpraxis-Verwaltungssystem, das Kostenvoranschläge, Patientenverwaltung, Terminplanung, Rechnungsstellung und zahnärztliche Statusdokumentation bietet. Entwickelt für ungarische Zahnarztpraxen mit NEAK-Integration (nationale Krankenversicherung) und mehrsprachiger Benutzeroberfläche.

## Technologie-Stack

### Frontend
- **React 18.3** + **TypeScript 5.5** — SPA-Architektur
- **Vite 7.3** — Entwicklungsserver und Build-System
- **React Router 6** — clientseitiges Routing
- **Tailwind CSS 3.4** — Utility-first CSS-Framework mit eigenen Theme-Variablen
- **React Hook Form** — Formularverarbeitung mit Validierung
- **jsPDF + html2canvas** — PDF-Generierung (Kostenvoranschläge, Rechnungen)
- **XLSX** — Excel-Import/Export

### Backend
- **Fastify 5.7** — Hochleistungs-HTTP-Server
- **Prisma 5.19** — ORM mit PostgreSQL
- **TypeScript 5.6** — typsichere Serverentwicklung
- **Twilio** — SMS-Benachrichtigungen
- **Nodemailer** — E-Mail-Benachrichtigungen
- **Google Calendar API** (`@googleapis/calendar`) — Kalendersynchronisation
- **Szamlazz.hu API** — ungarische elektronische Rechnungsstellung

### Datenbank
- **PostgreSQL** — relationale Datenbank mit Prisma ORM
- 30+ Datenmodelle (Patienten, Kostenvoranschläge, Rechnungen, Termine, NEAK usw.)

## Funktionen

### Patientenverwaltung
- Patientenakten mit detaillierten demografischen Daten (Name, Geburtsort/-datum, Muttername, TAJ-Nummer, Adresse)
- Rechnungsdatenverwaltung (Firmenname, Steuernummer, Rechnungsadresse)
- Patientendetail-Ansicht mit Reitern: Status, Kartei, Behandlungen, Kalender, Benachrichtigungen, Kostenvoranschläge, Rechnungen, NEAK
- NEAK-Berechtigungsprüfung über TAJ-Nummer
- Patientenarchivierung und Duplizierung
- Patiententypen und Rabattverwaltung
- Dynamische Seitenleiste mit Patientennamen

### Kostenvoranschlag-Erstellung
- Mehrzeilige Kostenvoranschläge mit Katalogsuche
- Positions- oder Gesamtrabatt-Verwaltung
- Status-Workflow: Entwurf → Begonnen → Abgeschlossen / Abgelehnt / Geschlossen
- Rechnungsgenerierung aus Kostenvoranschlägen
- PDF-Export mit individueller Formatierung (Logo, Kopf-/Fußzeile)
- Odontogramm-Integration für zahnspezifische Positionen
- Visueller Kostenvoranschlag-Editor mit SVG-Zahndiagramm

### Odontogramm (Zahnstatus)
- Interaktiver SVG-basierter Zahnschema-Editor
- Behandlungsdokumentation: Füllungen, Kronen, Endodontie, Wurzelbehandlung, fehlende Zähne usw.
- Zahnstatus-Momentaufnahmen mit Zeitstrahl
- Automatische Speicherung (localStorage/IndexedDB)
- JSON-Import/Export

### Kalender & Terminverwaltung
- Mehrstuhl-Praxiskalender (Tages-, Wochen-, Monatsansicht)
- Drag & Drop Terminverwaltung
- Google Kalender-Synchronisation (Push/Pull/bidirektional)
- Webhook-basierte Echtzeit-Synchronisation (HTTPS-Produktionsumgebungen)
- Polling-basierte Synchronisation (Entwicklungsumgebungen)
- Termintypen mit individuellen Farben und Dauern
- Termine direkt aus der Patientenkartei erstellen

### Rechnungsstellung
- Szamlazz.hu API-Integration (Test- und Live-Modus)
- Rechnungserstellung aus Kostenvoranschlägen
- Storno-Unterstützung (Stornierung)
- PDF-Vorschau vor dem Versand
- NAV-kompatibles XML-Format
- Zahlungsmethoden-Verfolgung (Bargeld, Überweisung, Karte)

### Benachrichtigungen
- **SMS** — Twilio-Integration mit Versand und Verlaufsprotokoll
- **E-Mail** — SMTP (Nodemailer) Integration mit Versand und Verlaufsprotokoll
- Übersicht ausstehender Nachrichten
- Vorlagensystem mit Variablenersetzung
- SMS/E-Mail direkt aus der Patientenkartei senden

### NEAK-Integration
- TAJ-Nummer-basierte Berechtigungsprüfung (OJOTE)
- NEAK-Katalogpositionen mit Zeitlimits und Zahnbeschränkungen
- Automatischer NEAK-Preislistenimport
- NEAK-Dokumenttypen, Ebenen, Sondercodes

### Katalog & Preislisten
- Verwaltung mehrerer Preislisten (Standard, NEAK, benutzerdefiniert)
- Mehrsprachige Positionsnamen und Beschreibungen
- SVG-Ebenen für visuelle Zahnauswahl
- Kategoriesystem pro Preisliste
- Katalogposition-Aktivierung/Archivierung
- CSV-Import/Export

### Benutzeroberfläche
- **Dunkel-/Hellmodus** — automatisch (System), manueller Wechsel, CSS Custom Properties
- **Dreisprachige Oberfläche** — Ungarisch (primär), Englisch, Deutsch
- Responsives Design mit Seitenleisten-Navigation
- Theme-Übergangsanimation beim Moduswechsel

### Administration
- Benutzerverwaltung (Admin, Arzt, Assistent, Rezeptionist, Benutzer, Beta-Tester)
- Granulare Berechtigungsverwaltung (RBAC) mit benutzerweisen Überschreibungen
- Berechtigungsänderungs-Auditprotokoll
- Benutzeraktivitätsprotokoll
- Besucheranalyse

### Datenverwaltung
- Vollständiger Export/Import (Patienten, Kostenvoranschläge, Katalog)
- CSV- und JSON-Formate
- Datenbankstatistiken (Tabellengrößen, Zeilenzahlen)
- Datenbankbrowser mit direkter Tabellenabfrage
- Nutzungsverfolgung

## Installation & Ausführung

### Voraussetzungen
- Node.js 20+
- PostgreSQL 14+
- npm oder yarn

### Entwicklung

```bash
# Klonen
git clone https://github.com/ZoliQua/DentalQuoteCreator.git
cd DentalQuoteCreator

# Frontend-Abhängigkeiten installieren
npm install

# Backend-Abhängigkeiten installieren
cd backend && npm install && cd ..

# Umgebungsvariablen einrichten
cp backend/.env.example backend/.env
# Bearbeiten Sie backend/.env mit Ihren eigenen Werten

# Datenbankmigrationen ausführen
cd backend && npx prisma migrate dev && cd ..

# Entwicklungsserver starten (Frontend + Backend)
npm run dev
```

Frontend: `http://localhost:5173`
Backend-API: `http://localhost:4000/backend`

### Umgebungsvariablen

| Variable | Beschreibung |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring |
| `PORT` | Backend-Port (Standard: 4000) |
| `ADMIN_EMAIL` | Bootstrap-Admin-E-Mail |
| `ADMIN_PASSWORD` | Bootstrap-Admin-Passwort |
| `SZAMLAZZ_AGENT_KEY_TEST` | Szamlazz.hu Test-API-Schlüssel |
| `SZAMLAZZ_AGENT_KEY_LIVE` | Szamlazz.hu Live-API-Schlüssel |
| `INVOICE_MODE` | Rechnungsmodus: `test` oder `live` |
| `TWILIO_ACCOUNT_SID` | Twilio-Konto-SID |
| `TWILIO_AUTH_TOKEN` | Twilio-Auth-Token |
| `TWILIO_PHONE_NUMBER` | Twilio-Telefonnummer |
| `SMTP_HOST` | SMTP-Server (z.B. smtp.gmail.com) |
| `SMTP_PORT` | SMTP-Port (Standard: 587) |
| `SMTP_USER` | SMTP-Benutzername |
| `SMTP_PASS` | SMTP-Passwort |
| `SMTP_FROM_EMAIL` | Absender-E-Mail-Adresse |
| `SMTP_FROM_NAME` | Absender-Anzeigename |
| `NEAK_OJOTE_KEY` | NEAK OJOTE API-Schlüssel |
| `NEAK_OJOTE_ENV` | NEAK-Umgebung: `test` oder `production` |

### Build & Deployment

```bash
# Frontend-Build
npm run build

# Backend-Build
cd backend && npm run build

# Server starten
cd backend && npm start
```

## Projektstruktur

```
DentalQuoteCreator/
├── src/                          # Frontend-Quellcode
│   ├── components/               # React-Komponenten
│   │   ├── calendar/             # Termin-Modal
│   │   ├── common/               # Wiederverwendbare UI-Komponenten
│   │   ├── email/                # E-Mail-Versand & Verlauf
│   │   ├── layout/               # Seitenleiste, Navigation
│   │   ├── notifications/        # Benachrichtigungsanzeige
│   │   ├── odontogram/           # Zahnstatus-Editor
│   │   ├── pdf/                  # PDF-Generatoren
│   │   └── sms/                  # SMS-Versand & Verlauf
│   ├── context/                  # React-Kontexte (App, Auth, Settings)
│   ├── hooks/                    # Custom Hooks (usePatients, useQuotes usw.)
│   ├── i18n/                     # Übersetzungen (hu, en, de)
│   ├── modules/                  # Eigenständige Module
│   │   ├── dq-calendar/          # Eigene Kalenderkomponente
│   │   ├── dq-importer/          # Patientenimporter
│   │   ├── dq-sms/               # SMS-Backend-Modul
│   │   └── odontogram/           # Odontogramm-Engine
│   ├── pages/                    # Seitenkomponenten
│   └── types/                    # TypeScript-Typdefinitionen
├── backend/                      # Backend-Quellcode
│   ├── src/server.ts             # Fastify-Server (API-Routen)
│   ├── prisma/schema.prisma      # Datenbankschema
│   └── prisma/seed.ts            # Datenbank-Seeder
├── deploy/                       # Deployment-Konfigurationen
└── src/data/                     # CSV-Referenzdaten
```

## Berechtigungssystem

| Rolle | Beschreibung |
|-------|-------------|
| `admin` | Vollzugriff auf alle Funktionen |
| `doctor` | Medizinische Funktionen (Patienten, Kostenvoranschläge, Rechnungen, Kalender) |
| `assistant` | Assistenzfunktionen (Patienten, Kalender, eingeschränkte Bearbeitung) |
| `receptionist` | Empfangsfunktionen (Patienten anzeigen, Kalender) |
| `user` | Grundlegender Lesezugriff |
| `beta_tester` | Testzugriff auf experimentelle Funktionen |

Berechtigungen können pro Benutzer auf der Admin-Seite überschrieben werden.

</details>

---

## Quick Start

```bash
git clone https://github.com/ZoliQua/DentalQuoteCreator.git
cd DentalQuoteCreator
npm install && cd backend && npm install && cd ..
cp backend/.env.example backend/.env  # edit with your values
cd backend && npx prisma migrate dev && cd ..
npm run dev
```

## Author

**Zoltán Mackó** — [macko.dental@gmail.com](mailto:macko.dental@gmail.com)

---

*Built with React, Fastify, Prisma, and PostgreSQL.*
