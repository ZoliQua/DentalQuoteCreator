# Dental ICD-10 DX-3a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Code the two tooth-level clinical findings the engine already charts but DX-1 left uncoded — a fractured (broken) tooth → WHO **S02.5**, and peri-implant disease → **no WHO code** (surfaced as a recognized-but-uncoded diagnosis, real coding deferred to SNOMED in DX-6).

**Architecture:** Extends the existing `src/dx/` derivation layer (`codes.ts`/`derive.ts`) and the FHIR emitter (`toFhirDx.ts`). Introduces the program's first *uncoded diagnosis*: a `DiagnosisKey` whose `DX_CODES` entry has no `icd10`. The coding machinery is made to tolerate a code-less key (return no `Condition`, surface a "no WHO code" marker); DX-6 later attaches a SNOMED coding and it lights up with zero other change.

**Tech Stack:** TypeScript, Vitest, the engine's pure `deriveDentalDiagnoses` + FHIR builders.

## Global Constraints

- Commits authored by **Zoltán Dul** only — **no** Claude/Co-Authored-By trailer.
- Never stage `tsconfig.tsbuildinfo`.
- **Fracture → S02.5** "Fracture of tooth" (WHO ICD-10). Peri-implant → **no WHO code**.
- **Peri-implantitis severities collapse** to one `periImplantitis` key; `mucositis` → `periImplantMucositis`.
- **No new tooth-state field; payload stays 2.21.** `roundtrip-golden.json`, `svg-fingerprints.json`, `shell-dom-golden.html` byte-identical.
- `fhir-golden.json` changes **only** if a parity fixture carries a broken tooth (adds an S02.5 `Condition`) — verify the diff is *only* that. Peri-implant emits nothing.
- `deriveDentalDiagnoses` stays **pure** (no `Date`/`Math.random`/module state).
- Every task ends green: `npx tsc -b --noEmit` clean, `npx eslint` 0 errors, `npx vitest run` green.

---

### Task 1: Uncoded-diagnosis vocabulary + capability

Introduce the three keys, make `DX_CODES.icd10` optional, and teach the coding machinery + surfacing getters to tolerate a code-less key. **Zero runtime behavior change** — nothing derives the new keys yet, so all goldens stay byte-identical; this task only makes the codebase *able* to carry an uncoded diagnosis.

**Files:**
- Modify: `src/dx/codes.ts`
- Modify: `src/fhir/toFhirDx.ts` (`buildConditionCode`, `appendDentalConditions`)
- Modify: `src/fhir/toFhirPerio.ts:706` (null-guard the nullable return)
- Modify: `src/odontogram.ts` (`TOOTH_LEVEL_DX_KEYS`; `ToothDiagnosis.icd10`; `getToothDiagnoses`; `getActiveDiagnoses` icd10 guard)
- Modify: `src/i18n/translations.ts` (3 `dx.*` + `diagnoses.noCode`, 12 languages)
- Test: `src/dx/__tests__/codes.test.ts` (or the existing dx test that suits), `src/__tests__/dx-card.test.tsx` (update the hardcoded key list + count)

**Interfaces:**
- Produces: `DiagnosisKey` union gains `toothFracture | periImplantMucositis | periImplantitis`; `DiagnosisCode.icd10?: string` (optional); `buildConditionCode(key, pack?): CodeableConcept | null`; `TOOTH_LEVEL_DX_KEYS` now excludes the two peri-implant keys (size **23**, includes `toothFracture`); `ToothDiagnosis.icd10: string | null`.
- Consumes: existing `DX_CODES`, `packCoding`, `deriveDentalDiagnoses`.

- [ ] **Step 1: Add the three keys + optional `icd10` (`src/dx/codes.ts`).**

Extend the union (append to the last line) and add the entries; make `icd10` optional:

```ts
export type DiagnosisKey =
  | "caries" | "periodontitis" | "gingivitis"
  | "cariesCementum" | "cariesArrested"
  | "pulpitis" | "pulpNecrosis"
  | "apicalPeriodontitisAcute" | "apicalPeriodontitisChronic" | "radicularCyst"
  | "periapicalAbscess" | "periapicalAbscessSinus" | "condensingOsteitis"
  | "resorption" | "attrition" | "abrasion" | "erosion" | "abfraction" | "calculus"
  | "fluorosis" | "tetracyclineStain" | "postEruptiveColour"
  | "toothLoss" | "retainedRoot"
  | "toothFracture" | "periImplantMucositis" | "periImplantitis";

export interface DiagnosisCode {
  icd10?: string;          // optional: an "uncoded" diagnosis (e.g. peri-implant) has no WHO code
  icd10Display: string;
  snomed?: string;
}
```

