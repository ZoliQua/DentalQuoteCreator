# HL7 FHIR R4 Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an HL7 FHIR R4 export to the odontogram engine that maps the full per-tooth dental chart state into a portable FHIR `Bundle`, without breaking the host DentalQuoteCreator app.

**Architecture:** A pure, data-driven mapper in a new `src/fhir/` directory inside the engine submodule. A declarative field-mapping table plus a generic emitter convert a serialized odontogram payload (`{version, globals, teeth}`) into FHIR `Observation` resources wrapped in a `Bundle` (`type: "collection"`). Coding is hybrid: every `CodeableConcept` always carries a local CodeSystem coding, plus a SNOMED CT coding where a verified one exists. A thin `exportFhir()` API method (mirroring `exportStatus()`) wires it to a new topbar button.

**Tech Stack:** TypeScript 5.5, React 18.3, Vite 7.3, Vitest 4, `@types/fhir` (type-only dev dependency).

---

## Background facts (verified against current code)

- Engine submodule path: `src/modules/odontogram/engine/` (its own git repo; main repo holds a submodule pointer).
- The submodule's `.gitignore` ignores `docs/` (typedoc output) — do NOT put docs there.
- Public API pattern: module-level `export function` in `src/odontogram.ts`, re-exported in `src/App.tsx:3`.
- Existing JSON export: `exportStatus()` at `src/odontogram.ts:2207-2234`; it builds `{ version:"1.3", globals:{wisdomVisible,showBase,occlusalVisible,showHealthyPulp,edentulous}, teeth:{ "11": {...}, ... } }` and downloads it. `serializeState(s)` (`:2111-2142`) defines the per-tooth shape.
- Per-tooth fields (from `serializeState`): `toothSelection`, `pulpInflam`, `endoResection`, `mods[]`, `endo`, `caries[]`, `fillingMaterial`, `fillingSurfaces[]`, `fissureSealing`, `contactMesial`, `contactDistal`, `bruxismWear`, `bruxismNeckWear`, `brokenMesial`, `brokenIncisal`, `brokenDistal`, `extractionWound`, `extractionPlan`, `parapulpalPin`, `crownReplace`, `crownNeeded`, `missingClosed`, `bridgePillar`, `bridgeUnit`, `mobility`, `crownMaterial`, optional `customStates`, optional `note`.
- Enum value sets are defined at `src/odontogram.ts:2145-2153` (`VALID_TOOTH_SELECTION`, `VALID_ENDO`, `VALID_FILLING_MATERIAL`, `VALID_BRIDGE_UNIT`, `VALID_MOBILITY`, `VALID_CROWN_MATERIAL`, `VALID_MODS`, `VALID_CARIES`, `VALID_FILLING_SURFACES`).
- Tooth keys are FDI numbers already (e.g. `"11".."48"`), so the FDI/ISO 3950 tooth code is the key itself — no numbering conversion needed.
- Export button wiring: `src/odontogram.ts:2987-2992` inside `wireControls`; UI buttons live in `src/App.tsx:289-291` (`#btnStatusExport`, `#btnStatusImport`).
- **Host coupling (do not break):** `src/modules/odontogram/OdontogramHost.tsx:2` imports exactly `OdontogramApp (default), clearSelection, setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible` from `@odontogram-shell`, and uses the button id `btnStatusExport` (`EXPORT_BUTTON_ID`). The main app's TypeScript sees `@odontogram-shell` only through the ambient declaration `src/modules/odontogram/odontogram-shell.d.ts`, NOT the engine source — so engine-internal FHIR types never reach the main app build. Keep these exports and that button id unchanged.
- i18n: `src/i18n/translations.ts` is a `Record<Language, Record<string,string>>`; 8 languages (`hu, en, de, es, it, sk, pl, ru`). Add keys to `hu` first, then all others. Existing `topbar.exportStatus` keys are at lines 29/214/399/584/769/954/1139/1324.
- Tests live in `src/__tests__/` and run under Vitest + jsdom (`npm test`).

All commands below are run from the engine submodule root unless stated:
`cd src/modules/odontogram/engine`

---

## File structure

Created (all inside `src/modules/odontogram/engine/`):
- `src/fhir/types.ts` — payload + options types and FHIR type re-exports.
- `src/fhir/codesystems.ts` — system URLs and local enum→{code,display} maps + verified SNOMED lookup.
- `src/fhir/fieldMappings.ts` — declarative table describing how each tooth field becomes an Observation.
- `src/fhir/toFhir.ts` — `buildFhirBundle(payload, options?)` pure mapper + generic emitter.
- `src/__tests__/fhir.test.ts` — unit tests for the mapper.

Modified:
- `package.json` — add `@types/fhir` devDependency; bump version at release.
- `src/odontogram.ts` — add `collectExportPayload()` helper, `exportFhir()` function, and button wiring.
- `src/App.tsx` — re-export `exportFhir`; add the FHIR export button.
- `src/i18n/translations.ts` — add `topbar.exportFhir` key in all 8 languages.
- `README.md` — feature list + changelog entry.

Main repo (`DentalQuoteCreator/`):
- Submodule pointer bump + verification only (no source changes).

---

## Task 1: Add `@types/fhir` dev dependency

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install the type package**

Run:
```bash
cd src/modules/odontogram/engine
npm install --save-dev @types/fhir
```
Expected: `package.json` gains `"@types/fhir": "^<version>"` under `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Verify the FHIR types resolve**

Create a scratch check (do NOT commit this file):
```bash
printf 'import type { Bundle } from "fhir/r4";\nconst b: Bundle = { resourceType: "Bundle", type: "collection" };\nexport default b;\n' > src/fhir-typecheck-scratch.ts
npx tsc --noEmit src/fhir-typecheck-scratch.ts
```
Expected: no errors. Then remove it:
```bash
rm src/fhir-typecheck-scratch.ts
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @types/fhir dev dependency for FHIR export"
```

---

## Task 2: Code systems and local coding maps

**Files:**
- Create: `src/fhir/codesystems.ts`
- Test: `src/__tests__/fhir.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/fhir.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LOCAL_VALUE_MAPS, LOCAL_SYSTEM, FDI_SYSTEM } from "../fhir/codesystems";

