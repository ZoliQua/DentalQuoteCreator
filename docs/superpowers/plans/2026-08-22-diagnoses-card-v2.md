# Diagnoses card v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnoses card: show the ICD-10 code first (`K04.0 Pulpitis`), sort by code, and make adding a diagnosis write the underlying chart axis so the finding appears on the tooth.

**Architecture:** A `DX_REVERSE_MAP` (diagnosis key → chart-axis write) + `addDiagnosisToSelection` routed through `applyToSelected` (same DS-1-gated, repainting path the clinical controls use). `getActiveDiagnoses`/`getToothDiagnoses` sort by code; `addableKeys` becomes `{key, icd10}[]` limited to reverse-mappable keys. The card renders code-first and calls the new setter.

**Tech Stack:** TypeScript, Vitest, React.

## Global Constraints

- Commits authored by **Zoltán Dul** only — **no** Claude/Co-Authored-By trailer.
- Never stage `tsconfig.tsbuildinfo`.
- **Additive; payload/version unchanged (2.22).** **All four parity goldens byte-identical** — the card isn't in the fixtures, and FHIR export order is unchanged (it iterates `deriveDentalDiagnoses`, not the display getters). If a golden moves, STOP.
- `deriveDentalDiagnoses` and the FHIR export order are NOT changed.
- Add binds to the chart (real finding); `suppress` stays coded-only; legacy `dxOverrides` `add` rows still render (backward compat).
- Each task ends green: `npx tsc -b --noEmit` clean, `npx eslint <touched>` 0 errors, `npx vitest run` green.

---

### Task 1: Engine — reverse map, `addDiagnosisToSelection`, code sort, `addableKeys` shape

**Files:**
- Modify: `src/odontogram.ts`
- Modify: `src/App.tsx` (re-export)
- Test: `src/__tests__/dx-add-to-chart.test.ts`; update the DX-2 tests that assert `addableKeys` shape / diagnosis order (`src/__tests__/dx-active-diagnoses.test.ts`, `src/__tests__/dx-card.test.tsx`)

**Interfaces:**
- Produces: `addDiagnosisToSelection(key: string): void`; `REVERSE_MAPPABLE_KEYS: Set<string>`; `getActiveDiagnoses().addableKeys: { key: string; icd10: string }[]` (code-sorted); `getActiveDiagnoses().rows` + `getToothDiagnoses(...)` code-sorted.

- [ ] **Step 1: Write the failing tests (`src/__tests__/dx-add-to-chart.test.ts`).**

Follow the existing engine-test setup (import from `../odontogram`, `__resetChartStateForTest`/`resetCaseMeta` as the sibling tests do; select a tooth via the same seam they use — e.g. the test helper that sets `selectedTeeth`/`activeTooth`). Assert:
```ts
// after selecting present tooth 11:
addDiagnosisToSelection("pulpitis");
expect(getToothState(11).pulpDx).toBe("irreversible-pulpitis");          // axis written
expect(getToothDiagnoses(11).map((d) => d.key)).toContain("pulpitis");   // now derived
addDiagnosisToSelection("toothLoss");
expect(getToothState(11).toothSelection).toBe("no-tooth-after-extraction");
addDiagnosisToSelection("radicularCyst"); // compound
expect(getToothState(11).apicalDx).toBe("asymptomatic-apical-periodontitis");
expect(getToothState(11).periapicalType).toBe("cyst");
addDiagnosisToSelection("erosion");
expect(getToothState(11).wearEdge).toBe("erosion");
addDiagnosisToSelection("caries");    // excluded — no-op on the chart
// (caries surfaces unchanged)
```
(Use whatever public read seam the sibling tests use for tooth state — e.g. `getToothState`/`__plainStateForTest`/`getStatusChart().teeth["11"]`. If none, assert via `getToothDiagnoses(11)` keys, which reflect the axis writes.)
And drift + shape:
```ts
import { REVERSE_MAPPABLE_KEYS, TOOTH_LEVEL_DX_KEYS } from "../odontogram";
it("reverse map covers every tooth-level key except caries", () => {
  for (const k of REVERSE_MAPPABLE_KEYS) expect(TOOTH_LEVEL_DX_KEYS.has(k)).toBe(true);
  for (const k of TOOTH_LEVEL_DX_KEYS) if (k !== "caries") expect(REVERSE_MAPPABLE_KEYS.has(k)).toBe(true);
  expect(REVERSE_MAPPABLE_KEYS.has("caries")).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure.** FAIL.

- [ ] **Step 3: Add `DX_REVERSE_MAP` + `REVERSE_MAPPABLE_KEYS` + `addDiagnosisToSelection` (`src/odontogram.ts`, near `setDxOverrideForSelection`).**
```ts
// Reverse of deriveDentalDiagnoses' forward maps: adding a diagnosis from the
// card writes the underlying chart axis (default value) so the finding becomes
// real (glyph + derived + exported). Many-to-one forward maps use a clinical
// default (refinable via the specific control). `caries` is intentionally absent
// (per-surface — authored in the Caries UI).
const DX_REVERSE_MAP: Record<string, (s: Any) => void> = {
  pulpitis: (s) => { s.pulpDx = "irreversible-pulpitis"; },
  pulpNecrosis: (s) => { s.pulpDx = "necrosis"; },
  apicalPeriodontitisAcute: (s) => { s.apicalDx = "symptomatic-apical-periodontitis"; },
  apicalPeriodontitisChronic: (s) => { s.apicalDx = "asymptomatic-apical-periodontitis"; },
  periapicalAbscess: (s) => { s.apicalDx = "acute-apical-abscess"; },
  periapicalAbscessSinus: (s) => { s.apicalDx = "chronic-apical-abscess"; },
  condensingOsteitis: (s) => { s.apicalDx = "condensing-osteitis"; },
  radicularCyst: (s) => { s.apicalDx = "asymptomatic-apical-periodontitis"; s.periapicalType = "cyst"; },
  calculus: (s) => { s.calculus = true; },
  cariesCementum: (s) => { s.rootCaries = "active"; },
  cariesArrested: (s) => { s.rootCaries = "arrested"; },
  resorption: (s) => { s.resorptionType = "internal"; },
  attrition: (s) => { s.wearEdge = "attrition"; },
  erosion: (s) => { s.wearEdge = "erosion"; },
  abrasion: (s) => { s.wearCervical = "abrasion"; },
  abfraction: (s) => { s.wearCervical = "abfraction"; },
  fluorosis: (s) => { s.discoloration = "fluorosis"; },
  tetracyclineStain: (s) => { s.discoloration = "tetracycline"; },
  postEruptiveColour: (s) => { s.discoloration = "other"; },
  toothLoss: (s) => { s.toothSelection = "no-tooth-after-extraction"; },
  retainedRoot: (s) => { s.toothSubstrate = "radix"; },
  toothFracture: (s) => { s.brokenMesial = true; },
};
export const REVERSE_MAPPABLE_KEYS = new Set(Object.keys(DX_REVERSE_MAP));