Add to `DX_CODES` (fracture coded; peri-implant intentionally without `icd10`):

```ts
  toothFracture: { icd10: "S02.5", icd10Display: "Fracture of tooth" },
  periImplantMucositis: { icd10Display: "Peri-implant mucositis" },
  periImplantitis: { icd10Display: "Peri-implantitis" },
```

- [ ] **Step 2: Make `buildConditionCode` nullable (`src/fhir/toFhirDx.ts`).**

Replace the function so an uncoded key yields `null` (and a translation pack only contributes when there IS a WHO code to mirror):

```ts
export function buildConditionCode(key: DiagnosisKey, pack?: CodingPack): CodeableConcept | null {
  const base = DX_CODES[key];
  const coding: NonNullable<CodeableConcept["coding"]> = [];
  if (base.icd10) {
    coding.push({ system: ICD10_SYSTEM, code: base.icd10, display: base.icd10Display });
    if (pack) {
      const extra = packCoding(pack, key, base.icd10, base.icd10Display);
      if (extra) coding.push(extra);
    }
  }
  if (coding.length === 0) return null; // uncoded diagnosis (no WHO code, no pack code)
  return { coding, text: base.icd10Display };
}
```

- [ ] **Step 3: Skip uncoded diagnoses in `appendDentalConditions` (same file).**

Inside the `for (const d of derived)` loop, compute the code first and skip when null:

```ts
  for (const d of derived) {
    const code = buildConditionCode(d.key, options.codingPack);
    if (!code) continue; // uncoded diagnosis (e.g. peri-implant at WHO base) — nothing to emit
    const id = `odontogram-dx-${d.key}-${d.toothNo}`;
    const rec = payload.teeth?.[d.toothNo] ?? {};
    const bodySiteCode = toothBodySiteCode(d.toothNo, rec);
    const condition: Condition = {
      resourceType: "Condition",
      id,
      code,
      subject: { reference: subjectRef },
      bodySite: [{ coding: [{ system: FDI_SYSTEM, code: bodySiteCode }] }],
    };
    bundle.entry.push({ fullUrl: `urn:uuid:${id}`, resource: condition });
  }
```

- [ ] **Step 4: Null-guard the perio caller (`src/fhir/toFhirPerio.ts:706`).**

`gingivitis`/`periodontitis` are always coded, but the return type is now nullable — add a defensive guard right after the call so tsc narrows `code` to non-null for the `Condition`:

```ts
  const code = buildConditionCode(dxKey, options.codingPack);
  if (!code) return; // gingivitis/periodontitis are always coded; defensive guard for the nullable return
```

- [ ] **Step 5: Catalog + surfacing types (`src/odontogram.ts`).**

`TOOTH_LEVEL_DX_KEYS` — exclude the two peri-implant keys (implant-only, uncoded), keeping `toothFracture` in:

```ts
export const TOOTH_LEVEL_DX_KEYS = new Set(Object.keys(DX_CODES).filter((k) =>
  k !== "periodontitis" && k !== "gingivitis" && k !== "periImplantMucositis" && k !== "periImplantitis"));
```

`ToothDiagnosis.icd10` becomes nullable, and `getToothDiagnoses` maps it (an uncoded key gets `null`):

```ts
export type ToothDiagnosis = {
  key: DiagnosisKey;
  icd10: string | null;
  icd10Display: string;
  source: "derived" | "added";
};
```
```ts
  return derived.map((d) => ({
    key: d.key,
    icd10: DX_CODES[d.key].icd10 ?? null,
    icd10Display: DX_CODES[d.key].icd10Display,
    source: overrides?.get(d.key) === "add" ? "added" : "derived",
  }));
```

`getActiveDiagnoses` only ever handles coded tooth-level keys (peri-implant is excluded and never derives on a natural tooth), but `DX_CODES[key].icd10` is now `string | undefined` — keep its `icd10: string` row type by guarding the (unreachable) undefined at both assignment sites:

