# Dental ICD-10 DX-3b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add case-level, manually-authored, optionally-lateralized regional dental conditions (K07/K09/K11/K12/K00/K13, ~28) that export as patient-level FHIR `Condition`s.

**Architecture:** A new `CASE_DX_CODES` catalog (separate from the tooth-level `DX_CODES`), a `CaseMeta.caseConditions: Map<key, Laterality>` case-level field, a `toFhirCase.ts` emitter mirroring `appendPerioCondition`, and a picker section in the perio-view case panel. Purely manual — no derivation.

**Tech Stack:** TypeScript, Vitest, React (PerioSidebar), the engine's `CaseMeta` + FHIR builders.

## Global Constraints

- Commits authored by **Zoltán Dul** only — **no** Claude/Co-Authored-By trailer.
- Never stage `tsconfig.tsbuildinfo`.
- **Payload 2.21 → 2.22** (additive; case field omit-when-empty). Export version only — `fromFhir`/`roundtrip-golden` stays `"2.20"`.
- **All four parity goldens byte-identical** (`fhir-golden.json`, `roundtrip-golden.json`, `svg-fingerprints.json`, `shell-dom-golden.html`) — parity fixtures carry no `caseConditions`. If any moves, STOP.
- **Do not touch** the tooth-level `deriveDentalDiagnoses` / `DX_CODES` / `TOOTH_LEVEL_DX_KEYS`.
- Each task ends green: `npx tsc -b --noEmit` clean, `npx eslint <touched>` 0 errors, `npx vitest run` green.

---

### Task 1: The `CASE_DX_CODES` catalog

**Files:**
- Create: `src/dx/caseCodes.ts`
- Test: `src/dx/__tests__/caseCodes.test.ts`

**Interfaces:**
- Produces: `CaseConditionKey` (union of 28); `CaseConditionCode = { icd10: string; icd10Display: string; lateralizable: boolean }`; `CASE_DX_CODES: Record<CaseConditionKey, CaseConditionCode>`; `Laterality = "unspecified" | "left" | "right" | "bilateral"`; `VALID_LATERALITY: Set<Laterality>`; `LATERALIZABLE_CASE_KEYS: Set<CaseConditionKey>`.

- [ ] **Step 1: Write the failing test (`src/dx/__tests__/caseCodes.test.ts`).**

```ts
import { CASE_DX_CODES, LATERALIZABLE_CASE_KEYS, VALID_LATERALITY, type CaseConditionKey } from "../caseCodes";

it("has 28 conditions, each with a valid ICD-10 code and non-empty display", () => {
  const keys = Object.keys(CASE_DX_CODES) as CaseConditionKey[];
  expect(keys.length).toBe(28);
  for (const k of keys) {
    expect(CASE_DX_CODES[k].icd10).toMatch(/^K\d{2}(\.\d)?$/);
    expect(CASE_DX_CODES[k].icd10Display.length).toBeGreaterThan(0);
  }
});
it("marks exactly 14 lateralizable keys, all in the catalog", () => {
  expect(LATERALIZABLE_CASE_KEYS.size).toBe(14);
  for (const k of LATERALIZABLE_CASE_KEYS) expect(k in CASE_DX_CODES).toBe(true);
  // and the flag agrees with the set
  for (const k of Object.keys(CASE_DX_CODES) as CaseConditionKey[])
    expect(CASE_DX_CODES[k].lateralizable).toBe(LATERALIZABLE_CASE_KEYS.has(k));
});
it("VALID_LATERALITY is the four values", () => {
  expect([...VALID_LATERALITY].sort()).toEqual(["bilateral", "left", "right", "unspecified"]);
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/dx/__tests__/caseCodes.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement `src/dx/caseCodes.ts`.**

```ts
// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

/** Case-level (whole-mouth / regional) dental diagnosis identifiers — authored
 *  on the case, not derived from a tooth. Separate from the tooth-level
 *  `DiagnosisKey`/`DX_CODES`. */
export type CaseConditionKey =
  | "jawSizeAnomaly" | "jawBaseAnomaly" | "archRelationAnomaly" | "toothPositionAnomaly"
  | "malocclusionUnspecified" | "dentofacialFunctional" | "tmjDisorder"
  | "odontogenicCyst" | "nonOdontogenicCyst" | "jawCystOther" | "oralCystOther"
  | "salivaryAtrophy" | "salivaryHypertrophy" | "sialadenitis" | "salivaryAbscess"
  | "salivaryFistula" | "sialolithiasis" | "mucocele" | "salivarySecretion"
  | "recurrentAphthae" | "stomatitisOther" | "oralCellulitis" | "oralMucositis"
  | "anodontia" | "hereditaryStructure"
  | "lipDisease" | "leukoplakia" | "mucosalLesionOther";

