# Dental ICD-10 diagnosis coding — program design + DX-0 foundation spec

Date: 2026-08-19
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Status: design approved (brainstorming); this doc frames the whole program and
specifies the first sub-project (DX-0) in enough detail for an implementation plan.

## 1. Goal

Give the odontogram a **structured dental diagnosis coding layer**, so charted
findings carry proper diagnosis codes that serve three consumers at once:

1. **Clinical FHIR export / interoperability** — international WHO ICD-10.
2. **National reporting** (e.g. Hungarian NEAK / BNO-10) — a pluggable national code.
3. **Chart display** — the diagnosis shown in the tooltip / whole-mouth summary.

The module is **open and international**, so **WHO ICD-10 is the always-on base**;
national systems (BNO-10, ICD-10-CM, …) are **optional, pluggable overlays**, and
SNOMED CT is a parallel overlay. Coverage target is the full dental/oral ICD-10
chapter **K00–K14**.

## 2. Research findings that shaped the design (2026-08-19, web-sourced)

- The **dental chapter K00–K14 is remarkably stable** across national ICD-10
  variants. Only **one** system is a genuine clinical remapping of the dental
  codes: **US ICD-10-CM** (extra granularity — caries by surface/depth
  `K02.5x`/`K02.6x`; and `K05.2` means *aggressive periodontitis* in CM vs *acute
  periodontitis* in WHO).
- **Hungary (BNO-10)** and **Slovakia (MKCH-10)** are **pure translations** —
  identical WHO codes, localized language. Hungary's KSH states BNO-10 == WHO
  ICD-10 (2019).
- **Germany (ICD-10-GM)** and **France (CIM-10)** are "modifications" overall, but
  the divergence lives **outside K00–K14**, so for the dental chapter they are
  effectively translations. *(Caveat: not verified line-by-line — validate a
  DE/FR/CN pack against the national tabular before shipping it.)*
- **UK** does **not** ICD-code dental diagnoses at all — it uses **FP17 treatment
  bands + SNOMED CT**.
- **Cross-cutting:** dentistry worldwide mostly codes **procedures/treatments**
  (CDT, BEMA/GOZ, CCAM/NGAP, FP17), and diagnosis coding is often optional/absent.
  Structured dental *diagnosis* terminology is promoted mainly in the US
  (SNODENT/SNOMED). The engine already models the procedure side (restorations,
  prosthesis, endo), so a diagnosis layer is genuinely additive.

**Implication:** for ~6 of 7 national systems a "pack" is essentially a
**display-language translation on the same WHO codes** (cheap: a label table keyed
by WHO code + the national system URI). Only the **US needs a true code-set remap**
— and conveniently the engine already charts the extra axes CM needs (caries
surface/depth, pulp acuity), so that crosswalk is feasible.

## 3. Architecture

Two orthogonal axes, deliberately separated:

- **Code system (which codes):** WHO ICD-10 = always-on base. National
  modifications are pluggable **coding packs**; SNOMED CT is a parallel overlay.
  A FHIR `Condition` carries **multiple `code.coding[]`** at once (WHO base +
  active national + SNOMED).
- **Display language (which language):** the existing `translations.ts` i18n,
  independent of the code system. A French user can emit WHO codes with French
  labels.

**Coding-pack classes:**
- **translation-class** — same WHO codes, localized display + national system URI.
  Adding a country ≈ adding a language (a label table keyed by diagnosis key).
- **modification-class** — a real code crosswalk (only US ICD-10-CM so far).

**Diagnosis model — derive + override (generalizes `perioClassification`):** each
charted finding **derives** a default diagnosis (base WHO code) via a pure
function; the clinician can **override** the code where clinical judgment is needed
(subsite, acuity), and can **add** diagnoses that have no visual chart
representation (cysts, TMJ, stomatitis). One emitter consumes derived + explicit.

## 4. Decomposition (the program)

Each sub-project gets its own spec → plan → implementation cycle.

- **DX-0 — Foundation** *(specified below).* Base-WHO coding model + `CodingPack`
  abstraction + a generalized `appendConditions` emitter, proven end-to-end with a
  **caries → K02** vertical slice, and **behavior-preserving for the existing K05
  perio Condition** (refactored to feed the new emitter; golden byte-identical).
- **DX-1 — Map the already-charted findings** (no new UI): derivation rules for
  K01/K02/K03/K04/K06/K08/K00.3 from existing axes, with override where
  subsite/acuity matters.
- **DX-2 — Per-tooth diagnosis sub-record + picker** (override/addition store,
  searchable ICD/BNO picker, tooltip/summary).
- **DX-3 — Case/regional conditions** (new charting: TMJ K07, cyst K09, salivary
  K11, stomatitis K12, arch-level developmental K00).
- **DX-4 — First national pack: BNO-10** (translation-class) + a
  "add-your-country" contributor guide; the NEAK/BNO reporting export folds in here.
- **DX-5 — US ICD-10-CM** (modification-class reference pack, reusing the charted
  surface/depth/acuity axes).
- **DX-6 — SNOMED CT activation** (verified dental refset — what UK/US actually use).
- **DX-7 — FHIR import round-trip** of coded diagnoses.

## 5. DX-0 — foundation, detailed design

**Objective:** stand up the coding layer end-to-end with the smallest real slice,
without changing any existing output.

### 5.1 Data model (new `src/dx/` directory)

- `DiagnosisKey` — internal diagnosis identifiers. DX-0 needs only the ones its
  slice + the existing perio path use: `caries`, `periodontitis`, `gingivitis`
  (more added per sub-project).
