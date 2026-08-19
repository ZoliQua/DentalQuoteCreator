# Dental ICD-10 DX-2 — per-tooth diagnosis picker + overrides

Date: 2026-08-19
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0 (foundation) + DX-1 (charted findings) merged on `main` (`dc027cc`). Payload 2.20.
Status: design approved (decisions locked with the owner below).

## 1. Goal

Let the clinician **curate a tooth's coded diagnoses** on top of the DX-1
chart-derived set: suppress a wrongly-derived diagnosis and manually add one the
chart does not represent. The edits shape the **coded diagnosis layer only** (the
FHIR `Condition` export + a coded-diagnoses summary/tooltip line) — they never
change the visual chart or the underlying findings.

## 2. Decisions (locked with the owner)

- **Override model: full add + suppress.** Effective coded set per tooth =
  `(DX-1 derived) − (suppressed) ∪ (manually added)`.
- **Add catalog: tooth-level dental keys only** — the DX-1 tooth-level
  `DiagnosisKey`s. Whole-mouth perio (`periodontitis`/`gingivitis`) is excluded
  (it is the separate P4b Condition). Regional conditions (K07/K09/K11/K12) and
  fractures/peri-implant wait for DX-3.

## 3. Design

### 3.1 State — a per-tooth `dxOverrides` map
- `ToothState.dxOverrides: Map<DiagnosisKey, "add" | "suppress">`, defaulted in
  `defaultState()` (`odontogram.ts:460-461` neighbourhood), mirroring the additive
  `radiographicDepth`/`fillingDefect` per-tooth maps.
- Serialize omit-when-empty via the spread precedent (`serializeState`,
  `odontogram.ts:6224-6235` style: `...((s.dxOverrides?.size ?? 0) > 0 ? {
  dxOverrides: Object.fromEntries(s.dxOverrides) } : {})`).
- Hydrate with a validated rebuild loop (`hydrateState`, like `fillingDefect`
  6606-6611): keep only entries whose key is a valid tooth-level `DiagnosisKey`
  and whose value ∈ {`add`,`suppress`}. Add `VALID_DX_OVERRIDE_VALUE` +
  `TOOTH_LEVEL_DX_KEYS` sets; add the field to `__plainStateForTest` (4162).
- **Payload version 2.20 → 2.21** (additive; a no-override case is byte-identical
  apart from the version). Dual-state aware (lives on ToothState).

