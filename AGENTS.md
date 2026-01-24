# Repository Guidelines

## Project Structure & Module Organization
The Vite + React + TypeScript app lives in `src/`, with routing defined in `src/App.tsx` and bootstrapped through `src/main.tsx`. Feature UI is grouped under `src/pages`, reusable widgets live in `src/components`, and shared helpers stay in `src/utils`, `src/hooks`, and `src/context`. Static configuration such as procedure catalogs or i18n strings is stored in `src/data` and `src/i18n`. Assets that must be served as-is belong in `public/`. Built artifacts are emitted to `dist/`; never edit files there manually.

## Build, Test, and Development Commands
Run `npm install` once to sync dependencies. `npm run dev` starts the Vite dev server with hot reload at `http://localhost:5173`. `npm run build` performs a TypeScript project build (`tsc -b`) and then bundles for production. `npm run preview` serves the latest build so reviewers can verify optimized assets. `npm run lint` executes ESLint with the repo presets; fix issues before committing.

## Coding Style & Naming Conventions
Stick to TypeScript, JSX, and Tailwind utility classes. Components, pages, and contexts use PascalCase filenames (e.g., `QuoteEditorPage.tsx`), hooks use the `useFoo` prefix, and repository modules live under `src/repositories` using descriptive nouns. Follow the existing two-space indentation and favor explicit typing for props and form models. Keep side effects in hooks or context providers, not in components. Run `npm run lint -- --fix` for minor formatting problems.

## Testing Guidelines
Automated tests are not yet wired up; when adding them, colocate `*.test.tsx` files beside the component or hook and ensure they can run headlessly. Until then, verify new work manually via `npm run dev`, exercising patient flows, quote creation, and PDF export. Document any repro steps for tricky scenarios inside pull requests.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit messages (e.g., `Add patient storage repo`). Keep commits scoped to a single concern and reference tickets when applicable. Pull requests should include: summary of intent, screenshots or GIFs for UI-facing updates, instructions for validating the change, and notes on data migrations or sample JSON structures. Seek at least one review for flow-level changes before merging.
