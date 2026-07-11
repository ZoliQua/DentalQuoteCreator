# Odontogram Sub-Project 2 — Registry Core (behavior-preserving) — Design Spec

**Date:** 2026-07-11
**Status:** Approved (brainstorming) — pending user review, then writing-plans
**Module:** `src/modules/odontogram/engine` (git submodule)
**Builds on:** `docs/superpowers/specs/2026-07-12-odontogram-architecture-constitution-design.md` (the constitution). This spec operationalizes the constitution's registry for a **behavior-preserving** core rewrite; it does not restate the registry model — read the constitution for `ClinicalAxis`, additive codings, feature flags, and the test-strategy categories.

---

## 1. Purpose, scope, non-goals, and the behavior-preservation contract

SP2 builds the **clinical-axis registry core** (the constitution's Approach 2) and migrates **all of today's exact behavior** onto it, so that later feature sub-projects (SP3 materials, SP4 caries, …) are cheap, visible additions to a single source of truth.

### 1.1 Locked decisions (from brainstorming)
1. **Implementation is staged**, not atomic: the registry is built and consumed **one generator at a time**, each stage keeping the app fully working, tests green, and manually walk-through-able. The **end state is pure registry** (Approach 2) — staging is only the safe path there, not a hybrid end state.
2. **Parity proof = full golden fixtures** captured up-front from today's engine (FHIR export, FHIR round-trip, **and** SVG render), plus a differential dual-run during each migration stage.

### 1.2 Non-goals (explicitly deferred to SP3+)
No new materials (the `metal`→`metal-ceramic` rename, `gold`/`gradia`/`emax` crowns & bridge units, inlay/onlay/veneer, `crown-leakage`, solo/bridge slider — all SP3). No incisal-surface change. No new clinical axes, no new UI elements, no new codings emitted. SP2 **only reproduces today** on a new architecture.

### 1.3 Behavior-preservation contract (what the golden fixtures prove)
- The **FHIR export/import wire format** and the **JSON status payload** are **byte-identical** to today. Therefore the **payload schema version stays `"1.4"`** (bumping to `2.0` would itself be an observable change; `2.0` + migration land in SP3 when new fields are actually added). This refines constitution §4, which anticipated `1.4→2.0`: that bump moves to SP3.
- The **SVG render** (the set of active layer ids for a given state × tooth × view) is identical.
- The **UI** (panel option lists, selected values, row/toggle visibility, enabled/disabled) is identical.
- **Library version** bumps (e.g. `1.12.0` → `1.13.0`) as an internal-architecture release; **payload version stays `1.4`**.

**Net effect:** after SP2, nothing changes for the user or any external consumer — but the engine is internally registry-driven, and the legacy ad-hoc machinery is gone.

---

## 2. The AXES catalog, the four generators, and file structure

### 2.1 Axis shape (refined from the constitution for render logic)
Each of today's axes becomes one `ClinicalAxis`: `id`, `kind`, `finding` (a `ConceptRef`), `values[]` (each `{ id, coding, labelKey, svgLayer(value, ctx, state), appliesWhen? }`), `ui`, `appliesWhen(ctx, state)`, `flag?`, `default`. Two refinements the behavior-preserving render needs:
- **`svgLayer` is a function** `(value, ctx, state) => string | string[] | null`, so conditional/derived layer resolution is expressible.
- **A `postApply(svg, state, ctx)` hook** for non-trivial DOM steps that are not a simple `data-active` toggle.

### 2.2 The catalog maps today's ~28 axes 1:1, grouped by panel
- **Tooth details:** `toothSelection` (enum), `crownMaterial` (enum), `brokenCrown` (derived), `bridgeUnit` (enum), `contactMesial`/`contactDistal` (bool), `bruxismWear`/`bruxismNeckWear` (bool), `bridgePillar` (bool), `extractionWound` (bool), `extractionPlan` (bool), `crownReplace` (bool), `crownNeeded` (bool), `missingClosed` (bool).
- **Caries/filling:** `caries` (surfaceSet + per-surface ICDAS depth), `fillingMaterial` (restoration + surfaces + per-surface materials), `fissureSealing` (bool).
- **Root/endo:** `endo` (enum), `pulpInflam` (bool), `endoResection` (bool), `rootResorption` (bool), `parapulpalPin` (bool).
- **Inflammation:** `mobility` (enum), `mods` (set), `periapicalType` (enum), `calculus` (bool).
- **Chart-level:** `edentulous` (global); **plugin:** `customStates`; **note:** `tooth-note`.

Every axis's `finding` code and `values[].coding.local` **must equal today's** `findingCode` / `LOCAL_VALUE_MAPS` code exactly (that is what makes the FHIR golden match). No SNOMED/ICD codes are populated in SP2 (they stay empty, as today).

### 2.3 The six non-trivial render behaviors and how the registry encodes them
These are the behaviors the golden fixtures must reproduce byte-for-byte:
1. **Broken crown:** `brokenMesial`/`brokenIncisal`/`brokenDistal` (3 booleans) → exactly one of the 7 `tooth-broken-*` layer ids — a composite `svgLayer` resolver replicating `getBrokenCrownVariant()`.
2. **Caries ↔ subcaries:** when a filling exists on the same surface, the caries layer becomes `subcaries-{surface}` instead of `caries-{surface}` — a state-dependent resolver.
3. **Crown / removable branch:** implant vs bridge-none vs generic crown vs `bridgePillar` — the `crownMaterial` axis's `svgLayer` + `appliesWhen` reproduce today's branch (`odontogram.ts` §4 of `applyStateToSvgSingle`).
4. **Periapical glyph:** `periapicalType` renders `cysta`/`granuloma`/`abscess` only when `mods` contains `inflammation` — `appliesWhen`.
5. **Gating:** `fissureAllowed` / `contactAllowed` / `bruxismAllowed` / `extractionPlanAllowed` — `appliesWhen(ctx)` predicates over `ToothContext`.
6. **Inflammation z-order:** the inflammation glyph is moved in front of an active `endo-resection`/`endo-resorption` — a `postApply` hook.

### 2.4 The four generators (all from `AXES`)
- `validate(state)` — replaces the `VALID_*` sets + `hydrateState` sanitisation.
- `buildPanels()` — replaces the static App skeleton + `wireControls`/`syncControlsFromState`.
- `applyToSvg(state, svg, ctx)` + `postApply` — replaces `GROUPS` + `applyStateToSvgSingle`.
- `toFhir(state)` / `fromFhir(bundle)` — replace `buildFhirBundle` / `parseFhirBundle` / `fieldMappings.ts`, emitting **byte-identical** output.

### 2.5 State container (refinement of the constitution)
SP2 **keeps today's runtime state container** (the untyped `Map` with `Set`/`Map` fields), wrapped by a thin **typed accessor layer keyed by axis id**; `serializeState`/`hydrateState` stay and emit the identical `1.4` JSON. The constitution's "replace the Map with an axis-keyed typed object" is **deferred** to a later, isolated refactor — changing state storage while swapping generators would multiply risk, and "single source of truth" is a property of the `AXES` declaration, not of the storage form.

### 2.6 File structure (decomposing the 4000-line `odontogram.ts` monolith)
New `src/registry/`: `types.ts`, `axes.ts` (the catalog; may split per panel group if large), `context.ts` (`ToothContext` + the tooth tables `TOOTH_TEMPLATE`/`FISSURE_ALLOWED`/`MILKTOOTH_BLOCKED`/occlusal), `validate.ts`, `ui.ts`, `svg.ts`, `fhir.ts`, `hooks.ts` (`postApply`). Over the staged migration these absorb `codesystems.ts`, `fieldMappings.ts`, `toFhir.ts`, `fromFhir.ts`, and the render/UI/`VALID_*` parts of `odontogram.ts`.

---

## 3. Staged migration order

**Principle: generator-by-generator, not axis-by-axis.** `AXES` is the shared cross-cutting data; each generator is a consumer subsystem. Building the full catalog first and swapping one generator at a time keeps each swap a clean, golden-verifiable replacement of one subsystem, with no mixed-source adapters. The old subsystem is **deleted in the same stage** it is replaced (no lingering dead coexistence).

- **Stage 0 — Scaffold + parity harness.** `types.ts`, the full `axes.ts` catalog (data), `context.ts`, axis accessors over the current state; a behavior-preserving refactor of today's render into a testable `applyState(svg, toothNo, view, state)` seam; capture the golden fixtures (FHIR, round-trip, SVG render) from **today's** engine over the matrix (§4). No behavior change; full suite green; goldens committed.
- **Stage 1 — `toFhir`.** Registry-driven export replaces `fieldMappings.ts` + `toFhir.ts` emission. FHIR golden byte-identical → delete the replaced code.
- **Stage 2 — `fromFhir`.** Registry-driven import; round-trip golden identical → delete old.
- **Stage 3 — `applyToSvg`.** Registry-driven render + `postApply` replaces `GROUPS` + `applyStateToSvgSingle`. SVG-render golden byte-identical → delete old. **(Highest render risk — golden + manual walkthrough are the net.)**
- **Stage 4 — `validate`.** Registry-driven validation replaces `VALID_*` + hydrate sanitisation.
- **Stage 5 — `buildPanels` (UI).** Registry-driven React widgets replace the static skeleton + `wireControls`/`syncControlsFromState`. UI parity via the option/visibility golden (§4) + manual walkthrough → delete old wiring. **(Largest UI change — last.)**
- **Stage 6 — Cleanup + release.** Remove dead code (`VALID_CARIES_DEPTH`, and consciously unify or preserve the dual `no-tooth-after-extraction` path), final full parity run, version bump `1.13.0`, CHANGELOG + README (payload version stays `1.4`).

Each stage is a shippable increment: the existing suite stays green (behavior-preserving), the new golden fixtures add the byte-identical proof, and render/UI stages get a manual walkthrough.

---

## 4. Parity harness and acceptance

### 4.1 The matrix (comprehensive, not full Cartesian)
- **(a) Every value in isolation:** each enum value / each surface / each boolean on-off, others default, × the 6 templates. Generated programmatically from the registry's own value enumeration.
- **(b) Curated tricky combinations:** the 7 broken-crown combinations, caries+filling on the same surface (subcaries), periapical+inflammation, implant+crown variants, removable prosthesis, bruxism/fissure/contact gating, both extraction paths.
- **(c) A few realistic full-arch charts.**
- **Flag** `icdasEnabled` on/off; **view** front + occlusal. Mirror/rotate is a wrapper transform that does not change the layer-id set → one or two mirrored/rotated teeth spot-checked.

### 4.2 Making today's SVG render testable
A test util `renderFingerprint(toothNo, view, state)` loads the SVG file (`readFileSync` + `DOMParser`), runs the load-normalisation, applies state via the pure `applyState(svg, toothNo, view, state)` seam (a behavior-preserving refactor of today's render, done in Stage 0), and collects the **active-layer-id set** (`data-active="1"` with no hiding ancestor). Goldens are captured from **today's** engine through this util; the registry's `applyToSvg` must produce the identical set.

### 4.3 UI parity (Stage 5)
Not pixels — golden the outputs of the **pure option/visibility functions** (today's `getCrownOptions`/`getBridgeUnitOptions`/…/the visibility predicates) over the state matrix; the registry's `buildPanels` must yield **identical option lists + visibility**. This avoids running the full SVG-fetching render in a test.

### 4.4 Fixtures
`src/__tests__/parity/`: `fhir-golden.json`, `svg-fingerprints.json`, `ui-golden.json`. **Critical rule:** the capture script (`parity:capture`) is run **only against the pre-rewrite engine, once, in Stage 0**, then the fixtures are **frozen**. Re-running it later would capture the registry's own output (circular) and destroy the oracle — so re-capture is forbidden and documented; a deliberate re-baseline requires explicit justification.

### 4.5 Acceptance criteria (per stage)
1. Every golden fixture for that generator matches. FHIR/JSON goldens are compared by **structural deep-equality with field and Observation emission order preserved** (so the serialized wire bytes stay stable and external consumers see zero diff); the SVG golden is compared as an **identical active-layer-id set**; the UI golden as **identical option lists + visibility**.
2. The existing full suite is **green** (behavior-preserving).
3. The **differential dual-run** passes while the old code still lives.
4. For the render and UI stages (3 and 5), a **manual walkthrough** confirms it visually.
5. `tsc -b --noEmit` clean + the registry-lint (constitution §6).
Failure of any → the stage is not done.

---

## 5. Risks and open items (resolved in the plan or later)

- **`applyStateToSvgSingle` testability seam** (Stage 0) is the one piece of scaffolding SP2 must add to today's code before replacing it; if the render cannot be cleanly isolated, Stage 0 must surface it before the rest proceeds.
- **UI generator (Stage 5)** is the least golden-able and the largest change; the option/visibility golden + manual walkthrough are the net. If registry-driven React widgets prove too large for one stage, Stage 5 may be split per panel in the plan.
- **Dual `no-tooth-after-extraction` path** and **`VALID_CARIES_DEPTH` dead code** — preserve observable behavior; internal cleanup happens in Stage 6, consciously, not silently.
- The **axis-keyed typed state** (deferred per §2.5) remains a candidate later refactor.

## 6. References
The constitution spec (registry model, additive codings, feature flags, test categories); the current engine facts verified during SP0/SP1 exploration (`FIELD_MAPPINGS`, `LOCAL_VALUE_MAPS`, `GROUPS`, `applyStateToSvgSingle`, `wireControls`/`syncControlsFromState`, `serializeState`/`hydrateState`, the 6 representative teeth + `TOOTH_TEMPLATE` mirror/rotate). SP1 delivered the v2.5.0 assets (dormant new layers) that SP3 will wire once this registry core exists.
