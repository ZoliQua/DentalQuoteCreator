# HL7 FHIR R4 Export — Design Spec

**Date:** 2026-06-14
**Component:** React Odontogram Editor Modul (submodule `src/modules/odontogram/engine`)
**Status:** Approved design, pending implementation plan

## Goal

Add an HL7 FHIR R4 export to the odontogram engine that maps the full
per-tooth dental chart state into a portable, standards-compliant FHIR
`Bundle`. The export targets the **general / portable R4** use case
(international base profile, no national profile constraints) so other
systems can ingest the data and patients' charts are portable.

This feature is implemented **only in the odontogram engine**. Patient,
treatment-plan (Quote), and timeline integration in the host
DentalQuoteCreator app are **future work, not in scope here** — but the
export API exposes a `subject` parameter as the integration seam for that
future work.

## Scope

**In scope:**
- Pure mapping function from odontogram state → FHIR R4 `Bundle`.
- Comprehensive coverage of every clinically meaningful per-tooth field.
- A public engine API method `exportFhir(options?)` that triggers a JSON
  file download, mirroring the existing `exportStatus()`.
- A "Export FHIR (JSON)" UI entry alongside the existing export.
- Unit tests (Vitest).

**Out of scope (future):**
- FHIR import (parsing a Bundle back into odontogram state).
- Host-app integration with real Patient / Practitioner / Quote data.
- National profiles (e.g. Hungarian EESZT), `document`-type Bundles with
  a `Composition`.

## Key decisions (approved)

- **Target:** general / portable HL7 FHIR R4, international base profile.
- **Location:** engine submodule, new `src/fhir/` directory. The mapping
  is a pure function — no DOM, no network.
- **Bundle type:** `collection`.
- **Modeling:** one `Observation` per clinically meaningful finding.
- **Coding:** hybrid — every `CodeableConcept` always carries a local
  CodeSystem code (round-trip fidelity) and, where a well-known code
  exists, a SNOMED CT coding too.
- **Tooth identification:** `Observation.bodySite` using ISO 3950 / FDI
  notation with the recognized system URL, derived from the internal FDI
  key regardless of the active display numbering system.
- **Surfaces:** represented as `Observation.component` entries (one per
  affected surface), with SNOMED surface codes where available.
- **Subject handling:** `options.subject` is optional. When absent, a
  placeholder `Patient` resource is included in the Bundle and every
  `Observation.subject` references it. When supplied by a future host,
  no placeholder is emitted.
- **FHIR types:** add `@types/fhir` as a **devDependency** (type-only,
  zero runtime cost — consistent with the engine's "minimal bundle" rule).
- **Export only** in this iteration.

## Module structure

Small, focused units under `src/fhir/`:

- `src/fhir/types.ts` — FHIR R4 types needed by the mapper (re-exported
  from `@types/fhir` plus any local option types like `FhirExportOptions`).
- `src/fhir/codesystems.ts` — single source of truth for:
  - the local CodeSystem canonical URL + enum→{code, display} maps for
    every odontogram enum (toothSelection, endo, caries, fillingMaterial,
    fillingSurfaces, crownMaterial, bridgeUnit, mobility, mods, …),
  - SNOMED CT code constants for findings/surfaces that have well-known
    codes,
  - the ISO 3950 / FDI tooth system URL and FDI code helper.
- `src/fhir/toFhir.ts` — `buildFhirBundle(state, options?): Bundle`, the
  pure mapping core; plus small per-domain helpers (tooth presence,
  caries, restorations, endo, prosthetics, periodontal, structural,
  planning, notes).

Public API wiring (mirrors `exportStatus`):
- `exportFhir(options?: FhirExportOptions): void` in the engine API
  (`odontogram.ts` / `App.tsx`), builds the Bundle and downloads it.
- `buildFhirBundle` is exported so the future host app can call it
  directly with a real `subject`.

## Data mapping

`Bundle` (`type: "collection"`) entries:
1. Optional placeholder `Patient` (only when no `subject` supplied).
2. One `Observation` (`category: exam`) per clinically meaningful finding.

For each tooth (FDI 11–48):
- `bodySite` → FDI/ISO 3950 coding for the tooth number.
- `code` → the finding type (e.g. caries, endodontic status, restoration,
  crown material, mobility, prosthetic unit, structural damage, planned
  extraction), hybrid-coded (local + SNOMED where known).
- `value[x]` → the specific state/value, hybrid-coded.
- `component[]` → affected surfaces for surface-bound findings
  (caries/fillings), surface-coded.
- `note` → the per-tooth `note` text when present.

Fields covered comprehensively:
`toothSelection` (missing / implant / milk tooth / crown prep / under-gum /
post-extraction), `caries[]`, `endo`, `fillingMaterial` + `fillingSurfaces[]`,
`fissureSealing`, `crownMaterial`, `bridgeUnit` / `bridgePillar`,
`mobility`, `mods[]` (inflammation / parodontal / mobility), `pulpInflam`,
`endoResection`, `brokenMesial/Incisal/Distal`, `bruxismWear` /
`bruxismNeckWear`, `parapulpalPin`, `crownReplace` / `crownNeeded`,
`extractionPlan` / `extractionWound`, `missingClosed`, `customStates`,
plus the relevant `globals` (e.g. `edentulous`).

## Error handling / edge cases

- Healthy / unset tooth → emits no Observation (only real findings appear).
- Empty odontogram → valid Bundle containing just the (placeholder)
  Patient; never throws.
- Unknown / future enum value → emitted with its local code and a display
  string; no exception (forward compatibility).
- Missing `subject` → placeholder Patient + all `subject` references point
  to it.
- `customStates` / plugin data → mapped via local codes where structure is
  known; unknown shapes are skipped without throwing (no silent corruption,
  no exception).

## UI

- Add an "Export FHIR (JSON)" action next to the existing JSON export in
  the topbar, following the current export control's pattern.
- Available in `readOnly` mode (export is non-mutating).
- New i18n keys for the label across all 8 supported languages
  (Hungarian first as the authoritative source, per project convention).

## Testing (Vitest)

- Representative tooth states → correct number of Observations, correct
  FDI tooth code, correct surface components, presence of both local and
  (where expected) SNOMED codings.
- Empty state → valid minimal Bundle, no throw.
- `subject` supplied vs omitted → placeholder presence/absence and correct
  `subject` references.
- Unknown enum value → mapped via local code, no throw.
- Structural validity assertions for required FHIR fields
  (`resourceType`, `Bundle.type`, `Observation.status`, `code`, `subject`).
- No full external FHIR validator is pulled in.

## Versioning

- Internal JSON export schema stays `"1.3"` (unchanged; separate artifact).
- Bump engine `package.json` to `1.5.0` at release (new feature, minor).
- Update `README.md` feature list and `CHANGELOG`/changelog section.

## Risks

- Coverage completeness: every enum must be mapped or it silently drops a
  finding. Mitigation: enum→code maps centralized in `codesystems.ts`; a
  test asserts each enum member has a local code.
- SNOMED code accuracy: only well-known codes are used; everything is
  always backed by a local code, so an imperfect/missing SNOMED code never
  breaks round-trip fidelity.
- Submodule boundary: feature lives entirely in the engine; no
  DentalQuoteCreator-specific imports (per engine CLAUDE.md).
