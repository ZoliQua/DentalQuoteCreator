# Odontogram Engine — Architecture Constitution (Design Spec)

**Date:** 2026-07-12
**Status:** Approved (brainstorming) — pending user review, then per-sub-project plans
**Module:** `src/modules/odontogram/engine` (React Odontogram Modul, git submodule)
**Scope:** The cross-cutting architecture ("constitution") that every subsequent feature sub-project builds on. This document does NOT implement any feature; it defines the single shared model, coding layer, state/versioning, SVG binding, UI generation, and test strategy that the sub-project specs reference.

---

## 1. Purpose & context

A large overhaul of the odontogram engine: new SVG assets (v2.5.0), a materials overhaul, incisal surfaces for anterior teeth, a vitality/pulp-diagnosis system, root fracture, ICDAS caries staging + root/secondary caries, inlay/onlay/veneer restorations, per-surface filling-defect status, wear differentiation, discoloration, tooth-position/orthodontic anomalies, and a peri-implantitis carry-through fix — all on a **unified engineKey/coding system** that is SNOMED CT-primary and ICD-extensible.

The overhaul is too large for one spec. It is decomposed into sub-projects (§9), each with its own spec → plan → implementation cycle, all built on this constitution.

### 1.1 Locked decisions

1. **Architecture = "Approach 2": a full declarative _clinical axis registry_** as the single source of truth. State validation, UI, SVG-layer toggling, and FHIR round-trip are all **generated** from one registry. This is a deliberate big-bang rewrite of the current ad-hoc model, accepted by the product owner with the explicit requirement of **thorough post-verification** (§6).
2. **Pulp diagnosis** = AAE 2009 clinical scheme as the primary field; the classic Latin/histological subtype is an **optional detail toggled in settings, exactly like ICDAS** (`histologicalPulpDetail`).
3. **All scientific corrections** from the literature review are applied in the design; each deviation from the original feature request is flagged in that feature's sub-project spec.
4. **Codes are system-agnostic additive codings**; SNOMED CT primary, ICD default target **WHO ICD-10 / Hungarian BNO-10** (not US ICD-10-CM), ICD-11-ready. ICD is not implemented now but the field must allow it with no schema change.

### 1.2 Current-state facts (verified against code)

- Runtime tooth state is an **untyped `Map`** with live `Set`/`Map` containers (`odontogram.ts` `defaultState()` ~:129); the only formal `ToothRecord` type is the serialized shape in `fhir/types.ts`. This runtime/serialized split is a drift source the registry removes.
- Enums live in scattered `VALID_*` sets (`odontogram.ts:2427-2437`, `VALID_ICDAS` :710).
- SVG layer toggling is manual: `GROUPS` (:61-80) + `applyStateToSvgSingle` (:727-1110), `setActive` (:184).
- FHIR export/import is table-driven: `fieldMappings.ts` `FIELD_MAPPINGS`, `toFhir.ts`, and a **full round-trip importer** `fromFhir.ts` (trusts LOCAL_SYSTEM codings only). Tests: `__tests__/fhir.test.ts`, `__tests__/fhir-import.test.ts`.
- `SNOMED_CODES` is currently `{}` (empty) — no SNOMED emitted today.
- UI is a **static React skeleton** (`App.tsx`) + imperative `wireControls`/`syncControlsFromState` (`odontogram.ts:1356+`, :3129+).
- i18n: 9 languages (`hu,en,de,es,it,sk,pl,ru,pt-br`), flat string keys, `hu` = source of truth, parity test-enforced; plurals are a hardcoded binary rule (known gap for Slavic languages).
- Module uses **6 representative teeth**: templates 11, 13, 14, 16, plus occlusal views for 14 and 16; other FDI numbers reuse these via a static `TOOTH_TEMPLATE` mirror/rotate table. `FISSURE_ALLOWED` (molars), `MILKTOOTH_BLOCKED` (2nd/3rd molars).

---

## 2. Section 1 — The Clinical Axis Registry (single source of truth)

Every chartable tooth feature is a **clinical axis**. One declarative array `AXES` describes them all; four generators consume it. No more separate `VALID_*`, `FIELD_MAPPINGS`, `GROUPS`, or imperative wiring — those are derived.