### 3.2 Effective set — inject into the DX-1 derivation
`deriveDentalDiagnoses` (`src/dx/derive.ts`) already builds a per-tooth `keys`
Set. After building it (before the `for (const key of keys) out.push(...)` at
line 75), apply `rec.dxOverrides`: delete keys marked `suppress`, add keys marked
`add`. Because `dxOverrides` serializes into the payload the function already
reads, the FHIR export AND every summary/tooltip consumer reflect overrides
uniformly, with zero new coupling. A small pure helper
`applyDxOverrides(keys: Set<DiagnosisKey>, overrides): Set<DiagnosisKey>` keeps it
testable. (Whole-mouth `periodontitis`/`gingivitis` are never produced by
`deriveDentalDiagnoses`, so add-overrides for them are ignored by construction;
the card's catalog already excludes them.)

### 3.3 The "Diagnoses" card (`src/surfaces/cards/DiagnosesCard.tsx`)
Follows `RootPeriodontiumCard`: a static `<section id="diagnosesSection"
className="card">` in `ToothControlsSurface.tsx` (after the Root/periodontium
section ~line 119) + a body that subscribes via `useEngineState(getActiveDiagnoses)`.
It renders:
- The **effective diagnoses** for the active tooth: each row = the localized
  label + ICD-10 code + a source tag (derived / added) + a control — a *suppress*
  toggle on a derived row, a *remove* on an added row.
- An **"Add diagnosis"** `<select>` listing the tooth-level catalog keys not
  already effective, localized via new `dx.<key>` i18n labels.
- Section-visibility gate: shown only for a present natural tooth (reuse the
  `isNaturalPresent` predicate; hidden otherwise via the `.hidden` toggle pattern).

New engine API (mirroring `getActiveRootPerio` + `set*ForSelection`):
- `getToothDiagnoses(toothNo)` — pure-ish: runs `deriveDentalDiagnoses` on
  `{ teeth: { [toothNo]: serializeState(state) } }` and returns the effective keys
  plus, per key, `source: "derived" | "added"` and `suppressed: boolean`. Reused by
  the card, tooltip, and summary. (This adds the FIRST `src/dx` import into
  `odontogram.ts`.)
- `getActiveDiagnoses()` — the active-tooth view-model the card consumes.
- `setDxOverrideForSelection(key, mode)` where `mode ∈ "add" | "suppress" | null`
  (null clears) — routed through the DS-1 `gateToothEditBatch` like every other
  per-selection setter, applied to every selected tooth.

### 3.4 Surfacing
- **Tooltip** (`getStateSummary` / `diagnosisSummaryLabels`, `odontogram.ts:4427`):
  append a coded-diagnoses line listing the effective diagnoses with their ICD-10
  codes (added ones flagged).
- **Whole-mouth summary** (`getOdontogramSummary`, `odontogram.ts:10585`): extend
  the `diagnoses` bucket (or a new `codedDiagnoses` section) with the per-tooth
  effective coded diagnoses.

## 4. Verification
`tsc` clean, `eslint` 0 errors, full suite green. New unit tests: `applyDxOverrides`
(suppress removes, add includes, null-clear); `dxOverrides` serialize/hydrate
round-trip (omit-when-empty, invalid-key/value rejected); a bundle test that a
suppressed derived diagnosis is NOT emitted and an added one IS. **Goldens:** the
parity fixtures carry no `dxOverrides`, so `fhir-golden.json` stays byte-identical
(a no-override case is unchanged apart from the version string in the roundtrip
golden — regenerate ONLY the roundtrip golden's version if the harness compares it,
verifying the diff is version-only). SVG-fingerprint/shell-DOM byte-identical
(the new card is inside the closed-modal-independent controls panel; its section is
part of the shell — regenerate the shell-DOM golden for the new static section and
verify the diff is only the new `#diagnosesSection`). Manual: add/suppress on a
tooth changes the export + summary; export/FHIR reflect it; the visual chart is
unaffected.

## 5. Files
- New: `src/surfaces/cards/DiagnosesCard.tsx`; tests under `src/dx/__tests__/` +
  `src/__tests__/`.
- Modify: `src/dx/derive.ts` (`applyDxOverrides` + injection); `src/odontogram.ts`
  (`dxOverrides` state/serialize/hydrate/version 2.21; `getToothDiagnoses`/
  `getActiveDiagnoses`/`setDxOverrideForSelection`; tooltip + summary lines; first
  `src/dx` import); `src/surfaces/ToothControlsSurface.tsx` (the section);
  `src/App.tsx` (re-export the new accessors); `src/i18n/translations.ts`
  (`card.diagnoses`, `dx.<key>` labels, add/suppress strings — 12 languages);
  `src/__tests__/parity/shell-dom-golden.html` (new section) + possibly the
  roundtrip golden version; `CHANGELOG.md`.

## 6. Also — DX-1 tidy-ups (fold in)
- Hoist `PULP`/`APICAL` tables to module scope in `derive.ts` (like `ENUM_RULES`).
- Annotate the DX-1 spec §3 caries-depth row as deferred (K02.0/.1 not shipped).

## 7. Out of scope
Regional/case conditions (DX-3); national packs beyond BNO-10 (DX-4/5); SNOMED
(DX-6); FHIR import of coded diagnoses (DX-7); per-derived-code refinement (the
DX-1 data-driven subcodes already pick the right code; add/suppress is the DX-2
override surface).
