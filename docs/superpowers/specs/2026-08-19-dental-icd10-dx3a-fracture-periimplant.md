# Dental ICD-10 DX-3a — tooth-level fracture + peri-implant coding

Date: 2026-08-19
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0 (foundation) + DX-1 (charted findings) + DX-2 (picker/overrides) merged on
`main`. Payload 2.21.
Status: design approved (decisions locked with the owner below).

## 1. Goal

Code the two tooth-level clinical findings the engine already charts but DX-1
left uncoded: a **fractured (broken) tooth** and **peri-implant disease**.
Fracture gets its WHO ICD-10 code (**S02.5**); peri-implant has **no** WHO
ICD-10 code, so it is surfaced as a *recognized-but-uncoded* diagnosis that a
later SNOMED / national pack will code (DX-6). This introduces the program's
first **"uncoded diagnosis"** — a `DiagnosisKey` that has no WHO ICD-10 code.

## 2. Decisions (locked with the owner)

- **DX-3 is split:** DX-3a (this — tooth-level fracture + peri-implant) first,
  then DX-3b (case/regional K07/K09/K11/K12/K00, a new whole-mouth conditions
  surface).
- **Fracture → S02.5** "Fracture of tooth" (WHO ICD-10 injury chapter). The
  fracture-specific `K03.81` "cracked tooth" is US-ICD-10-CM only and not valid
  WHO — rejected. The `K03.8` hard-tissue umbrella was considered and rejected
  in favour of the precise S02.5.
- **Peri-implant → no WHO code.** Surfaced as charted/uncoded; real coding is
  deferred to SNOMED (DX-6) / national packs. No FHIR `Condition` is emitted for
  it at the WHO base.
- **Peri-implantitis severities collapse.** `mild`/`moderate`/`severe` all map to
  ONE `periImplantitis` key (severity is a grade, not a separate diagnosis);
  `mucositis` is a separate `periImplantMucositis` key. Mirrors DX-1 collapsing
  the pulpitis severities into one `pulpitis` key.

## 3. Design

### 3.1 New keys (`src/dx/codes.ts`)
`DiagnosisKey` union gains `toothFracture | periImplantMucositis | periImplantitis`.
`DX_CODES`:
- `toothFracture: { icd10: "S02.5", icd10Display: "Fracture of tooth" }`
- `periImplantMucositis: { icd10Display: "Peri-implant mucositis" }` — **no `icd10`**
- `periImplantitis: { icd10Display: "Peri-implantitis" }` — **no `icd10`**

Make `DiagnosisCode.icd10` **optional** (`icd10?: string`). `icd10Display` stays
required — it is the human label and the anchor a future SNOMED/pack display
attaches to.

### 3.2 The "uncoded diagnosis" mechanism (`src/dx/packs.ts` + `src/fhir/toFhirDx.ts`)
- `packCoding` / `buildConditionCode(key, pack?)`: when the key has no `icd10`
  AND the active pack supplies no coding, return `null` (no coding available at
  this level). Today every key has an `icd10`, so this branch only fires for the
  two peri-implant keys.
- `appendDentalConditions`: when `buildConditionCode` returns `null`, **skip
  emitting a `Condition`** for that derived diagnosis. It still counts as a
  derived diagnosis for the summary/tooltip/`getToothDiagnoses` list.
- **Forward-compatible:** DX-6 adds a SNOMED coding to these keys; then
  `buildConditionCode` returns a coding and the `Condition` emits, with no other
  change to derive/surface code.

### 3.3 Derivation (`src/dx/derive.ts`, pure)
Inside `deriveDentalDiagnoses`, per tooth:
- **Fracture** — presence-gated, inside the existing `if (natural)` block:
  `if (rec.brokenMesial || rec.brokenIncisal || rec.brokenDistal) add("toothFracture")`.
  This is the exact predicate `fractureSummaryLabel` (`odontogram.ts`) already
  uses for the "fracture" summary line, so the coded set matches the summary.
- **Peri-implant** — implant-gated, in its OWN block **outside** `if (natural)`
  (implants are in the `ABSENT` set, so `isNaturalPresent` is false — peri-implant
  belongs beside the other non-natural findings `toothLoss`/`retainedRoot`):
  `if (rec.toothSelection === "implant")` map `rec.periImplant` via a hoisted
  module-scope table `PERIIMPLANT` (like `PULP`/`APICAL`):
  `{ mucositis: "periImplantMucositis", "peri-implantitis-mild": "periImplantitis",
  "peri-implantitis-moderate": "periImplantitis", "peri-implantitis-severe":
  "periImplantitis" }`; `none`/absent → nothing.
- `applyDxOverrides(keys, rec.dxOverrides, natural)` is unchanged (DX-2 + the
  DX-2 presence-gate fix). `toothFracture` add-overrides work on natural teeth;
  peri-implant keys are derived-only (not in the add-catalog) so `add` never
  targets them, and `suppress` stays global (harmless).

### 3.4 Catalog + FHIR bodySite (`src/odontogram.ts` + `src/fhir/toFhirDx.ts`)
- `TOOTH_LEVEL_DX_KEYS` (the DX-2 add-catalog) is today "`DX_CODES` minus
  `periodontitis`/`gingivitis`" (22 keys). With three new keys the exclusion set
  must **grow to also exclude `periImplantMucositis` + `periImplantitis`** (implant-only,
  uncoded — same rationale as the perio exclusion) while **including
  `toothFracture`**. Result: **23 addable tooth-level keys** (22 + `toothFracture`).
  Update the `TOOTH_LEVEL_DX_KEYS` derivation and its count assertion in the
  i18n/key tests accordingly.
