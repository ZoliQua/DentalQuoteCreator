# Dental ICD-10 DX-1 — map the charted findings to WHO ICD-10

Date: 2026-08-19
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Program: dental ICD-10 diagnosis coding (see `2026-08-19-dental-icd10-coding-design.md`).
DX-0 (foundation: catalog + packs + caries→K02 + emitter) is merged on `main` (`3bfc98c`).
Status: design (proceeding under the user's full-permission mandate; the flagged
clinical-coding judgment calls below use defensible WHO defaults and are marked
for the owner's later review — nothing is hidden, every code is in the catalog).

## 1. Goal

Extend the DX-0 layer so **every diagnostic charted finding** (not just caries)
derives its WHO ICD-10 `Condition`, reusing the DX-0 machinery unchanged: grow
`DX_CODES` (the catalog) and `deriveDentalDiagnoses` (the pure derivation), and
the existing `appendDentalConditions` emits them. A tooth may now yield **several**
Conditions (e.g. caries + pulpitis + apical periodontitis on one tooth). No new
UI (the diagnosis picker is DX-2). Data-driven subcodes where the chart already
carries the discriminator (depth, root-vs-crown, arrested); no manual override
needed in DX-1.

## 2. Scope — diagnostic findings only

**In scope (become Conditions):** the diagnostic axes. **Out of scope (procedures /
planning, never ICD diagnoses):** restorationType, restorationMaterial,
fillingMaterial, prosthesis, endo, endoResection, fissureSealing, parapulpalPin,
bridgePillar, crownNeeded, crownReplace, extractionPlan, missingClosed,
contactMesial/Distal. Mobility is a periodontal finding already folded into the
K05 staging (P4b) — not emitted as a standalone Condition.

## 3. The mapping (finding → diagnosis key → WHO ICD-10)

Data-driven subcodes are derived from the fields shown; where a discriminator is
absent the base/unspecified code is used.

| Charted finding (axis) | Diagnosis key | WHO ICD-10 | Notes / data-driven subcode |
|---|---|---|---|
| `caries` (surface set) | caries | **K02** Dental caries | DX-0. Refine by `radiographicDepth`: E1/E2 → **K02.0** (enamel), D1–D3 → **K02.1** (dentine). (K02.0/.1 depth subcode deferred — not shipped; keeps DX-0 caries byte-identical) |
| `rootCaries` active/cavitated | cariesCementum | **K02.2** Caries of cementum | arrested → **K02.3** Arrested dental caries. |
| `pulpDx` reversible/irreversible-pulpitis | pulpitis | **K04.0** Pulpitis | WHO K04.0 covers both; the reversible/irreversible nuance is ICD-10-CM only (K04.01/.02) → belongs to the US pack (DX-5), not the WHO base. |
| `pulpDx` necrosis | pulpNecrosis | **K04.1** Necrosis of pulp | |
| `apicalDx` symptomatic-apical-periodontitis | apicalPeriodontitisAcute | **K04.4** Acute apical periodontitis of pulpal origin | |
| `apicalDx` asymptomatic-apical-periodontitis | apicalPeriodontitisChronic | **K04.5** Chronic apical periodontitis | + `periapicalType` granuloma stays K04.5 (apical granuloma); cyst → **K04.8** Radicular cyst. |
| `apicalDx` acute-apical-abscess | periapicalAbscess | **K04.7** Periapical abscess without sinus | ⚑ *judgment:* acute abscess → without-sinus (K04.7) is the typical acute form. |
| `apicalDx` chronic-apical-abscess | periapicalAbscessSinus | **K04.6** Periapical abscess with sinus | ⚑ *judgment:* chronic abscess → with-sinus (K04.6, the draining form). |
| `apicalDx` condensing-osteitis | condensingOsteitis | **K04.9** Other/unspecified pulp & periapical | ⚑ *judgment:* WHO has no distinct condensing-osteitis code; K04.9 (or a local qualifier). |
| `resorptionType` internal/external-cervical | resorption | **K03.3** Pathological resorption of teeth | |
| `wearEdge` attrition | attrition | **K03.0** Excessive attrition of teeth | |
| `wearEdge`/`wearCervical` erosion | erosion | **K03.2** Erosion of teeth | |
| `wearCervical` abrasion | abrasion | **K03.1** Abrasion of teeth | |
| `wearCervical` abfraction | abfraction | **K03.8** Other specified diseases of hard tissues | ⚑ *judgment:* abfraction has no distinct WHO code; K03.8. |
| `discoloration` fluorosis | fluorosis | **K00.3** Mottled teeth | |
| `discoloration` tetracycline | tetracyclineStain | **K00.8** Other disorders of tooth development | ⚑ *judgment:* intrinsic developmental stain. |
| `discoloration` nonvital/extrinsic/other | postEruptiveColour | **K03.7** Posteruptive colour changes of dental hard tissues | |
| `calculus` | calculus | **K03.6** Deposits (accretions) on teeth | |
| `toothSelection` no-tooth-after-extraction (missing) | toothLoss | **K08.1** Loss of teeth due to accident, extraction or local periodontal disease | |
| `toothSubstrate` radix | retainedRoot | **K08.3** Retained dental root | |
| `brokenMesial`/`brokenIncisal`/`brokenDistal` (fracture) | toothFracture | **K03.81**? / **S02.5** | ⚑ *judgment, needs owner:* WHO "Fracture of tooth" is **S02.5** (Injury chapter, cross-chapter). Options: (a) emit S02.5, (b) K03.8 other-hard-tissue, (c) omit fractures in DX-1. **Default: omit fractures in DX-1**, revisit with the owner. |
| `periImplant` mucositis / peri-implantitis-* | periImplantDisease | *(none in WHO ICD-10)* | ⚑ *judgment, needs owner:* peri-implant diseases post-date ICD-10; WHO has no code. Options: local code only, or T85.x (implant complication, cross-chapter), or K05.x by analogy. **Default: omit in DX-1** (already fully charted via the peri-implant axis + FHIR), revisit. |

## 4. Derivation & emission

- `deriveDentalDiagnoses(payload)` gains one small rule per axis above, each pushing
  a `{ toothNo, key }` (and the data-driven subcode selection). It stays pure and
  dependency-free. Order is deterministic (tooth order, then a fixed axis order).
- `DX_CODES` gains one entry per new diagnosis key (WHO code + display; `snomed?`
  left for DX-6).
- `appendDentalConditions` is unchanged — it already emits one Condition per
  derived diagnosis via `buildConditionCode`, so multiple Conditions per tooth
  and the pack overlay both work for free.
- **Presence gating** (the DX-0 deferred minor): a finding only yields a diagnosis
  on a tooth that can bear it — caries/pulp/apical/wear/resorption/discoloration
  require a present natural tooth; toothLoss requires the missing state; etc. The
  derivation consults `toothSelection`/`toothSubstrate` so a stale finding on an
  absent tooth is not emitted.

## 5. Byte-identity & goldens

Additive only — each new finding adds Conditions to the FHIR bundle. The
**FHIR bundle golden (`fhir-golden.json`) will be regenerated** (as in DX-0) and
the diff verified to be **only added K0x Conditions** on the fixtures that carry
those findings. The SVG-fingerprint, shell-DOM and **roundtrip payload** goldens
stay byte-identical (Conditions are not parsed back). The perio K05 path is
untouched. No payload/version change (still no `dxOverrides`; overrides are DX-2).

## 6. Verification

`tsc` clean, `eslint` 0 errors, full suite green. New unit tests: each mapping
rule (finding → expected K-code, incl. the data-driven subcodes and presence
gating) in `src/dx/__tests__/derive.test.ts` + a bundle-level test per family in
`src/__tests__/dx-conditions.test.ts`. The regenerated `fhir-golden.json` diff is
reviewed to be additive-Conditions-only.

## 7. Flagged decisions for the owner (defaults chosen; adjust anytime)

1. Tooth **fracture** → **omitted in DX-1** (WHO code is S02.5, injury chapter). Prefer S02.5, K03.8, or keep omitted?
2. **Peri-implant** disease → **omitted in DX-1** (no WHO ICD-10 code). Local code, T85.x, or keep omitted?
3. Acute/chronic **apical abscess** → K04.7 / K04.6 (without/with sinus). Confirm the acute↔without, chronic↔with mapping.
4. **Condensing osteitis** → K04.9. Acceptable, or a local qualifier?
5. **Reversible vs irreversible pulpitis** both → K04.0 in the WHO base (the split is ICD-10-CM, deferred to the US pack DX-5). Confirm.

## 8. Out of scope

Diagnosis picker/override UI (DX-2); regional/case conditions K07/K09/K11/K12 (DX-3);
national packs beyond BNO-10 (DX-4/DX-5); SNOMED (DX-6); FHIR import (DX-7).