/** Add a tooth-level diagnosis by writing its chart axis on the selection — a
 *  real finding (glyph + derived + exported), through the same DS-1-gated,
 *  repainting path as the clinical controls. Prototype-safe key guard; a
 *  non-reverse-mappable key (e.g. `caries`) is a silent no-op. */
export function addDiagnosisToSelection(key: string): void {
  if (!REVERSE_MAPPABLE_KEYS.has(key)) return;      // prototype-safe (Set, not `in`)
  const apply = DX_REVERSE_MAP[key];
  applyToSelected((s: Any) => apply(s));
}
```

- [ ] **Step 4: Sort the view-model + reshape `addableKeys` (`src/odontogram.ts`).**
In `getActiveDiagnoses`, after `rows` is built, sort by code and rebuild `addableKeys` from the reverse-mappable set:
```ts
  rows.sort((a, b) => a.icd10.localeCompare(b.icd10));
  const addableKeys = Array.from(REVERSE_MAPPABLE_KEYS)
    .filter((k) => !rowKeys.has(k))
    .map((k) => ({ key: k, icd10: DX_CODES[k as DiagnosisKey].icd10 ?? "" }))
    .sort((a, b) => a.icd10.localeCompare(b.icd10));
```
Update the `ActiveDiagnoses` type: `addableKeys: { key: string; icd10: string }[]`.
In `getToothDiagnoses`, sort the returned array by code (uncoded last):
```ts
  return derived.map(...).sort((a, b) => (a.icd10 ?? "￿").localeCompare(b.icd10 ?? "￿"));
