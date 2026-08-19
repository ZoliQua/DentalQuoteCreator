# Dental ICD-10 DX-3b — case/regional conditions (broad, lateralized)

Date: 2026-08-19
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0/1/2/3a merged on `main`. Payload 2.21.
Status: design approved (decisions locked with the owner below).

## 1. Goal

Add the program's first **case-level, manually-authored** diagnoses: whole-mouth /
regional conditions that no per-tooth chart represents — malocclusion & TMJ (K07),
cysts of the oral region (K09), salivary-gland disease (K11), stomatitis & oral
mucosa (K12/K13), and arch-level developmental anomalies (K00). Each is authored on
the case (not a tooth), optionally lateralized, and exported as a **patient-level
FHIR `Condition`**.

## 2. Decisions (locked with the owner)

- **Broad coverage** across K07/K09/K11/K12/K00 + a K13 oral-mucosa extension — the
  full ~28-condition catalog in §3.1 (owner may still trim later).
- **Laterality qualifier:** lateralizable conditions carry
  `unspecified | left | right | bilateral`; the rest are whole-mouth/systemic.
- **Purely manual** — no derivation (there is no chart source), unlike DX-1.
- **Separate catalog** (`CASE_DX_CODES`) so the tooth-level derivation
  (`deriveDentalDiagnoses`, `DX_CODES`, `TOOTH_LEVEL_DX_KEYS`) is untouched.
- **Case-level home** on `CaseMeta`, serialized into the `case` payload key
  (omit-when-empty), like every other case field.

## 3. Design

### 3.1 The case-condition catalog (`src/dx/caseCodes.ts`)
`CaseConditionKey` union + `CASE_DX_CODES: Record<CaseConditionKey, CaseConditionCode>`,
where `CaseConditionCode = { icd10: string; icd10Display: string; lateralizable: boolean }`.
⟂ marks `lateralizable: true`.

| key | icd10 | display | ⟂ |
|-----|-------|---------|---|
| `jawSizeAnomaly` | K07.0 | Major anomalies of jaw size | |
| `jawBaseAnomaly` | K07.1 | Anomalies of jaw-cranial base relationship | |
| `archRelationAnomaly` | K07.2 | Anomalies of dental arch relationship | |
| `toothPositionAnomaly` | K07.3 | Anomalies of tooth position | |
| `malocclusionUnspecified` | K07.4 | Malocclusion, unspecified | |
| `dentofacialFunctional` | K07.5 | Dentofacial functional abnormalities | |
| `tmjDisorder` | K07.6 | Temporomandibular joint disorder | ⟂ |
| `odontogenicCyst` | K09.0 | Developmental odontogenic cyst | ⟂ |
| `nonOdontogenicCyst` | K09.1 | Developmental nonodontogenic cyst of oral region | ⟂ |
| `jawCystOther` | K09.2 | Other cysts of jaw | ⟂ |
| `oralCystOther` | K09.8 | Other cysts of oral region, NEC | ⟂ |
| `salivaryAtrophy` | K11.0 | Atrophy of salivary gland | ⟂ |
| `salivaryHypertrophy` | K11.1 | Hypertrophy of salivary gland | ⟂ |
| `sialadenitis` | K11.2 | Sialoadenitis | ⟂ |
| `salivaryAbscess` | K11.3 | Abscess of salivary gland | ⟂ |
| `salivaryFistula` | K11.4 | Fistula of salivary gland | ⟂ |
| `sialolithiasis` | K11.5 | Sialolithiasis | ⟂ |
| `mucocele` | K11.6 | Mucocele of salivary gland | ⟂ |
| `salivarySecretion` | K11.7 | Disturbances of salivary secretion | |
| `recurrentAphthae` | K12.0 | Recurrent oral aphthae | |
| `stomatitisOther` | K12.1 | Other forms of stomatitis | |
| `oralCellulitis` | K12.2 | Cellulitis and abscess of mouth | |
| `oralMucositis` | K12.3 | Oral mucositis (ulcerative) | |
| `anodontia` | K00.0 | Anodontia | |
| `hereditaryStructure` | K00.5 | Hereditary disturbances in tooth structure, NEC | |
| `lipDisease` | K13.0 | Diseases of lips | |
| `leukoplakia` | K13.2 | Leukoplakia and other disturbances of oral epithelium | ⟂ |
| `mucosalLesionOther` | K13.7 | Other and unspecified lesions of oral mucosa | ⟂ |

