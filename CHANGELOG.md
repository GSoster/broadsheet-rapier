# Changelog

All notable changes to this project will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Vitest test runner wired up; core engine types (`PlayerState`, `StateCommand`, `MinigameLauncherPayload`, etc.) in `src/engine/types/index.ts`.
- Zod content schemas for Settlement, District, POI, Actor, Faction, and Endeavor.
- Zustand player store (`src/engine/store/`), CQRS-style: UI dispatches `StateCommand`s, pure command handlers in `commands.ts`, an in-memory (non-persisted) event log.
- Starter content vertical slice: Valdeombra, the Lantern Ward, the Crooked Hour tavern, Mara Venn, the City Watch faction, and "The Missing Broadsheet" endeavor.
- UI shell: `WorldClockHud`, `WorldNavigationView`, `NodeInteractionCanvas`, `ManagementDrawer`, `AssetFallback`, `MinigameOverlay`, composed in `App.tsx`.
- Dice minigame: 2d6 even/odd resolution, wager stepper (5–100 bronze), tabletop dice UI with a roll animation, wired into a "Gamble" action at the tavern.
- Mara Venn reputation loop: +5 reputation per conversation, auto-starts "The Missing Broadsheet" endeavor on first talk, unlocks a new dialogue line and auto-advances the endeavor phase at 10 reputation, "Pay off the buyer" action to spend 1 silver at the final phase.
- `faction_wagering_ring` content (Mara Venn's actual affiliation).
- `COMMAND_CANCEL_MINIGAME` and a "Leave" button on the Dice minigame, so it can be exited without forcing a win/lose outcome.
- `npm start`: installs dependencies, starts the dev server, and opens the game in the browser at the correct base-prefixed URL.
- `.nvmrc` and `package.json` `engines` field so local and CI Node versions can't silently drift apart.
- `content-integrity.test.ts`: every file under `src/content/` is automatically validated against its schema, so new content needs no test changes to be covered.
- `verify-phase` and `ui-visual-check` project skills (`.claude/skills/`) codifying this repo's per-phase Definition of Done and occasional real-browser verification pattern.

### Changed
- `COMMAND_ADJUST_CURRENCY` now borrows down (silver/gold break into bronze on a loss) and enforces a hard zero floor, not just carry-up on gains.
- Mara Venn's faction corrected from `faction_city_watch` to `faction_wagering_ring`; title and description updated to match ("Wagering Ring Regular").
- Player now starts with a small currency purse (50 bronze-equivalent) instead of zero, so the gambling loop is reachable from a fresh save.

### Fixed
- CI pinned to Node 20 while local development used Node 24, causing jsdom's `undici` dependency to fail only in CI (`markAsUncloneable` missing pre-v21). CI bumped to Node 24, then centralized into `.nvmrc` as the single source of truth.
- The Dice minigame modal had no way to close once opened if the player couldn't afford the minimum wager — no cancel, only a disabled "Throw."