```ts
type AxisKind = "enum" | "multi" | "boolean" | "surfaceSet" | "composite";

interface ClinicalAxis {
  id: string;                       // canonical axis id, e.g. "crown", "caries", "pulpDiagnosis"
  kind: AxisKind;
  finding: ConceptRef;              // FHIR Observation.code (what is observed) — additive codings
  values?: AxisValue[];             // enum/multi/surfaceSet members
  fields?: ClinicalAxis[];          // composite: nested sub-axes (qualifiers/components)
  ui: AxisUi;                       // widget, panel, order, labelKey
  appliesWhen?: (ctx: ToothContext, state: ToothState) => boolean;
  flag?: string;                    // feature-flag gate (e.g. "icdasEnabled", "histologicalPulpDetail")
  default: unknown;
  fhir: { valueKind: "codeable" | "boolean" | "integer" | "components" };
}

interface AxisValue {
  id: string;                       // engine value id, e.g. "metal-ceramic"
  coding: ConceptRef;               // additive codings for this value
  labelKey: string;                 // i18n key (no hardcoded strings)
  svgLayer?: (ctx: ToothContext) => string | string[] | null;  // view-aware layer resolution
  appliesWhen?: (ctx: ToothContext, state: ToothState) => boolean;
  flag?: string;
}
```

**Four generators, one source:**
- `validate(state)` — replaces `VALID_*` + `hydrateState` sanitisation.
- `buildPanels()` — renders the UI (replaces the static skeleton + imperative wiring).
- `applyToSvg(state, svg, ctx)` — toggles `data-active` layers (replaces `GROUPS` + `applyStateToSvgSingle`).
- `toFhir(state)` / `fromFhir(bundle)` — round-trip (replaces `FIELD_MAPPINGS` + `toFhir`/`fromFhir`).

**Consequence (the unification the owner asked for):** a new clinical feature = **one new `AXES` entry**, which automatically appears everywhere — state, UI, SVG, export/import — with consistent engineKey and codings. Composite axes (`fields`) express compound cases: caries = surface + ICDAS depth + lesion context; pulp = AAE diagnosis + acute/chronic + optional Latin subtype + vitality/percussion/radiographic sub-axes.

### 2.1 Extensibility (designed-in requirement)

Adding future clinical needs must be a cheap **addition**, never a rewrite. The registry guarantees this:

- **New value / finding** → one `AxisValue` or `ClinicalAxis` entry; it appears in state, UI, SVG toggling, and FHIR round-trip automatically.
- **New view** (e.g. additional front/occlusal artwork, or a new projection) → extend `ToothContext.view` and the tooth-context table and drop in the asset; because `svgLayer(ctx)` is already view-aware, per-view layers plug in with no engine change.
- **New panel / section** (e.g. **periodontal**) → a new `panel` id plus axes assigned to it. The deferred second-round items — perio parameters (probing depth, recession, BOP, furcation) and whole-mouth occlusion/indices — are **first-class future axes/axis-groups, not special cases**.
- **New coding system** (ICD-11, SNODENT) → append to the coding array; no schema change (system-agnostic).
- **New optional detail** → one feature flag; axes/values gate on it (the ICDAS / `histologicalPulpDetail` pattern).

This is also why the work ships **visibly and incrementally**: each sub-project adds its axes to the registry and produces a working, clinically walk-through-able build.

---

## 3. Section 2 — The coding layer (additive, system-agnostic)

Every concept is a **coding array**, never a single code. The local (engine-owned) code is **always present** (round-trip key); SNOMED and ICD are optional additive overlays — the standard FHIR `CodeableConcept.coding[]` pattern.

```ts
interface ConceptRef {
  local: string;         // LOCAL_SYSTEM code — ALWAYS present, authoritative round-trip key
  display: string;       // language-neutral English display (i18n handled separately via labelKey)
  snomed?: string;       // SNOMED CT concept id (http://snomed.info/sct)
  icd?: { system: string; code: string }[];  // system-agnostic: "bno-10" | ICD-10 | ICD-11
}
// toCodings(ref) -> [ {LOCAL_SYSTEM, local, display}, {SNOMED, snomed?}, ...icd? ]  (additive)
```

Codings live **inline** on axes/values (no separate flat `SNOMED_CODES` map — that is the point of Approach 2).

**FHIR mapping:** `axis.finding.coding` → `Observation.code`; `value.coding` → `Observation.valueCodeableConcept` or component; `bodySite` = FDI tooth (from context).

**Four rules driven by the scientific review:**
1. **Material + brand are separate.** `value.coding` is the material class (e.g. lithium disilicate); the brand (`e.max`, `Gradia`) is a separate local qualifier — never an ontological material class.
2. **ICDAS is a coded value** (`ICDAS_SYSTEM`), not a bare integer. Radiographic depth is a **separate, independently-nullable** field (no official ICDAS↔D1–D3 crosswalk; any HU mapping is a labelled local convention).
3. **Round-trip stays on the local code** (authoritative & safe); SNOMED/ICD are additive on export. Importing foreign SNOMED-only bundles is an optional reverse-index, deferred (not now).
4. **Code slots start empty** (local only) and fill in as **human-verified**. The previously built SNOMED-mapping tool (`snomed_mapping.json`) is the data source that feeds the `snomed`/`icd` slots — that work is not lost.

