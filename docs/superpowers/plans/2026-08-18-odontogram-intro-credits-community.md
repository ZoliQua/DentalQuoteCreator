# Odontogram: Intro rework + Credits popup + community files

Date: 2026-08-18
Repo: React Advanced Odontogram engine (`src/modules/odontogram/engine`)
Standing constraints: commit only in the user's name (no Claude trailer); exclude
`tsconfig.tsbuildinfo`; classic goldens byte-identical; never credit Claude.

## Goal

Five deliverables, grouped into three implementation stages.

1. Fix + extend the introductory guided tour (`src/tour.ts`).
2. New Credits popup + toolbar icon (+ a small GitHub-star toolbar icon).
3. English community files: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`.
4. Credits section text into every language README (not the main English README).
5. Standing memory rule: keep every new contributor in all Credits surfaces; never
   credit Claude. (Done — `odontogram-credits-policy` memory.)

## Decisions (confirmed with the user)

- Intro button icon: **play-in-circle** (▶), replacing the plain info "i".
- Perio tour steps: **active** — the tour drives the app into the periodontal view,
  highlights 1-2 perio things, then returns to the odontogram; it **skips** the perio
  steps when the perio chart is disabled in Settings (`.perio-launch-bar.hidden`).
- Credits contributors: **GitHub handles as clickable links** to each profile.
- Credits prose: natural voice, **no dashes/hyphens**, never mentions Claude.

## Stage 1 — Intro tour (`src/tour.ts` + topbar + i18n)

Three confirmed bugs:

- **Step 6 dead target.** `#crownSelect` does not exist; the control is
  `#restorationSelect` (`ToothDetailsCard.tsx:130`). Retarget.
- **Step 9 mistarget.** "Numbering & language" points at `.topbar-actions` (whole bar),
  but numbering moved to Settings (`SettingsModal.tsx:153/470`) and only the language
  switcher is in the header. Split into a Language step (language switcher) and a
  Settings step (where numbering now lives); reword the text.
- **Arrow keys dead.** `render()` calls `cleanup()` (line 45) which removes the key
  handler and nulls it (line 34), so arrows die after the first render. Split teardown:
  `clearEls()` (overlay DOM only, used by re-render) vs `cleanup()` (also unbinds keys,
  used by Skip/Finish/Escape).

New capability: optional per-step `onEnter`/`onLeave` hooks so a step can switch the app
view before its highlight and restore it after. Perio steps use these; they no-op and are
skipped when `#appViewToggle` is absent (perio disabled).

New step list (12 -> 16), all targets verified to exist:

1 `#toothGrid` select · 2 `#cariesSection` · 3 `#pulpEndoSelect` pulp ·
**4 `#rootPeriodontiumSection` root canal (NEW)** · 5 `#toothSelect` implant ·
6 `#fillingSection` · **7 `#restorationSelect` crown (FIX)** · 8 `#toothGrid` note ·
9 `#controlsActions` selection filters · 10 language switcher (`#languageMenu`, id added) ·
**11 Settings button, numbering (FIX)** · **12 `#appViewToggle` perio view (NEW, onEnter
switches in)** · **13 perio chart element (NEW, onLeave switches back)** ·
14 `#btnExportMenu` · 15 `#btnImportMenu` · 16 done (center).

Topbar: add `id="languageMenu"` to the language dropdown; swap the Intro button icon to
play-in-circle. i18n: add/reword `intro.step*` keys across all 12 languages (HU authored
first per convention, then the rest).

Tests: every tour selector resolves in the rendered shell; the key handler survives a
re-render (arrow stepping); perio steps skip when perio unavailable.

## Stage 2 — Credits popup + toolbar icons (`src/CreditsModal.tsx` + context + topbar + i18n)

New `CreditsModal.tsx` following the `DualStateConfirm`/`SettingsModal` dialog contract
(focus trap, Escape, backdrop click-out, `role="dialog"` + `aria-modal`). Sections:

- Short program intro paragraph (natural voice, no dashes).
- Contributors: handle links to `https://github.com/<handle>` + what each contributed.
  @ZoliQua (creator/lead), @odontodev (#14/#19/#15), @JulianoBazzi (pt-BR #9),
  @yassine-bhn (fr #13, anatomy packaging #22), @saegerdirk-star / cognovis (measured
  anatomy + generator #18, composable UI proposal #20). Never Claude.
- External libraries: jsPDF (PDF), DOMPurify (sanitizing); built on React, Vite,
  TypeScript, Tailwind.
- "Contributions welcome, open a PR" line to the repo.
- Star-on-GitHub badge at the bottom (inline star, links to the repo).

Context: add `creditsOpen` flag + setter to `OdontogramContext`. Topbar: a Credits button
right after the Import group (plain action button, `aria-haspopup="dialog"`), plus a small
GitHub-star icon linking to the repo. Mount `<CreditsModal>` in `App.tsx` beside the other
modals. i18n: `credits.*` keys across all 12 languages.

Tests: modal opens/closes via the flag; focus trap + Escape; renders the contributor
profile links and the repo link.

## Stage 3 — Community files + README Credits + CHANGELOG

- `CODE_OF_CONDUCT.md` (Contributor Covenant tone, plain English, natural voice).
- `CONTRIBUTING.md` (how to build/test, PR expectations, that contributors get credited).
- `SECURITY.md` (supported versions, private disclosure contact, response expectation).
- Credits section text appended to each `lang/README-*.md` (11 files) + the Spanish half
  of `README.md`. NOT the English main README body.
- `CHANGELOG.md` `[Unreleased]`: intro rework, Credits popup, community files. No version
  bump / release until the user asks (folds in with the other `[Unreleased]` items).

## Verification (every stage)

`npx tsc -b --noEmit` clean; `npx vitest run` green; `npx eslint .` 0 errors; parity +
shell-DOM + FHIR + roundtrip goldens byte-identical (this is UI/docs only, no
payload/render/FHIR change); manual browser check of the tour and the Credits popup.

## Out of scope

Version bump / npm release; any change to clinical/render/payload/FHIR behavior; the
newer 46-asset anatomy re-integration (tracked separately).
