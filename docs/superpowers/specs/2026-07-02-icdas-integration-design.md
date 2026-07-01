# ICDAS Integration + Topbar Settings Consolidation — Design Spec

**Date:** 2026-07-02
**Component:** React Odontogram Editor Modul (submodule `src/modules/odontogram/engine`)
**Status:** Approved design, pending implementation plan

Two coupled changes:
1. Optionally integrate the ICDAS II caries severity scale (0–6) as a finer,
   switchable alternative to the current 3-level per-surface caries depth.
2. Consolidate the topbar into a unified icon row with a new **Settings (gear)
   dropdown** that holds Numbering, Notes, and the ICDAS toggle — the natural
   home for the ICDAS in-app switch.

Sequence: build the topbar/settings consolidation first (it hosts the ICDAS
toggle), then the ICDAS data feature.

## Confirmed decisions
- **Relationship:** switchable scale on the SAME per-surface field. ICDAS is the finer view of the existing per-surface caries severity; the 3-level scale is a coarser view of the same data.
- **Canonical storage:** the per-surface value is stored as an **ICDAS integer (1–6)** (0 = no caries → not stored). The 3-level scale is derived. Old JSON (`"surface"/"dentin"/"deep"`) is migrated on hydrate.
- **Enablement:** a host **`enableIcdas` prop** (default off) PLUS an **in-app toggle in the new Settings dropdown** that overrides it. The mode is a chart-wide view/edit setting, not per-tooth data.
- **Topbar:** unified icon row. A **Settings gear icon** replaces the Numbering button and opens a dropdown containing Numbering (FDI/Universal/Palmer), a Notes toggle, and the ICDAS toggle. Intro, Language, Export, and Import become **icon buttons** (same dropdowns/actions, icon triggers) for a consistent row alongside the existing dark-mode icon.
- **Indicator (ICDAS mode):** a small **number badge (1–6)** in the active surface cell's corner, colored by severity; the popup lists the six codes with short labels and the full ICDAS description as a tooltip.
- **FHIR:** the ICDAS code is exported per surface in the caries Observation components and re-imported (round-trips).

## ICDAS II caries codes (per surface)
0 sound · 1 first visual change in enamel (after drying) · 2 distinct visual change in enamel (when wet) · 3 localized enamel breakdown, no dentin visible · 4 underlying dark shadow from dentin · 5 distinct cavity with visible dentin · 6 extensive cavity (≥ half the surface).

**Tier grouping (for the 3-level view + SVG opacity):** 1–2 = superficial, 3–4 = dentin, 5–6 = deep.

## Background facts (verified against current code)
All paths under `src/modules/odontogram/engine/`.
- State (`defaultState`, `odontogram.ts:~135-140`): `cariesActiveDepth: "surface"` + `cariesDepths: new Map()` (surface → `"surface"|"dentin"|"deep"`).
- `getCariesDepthOptions()` (`~:627`) returns `[{value,label}]` for the 3 levels (labels via `t("caries.depth.*")`).
- Depth UI: selector `#cariesDepthSelect` (above the cross, `App.tsx` `#cariesSection`); per-surface popup `showCariesDepthPopup(surface, anchor)` (`~:1915`); per-cell 3-bar indicator `.surf-depth[data-depth]` (added after `buildSurfaceCross` for `#cariesChecks`).
- Render (`applyStateToSvgSingle`, caries loop ~`:926-943`): per surface sets `caries-{s}` or `subcaries-{s}` active, then sets that element's `style.opacity` (0.45/0.7/1) and toggles `.caries-deep` from `cariesDepths.get(surface)`.
- Sync (`syncControlsFromState`, ~`:1308-1322`): sets each `.surf-depth` `data-depth`; sets the selector from `cariesActiveDepth`.
- Serialize/hydrate (`~:2233`/`~:2295`): `cariesActiveDepth` + `cariesDepths` (object); `VALID_CARIES_DEPTH = {"surface","dentin","deep"}`.
- FHIR: `caries` is a `"set"` mapping in `fhir/fieldMappings.ts` → one Observation, one component per surface with `valueBoolean:true`; `fhir/fromFhir.ts` reverses it. Depth is currently NOT in FHIR.
- Enablement pattern: `enableNotes` prop (`App.tsx`) → `setNotesEnabled(bool)` (`odontogram.ts`) → module `notesEnabled` flag; the host `.d.ts` (`src/modules/odontogram/odontogram-shell.d.ts`) declares props.

