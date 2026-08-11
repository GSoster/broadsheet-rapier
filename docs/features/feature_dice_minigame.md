# Feature: Dice Minigame

**Backfilled retroactively** — this spec was written after implementation, to demonstrate the `docs/feature-workflow.md` format against real history rather than launching the directory empty. It documents what actually happened, including the gaps that were only caught after the fact, not a cleaned-up version of events.

## Goal

Give the player a first real, repeatable "playable loop": a dice gambling minigame (2d6, even/odd, 2x payout on win) reachable at the tavern, wired into currency and — via Mara Venn's reputation loop, built in the same phase — into the starter Endeavor's progression.

## Classification

Feature/Engine.

## Existing-capability check

At the time this started, `COMMAND_ADJUST_CURRENCY` only carried bronze→silver→gold up on gains — it had no borrow-down path, so a losing wager exceeding the bronze on hand would either go negative or need new logic. This was identified as a **blocking** prerequisite, not a gap to work around: currency borrow-down (with a hard zero floor) was implemented first, as a single bronze-equivalent reconstruction rather than per-denomination borrow logic.

`COMMAND_RESOLVE_MINIGAME` already existed (Phase 6 plumbing) but always applied a win/lose consequence — no way to back out of a launched minigame without one. This surfaced *during* the phase (a real player-facing stuck-modal bug, not caught by any spec), and `COMMAND_CANCEL_MINIGAME` was added as a genuinely new command — this one *was* a real gap, not a meaning-overload, since no existing primitive meant "leave without effect."

**What went wrong here, worth naming for future specs:** endeavor completion (`phase_confront_the_buyer`, a terminal phase with no `nextPhaseOnSuccess`) was first implemented by repurposing `COMMAND_UNLOCK_CLUE` as a completion flag — a category-B mistake (reusing a command's *mechanism* while changing what it *means* to its other consumers, since the clue system represents narrative discoveries, not internal completion state). Caught in review and reverted; "Pay off the buyer" now just dispatches its currency cost and stays repeatable, with no persisted one-time gate — an accepted simplification, not a fix.

## Integration points

- **Gamble action** — `App.tsx`'s `buildPoiActions`, only at `poi_crooked_hour_tavern`. Dispatches `COMMAND_START_MINIGAME`. Correct moment: an explicit player choice to gamble.
- **Wager changes** — `DiceGame.tsx` re-dispatches `COMMAND_START_MINIGAME` with a freshly-baked payload on every stepper click (and once on mount). Necessary because the wager is chosen *after* launch, and `onSuccessCommands`/`onFailureCommands` must already be correct by the time `COMMAND_RESOLVE_MINIGAME` fires.
- **Leave** — `COMMAND_CANCEL_MINIGAME`, available whenever the player hasn't just thrown, including when they can't afford the minimum wager.
- **Mara Venn reputation** — `App.tsx`'s `handleSelectActor`, on every conversation (+5 reputation, no cooldown — see Open Questions).

## Reachability

**This is where the phase's actual gap was.** The minigame was fully built, unit-tested, and passing — but `initialPlayerState.currencies` was `{0,0,0}` (inherited from Phase 3, long before this feature existed), which made "Gamble" permanently disabled on a fresh save. Caught only by manually running the app, not by any test. Fixed by giving the player a starting purse (50 bronze-equivalent, `docs/decisions.md`) — explicitly flagged as a placeholder tied to the still-open economy-balance gap, not a balanced number.

## Consistency check

Mara Venn's `factionIds` was corrected to `faction_wagering_ring` in this phase — but her `title` ("City Watch Sergeant") and `description` weren't updated in the same pass, staying inconsistent for two more turns until caught separately. This is the category-C incident that most directly motivated `docs/feature-workflow.md`'s consistency-sweep step.

## Environment notes

None specific to this feature.

## Test plan

- `commands.test.ts`: currency borrow-down (silver-break, gold-through-silver-break, floor-at-zero cases), `COMMAND_CANCEL_MINIGAME` clearing `activeMinigame` without side effects.
- `dice.test.ts`: `rollDice`/`resolveDiceWager` — all six even sums assert as wins with exact sums, all five odd sums as losses, stubbed win/lose payout assertions, `clampWager` boundary cases.
- `DiceGame.test.tsx`: wager stepper range, insufficient-funds disabling, Leave available and effective even when broke, win/lose result + currency application via `Collect`.
- `playerStore.test.ts`: starting-currency assertion, `eventLog` persistence-exclusion (a category-E gap — designed correctly from the start but untested until explicitly requested).

## Content-schema scaling note

No new schema this phase; `faction_wagering_ring.json` (new content under the existing Faction schema) was automatically covered by `content-integrity.test.ts`'s glob with zero test changes.

## Open questions / deferred scope

- No anti-grinding/cooldown on repeated Mara Venn conversations — `game-design-spec.md` Open Design Gap #7.
- Click-to-throw, not press-and-hold — deferred polish, `game-design-spec.md` Open Design Gap #8.
- `DUEL`/`LOCKPICKING`/`FISHING` mechanics remain unspecified — `game-design-spec.md` Open Design Gap #1.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "Dice minigame...", "COMMAND_CANCEL_MINIGAME and a 'Leave' button...", "COMMAND_ADJUST_CURRENCY now borrows down...", "Player now starts with a small currency purse...", "Mara Venn's faction corrected...".
- decisions.md: currency borrow-down reconstruction, dice mechanic choice (2d6 even/odd, 2x payout), Mara Venn dual-faction correction, starting purse, wager re-sync via re-dispatch, `COMMAND_CANCEL_MINIGAME` justification, the `COMMAND_UNLOCK_CLUE` reversal, Mara Venn title/description fix.