export interface CaseConditionCode { icd10: string; icd10Display: string; lateralizable: boolean; }

/** WHO ICD-10 catalog for case/regional conditions. `lateralizable` gates the
 *  left/right/bilateral qualifier. Displays are the WHO ICD-10 titles. */
export const CASE_DX_CODES: Record<CaseConditionKey, CaseConditionCode> = {
  jawSizeAnomaly:          { icd10: "K07.0", icd10Display: "Major anomalies of jaw size", lateralizable: false },
  jawBaseAnomaly:          { icd10: "K07.1", icd10Display: "Anomalies of jaw-cranial base relationship", lateralizable: false },
  archRelationAnomaly:     { icd10: "K07.2", icd10Display: "Anomalies of dental arch relationship", lateralizable: false },
  toothPositionAnomaly:    { icd10: "K07.3", icd10Display: "Anomalies of tooth position", lateralizable: false },
  malocclusionUnspecified: { icd10: "K07.4", icd10Display: "Malocclusion, unspecified", lateralizable: false },
  dentofacialFunctional:   { icd10: "K07.5", icd10Display: "Dentofacial functional abnormalities", lateralizable: false },
  tmjDisorder:             { icd10: "K07.6", icd10Display: "Temporomandibular joint disorder", lateralizable: true },
  odontogenicCyst:         { icd10: "K09.0", icd10Display: "Developmental odontogenic cyst", lateralizable: true },
  nonOdontogenicCyst:      { icd10: "K09.1", icd10Display: "Developmental nonodontogenic cyst of oral region", lateralizable: true },
  jawCystOther:            { icd10: "K09.2", icd10Display: "Other cysts of jaw", lateralizable: true },
  oralCystOther:           { icd10: "K09.8", icd10Display: "Other cysts of oral region, NEC", lateralizable: true },
  salivaryAtrophy:         { icd10: "K11.0", icd10Display: "Atrophy of salivary gland", lateralizable: true },
  salivaryHypertrophy:     { icd10: "K11.1", icd10Display: "Hypertrophy of salivary gland", lateralizable: true },
  sialadenitis:            { icd10: "K11.2", icd10Display: "Sialoadenitis", lateralizable: true },
  salivaryAbscess:         { icd10: "K11.3", icd10Display: "Abscess of salivary gland", lateralizable: true },
  salivaryFistula:         { icd10: "K11.4", icd10Display: "Fistula of salivary gland", lateralizable: true },
  sialolithiasis:          { icd10: "K11.5", icd10Display: "Sialolithiasis", lateralizable: true },
  mucocele:                { icd10: "K11.6", icd10Display: "Mucocele of salivary gland", lateralizable: true },
  salivarySecretion:       { icd10: "K11.7", icd10Display: "Disturbances of salivary secretion", lateralizable: false },
  recurrentAphthae:        { icd10: "K12.0", icd10Display: "Recurrent oral aphthae", lateralizable: false },
  stomatitisOther:         { icd10: "K12.1", icd10Display: "Other forms of stomatitis", lateralizable: false },
  oralCellulitis:          { icd10: "K12.2", icd10Display: "Cellulitis and abscess of mouth", lateralizable: false },
  oralMucositis:           { icd10: "K12.3", icd10Display: "Oral mucositis (ulcerative)", lateralizable: false },
  anodontia:               { icd10: "K00.0", icd10Display: "Anodontia", lateralizable: false },
  hereditaryStructure:     { icd10: "K00.5", icd10Display: "Hereditary disturbances in tooth structure, NEC", lateralizable: false },
  lipDisease:              { icd10: "K13.0", icd10Display: "Diseases of lips", lateralizable: false },
  leukoplakia:             { icd10: "K13.2", icd10Display: "Leukoplakia and other disturbances of oral epithelium", lateralizable: true },
  mucosalLesionOther:      { icd10: "K13.7", icd10Display: "Other and unspecified lesions of oral mucosa", lateralizable: true },
};

export type Laterality = "unspecified" | "left" | "right" | "bilateral";
export const VALID_LATERALITY = new Set<Laterality>(["unspecified", "left", "right", "bilateral"]);