// Mirror of the engine's VALID_* sets (src/odontogram.ts:2145-2153).
// Kept here so the test fails loudly if a new enum value is added without a code.
const EXPECTED = {
  toothSelection: ["none","tooth-base","milktooth","implant","tooth-crownprep","tooth-under-gum","no-tooth-after-extraction"],
  endo: ["none","endo-medical-filling","endo-filling","endo-filling-incomplete","endo-glass-pin","endo-metal-pin"],
  fillingMaterial: ["none","amalgam","composite","gic","temporary"],
  bridgeUnit: ["none","removable","zircon","metal","temporary","bar","bar-prosthesis"],
  mobility: ["none","m1","m2","m3"],
  crownMaterial: ["natural","broken","radix","emax","zircon","metal","temporary","telescope","healing-abutment","locator","locator-prosthesis","bar","bar-prosthesis"],
  mods: ["inflammation","parodontal","mobility"],
  caries: ["caries-subcrown","caries-buccal","caries-lingual","caries-mesial","caries-distal","caries-occlusal"],
  fillingSurfaces: ["buccal","lingual","mesial","distal","occlusal"],
} as const;

describe("FHIR code systems", () => {
  it("exposes stable canonical URLs", () => {
    expect(LOCAL_SYSTEM).toMatch(/^https?:\/\//);
    expect(FDI_SYSTEM).toMatch(/iso|fdi|3950/i);
  });

  it("maps every enum value to a non-empty local code and display", () => {
    for (const [group, values] of Object.entries(EXPECTED)) {
      const map = LOCAL_VALUE_MAPS[group as keyof typeof LOCAL_VALUE_MAPS];
      expect(map, `missing value map for ${group}`).toBeDefined();
      for (const v of values) {
        const entry = map[v];
        expect(entry, `missing code for ${group}.${v}`).toBeDefined();
        expect(entry.code.length).toBeGreaterThan(0);
        expect(entry.display.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: FAIL — cannot resolve `../fhir/codesystems`.

- [ ] **Step 3: Write the implementation**

Create `src/fhir/codesystems.ts`:
```ts
/**
 * Canonical system URLs and coding maps for the FHIR export.
 *
 * - Local codes mirror the engine's own enum values and are ALWAYS emitted,
 *   guaranteeing round-trip fidelity even where no standard code exists.
 * - SNOMED CT codes are added only where a verified concept exists
 *   (see SNOMED_CODES); they are additive and never required.
 */

/** Local CodeSystem canonical URL (engine-owned codes). */
export const LOCAL_SYSTEM =
  "https://github.com/ZoliQua/React-Odontogram-Modul/fhir/CodeSystem/odontogram";

/** ISO 3950 / FDI tooth designation system. */
export const FDI_SYSTEM = "urn:iso:std:iso:3950";

/** SNOMED CT system URL. */
export const SNOMED_SYSTEM = "http://snomed.info/sct";

/** A single coded value: required local code, optional verified SNOMED code. */
export interface CodeEntry {
  code: string;
  display: string;
  snomed?: string;
}

/**
 * Local value maps, keyed by enum group then by enum value.
 * `display` strings are English (the export is language-neutral data).
 */
export const LOCAL_VALUE_MAPS: Record<string, Record<string, CodeEntry>> = {
  toothSelection: {
    "none": { code: "none", display: "No tooth status" },
    "tooth-base": { code: "tooth-base", display: "Present tooth" },
    "milktooth": { code: "milktooth", display: "Primary (deciduous) tooth" },
    "implant": { code: "implant", display: "Dental implant" },
    "tooth-crownprep": { code: "tooth-crownprep", display: "Crown preparation" },
    "tooth-under-gum": { code: "tooth-under-gum", display: "Tooth under gum" },
    "no-tooth-after-extraction": { code: "no-tooth-after-extraction", display: "Missing after extraction" },
  },
  endo: {
    "none": { code: "none", display: "No endodontic treatment" },
    "endo-medical-filling": { code: "endo-medical-filling", display: "Endodontic medical filling" },
    "endo-filling": { code: "endo-filling", display: "Root canal filling" },
    "endo-filling-incomplete": { code: "endo-filling-incomplete", display: "Incomplete root canal filling" },
    "endo-glass-pin": { code: "endo-glass-pin", display: "Glass fiber post" },
    "endo-metal-pin": { code: "endo-metal-pin", display: "Metal post" },
  },
  fillingMaterial: {
    "none": { code: "none", display: "No filling" },
    "amalgam": { code: "amalgam", display: "Amalgam filling" },
    "composite": { code: "composite", display: "Composite filling" },
    "gic": { code: "gic", display: "Glass ionomer cement filling" },
    "temporary": { code: "temporary", display: "Temporary filling" },
  },
  bridgeUnit: {
    "none": { code: "none", display: "No bridge unit" },
    "removable": { code: "removable", display: "Removable prosthesis" },
    "zircon": { code: "zircon", display: "Zirconia bridge" },
    "metal": { code: "metal", display: "Metal bridge" },
    "temporary": { code: "temporary", display: "Temporary bridge" },
    "bar": { code: "bar", display: "Bar" },
    "bar-prosthesis": { code: "bar-prosthesis", display: "Bar-retained prosthesis" },
  },
  mobility: {
    "none": { code: "none", display: "No mobility" },
    "m1": { code: "m1", display: "Mobility grade 1" },
    "m2": { code: "m2", display: "Mobility grade 2" },
    "m3": { code: "m3", display: "Mobility grade 3" },
  },
  crownMaterial: {
    "natural": { code: "natural", display: "Natural crown" },
    "broken": { code: "broken", display: "Broken crown" },
    "radix": { code: "radix", display: "Root remnant (radix)" },
    "emax": { code: "emax", display: "E.max crown" },
    "zircon": { code: "zircon", display: "Zirconia crown" },
    "metal": { code: "metal", display: "Metal-ceramic crown" },
    "temporary": { code: "temporary", display: "Temporary crown" },
    "telescope": { code: "telescope", display: "Telescopic crown" },
    "healing-abutment": { code: "healing-abutment", display: "Healing abutment" },
    "locator": { code: "locator", display: "Locator abutment" },
    "locator-prosthesis": { code: "locator-prosthesis", display: "Locator-retained prosthesis" },
    "bar": { code: "bar", display: "Bar abutment" },
    "bar-prosthesis": { code: "bar-prosthesis", display: "Bar-retained prosthesis" },
  },
  mods: {
    "inflammation": { code: "inflammation", display: "Inflammation" },
    "parodontal": { code: "parodontal", display: "Periodontal involvement" },
    "mobility": { code: "mobility", display: "Mobility" },
  },
  caries: {
    "caries-subcrown": { code: "caries-subcrown", display: "Subcrown caries" },
    "caries-buccal": { code: "caries-buccal", display: "Buccal caries" },
    "caries-lingual": { code: "caries-lingual", display: "Lingual caries" },
    "caries-mesial": { code: "caries-mesial", display: "Mesial caries" },
    "caries-distal": { code: "caries-distal", display: "Distal caries" },
    "caries-occlusal": { code: "caries-occlusal", display: "Occlusal caries" },
  },
  fillingSurfaces: {
    "buccal": { code: "buccal", display: "Buccal surface" },
    "lingual": { code: "lingual", display: "Lingual surface" },
    "mesial": { code: "mesial", display: "Mesial surface" },
    "distal": { code: "distal", display: "Distal surface" },
    "occlusal": { code: "occlusal", display: "Occlusal surface" },
  },
};

/**
 * Verified SNOMED CT codes, keyed by "<group>:<value>".
 * Start empty/minimal; entries are added only after verification against the
 * official SNOMED CT browser (see Task 8b). The mapper works with or without
 * entries here — they are purely additive.
 */
export const SNOMED_CODES: Record<string, string> = {};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/fhir/codesystems.ts src/__tests__/fhir.test.ts
git commit -m "feat(fhir): add code systems and local coding maps"
```

---

## Task 3: Payload and options types

**Files:**
- Create: `src/fhir/types.ts`

- [ ] **Step 1: Write the implementation**

Create `src/fhir/types.ts`:
```ts
import type { Bundle, Observation, Patient, CodeableConcept, Coding } from "fhir/r4";

export type { Bundle, Observation, Patient, CodeableConcept, Coding };

/** Per-tooth record as produced by the engine's serializeState(). */
export interface ToothRecord {
  toothSelection?: string;
  pulpInflam?: boolean;
  endoResection?: boolean;
  mods?: string[];
  endo?: string;
  caries?: string[];
  fillingMaterial?: string;
  fillingSurfaces?: string[];
  fissureSealing?: boolean;
  contactMesial?: boolean;
  contactDistal?: boolean;
  bruxismWear?: boolean;
  bruxismNeckWear?: boolean;
  brokenMesial?: boolean;
  brokenIncisal?: boolean;
  brokenDistal?: boolean;
  extractionWound?: boolean;
  extractionPlan?: boolean;
  parapulpalPin?: boolean;
  crownReplace?: boolean;
  crownNeeded?: boolean;
  missingClosed?: boolean;
  bridgePillar?: boolean;
  bridgeUnit?: string;
  mobility?: string;
  crownMaterial?: string;
  customStates?: Record<string, unknown>;
  note?: string;
}

/** The serialized odontogram export payload (matches exportStatus()'s object). */
export interface OdontogramExportPayload {
  version: string;
  globals?: Record<string, boolean>;
  teeth: Record<string, ToothRecord>;
}

/** Options for buildFhirBundle / exportFhir. */
export interface FhirExportOptions {
  /**
   * FHIR reference string for the subject, e.g. "Patient/123".
   * When omitted, a placeholder Patient resource is added to the Bundle and
   * referenced by every Observation.
   */
  subject?: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/fhir/types.ts
git commit -m "feat(fhir): add payload and options types"
```

---

## Task 4: Declarative field-mapping table

**Files:**
- Create: `src/fhir/fieldMappings.ts`
- Test: `src/__tests__/fhir.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to the existing describe block file)**

Append to `src/__tests__/fhir.test.ts`:
```ts
import { FIELD_MAPPINGS } from "../fhir/fieldMappings";
import { LOCAL_VALUE_MAPS as MAPS } from "../fhir/codesystems";

describe("FHIR field mappings", () => {
  it("references only known value-map groups", () => {
    for (const m of FIELD_MAPPINGS) {
      if (m.valueGroup) {
        expect(MAPS[m.valueGroup], `unknown valueGroup ${m.valueGroup}`).toBeDefined();
      }
      expect(m.findingCode.length).toBeGreaterThan(0);
      expect(m.findingDisplay.length).toBeGreaterThan(0);
    }
  });

  it("covers every serialized tooth field exactly once", () => {
    const fields = FIELD_MAPPINGS.map((m) => m.field);
    expect(new Set(fields).size).toBe(fields.length); // no duplicates
    expect(fields).toContain("caries");
    expect(fields).toContain("crownMaterial");
    expect(fields).toContain("extractionPlan");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: FAIL — cannot resolve `../fhir/fieldMappings`.

- [ ] **Step 3: Write the implementation**

Create `src/fhir/fieldMappings.ts`:
```ts
/**
 * Declarative description of how each serialized tooth field becomes one or
 * more FHIR Observations. The generic emitter in toFhir.ts reads this table,
 * so adding coverage means adding a row here.
 */
export type FieldKind =
  | "enum"        // single coded value; emit if value present and not skipValue
  | "boolean"     // flag; emit when true
  | "set"         // string[]; one Observation, one component per member
  | "restoration"; // fillingMaterial + fillingSurfaces combined

export interface FieldMapping {
  /** Key in the ToothRecord. */
  field: string;
  kind: FieldKind;
  /** Local code for the finding TYPE (Observation.code). */
  findingCode: string;
  findingDisplay: string;
  /** For enum/set: which LOCAL_VALUE_MAPS group decodes the VALUE. */
  valueGroup?: string;
  /** For enum: value treated as "no finding" and skipped. */
  skipValue?: string;
  /** For restoration: the companion surfaces field. */
  surfacesField?: string;
}

export const FIELD_MAPPINGS: FieldMapping[] = [
  { field: "toothSelection", kind: "enum", valueGroup: "toothSelection", skipValue: "tooth-base", findingCode: "tooth-status", findingDisplay: "Tooth status" },
  { field: "endo", kind: "enum", valueGroup: "endo", skipValue: "none", findingCode: "endodontic-status", findingDisplay: "Endodontic status" },
  { field: "crownMaterial", kind: "enum", valueGroup: "crownMaterial", skipValue: "natural", findingCode: "crown-material", findingDisplay: "Crown material" },
  { field: "bridgeUnit", kind: "enum", valueGroup: "bridgeUnit", skipValue: "none", findingCode: "bridge-unit", findingDisplay: "Prosthetic / bridge unit" },
  { field: "mobility", kind: "enum", valueGroup: "mobility", skipValue: "none", findingCode: "tooth-mobility", findingDisplay: "Tooth mobility" },

  { field: "caries", kind: "set", valueGroup: "caries", findingCode: "caries", findingDisplay: "Dental caries" },
  { field: "mods", kind: "set", valueGroup: "mods", findingCode: "tooth-modifier", findingDisplay: "Tooth modifier" },

  { field: "fillingMaterial", kind: "restoration", valueGroup: "fillingMaterial", skipValue: "none", surfacesField: "fillingSurfaces", findingCode: "restoration", findingDisplay: "Dental restoration" },

  { field: "pulpInflam", kind: "boolean", findingCode: "pulp-inflammation", findingDisplay: "Pulp inflammation" },
  { field: "endoResection", kind: "boolean", findingCode: "apicoectomy", findingDisplay: "Apicoectomy / root resection" },
  { field: "fissureSealing", kind: "boolean", findingCode: "fissure-sealing", findingDisplay: "Fissure sealing" },
  { field: "contactMesial", kind: "boolean", findingCode: "contact-mesial", findingDisplay: "Mesial contact issue" },
  { field: "contactDistal", kind: "boolean", findingCode: "contact-distal", findingDisplay: "Distal contact issue" },
  { field: "bruxismWear", kind: "boolean", findingCode: "bruxism-wear", findingDisplay: "Bruxism wear" },
  { field: "bruxismNeckWear", kind: "boolean", findingCode: "bruxism-neck-wear", findingDisplay: "Cervical (neck) wear" },
  { field: "brokenMesial", kind: "boolean", findingCode: "broken-mesial", findingDisplay: "Mesial fracture" },
  { field: "brokenIncisal", kind: "boolean", findingCode: "broken-incisal", findingDisplay: "Incisal fracture" },
  { field: "brokenDistal", kind: "boolean", findingCode: "broken-distal", findingDisplay: "Distal fracture" },
  { field: "parapulpalPin", kind: "boolean", findingCode: "parapulpal-pin", findingDisplay: "Parapulpal pin" },
  { field: "bridgePillar", kind: "boolean", findingCode: "bridge-pillar", findingDisplay: "Bridge abutment (pillar)" },
  { field: "extractionWound", kind: "boolean", findingCode: "extraction-wound", findingDisplay: "Extraction wound" },
  { field: "extractionPlan", kind: "boolean", findingCode: "extraction-planned", findingDisplay: "Planned extraction" },
  { field: "crownReplace", kind: "boolean", findingCode: "crown-replace-planned", findingDisplay: "Planned crown replacement" },
  { field: "crownNeeded", kind: "boolean", findingCode: "crown-needed", findingDisplay: "Crown needed" },
  { field: "missingClosed", kind: "boolean", findingCode: "missing-gap-closed", findingDisplay: "Closed gap (missing tooth)" },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/fhir/fieldMappings.ts src/__tests__/fhir.test.ts
git commit -m "feat(fhir): add declarative field-mapping table"
```

---

## Task 5: Bundle skeleton, subject handling, coding helpers

**Files:**
- Create: `src/fhir/toFhir.ts`
- Test: `src/__tests__/fhir.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/fhir.test.ts`:
```ts
import { buildFhirBundle } from "../fhir/toFhir";
import type { OdontogramExportPayload } from "../fhir/types";

const emptyPayload: OdontogramExportPayload = { version: "1.3", globals: {}, teeth: {} };

describe("buildFhirBundle — skeleton & subject", () => {
  it("returns a valid empty collection Bundle with a placeholder Patient", () => {
    const b = buildFhirBundle(emptyPayload);
    expect(b.resourceType).toBe("Bundle");
    expect(b.type).toBe("collection");
    const patients = (b.entry ?? []).filter((e) => e.resource?.resourceType === "Patient");
    expect(patients).toHaveLength(1);
  });

  it("uses the supplied subject and omits the placeholder Patient", () => {
    const b = buildFhirBundle(emptyPayload, { subject: "Patient/abc" });
    const patients = (b.entry ?? []).filter((e) => e.resource?.resourceType === "Patient");
    expect(patients).toHaveLength(0);
  });

  it("never throws on null/garbage input", () => {
    // @ts-expect-error intentional bad input
    expect(() => buildFhirBundle(null)).not.toThrow();
    // @ts-expect-error intentional bad input
    const b = buildFhirBundle({ teeth: "nope" });
    expect(b.resourceType).toBe("Bundle");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: FAIL — cannot resolve `../fhir/toFhir`.

- [ ] **Step 3: Write the implementation**

Create `src/fhir/toFhir.ts`:
```ts
import type {
  Bundle,
  Observation,
  Patient,
  CodeableConcept,
  Coding,
  OdontogramExportPayload,
  ToothRecord,
  FhirExportOptions,
} from "./types";
import {
  LOCAL_SYSTEM,
  FDI_SYSTEM,
  SNOMED_SYSTEM,
  SNOMED_CODES,
  LOCAL_VALUE_MAPS,
  type CodeEntry,
} from "./codesystems";
import { FIELD_MAPPINGS } from "./fieldMappings";

const PLACEHOLDER_PATIENT_ID = "odontogram-subject";

/** Build a CodeableConcept: always a local coding, plus SNOMED when verified. */
function concept(system: string, entry: CodeEntry, snomedKey?: string): CodeableConcept {
  const codings: Coding[] = [{ system, code: entry.code, display: entry.display }];
  const sct = entry.snomed ?? (snomedKey ? SNOMED_CODES[snomedKey] : undefined);
  if (sct) codings.push({ system: SNOMED_SYSTEM, code: sct, display: entry.display });
  return { coding: codings, text: entry.display };
}

/** Decode an enum value via a value-map group, tolerating unknown values. */
function valueConcept(group: string, value: string): CodeableConcept {
  const entry = LOCAL_VALUE_MAPS[group]?.[value] ?? { code: value, display: value };
  return concept(LOCAL_SYSTEM, entry, `${group}:${value}`);
}

/** The Observation.code identifying a finding TYPE (engine-local). */
function findingConcept(code: string, display: string): CodeableConcept {
  return concept(LOCAL_SYSTEM, { code, display }, `finding:${code}`);
}

/** FDI/ISO 3950 tooth bodySite. The internal key is already an FDI number. */
function toothBodySite(fdi: string): CodeableConcept {
  return { coding: [{ system: FDI_SYSTEM, code: fdi }], text: `Tooth ${fdi}` };
}

const baseObservation = (subjectRef: string, tooth: string, code: CodeableConcept): Observation => ({
  resourceType: "Observation",
  status: "final",
  category: [
    {
      coding: [
        { system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam", display: "Exam" },
      ],
    },
  ],
  code,
  subject: { reference: subjectRef },
  bodySite: toothBodySite(tooth),
});

/** Emit zero or more Observations for one tooth field, per its mapping. */
function emitForField(
  subjectRef: string,
  tooth: string,
  rec: ToothRecord,
  mapping: (typeof FIELD_MAPPINGS)[number],
): Observation[] {
  const raw = (rec as Record<string, unknown>)[mapping.field];

  switch (mapping.kind) {
    case "enum": {
      const value = typeof raw === "string" ? raw : "";
      if (!value || value === mapping.skipValue) return [];
      const obs = baseObservation(subjectRef, tooth, findingConcept(mapping.findingCode, mapping.findingDisplay));
      obs.valueCodeableConcept = valueConcept(mapping.valueGroup!, value);
      return [obs];
    }
    case "boolean": {
      if (raw !== true) return [];
      const obs = baseObservation(subjectRef, tooth, findingConcept(mapping.findingCode, mapping.findingDisplay));
      obs.valueBoolean = true;
      return [obs];
    }
    case "set": {
      const arr = Array.isArray(raw) ? (raw as unknown[]).filter((v): v is string => typeof v === "string") : [];
      if (arr.length === 0) return [];
      const obs = baseObservation(subjectRef, tooth, findingConcept(mapping.findingCode, mapping.findingDisplay));
      obs.component = arr.map((v) => ({ code: valueConcept(mapping.valueGroup!, v) }));
      return [obs];
    }
    case "restoration": {
      const material = typeof raw === "string" ? raw : "";
      const surfaces = Array.isArray(rec[mapping.surfacesField as keyof ToothRecord] as unknown)
        ? ((rec[mapping.surfacesField as keyof ToothRecord] as unknown[]).filter((v): v is string => typeof v === "string"))
        : [];
      if ((!material || material === mapping.skipValue) && surfaces.length === 0) return [];
      const obs = baseObservation(subjectRef, tooth, findingConcept(mapping.findingCode, mapping.findingDisplay));
      if (material && material !== mapping.skipValue) {
        obs.valueCodeableConcept = valueConcept(mapping.valueGroup!, material);
      }
      if (surfaces.length > 0) {
        obs.component = surfaces.map((v) => ({ code: valueConcept("fillingSurfaces", v) }));
      }
      return [obs];
    }
    default:
      return [];
  }
}

/**
 * Convert a serialized odontogram payload into a FHIR R4 collection Bundle.
 * Pure: no DOM, no network. Tolerant of malformed input (never throws).
 */
export function buildFhirBundle(
  payload: OdontogramExportPayload,
  options: FhirExportOptions = {},
): Bundle {
  const teeth =
    payload && typeof payload === "object" && payload.teeth && typeof payload.teeth === "object"
      ? payload.teeth
      : {};

  const subjectRef = options.subject ?? `Patient/${PLACEHOLDER_PATIENT_ID}`;
  const entries: Bundle["entry"] = [];

  if (!options.subject) {
    const patient: Patient = { resourceType: "Patient", id: PLACEHOLDER_PATIENT_ID };
    entries.push({ resource: patient });
  }

  for (const [tooth, recRaw] of Object.entries(teeth)) {
    const rec = (recRaw && typeof recRaw === "object" ? recRaw : {}) as ToothRecord;
    for (const mapping of FIELD_MAPPINGS) {
      for (const obs of emitForField(subjectRef, tooth, rec, mapping)) {
        entries.push({ resource: obs });
      }
    }
    if (typeof rec.note === "string" && rec.note.trim().length > 0) {
      const noteObs = baseObservation(subjectRef, tooth, findingConcept("tooth-note", "Tooth note"));
      noteObs.note = [{ text: rec.note }];
      entries.push({ resource: noteObs });
    }
  }

  return { resourceType: "Bundle", type: "collection", entry: entries };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/fhir/toFhir.ts src/__tests__/fhir.test.ts
git commit -m "feat(fhir): add pure buildFhirBundle mapper with subject handling"
```

---

## Task 6: Mapping behavior tests (findings, surfaces, hybrid coding, unknown enum)

**Files:**
- Test: `src/__tests__/fhir.test.ts` (append)

- [ ] **Step 1: Write the tests**

Append to `src/__tests__/fhir.test.ts`:
```ts
import { LOCAL_SYSTEM as LS, FDI_SYSTEM as FS } from "../fhir/codesystems";

function obsOf(b: ReturnType<typeof buildFhirBundle>) {
  return (b.entry ?? []).map((e) => e.resource).filter((r): r is NonNullable<typeof r> => r?.resourceType === "Observation") as import("fhir/r4").Observation[];
}

describe("buildFhirBundle — mapping behavior", () => {
  it("emits an enum finding with correct tooth bodySite and skips defaults", () => {
    const b = buildFhirBundle({
      version: "1.3",
      teeth: {
        "11": { toothSelection: "implant" },
        "12": { toothSelection: "tooth-base" }, // default -> skipped
      },
    });
    const obs = obsOf(b);
    expect(obs).toHaveLength(1);
    expect(obs[0].bodySite?.coding?.[0].system).toBe(FS);
    expect(obs[0].bodySite?.coding?.[0].code).toBe("11");
    expect(obs[0].valueCodeableConcept?.coding?.[0].system).toBe(LS);
    expect(obs[0].valueCodeableConcept?.coding?.[0].code).toBe("implant");
  });

  it("emits caries as one Observation with a component per surface", () => {
    const b = buildFhirBundle({ version: "1.3", teeth: { "21": { caries: ["caries-mesial", "caries-occlusal"] } } });
    const caries = obsOf(b).filter((o) => o.code.coding?.[0].code === "caries");
    expect(caries).toHaveLength(1);
    expect(caries[0].component).toHaveLength(2);
    expect(caries[0].component?.map((c) => c.code.coding?.[0].code).sort()).toEqual(["caries-mesial", "caries-occlusal"]);
  });

  it("emits restoration with material value and surface components", () => {
    const b = buildFhirBundle({ version: "1.3", teeth: { "36": { fillingMaterial: "composite", fillingSurfaces: ["occlusal"] } } });
    const r = obsOf(b).filter((o) => o.code.coding?.[0].code === "restoration");
    expect(r).toHaveLength(1);
    expect(r[0].valueCodeableConcept?.coding?.[0].code).toBe("composite");
    expect(r[0].component?.[0].code.coding?.[0].code).toBe("occlusal");
  });

  it("emits boolean findings only when true", () => {
    const b = buildFhirBundle({ version: "1.3", teeth: { "46": { extractionPlan: true, crownNeeded: false } } });
    const codes = obsOf(b).map((o) => o.code.coding?.[0].code);
    expect(codes).toContain("extraction-planned");
    expect(codes).not.toContain("crown-needed");
  });

  it("attaches per-tooth note as an Observation note", () => {
    const b = buildFhirBundle({ version: "1.3", teeth: { "11": { note: "watch this tooth" } } });
    const note = obsOf(b).find((o) => o.code.coding?.[0].code === "tooth-note");
    expect(note?.note?.[0].text).toBe("watch this tooth");
  });

  it("tolerates unknown enum values via a local code, no throw", () => {
    const b = buildFhirBundle({ version: "1.3", teeth: { "11": { crownMaterial: "future-material-xyz" } } });
    const cm = obsOf(b).find((o) => o.code.coding?.[0].code === "crown-material");
    expect(cm?.valueCodeableConcept?.coding?.[0].code).toBe("future-material-xyz");
  });

  it("always includes a local coding and a status on every Observation", () => {
    const b = buildFhirBundle({ version: "1.3", teeth: { "11": { mobility: "m2" } } });
    for (const o of obsOf(b)) {
      expect(o.status).toBe("final");
      expect(o.code.coding?.some((c) => c.system === LS)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: PASS (14 tests total). If any fail, fix `toFhir.ts` — do not weaken the tests.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/fhir.test.ts
git commit -m "test(fhir): cover findings, surfaces, hybrid coding, unknown enums"
```

---

## Task 7: Wire `exportFhir()` into the engine (download + API)

**Files:**
- Modify: `src/odontogram.ts` (refactor payload builder, add `exportFhir`, wire button)
- Modify: `src/App.tsx` (re-export + UI button)

- [ ] **Step 1: Extract a payload builder and add `exportFhir` in `src/odontogram.ts`**

Replace the body of `exportStatus()` (`src/odontogram.ts:2207-2234`) so it reuses a new helper, and add `exportFhir` right after. Find:
```ts
function exportStatus(){
  const teeth = {};
  for(const toothNo of ALL_TEETH){
    const s = toothState.get(toothNo) ?? defaultState();
    teeth[toothNo] = serializeState(s);
  }
  const payload = {
    version: "1.3",
    globals: {
      wisdomVisible,
      showBase,
      occlusalVisible,
      showHealthyPulp,
      edentulous,
    },
    teeth,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `odontogram-status-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```
Replace with:
```ts
function collectExportPayload(){
  const teeth = {};
  for(const toothNo of ALL_TEETH){
    const s = toothState.get(toothNo) ?? defaultState();
    teeth[toothNo] = serializeState(s);
  }
  return {
    version: "1.3",
    globals: {
      wisdomVisible,
      showBase,
      occlusalVisible,
      showHealthyPulp,
      edentulous,
    },
    teeth,
  };
}

function downloadJson(payload: Any, filenamePrefix: string){
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportStatus(){
  downloadJson(collectExportPayload(), "odontogram-status");
}

/**
 * Export the current odontogram as an HL7 FHIR R4 collection Bundle (JSON).
 * @param options - Optional subject reference (e.g. "Patient/123"); when
 *   omitted a placeholder Patient is embedded.
 */
export function exportFhir(options?: FhirExportOptions){
  const bundle = buildFhirBundle(collectExportPayload(), options);
  downloadJson(bundle, "odontogram-fhir");
}
```

- [ ] **Step 2: Add the imports at the top of `src/odontogram.ts`**

Add near the other top-of-file imports:
```ts
import { buildFhirBundle } from "./fhir/toFhir";
import type { FhirExportOptions } from "./fhir/types";
```
(Place them with the existing import group; if the file has no import block for local modules, add immediately after the first import line.)

- [ ] **Step 3: Wire the new button in `wireControls` (`src/odontogram.ts:2987-2992`)**

Find:
```ts
  const exportBtn = $("#btnStatusExport") as HTMLButtonElement | null;
  const importBtn = $("#btnStatusImport") as HTMLButtonElement | null;
  const importInput = $("#statusImportInput") as HTMLInputElement | null;
  if(exportBtn){
    exportBtn.onclick = () => exportStatus();
  }
```
Replace with:
```ts
  const exportBtn = $("#btnStatusExport") as HTMLButtonElement | null;
  const fhirBtn = $("#btnStatusFhirExport") as HTMLButtonElement | null;
  const importBtn = $("#btnStatusImport") as HTMLButtonElement | null;
  const importInput = $("#statusImportInput") as HTMLInputElement | null;
  if(exportBtn){
    exportBtn.onclick = () => exportStatus();
  }
  if(fhirBtn){
    fhirBtn.onclick = () => exportFhir();
  }
```

- [ ] **Step 4: Re-export `exportFhir` from `src/App.tsx`**

In `src/App.tsx:2-3`, add `exportFhir` to BOTH the import-from-`./odontogram` list and the re-export list. The import line becomes (append `, exportFhir` before the closing brace):
```ts
import { destroyOdontogram, initOdontogram, setNumberingSystem, clearSelection, setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible, registerPlugins, setPluginState, getPluginState, getToothStateSummary, setReadOnly, getReadOnly, setNotesEnabled, getNotesEnabled, exportFhir } from "./odontogram";
```
The re-export line becomes:
```ts
export { clearSelection, setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible, registerPlugins, setPluginState, getPluginState, getToothStateSummary, setReadOnly, getReadOnly, setNotesEnabled, getNotesEnabled, exportFhir };
```
Also re-export the options type (add after line 10's pattern):
```ts
export type { FhirExportOptions } from "./fhir/types";
```

- [ ] **Step 5: Add the UI button in `src/App.tsx:289-291`**

Find:
```tsx
          <button id="btnStatusExport" className="btn btn-ghost btn-sm">{t("topbar.exportStatus")}</button>
          <button id="btnStatusImport" className="btn btn-ghost btn-sm">{t("topbar.importStatus")}</button>
```
Replace with:
```tsx
          <button id="btnStatusExport" className="btn btn-ghost btn-sm">{t("topbar.exportStatus")}</button>
          <button id="btnStatusFhirExport" className="btn btn-ghost btn-sm">{t("topbar.exportFhir")}</button>
          <button id="btnStatusImport" className="btn btn-ghost btn-sm">{t("topbar.importStatus")}</button>
```

- [ ] **Step 6: Type-check (the i18n key does not exist yet — that is expected to pass since `t` takes a string key; confirm no TS errors)**

Run: `npx tsc -b --noEmit`
Expected: no errors. (If `t()` is typed to a key union and errors on `"topbar.exportFhir"`, complete Task 8 first, then re-run.)

- [ ] **Step 7: Commit**

```bash
git add src/odontogram.ts src/App.tsx
git commit -m "feat(fhir): wire exportFhir API, button, and re-export"
```

---

## Task 8: i18n labels for all 8 languages

**Files:**
- Modify: `src/i18n/translations.ts`

- [ ] **Step 1: Add the `topbar.exportFhir` key after each `topbar.exportStatus`**

For EACH language block, immediately after the `"topbar.exportStatus": "..."` line (lines 29, 214, 399, 584, 769, 954, 1139, 1324), add the matching line below. Use these exact values:

- `hu` (after line 29): `    "topbar.exportFhir": "FHIR export",`
- `en` (after line 214): `    "topbar.exportFhir": "FHIR export",`
- `de` (after line 399): `    "topbar.exportFhir": "FHIR-Export",`
- `es` (after line 584): `    "topbar.exportFhir": "Exportar FHIR",`
- `it` (after line 769): `    "topbar.exportFhir": "Esporta FHIR",`
- `sk` (after line 954): `    "topbar.exportFhir": "Export FHIR",`
- `pl` (after line 1139): `    "topbar.exportFhir": "Eksport FHIR",`
- `ru` (after line 1324): `    "topbar.exportFhir": "Экспорт FHIR",`

- [ ] **Step 2: Verify all languages have the key (translations test should enforce parity)**

Run: `npx vitest run src/__tests__/translations.test.ts`
Expected: PASS (the existing key-parity test confirms all 8 languages share the same keys). If it fails, a language is missing the key — add it.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "i18n(fhir): add FHIR export label in all 8 languages"
```

---

## Task 8b: (Optional, additive) Populate verified SNOMED CT codes

**Files:**
- Modify: `src/fhir/codesystems.ts` (`SNOMED_CODES`)

- [ ] **Step 1: Look up codes in the official SNOMED CT browser**

Open https://browser.ihtsdotools.org/ . For each finding/value you want enriched, search the clinical term, confirm the active concept, and copy its `conceptId`. Keys use `"finding:<findingCode>"`, `"<group>:<value>"`, or `"fillingSurfaces:<surface>"` to match the lookup in `toFhir.ts`. Example shape (replace with VERIFIED ids only):
```ts
export const SNOMED_CODES: Record<string, string> = {
  "finding:caries": "80967001", // Dental caries (disorder) — VERIFY before keeping
};
```

- [ ] **Step 2: Confirm the mechanism via a test**

Add to `src/__tests__/fhir.test.ts` only if you populated at least one entry:
```ts
it("adds a SNOMED coding alongside the local one when a verified code exists", () => {
  const b = buildFhirBundle({ version: "1.3", teeth: { "11": { caries: ["caries-mesial"] } } });
  const caries = obsOf(b).find((o) => o.code.coding?.[0].code === "caries");
  const systems = caries?.code.coding?.map((c) => c.system) ?? [];
  expect(systems).toContain(LS); // local always present
  // SNOMED presence depends on SNOMED_CODES["finding:caries"] being set
});
```

Run: `npx vitest run src/__tests__/fhir.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/fhir/codesystems.ts src/__tests__/fhir.test.ts
git commit -m "feat(fhir): add verified SNOMED CT codings"
```

> If you skip this task, the export is fully functional with local codings only — exactly as the spec allows.

---

## Task 9: Docs and version bump

**Files:**
- Modify: `README.md`
- Modify: `package.json` (version)

- [ ] **Step 1: Update README feature list**

In `README.md`, add a bullet to the features section (mirror the existing emoji-bullet style), e.g.:
`- 🔗 HL7 FHIR R4 export (collection Bundle of per-tooth Observations, ISO 3950 tooth coding, hybrid local+SNOMED codings)`

- [ ] **Step 2: Bump version**

In `package.json`, change `"version": "1.4.2"` to `"version": "1.5.0"`.

- [ ] **Step 3: Full check + full test run**

Run:
```bash
npx tsc -b --noEmit
npm test
```
Expected: type-check clean; ALL tests pass (existing suites + new `fhir.test.ts`).

- [ ] **Step 4: Build the library**

Run: `npm run build`
Expected: `tsc -b` + `vite build` succeed with no errors.

- [ ] **Step 5: Commit and push the submodule**

```bash
git add README.md package.json
git commit -m "docs: document FHIR export; bump engine to v1.5.0"
git push origin main
```

---

## Task 10: Main-app compatibility verification (critical)

This task PROVES the host DentalQuoteCreator app still builds and runs after the engine change. Run from the MAIN repo root: `cd /Users/Zoli/Sites/DentalQuoteCreator`.

**Files:**
- Modify: submodule pointer for `src/modules/odontogram/engine` (main repo)

- [ ] **Step 1: Point the submodule at the new engine commit**

```bash
cd /Users/Zoli/Sites/DentalQuoteCreator
git -C src/modules/odontogram/engine log -1 --oneline   # confirm it is the v1.5.0 commit
git add src/modules/odontogram/engine
```

- [ ] **Step 2: Confirm the host still imports only the unchanged exports**

Run:
```bash
grep -n "@odontogram-shell" src/modules/odontogram/OdontogramHost.tsx
```
Expected: the import line lists only `OdontogramApp, clearSelection, setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible`. We added exports but removed none, and `btnStatusExport` is unchanged — so no host edits are required. (The new `exportFhir` is intentionally NOT added to `odontogram-shell.d.ts`; the host does not call it yet.)

- [ ] **Step 3: Main app type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. (The main app resolves `@odontogram-shell` via the ambient `.d.ts`, so engine-internal `fhir/r4` types are not in its program.)

- [ ] **Step 4: Main app build**

Run: `npm run build`
Expected: Vite build succeeds. The FHIR mapper is bundled (small, type-only deps erased); no new runtime dependency is added.

- [ ] **Step 5: Manual smoke test (frontend dev)**

Run: `npm run dev`, open the app, navigate to a patient's odontogram. Verify:
  - the odontogram renders as before,
  - the existing "Export status" / "Import status" buttons still work,
  - the new "FHIR export" button downloads `odontogram-fhir-<timestamp>.json`,
  - opening that file shows `"resourceType": "Bundle"`, `"type": "collection"`, a placeholder `Patient`, and `Observation` entries for any non-default teeth.
  - Backend save/load of the odontogram (OdontogramCurrent) is unaffected (the internal JSON format is unchanged).

- [ ] **Step 6: Commit the pointer bump (main repo)**

```bash
git commit -m "chore: bump odontogram submodule to v1.5.0 (FHIR export)"
```
(Do not push the main repo unless the user asks.)

---

## Self-review notes (completed by plan author)

- **Spec coverage:** module structure (Tasks 2-5), comprehensive field coverage (Task 4 table covers every `serializeState` field; Task 2 covers every enum value; a coverage test enforces both), hybrid coding (Task 5 `concept()` + Task 8b), subject handling (Task 5), Bundle `collection` (Task 5), UI + i18n (Tasks 7-8), `@types/fhir` devDep (Task 1), export-only (no import task), edge cases (Task 5/6 tests: empty, null, unknown enum), versioning/docs (Task 9), main-app safety (Task 10). All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; Task 8b is explicitly optional and additive with concrete verification steps, not a placeholder.
- **Type consistency:** `buildFhirBundle`, `FhirExportOptions`, `OdontogramExportPayload`, `collectExportPayload`, `downloadJson`, `LOCAL_VALUE_MAPS`, `FIELD_MAPPINGS`, `SNOMED_CODES`, button id `btnStatusFhirExport`, i18n key `topbar.exportFhir` are used consistently across tasks.
- **Boolean note on `toothSelection` skipValue:** default present tooth is `tooth-base`; only non-default selections emit a status Observation (matches "healthy tooth emits nothing").
