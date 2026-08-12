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
- Sound-effect system: a shared, deliberately fail-silent `playSound` utility (`src/engine/audio/`), dice win/lose SFX, and an optional `entrySoundAsset` field on District/POI content (with a placeholder demonstrating the fail-silent path on both the tavern POI and its district).
- `COMMAND_CANCEL_MINIGAME` follow-up sibling in spirit: a dev-only "Reset Progress" button in `ManagementDrawer`, resetting `PlayerState` to `initialPlayerState` for verification purposes (see `docs/decisions.md`).
- `docs/feature-workflow.md` and `docs/features/` — a structured spec process for future feature/content work, with referential-integrity checks added to `content-integrity.test.ts` (Actor↔Faction, POI↔Actor, District↔POI cross-references) as part of the same pass.
- Branching dialogue system: `DialogueSchema`/`DialogueNodeSchema`/`DialogueChoiceSchema`/`DialogueRequirementSchema` (`src/content/schemas/dialogue.schema.ts`), a `DialogueRequirement` evaluator (`src/engine/utils/evaluator.ts`), two new commands (`COMMAND_ENTER_DIALOGUE_NODE`, `COMMAND_SELECT_DIALOGUE_CHOICE`), a `DialogueOverlay` component, and `dialogueProgress` persisted on `PlayerState`. Mara Venn's dialogue is now a real branching tree (`src/content/dialogues/dialogue_mara_venn.json`) with a reputation-gated choice, choice-triggered consequences, and an ending choice with consequences.
- Referential-integrity checks in `content-integrity.test.ts` extended to cover `Actor.dialogueId -> Dialogue` and dialogue node id/reference consistency.
- `src/contentLoader.ts`'s `loadContent(schema, data, label)`: every content JSON file `App.tsx` imports is now run through its Zod schema at load time (throwing a clear error on failure) instead of consumed as a raw static import — closes the class of gap where a schema field's `.default(...)` was never applied to unparsed production content, even though `content-integrity.test.ts`/`schemas.test.ts` always passed (see Fixed, below, and `docs/decisions.md`).

### Changed
- `COMMAND_ADJUST_CURRENCY` now borrows down (silver/gold break into bronze on a loss) and enforces a hard zero floor, not just carry-up on gains.
- Mara Venn's faction corrected from `faction_city_watch` to `faction_wagering_ring`; title and description updated to match ("Wagering Ring Regular").
- Player now starts with a small currency purse (50 bronze-equivalent) instead of zero, so the gambling loop is reachable from a fresh save.
- `StateCommandSchema` restructured from a loose `{ type, payload: Record<string, unknown> }` schema into a `.strict()` discriminated union, one payload schema per command — a malformed or extra-keyed content-authored command payload now fails validation at test/CI time and on save-file import instead of silently passing.
- **Breaking:** `Actor.initialDialogue: string` replaced by `Actor.dialogueId: string`, pointing at a `Dialogue` content file. No backward-compatibility layer — one actor in the project, no live players.
- Mara Venn's reputation gain, endeavor start, and endeavor phase advance moved from unconditional `App.tsx` click-handler side effects into `commands` on specific dialogue choices — reputation now accrues from engaging in the conversation, not from any click on her name. `NodeInteractionCanvas` no longer renders dialogue text directly; `DialogueOverlay` (mounted as an `App.tsx`-level sibling, like `MinigameOverlay`) does.

### Fixed
- CI pinned to Node 20 while local development used Node 24, causing jsdom's `undici` dependency to fail only in CI (`markAsUncloneable` missing pre-v21). CI bumped to Node 24, then centralized into `.nvmrc` as the single source of truth.
- The Dice minigame modal had no way to close once opened if the player couldn't afford the minimum wager — no cancel, only a disabled "Throw."
- `npx tsc --noEmit` (bare) was silently checking zero files project-wide (no `-b` to follow `tsconfig.json`'s project references) — every "clean type-check," including in CI, was vacuous. Fixed to `npx tsc -b --noEmit` everywhere it's used; fixed the one genuine type error it had been hiding.
- A dialogue choice omitting `commands` crashed at runtime (`commands is not iterable`) despite passing every test — `App.tsx`'s raw static content import never applied `DialogueChoiceSchema.commands`'s `.default([])`, only `content-integrity.test.ts`'s own internal `schema.safeParse` did. Root-caused via the new `loadContent` mechanism above, not a per-field patch.