---

## 4. Section 3 — State shape, serialization, versioning, migration

**State shape (registry-generated).** The untyped `Map` is replaced by an **axis-keyed typed object**; each axis owns its slot, its type derived from `kind`:

```ts
type ToothState = {
  crown: "natural" | "metal-ceramic" | "metal" | "gold" | "emax" | "gradia" | ...;   // enum
  caries: { surfaces: Record<Surface, CariesLesion>; root?: CariesLesion };            // composite
  pulpDiagnosis?: { aae: AaeDx; course?: "acute" | "chronic"; histo?: LatinSubtype };  // composite
  fracture: { horizontal: boolean; vertical: boolean };
  // ... one slot per axis, all from the registry
};
```

Runtime and serialized shapes are **both generated from the registry** (Set→array, Map→record), so they cannot drift; the current runtime-Map vs `ToothRecord` duality is eliminated.

**Versioning (three independent axes):**
- Payload schema: `"1.4"` → **`"2.0"`** (breaking major). Lives in `collectExportPayload()` (`odontogram.ts:2534`) and `fromFhir.ts:102`.
- Library/npm version: `1.11.1` → next (bumped per release, mandatory README/CHANGELOG/CITATION update per module CLAUDE.md).
- SVG asset version: → **`2.5.0`** (comment in each SVG + the hardcoded constant in `svg_normalize.py` + regenerated `manifest.json`).

**Backward-compatible migration** (host app + saved data + external FHIR). A **chainable `migratePayload(old)`** runs before hydrate and upgrades any older payload (1.3/1.4) to 2.0. Two invariants:
1. **Visual-lossless:** the active SVG-layer set is unchanged after migration (a migrated old chart renders identically).
2. **Clinically-lossless where possible:** where the old model was coarser, new fields default to **explicit "unspecified/unknown"** — never silently wrong.

Key mappings (details finalised in the relevant sub-project spec; the mechanism is what the constitution fixes):
- `crownMaterial:"metal"` → `"metal-ceramic"` (old label was "Metal-ceramic crown" → correct); the new plain `"metal"` is forward-only.
- `bridgeUnit:"metal"` semantics differ (old display "Metal bridge") — mapped deliberately in the materials sub-project.
- old `pulpInflam:true` → pulp axis "pulpitis (unspecified)" AAE value rendering the same layer.
- old caries surfaces + `cariesDepths` → composite caries (surface + ICDAS + context), depth carried over.
- `no-tooth-after-extraction` dual path → unified `missing` + `absence_reason="post-extraction"`.
- broken/contact/bruxism/resorption booleans → their new axes (resorption internal/external defaults to "unspecified").

**Public API preserved:** `OdontogramShell` props and the JSON `importStatus/exportStatus` API stay; old payloads are accepted via migration.

---

## 5. Section 4 — SVG binding & tooth context

**Layer resolution from the registry.** `applyToSvg(state, svg, ctx)` walks `AXES`, computes active layers, and sets `data-active`. The "clear all, then activate" pattern stays, but the clear-set comes from the registry (it knows every switchable layer) — no manual `GROUPS`/branch soup.

**Tooth context (one place).** A per-tooth `ToothContext` centralises today's scattered static tables (`TOOTH_TEMPLATE`, `FISSURE_ALLOWED`, `MILKTOOTH_BLOCKED`, `occlTemplateForTooth`):
```ts
interface ToothContext {
  fdi: string; template: 11 | 13 | 14 | 16; view: "front" | "occlusal";
  isAnterior: boolean /* FDI 1–3 */; isMolar: boolean;
  mirror: boolean; rot: 0 | 180; fissureAllowed: boolean; milktoothAllowed: boolean;
}
```

**Layer resolution is a view-aware function, not a static string** — this solves inlay/onlay/veneer from one value:
```
emax-veneer → front "emax-veneer",  occlusal "emax-veneer"
emax-inlay  → front "emax-inlay",   occlusal "emax-inlay"
emax-onlay  → front "emax-inlay",   occlusal "emax-onlay"   // onlay/overlay render as inlay from the front
```

**Incisal ↔ occlusal surface view.** For anterior teeth (FDI 1–3), the canonical `occlusal` surface is clinically **incisal**. A single `surfaceView(ctx)` decides: UI shows an "I" button and the coding emits **incisal**, but the **SVG layer id stays `*-occlusal`** (`caries-occlusal`, `filling-*-occlusal`, `defect-occlusal`) — matching the assets.

