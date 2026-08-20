# Dental ICD-10 DX-4 — first national pack (BNO-10), completed + documented

Date: 2026-08-20
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0/1/2/3a/3b merged on `main`. Payload 2.22.
Status: design approved (decisions locked with the owner below).

## 1. Goal

Turn the already-wired-but-skeletal BNO-10 pack into a **complete** translation pack
(Hungarian displays for every coded diagnosis, tooth-level AND case-level) and write
the **"add-your-country" contributor guide** so a new national pack is a copy-paste
job. The pack *selection* mechanism already exists end to end — this sub-project only
fills it in and documents it.

## 2. Decisions (locked with the owner)

- **Scope = pack completion + contributor guide.** The **NEAK reporting export is
  deferred** — it is a Hungary-specific insurance-reporting format that overlaps the
  host app's existing NEAK catalog and does not belong in a universal international
  odontogram library.
- **Full coverage:** Hungarian BNO-10 displays for **all coded** diagnosis keys. The
  two uncoded peri-implant keys (`periImplantMucositis`/`periImplantitis`) need none —
  they emit no `Condition` (no `icd10`), so no pack display is ever used for them.
- **BNO-10 codes == WHO ICD-10** (KSH: BNO-10 = WHO 2019). Only the display language
  differs — a pure `translation`-class pack (no code remapping).

## 3. Existing machinery (already done — do NOT rebuild)

- `diagnosisCodingPack` session flag + `getDiagnosisCodingPack`/`setDiagnosisCodingPack`
  (`odontogram.ts:8494-8502`).
- `exportFhir` merges `codingPack: resolveCodingPack(diagnosisCodingPack)` into the
  bundle options (`odontogram.ts:9454`), so the active pack is applied to the FHIR
  export.
- Settings select (`settings.diagnosisCoding`, `DIAGNOSIS_CODING_OPTIONS` = none/bno10)
  in `SettingsModal.tsx` + `OdontogramContext.tsx` wiring.
- `packCoding` / `buildConditionCode` (tooth) already consume `pack.displays`;
  `buildCaseConditionCode` (case, DX-3b) currently falls back to the WHO display.

## 4. Design

### 4.1 Complete the tooth-level `displays` (`src/dx/packs.ts`)
Extend `BNO10_PACK.displays` from the current 3 keys to **all 25 coded `DiagnosisKey`s**
with their official Hungarian BNO-10 titles. The 22 to add (the 3 present —
`caries`/`gingivitis`/`periodontitis` — stay): `cariesCementum`, `cariesArrested`,
`pulpitis`, `pulpNecrosis`, `apicalPeriodontitisAcute`, `apicalPeriodontitisChronic`,
`radicularCyst`, `periapicalAbscess`, `periapicalAbscessSinus`, `condensingOsteitis`,
`resorption`, `attrition`, `abrasion`, `erosion`, `abfraction`, `calculus`,
`fluorosis`, `tetracyclineStain`, `postEruptiveColour`, `toothLoss`, `retainedRoot`,
`toothFracture`. (Skip `periImplantMucositis`/`periImplantitis` — uncoded.)

### 4.2 Add `caseDisplays` to `CodingPack` + BNO-10 case displays
- Extend the `CodingPack` interface (`src/dx/packs.ts`) with
  `caseDisplays?: Partial<Record<CaseConditionKey, string>>` (import `CaseConditionKey`
  from `./caseCodes`). Additive/optional — existing packs and all consumers compile
  unchanged.
- Populate `BNO10_PACK.caseDisplays` with the official Hungarian BNO-10 titles for
  **all 28 `CaseConditionKey`s**.
- **Wire `buildCaseConditionCode`** (`src/fhir/toFhirCase.ts`): in the
  `translation`-pack branch, use `pack.caseDisplays?.[key] ?? base.icd10Display` for the
  pack coding's display (instead of always `base.icd10Display`). This closes the DX-3b
  deferred item. (No change to the WHO-base coding, which stays English WHO display.)

### 4.3 Add-your-country contributor guide
A new `docs/national-coding-packs.md` (linked from `CONTRIBUTING.md` / the README's
Contributing section), documenting the exact steps to add a national pack:
1. Add a `CodingPack` entry in `src/dx/packs.ts` (`id`, `system` — the national
   code-system URI, `kind: "translation"` for a same-codes/localized-display pack or
   `"modification"` for a code-remapping one, `displays`, `caseDisplays`).
2. Register it in `CODING_PACKS`.
3. Add its option to `DIAGNOSIS_CODING_OPTIONS` in `SettingsModal.tsx` + an i18n label.
4. (Optional) add unit coverage mirroring `src/dx/__tests__/packs.test.ts`.
Include the BNO-10 entry as the worked example, and note the translation-vs-modification
distinction (only US ICD-10-CM, DX-5, is modification-class).

## 5. Verification
`tsc` clean, `eslint` 0 errors, full suite green. Tests:
- `packCoding`/`buildConditionCode` with `BNO10_PACK` returns the Hungarian display for
  a newly-added tooth key (e.g. `pulpitis` → its BNO-10 HU title) under the BNO system,
  with the WHO ICD-10 coding still first + English WHO display.
- `buildCaseConditionCode` with `BNO10_PACK` returns the Hungarian case display for a
  case key (e.g. `tmjDisorder`) under the BNO system (was WHO display before).
- A pack-active FHIR export (`options.codingPack = BNO10_PACK`) carries the HU displays
  on tooth AND case Conditions; a no-pack export is unchanged.
- Every coded `DiagnosisKey` (25) has a `BNO10_PACK.displays` entry; every
  `CaseConditionKey` (28) has a `BNO10_PACK.caseDisplays` entry (a completeness test).
- **Goldens byte-identical:** the parity fixtures export with `diagnosisCodingPack:
  "none"` (no pack), so `fhir-golden.json` + the other three goldens are unchanged.
  Payload/version unchanged (2.22).

## 6. Files
- **Modify:** `src/dx/packs.ts` (`CodingPack.caseDisplays`; complete `BNO10_PACK.displays`;
  add `BNO10_PACK.caseDisplays`); `src/fhir/toFhirCase.ts` (`buildCaseConditionCode`
  uses `caseDisplays`); `src/dx/__tests__/packs.test.ts` (+ new completeness/display
  tests); `CHANGELOG.md`.
- **New:** `docs/national-coding-packs.md`; link from `CONTRIBUTING.md` / README.

## 7. Out of scope
The NEAK reporting export (host-app concern; deferred). US ICD-10-CM
`modification`-class pack (DX-5). SNOMED (DX-6). FHIR import (DX-7). Any change to the
pack-selection mechanism / Settings UI (already complete) or to the tooth/case
diagnosis catalogs, derivation, payload, or goldens.
