# Feature: Rapier Duel Minigame

## Goal

Give the `DUEL` minigame type a real mechanic: a discrete, turn-based finite-state duel where the player and an opponent each pick one of five actions per turn (Thrust, Parry & Riposte, Feint, Taunt, Dirty Trick), resolved deterministically against an `energy`/`poise`/distance model, ending in victory or defeat through the existing minigame contract. This is the second concrete minigame mechanic (after `DICE`), and the occasion for turning `MinigameLauncherPayload.config` into a real discriminated union instead of an untyped bag.

## Classification

Feature/Engine.

## Existing-capability check

`COMMAND_START_MINIGAME`/`COMMAND_RESOLVE_MINIGAME`/`COMMAND_CANCEL_MINIGAME` plumbing, `MinigameOverlay`'s type-branching, and `minigameResolvers`'s registry pattern all already exist from the dice-minigame phase and need no new command types — this phase only adds a second registered mechanic. `COMMAND_ADJUST_REPUTATION`/`reputation.factions` is reused as-is for Taunt's reputation check (read-only reuse, doesn't change what reputation means to its other consumers — no new command). `COMMAND_ADD_ITEM`-shaped inventory entries are reused for `item_rapier` (a plain data addition to `initialPlayerState.inventory`, not a new mechanism).

**Reuse-of-meaning check on `MinigameLauncherPayload.config`**: turning it from `Record<string, unknown>` into a discriminated union is widening/narrowing a type, not repurposing what it *means* — `config` still means "this minigame instance's launch parameters," same as before, just typed per `type` now instead of left loose. `LOCKPICKING`/`FISHING` keep the old loose shape since their mechanics remain undefined.

## Integration points

None yet — this phase is deliberately engine-only (see Reachability below). No POI action, dialogue choice, or Endeavor phase dispatches `COMMAND_START_MINIGAME` with `type: "DUEL"` this phase. The only "integration point" is `MinigameOverlay`'s type-branch, which routes `"DUEL"` to `DuelGame` the same way it already routes `"DICE"` to `DiceGame` — correct moment: whenever `activeMinigame.type === "DUEL"`, unconditionally.

## Reachability

**Deliberately not reachable from a fresh save this phase.** No in-content trigger exists — `duel.ts`/`DuelGame.tsx`/`DuelConfig`/`item_rapier` are built and fully unit/component-tested, but nothing in `App.tsx` or any dialogue/POI content ever dispatches `COMMAND_START_MINIGAME` with `type: "DUEL"`. This is a conscious scope decision (confirmed with the user), following `feature-workflow.md` §2 stage 3: content-wiring (an actual opponent NPC/POI action that starts a duel) is sequenced as its own later Content/Adventure phase, not decided per-instance here. Named explicitly so it isn't mistaken for the same category-A gap the dice minigame shipped with (built, tested, but unreachable because starting currency was `{0,0,0}`) — the difference is this one is a deliberate, logged decision, not an oversight caught after the fact. A follow-up content spec is required before a player can actually encounter this duel.

## Consistency check

`game-design-spec.md` §9's "not yet defined for the remaining three types" language names `DUEL` explicitly — updated to drop it now that it's resolved, mirroring exactly how `DICE`'s own resolution was documented. Open Design Gap #1 (`MinigameLauncherPayload.config` becoming a discriminated union) updated to reflect DICE+DUEL now covered, LOCKPICKING/FISHING still not. `web-implementation.md` §7's directory-structure note ("`duel.ts`... doesn't exist yet and shouldn't be stubbed out ahead of its spec") updated — this phase is that spec. New Open Design Gap #11 added for poise-scaling-with-equipped-rapier (see Open Questions).

## Environment notes

None specific to this feature.

## Test plan