**Occlusal-view layer restrictions.** Occlusal SVGs lack some groups (specials/fracture, crown-leakage, ortho-ring/bracket, arrow-up/down, caries-root/subcrown). Rule: layer application is **null-safe per view** — a layer id absent from that view's SVG is silently skipped. The registry records which view a layer exists in (for correctness tests, §6), but rendering degrades gracefully. The UI offers all valid toggles for the tooth; the occlusal **tile** only draws those with an occlusal layer.

**Unchanged / preserved:** `TOOTH_TEMPLATE` mirror/rotate (operates on the cloned SVG root, independent of layer ids), and the generalised inflammation z-order fix (the inflammation glyph is moved in front of active `endo-resection`/`endo-resorption`).

---

## 6. Section 5 — UI generation & feature flags

**Panels from the registry.** The static skeleton + imperative `wireControls`/`syncControlsFromState` are replaced by a small set of **generic, registry-driven React widgets**. Each axis declares its UI (`widget`, `panel`, `order`, `labelKey`, `appliesWhen`); a renderer groups axes by panel and draws them. This removes ~100 lines of manual show/hide and matches CLAUDE.md's "small, focused React components."

**Widget set (bound to axis `kind`):**
- `enum` → **select**, with optional non-selectable group separators (e.g. `-- CROWNS --`, `-- VENEERS/INLAYS --`).
- `boolean` → **toggle** button.
- `multi`/`surfaceSet` → **surface cross** (B/M/O/D/L) or checkbox set.
- `composite` → **expanding sub-panel/popup**: caries surface → depth popup; filling surface → defect-status popup (green check / red X → healthy / poor margin / broken); pulp → expanding diagnosis detail.
- `slider` → 4-position (Veneer–Inlay–Onlay–Overlay) and 2-position (solo crown ↔ bridge unit).

**appliesWhen = declarative visibility** (replaces scattered logic). Examples: crown dropdown hidden when tooth missing; **when a restoration exists, the caries panel hides "Select caries surfaces" + "Depth", keeping only the `subcrown` toggle**; the tooth-position/ortho panel shows **only for permanent + full crown**.

