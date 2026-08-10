# Broadsheet & Rapier — Thornwall Engine

This project is an interactive 2D point-and-click web simulation set in a 17th-century swashbuckler fantasy world. Narrative and atmosphere are inspired by *Garrett P.I.*, *Fafhrd and the Gray Mouser*, and *Notre-Dame de Paris* (full priority hierarchy in `docs/narrative-inspirations.md`). UI and interaction loop are inspired separately by *Princess Trainer* — see below.

## 1. Operating Directives
- **Primary Goal:** Maintain a lightweight, modular, data-driven web simulation hosted on GitHub Pages.
- **Tech Stack Boundary:** React (v18+), Pure TypeScript (Strict Mode), Vite, Tailwind CSS, Zustand, Framer Motion, Lucide-React, Vitest, and Zod. DO NOT use plain JavaScript or introduce heavy 3D frameworks.
- **Lore & Narrative Priority:** All world content, dialogue, and NPCs MUST follow the priority hierarchy established in `@docs/narrative-inspirations.md` and adhere strictly to `@docs/world-lore.md`.
- **UI & Interaction Loop Inspiration:** Princess Trainer — clean location navigation, time-slot scheduling, stat-dependent action menus, and modal minigame overlays. This governs interaction/UI structure only, never narrative tone or content.
- **Game Design Rules:** Engine-agnostic domain rules (world clock, currency, content model, faction/reputation, minigame concepts) MUST strictly follow `@docs/game-design-spec.md`.
- **Web Implementation Rules:** How those rules are implemented in this stack (types, schemas, persistence, directory structure, asset handling) MUST strictly follow `@docs/web-implementation.md`.
- **Do not invent domain rules.** If a task requires a rule not present in `@docs/game-design-spec.md` or `@docs/web-implementation.md` — e.g. minigame resolution mechanics, reputation effect thresholds, economy pricing — STOP and flag the gap instead of assuming an answer. These are documented as open gaps in `@docs/game-design-spec.md`.

## 2. Scope Boundary — Technical Scaffold vs. Gameplay

`docs/execution-plan.md` currently defines **Phase 0: Technical Scaffold** only — proving the architecture works end-to-end with one inert vertical slice of content (loads, validates, renders). It does not yet define minigame mechanics, reputation effects, or economy balance. Do not implement gameplay systems beyond what's explicitly specified; flag what's missing instead.

## 3. Directory Structure Blueprint
- `docs/`: Lore, game design spec, web implementation spec, execution plan, decision log, and AI guidance files.
- `src/engine/`: Core application code (React UI components, state store, event handlers, and minigame runners). Generic and decoupled from narrative content — never imports from `src/content/` directly as hardcoded data.
- `src/content/`: Pure JSON data files, categorized by node type: `settlements/`, `districts/`, `pois/`, `actors/`, `factions/`, `endeavors/`.
- `src/content/schemas/`: Zod schemas validating each content type.
- `src/__tests__/`: Vitest test suites for store commands, Zod schema validations, and minigame runners.

## 4. Spec-Driven Development & Safety Rules
- **Spec First:** Always check `@docs/game-design-spec.md` and `@docs/web-implementation.md` before writing logic or generating content.
- **Data Validation:** All JSON generated under `src/content/` MUST be validated against corresponding Zod schemas.
- **Tests Are Sacred:** NEVER delete existing tests in `src/__tests__/`. If a test fails after code changes, fix the implementation until `npm run test` passes.
- **Strict Boundary:** NEVER modify core engine code under `src/engine/` when instructed to add narrative content or JSON files, unless explicitly asked to build a new engine component or minigame runner.
- **Process:** Follow `CONTRIBUTING.md` for commit conventions, branching, and code standards. Log decisions with real design rationale in `docs/decisions.md`, not just what changed.
