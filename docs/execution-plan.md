# Execution Plan — Thornwall Engine / Broadsheet & Rapier

Status: scaffold complete (Vite + React + TS + Tailwind v4 + Zustand + Zod + Vitest installed). Implementation not yet started.

## Scope: This Is Phase 0 — Technical Scaffold Only

The objective of everything below is to prove the architecture works end-to-end: types compile, schemas validate, the store dispatches commands correctly, one vertical slice of content loads and renders, tests pass. It deliberately does **not** include actual gameplay mechanics — minigame resolution, reputation effects, economy balance. Those are open design gaps listed in `docs/game-design-spec.md` and require their own spec before implementation continues past this phase. If a task here seems to require inventing a game-balance number or a mechanic, stop and flag it rather than deciding it.

Repo: https://github.com/GSoster/broadsheet-rapier
GitHub Pages base path: `/broadsheet-rapier/` (set in `vite.config.ts`)

Reference docs: `docs/game-design-spec.md` (what the game is), `docs/web-implementation.md` (how it's built in this stack), `docs/world-lore.md` and `docs/narrative-inspirations.md` (tone/content), `CONTRIBUTING.md` (process rules), `docs/decisions.md` (why past calls were made).

## Directory Structure

See `docs/web-implementation.md` §7 for the full tree — do not duplicate it here; if it changes, update it there only.

## Phase 1 — Test Runner Setup & Engine Types

**1a. Test runner setup.** Vitest is installed but not wired up. Add a `test` script to `package.json` (`"test": "vitest run"`, plus optionally `"test:watch": "vitest"`), and a minimal Vitest config (either `vitest.config.ts` or a `test` block in `vite.config.ts`) so `npm run test` runs cleanly against a placeholder test. This only needs to prove the runner works — actual test suites are Phase 5.

**1b. Engine types.** `src/engine/types/index.ts`, exactly as specified in `docs/web-implementation.md` §4: `PlayerState`, `CommandType`, `StateCommand`, `MinigameType`, `MinigameLauncherPayload`, plus a `PlayerStateSchema` (Zod, for save import validation per §6).

`COMMAND_NEXT_DAY` is internal-only — see `web-implementation.md` §4.

## Phase 2 — Zod Content Schemas

`src/content/schemas/`, exactly as specified in `docs/web-implementation.md` §5. Territory schema stays out — deferred per `docs/game-design-spec.md` §2.

## Phase 3 — Zustand Store (CQRS-inspired)

`src/engine/store/playerStore.ts`, per `docs/web-implementation.md` §3 and §6. UI never mutates state directly — only via `dispatchCommand(command)`.

## Phase 4 — Starter Content (vertical slice)

- `settlement_valdeombra_city.json`
- `district_lantern_ward.json`
- `poi_crooked_hour_tavern.json`
- `actor_mara_venn.json` — `factionIds: ["faction_city_watch"]`
- `faction_city_watch.json`
- `endeavor_the_missing_broadsheet.json`

This slice exists to prove the schema/store/render pipeline works — it is not required to be a complete or balanced piece of gameplay. Its narrative tone still follows `docs/narrative-inspirations.md`.

## Phase 5 — Vitest Suites

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
  aren't specified yet.

Existing tests are never deleted or weakened (`CONTRIBUTING.md`); new
coverage is additive only.

(Test runner itself is already configured from Phase 1 — this phase
is only about writing the remaining suites.)

## Phase 6 — UI Components

- **App shell**: fixed `WorldClockHud` (top bar), always visible — day/shift/season/weather/currencies + advance-shift button.
- **Main viewport**: `WorldNavigationView` (default) or `NodeInteractionCanvas` (POI/Actor selected) — single-viewport swap, not split-pane.
- **ManagementDrawer**: slide-in panel, tabbed — Clues/Case Board, Endeavors, Inventory.
- **AssetFallback**: shared wrapper for every image/audio reference, per `docs/web-implementation.md` §8.
- Minigames render as a full-screen modal overlay via `COMMAND_START_MINIGAME`, return to previous viewport on resolve. UI at this phase only needs to render the overlay shell and dispatch resolve — not implement mechanic logic.

## Working Agreement

See `CONTRIBUTING.md` for commit conventions, branching, and code standards — not duplicated here. Key points specific to this plan:

- One phase per session/review — don't jump ahead.
- Every content file must validate against its Zod schema before being considered done.
- If a task isn't covered by `docs/game-design-spec.md` or `docs/web-implementation.md`, stop and flag the gap.
- Log design decisions (not just changes) in `docs/decisions.md` as they're made.
