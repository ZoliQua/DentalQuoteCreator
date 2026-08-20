# Dental ICD-10 DX-6 — SNOMED CT overlay (toggle-gated)

Date: 2026-08-20
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0/1/2/3a/3b/4/5 merged on `main`. Payload 2.22.
Status: design approved (decisions locked with the owner below).

## 1. Goal

Add an **opt-in SNOMED CT overlay** to the diagnosis-coding layer: when enabled, every
FHIR `Condition` carries a SNOMED CT coding alongside its WHO ICD-10 (and any national
pack) coding. This finally **codes the DX-3a uncoded peri-implant keys** (they have no
WHO code, but do have SNOMED concepts) and **upgrades the DX-3b laterality bodySite** to a
SNOMED laterality qualifier.

## 2. Decisions (locked with the owner)

- **Toggle-gated, default OFF.** A `snomedEnabled` session flag + Settings switch; SNOMED
  is emitted only when the flag is on. Default off keeps every export (and all four
  goldens) byte-identical — SNOMED is strictly opt-in.
- **Confident seed set only.** Populate SNOMED concepts for the peri-implant keys (the
  DX-3a target), the laterality qualifiers (DX-3b), and a small set of well-known dental
  concepts. Every other `snomed` slot stays **unset** (no coding emitted) — a documented
  maintainer-fill scaffold. Every populated ID is flagged **"verify against the official
  SNOMED CT browser"** in-code (SNOMED IDs are opaque numerics; this honors the codebase's
  existing "don't hardcode unverified SNOMED" stance, e.g. the deliberately-empty
  `SNOMED_CODES` registry).
- Tests assert the **mechanism** (toggle gates emission; peri-implant emits when enabled;
  the laterality qualifier appears when enabled) — **not** the clinical correctness of the
  seeded IDs (owner/maintainer-verified).

## 3. Existing machinery

- `DiagnosisCode.snomed?: string` (`src/dx/codes.ts:21`) exists but is **dormant** — never
  populated, and `buildConditionCode` never reads it.
- `SNOMED_SYSTEM = "http://snomed.info/sct"` (`src/fhir/codesystems.ts:24`).
- `CaseConditionCode` has **no** `snomed` slot.
- Case laterality `bodySite` uses `LOCAL_SYSTEM` `laterality:<v>` (`src/fhir/toFhirCase.ts:56`)
  — the in-code comment already earmarks "SNOMED body-structure in DX-6".
- Pack selection wires `codingPack` into `FhirExportOptions` in `exportFhir`
  (`odontogram.ts:9454`); `getDiagnosisCodingPack`/`setDiagnosisCodingPack` are the session-flag
  precedent to mirror.

## 4. Design

### 4.1 The `snomedEnabled` toggle
- `snomedEnabled` module `let` (default `false`) + `getSnomedEnabled()`/`setSnomedEnabled(v: boolean)`
  in `odontogram.ts` (mirroring `getDiagnosisCodingPack`/`setDiagnosisCodingPack`;
  `setSnomedEnabled` early-returns on no-change + `notifyStateChange()`). Re-export from
  `src/App.tsx`; wire through `OdontogramContext.tsx` + a Settings switch in
  `SettingsModal.tsx` (near the diagnosis-coding select) + `settings.snomed`(+`.desc`) i18n ×12.
  **Session flag — NOT in the payload** (like `diagnosisCodingPack`); no version change.
- `FhirExportOptions.snomed?: boolean` (`src/fhir/types.ts`); `exportFhir` merges
  `snomed: options?.snomed ?? getSnomedEnabled()` (alongside the existing `codingPack` merge).

### 4.2 Emission mechanism
- `buildConditionCode(key, pack?, snomed = false)` (`src/fhir/toFhirDx.ts`): after the
  WHO+pack coding block, `if (snomed && base.snomed) coding.push({ system: SNOMED_SYSTEM,
  code: base.snomed, display: base.icd10Display })`. Return null only when `coding` is empty.
- `buildCaseConditionCode(key, pack?, snomed = false)` (`src/fhir/toFhirCase.ts`): same —
  append the SNOMED coding when `snomed && base.snomed`. `CaseConditionCode` gains `snomed?: string`.
- `appendDentalConditions` / `appendCaseConditions` / `appendPerioCondition` pass
  `options.snomed` (default false) into the builders.