## Design

### Data model (canonical ICDAS)
- `cariesDepths: Map<surface, number>` where number ∈ 1..6 (ICDAS). `cariesActiveDepth: number` (default `2` = superficial representative).
- **Mapping helpers** (pure, in `odontogram.ts`):
  - `icdasTier(code): 1|2|3` → 1 for 1–2, 2 for 3–4, 3 for 5–6 (drives bars + opacity).
  - `threeLevelToIcdas(level): number` → superficial→2, dentin→4, deep→6.
  - `icdasToThreeLevel(code): string` → 1–2→"superficial", 3–4→"dentin", 5–6→"deep".
- **Hydrate migration:** if a stored value is one of `"surface"/"dentin"/"deep"`, map via `threeLevelToIcdas`; if it is a number 1–6, keep; else drop. Same for `cariesActiveDepth`. `VALID_ICDAS = {1,2,3,4,5,6}`.
- Serialize writes the integer codes.

### Mode (icdasEnabled)
- Module flag `icdasEnabled` (default false). `setIcdasEnabled(bool)` exported; the `enableIcdas` prop drives it via `useEffect` (mirrors `enableNotes`). An in-app toggle on the Caries card flips the same flag (prop = initial default, toggle can override at runtime).
- Switching mode re-renders the caries UI (rebuilds the selector options + re-syncs indicators). Canonical ICDAS values are untouched, so no data loss.

### UI
- **`getCariesDepthOptions()` becomes mode-aware:**
  - 3-level mode → 3 options with values `2/4/6` (labels `caries.depth.superficial/dentin/deep`).
  - ICDAS mode → 6 options with values `1..6`, label `"{n} — {short}"` (`icdas.code.{n}`), and `title` = `icdas.desc.{n}` (full description, shown as tooltip).
- **Selector** `#cariesDepthSelect` = default value for newly tapped surfaces (already the pattern); its options come from the mode-aware function.
- **Per-cell indicator** `.surf-depth`:
  - 3-level mode → the existing 3 bars, filled by `icdasTier(code)`.
  - ICDAS mode → a **number badge** showing the code (1–6), colored by tier (light/medium/deep-red). Implemented by toggling an `icdas` class on the indicator and rendering the number; CSS shows bars OR badge per mode.
- **Popup** `showCariesDepthPopup` lists the mode-aware options (3 or 6); in ICDAS mode each button shows `"{n} — {short}"` with the full description as `title`.
- **In-app toggle:** lives in the new **Settings dropdown** (not the Caries card) — a labeled toggle (`icdas.enable`) that reflects and flips `icdasEnabled`.

### Topbar consolidation (settings gear + iconify)
Unified icon row in `.topbar-actions` (reuse the existing `.dropdown` pattern and inline SVG icons like the dark-mode button):
- **Settings gear icon** replaces the standalone Numbering button. Opens a `.dropdown-menu` "settings panel" containing: **Numbering** (FDI/Universal/Palmer as menu items / segmented), **Notes** toggle (drives `notesEnabled` — currently prop-only, now user-switchable), **ICDAS** toggle (drives `icdasEnabled`).
- **Intro** → icon button that starts the tour directly.
- **Language** → icon button opening the existing language dropdown (keep the flag glyph).
- **Export** / **Import** → icon buttons opening the existing export/import dropdowns.
- **Dark mode** stays the existing icon.
- Each icon gets an accessible `title`/`aria-label`; the hidden export/import buttons and `#btnStatusExport` id stay unchanged (host coupling), only their visible triggers become icons.
- Notes toggle in settings: add `setNotesEnabled` exposure to the toggle; the `enableNotes` prop remains the initial default.