```ts
    icd10: DX_CODES[key as DiagnosisKey].icd10 ?? "", // all catalog keys are coded; ?? is an unreachable type guard
```
(apply to both the `rows.map(...)` site and the added-override `rows.push(...)` site).

- [ ] **Step 6: i18n — 3 `dx.*` labels + the `diagnoses.noCode` marker, all 12 languages (`src/i18n/translations.ts`).**

Mirror the placement/format of the existing `dx.caries`/`dx.pulpitis` entries. Add to each language block:

| lang | dx.toothFracture | dx.periImplantMucositis | dx.periImplantitis | diagnoses.noCode |
|------|------------------|-------------------------|--------------------|------------------|
| hu | Fogtörés | Periimplantáris mukozitisz | Periimplantitisz | nincs WHO-kód |
| en | Fracture of tooth | Peri-implant mucositis | Peri-implantitis | no WHO code |
| de | Zahnfraktur | Periimplantäre Mukositis | Periimplantitis | kein WHO-Code |
| es | Fractura dental | Mucositis periimplantaria | Periimplantitis | sin código OMS |
| it | Frattura dentale | Mucosite perimplantare | Perimplantite | nessun codice OMS |
| sk | Zlomenina zuba | Periimplantátová mukozitída | Periimplantitída | bez kódu WHO |
| pl | Złamanie zęba | Mukozyt periimplantacyjny | Periimplantitis | brak kodu WHO |
| ru | Перелом зуба | Периимплантатный мукозит | Периимплантит | нет кода ВОЗ |
| pt-br | Fratura dentária | Mucosite peri-implantar | Peri-implantite | sem código OMS |
| ar | كسر السن | التهاب الغشاء المخاطي حول الزرعة | التهاب حول الزرعة | لا يوجد رمز WHO |
| zh | 牙折 | 种植体周黏膜炎 | 种植体周炎 | 无 WHO 编码 |
| fr | Fracture dentaire | Mucosite péri-implantaire | Péri-implantite | pas de code OMS |

- [ ] **Step 7: Update the DX-2 key-parity test (`src/__tests__/dx-card.test.tsx`).**