`LATERALIZABLE_CASE_KEYS` = the ⟂ set (14 keys), exported for the UI + validation.

### 3.2 State — `CaseMeta.caseConditions`
- `type Laterality = "unspecified" | "left" | "right" | "bilateral"`;
  `VALID_LATERALITY` set. `CaseMeta.caseConditions: Map<CaseConditionKey, Laterality>`
  in `defaultCaseMeta()` (empty Map).
- A non-lateralizable key is always stored `"unspecified"` (its laterality control is
  hidden); a lateralizable key stores whatever the clinician picks (default
  `"unspecified"`).
- **Serialize** omit-when-empty into the `case` payload block (absent when the Map is
  empty): `...(caseMeta.caseConditions.size > 0 ? { caseConditions:
  Object.fromEntries(caseMeta.caseConditions) } : {})`, following the existing
  case-serialize path.
- **Hydrate** with a validated rebuild (mirrors `dxOverrides`/`fillingDefect`): keep
  only entries whose key ∈ `CASE_DX_CODES` and whose value ∈ `VALID_LATERALITY`,
  and coerce a non-lateralizable key's value to `"unspecified"`. Add to
  `resetCaseMeta()` / the reset-all path.
- **Payload version 2.21 → 2.22** (additive; a no-case-condition case is
  byte-identical apart from the version). Roundtrips via JSON like every case field;
  no FHIR *import* (that is DX-7).

### 3.3 Engine API (`src/odontogram.ts`)
- `getCaseConditions(): { key: CaseConditionKey; icd10: string; laterality: Laterality;
  lateralizable: boolean }[]` — the active list, for the UI + summary (stable order =
  `CASE_DX_CODES` declaration order).
- `setCaseCondition(key: string, laterality: Laterality | null): void` — validates
  `key` against `CASE_DX_CODES` and `laterality` against `VALID_LATERALITY`;
  `null` removes the key; a non-lateralizable key is forced to `"unspecified"`;
  `notifyStateChange()` on change. NOT DS-1 gated (case-level, like the rest of
  `CaseMeta`).
- `resetCaseMeta()` clears the Map.

### 3.4 FHIR (`src/fhir/toFhirCase.ts`, mirroring `appendPerioCondition`)
- `appendCaseConditions(bundle, payload, options)` — one **patient-level `Condition`**
  per active case condition: `subject = options.subject ?? PLACEHOLDER_PATIENT_FULLURL`,
  the same `status`/`category` shape `appendPerioCondition` emits, stable
  `id = odontogram-case-<key>`, `code =` WHO ICD-10 (+ the active pack's coding via the
  same WHO-base+pack assembly `buildConditionCode` uses — extracted to a shared helper
  or a parallel `buildCaseConditionCode(key, pack?)` reading `CASE_DX_CODES`).
- **Laterality → `bodySite`:** when `laterality !== "unspecified"`, one
  `bodySite: [{ coding: [{ system: <engine-local laterality system>, code: laterality,
  display }] }]` — the "engine-local code until SNOMED verifies it" policy the perio
  export already uses (DX-6 upgrades it to a SNOMED body-structure / laterality). No
  tooth/FDI bodySite (these are not tooth-linked). `"unspecified"` → no `bodySite`.
- Wire `appendCaseConditions(...)` into `buildFhirBundle` (`src/fhir/toFhir.ts`)
  alongside `appendDentalConditions` / the perio condition.

### 3.5 UI (`src/PerioChart.tsx` / `src/PerioSidebar.tsx` — the case-data panel)
A new **"Case / regional diagnoses"** section where `CaseMeta` already surfaces:
- A multi-add `<select>` over `CASE_DX_CODES` keys not already active (localized
  `dx.case.<key>`), → `setCaseCondition(key, "unspecified")`.