- `appendDentalConditions` bodySite: `toothFracture` uses
  `toothBodySiteCode(toothNo, rec)` like every tooth-level `Condition`.
  Peri-implant emits no `Condition`, so it needs no bodySite.

### 3.5 Surfacing (`getToothDiagnoses` + tooltip + summary)
- `getToothDiagnoses(toothNo)` returns uncoded rows with `icd10: null` (source
  `"derived"`). The **tooltip** (`getStateSummary`) and **whole-mouth summary**
  (`getOdontogramSummary`) coded-diagnoses lines render an uncoded row as the
  localized label followed by a **"no WHO code"** marker (`diagnoses.noCode`)
  instead of a code.
- The DX-2 **Diagnoses card is NOT modified.** Its section visibility is gated on
  a present natural tooth (`isNaturalPresent`), and the only uncoded keys
  (peri-implant) are implant-only — so the card never receives a null-code row.
  `getActiveDiagnoses` (which the card consumes) returns `visible: false` on an
  implant exactly as in DX-2, so peri-implant surfaces read-only in the
  tooltip/summary, not in the interactive card. (Curating peri-implant in the
  card — extending the card's visibility to implants — is a deliberate DX-3a
  non-goal; small later follow-up if wanted.)
- i18n: `dx.toothFracture`, `dx.periImplantMucositis`, `dx.periImplantitis`, and
  the `diagnoses.noCode` marker — all 12 languages.

### 3.6 Payload / version / goldens
- **No new tooth-state field** — the derivation reads the existing
  `brokenMesial`/`brokenIncisal`/`brokenDistal` and `periImplant` fields. **Payload
  stays 2.21.** `roundtrip-golden.json` byte-identical.
- `fhir-golden.json`: regenerate **only if** a parity fixture carries a broken
  tooth (that adds an S02.5 `Condition`) — and then verify the diff is *only* the
  new S02.5 `Condition(s)`, nothing else. Peri-implant emits nothing, so it never
  touches the golden. If no fixture has a broken tooth, `fhir-golden.json` is
  byte-identical and the S02.5 emission is proven by a dedicated non-golden unit
  test.
- `svg-fingerprints.json` + `shell-dom-golden.html` byte-identical — no render
  axis, no new UI section (the card is unchanged, and its rows are runtime, not
  part of the static shell golden).

## 4. Verification
`tsc` clean, `eslint` 0 errors, full suite green. New unit tests:
- **Fracture:** a broken tooth (`brokenMesial: true`, natural present) → derive
  yields `toothFracture`; `appendDentalConditions` emits one `Condition` with
  code **S02.5** and the tooth bodySite; a non-broken tooth → no `toothFracture`.
- **Peri-implant:** an implant with `periImplant: "peri-implantitis-moderate"` →
  derive yields `periImplantitis`; **no** `Condition` is emitted for it (uncoded);
  `mucositis` → `periImplantMucositis`, no `Condition`; a non-implant tooth with a
  stale `periImplant` value → nothing (implant-gated).
- **Uncoded mechanism:** `buildConditionCode(periImplantitis)` → `null`;
  `getToothDiagnoses` lists `periImplantitis` with `icd10: null`.
- **Catalog:** `toothFracture ∈ addableKeys` on a present tooth; peri-implant keys
  `∉ addableKeys`; `TOOTH_LEVEL_DX_KEYS.size === 23`.
- **Goldens:** the `fhir-golden.json` diff (if any) is only the S02.5
  `Condition`; `roundtrip`/`svg`/`shell` byte-identical.

## 5. Files
- **Modify:** `src/dx/codes.ts` (3 keys, optional `icd10`); `src/dx/packs.ts`
  (null coding when no `icd10`/pack); `src/dx/derive.ts` (fracture + peri-implant
  derivation + `PERIIMPLANT` table); `src/fhir/toFhirDx.ts` (skip null-coding);
  `src/odontogram.ts` (`TOOTH_LEVEL_DX_KEYS` exclude peri-implant / include
  `toothFracture`; `getToothDiagnoses` null-code rows; tooltip + summary uncoded
  lines); `src/i18n/translations.ts` (3 `dx.*` + `diagnoses.noCode`, 12 langs);
  `CHANGELOG.md`. **Possibly** `src/__tests__/parity/fhir-golden.json` (only if a
  fixture carries a broken tooth — an intended, verified diff).
- **New tests** under `src/dx/__tests__/` + `src/__tests__/`.
- **NOT modified:** `src/surfaces/cards/DiagnosesCard.tsx` (see §3.5).

## 6. Out of scope
Case/regional conditions K07/K09/K11/K12/K00 (**DX-3b**); restoration-failure
coding K08.5x (the `fillingDefect: "fracture"` value is a fractured *restoration*,
not a fractured tooth — a later slice); impaction K01; SNOMED coding of the
uncoded peri-implant keys (**DX-6**); national packs beyond BNO-10 (**DX-4/5**);
FHIR import of coded diagnoses (**DX-7**); curating peri-implant in the interactive
Diagnoses card.
