# Diagnoses card v2 — code-first labels, code sort, and add→chart binding

Date: 2026-08-22
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Builds on the merged DX-0..DX-7 diagnosis-coding layer. Payload 2.22.
Status: design approved (decisions locked with the owner below).

## 1. Goal
Three owner-requested improvements to the per-tooth **Diagnoses card**:
1. Show the ICD-10 code **first** in the dropdown and rows (e.g. `K04.0 Pulpitis`).
2. **Sort** the diagnoses by ICD-10 code (clearer).
3. Make **adding** a tooth-level diagnosis from the card **drive the chart** — the
   finding appears on the tooth (glyph) and derives/exports normally — instead of
   only tagging the coded layer. (The forward direction, chart→diagnosis, already works.)

## 2. Decisions (locked with the owner)
- **Add sets the chart axis** (single source of truth): the add-picker writes the
  underlying clinical axis (default value), so the finding becomes a real, derived,
  glyph-bearing finding — no separate "override" stored. The specific control (Pulp
  picker, wear row, …) refines the exact value afterward.
- **Ambiguous keys:** plain `caries` (per-surface, no single surface) is **excluded**
  from the add-picker — author caries in the Caries UI. `erosion` → **`wearEdge`**
  (incisal/occlusal edge wear); cervical erosion via the wear control.
- **Many-to-one defaults** (refinable via the specific control): `pulpitis` →
  `pulpDx = "irreversible-pulpitis"`; `resorption` → `resorptionType = "internal"`;
  `cariesCementum` → `rootCaries = "active"`; `postEruptiveColour` →
  `discoloration = "other"`; `toothFracture` → `brokenMesial = true`.
- **Suppress stays coded-only** (unchanged): suppressing a derived diagnosis un-codes
  it without touching the chart/glyph. Pre-existing `dxOverrides` `add` entries (from
  legacy JSON payloads or DX-7 FHIR import) still render as "added" rows with a remove
  control — the add-PICKER just no longer creates them.

## 3. Design

### 3.1 Reverse map (`src/odontogram.ts`)
A `DX_REVERSE_MAP: Record<string, (s: ToothState) => void>` (or a data table the
applier reads) mapping each reverse-mappable tooth-level `DiagnosisKey` to the chart
axis write(s) that make `deriveDentalDiagnoses` yield it:

| key | axis write |
|-----|-----------|
| pulpitis | `pulpDx = "irreversible-pulpitis"` |
| pulpNecrosis | `pulpDx = "necrosis"` |
| apicalPeriodontitisAcute | `apicalDx = "symptomatic-apical-periodontitis"` |
| apicalPeriodontitisChronic | `apicalDx = "asymptomatic-apical-periodontitis"` |
| periapicalAbscess | `apicalDx = "acute-apical-abscess"` |
| periapicalAbscessSinus | `apicalDx = "chronic-apical-abscess"` |
| condensingOsteitis | `apicalDx = "condensing-osteitis"` |
| radicularCyst | `apicalDx = "asymptomatic-apical-periodontitis"` + `periapicalType = "cyst"` |
| calculus | `calculus = true` |
| cariesCementum | `rootCaries = "active"` |
| cariesArrested | `rootCaries = "arrested"` |
| resorption | `resorptionType = "internal"` |
| attrition | `wearEdge = "attrition"` |
| erosion | `wearEdge = "erosion"` |
| abrasion | `wearCervical = "abrasion"` |
| abfraction | `wearCervical = "abfraction"` |
| fluorosis | `discoloration = "fluorosis"` |
| tetracyclineStain | `discoloration = "tetracycline"` |
| postEruptiveColour | `discoloration = "other"` |
| toothLoss | `toothSelection = "no-tooth-after-extraction"` |
| retainedRoot | `toothSubstrate = "radix"` |
| toothFracture | `brokenMesial = true` |

Excluded (not in the map, so not addable): `caries` (per-surface),
`gingivitis`/`periodontitis` (whole-mouth, already excluded), `periImplantMucositis`/
`periImplantitis` (implant-only, already excluded). A drift note/test: every
`REVERSE_MAP` key ∈ `TOOTH_LEVEL_DX_KEYS`, and every `TOOTH_LEVEL_DX_KEYS` key except
`caries` has a reverse entry.