```

- [ ] **Step 5: Re-export (`src/App.tsx`).** Add `addDiagnosisToSelection` to the import-from-`./odontogram` list and the re-export list.

- [ ] **Step 6: Fix the DX-2 tests that assumed the old shape/order.** In `dx-active-diagnoses.test.ts` / `dx-card.test.tsx`, update any assertion that read `addableKeys` as `string[]` (now `{key,icd10}[]` — use `.map(a => a.key)`) or that asserted a specific rows/addable ORDER (now code-sorted). Do not weaken them — re-express against the new shape/order.

- [ ] **Step 7: Run + goldens.** `npx tsc -b --noEmit`; `npx vitest run` green; `npx eslint src/odontogram.ts src/App.tsx` 0 errors; `git status --short src/__tests__/parity/` empty.

- [ ] **Step 8: Commit.**
```bash
git add src/odontogram.ts src/App.tsx src/__tests__
git commit -m "feat(dx): add-diagnosis writes the chart axis (reverse map) + code-sorted, code-carrying diagnoses view-model"
```

---

### Task 2: The card — code-first display + add→chart wiring

**Files:**
- Modify: `src/surfaces/cards/DiagnosesCard.tsx`
- Test: `src/__tests__/dx-card.test.tsx`

**Interfaces:**
- Consumes: `getActiveDiagnoses().rows` (code-sorted, each `{key, icd10, source, suppressed}`), `.addableKeys` (`{key, icd10}[]`), `addDiagnosisToSelection`, `setDxOverrideForSelection` (Task 1).

- [ ] **Step 1: Write/adjust the failing card test (`src/__tests__/dx-card.test.tsx`).**
Assert: a derived row renders code-first (text contains `"K04.0"` before the label / a `.dx-code` first); the add-`<select>` options render code-first (`"K04.0 Pulpitis"`); selecting an option calls `addDiagnosisToSelection(key)` (mock it) — NOT `setDxOverrideForSelection(key,"add")`; the suppress checkbox still calls `setDxOverrideForSelection`; a legacy `source:"added"` row still shows the remove button calling `setDxOverrideForSelection(key,null)`. (Mirror the file's existing mocking of the engine module.)

- [ ] **Step 2: Run to verify failure.** FAIL.

- [ ] **Step 3: Update `DiagnosesCard.tsx`.**
- Import `addDiagnosisToSelection` alongside `getActiveDiagnoses, setDxOverrideForSelection`.
- Row label → code-first: render the code before the label, e.g.
  `<span className="dx-code">{row.icd10}</span> <span className="dx-label">{t("dx." + row.key)}</span>`
  (put `.dx-code` first; keep `.dx-label`). If `row.icd10` is falsy, render only the label.
- Add-`<select>`: iterate `dx.addableKeys` (now `{key, icd10}[]`):
  ```tsx
  {dx.addableKeys.map(({ key, icd10 }) => (
    <option key={key} value={key}>{icd10 ? `${icd10} ${t("dx." + key)}` : t("dx." + key)}</option>
  ))}
  ```
  and `onChange` → `if (key) addDiagnosisToSelection(key);`.
- Leave the suppress checkbox + the legacy `source === "added"` remove button calling `setDxOverrideForSelection` unchanged.

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/__tests__/dx-card.test.tsx` — PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/surfaces/cards/DiagnosesCard.tsx src/__tests__/dx-card.test.tsx
git commit -m "feat(dx): Diagnoses card — code-first labels + add-picker writes the chart"
```

---

### Task 3: CHANGELOG + docs

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CHANGELOG `[Unreleased]` → `### Changed`.**
```markdown
- **Diagnoses card: code-first, sorted, and add-writes-the-chart.** The per-tooth
  Diagnoses card now shows the ICD-10 code first (e.g. "K04.0 Pulpitis"), sorts the
  diagnoses by code, and — when you add a diagnosis from the picker — writes the
  underlying chart finding (so the glyph appears on the tooth and it derives/exports
  normally) instead of only tagging the coded layer. Plain caries stays authored per
  surface in the Caries UI. Suppressing a derived diagnosis remains coded-layer only.
```

- [ ] **Step 2: Commit.**
```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Diagnoses card v2 (code-first, sorted, add-writes-chart)"
```

---

## Self-Review
**Spec coverage:** §3.1 reverse map → Task 1 Step 3; §3.2 `addDiagnosisToSelection` → Task 1 Step 3; §3.3 sort + `addableKeys` shape → Task 1 Step 4; §3.4 card → Task 2; §3.5 surfacing (tooltip/summary inherit the sort via `getToothDiagnoses`) → Task 1 Step 4; §4 verification → per-task tests; §5 files → covered; §6 out-of-scope → respected (no derive/export-order/payload change; BNO separate). ✓

**Placeholder scan:** full reverse-map code, setter, sort, and card JSX are provided; the test seams point at the existing sibling patterns. No "TBD".

**Type consistency:** `DX_REVERSE_MAP`/`REVERSE_MAPPABLE_KEYS`/`addDiagnosisToSelection` (Task 1) consumed by the card (Task 2); `addableKeys: {key, icd10}[]` (Task 1) consumed by the card's `.map` (Task 2); `getToothDiagnoses`/`getActiveDiagnoses` sorted (Task 1) feed tooltip/summary unchanged.

## Notes for the executor
- **Prototype safety:** guard the reverse-map lookup with `REVERSE_MAPPABLE_KEYS.has(key)` (a Set), never `key in DX_REVERSE_MAP` (would match `"toString"` etc.) — same lesson as the DX-7 importer.
- `addDiagnosisToSelection` MUST go through `applyToSelected` (not `gateToothEditBatch` directly) so the tooth **repaints** — setting a chart axis changes the glyph, unlike a `dxOverride`.
- Goldens must stay byte-identical: the card isn't in the fixtures and FHIR export order is unchanged (it iterates `deriveDentalDiagnoses`, not the sorted display getters).
- Known edge (acceptable v1): adding `pulpitis` on a tooth whose `endo` is a treated value sets `pulpDx` but the glyph may stay suppressed until the endo/pulp is resolved via the merged Pulp/Endo control — the diagnosis still derives.
