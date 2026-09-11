# DX-8 — Data-driven ICD code specificity (caries depth/surface, periodontitis severity/extent)

Date: 2026-09-11 · Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`) · Follows 2.5.0.
Part A of the "deepen interoperability" arc (B: FHIR import generalisation + perio import; C: ValueSets/FHIR package + SNOMED slots; D: `case` payload type).

## 1. Goal
The exported ICD codes are flat per diagnosis key (`caries` → K02, `periodontitis` → K05.3, ICD-10-CM `caries` → K02.9, `periodontitis` → K05.30) although the chart already holds the data that ICD wants: per-surface radiographic depth and ICDAS severity, and the 2017 stage/extent. Refine the codes from that data — in the FHIR export, in the national packs, and in the Diagnoses card/tooltip — without changing the payload, the derivation keys, or the round-trip.

## 2. Decisions (locked with the owner)
- **Depth source:** radiographic depth first (`E1`/`E2` → enamel, `D1`/`D2`/`D3` → dentine); when a surface has none, fall back to ICDAS severity (`1–3` → enamel, `4–6` → dentine; `0`/absent → unknown). Neither → no refinement (WHO stays `K02`, CM stays `K02.9`).
- **Cardinality:** ONE Condition per tooth (unchanged model). The code reflects the **most severe** involvement across the tooth's carious surfaces (dentine > enamel > unknown); among surfaces tied at that depth, a pit-and-fissure (occlusal) surface wins the CM surface type.
- Decided technically: CM surface type = `occlusal` → pit-and-fissure (K02.5x), every other surface (mesial/distal/buccal/lingual/subcrown) → smooth (K02.6x). No `x3` (pulp) variant — the chart carries no per-surface pulp-exposure evidence; WHO `K02.5` (pulp exposure) is likewise not emitted. Perio CM: extent `localized`→`K05.31x`, `generalized`→`K05.32x`, `molar-incisor` (a distribution pattern CM does not have) → treated as localized, `na` → `K05.30`; severity stage `I`→1 slight, `II`→2 moderate, `III`/`IV`→3 severe, `na`/`indeterminate` → 9 unspecified severity. WHO and BNO-10 keep `K05.3` (the NEAK törzs has no 5-character K05.3 subcodes).

## 3. Code titles (verbatim, sources)
- WHO ICD-10 2019 (icd.who.int): `K02.0` Caries limited to enamel · `K02.1` Caries of dentine.
- BNO-10 (NEAK `BNOX_3_4.DBF`): `K02.0` A zománcra korlátozódó szuvasodás · `K02.1` A dentin szuvasodása.
- ICD-10-CM (NLM Clinical Tables): `K02.51` Dental caries on pit and fissure surface limited to enamel · `K02.52` … penetrating into dentin · `K02.61` Dental caries on smooth surface limited to enamel · `K02.62` … penetrating into dentin · `K02.9` Dental caries, unspecified · `K05.30` Chronic periodontitis, unspecified · `K05.311/.312/.313/.319` Chronic periodontitis, localized, slight/moderate/severe/unspecified severity · `K05.321/.322/.323/.329` … generalized, slight/moderate/severe/unspecified severity.

## 4. Design
### 4.1 Derivation carries a detail (`src/dx/derive.ts`)
`DerivedDiagnosis` gains `detail?: CariesDetail` (only on `caries`): `{ depth: "enamel" | "dentine" | null; surface: "pit-fissure" | "smooth" | null }`, computed by a pure `deriveCariesDetail(rec)` per §2 from `rec.caries` (ids `caries-<surface>`), `rec.radiographicDepth` and `rec.cariesSeverity`. Keys are untouched; `applyDxOverrides` untouched.

### 4.2 Refinement tables (`src/dx/refine.ts`, new, pure)
`refineWho(key, detail)` → `{ code, display }`: `caries` + depth → K02.0/K02.1 with the WHO titles, else the flat `DX_CODES` entry. `refineCm(key, detail)` → `{ code, display } | null`: caries surface×depth → K02.51/.52/.61/.62; `periodontitis` + `{stage, extent}` → K05.3xx; `null` when there is nothing to refine (caller falls back to the pack's flat code). `PerioDetail = { stage, extent }` (types from `perioClassification.ts`).

### 4.3 Packs (`src/dx/packs.ts`)
`CodingPack.refinedDisplays?: Record<string, string>` — translation-pack displays keyed by the REFINED code (`BNO10_PACK.refinedDisplays = { "K02.0": …, "K02.1": … }`). `packCoding(pack, key, baseCode, baseDisplay, detail?)`: modification → `refineCm(key, detail) ?? pack.codes[key]`; translation → `{ code: baseCode, display: pack.refinedDisplays?.[baseCode] ?? pack.displays?.[key] ?? baseDisplay }` (`baseCode` is already the refined WHO code).

### 4.4 FHIR export
`buildConditionCode(key, pack?, snomed?, detail?)` (`toFhirDx.ts`) uses `refineWho` for the base coding and `text`, passes `detail` to `packCoding`; the SNOMED coding keeps the base concept (80967001 Dental caries) — SNOMED depth concepts are out of scope. `appendDentalConditions` passes `d.detail`. `appendPerioCondition` (`toFhirPerio.ts`) passes `{ stage: final.stage, extent: final.extent }` for `periodontitis`. Condition ids are unchanged (`odontogram-dx-caries-<tooth>`).

### 4.5 UI (`odontogram.ts`)
`getToothDiagnoses` and `getActiveDiagnoses` rows take `icd10`/`icd10Display` from `refineWho(key, detail)`, so the card, tooltip and summary show `K02.1 Caries of dentine`; `addableKeys` keep the flat catalog codes.

### 4.6 Import (`importConditions.ts`)
The WHO-code fallback gains a **category prefix** step: an unknown code falls back to its 3-character category (`K02.1` → `K02` → `caries`; `K05.3xx` is never imported here — perio import is part B). Exact matches (`K02.2`, `K02.3`) keep winning.

## 5. Verification
`tsc`/`eslint` clean, full suite green. Tests: derive detail rules (radiograph precedence over ICDAS, ICDAS fallback, 0/absent → unknown, most-severe across surfaces, occlusal tie-break, subcrown = smooth); `refineWho`/`refineCm` tables with every title verbatim (§3); `packCoding` translation refinedDisplays + modification fallback; end-to-end export (WHO K02.1 + BNO display + CM K02.52; perio CM K05.312 for stage II generalized, K05.30 for extent na); Diagnoses card/`getToothDiagnoses` show the refined code; import round-trip of `K02.1` → `caries` (roundtrip golden byte-identical). **FHIR golden changes intentionally in exactly one place** — the `branches` fixture's tooth 11 (`caries-occlusal`, ICDAS 4 → dentine) Condition: `K02 Dental caries` → `K02.1 Caries of dentine`; the re-freeze is accompanied by a structural proof that this coding/text is the ONLY delta. SVG-fingerprint, shell-DOM and roundtrip goldens unchanged; CodeSystem unchanged (no local codes involved). Payload stays 2.22.

## 6. Out of scope
Pulp-exposure codes (WHO K02.5, CM K02.x3); SNOMED depth concepts; perio FHIR import (part B); README bullets (batched with the interop docs pass at the next release).
