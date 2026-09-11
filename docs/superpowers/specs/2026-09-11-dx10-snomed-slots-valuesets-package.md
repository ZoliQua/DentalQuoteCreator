# DX-10 — SNOMED CT slots, ValueSets + FHIR package, typed `case` payload

Date: 2026-09-11 · Repo: React Advanced Odontogram engine · Parts C and D of the "deepen interoperability" arc (A = DX-8 code specificity, B = DX-9 perio import / external Conditions — both done).

## 1. Goal
Finish the terminology side of the FHIR export: give every diagnosis key a verified SNOMED CT concept so the opt-in SNOMED overlay covers the whole catalog; publish ValueSets alongside the CodeSystem and make the repository's `fhir/` folder a loadable FHIR NPM package; and remove the last untyped casts around the `case` payload block.

## 2. SNOMED CT slots (part C-i)
- **Method.** For each of the 50 unset slots (22 tooth-level, 28 case-level) candidates were searched on the CSIRO Ontoserver (SNOMED CT, disease / clinical-finding hierarchies); the chosen concept was then verified by `$lookup` to be active, in the SNOMED CT International core module (900000000000207008) and to carry the expected FSN. A test re-checks every id's Verhoeff check digit and its International partition ("00") and forbids duplicates.
- **Choices worth noting.** `periapicalAbscess` (derived from the AAE value *acute apical abscess*) → 109602002 Acute apical abscess; `periapicalAbscessSinus` (WHO "with sinus") → 74598008 Periapical abscess with sinus tract; `toothLoss` (per-tooth Condition) → 109674000 Acquired absence of single tooth; `oralMucositis` (WHO title "(ulcerative)") → 450005 Ulcerative stomatitis; `recurrentAphthae` → 722781002 Recurrent aphthous stomatitis. Slightly broader than the ICD title, documented in code: `odontogenicCyst` → 235110008 Odontogenic cyst (K09.0 is the developmental subset), `hereditaryStructure` → 1148766007 Hereditary disorder of tooth (K00.5 is the structural subset).
- **Deliberate gaps (2).** `jawSizeAnomaly` (K07.0) and `dentofacialFunctional` (K07.5) stay unset: SNOMED International has only US-extension or narrower inclusion concepts (e.g. *Maxillary/Mandibular jaw size anomaly*, *Abnormal jaw closure*), and a wrong concept is worse than none. Result: 48/50 filled; the overlay stays opt-in, so default exports and all goldens are unchanged.

## 3. ValueSets + FHIR package (part C-ii)
- `src/fhir/valueSetResources.ts`: one **explicit** ValueSet per `LOCAL_VALUE_MAPS` group (the bare value codes are shared across groups, so a group cannot be a CodeSystem filter; each lists its codes with the display that group uses — a designation on the merged concept), a **finding-type** ValueSet (registry findings + the hand-emitted finding types), and an **intensional all-codes** ValueSet. `buildFhirPackageFiles()` yields the whole `fhir/` folder: the CodeSystem, the ValueSets, a FHIR NPM `package.json` (`react-advanced-odontogram.fhir`, type Conformance, FHIR 4.0.1, canonical = the engine's FHIR base) and `.index.json`.
- `npm run fhir:codesystem` regenerates everything; tests prove freshness of every committed file, manifest/index consistency, that each ValueSet concept is a CodeSystem concept with a matching display, that the group ValueSets cover the value maps exactly and the finding ValueSet covers every registry finding. ValueSets are not embedded in the export Bundle (the CodeSystem alone resolves the codes); they serve bindings/IG use.

## 4. Typed `case` payload (part D)
`OdontogramExportPayload.case` declares `caseConditions`; the importer builds the case block as that type and the case-Condition builder reads `payload.case` without a cast.

## 5. Verification
`tsc`/`eslint` clean, full suite green; the committed `fhir/CodeSystem-odontogram.json` is byte-identical (SNOMED codes are not local codes); FHIR/roundtrip/SVG/shell-DOM goldens byte-identical (SNOMED overlay off by default; ValueSets not exported). Payload 2.22 unchanged.

## 6. Out of scope
A hosted canonical (GitHub Pages) for the package; SNOMED depth/severity concepts for the DX-8 refinements; README documentation of the interop arc (batched into the next release's docs pass).
