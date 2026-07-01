# ICDAS + Topbar Settings Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the topbar into a unified icon row with a Settings (gear) dropdown (Numbering + Notes + ICDAS), and add optional ICDAS II per-surface caries scoring (0–6) as a switchable, canonical replacement for the 3-level depth.

**Architecture:** Phase A reworks the topbar in `App.tsx` (icons + a settings dropdown, reusing the existing `.dropdown` pattern; hidden export/import buttons and ids unchanged). Phase B makes the per-surface caries value canonically an ICDAS integer (1–6), with the 3-level scale derived, plus a mode flag (`icdasEnabled`) driven by a prop and the settings toggle; the UI (selector/popup/indicator) and SVG render adapt to the mode, and the FHIR caries emitter carries the code per surface.

**Tech Stack:** TypeScript 5.5, React 18.3, Vite 7.3, Vitest 4.

## Global Constraints

- Engine is a standalone library — no DentalQuoteCreator imports; keep the ambient-declared public exports and the `#btnStatusExport` / `#statusImportInput` ids + `wireControls` wiring unchanged (host coupling).
- i18n: 8 languages (hu/en/de/es/it/sk/pl/ru), Hungarian authoritative; every new key in all 8; `translations.test.ts` enforces parity. de/es/it/sk/pl/ru ICDAS descriptions must be real translations, not English copies.
- Robustness: no empty catch; tolerate null/empty/unknown; never throw on bad input; backward-compatible hydrate (old `"surface"/"dentin"/"deep"` strings migrate to ICDAS codes).
- Export schema stays `"1.4"` (value-type change is additive/tolerant on read).
- Custom `Any = any` alias is used.
- Release: engine **v1.9.0**.

## Background facts (verified)
All paths under `src/modules/odontogram/engine/`.
- Topbar `.topbar-actions` (`App.tsx`): Intro text button → `startIntroTour()`; Language `.dropdown` (`languageRef`/`languageOpen`, `LANGUAGE_OPTIONS`); dark-mode icon button (`btn-theme`, inline SVG); Numbering `.dropdown` (`numberingRef`/`numberingOpen`, `NUMBERING_OPTIONS`, label `t(numberingLabelKey)`); hidden `#btnStatus{Export,FhirExport,PngExport,JpgExport,SvgExport}` + Export `.dropdown` (`#btnExportMenu`, `exportRef`/`exportOpen`); Import `.dropdown` (`#btnImportMenu`, `importRef`/`importOpen`) + hidden `#statusImportInput`.
- Dropdown CSS: `.dropdown`/`.dropdown-menu`/`.dropdown-item` (`index.css`). Outside-click closes via the handler at `App.tsx` (`languageRef/numberingRef/exportRef/importRef` checks).
- Notes: `notesEnabled` module flag; `setNotesEnabled(bool)` (`odontogram.ts:3745`, refreshes tooltips/icons) + `getNotesEnabled()`; `enableNotes` prop drives it (`App.tsx:189`).
- Caries depth: `defaultState` `cariesActiveDepth:"surface"` + `cariesDepths: Map` (surface→`"surface"|"dentin"|"deep"`) (`odontogram.ts:~139`). `getCariesDepthOptions()` (`:627`) → 3 `{value,label}` (labels `t("caries.depth.surface|dentin|deep")`). `VALID_CARIES_DEPTH` set. Render loop (`~:926-943`) sets per-surface opacity + `.caries-deep` from `cariesDepths.get(surface)`. Selector `#cariesDepthSelect` + `showCariesDepthPopup` + `.surf-depth[data-depth]` indicator. Sync in `syncControlsFromState` (`~:1308-1322`). Serialize (`~:2233`) / hydrate (`~:2295`).
- FHIR: `caries` `"set"` mapping in `fieldMappings.ts` → `toFhir.ts` `case "set"` emits components `{code: valueConcept("caries", v), valueBoolean:true}`; `fromFhir.ts` reverses (reads `component.code`). Coverage test `fhir.test.ts` (`SERIALIZED`/`SPECIAL`), round-trip `fhir-import.test.ts`.
- Host: main-repo `src/modules/odontogram/types.ts` (`cariesActiveDepth?`/`cariesDepths?`) and `src/modules/odontogram/odontogram-shell.d.ts` (props).