The test carries a hardcoded `TOOTH_LEVEL_DX_KEYS` array that must Set-equal the real export, and a `CARD_KEYS` list it checks in all 12 languages. Add `"toothFracture"` to the hardcoded array (do **not** add the peri-implant keys — they're excluded from the real set), and add `"diagnoses.noCode"` to `CARD_KEYS`:

```ts
  const TOOTH_LEVEL_DX_KEYS = [
    /* ...the existing 22 entries... */,
    "toothFracture",
  ];
  const CARD_KEYS = [ /* ...existing card.diagnoses/diagnoses.add/suppress/added... */, "diagnoses.noCode" ];
```

Also scan the dx test suite for any assertion of the old catalog size or exact addable set (e.g. `dx-active-diagnoses.test.ts`, `dx-overrides-payload.test.ts`) and update `22 → 23` / add `toothFracture` where an addable-keys list is asserted on real (non-mocked) state.

- [ ] **Step 8: Unit tests for the capability (`src/dx/__tests__/codes.test.ts` or a new `dx-uncoded.test.ts`).**

```ts
import { buildConditionCode } from "../../fhir/toFhirDx";
import { DX_CODES } from "../codes";
import { TOOTH_LEVEL_DX_KEYS } from "../../odontogram";

it("codes toothFracture as WHO S02.5", () => {
  const cc = buildConditionCode("toothFracture");
  expect(cc?.coding?.[0]).toMatchObject({ code: "S02.5" });
});
it("returns null for an uncoded peri-implant diagnosis", () => {
  expect(buildConditionCode("periImplantitis")).toBeNull();
  expect(buildConditionCode("periImplantMucositis")).toBeNull();
});
it("peri-implant keys have a display but no icd10", () => {
  expect(DX_CODES.periImplantitis.icd10).toBeUndefined();
  expect(DX_CODES.periImplantitis.icd10Display).toBe("Peri-implantitis");
});
it("TOOTH_LEVEL_DX_KEYS includes fracture, excludes peri-implant, and is size 23", () => {
  expect(TOOTH_LEVEL_DX_KEYS.has("toothFracture")).toBe(true);
  expect(TOOTH_LEVEL_DX_KEYS.has("periImplantitis")).toBe(false);
  expect(TOOTH_LEVEL_DX_KEYS.has("periImplantMucositis")).toBe(false);
  expect(TOOTH_LEVEL_DX_KEYS.size).toBe(23);
});
```

- [ ] **Step 9: Verify green + goldens byte-identical.**

Run: `npx tsc -b --noEmit` (clean); `npx vitest run` (green); `npx eslint src/dx src/fhir src/i18n src/odontogram.ts` (0 errors). Confirm no golden fixture changed: `git status --short src/__tests__/parity/` is empty (nothing derives the new keys yet → FHIR/roundtrip/svg/shell all byte-identical). If any golden changed, STOP and investigate.

- [ ] **Step 10: Commit.**

```bash
git add src/dx/codes.ts src/fhir/toFhirDx.ts src/fhir/toFhirPerio.ts src/odontogram.ts src/i18n/translations.ts src/dx/__tests__ src/__tests__/dx-card.test.tsx
git commit -m "feat(dx): DX-3a vocabulary - fracture + peri-implant keys, optional icd10, uncoded-diagnosis capability"
```

---

### Task 2: Fracture → S02.5 derivation

Derive `toothFracture` from the existing broken-crown finding and emit its S02.5 `Condition`.

**Files:**
- Modify: `src/dx/derive.ts` (fracture inside the `if (natural)` block)
- Test: `src/dx/__tests__/derive.test.ts`
- Possibly: `src/__tests__/parity/fhir-golden.json` (only if a fixture has a broken tooth)

**Interfaces:**
- Consumes: `toothFracture` key + nullable `buildConditionCode` (Task 1).
- Produces: `deriveDentalDiagnoses` now emits `toothFracture` for a broken present tooth.

- [ ] **Step 1: Failing test — a broken tooth derives `toothFracture` and emits S02.5 (`src/dx/__tests__/derive.test.ts`).**

```ts
it("derives toothFracture from a broken crown", () => {
  const out = deriveDentalDiagnoses({ teeth: { "11": { toothSelection: "tooth-base", brokenMesial: true } } });
  expect(out.map((d) => d.key)).toContain("toothFracture");
});
it("does not derive toothFracture on an intact tooth", () => {
  const out = deriveDentalDiagnoses({ teeth: { "11": { toothSelection: "tooth-base" } } });
  expect(out.map((d) => d.key)).not.toContain("toothFracture");
});
```
And a FHIR emit test (in the FHIR/dx integration test file, e.g. `src/dx/__tests__/dx-conditions.test.ts`):
```ts
it("emits an S02.5 Condition for a broken tooth", () => {
  const bundle: any = { resourceType: "Bundle", type: "collection", entry: [] };
  appendDentalConditions(bundle, { teeth: { "11": { toothSelection: "tooth-base", brokenIncisal: true } } } as any);
  const dx = bundle.entry.find((e: any) => e.resource.id === "odontogram-dx-toothFracture-11");
  expect(dx.resource.code.coding[0].code).toBe("S02.5");
  expect(dx.resource.bodySite[0].coding[0].code).toBe("11");
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/dx/__tests__/derive.test.ts` — FAIL (no `toothFracture` derived).

- [ ] **Step 3: Implement the fracture derivation (`src/dx/derive.ts`).**

Inside the existing `if (natural) { ... }` block (alongside the caries/ENUM_RULES lines), add:

```ts
      // Fracture (K/S02.5) — same broken-crown predicate as fractureSummaryLabel
      if (rec.brokenMesial || rec.brokenIncisal || rec.brokenDistal) add("toothFracture");
```

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/dx` — PASS.

- [ ] **Step 5: Reconcile the FHIR golden.**

Run `npx vitest run src/__tests__/parity`. If `fhir-golden.json` fails, a parity fixture carries a broken tooth and the diff is a new `odontogram-dx-toothFracture-*` `Condition` with code `S02.5`. Inspect the diff (`git diff src/__tests__/parity/fhir-golden.json`) and confirm it is **only** S02.5 `Condition` entries — nothing else. Regenerate via the project's capture (`npm run parity:capture`), re-run, confirm green. If parity passes untouched, the fixtures have no broken tooth — leave the golden as-is (the S02.5 emission is proven by the Step 1 unit test). Either way, `roundtrip`/`svg`/`shell` must stay byte-identical.

- [ ] **Step 6: Commit.**

```bash
git add src/dx/derive.ts src/dx/__tests__
# include src/__tests__/parity/fhir-golden.json ONLY if it was intentionally regenerated
git commit -m "feat(dx): derive tooth fracture -> WHO S02.5"
```

---

### Task 3: Peri-implant derivation + uncoded surfacing

Derive the two peri-implant keys (implant-gated), confirm no `Condition` is emitted (uncoded skip from Task 1), and render the "no WHO code" marker in the tooltip + whole-mouth summary.

**Files:**
- Modify: `src/dx/derive.ts` (`PERIIMPLANT` table + implant-gated block)
- Modify: `src/odontogram.ts` (tooltip `getStateSummary` ~4560; summary `getOdontogramSummary` ~10746)
- Test: `src/dx/__tests__/derive.test.ts`, `src/__tests__/` (a summary/tooltip test)

**Interfaces:**
- Consumes: `periImplantMucositis`/`periImplantitis` keys, nullable `buildConditionCode`, `getToothDiagnoses` returning `icd10: null` (Task 1); `diagnoses.noCode` i18n (Task 1).

- [ ] **Step 1: Failing test — peri-implant derivation, implant-gated, no Condition (`src/dx/__tests__/derive.test.ts`).**

```ts
it("derives periImplantitis from an implant's peri-implantitis (any severity)", () => {
  const out = deriveDentalDiagnoses({ teeth: { "36": { toothSelection: "implant", periImplant: "peri-implantitis-moderate" } } });
  expect(out.map((d) => d.key)).toContain("periImplantitis");
});
it("derives periImplantMucositis from implant mucositis", () => {
  const out = deriveDentalDiagnoses({ teeth: { "36": { toothSelection: "implant", periImplant: "mucositis" } } });
  expect(out.map((d) => d.key)).toContain("periImplantMucositis");
});
it("ignores a stale periImplant value on a non-implant tooth", () => {
  const out = deriveDentalDiagnoses({ teeth: { "36": { toothSelection: "tooth-base", periImplant: "peri-implantitis-severe" } } });
  expect(out.map((d) => d.key)).not.toContain("periImplantitis");
});
```
And (in the FHIR/dx conditions test) that peri-implant emits **no** Condition:
```ts
it("emits no Condition for uncoded peri-implant disease", () => {
  const bundle: any = { resourceType: "Bundle", type: "collection", entry: [] };
  appendDentalConditions(bundle, { teeth: { "36": { toothSelection: "implant", periImplant: "peri-implantitis-severe" } } } as any);
  expect(bundle.entry.some((e: any) => String(e.resource.id).includes("periImplant"))).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/dx/__tests__/derive.test.ts` — FAIL.

- [ ] **Step 3: Implement peri-implant derivation (`src/dx/derive.ts`).**

Hoist a module-scope table next to `PULP`/`APICAL`:

```ts
// Peri-implant disease (implant-only). No WHO ICD-10 code -> surfaced uncoded (DX-3a).
const PERIIMPLANT: Record<string, DiagnosisKey> = {
  mucositis: "periImplantMucositis",
  "peri-implantitis-mild": "periImplantitis",
  "peri-implantitis-moderate": "periImplantitis",
  "peri-implantitis-severe": "periImplantitis",
};
```

Inside `deriveDentalDiagnoses`, in the tooth-status area **outside** the `if (natural)` block (implants are not `isNaturalPresent`), beside the `toothLoss`/`retainedRoot` lines:

```ts
    // Peri-implant disease — implant-only; keys are uncoded (no WHO ICD-10)
    if (rec.toothSelection === "implant") {
      const pi = PERIIMPLANT[String(rec.periImplant)];
      if (pi) add(pi);
    }
```

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/dx` — PASS.

- [ ] **Step 5: Render the "no WHO code" marker in the tooltip + summary (`src/odontogram.ts`).**

Both `getStateSummary` (~line 4560) and `getOdontogramSummary` (~line 10746) build `const line = \`${d.icd10Display} (${d.icd10})\`;`. Replace **both** with a nullable-aware line so an uncoded diagnosis shows the marker instead of `(null)`:

```ts
      const line = d.icd10 ? `${d.icd10Display} (${d.icd10})` : `${d.icd10Display} (${t("diagnoses.noCode")})`;
```

- [ ] **Step 6: Test the surfacing (`src/__tests__/…` — reuse the summary test seam).**

```ts
it("surfaces peri-implantitis in the summary as uncoded (no (null))", () => {
  // seed an implant tooth with peri-implantitis via the test seam, then:
  const summary = getOdontogramSummary();
  const text = JSON.stringify(summary);
  expect(text).toContain("Peri-implantitis");
  expect(text).not.toContain("(null)");
});
```
(Use whatever seeding seam the existing DX-2 summary/tooltip tests use — `getToothDiagnoses`/`getStateSummary` are already covered there; follow that file's setup.)

- [ ] **Step 7: Verify green + goldens.** `npx tsc -b --noEmit`; `npx vitest run`; `npx eslint …`. Peri-implant emits nothing → `fhir-golden.json` unchanged; all four goldens byte-identical. Confirm `git status --short src/__tests__/parity/` is empty.

- [ ] **Step 8: Commit.**

```bash
git add src/dx/derive.ts src/odontogram.ts src/dx/__tests__ src/__tests__
git commit -m "feat(dx): derive peri-implant disease as an uncoded diagnosis (no WHO code) + surface the marker"
```

---

### Task 4: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a `[Unreleased]` → `### Added` entry.**

```markdown
- **Dental diagnosis coding: tooth fracture + peri-implant (DX-3a).** A broken
  tooth now codes to WHO ICD-10 **S02.5** (Fracture of tooth). Peri-implant
  mucositis and peri-implantitis are recognized as diagnoses but have no WHO
  ICD-10 code, so they are surfaced as "no WHO code" in the tooltip and summary
  and emit no FHIR Condition — a coding follows when SNOMED CT is activated.
  Payload unchanged (2.21); the visual chart is unaffected.
```

- [ ] **Step 2: Commit.**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for dental diagnosis coding DX-3a"
```

---

## Self-Review

**Spec coverage:** §3.1 keys → Task 1 Step 1; §3.2 uncoded mechanism → Task 1 Steps 2-4; §3.3 fracture derivation → Task 2, peri-implant derivation → Task 3 Step 3; §3.4 catalog exclusions/inclusion + bodySite → Task 1 Step 5 (catalog) + Task 2 (S02.5 bodySite via existing `toothBodySiteCode`); §3.5 surfacing (null-code rows + tooltip/summary marker) → Task 1 Step 5 (`getToothDiagnoses` null) + Task 3 Step 5 (marker); §3.6 payload/goldens → Task 2 Step 5 + Task 1 Step 9; §4 verification → per-task test steps; §5 files → all covered; §6 out-of-scope → respected (no card change, no K08.5x, no SNOMED). ✓

**Placeholder scan:** every code step carries the actual code; the i18n table gives all 12 languages; the golden step spells out the conditional regenerate + verify. No TBD/TODO.

**Type consistency:** `toothFracture`/`periImplantMucositis`/`periImplantitis` (Task 1) used verbatim in Tasks 2-3; `PERIIMPLANT` table (Task 3); `buildConditionCode(...): CodeableConcept | null` (Task 1) consumed by the `if (!code) continue/return` guards (Task 1 Steps 3-4); `ToothDiagnosis.icd10: string | null` (Task 1) consumed by the nullable-aware `line` (Task 3 Step 5); `TOOTH_LEVEL_DX_KEYS` size 23 asserted (Task 1 Step 8) and matched by the hardcoded test list (Task 1 Step 7).

## Notes for the executor
- Task 1 is a **capability** task: nothing derives the new keys yet, so every golden must stay byte-identical and the full suite green. If a golden moves in Task 1, something is wrong — stop.
- The `icd10` → optional change forces the `buildConditionCode`, `toFhirPerio.ts:706`, `getToothDiagnoses`, and `getActiveDiagnoses` edits in Task 1 (tsc will not compile otherwise). They are all in Task 1 by design.
- Only Task 2 may touch `fhir-golden.json`, and only if a fixture has a broken tooth — verify the diff is solely S02.5 `Condition`s.
- Peri-implant is **derived-only and implant-only**: excluded from `TOOTH_LEVEL_DX_KEYS` (not addable), never shown in the interactive Diagnoses card (card is natural-present-gated), surfaced read-only in tooltip/summary. Do not wire it into the card.