- `DX_CODES: Record<DiagnosisKey, DiagnosisCode>` — the base catalog.
  `DiagnosisCode = { icd10: string; icd10Display: string; snomed?: string }`
  (WHO base + optional SNOMED slot, mirroring `CodeEntry.snomed?`).
- `CodingPack` — `{ id; system; kind: "translation" | "modification";
  displays?: Partial<Record<DiagnosisKey,string>>;   // translation
  codes?: Partial<Record<DiagnosisKey,{code:string;display:string}>> }` // modification.
- `BNO10_PACK` — the first pack (translation-class): same WHO codes, Hungarian
  displays, system URI for BNO-10. Proves the cheap path.

### 5.2 Emitter — generalize the perio Condition builder

Refactor `appendPerioCondition` (`src/fhir/toFhirPerio.ts`) so the perio path
*computes its diagnosis + K05 code* and hands it to a new general
`appendConditions(bundle, diagnoses, options)` housed in a new
`src/fhir/toFhirDx.ts` (the perio builder calls it; no logic duplicated). `appendConditions` builds each
`Condition.code.coding[]` as: **WHO base coding (always)** + active national pack
coding (translation → same code, national URI, localized display; modification →
mapped code) + SNOMED coding when present/enabled. **The existing K05 bundle output
must stay byte-identical** (default = no pack, no SNOMED → single WHO coding, same
as today).

### 5.3 Derivation — the caries → K02 vertical slice

`deriveDentalDiagnoses(payloadOrState)` — a pure, dependency-free function (like
`derivePerioClassification`) that, for DX-0, inspects each tooth's `caries` and
emits a `caries` diagnosis (→ `K02`). DX-1 extends it to every finding. Two thin
adapters feed it (live state → UI; payload → FHIR), one-directional, no duplicated
logic — the same pattern P4b used.

### 5.4 Override scaffold

A per-tooth `dxOverrides` map (diagnosis key → override code), NOT DS-1 gated —
same treatment as the perio overrides — plus `getDiagnosisOverride`/
`setDiagnosisOverride`. Caries is per-tooth, so DX-0 scaffolds the per-tooth store;
case-level overrides arrive with DX-3. DX-0 wires the *mechanism* only; the picker
UI is DX-2. Payload version bump (additive).

### 5.5 Pack selection setting

`getDiagnosisCodingPack()` / `setDiagnosisCodingPack(id | null)` — an **app-level
session flag** like `perioViewMode` (default `null` = base WHO only; **not** part
of the export payload). A Settings → General `SelectRow` lists
the available packs (DX-0 ships `none` + `bno10`); a dedicated Coding tab arrives
with DX-6 when SNOMED + more packs land. Optional SNOMED toggle deferred to DX-6.

### 5.6 Surfacing

A minimal whole-mouth "Diagnoses (coded)" summary fragment listing derived
diagnoses + their active code, gated to non-empty — enough to see DX-0 working;
the rich per-tooth UI is DX-2.

### 5.7 Files (DX-0)

- New: `src/dx/codes.ts` (`DiagnosisKey`, `DX_CODES`, `DiagnosisCode`),
  `src/dx/packs.ts` (`CodingPack`, `BNO10_PACK`), `src/dx/derive.ts`
  (`deriveDentalDiagnoses`), tests under `src/dx/__tests__/`.
- Changed: `src/fhir/toFhirPerio.ts` → split out `appendConditions`
  (or a new `src/fhir/toFhirDx.ts` the perio builder calls); `src/fhir/toFhir.ts`
  wiring; `src/odontogram.ts` (setting + `dxOverrides` + payload version + summary
  fragment); `src/SettingsModal.tsx` + `src/OdontogramContext.tsx` +
  `src/i18n/translations.ts` (the pack select, 12 languages); `CHANGELOG.md`.

## 6. Verification (DX-0)

- `npx tsc -b --noEmit` clean; `npx eslint .` 0 errors; full `vitest` green.
- **K05 perio FHIR bundle byte-identical** (the refactor is the guard — assert the
  frozen FHIR golden is unchanged with no pack active).
- New tests: caries → `K02` Condition emitted with the WHO base coding; with the
  BNO-10 pack active the Condition carries a **second** coding (BNO system URI,
  Hungarian display, **same K02 code** — proving the translation class); the
  US-CM path is described in the spec but implemented in DX-5.
- SVG-fingerprint + roundtrip goldens byte-identical except the additive
  `dxOverrides` payload field + version string.
- Manual: Settings → pick BNO-10 → export shows dual coding; default shows WHO only.

## 7. Risks & mitigations

- *Refactoring the perio Condition risks changing K05 output* → the FHIR golden is
  the guard; refactor is move-only, default path unchanged.
- *National pack correctness (DE/FR/CN dental chapter unverified)* → each pack is
  validated against the national tabular before shipping; DX-0 ships only BNO-10
  (a confirmed pure translation) + the WHO base.
- *Scope creep* → DX-0 is one vertical slice + the abstraction; every other finding
  and UI is a later sub-project.
- *Bundle size / data volume* → the catalog is small text data; packs are data
  tables, lazy-importable if needed.

## 8. Out of scope (DX-0)

All findings beyond caries (DX-1), the diagnosis picker UI (DX-2), regional
conditions (DX-3), the US-CM crosswalk (DX-5), SNOMED activation (DX-6), FHIR
import round-trip (DX-7), and the NEAK/BNO reporting export (DX-4). No change to
the classic anatomy, render, or existing payload semantics beyond the additive
`dxOverrides` field. No release until a sub-project is explicitly cut.