**Feature-flag subsystem (first-class).** A `settings` prop carries flags (like today's `icdasEnabled`), e.g. new `histologicalPulpDetail`. Axes/values gate on `flag`:
- flag OFF → the detail is hidden in UI **and** omitted from export (the base value still exports). E.g. `histologicalPulpDetail` off → pulp panel shows only the AAE dropdown; on → AAE + Latin subtype + acute/chronic. Exactly the ICDAS pattern.

**i18n.** The registry references only `labelKey`s (no hardcoded strings); every new key is added to all 9 languages (parity test-enforced), `hu` = source. (The binary-plural Slavic gap is out of scope for the constitution; a later small improvement.)

---

## 7. Section 6 — Testing & post-verification strategy

Because everything is generated from `AXES`, the **registry itself is testable** — invariants checked once, centrally. This de-risks the big-bang rewrite.

1. **Registry-invariant tests (new, the strongest net):**
   - Each value's local code is unique; `finding` codes do not collide across axes.
   - **Every referenced `svgLayer` EXISTS in the real SVG** — the test parses the 6 files and asserts the id is present in the relevant view. Automatically catches typos (`inicisal`!) and the occlusal asymmetry.
   - Every `labelKey` exists in all 9 languages (extends the existing parity test).
   - Filled SNOMED/ICD slots are **well-formed** (numeric SNOMED; ICD requires `system`). Clinical correctness stays human-verified.
   - Every `appliesWhen` is total (never throws) across all tooth contexts.
2. **Round-trip golden tests.** `fromFhir(toFhir(state)) === state` over a corpus, **exhaustively** — the registry enumerates axes/values/flags and the test generates cases programmatically. Tooth-level and full-arch cases.
3. **Migration golden tests.** A frozen fixtures folder of old payloads (1.3/1.4, incl. host-app saved shapes) → `migratePayload` → 2.0, asserting **visual-lossless** (same active layer set) and **clinically-lossless / explicit unknown**.
4. **Render-fingerprint (instead of pixel diff).** Snapshot the **set of active layer ids** for a matrix of `state × tooth-template × view`. Any render change fails the test — directly protects the SVG-binding rewrite.
5. **"Nothing silently drops" guard.** Reframed: every state field belongs to an axis and round-trips — enforced from the registry.
6. **Post-verification process (owner-required).** Per sub-project: task review (spec + code quality), whole-branch review at the end, plus a **manual clinical walkthrough** by the owner. SNOMED/ICD codes stay **local-only until human-verified**, so tests never assert unverified terminology as fact. Gates each task cycle: `tsc -b`, `vitest`, and a new **registry-lint**; the typed (registry-generated) state also catches drift at compile time.

---

## 8. Scientific corrections applied (from the literature review)

Each is applied in the relevant sub-project spec; deviations from the original request are flagged there.

| Area | Correction |
|---|---|
| Pulp diagnosis | AAE 2009 scheme primary; Latin/histological subtype optional (flag). Latin subtypes (serosa/purulenta/ulcerosa) are not chairside-determinable. |
| Resorption | Split internal (inflammatory vs replacement) vs external/cervical; the old single `root-resorption` boolean is insufficient. |
| Materials | material class + separate **brand** field; "Gradia"/"e.max" are brands, not material classes. |
| Wear | erosion/abrasion/attrition are distinct; **abfraction** is contested (no ICD-10) → under NCCL, not at parity. |
| Missing tooth | congenital (K00.0) vs acquired (K08.x) kept distinct; explicit "unknown"; extraction is a treatment, not an etiology. |
| Caries | ICDAS (visual) ≠ radiographic depth (store separately, no crosswalk); secondary caries = CARS scale, root caries = separate scale — not booleans. |
| ICD-10 | assumed codes (K07.3x, Z98.81, T85.735) don't mean what's assumed → system-agnostic field, WHO/BNO-10 default. |
| Peri-implant | carry findings on implants too (fix); ICD-10 cannot distinguish mucositis from health (ICD-11-ready). |

**All SNOMED/ICD codes require human verification before being asserted as clinically real** (they stay local-only until verified).

---

## 9. Decomposition & sub-project sequence

Each is a separate spec → plan → implementation cycle on this constitution.

0. **Architecture constitution** — this document.
1. **SVG integration + v2.5.0** — normalize + install the 6 assets, bump SVG version (script + comments + manifest), fix typos `inicisal`→`incisal` and `16_occl` `prosthesis-bridge-connector`→`prosthesis-connector`.
2. **Materials system** — `metal`→`metal-ceramic` + new `metal`/`gold`/`gradia`/`emax` crowns & bridge units; "Fix: Bridge unit – …" naming; inlay/onlay/veneer; crown-leakage; solo/bridge slider.
3. **Endo/root + pulp diagnosis** — root filling relabel; pulp diagnosis (AAE + optional Latin); vitality/percussion/radiographic; root length; root fracture h/v.
4. **Caries / ICDAS** — systematized ICDAS coding; root caries; secondary caries (CARS).
5. **Filling defect status** — per-surface healthy / poor-margin / broken (fillings/defect).
6. **Wear differentiation**, 7. **Discoloration**, 8. **Tooth position / ortho**, 9. **Peri-implantitis carry-through fix**.
- **Second round (deferred by owner):** periodontal parameters (probing/recession/BOP/furcation), whole-mouth occlusion & indices, plan-vs-status layer split.

## 10. Open items (resolved in sub-project specs, not here)

- Exact `bridgeUnit:"metal"` migration semantics.
- Final AAE↔Latin pulp mapping table and default for migrated `pulpInflam`.
- Whether the ortho panel's non-markable statuses (rotated/extruded/intruded) need any SVG arrow beyond the specified set.
- Whether to correct the `inicisal` typo across old installed assets in sub-project 1 or defer.
- The exact settings/flags surfaced on `OdontogramShell` props.

## 11. References

AAE Consensus terminology (Levin 2009, PMID 19932339; Gutmann 2009, PMID 19932340); pulp-status non-determinability (Mejàre 2012, PMID 22329525; Lin 2019, PMID 31865629); AAE↔histology correlation (Ricucci 2014, PMID 25312886); resorption axes (Patel 2010, PMID 20630282; Heithersay 1999, PMID 11411085); ICDAS II (Ismail 2007, PMID 17518963; ICCMS/CariesCare — iccms-web.com); tooth wear (Bartlett 1999, PMID 10709520; BEWE — Bartlett 2008, PMID 18228057; abfraction contested — Litonjua 2003, PMID 12892441); peri-implant 2017 World Workshop (Berglundh 2018, PMID 29926955); FHIR CodeableConcept additive codings (HL7 FHIR R4); HL7 Dental Data Exchange IG (draft); SNOMED CT International Edition + SNODENT. ICD codes are US ICD-10-CM unless noted; reconcile against WHO ICD-10 / Hungarian BNO-10 before use.