---

## Phase A — Topbar settings consolidation

### Task A1: Settings (gear) dropdown with Numbering + Notes toggle

Replace the standalone Numbering dropdown with a Settings gear dropdown containing Numbering (existing options) and a Notes toggle. (ICDAS toggle is added in Task B2.)

**Files:** `src/App.tsx`, `src/i18n/translations.ts`.

**Interfaces:**
- Produces: settings dropdown state `settingsOpen`/`settingsRef`; a Notes toggle that calls `setNotesEnabled` and reflects `getNotesEnabled()` via a local `notesOn` state.

- [ ] **Step 1: State + outside-click**

In `App.tsx`, add near the other dropdown state:
```ts
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const [notesOn, setNotesOn] = useState<boolean>(enableNotes ?? false);
```
Keep `notesOn` in sync with the prop: extend the existing `enableNotes` effect:
```ts
  useEffect(() => {
    setNotesEnabled(enableNotes ?? false);
    setNotesOn(enableNotes ?? false);
  }, [enableNotes]);
```
Add to the outside-click handler (with the other refs):
```ts
      if(!settingsRef.current?.contains(target)){
        setSettingsOpen(false);
      }
```

- [ ] **Step 2: Replace the Numbering dropdown with the Settings dropdown**

Replace the entire `<div className="topbar-group dropdown" ref={numberingRef}> … </div>` block with:
```tsx
          <div className="topbar-group dropdown" ref={settingsRef}>
            <button className="btn-theme" onClick={() => setSettingsOpen((o) => !o)} aria-haspopup="menu" aria-expanded={settingsOpen} title={t("settings.title")} aria-label={t("settings.title")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            {settingsOpen && (
              <div className="dropdown-menu settings-menu" role="menu" aria-label={t("settings.title")}>
                <div className="settings-group-label">{t("numbering.label")}</div>
                {NUMBERING_OPTIONS.map((opt) => (
                  <button key={opt.value} className="dropdown-item" role="menuitemradio" aria-checked={currentNumbering === opt.value}
                    onClick={() => { setNumbering(opt.value); }}>
                    {t(opt.labelKey)}
                  </button>
                ))}
                <div className="settings-sep" />
                <button className="dropdown-item" role="menuitemcheckbox" aria-checked={notesOn}
                  onClick={() => { const v = !notesOn; setNotesOn(v); setNotesEnabled(v); }}>
                  {t("settings.notes")}{notesOn ? " ✓" : ""}
                </button>
              </div>
            )}
          </div>
```
(`setNotesEnabled` is already imported. `numberingLabelKey`/`numberingRef`/`numberingOpen`/`setNumberingOpen` become unused — remove the now-dead `numberingRef`/`numberingOpen` state and the `numberingLabelKey` const, and the numbering entry in the outside-click handler.)

- [ ] **Step 3: i18n keys (8 languages)**

Add `settings.title` and `settings.notes`. Hungarian: `"settings.title": "Beállítások"`, `"settings.notes": "Jegyzetek"`. English: `"Settings"` / `"Notes"`. de: `"Einstellungen"` / `"Notizen"`. es: `"Ajustes"` / `"Notas"`. it: `"Impostazioni"` / `"Note"`. sk: `"Nastavenia"` / `"Poznámky"`. pl: `"Ustawienia"` / `"Notatki"`. ru: `"Настройки"` / `"Заметки"`.

- [ ] **Step 4: CSS for the settings menu**

