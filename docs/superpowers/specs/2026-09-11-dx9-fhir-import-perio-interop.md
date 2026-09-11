# DX-9 — FHIR import: periodontal round-trip + external-bundle tolerance

Date: 2026-09-11 · Repo: React Advanced Odontogram engine · Part B of the "deepen interoperability" arc (A = DX-8 code specificity, done).

## 1. Goal
The FHIR importer only reads engine-local Observation codes and our own Condition ids/WHO codes. Two gaps: (1) the periodontal panel (LOINC 74029-0 with per-site components) is exported but never imported — perio data round-trips through JSON only; (2) a Bundle coded only in ICD-10-CM or SNOMED CT (a foreign or CM-only system) loses its Conditions. Close both without touching the payload or the export.

## 2. Decisions (technical, chosen for maximal fidelity — no clinical trade-off involved)
- **Full perio mirror:** import PD, gingival margin, BOP per site; furcation per entrance; O'Leary plaque per surface; PI/GI/mPI/mBI per surface; keratinized-gingiva width; plus the smoking-status and HbA1c evidence Observations into the case block.
- **Gingival margin from CAL:** the export always carries CAL = PD + GM, so GM is reconstructed as CAL − PD (exact, including negative/pseudopocket values); the recession component (only gm > 0) is the fallback. Suppuration (`sup`) is not exported, so it does not round-trip — documented.
- **External Conditions:** a tooth/case Condition is recognised by (in order) our id convention, a WHO ICD-10 code (exact, then 3-character category), an ICD-10-CM code (exact via the CM pack's reverse map, then category — so DX-8's K02.5x/6x map to `caries`), or a SNOMED CT code where the catalog has one. Tooth-status Observations stay engine-local by nature (no standard codes exist); the perio panel is LOINC-based, so it imports from any producer using the same codes.

## 3. Design
- **`src/fhir/importPerio.ts` (new, pure):** `importPerioObservations(entries, teeth) → { case: { smokingStatus?, hba1c? } }`. For each Observation whose code is LOINC 74029-0: tooth from the FDI bodySite (deciduous → FDI); components classified by code — LOINC 32910-2 PD, 32912-8 CAL, 32911-0 recession, 34015-8 furcation; engine-local `perio-bop`, `plaque-surface`, `plaque-index-silness-loe`, `gingival-index-loe-silness`, `mod-plaque-index-mombelli`, `mod-bleeding-index-mombelli`, `keratinized-gingiva-width` — with the site/entrance/surface taken from the component's R4 backport `bodySite` extension (`perio-site:<S>`, `furcation-entrance:<e>`, `plaque-surface:<s>`, `site:buccal`). Writes `perio {pd, gm, bop}`, `furcation`, `plaque`, `pi/gi/mpi/mbi`, `kg` into the tooth record (omit-when-empty; only the known 6 sites / 4 entrances / 4 surfaces). Evidence: LOINC 72166-2 → `smoking-<v>` → `case.smokingStatus`; LOINC 4548-4 → `case.hba1c`. Never throws. `toFhirPerio.ts` exports `LOINC_SYSTEM`, `LOINC` and the extension URL so import and export share one source.
- **`registry/fromFhir.ts`:** calls the perio importer after the axis loop; merges its case fields with `caseConditions` into `payload.case` (only when non-empty). `version` stays `"2.20"`.
- **`importConditions.ts`:** `dxKeyOf`/`caseKeyOf` resolve a Condition's key across ICD-10 (exact → category), ICD-10-CM (reverse maps built from `ICD10CM_PACK.codes`/`caseCodes` → category) and SNOMED (`DX_CODES.snomed` reverse map).

## 4. Verification
Live round-trip: chart perio through the real setters (PD/GM incl. a negative GM, BOP, furcation, plaque, PI/GI, KG, implant mPI/mBI, smoking, HbA1c) → `exportFhir` → `parseFhirBundle` → assert every field; re-import and export again → the perio panels are byte-equal (idempotent). External Conditions: CM-only K02.52 + FDI → `caries` (no false override), CM K08.409 → `toothLoss` add, CM M26.609 → `tmjDisorder`, SNOMED 80967001 → `caries`, a CM K05.3xx perio Condition is ignored safely. Suite green; roundtrip/FHIR/SVG/shell-DOM goldens byte-identical (fixtures carry no perio; import-only change). Payload 2.22 unchanged.

## 5. Out of scope
Suppuration export/import; importing the periodontal classification overrides (not exported); general mapping of foreign non-LOINC perio observations; ValueSets/FHIR package (part C); `case` payload type (part D).