### 4.3 Peri-implant payoff (the DX-3a promise)
`periImplantMucositis`/`periImplantitis` have no `icd10`, so `buildConditionCode` returns
null today (no Condition). With their `snomed` slots seeded and `snomed` on, the coding
array is `[SNOMED]` → a **SNOMED-only Condition** is emitted (bodySite = the tooth's FDI, as
for every dental Condition). Off → still null (unchanged). No other change to
`appendDentalConditions` — the derivation already yields these keys.

### 4.4 Laterality → SNOMED qualifier (the DX-3b upgrade)
In `appendCaseConditions`, when `options.snomed` is on and `laterality !== "unspecified"`,
**append** a second `bodySite` coding with the SNOMED laterality qualifier
(`LATERALITY_SNOMED[laterality]` — Left/Right/Bilateral) after the existing engine-local
coding (the local code stays as a fallback). Off → the engine-local coding only (unchanged).

### 4.5 Seed data (all "verify against the official SNOMED CT browser")
- `DX_CODES[key].snomed` for the peri-implant keys + a small confident dental set (e.g.
  `caries` 80967001, `pulpitis` 65246005, `gingivitis` 66383009). Exact IDs in the plan.
- `CASE_DX_CODES[key].snomed` — optional small set (may be empty at first; the field exists
  so a maintainer fills it).
- `LATERALITY_SNOMED: Record<Exclude<Laterality,"unspecified">, string>` (Left/Right/Bilateral
  qualifier concept IDs) in `toFhirCase.ts`.
- A leading comment on the seed block states the verify caveat + that unset slots emit nothing.

## 5. Verification
`tsc` clean, `eslint` 0 errors, full suite green. Tests:
- **Toggle gates emission:** `buildConditionCode("caries", undefined, false)` → WHO only;
  `buildConditionCode("caries", undefined, true)` → WHO + SNOMED (80967001) coding.
- **Peri-implant:** `appendDentalConditions` with `{ snomed: true }` on a tooth deriving
  `periImplantitis` emits a Condition whose only coding is the SNOMED concept; with
  `{ snomed: false }` (default) → NO peri-implant Condition (unchanged).
- **Laterality:** `appendCaseConditions` with `{ snomed: true }` on `tmjDisorder = "right"`
  → the `bodySite` has both the local `laterality:right` and the SNOMED qualifier coding;
  with default off → local only.
- **Translation/modification packs unaffected:** a BNO-10 / ICD-10-CM export with `snomed`
  off is byte-identical; with `snomed` on, the SNOMED coding is appended AFTER the pack coding.
- **`getSnomedEnabled`/`setSnomedEnabled`** round-trip + Settings option present ×12 i18n.
- **Goldens byte-identical:** the parity fixtures export with `snomedEnabled: false` (default),
  so no golden moves. Payload/version unchanged (2.22).

## 6. Files
- **Modify:** `src/odontogram.ts` (`snomedEnabled` flag + accessors; `exportFhir` merges
  `snomed`); `src/fhir/types.ts` (`FhirExportOptions.snomed`); `src/fhir/toFhirDx.ts`
  (`buildConditionCode` snomed param + emission; `appendDentalConditions` pass-through);
  `src/fhir/toFhirCase.ts` (`buildCaseConditionCode` snomed param; `appendCaseConditions`
  laterality SNOMED; `LATERALITY_SNOMED`); `src/fhir/toFhirPerio.ts` (`appendPerioCondition`
  pass `options.snomed`); `src/dx/codes.ts` (seed `snomed`); `src/dx/caseCodes.ts`
  (`CaseConditionCode.snomed?` + optional seed); `src/SettingsModal.tsx` +
  `src/OdontogramContext.tsx` + `src/App.tsx` (the toggle); `src/i18n/translations.ts`
  (`settings.snomed*` ×12); `CODING_PACKS.md`, `CHANGELOG.md`; the relevant `src/dx/__tests__`
  + `src/__tests__` FHIR/settings tests.

## 7. Out of scope
A complete per-diagnosis SNOMED map (maintainer-fill; only the confident seed + peri-implant +
laterality now). SNOMED for the registry enum axes (`SNOMED_CODES`, separate mechanism).
FHIR import (DX-7). Any payload/version change, catalog/derivation change, or golden change.