Append to `src/index.css`:
```css
.settings-menu{min-width:200px}
.settings-group-label{font-size:11px; color:var(--muted); font-weight:700; padding:4px 8px 2px}
.settings-sep{height:1px; background:var(--line); margin:6px 4px}
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run src/__tests__/translations.test.ts` (parity), `npx tsc -b --noEmit` (clean), `npm run build`. Manual: gear icon opens a menu with Numbering options (still switch numbering) + a Notes toggle (toggles the note double-click feature).
```bash
git add src/App.tsx src/i18n/translations.ts src/index.css
git commit -m "feat: settings gear dropdown (numbering + notes)"
```

### Task A2: Iconify Intro / Language / Export / Import

Turn the four text triggers into icon buttons (same dropdowns/actions), matching the dark-mode/settings icon style.

**Files:** `src/App.tsx`, `src/index.css` (if needed).

- [ ] **Step 1: Intro icon**

Replace `<button className="btn btn-ghost btn-sm" onClick={() => startIntroTour()}>{t("intro.start")}</button>` with:
```tsx
          <button className="btn-theme" onClick={() => startIntroTour()} title={t("intro.start")} aria-label={t("intro.start")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </button>
```

- [ ] **Step 2: Language icon trigger**

Replace the language dropdown's trigger `<button …>{t("language.label")}: …</button>` with an icon button (keep the dropdown menu unchanged):
```tsx
            <button className="btn-theme" onClick={() => setLanguageOpen((open) => !open)} aria-haspopup="menu" aria-expanded={languageOpen} title={t("language.label")} aria-label={t("language.label")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
            </button>
```

- [ ] **Step 3: Export icon trigger**

Replace the `#btnExportMenu` trigger text `{t("topbar.export")} ▾` — change the button to icon style, keep id + handler:
```tsx
            <button id="btnExportMenu" className="btn-theme" onClick={() => setExportOpen((o) => !o)} aria-haspopup="menu" aria-expanded={exportOpen} title={t("topbar.export")} aria-label={t("topbar.export")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
```

- [ ] **Step 4: Import icon trigger**

Replace the `#btnImportMenu` trigger text `{t("topbar.import")} ▾` — icon style, keep id + handler:
```tsx
            <button id="btnImportMenu" className="btn-theme" onClick={() => setImportOpen((o) => !o)} aria-haspopup="menu" aria-expanded={importOpen} title={t("topbar.import")} aria-label={t("topbar.import")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 8l5-5 5 5M12 3v12"/></svg>
            </button>
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc -b --noEmit` (clean), `npm run build`. Manual: the topbar is a consistent icon row (Intro, Language, dark-mode, Settings gear, Export, Import); Language/Export/Import icons open their menus; Intro starts the tour; existing export/import still download/upload.
```bash
git add src/App.tsx src/index.css
git commit -m "feat: unify topbar into an icon row (intro/language/export/import)"
```

---

## Phase B — ICDAS integration

### Task B1: Canonical ICDAS model + mapping + serialization

Make the per-surface caries value a canonical ICDAS integer (1–6); derive the 3-level scale; migrate old string values.

**Files:** `src/odontogram.ts`, Test `src/__tests__/icdas.test.ts`.

**Interfaces:**
- Produces (exported for tests): `icdasTier(code:number):1|2|3`, `threeLevelToIcdas(level:string):number`, `icdasToThreeLevel(code:number):string`. State: `cariesActiveDepth:number` (default 2), `cariesDepths: Map<string, number>` (1–6).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/icdas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { icdasTier, threeLevelToIcdas, icdasToThreeLevel } from "../odontogram";