/** The lateralizable subset (14 keys), derived from the `lateralizable` flag. */
export const LATERALIZABLE_CASE_KEYS = new Set(
  (Object.keys(CASE_DX_CODES) as CaseConditionKey[]).filter((k) => CASE_DX_CODES[k].lateralizable),
);
```

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/dx/__tests__/caseCodes.test.ts` — PASS.

- [ ] **Step 5: Verify goldens untouched + commit.** `git status --short src/__tests__/parity/` empty. Then:
```bash
git add src/dx/caseCodes.ts src/dx/__tests__/caseCodes.test.ts
git commit -m "feat(dx): DX-3b case-condition catalog (CASE_DX_CODES, 28 conditions, laterality)"
```

---

### Task 2: `CaseMeta.caseConditions` state + API + payload 2.22

**Files:**
- Modify: `src/odontogram.ts` (`CaseMeta`, `defaultCaseMeta`, `caseMetaIsEmpty`, `serializeCaseMeta`, `hydrateCaseMeta`, `resetCaseMeta` is unchanged — it calls `defaultCaseMeta`; add `getCaseConditions`/`setCaseCondition`; bump version at both export sites)
- Test: `src/__tests__/case-conditions-state.test.ts`

**Interfaces:**
- Consumes: `CASE_DX_CODES`, `LATERALIZABLE_CASE_KEYS`, `VALID_LATERALITY`, `Laterality`, `CaseConditionKey` (Task 1).
- Produces: `getCaseConditions(): { key: CaseConditionKey; icd10: string; laterality: Laterality; lateralizable: boolean }[]`; `setCaseCondition(key: string, laterality: Laterality | null): void`.

- [ ] **Step 1: Write the failing test (`src/__tests__/case-conditions-state.test.ts`).**