### Rendering (SVG)
Unchanged mechanism: opacity by `icdasTier(code)` (1→0.45, 2→0.7, 3→1.0) on the active `caries-{s}`/`subcaries-{s}` element, `.caries-deep` contour for tier 3. No new SVG art; exact code shown by the badge.

### FHIR
- Change the caries emission from the generic `"set"` mapping to a small dedicated emitter (or extend the set emitter) so each surface component carries the ICDAS code: `component.code` = surface (local coding), `component.valueInteger` = ICDAS code. Surfaces with no explicit code default to nothing/valueBoolean for backward safety.
- `fhir/fromFhir.ts`: read `component.valueInteger` back into `cariesDepths`; if absent, the surface is still recorded as caried (no depth).
- `fhir/codesystems.ts`: add an ICDAS reference (system URL constant + optional display map) for documentation; the value is a plain integer.

### i18n (8 languages, Hungarian authoritative)
- `icdas.enable` (toggle label).
- `icdas.code.1..6` — short labels (e.g. "1 — Enamel (dry)").
- `icdas.desc.1..6` — full ICDAS descriptions (tooltips). Accurate clinical translations required for de/es/it/sk/pl/ru (not English copies).
- Keep `caries.depth.superficial/dentin/deep` for 3-level mode.
- Topbar/settings: `settings.title`, `settings.notes` (Notes toggle), `icdas.enable` (ICDAS toggle); accessible `title`/`aria-label` for the Intro/Language/Export/Import/Settings icons (reuse existing labels where present, e.g. `topbar.export`, `topbar.import`, `intro.start`, `language.label`, `numbering.label`).

### Host / API
- `App.tsx`: add `enableIcdas?: boolean` prop + `useEffect(setIcdasEnabled)`; re-export `setIcdasEnabled`.
- Main repo `odontogram-shell.d.ts`: declare `enableIcdas?: boolean`.
- Host `types.ts`: `cariesActiveDepth?: number; cariesDepths?: Record<string, number>` (was the 3-level string union).

## Edge cases / robustness
- Mode toggle mid-edit: canonical ICDAS preserved; UI re-derives. No data loss.
- Old files: `"surface"/"dentin"/"deep"` migrated to `2/4/6`; unknown values dropped.
- ICDAS 0 = no caries: not stored; toggling a surface off removes its code (existing behavior).
- Badge legibility at small size: fixed min size + high-contrast color per tier.
- Caries on/off stays the surface-cell click; the badge/indicator click only opens the depth/ICDAS popup (existing `stopPropagation`/`preventDefault`).
- Backward compatibility: this changes the just-shipped `cariesDepths` value type (string → int) — acceptable pre-release, handled by hydrate migration.

## Testing
- Unit: mapping helpers (`icdasTier`, `threeLevelToIcdas`, `icdasToThreeLevel`) — exhaustive over 1–6 and the 3 levels.
- Unit: hydrate migration (old string values → codes; numbers kept; unknown dropped).
- Unit: FHIR round-trip carries the ICDAS code per surface (`fhir-import.test.ts`); coverage test updated.
- Unit: `getCariesDepthOptions()` returns 3 vs 6 options by mode; translations parity for the new keys.
- Manual (browser, dev server): toggle ICDAS mode; set codes via selector + popup; badge shows the code; 3-level view shows the correct tier; export/import JSON + FHIR round-trip; main-app build.

## Versioning
- New feature → bump engine to **v1.9.0**; README feature bullets (4 languages) + API note (`enableIcdas`); host `.d.ts` + `types.ts` updated; submodule pointer bump.

## Risks
- i18n: accurate ICDAS descriptions in 6 non-English languages.
- FHIR caries emitter change must not regress the existing per-surface component shape (secondary-caries derivation, tests).
- Schema value-type change for `cariesDepths` — mitigated by hydrate migration + tests.