### 3.2 `addDiagnosisToSelection(key)` (`src/odontogram.ts`)
New public setter mirroring the existing clinical controls: validates `key` against
`DX_REVERSE_MAP`, then applies the axis write(s) to every selected tooth via
`applyToSelected(...)` — the SAME path the pulp/wear/etc. controls use, so it routes
through the DS-1 gate AND repaints the affected teeth (unlike `setDxOverrideForSelection`,
which has no glyph and skips repaint). Re-export from `src/App.tsx`. Because the write
lands on a real axis, `deriveDentalDiagnoses` then yields the diagnosis and the FHIR
export/summary/tooltip pick it up with zero extra wiring.

### 3.3 View-model: code-first + sorted (`getActiveDiagnoses`, `getToothDiagnoses`)
- **Sort by ICD-10 code:** `getActiveDiagnoses().rows` and `getToothDiagnoses(...)` are
  ordered by `icd10` ascending (string compare; `null`/uncoded keys last). FHIR export
  order is unchanged (it iterates `deriveDentalDiagnoses`, not these getters).
- **`addableKeys` shape:** change from `string[]` to `{ key: string; icd10: string }[]`,
  limited to `DX_REVERSE_MAP` keys not already effective, sorted by `icd10` — so the card
  can render code-first without a second lookup.

### 3.4 The card (`src/surfaces/cards/DiagnosesCard.tsx`)
- **Code-first rows:** render `{row.icd10} {t("dx."+row.key)}` (e.g. "K04.0 Pulpitis").
  A null code (shouldn't occur in the card) falls back to the label alone.
- **Code-first dropdown:** each option label = `{icd10} {t("dx."+key)}`; the add-`<select>`
  `onChange` calls `addDiagnosisToSelection(key)` (was `setDxOverrideForSelection(key,"add")`).
- The derived-row suppress checkbox and the legacy "added"-row remove control are
  unchanged (`setDxOverrideForSelection`), for coded-layer curation + backward-compat.

### 3.5 Surfacing consistency
The tooltip (`getStateSummary`) and whole-mouth summary (`getOdontogramSummary`) already
consume `getToothDiagnoses`, so they inherit the code sort automatically. The code-first
line format there is out of scope (they already show `Display (code)`); only the card
gets the code-first order per the request.

## 4. Verification
`tsc` clean, `eslint` 0, full suite green. Tests:
- **Add→chart:** with a present tooth selected, `addDiagnosisToSelection("pulpitis")`
  sets `pulpDx="irreversible-pulpitis"`; `getToothDiagnoses` then includes `pulpitis`
  (derived, not an override); `deriveDentalDiagnoses` yields it (glyph/FHIR follow).
  Spot-check `toothLoss` → `toothSelection`, `radicularCyst` → apicalDx+periapicalType,
  `erosion` → `wearEdge`.
- **caries excluded** from `addableKeys`; every other tooth-level key present; each
  `DX_REVERSE_MAP` key ∈ `TOOTH_LEVEL_DX_KEYS` (drift guard).
- **Sort:** `getActiveDiagnoses().rows` + `addableKeys` are code-ascending.
- **Card:** rows/options render code-first (`K04.0 Pulpitis`); the add-`<select>` calls
  `addDiagnosisToSelection`.
- **Suppress unchanged**; a payload carrying a legacy `dxOverrides` `add` still renders
  an "added" row with the remove control.
- **Goldens byte-identical:** the parity fixtures don't exercise the card, and the FHIR
  export order is unchanged; payload/version unchanged (2.22). Update any DX-2 card /
  tooltip / summary test that asserts a specific diagnosis ORDER (now code-sorted).

## 5. Files
- **Modify:** `src/odontogram.ts` (`DX_REVERSE_MAP`, `addDiagnosisToSelection`, sort in
  `getActiveDiagnoses`/`getToothDiagnoses`, `addableKeys` shape); `src/App.tsx`
  (re-export); `src/surfaces/cards/DiagnosesCard.tsx` (code-first + add wiring);
  the DX card/tooltip/summary tests; `CHANGELOG.md`.
- **New tests** under `src/__tests__/`.

## 6. Out of scope
The BNO-10 code verification against the NEAK source (separate task). Per-surface
`caries` add. Suppress clearing the chart (stays coded-only). Any change to
`deriveDentalDiagnoses`, the payload/version, national packs, or FHIR export order.