- `duel.test.ts`: per-action effects in isolation; distance-legality fizzles (`THRUST` outside `IN_MEASURE`, `DIRTY_TRICK` outside `CLOSE_QUARTERS`); all three parry-interaction cases (mutual thrust, mutual parry, one-thrusts-one-parries); Feint's distance shift and its idempotency when both sides Feint the same turn; Taunt's reputation threshold (below/at/above `TAUNT_REPUTATION_THRESHOLD`); guard-break bonus damage on Thrust/Dirty Trick landing on a poise-0 defender, with an explicit case proving it does *not* apply when the same turn's own Dirty Trick poise-drain is what brought poise to 0, and that riposte counter-damage never gets the bonus; outcome determination for `ONGOING`/`PLAYER_VICTORY`/`PLAYER_DEFEAT` including the mutual-knockout tie-break; every `chooseOpponentAction` heuristic branch including the injected-random fallback; an explicit assertion that `chooseOpponentAction` never returns `TAUNT` across many stubbed-random samples.
- `DuelGame.test.tsx`: full multi-turn flow to both victory and defeat via `fireEvent`/`waitFor` (mirroring `DiceGame.test.tsx`'s conventions — real store reset, injected `random`/`playSound` props); Leave/flee cancels mid-duel without side effects; illegal-action buttons render disabled per current distance; Taunt's reputation-bonus behavior differs when `usePlayerStore.setState` sets a high `faction_wagering_ring` reputation beforehand vs. not.
- `minigames.test.ts`: `makeMinigame()`'s default `config` updated to a valid minimal `DuelConfig` so the file compiles under the new discriminated type — no test-intent change, this file only exercises generic command plumbing.
- `MinigameOverlay.test.tsx`: the 3 existing tests using `type: "DUEL"` purely to exercise the generic fallback shell are re-fixtured to `type: "LOCKPICKING"` (still unimplemented, still falls through) to preserve their original intent; a new test asserts `DuelGame` renders instead of the generic shell for `type: "DUEL"`, mirroring the existing DICE-vs-shell test.
- `playerStore.test.ts`: assert `initialPlayerState.inventory` contains `item_rapier` ×1.

## Content-schema scaling note

No new content schema — `DuelConfig`/`DiceConfig` are launcher-payload types built in TS/JSX at dispatch sites (mirroring how `DICE`'s config is built inline in `DiceGame.tsx`/`App.tsx`), not static content JSON, so `content-integrity.test.ts`'s glob is unaffected. `item_rapier` is a plain inventory string id, same as the pre-existing `item_lockpick`/`item_broadsheet` test fixtures — no Item content schema exists to validate against (confirmed: none exists in `src/content/`), consistent with current practice.

## Open questions / explicitly deferred scope

- **No in-content trigger exists yet** — see Reachability. A Content/Adventure spec is needed to actually place this duel behind an NPC/POI.
- **Poise-scaling with equipped rapier** — `game-design-spec.md` new Open Design Gap #11: poise is a flat 100 default for the player and author-configured per opponent; the intent is for a better-equipped rapier to eventually raise the player's poise (and inform `chooseOpponentAction`'s heuristics about the opponent's weapon), but no "equipped item" concept exists yet (inventory only tracks owned quantity). `DuelContext` is deliberately shaped so this becomes a context field addition later, not a signature change to `evaluateDuelTurn`/`chooseOpponentAction`.
- **Guard-break bonus damage (`GUARD_BREAK_BONUS_DAMAGE`) and every other numeric constant** (`THRUST_DAMAGE`, `RIPOSTE_COUNTER_DAMAGE`, `FEINT_POISE_DRAIN`, `DIRTY_TRICK_DAMAGE`/`_POISE_DRAIN`, `TAUNT_POISE_DRAIN_BASE`/`_REPUTATION_BONUS`/`_REPUTATION_THRESHOLD`, `OPPONENT_LOW_POISE_THRESHOLD`/`_HEALTHY_ENERGY_THRESHOLD`, `PLAYER_STARTING_ENERGY`/`_POISE`) are placeholder/first-mechanic numbers, not balanced ones — same treatment as `dice.ts`'s `MIN_WAGER`/`MAX_WAGER`/`WAGER_STEP`. Economy/combat balance remains `game-design-spec.md` Open Design Gap #3.
- **Mutual-knockout tie-break** (`PLAYER_DEFEAT` wins ties when both combatants' energy hits 0 the same turn) is an arbitrary placeholder resolution order, not a considered design choice.
- **Taunt's reputation check targets a hardcoded `faction_wagering_ring` id** inside `duel.ts` — a deliberate worked example (per the user's brief), not a general reputation-driven-taunt system across future duels.
- `chooseOpponentAction` never selects `TAUNT` — its reputation check is only meaningful for the player; this is a design choice, not an oversight.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "Rapier Duel minigame...", "`item_rapier` added to `initialPlayerState.inventory`...", "`MinigameLauncherPayload.config` is now a discriminated union...".
- decisions.md (2026-08-12): `MinigameLauncherPayload.config` discriminated union done incrementally rather than all-at-once; `DuelContext` bundling rationale; hardcoded Taunt target faction; guard-break bonus added during review; mutual-knockout tie-break and opponent-never-Taunts as placeholder choices; engine-only reachability scope; `item_rapier` starter inventory and the two existing tests updated for it.