Use the existing case-meta test seam (there are `getCaseMeta`/`setSmokingStatus` tests — follow that file's import + reset setup; call `resetCaseMeta()` in `beforeEach`).

```ts
import { getCaseConditions, setCaseCondition, resetCaseMeta, __collectExportPayloadForTest as collect } from "../odontogram";

beforeEach(() => resetCaseMeta());

it("adds, updates laterality, and removes a case condition", () => {
  setCaseCondition("tmjDisorder", "unspecified");
  expect(getCaseConditions().map((c) => c.key)).toContain("tmjDisorder");
  setCaseCondition("tmjDisorder", "right");
  expect(getCaseConditions().find((c) => c.key === "tmjDisorder")!.laterality).toBe("right");
  setCaseCondition("tmjDisorder", null);
  expect(getCaseConditions()).toEqual([]);
});
it("coerces a non-lateralizable key's laterality to unspecified", () => {
  setCaseCondition("anodontia", "left");
  expect(getCaseConditions().find((c) => c.key === "anodontia")!.laterality).toBe("unspecified");
});
it("ignores unknown keys and invalid laterality", () => {
  setCaseCondition("nope", "left");
  setCaseCondition("tmjDisorder", "sideways" as any);
  expect(getCaseConditions()).toEqual([]);
});
it("serializes omit-when-empty and bumps the payload version to 2.22", () => {
  expect(collect().version).toBe("2.22");
  expect(collect().case).toBeUndefined();       // no case data → no case block
  setCaseCondition("leukoplakia", "bilateral");
  expect((collect().case as any).caseConditions).toEqual({ leukoplakia: "bilateral" });
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/__tests__/case-conditions-state.test.ts` — FAIL.

- [ ] **Step 3: Wire the state (`src/odontogram.ts`).**

Import at the top (near the other `./dx` imports):
```ts
import { CASE_DX_CODES, LATERALIZABLE_CASE_KEYS, VALID_LATERALITY, type CaseConditionKey, type Laterality } from "./dx/caseCodes";
```
Add the field to `CaseMeta` (after `examDate`):
```ts
  /** Case-level regional conditions (K07/K09/K11/K12/K00/K13), each with an
   *  optional laterality. Manually authored, not derived. */
  caseConditions: Map<string, Laterality>;
```
`defaultCaseMeta()` return object — add `caseConditions: new Map(),`.
`caseMetaIsEmpty()` — extend the final `&&` chain with `&& c.caseConditions.size === 0`.
`serializeCaseMeta()` — before `return o;`:
```ts
  if(c.caseConditions.size > 0) o.caseConditions = Object.fromEntries(c.caseConditions);
```
`hydrateCaseMeta()` — before the function's end, rebuild validated:
```ts
  caseMeta.caseConditions = new Map();
  if(raw.caseConditions && typeof raw.caseConditions === "object"){
    for(const [k, v] of Object.entries(raw.caseConditions)){
      if(!(k in CASE_DX_CODES)) continue;
      if(typeof v !== "string" || !VALID_LATERALITY.has(v as Laterality)) continue;
      caseMeta.caseConditions.set(k, LATERALIZABLE_CASE_KEYS.has(k as CaseConditionKey) ? (v as Laterality) : "unspecified");
    }
  }
```

- [ ] **Step 4: Add the API (`src/odontogram.ts`, near the other case setters ~line 757).**

```ts
/** Active case conditions in catalog order, for the UI + summary. */
export function getCaseConditions(): { key: CaseConditionKey; icd10: string; laterality: Laterality; lateralizable: boolean }[] {
  const out: { key: CaseConditionKey; icd10: string; laterality: Laterality; lateralizable: boolean }[] = [];
  for(const key of Object.keys(CASE_DX_CODES) as CaseConditionKey[]){
    const lat = caseMeta.caseConditions.get(key);
    if(lat === undefined) continue;
    out.push({ key, icd10: CASE_DX_CODES[key].icd10, laterality: lat, lateralizable: CASE_DX_CODES[key].lateralizable });
  }
  return out;
}
/** Add/update-laterality/remove one case condition. `null` removes; a
 *  non-lateralizable key is forced to "unspecified"; invalid key/laterality is
 *  a silent no-op. Case-level (not DS-1 gated), like the rest of CaseMeta. */
export function setCaseCondition(key: string, laterality: Laterality | null): void {
  if(!(key in CASE_DX_CODES)) return;
  if(laterality === null){ if(caseMeta.caseConditions.delete(key)) notifyStateChange(); return; }
  if(!VALID_LATERALITY.has(laterality)) return;
  const lat: Laterality = LATERALIZABLE_CASE_KEYS.has(key as CaseConditionKey) ? laterality : "unspecified";
  if(caseMeta.caseConditions.get(key) !== lat){ caseMeta.caseConditions.set(key, lat); notifyStateChange(); }
}
```

- [ ] **Step 5: Bump the export payload version.**

In `collectExportPayload` and `getPlanChart` (~`odontogram.ts:7078` and `:7108`), change `version: "2.21"` → `version: "2.22"`. Leave the `fromFhir`/import/roundtrip `"2.20"` untouched.

- [ ] **Step 6: Run + fix the version ripple.** `npx vitest run` — some tests assert the export version `"2.21"`. Update them to `"2.22"` (grep `"2.21"` under `src/__tests__` — only the export/collect assertions; do NOT touch `"2.20"` fromFhir/roundtrip ones). Re-run green.

- [ ] **Step 7: Verify goldens + commit.** `git status --short src/__tests__/parity/` empty (roundtrip stays 2.20; fixtures carry no case conditions). Then:
```bash
git add src/odontogram.ts src/__tests__
git commit -m "feat(dx): CaseMeta.caseConditions state + API, payload 2.22"
```

---

### Task 3: Case-level FHIR `Condition`s

**Files:**
- Create: `src/fhir/toFhirCase.ts`
- Modify: `src/fhir/toFhir.ts` (wire `appendCaseConditions` into `buildFhirBundle`)
- Test: `src/__tests__/case-conditions-fhir.test.ts`

**Interfaces:**
- Consumes: `CASE_DX_CODES`, `LATERALIZABLE_CASE_KEYS`, `VALID_LATERALITY`, `Laterality`, `CaseConditionKey` (Task 1); the case payload shape (Task 2).
- Produces: `appendCaseConditions(bundle: Bundle, payload: OdontogramExportPayload, options?: FhirExportOptions): void`.

- [ ] **Step 1: Write the failing test (`src/__tests__/case-conditions-fhir.test.ts`).**

```ts
import { appendCaseConditions } from "../fhir/toFhirCase";

const bundle = () => ({ resourceType: "Bundle", type: "collection", entry: [] }) as any;
const find = (b: any, id: string) => b.entry.find((e: any) => e.resource.id === id)?.resource;

it("emits a patient-level Condition with a laterality bodySite for a lateralized condition", () => {
  const b = bundle();
  appendCaseConditions(b, { case: { caseConditions: { tmjDisorder: "right" } } } as any);
  const c = find(b, "odontogram-case-tmjDisorder");
  expect(c.code.coding[0].code).toBe("K07.6");
  expect(c.subject.reference).toBeTruthy();
  expect(c.bodySite[0].coding[0].code).toBe("laterality:right");
  expect(c.bodySite[0].coding[0].system).toBeTruthy();
});
it("emits no bodySite for a non-lateralized (unspecified) condition", () => {
  const b = bundle();
  appendCaseConditions(b, { case: { caseConditions: { anodontia: "unspecified" } } } as any);
  expect(find(b, "odontogram-case-anodontia").bodySite).toBeUndefined();
});
it("emits nothing when there are no case conditions", () => {
  const b = bundle();
  appendCaseConditions(b, { case: {} } as any);
  appendCaseConditions(b, {} as any);
  expect(b.entry.length).toBe(0);
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/__tests__/case-conditions-fhir.test.ts` — FAIL.

- [ ] **Step 3: Implement `src/fhir/toFhirCase.ts`.**

Confirm the import path of `localConcept` matches how `toFhirPerio.ts` imports it (it uses `localConcept`); `LOCAL_SYSTEM` is in `./codesystems`. Use `PLACEHOLDER_PATIENT_FULLURL` from `./primitives`.

```ts
// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

import type { Bundle, Condition, CodeableConcept, OdontogramExportPayload, FhirExportOptions } from "./types";
import { ICD10_SYSTEM, LOCAL_SYSTEM } from "./codesystems";
import { PLACEHOLDER_PATIENT_FULLURL } from "./primitives";
import type { CodingPack } from "../dx/packs";
import { CASE_DX_CODES, LATERALIZABLE_CASE_KEYS, VALID_LATERALITY, type CaseConditionKey, type Laterality } from "../dx/caseCodes";

const LATERALITY_DISPLAY: Record<Exclude<Laterality, "unspecified">, string> = {
  left: "Left", right: "Right", bilateral: "Bilateral",
};

/** `Condition.code` for a case condition: WHO ICD-10 base + (for a translation
 *  pack, e.g. BNO-10) the same code under the pack's system. Localized case
 *  displays arrive in DX-4. */
function buildCaseConditionCode(key: CaseConditionKey, pack?: CodingPack): CodeableConcept {
  const base = CASE_DX_CODES[key];
  const coding: NonNullable<CodeableConcept["coding"]> = [
    { system: ICD10_SYSTEM, code: base.icd10, display: base.icd10Display },
  ];
  if (pack && pack.kind === "translation") {
    coding.push({ system: pack.system, code: base.icd10, display: base.icd10Display });
  }
  return { coding, text: base.icd10Display };
}

/** Append one patient-level `Condition` per active case condition. Iterates in
 *  `CASE_DX_CODES` order for deterministic output. Laterality (when not
 *  "unspecified") rides on a `bodySite` engine-local code (SNOMED body-structure
 *  in DX-6). No tooth/FDI bodySite — these are not tooth-linked. */
export function appendCaseConditions(bundle: Bundle, payload: OdontogramExportPayload, options: FhirExportOptions = {}): void {
  const caseRaw = (payload && typeof payload === "object" ? (payload as { case?: unknown }).case : undefined) as Record<string, unknown> | undefined;
  const conds = caseRaw?.caseConditions as Record<string, unknown> | undefined;
  if (!conds || typeof conds !== "object") return;
  const subjectRef = options.subject ?? PLACEHOLDER_PATIENT_FULLURL;
  if (!bundle.entry) bundle.entry = [];
  for (const key of Object.keys(CASE_DX_CODES) as CaseConditionKey[]) {
    const raw = conds[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string" || !VALID_LATERALITY.has(raw as Laterality)) continue;
    const laterality: Laterality = LATERALIZABLE_CASE_KEYS.has(key) ? (raw as Laterality) : "unspecified";
    const id = `odontogram-case-${key}`;
    const condition: Condition = {
      resourceType: "Condition",
      id,
      code: buildCaseConditionCode(key, options.codingPack),
      subject: { reference: subjectRef },
    };
    if (laterality !== "unspecified") {
      condition.bodySite = [{ coding: [{ system: LOCAL_SYSTEM, code: `laterality:${laterality}`, display: LATERALITY_DISPLAY[laterality] }] }];
    }
    bundle.entry.push({ fullUrl: `urn:uuid:${id}`, resource: condition });
  }
}
```

- [ ] **Step 4: Wire into `buildFhirBundle` (`src/fhir/toFhir.ts`).**

Add the import and the call after `appendDentalConditions` (toFhir.ts:34):
```ts
import { appendCaseConditions } from "./toFhirCase";
```
```ts
  appendDentalConditions(bundle, payload, options);
  appendCaseConditions(bundle, payload, options);
```

- [ ] **Step 5: Run to verify pass + goldens untouched.** `npx vitest run src/__tests__/case-conditions-fhir.test.ts` PASS; `npx vitest run src/__tests__/parity` green with `git status --short src/__tests__/parity/` empty (fixtures have no case conditions → `buildFhirBundle` output unchanged).

- [ ] **Step 6: Commit.**
```bash
git add src/fhir/toFhirCase.ts src/fhir/toFhir.ts src/__tests__/case-conditions-fhir.test.ts
git commit -m "feat(dx): case-level FHIR Conditions (patient-subject, laterality bodySite)"
```

---

### Task 4: i18n — labels for the 28 conditions + laterality + section

**Files:**
- Modify: `src/i18n/translations.ts`
- Test: `src/__tests__/case-conditions-i18n.test.ts`

- [ ] **Step 1: Write the failing test (`src/__tests__/case-conditions-i18n.test.ts`).**

```ts
import { CASE_DX_CODES } from "../dx/caseCodes";
// import the translations map + language list the same way dx-card.test.tsx does
import { translations, ALL_LANGUAGES } from "../i18n/translations"; // adjust to the real exports

const CARD_KEYS = ["case.diagnoses.section", "case.diagnoses.add", "case.diagnoses.remove",
  "caseDx.laterality.unspecified", "caseDx.laterality.left", "caseDx.laterality.right", "caseDx.laterality.bilateral"];
const DX_KEYS = Object.keys(CASE_DX_CODES).map((k) => `dx.case.${k}`);
const ALL = [...CARD_KEYS, ...DX_KEYS];

for (const lang of ALL_LANGUAGES) {
  it(`${lang} has all ${ALL.length} case-diagnosis keys non-empty`, () => {
    for (const key of ALL) {
      const v = (translations as any)[lang]?.[key];
      expect(typeof v === "string" && v.length > 0).toBe(true);
    }
  });
}
```
(Match the exact `translations`/language-list import that `src/__tests__/dx-card.test.tsx` uses — copy that file's i18n-test setup.)

- [ ] **Step 2: Run to verify failure.** FAIL (keys missing).

- [ ] **Step 3: Add the keys to all 12 languages (`src/i18n/translations.ts`).**

Mirror the placement/format of the existing `dx.*`/`case.*` entries. The **English (authoritative)** strings:

| key | English |
|-----|---------|
| `case.diagnoses.section` | Case / regional diagnoses |
| `case.diagnoses.add` | Add a diagnosis |
| `case.diagnoses.remove` | Remove |
| `caseDx.laterality.unspecified` | Unspecified |
| `caseDx.laterality.left` | Left |
| `caseDx.laterality.right` | Right |
| `caseDx.laterality.bilateral` | Bilateral |

`dx.case.<key>` English labels = the `icd10Display` column of `CASE_DX_CODES` (Task 1), used verbatim (e.g. `dx.case.tmjDisorder` = "Temporomandibular joint disorder", `dx.case.sialolithiasis` = "Sialolithiasis", …, all 28).

For the other 11 languages (hu, de, es, it, sk, pl, ru, pt-br, ar, zh, fr): translate each key to the **established clinical terminology** in that language, following the existing `dx.*` entries' register. Every `dx.case.<key>` + the 7 card/laterality keys must be present and non-empty in all 12 languages (the Step-1 test enforces presence; the reviewer verifies the translations are real, not English fallbacks — spot-checked per language). Hungarian is the quality anchor (the primary UI language): use the standard Hungarian dental terms (e.g. `tmjDisorder` → "Temporomandibularis ízületi rendellenesség", `sialolithiasis` → "Nyálkövesség", `leukoplakia` → "Leukoplakia", laterality → "Nem meghatározott / Bal / Jobb / Kétoldali").

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/__tests__/case-conditions-i18n.test.ts` — PASS (all 12).

- [ ] **Step 5: Verify goldens untouched + commit.** `git status --short src/__tests__/parity/` empty. Then:
```bash
git add src/i18n/translations.ts src/__tests__/case-conditions-i18n.test.ts
git commit -m "feat(dx): i18n for case/regional diagnoses (28 conditions + laterality, 12 languages)"
```

---

### Task 5: The "Case / regional diagnoses" UI section

**Files:**
- Modify: `src/PerioSidebar.tsx` (add the section inside the `#caseMetaPanel` `<details>`, after the existing case-meta rows)
- Test: `src/__tests__/case-conditions-ui.test.tsx`

**Interfaces:**
- Consumes: `getCaseConditions`, `setCaseCondition` (Task 2); `CASE_DX_CODES`, `LATERALIZABLE_CASE_KEYS`, `type Laterality` (Task 1); `dx.case.*` / `caseDx.laterality.*` / `case.diagnoses.*` i18n (Task 4).

- [ ] **Step 1: Write the failing test (`src/__tests__/case-conditions-ui.test.tsx`).**

Follow the render/setup pattern of the existing `PerioSidebar` test(s). Assert: the section renders; picking a key from the add-`<select>` calls `setCaseCondition(key, "unspecified")`; for a lateralizable active row the laterality `<select>` calls `setCaseCondition(key, value)`; the remove button calls `setCaseCondition(key, null)`.

```ts
// mock the engine module's setCaseCondition + getCaseConditions, render PerioSidebar,
// then fire change/click events on #caseDiagnosesSection controls and assert the mock calls.
```
(Mirror how `dx-card.test.tsx` mocks the engine getters/setters and drives the DOM.)

- [ ] **Step 2: Run to verify failure.** FAIL.

- [ ] **Step 3: Implement the section (`src/PerioSidebar.tsx`).**

Import the new engine + catalog symbols alongside the existing `getCaseMeta`/`setCaseAge` imports:
```ts
import { getCaseConditions, setCaseCondition } from "../odontogram";
import { CASE_DX_CODES, LATERALIZABLE_CASE_KEYS, type CaseConditionKey, type Laterality } from "../dx/caseCodes";
```
Read the list from the same `onStateChange` refresh the panel already uses (add `caseConditions` to the component's refreshed state, e.g. `const [caseConds, setCaseConds] = useState(getCaseConditions()); ...` updated in the same `onStateChange` handler that calls `setCaseMetaState(getCaseMeta())`).

Render inside `#caseMetaPanel`, after the existing rows:
```tsx
<div id="caseDiagnosesSection" className="case-diagnoses">
  <div className="case-diagnoses-title">{t("case.diagnoses.section")}</div>
  {caseConds.map((c) => (
    <div className="case-diagnoses-row" key={c.key}>
      <span className="case-dx-label">{t(`dx.case.${c.key}`)}</span>
      <span className="case-dx-code">{c.icd10}</span>
      {c.lateralizable && (
        <select value={c.laterality} disabled={readOnly}
          onChange={(e) => setCaseCondition(c.key, e.target.value as Laterality)}>
          {(["unspecified", "left", "right", "bilateral"] as Laterality[]).map((l) => (
            <option key={l} value={l}>{t(`caseDx.laterality.${l}`)}</option>
          ))}
        </select>
      )}
      <button type="button" className="case-dx-remove" disabled={readOnly}
        onClick={() => setCaseCondition(c.key, null)}>{t("case.diagnoses.remove")}</button>
    </div>
  ))}
  <select id="caseDxAddSelect" value="" disabled={readOnly}
    onChange={(e) => { if (e.target.value) setCaseCondition(e.target.value, "unspecified"); }}>
    <option value="">{t("case.diagnoses.add")}</option>
    {(Object.keys(CASE_DX_CODES) as CaseConditionKey[])
      .filter((k) => !caseConds.some((c) => c.key === k))
      .map((k) => (<option key={k} value={k}>{t(`dx.case.${k}`)}</option>))}
  </select>
</div>
```
(Use the sidebar's existing `readOnly`/`t` bindings — match how the sibling case rows read them.)

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/__tests__/case-conditions-ui.test.tsx` — PASS.

- [ ] **Step 5: Verify goldens untouched + commit.** The perio-sidebar markup is not part of `shell-dom-golden.html` (base odontogram shell) — confirm `git status --short src/__tests__/parity/` is empty. Then:
```bash
git add src/PerioSidebar.tsx src/__tests__/case-conditions-ui.test.tsx
git commit -m "feat(dx): Case/regional diagnoses picker in the perio case panel"
```

---

### Task 6: Whole-mouth summary fragment

**Files:**
- Modify: `src/odontogram.ts` (`getOdontogramSummary`, near `caseContextSummaryFragment`)
- Test: `src/__tests__/case-conditions-summary.test.ts`

- [ ] **Step 1: Write the failing test (`src/__tests__/case-conditions-summary.test.ts`).**

```ts
import { setCaseCondition, resetCaseMeta, getOdontogramSummary } from "../odontogram";
beforeEach(() => resetCaseMeta());
it("lists active case conditions with code + laterality in the summary", () => {
  setCaseCondition("tmjDisorder", "right");
  setCaseCondition("recurrentAphthae", "unspecified");
  const text = JSON.stringify(getOdontogramSummary());
  expect(text).toContain("K07.6");
  expect(text).toContain("K12.0");
});
```

- [ ] **Step 2: Run to verify failure.** FAIL.

- [ ] **Step 3: Implement the fragment (`src/odontogram.ts`).**

Add a helper near `caseContextSummaryFragment`:
```ts
function caseDiagnosesSummaryFragment(): string | null {
  const conds = getCaseConditions();
  if(conds.length === 0) return null;
  const parts = conds.map((c) => {
    const lat = (c.lateralizable && c.laterality !== "unspecified") ? ` [${t(`caseDx.laterality.${c.laterality}`)}]` : "";
    return `${t(`dx.case.${c.key}`)} (${c.icd10})${lat}`;
  });
  return `${t("case.diagnoses.section")}: ${parts.join("; ")}`;
}
```
In `getOdontogramSummary`, append this fragment where `caseContextSummaryFragment` is consumed (the `periodontalText` assembly): include `caseDiagnosesSummaryFragment()` when non-null, joined with the existing case-context line.

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/__tests__/case-conditions-summary.test.ts` — PASS.

- [ ] **Step 5: Verify goldens untouched + commit.**
```bash
git add src/odontogram.ts src/__tests__/case-conditions-summary.test.ts
git commit -m "feat(dx): whole-mouth summary fragment for case/regional diagnoses"
```

---

### Task 7: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the `[Unreleased]` → `### Added` bullet.**
```markdown
- **Dental diagnosis coding: case/regional conditions (DX-3b).** A new
  "Case / regional diagnoses" picker in the perio case panel authors whole-mouth /
  regional conditions (malocclusion & TMJ K07, oral cysts K09, salivary disease K11,
  stomatitis & oral mucosa K12/K13, arch-level developmental K00 — ~28 conditions),
  each optionally lateralized (left/right/bilateral). They export as patient-level
  FHIR Conditions and appear in the whole-mouth summary. Payload 2.22 (additive
  `caseConditions`); the visual chart and per-tooth data are unaffected.
```

- [ ] **Step 2: Commit.**
```bash
git add CHANGELOG.md
git commit -m "docs: changelog for dental diagnosis coding DX-3b"
```

---

## Self-Review

**Spec coverage:** §3.1 catalog → Task 1; §3.2 state/serialize/hydrate/version → Task 2; §3.3 API → Task 2; §3.4 FHIR → Task 3; §3.5 UI → Task 5; §3.6 summary → Task 6; §3.7 i18n → Task 4; §4 verification → per-task tests; §5 files → all covered; §6 out-of-scope → respected (no derivation, no tooth-level touch, no FHIR import, no SNOMED). ✓

**Placeholder scan:** catalog + state + FHIR + summary carry full code; i18n gives all English strings verbatim + a defined translation acceptance criterion for the other 11 languages (a real translation task, reviewer-verified — not a "TODO"); UI carries the full JSX. No "TBD".

**Type consistency:** `CaseConditionKey`/`Laterality`/`CASE_DX_CODES`/`LATERALIZABLE_CASE_KEYS`/`VALID_LATERALITY` (Task 1) are consumed verbatim in Tasks 2/3/5/6; `getCaseConditions`/`setCaseCondition` (Task 2) consumed by Tasks 5/6; `appendCaseConditions` (Task 3) wired in Task 3; `dx.case.<key>`/`caseDx.laterality.*`/`case.diagnoses.*` (Task 4) consumed by Tasks 5/6.

## Notes for the executor
- **Payload version:** only the export payload bumps 2.21→2.22 (both `collectExportPayload`/`getPlanChart` sites). `fromFhir`/`roundtrip-golden` stays `"2.20"` — do not touch it.
- **Goldens:** every task must leave all four parity goldens byte-identical (parity fixtures carry no `caseConditions`). If one moves, stop.
- The `case` payload block is absent entirely when empty (`caseMetaIsEmpty` gate) — the `caseConditions` size must be part of that emptiness check (Task 2), or an all-default case with only conditions would wrongly serialize/omit.
- i18n Task 4 must land before the UI (Task 5) and summary (Task 6), which consume `t("dx.case.*")`.
- Peri-implant/tooth-level DX code is untouched — DX-3b is entirely additive and case-level.