describe("ICDAS mapping helpers", () => {
  it("icdasTier groups 1-2/3-4/5-6", () => {
    expect([1,2].map(icdasTier)).toEqual([1,1]);
    expect([3,4].map(icdasTier)).toEqual([2,2]);
    expect([5,6].map(icdasTier)).toEqual([3,3]);
  });
  it("threeLevelToIcdas maps to representative codes", () => {
    expect(threeLevelToIcdas("surface")).toBe(2);
    expect(threeLevelToIcdas("dentin")).toBe(4);
    expect(threeLevelToIcdas("deep")).toBe(6);
    expect(threeLevelToIcdas("nonsense")).toBe(2);
  });
  it("icdasToThreeLevel is the inverse grouping", () => {
    expect([1,2].map(icdasToThreeLevel)).toEqual(["surface","surface"]);
    expect([3,4].map(icdasToThreeLevel)).toEqual(["dentin","dentin"]);
    expect([5,6].map(icdasToThreeLevel)).toEqual(["deep","deep"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/icdas.test.ts` — FAIL (helpers not exported).

- [ ] **Step 3: Implement helpers + valid set**

In `src/odontogram.ts`, near `getCariesDepthOptions` add:
```ts
const VALID_ICDAS = new Set([1,2,3,4,5,6]);
export function icdasTier(code: number): 1|2|3 { return code <= 2 ? 1 : code <= 4 ? 2 : 3; }
export function threeLevelToIcdas(level: string): number { return level === "deep" ? 6 : level === "dentin" ? 4 : 2; }
export function icdasToThreeLevel(code: number): string { const t = icdasTier(code); return t === 3 ? "deep" : t === 2 ? "dentin" : "surface"; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/icdas.test.ts` — PASS.

- [ ] **Step 5: defaultState + serialize + hydrate migration**

In `defaultState()` change:
```ts
    cariesActiveDepth: 2, // canonical ICDAS code (2 = superficial representative)
    cariesDepths: new Map(), // surface -> ICDAS code 1..6
```
`serializeState` already writes `cariesActiveDepth` (now a number) and `cariesDepths` via `Object.fromEntries` — no change needed.
In `hydrateState`, replace the current caries-depth hydrate block with a migrating version:
```ts
  const toIcdas = (v: Any): number | null => {
    if(typeof v === "number" && VALID_ICDAS.has(v)) return v;
    if(typeof v === "string"){
      if(v === "surface" || v === "dentin" || v === "deep") return threeLevelToIcdas(v);
      const n = Number(v); if(VALID_ICDAS.has(n)) return n;
    }
    return null;
  };
  s.cariesActiveDepth = toIcdas(raw.cariesActiveDepth) ?? 2;
  s.cariesDepths = new Map();
  if(raw.cariesDepths && typeof raw.cariesDepths === "object"){
    for(const [surf, val] of Object.entries(raw.cariesDepths)){
      const code = toIcdas(val);
      if(VALID_FILLING_SURFACES.has(surf) && code !== null) s.cariesDepths.set(surf, code);
    }
  }
```
(Remove the old `s.cariesActiveDepth = validateEnum(...)` + old `cariesDepths` loop. `VALID_CARIES_DEPTH` may become unused — leave it or delete.)

- [ ] **Step 6: Full tests + commit**

Run: `npx vitest run` (all pass), `npx tsc -b --noEmit` (clean), `npm run build`.
```bash
git add src/odontogram.ts src/__tests__/icdas.test.ts
git commit -m "feat(icdas): canonical per-surface ICDAS model + mapping + migration"
```

### Task B2: ICDAS mode + mode-aware UI + settings toggle

**Files:** `src/odontogram.ts`, `src/App.tsx`, `src/index.css`, `src/i18n/translations.ts`.

**Interfaces:**
- Consumes: `icdasTier`, `getCariesDepthOptions` (now mode-aware). Produces: `setIcdasEnabled(bool)`/`getIcdasEnabled()`; module flag `icdasEnabled`.

- [ ] **Step 1: Mode flag + setter**

In `src/odontogram.ts` near `notesEnabled`:
```ts
let icdasEnabled = false;
export function setIcdasEnabled(value: boolean){ icdasEnabled = !!value; if(activeTooth) syncControlsFromState(toothState.get(activeTooth)); }
export function getIcdasEnabled(): boolean { return icdasEnabled; }
```

- [ ] **Step 2: Mode-aware options**

Replace `getCariesDepthOptions()` with:
```ts
function getCariesDepthOptions(){
  if(icdasEnabled){
    return [1,2,3,4,5,6].map((n)=>({ value:n, label:`${n} — ${t(`icdas.code.${n}`)}`, title:t(`icdas.desc.${n}`) }));
  }
  return [
    {value:2, label:t("caries.depth.surface")},
    {value:4, label:t("caries.depth.dentin")},
    {value:6, label:t("caries.depth.deep")},
  ];
}
```
Update `buildSelect`/`setSelectOptions` usage: the select stores `value` as a string; where `cariesActiveDepth` is read from the select, parse to int. In the `#cariesDepthSelect` change handler set `s.cariesActiveDepth = Number(val)`. In the sync self-heal compare `String(state.cariesActiveDepth)`. (If `buildSelect`/`setSelectOptions` set `option.title` from `opt.title`, add that; otherwise extend them to set `title` when present — a 1-line addition in each.)

- [ ] **Step 3: Popup + indicator adapt to mode**

In `showCariesDepthPopup`, the option buttons already come from `getCariesDepthOptions()`; set `btn.title = opt.title || ""` and store `opt.value` (number) — `s.cariesDepths.set(surface, Number(opt.value))`.
In the caries indicator sync (in `syncControlsFromState`), set the indicator for both modes:
```ts
  $$("#cariesChecks .surface-cell").forEach(cell => {
    const c = cell.querySelector("input[type=checkbox]") as HTMLInputElement | null;
    const ind = cell.querySelector(".surf-depth") as HTMLElement | null;
    if(c && ind){
      const surface = String(c.value).replace("caries-", "");
      const code = state.cariesDepths.get(surface) || 2;
      ind.setAttribute("data-depth", icdasToThreeLevel(code)); // drives 3-bar CSS
      ind.setAttribute("data-icdas", String(code));            // drives the badge
      ind.classList.toggle("icdas", icdasEnabled);
      ind.textContent = ""; // clear
      if(icdasEnabled){ ind.textContent = String(code); }      // badge number
      else { ind.innerHTML = "<i></i><i></i><i></i>"; }        // 3 bars
    }
  });
```
Update the indicator builder (after `buildSurfaceCross` for caries) to initialize with the 3 `<i>` bars (already does). The render loop opacity stays via `cariesDepths.get(surface)` but map through `icdasTier`:
```ts
      const code = state.cariesDepths.get(surface) || 2;
      const tier = icdasTier(code);
      surfEl.style.opacity = tier === 3 ? "1" : tier === 2 ? "0.7" : "0.45";
      surfEl.classList.toggle("caries-deep", tier === 3);
```

- [ ] **Step 4: ICDAS toggle in the Settings dropdown (from A1)**

In `App.tsx`, import `setIcdasEnabled`, add `const [icdasOn, setIcdasOn] = useState<boolean>(enableIcdas ?? false)`, an effect `useEffect(()=>{ setIcdasEnabled(enableIcdas ?? false); setIcdasOn(enableIcdas ?? false); }, [enableIcdas])`, add the `enableIcdas?: boolean` prop, and add a toggle item to the settings menu after the Notes toggle:
```tsx
                <button className="dropdown-item" role="menuitemcheckbox" aria-checked={icdasOn}
                  onClick={() => { const v = !icdasOn; setIcdasOn(v); setIcdasEnabled(v); }}>
                  {t("icdas.enable")}{icdasOn ? " ✓" : ""}
                </button>
```
Re-export `setIcdasEnabled` from `App.tsx`.

- [ ] **Step 5: CSS for the ICDAS badge**

Append to `src/index.css`:
```css
.surf-depth.icdas{flex-direction:row; gap:0; padding:0; min-width:15px; height:15px; align-items:center; justify-content:center; border-radius:50%; font-size:10px; font-weight:800; color:#fff; background:#b3261e}
.surf-depth.icdas[data-depth="surface"]{background:#e6a23c}
.surf-depth.icdas[data-depth="dentin"]{background:#d9663d}
.surf-depth.icdas[data-depth="deep"]{background:#b3261e}
.surf-depth.icdas i{display:none}
```

- [ ] **Step 6: i18n (8 languages)**

Add `icdas.enable` (toggle) and `icdas.code.1..6` (short) + `icdas.desc.1..6` (full). Hungarian short e.g.: 1 "Zománc (szárítva)", 2 "Zománc (nedvesen)", 3 "Zománc-áttörés", 4 "Dentin árnyék", 5 "Kavitáció (dentin)", 6 "Kiterjedt kavitáció". `icdas.enable` = "ICDAS". Provide accurate English + de/es/it/sk/pl/ru short labels and full descriptions (full = the standard ICDAS wording per code). English desc example: 1 "First visual change in enamel (seen after drying)", … 6 "Extensive distinct cavity with visible dentin (≥ half the surface)".

- [ ] **Step 7: Verify + commit**

Run: `npx vitest run` (all pass), `npx tsc -b --noEmit` (clean), `npm run build`. Manual (dev server): default = 3-level (unchanged); enable ICDAS in Settings → depth selector shows 1–6, active surface shows a number badge, popup lists 1–6 with tooltips; toggling back shows the correct 3-level tier; SVG opacity follows the tier.
```bash
git add src/odontogram.ts src/App.tsx src/index.css src/i18n/translations.ts
git commit -m "feat(icdas): switchable ICDAS mode — selector, badge, popup, settings toggle"
```

### Task B3: FHIR per-surface ICDAS code

**Files:** `src/fhir/toFhir.ts`, `src/fhir/fromFhir.ts`, `src/fhir/codesystems.ts`, `src/__tests__/fhir.test.ts`, `src/__tests__/fhir-import.test.ts`.

**Interfaces:** Consumes `cariesDepths` (surface→ICDAS int).

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/fhir-import.test.ts` a case in the round-trip payload: tooth `"37": { caries: ["caries-mesial"], cariesDepths: { mesial: 5 } }`, and assert after round-trip: `expect(out.teeth["37"].cariesDepths).toEqual({ mesial: 5 })`.

- [ ] **Step 2: Emit ICDAS in the caries component**

In `src/fhir/toFhir.ts` `case "set"`, when the mapping field is `caries`, attach the ICDAS code from the tooth's `cariesDepths`:
```ts
    case "set": {
      const arr = Array.isArray(raw) ? (raw as unknown[]).filter((v): v is string => typeof v === "string") : [];
      if (arr.length === 0) return [];
      const obs = baseObservation(subjectRef, tooth, findingConcept(mapping.findingCode, mapping.findingDisplay));
      const depths = (mapping.field === "caries") ? ((rec as Record<string, unknown>).cariesDepths as Record<string, number> | undefined) : undefined;
      obs.component = arr.map((v) => {
        const comp: Any = { code: valueConcept(mapping.valueGroup, v), valueBoolean: true };
        if (depths) {
          const surface = String(v).replace("caries-", "");
          const code = depths[surface];
          if (typeof code === "number") { comp.valueInteger = code; delete comp.valueBoolean; }
        }
        return comp;
      });
      return [obs];
    }
```
(Requires `Any` import or use `Record<string, unknown>`; `toFhir.ts` may need a local `type Any = any` or cast — mirror existing typing.)

- [ ] **Step 3: Parse ICDAS back**

In `src/fhir/fromFhir.ts`, in the caries (`set`) handling, read `component.valueInteger` into `cariesDepths`:
```ts
      // inside the set-kind reconstruction for the caries finding:
      const depths: Record<string, number> = {};
      for(const comp of (res.component ?? [])){
        const code = localCode(comp.code); // e.g. caries-mesial
        if(!code) continue;
        // record membership (existing behavior) …
        const vi = (comp as Any).valueInteger;
        if(typeof vi === "number"){ depths[String(code).replace("caries-","")] = vi; }
      }
      if(Object.keys(depths).length) rec.cariesDepths = depths;
```
(Adapt to the actual `fromFhir.ts` set-branch structure; ensure `caries` array membership is still set as today, and `cariesDepths` is added when codes are present.)

- [ ] **Step 4: codesystems note + coverage test**

In `src/fhir/codesystems.ts` add `export const ICDAS_SYSTEM = "https://www.icdas.org";` (documentation constant). In `src/__tests__/fhir.test.ts` `SERIALIZED`, ensure `cariesActiveDepth` and `cariesDepths` remain in `SPECIAL` (already there); no change unless names differ.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` (all pass incl. round-trip), `npx tsc -b --noEmit` (clean), `npm run build`.
```bash
git add src/fhir src/__tests__/fhir.test.ts src/__tests__/fhir-import.test.ts
git commit -m "feat(icdas): carry per-surface ICDAS code through FHIR"
```

---

## Phase C — Host, docs, version, verification

### Task C1: Host types + prop declaration + docs/version + main-app verify

**Files:** main-repo `src/modules/odontogram/types.ts`, `src/modules/odontogram/odontogram-shell.d.ts`; engine `package.json`, `README.md`.

- [ ] **Step 1: Host types**

In main-repo `src/modules/odontogram/types.ts`, change the caries-depth fields to numbers:
```ts
  cariesActiveDepth?: number;
  cariesDepths?: Record<string, number>;
```

- [ ] **Step 2: Prop declaration**

In `src/modules/odontogram/odontogram-shell.d.ts`, add to the props type: `enableIcdas?: boolean;` (next to `enableNotes` if present, else in the props interface).

- [ ] **Step 3: Version + README**

Engine `package.json` `1.8.1` → `1.9.0`. README: bump the version badge; add feature bullets (unified icon topbar + Settings menu; optional ICDAS per-surface scoring) to EN/DE/ES/HU; note the `enableIcdas` prop in the API/props section.

- [ ] **Step 4: Engine verify + commit**

Run (engine): `npm test` (all pass), `npx tsc -b --noEmit` (clean), `npm run build`.
```bash
git add package.json README.md
git commit -m "docs: document ICDAS + topbar settings; bump engine to v1.9.0"
```

- [ ] **Step 5: Main-app compatibility + pointer bump**

```bash
cd /Users/Zoli/Sites/DentalQuoteCreator
grep -n "@odontogram-shell" src/modules/odontogram/OdontogramHost.tsx   # only the 5 original symbols
npx tsc -b --noEmit   # clean
npm run build          # success
git add src/modules/odontogram/types.ts src/modules/odontogram/odontogram-shell.d.ts src/modules/odontogram/engine
git commit -m "chore: bump odontogram submodule to v1.9.0 (ICDAS + topbar settings)"
```
(Do not push unless the user asks.)

---

## Self-review notes (completed by plan author)

- **Spec coverage:** topbar settings dropdown (A1) + iconify (A2); canonical ICDAS + mapping + migration (B1); mode flag + prop + settings toggle + mode-aware selector/popup/badge + tier render (B2); FHIR per-surface ICDAS round-trip (B3); host types + `enableIcdas` prop + docs/version + main-app verify (C1). All spec sections mapped.
- **Sequencing:** A before B (settings dropdown hosts the ICDAS toggle added in B2). B1 before B2 (helpers/model before UI). B3 after B1 (uses `cariesDepths` ints).
- **Placeholder scan:** no TBD/TODO; non-English ICDAS descriptions explicitly required (B2 Step 6), not placeholders.
- **Type/name consistency:** `icdasEnabled`/`setIcdasEnabled`/`getIcdasEnabled`, `icdasTier`/`threeLevelToIcdas`/`icdasToThreeLevel`, `cariesActiveDepth:number`, `cariesDepths:Map<string,number>`, `settingsOpen`/`settingsRef`, `notesOn`/`icdasOn`, i18n `settings.*`/`icdas.*`, CSS `.settings-menu`/`.surf-depth.icdas` used consistently.
- **Host coupling:** hidden `#btnStatus*` + `#statusImportInput` + `wireControls` unchanged; only visible triggers become icons. `#btnStatusExport` preserved.
- **Backward compat:** hydrate migrates old string depths → ICDAS ints; unknown dropped; never throws.