- Each active condition = a row: localized label + ICD-10 code + a **remove** control
  (`setCaseCondition(key, null)`); for a lateralizable key, a laterality
  `<select>` (unspecified/left/right/bilateral → `setCaseCondition(key, value)`).
- Section subscribes via `useEngineState`/`onStateChange` like the sibling case cards.
- **Not** in the per-tooth tooltip (case-level, not per-tooth).

### 3.6 Whole-mouth summary
Extend `getOdontogramSummary()` with a **case-diagnoses** fragment (near the P4a
`caseContextSummaryFragment`): list each active condition as label + `(ICD-10)` +,
when lateralized, the laterality — only when the list is non-empty.

### 3.7 i18n (`src/i18n/translations.ts`)
`dx.case.<key>` for all 28 conditions, `caseDx.laterality.<unspecified|left|right|
bilateral>`, and the section/add/remove strings — all 12 languages.

## 4. Verification
`tsc` clean, `eslint` 0 errors, full suite green. New unit tests:
- Catalog: every `CASE_DX_CODES` entry has a valid `icd10` + non-empty display;
  `LATERALIZABLE_CASE_KEYS` ⊆ `CASE_DX_CODES`; `dx.case.<key>` exists ×12.
- State: `setCaseCondition` add/update-laterality/remove; non-lateralizable key coerced
  to `"unspecified"` even if a side is passed; serialize omit-when-empty; hydrate
  rejects invalid key/laterality and coerces non-lateralizable; payload version 2.22.
- FHIR: an active lateralized condition (e.g. `tmjDisorder` = `right`) → one
  patient-level `Condition`, correct ICD-10 code, a laterality `bodySite`, no FDI
  bodySite; a non-lateralized condition → no `bodySite`; no case conditions → no
  `Condition` added.
- **Goldens: all four byte-identical.** Parity fixtures carry no `caseConditions`, so
  `fhir-golden.json` + `svg-fingerprints.json` + `shell-dom-golden.html` are
  byte-identical. `roundtrip-golden.json` is `parseFhirBundle` output whose version
  comes from `fromFhir` (historically `"2.20"`, independent of the export-payload
  bump — DX-2 bumped the export to 2.21 with the roundtrip golden byte-identical), and
  case conditions are never FHIR-imported, so it is **byte-identical too**. If any
  golden moves, STOP and investigate.
- Manual: add/lateralize/remove a case condition changes the JSON export + the summary
  + the FHIR bundle; the visual odontogram + per-tooth data are unaffected.

## 5. Files
- **New:** `src/dx/caseCodes.ts` (catalog + `CaseConditionKey` + `Laterality` +
  `LATERALIZABLE_CASE_KEYS`); `src/fhir/toFhirCase.ts` (`appendCaseConditions` +
  case code builder); tests under `src/dx/__tests__/` + `src/__tests__/`.
- **Modify:** `src/odontogram.ts` (`CaseMeta.caseConditions` state/serialize/hydrate/
  version 2.22/reset; `getCaseConditions`/`setCaseCondition`; summary fragment);
  `src/fhir/toFhir.ts` (wire `appendCaseConditions`); `src/PerioChart.tsx` +/or
  `src/PerioSidebar.tsx` (the section); `src/i18n/translations.ts` (labels ×12);
  `CHANGELOG.md`. **No golden fixture changes** (all four byte-identical — see §4).

## 6. Out of scope
FHIR *import* of case conditions (DX-7); SNOMED laterality/body-structure codes and
SNOMED condition codes (DX-6); national packs beyond BNO-10 display (DX-4/5);
per-tooth developmental codes (K00.1 supernumerary / K00.2 size-form belong to a
tooth-level slice, not this case-level one); any change to the tooth-level
`deriveDentalDiagnoses` / `DX_CODES` / `TOOTH_LEVEL_DX_KEYS`.
