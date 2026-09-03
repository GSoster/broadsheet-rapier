# Execution Plan — Thornwall Engine / Broadsheet & Rapier

Status: **Phase 0 (Technical Scaffold) complete — all six phases below shipped.** This document is now a historical record of that scaffold, not the live process. All work since has gone, and all future work goes, through `docs/feature-workflow.md`'s stage sequence (spec under `docs/features/` → `design-review` → implementation → Definition of Done); `docs/features/README.md` is the current index of what's shipped.

## Scope: This Was Phase 0 — Technical Scaffold Only

The objective of everything below was to prove the architecture works end-to-end: types compile, schemas validate, the store dispatches commands correctly, one vertical slice of content loads and renders, tests pass. It deliberately did **not** include actual gameplay mechanics — minigame resolution, reputation effects, economy balance — at the time it was written. Those have since been resolved incrementally through `docs/feature-workflow.md` specs (dice minigame, rapier duel, branching dialogue, the modifier system, and others — see `docs/features/README.md`); genuinely undocumented domain rules (economy pricing, reputation-tier thresholds) remain open gaps tracked in `docs/game-design-spec.md`, not implicitly resolved by this document.

Repo: https://github.com/GSoster/broadsheet-rapier
GitHub Pages base path: `/broadsheet-rapier/` (set in `vite.config.ts`)

Reference docs: `docs/game-design-spec.md` (what the game is), `docs/web-implementation.md` (how it's built in this stack), `docs/world-lore.md` and `docs/narrative-inspirations.md` (tone/content), `CONTRIBUTING.md` (process rules), `docs/decisions.md` (why past calls were made), `docs/feature-workflow.md` (the live process for all work past this scaffold).

## Directory Structure

See `docs/web-implementation.md` §7 for the full tree — do not duplicate it here; if it changes, update it there only.

## Phase 1 — Test Runner Setup & Engine Types (Complete)

**1a. Test runner setup.** Vitest is installed but not wired up. Add a `test` script to `package.json` (`"test": "vitest run"`, plus optionally `"test:watch": "vitest"`), and a minimal Vitest config (either `vitest.config.ts` or a `test` block in `vite.config.ts`) so `npm run test` runs cleanly against a placeholder test. This only needs to prove the runner works — actual test suites are Phase 5.

**1b. Engine types.** `src/engine/types/index.ts`, exactly as specified in `docs/web-implementation.md` §4: `PlayerState`, `CommandType`, `StateCommand`, `MinigameType`, `MinigameLauncherPayload`, plus a `PlayerStateSchema` (Zod, for save import validation per §6).

`COMMAND_NEXT_DAY` is internal-only — see `web-implementation.md` §4.

## Phase 2 — Zod Content Schemas (Complete)

`src/content/schemas/`, exactly as specified in `docs/web-implementation.md` §5. Territory schema stays out — deferred per `docs/game-design-spec.md` §2.

## Phase 3 — Zustand Store (CQRS-inspired) (Complete)

`src/engine/store/playerStore.ts`, per `docs/web-implementation.md` §3 and §6. UI never mutates state directly — only via `dispatchCommand(command)`.

## Phase 4 — Starter Content (vertical slice) (Complete)

- `settlement_valdeombra_city.json`
- `district_lantern_ward.json`
- `poi_crooked_hour_tavern.json`
- `actor_mara_venn.json` — `factionIds: ["faction_city_watch"]`
- `faction_city_watch.json`
- `endeavor_the_missing_broadsheet.json`

This slice existed to prove the schema/store/render pipeline works — it was not required to be a complete or balanced piece of gameplay. Its narrative tone still followed `docs/narrative-inspirations.md`. It has since been followed by a second, full-scale Endeavor ("A Debt in Steel") and further real content — see `docs/features/README.md`.

## Phase 5 — Vitest Suites (Complete)

Most command/store logic is now tested as it's introduced, per the
updated Definition of Done in CONTRIBUTING.md (see docs/decisions.md).
Phase 3's retroactive gap is closed separately, before this phase
starts. This phase covers what isn't naturally covered elsewhere:

- `schemas.test.ts` — valid/invalid fixture parsing per schema.
- `playerStore.test.ts` — anything not already covered by
  `commands.test.ts`: initial state shape, save export/import
  (including rejection of an invalid/corrupted file per
  `web-implementation.md` §6).
- `commands.test.ts` — audit only at this point, not first-write:
  confirm every `CommandType` has coverage from when it was
  introduced; fill in any handler that's still untested.
- `minigames.test.ts` — tests the plumbing contract only (payload
  dispatch on resolve), not mechanic correctness, since mechanics
  weren't specified yet at this phase.

Existing tests are never deleted or weakened (`CONTRIBUTING.md`); new
coverage is additive only.

(Test runner itself was already configured from Phase 1 — this phase
was only about writing the remaining suites.)

## Phase 6 — UI Components (Complete)

- **App shell**: fixed `WorldClockHud` (top bar), always visible — day/shift/season/weather/currencies + advance-shift button.
- **Main viewport**: `WorldNavigationView` (default) or `NodeInteractionCanvas` (POI/Actor selected) — single-viewport swap, not split-pane.
- **ManagementDrawer**: slide-in panel, tabbed — Clues/Case Board, Endeavors, Inventory.
- **AssetFallback**: shared wrapper for every image/audio reference, per `docs/web-implementation.md` §8.
- Minigames render as a full-screen modal overlay via `COMMAND_START_MINIGAME`, return to previous viewport on resolve. UI at this phase only needed to render the overlay shell and dispatch resolve — not implement mechanic logic.

## What Happened After Phase 6

Every unit of work since Phase 6 — the dice minigame, rapier duel, branching dialogue, the notification and audio systems, entry-effect triggers, node-unlock rendering, the modifier system, localization, and the "The Missing Broadsheet" / "A Debt in Steel" content phases — was scoped, specced, and shipped through `docs/feature-workflow.md`, not through a numbered phase in this file. That process (not this document) is what governs all current and future work. See `docs/features/README.md` for the full list of what's shipped and `CHANGELOG.md`/`docs/decisions.md` for the detailed history.

## Working Agreement

See `CONTRIBUTING.md` for commit conventions, branching, and code standards — not duplicated here. This section is kept for historical context on how the six phases above were run:

- One phase per session/review — don't jump ahead.
- Every content file must validate against its Zod schema before being considered done.
- If a task isn't covered by `docs/game-design-spec.md` or `docs/web-implementation.md`, stop and flag the gap.
- Log design decisions (not just changes) in `docs/decisions.md` as they're made.

These same principles (schema validation, stop-and-flag on undocumented rules, logged decisions) still apply — they're now enforced via `docs/feature-workflow.md` and the `verify-phase` skill instead of phase-by-phase review of this file.
