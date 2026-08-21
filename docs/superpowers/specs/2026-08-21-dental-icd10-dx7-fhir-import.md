# Dental ICD-10 DX-7 — FHIR import round-trip of diagnosis Conditions

Date: 2026-08-21
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0..DX-6 merged on `main`. Payload 2.22.
Status: design approved (decisions locked with the owner below). **Final sub-project of the program.**

## 1. Goal

Close the FHIR round-trip: `parseFhirBundle` currently reconstructs the chart from
Observations only and never reads `Condition` resources. DX-7 makes it also
reconstruct the **diagnosis layer** — the case/regional conditions (whose only
carrier is the FHIR `Condition`) and the per-tooth `dxOverrides` (by diffing the
imported Conditions against the re-derived chart).

## 2. Decisions (locked with the owner)

- **Full round-trip:** import case conditions AND reconstruct `dxOverrides`.
- **Our-own export shape + WHO-code fallback:** match our export convention first
  (the `odontogram-case-<key>` / `odontogram-dx-<key>-<tooth>` id + our code
  systems), with a WHO ICD-10 code→key fallback so a reasonably-shaped external
  Condition is still recognized. General fuzzy multi-system interop is out of scope.
- **Additive, omit-when-empty:** `fromFhir` attaches `case`/`dxOverrides` only when
  non-empty; version stays `"2.20"`; all four goldens byte-identical.

## 3. Existing machinery

- `parseFhirBundle` (`src/fhir/fromFhir.ts`) → `parseFhirBundleFromRegistry`
  (`src/registry/fromFhir.ts:25`). The latter iterates `bundle.entry`, reads
  Observations into `teeth`/`globals`, and returns `{ version: "2.20", globals, teeth }`.
  It never inspects `Condition` resources.
- Export shapes to reverse: `appendCaseConditions` (`toFhirCase.ts`) → `Condition`
  id `odontogram-case-<key>`, patient subject, `code` = WHO(+pack/SNOMED),
  `bodySite` = `[{ coding: [{ LOCAL_SYSTEM, "laterality:<v>" }, (SNOMED qualifier)] }]`
  when lateralized. `appendDentalConditions` (`toFhirDx.ts`) → id
  `odontogram-dx-<key>-<toothNo>`, `bodySite` = FDI tooth.
- `deriveDentalDiagnoses` (`src/dx/derive.ts`) is pure (no `odontogram.ts` dep) →
  safe to import into `registry/fromFhir.ts`. `DX_CODES` (`src/dx/codes.ts`),
  `CASE_DX_CODES`/`VALID_CASE_KEY`/`LATERALIZABLE_CASE_KEYS` (`src/dx/caseCodes.ts`),
  `TOOTH_LEVEL_DX_KEYS` (`odontogram.ts` — but re-derivable locally to avoid the dep;
  see §4.4).
- The JSON `importStatus`/hydrate path already accepts `case.caseConditions` +
  `teeth[].dxOverrides` — once `fromFhir` produces them, the rest works unchanged.

## 4. Design

### 4.1 Hook + a dedicated module
Add `src/fhir/importConditions.ts` — a pure helper `importDiagnosisConditions(entries,
teeth)` returning `{ caseConditions: Record<string, Laterality>; dxOverridesByTooth:
Record<string, Record<string, "add"|"suppress">> }`. `parseFhirBundleFromRegistry`
calls it after building `teeth`, then attaches:
- `payload.case = { ...(existing case if any), caseConditions }` — only if `caseConditions`
  is non-empty;
- `teeth[t].dxOverrides = {...}` — only for teeth with a non-empty override map.
Keep everything omit-when-empty.

### 4.2 Reverse code maps (`importConditions.ts`)
Build once from the catalogs: `ICD10_TO_DX_KEY` (from `DX_CODES`, `icd10`→key, skipping
uncoded keys) and `ICD10_TO_CASE_KEY` (from `CASE_DX_CODES`). Used only for the WHO-code
fallback when an id doesn't match our convention.

### 4.3 Case conditions
For each `Condition` resource: derive its case key — first from `id` matching
`^odontogram-case-(.+)$` (validate the suffix ∈ `VALID_CASE_KEY`), else from the WHO
ICD-10 coding via `ICD10_TO_CASE_KEY`. Read laterality from `bodySite[0].coding`: the
`LOCAL_SYSTEM` coding `laterality:<v>` (v ∈ left/right/bilateral), else `"unspecified"`.
Coerce to `"unspecified"` if the key ∉ `LATERALIZABLE_CASE_KEYS`. Set
`caseConditions[key]`.

