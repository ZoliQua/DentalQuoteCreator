# Dental ICD-10 DX-5 — US ICD-10-CM (first modification-class pack)

Date: 2026-08-20
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (`2026-08-19-dental-icd10-coding-design.md`).
DX-0/1/2/3a/3b/4 merged on `main`. Payload 2.22.
Status: design approved (decisions locked with the owner below).

## 1. Goal

Ship the program's **first `modification`-class coding pack** — US ICD-10-CM — which
**remaps** the diagnosis code (not just its display) on top of the always-on WHO
ICD-10 base. Its primary purpose is to **exercise and validate the code-remap
mechanism** end to end (tooth AND case), with ICD-10-CM as the reference
implementation. It also closes a real mechanism gap: `buildCaseConditionCode` is
currently `translation`-only.

## 2. Decisions (locked with the owner)

- **Full remap, unspecified where needed:** provide an ICD-10-CM code for **every
  coded diagnosis** (25 tooth + 28 case). Use the specific CM code where it is
  unambiguous; use the CM **unspecified** variant where CM demands detail the chart
  does not capture (e.g. `caries` → `K02.9`; `condensingOsteitis` → `K04.99`).
- **Flat per-key, data-driven deferred:** each key maps to a single CM code. Do NOT
  cross-wire `radiographicDepth` (caries depth → `K02.5x`) or the P4b perio
  stage/extent (→ specific `K05.3xx`) into code selection — noted as a future
  refinement.
- **Reference / best-effort:** most of the K-codes the engine uses are identical
  between WHO ICD-10 and ICD-10-CM (both descend from ICD-10); the pack remaps the
  genuinely-divergent ones and localizes displays to the CM titles. The pack carries
  an explicit in-code "verify against the official ICD-10-CM tabular list before US
  clinical use" caveat (mirroring the existing `BNO10_SYSTEM` URI caveat). Tests
  assert **completeness + mechanism**, not clinical CM correctness (which the owner
  verifies).

## 3. Existing machinery

- `CodingPack.kind: "modification"` + `codes?: Partial<Record<DiagnosisKey, {code;
  display}>>` already exist. `packCoding`'s modification branch returns
  `pack.codes?.[key]` under `pack.system`. `buildConditionCode` (tooth) already routes
  through `packCoding`, so a modification pack's **tooth** codes already flow.
- **Gap:** `buildCaseConditionCode` (`src/fhir/toFhirCase.ts`) only has a
  `translation` branch — a modification pack contributes NOTHING to case Conditions,
  and `CodingPack` has no case-remap field.
- Pack selection (`diagnosisCodingPack` flag, Settings `DIAGNOSIS_CODING_OPTIONS`,
  `exportFhir` wiring) already handles any registered pack id.

## 4. Design

### 4.1 Case-remap mechanism (`src/dx/packs.ts` + `src/fhir/toFhirCase.ts`)
- Add `caseCodes?: Partial<Record<CaseConditionKey, { code: string; display: string }>>`
  to the `CodingPack` interface (additive/optional, mirroring `codes`).
- Extend `buildCaseConditionCode` with a `modification` branch mirroring `packCoding`:
  ```ts
  if (pack) {
    if (pack.kind === "modification") {
      const m = pack.caseCodes?.[key];
      if (m) coding.push({ system: pack.system, code: m.code, display: m.display });
    } else { // translation (unchanged)
      coding.push({ system: pack.system, code: base.icd10, display: pack.caseDisplays?.[key] ?? base.icd10Display });
    }
  }
  ```
  The WHO-base coding (first entry) and `text` are unchanged.

### 4.2 The ICD-10-CM pack (`src/dx/packs.ts`)
- `ICD10CM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm"` (the canonical FHIR
  ICD-10-CM code-system URI).
- `ICD10CM_PACK: CodingPack = { id: "icd10cm", system: ICD10CM_SYSTEM, kind:
  "modification", codes: { <DiagnosisKey>: {code, display} … 25 }, caseCodes: {
  <CaseConditionKey>: {code, display} … 28 } }`. The actual CM codes + display titles
  are enumerated in the implementation plan (owner-verified content). A leading
  comment states the reference/best-effort caveat.
- Register in `CODING_PACKS` (`icd10cm: ICD10CM_PACK`).

### 4.3 Settings + i18n
- Add `{ value: "icd10cm", labelKey: "settings.diagnosisCoding.icd10cm" }` to
  `DIAGNOSIS_CODING_OPTIONS` (`src/SettingsModal.tsx`) — after `bno10`.
- Add `settings.diagnosisCoding.icd10cm` (e.g. "ICD-10-CM (US)") in all 12 languages.

### 4.4 Contributor guide (`CODING_PACKS.md`)
Update to reference the now-real **modification** example: `ICD10CM_PACK` with `codes`
+ `caseCodes` (the newly-added case-remap field), so a would-be modification-pack
author has a live template alongside the BNO-10 translation example.

## 5. Verification
`tsc` clean, `eslint` 0 errors, full suite green. Tests:
- **Mechanism:** `buildConditionCode("caries", ICD10CM_PACK)` → `[{ICD10, "K02", "Dental
  caries"}, {ICD10CM system, "K02.9", CM display}]` (WHO first, CM remapped second);
  `buildCaseConditionCode("tmjDisorder", ICD10CM_PACK)` → `[{ICD10, …}, {ICD10CM, CM
  code, CM display}]` (the modification branch now fires for case conditions).
- **Completeness:** every coded `DiagnosisKey` (25) has an `ICD10CM_PACK.codes` entry
  and every `CaseConditionKey` (28) has an `ICD10CM_PACK.caseCodes` entry (keys off
  `DX_CODES`/`CASE_DX_CODES`, drift-proof). The 2 uncoded peri-implant keys need none.
- **Translation packs unaffected:** BNO-10 (`translation`) still emits WHO-code + HU
  display for tooth and case (the `buildCaseConditionCode` refactor preserves the
  translation branch) — assert an unchanged BNO case coding.
- **A pack-active FHIR export** with `ICD10CM_PACK` carries the CM codings on tooth AND
  case Conditions; a no-pack export is unchanged.
- **Goldens byte-identical:** the parity fixtures export with `diagnosisCodingPack:
  "none"`, so no golden moves. Payload/version unchanged (2.22).

## 6. Files
- **Modify:** `src/dx/packs.ts` (`CodingPack.caseCodes`; `ICD10CM_SYSTEM` +
  `ICD10CM_PACK`; register in `CODING_PACKS`); `src/fhir/toFhirCase.ts`
  (`buildCaseConditionCode` modification branch); `src/SettingsModal.tsx`
  (`DIAGNOSIS_CODING_OPTIONS`); `src/i18n/translations.ts` (`settings.diagnosisCoding.icd10cm`
  ×12); `src/dx/__tests__/packs.test.ts` + `src/__tests__/case-conditions-fhir.test.ts`
  (mechanism + completeness); `CODING_PACKS.md`; `CHANGELOG.md`.

## 7. Out of scope
Data-driven CM specificity (caries depth → `K02.5x`, perio stage/extent → `K05.3xx`) —
future refinement. Clinical certification of the CM codes (reference/best-effort,
owner-verified). SNOMED (DX-6). FHIR import (DX-7). Any change to the pack-selection
mechanism, the diagnosis catalogs, derivation, payload, or goldens.