### 4.4 `dxOverrides` reconstruction (two safeguards)
- **Effective set:** group `Condition`s whose `id` matches `^odontogram-dx-(.+)-(\d+)$`
  (or WHO-code fallback for the key + FDI `bodySite` for the tooth) by tooth →
  `effective[tooth] = Set<key>`.
- **Raw set:** run `deriveDentalDiagnoses({ teeth })` on the just-built chart →
  `raw[tooth] = Set<key>`.
- **Safeguard A — catalog restriction:** intersect BOTH sets with the tooth-level
  add/suppress catalog before diffing (excludes peri-implant + perio, so the SNOMED
  toggle / uncoded keys can't produce a false `suppress`). **Derive the catalog
  LOCALLY** in `importConditions.ts` (`Object.keys(DX_CODES)` minus
  periodontitis/gingivitis/periImplantMucositis/periImplantitis) — do **NOT** import
  `TOOTH_LEVEL_DX_KEYS` from `odontogram.ts` (that would create a
  `registry/fromFhir → odontogram.ts` back-dependency / potential cycle). Add a
  drift-guard TEST that imports the real `TOOTH_LEVEL_DX_KEYS` (test-only, where a
  cycle doesn't matter) and asserts the local set equals it, so the two never diverge.
- **Safeguard B — section-present gate:** run the diff ONLY when the bundle contains
  ≥1 `odontogram-dx-*` Condition (our diagnosis section is present). A chart-only
  bundle (no dental Conditions) → skip entirely, so it is NEVER misread as
  "suppress every diagnosis".
- **Diff (per tooth, over the catalog-restricted sets):** `effective − raw` → `"add"`;
  `raw − effective` → `"suppress"`. Assign to `dxOverridesByTooth[tooth]`.

### 4.5 Known limitation (document in-code + spec)
The `suppress` direction is only as accurate as the chart's own FHIR round-trip: a
derive-input axis that does not round-trip through the Observations would make the
re-derived `raw` differ from the original and infer a spurious override. Our-own
export round-trips cleanly (the tests assert this); foreign/partial bundles are
best-effort. `add` is robust (a Condition for a non-derived catalog key is
unambiguous).

## 5. Verification
`tsc` clean, `eslint` 0 errors, full suite green. Tests:
- **Case import:** a bundle with an `odontogram-case-tmjDisorder` Condition
  (bodySite `laterality:right`) → `payload.case.caseConditions.tmjDisorder === "right"`;
  a non-lateralizable case Condition → `"unspecified"`; a WHO-code-only case Condition
  (no matching id) → still recognized via `ICD10_TO_CASE_KEY`.
- **dxOverrides add:** a bundle whose chart derives nothing on tooth 11 but carries an
  `odontogram-dx-calculus-11` Condition → `teeth["11"].dxOverrides.calculus === "add"`.
- **dxOverrides suppress:** a bundle whose chart derives caries on 11 (a caries
  Observation) AND has the diagnosis section present but NO `odontogram-dx-caries-11`
  Condition → `teeth["11"].dxOverrides.caries === "suppress"`.
- **Safeguard B:** a chart-only bundle (caries Observation, NO Condition entries) →
  NO `dxOverrides` produced (not a false suppress).
- **Full round-trip:** take a chart with a case condition + one `add` + one `suppress`,
  `buildFhirBundle` → `parseFhirBundle` → assert `case.caseConditions` and the two
  `dxOverrides` come back correctly.
- **Goldens byte-identical:** the roundtrip fixture has no case/override Conditions, so
  omit-when-empty keeps `roundtrip-golden.json` (+ the other three) unchanged. Version
  stays `"2.20"`.

## 6. Files
- **New:** `src/fhir/importConditions.ts` (+ tests under `src/__tests__/` /
  `src/fhir/__tests__/`).
- **Modify:** `src/registry/fromFhir.ts` (call the importer + attach case/dxOverrides
  omit-when-empty); `CHANGELOG.md`; `CODING_PACKS.md` (a note that FHIR import
  reconstructs the case conditions + dxOverrides for our-own-export bundles).

## 7. Out of scope
General fuzzy multi-system external-bundle interpretation (SNOMED/national-code
matching without our id convention). Importing derived tooth diagnoses as anything
other than the override diff (the chart itself is the source of truth for derived
findings). Any payload/version change, catalog/derivation change, export change, or
golden change. This is the last sub-project; DX-0..DX-7 then complete the program.
