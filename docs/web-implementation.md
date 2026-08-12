# Web Implementation Specification

This document defines how the current web build implements the rules in `docs/game-design-spec.md`. Everything here is specific to the React/TypeScript/Vite/Zustand/Zod stack and would be replaced wholesale if the project ever migrated to a different engine. Domain/game rules that should survive a migration live in `docs/game-design-spec.md` instead — this file should never contain a rule that isn't there.

## 1. Tech Stack

React 18+, TypeScript (strict mode), Vite, Tailwind CSS v4, Zustand, Framer Motion, Lucide-React, Vitest, Zod. No plain JavaScript. No heavy 3D frameworks.

## 2. Naming & Case Conventions (Code)

- **Content JSON files & entity IDs:** `snake_case` — this is the portable convention defined in `game-design-spec.md` §3, carried into filenames here (e.g. `actor_mara_venn.json`).
- **JSON properties & JS/TS variables:** `camelCase` (e.g. `costShifts`, `unlockedNodes`).
- **React components & TS types:** `PascalCase` (e.g. `WorldClockHud.tsx`, `PlayerState`).
- **State commands & events:** `UPPER_SNAKE_CASE` (e.g. `COMMAND_ADVANCE_SHIFT`).

## 3. Architectural Model

- `src/engine/` is purely generic, event-driven, and decoupled from narrative content. It must never import from `src/content/` as hardcoded data.
- State updates follow a CQRS pattern: UI components dispatch explicit `StateCommand` objects. Command handlers in the store mutate state and emit state-change events (in-memory log, not persisted).
- Narrative content, world nodes, quests, and minigame configurations live strictly as JSON in `src/content/`.
- **Content-derived command payloads:** some command handlers need data that only content JSON knows — a POI's `costShifts`, an Endeavor phase's target phase ID, a phase's `unlocksNodesOnComplete`. Since `src/engine/` may never read `src/content/`, that data is supplied by the caller (the UI, which does read content) as part of the command's `payload` — e.g. `COMMAND_MOVE_TO_POI` accepts an optional `costShifts`, `COMMAND_START_ENDEAVOR` accepts `initialPhaseId`, `COMMAND_ADVANCE_ENDEAVOR_PHASE` accepts `nextPhaseId` and `unlocksNodesOnComplete`. The store never looks these up itself.
- **Content-derived component props:** the same decoupling applies to `src/engine/components/`. Components take fully-resolved data as props (names, descriptions, unlock flags, actor lists) rather than importing `src/content/` themselves. Only `src/App.tsx` — which lives outside `src/engine/` — is allowed to import content JSON directly; it resolves the current settlement/district/POI/actors and passes the results down as props. This is the same pattern as content-derived command payloads, applied to rendering instead of dispatch.
- **A terminal Endeavor phase (no `nextPhaseOnSuccess`) needs no separate "complete" tracking — reaching it is the representation.** `endeavor_the_missing_broadsheet`'s "Pay off the buyer" action (visible while `activeEndeavors[id].currentPhaseId === 'phase_confront_the_buyer'`) dispatches only the `COMMAND_ADJUST_CURRENCY` cost, nothing else — no new command, no schema field, no clue repurposed as a completion flag. Deliberate trade-off: the action has no persisted one-time gate, so it stays clickable (and re-payable) for as long as the player is in that phase — same category of accepted simplicity as the no-anti-grinding reputation gap (`game-design-spec.md` § Open Design Gaps).
- **POI-level actions (Gamble, Pay off the buyer, ...) are a generic `actions?: NodeInteractionAction[]` prop on `NodeInteractionCanvas`** (`{ id, label, disabled?, onClick }`), not hardcoded into the component. `App.tsx` builds the list per-POI (e.g. only at `poi_crooked_hour_tavern`) and owns the business logic each action triggers (dispatching `COMMAND_START_MINIGAME`, `COMMAND_ADJUST_CURRENCY`, etc.) — same content-derived-props pattern as everything else `NodeInteractionCanvas` renders.
- **Ephemeral UI selection state stays local, not in `PlayerState`.** Which actor's dialogue is currently showing inside `NodeInteractionCanvas` is `useState` in `App.tsx`, not a store field — it's view state, not save data. `currentLocation.poiId` (in `PlayerState`, persisted) is what actually drives the `WorldNavigationView` / `NodeInteractionCanvas` viewport swap: entering a POI dispatches `COMMAND_MOVE_TO_POI`, leaving one reuses `COMMAND_MOVE_TO_DISTRICT` (already 0-cost) with the current `districtId` to clear `poiId` — no new command was added for "leaving a POI."

## 4. Core Types

```typescript
// src/engine/types/index.ts

export type CommandType =
  | 'COMMAND_ADVANCE_SHIFT'
  | 'COMMAND_UNLOCK_NODE'
  | 'COMMAND_MOVE_TO_SETTLEMENT'
  | 'COMMAND_MOVE_TO_DISTRICT'
  | 'COMMAND_MOVE_TO_POI'
  | 'COMMAND_ADJUST_CURRENCY'
  | 'COMMAND_ADJUST_REPUTATION'
  | 'COMMAND_ADD_ITEM'
  | 'COMMAND_REMOVE_ITEM'
  | 'COMMAND_UNLOCK_CLUE'
  | 'COMMAND_START_ENDEAVOR'
  | 'COMMAND_ADVANCE_ENDEAVOR_PHASE'
  | 'COMMAND_START_MINIGAME'
  | 'COMMAND_RESOLVE_MINIGAME'
  | 'COMMAND_CANCEL_MINIGAME'
  | 'COMMAND_ENTER_DIALOGUE_NODE'
  | 'COMMAND_SELECT_DIALOGUE_CHOICE'
  | 'COMMAND_NEXT_DAY';

export interface StateCommand<T = Record<string, unknown>> {
  type: CommandType;
  payload: T;
}

// Gates a dialogue choice's availability against PlayerState.
export interface DialogueRequirement {
  requiredClues?: string[];
  minActorReputation?: { actorId: string; value: number };
  minFactionReputation?: { factionId: string; value: number };
  allowedShifts?: Shift[];
  nodeVisits?: { nodeId?: string; min?: number; max?: number };
}

export type MinigameType = 'DUEL' | 'LOCKPICKING' | 'FISHING' | 'DICE';

export interface DiceConfig {
  wager: number;
}

export interface DuelConfig {
  opponentId: string;
  opponentName: string;
  opponentStartingEnergy: number;
  opponentStartingPoise: number;
  startingDistance?: DistanceState; // default OUT_OF_MEASURE if omitted
}

// A discriminated union keyed on `type` — DICE and DUEL now have real
// per-type config shapes; LOCKPICKING/FISHING keep the untyped bag until
// their mechanics are defined (game-design-spec.md § Open Design Gaps, item 1).
export type MinigameLauncherPayload =
  | { type: 'DICE'; sourceId: string; config: DiceConfig; onSuccessCommands: StateCommand[]; onFailureCommands: StateCommand[] }
  | { type: 'DUEL'; sourceId: string; config: DuelConfig; onSuccessCommands: StateCommand[]; onFailureCommands: StateCommand[] }
  | { type: 'LOCKPICKING' | 'FISHING'; sourceId: string; config: Record<string, unknown>; onSuccessCommands: StateCommand[]; onFailureCommands: StateCommand[] };

export interface PlayerState {
  currencies: { gold: number; silver: number; bronze: number };
  worldClock: {
    shift: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
    day: number;
    season: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
    weather: 'CLEAR' | 'RAIN' | 'FOG' | 'STORM';
  };
  currentLocation: {
    settlementId: string;
    districtId: string;
    poiId?: string;
  };
  reputation: {
    factions: Record<string, number>;
    actors: Record<string, number>;
  };
  inventory: Array<{ itemId: string; quantity: number }>;
  unlockedNodes: Record<string, boolean>;
  unlockedClues: string[];
  activeEndeavors: Record<string, { currentPhaseId: string; logHistory: string[] }>;
  activeMinigame: MinigameLauncherPayload | null;
  dialogueProgress: Record<string, { currentNodeId: string; visitCounts: Record<string, number> }>;
}
```

`StateCommandSchema` (the Zod counterpart of `StateCommand`, in the same file) is a `.strict()` discriminated union keyed on `type` — one payload schema per command, so a malformed or extra-keyed content-authored command payload (a dialogue choice's `commands`, a minigame's `onSuccessCommands`/`onFailureCommands`) fails validation instead of silently passing `z.record(z.string(), z.unknown())`. It deliberately excludes `COMMAND_NEXT_DAY` (see above) — content JSON can never construct one. This only validates at test/CI time (`content-integrity.test.ts`, `schemas.test.ts`) and on save-file import (`parseAndValidateSave`); `dispatchCommand`'s input at the `playerStore.ts` boundary stays unvalidated at runtime, same as before this schema existed.

`COMMAND_NEXT_DAY` is **internal-only**: dispatched automatically inside the `COMMAND_ADVANCE_SHIFT` handler when `NIGHT` rolls over. It is never dispatched directly by the UI, and no UI element should expose it as an action. The store enforces this structurally, not just by convention: the day-rollover logic lives in a private function called directly by the `COMMAND_ADVANCE_SHIFT` handler, and dispatching `COMMAND_NEXT_DAY` on its own throws.

`COMMAND_ADJUST_CURRENCY` auto-normalizes the result after every adjustment: bronze carries into silver, silver carries into gold, at the stated 20:20 ratio (`game-design-spec.md` §5). It also borrows down in the other direction — a loss that exceeds the bronze on hand breaks silver (and, through silver, gold) down into bronze as needed — and enforces a hard floor: total value (converted to a single bronze-equivalent figure, adjusted, then re-split into gold/silver/bronze) can never go negative; a loss exceeding total holdings clamps to zero. This is a store-level guarantee (`applyCommand`), not a UI-layer convention — UI should still disable actions the player can't afford, but the store doesn't trust it to.

`worldClock.weather` is display-only scaffolding added to satisfy `WorldClockHud`'s Phase 6 requirement to show a weather indicator (`execution-plan.md` Phase 6). `game-design-spec.md` §4 says weather is tracked but doesn't define its representation or how it changes. No `CommandType` sets it yet — it stays at its initial value (`CLEAR`) until a weather-progression mechanic is actually specified. Do not add weather-driven gameplay effects (visibility, encounter odds, etc.) without a spec for them first.

`COMMAND_ENTER_DIALOGUE_NODE` and `COMMAND_SELECT_DIALOGUE_CHOICE` resolve `game-design-spec.md` Open Design Gap #6 (dialogue branching/variation). `COMMAND_ENTER_DIALOGUE_NODE` is pure bookkeeping — opening or resuming a conversation, incrementing `dialogueProgress[dialogueId].visitCounts[nodeId]` — and carries no `commands` field in its payload, so it cannot have side effects by construction. `COMMAND_SELECT_DIALOGUE_CHOICE` always carries a `commands: StateCommand[]` (possibly empty) and a nullable `nextNodeId` (`null` means the choice ends the conversation); it's dispatched unconditionally on every choice click, the same way `COMMAND_CANCEL_MINIGAME` is dispatched unconditionally for a no-consequence "Leave." See `src/engine/utils/evaluator.ts`'s `evaluateDialogueRequirement(playerState, requirement, currentNodeId, dialogueId)` for how a choice's `requires: DialogueRequirement` is evaluated — unavailable choices are rendered disabled, not filtered out, matching the existing `NodeInteractionAction` pattern below.

## 5. Content Schema Field Reference (Zod)

Concrete field types, matching `game-design-spec.md` §8:

- **Base node fields** (Settlement, District, POI, Actor): `id: string`, `name: string`, `description: string`, `isUnlocked: boolean`, `imageAsset?: string`.
- **District / POI** additionally: `controllingFactionId?: string`, `factionInfluence?: Record<string, number>`.
- **POI** additionally: `districtId: string`, `costShifts: number` (default 0), `availableShifts: Shift[]`, `actorIds: string[]`.
- **District** additionally: `settlementId: string`, `poiIds: string[]`.
- **Settlement** additionally: `districtIds: string[]`.
- **Actor** additionally: `poiId: string`, `factionIds: string[]` (default `[]`), `title: string`, `dialogueId: string` (points at a `Dialogue` content file's `id`; breaking-changed from a plain `initialDialogue: string` when dialogue branching was implemented — see below).
- **Faction**: base fields only.
- **Endeavor**: `id`, `title`, `description`, `isUnlocked`, `initialPhaseId`, `phases: Record<string, EndeavorPhase>`.
- **EndeavorPhase**: `id`, `objectiveText`, `requiredClues?: string[]`, `nextPhaseOnSuccess?: string`, `unlocksNodesOnComplete: string[]`.
- **Dialogue**: `id`, `startNodeId: string`, `nodes: Record<string, DialogueNode>`.
- **DialogueNode**: `id`, `speaker: string`, `text: string`, `choices: DialogueChoice[]` (default `[]`).
- **DialogueChoice**: `id`, `text: string`, `nextNodeId?: string` (omitted means this choice ends the conversation), `requires?: DialogueRequirement`, `commands: StateCommand[]` (default `[]`).
- **Item**: base node fields, but with `imageAsset: string` **required** (not optional) — an Item always needs a visible representation, unlike every other node type — plus `stackable: boolean`. No enforcement of `stackable` anywhere yet (`game-design-spec.md` Open Design Gap #12); it's a schema-level distinction only. `item_rapier` is the one instance so far.

Schemas live in `src/content/schemas/`. All content JSON under `src/content/` must validate against its corresponding schema. Territory has no schema — deferred per `game-design-spec.md` §2.

## 6. Persistence

- Zustand `persist` middleware, `localStorage`, key `broadsheet_rapier_player_state`.
- `exportSave()`: downloads current `PlayerState` as a `.json` file.
- `importSave(file)`: parses the file, validates against a `PlayerStateSchema` (structural check — required fields and correct types/enums only, no version migration logic), and rejects the import without touching current state if validation fails.

## 7. Directory Structure

```
src/
  engine/
    types/index.ts
    store/{playerStore.ts, commands.ts, events.ts}
    minigames/{dice.ts, duel.ts, index.ts}
    audio/{playSound.ts}
    utils/{evaluator.ts, resolveAssetUrl.ts}
    components/{WorldClockHud.tsx, WorldNavigationView.tsx, NodeInteractionCanvas.tsx, ManagementDrawer.tsx, AssetFallback.tsx, MinigameOverlay.tsx, DialogueOverlay.tsx, minigames/{DiceGame.tsx, DuelGame.tsx}}
  content/
    schemas/{shared.ts, settlement.schema.ts, district.schema.ts, poi.schema.ts, actor.schema.ts, faction.schema.ts, endeavor.schema.ts, dialogue.schema.ts, item.schema.ts}
    settlements/ districts/ pois/ actors/ factions/ endeavors/ dialogues/ items/
  dialogueResolution.ts
  __tests__/{schemas.test.ts, content-integrity.test.ts, playerStore.test.ts, persistence.test.ts, commands.test.ts, minigames.test.ts, dice.test.ts, duel.test.ts, playSound.test.ts, resolveAssetUrl.test.ts, evaluator.test.ts, resolveDialogueEntryNodeId.test.ts, components/, setup/}
public/
  content/assets/{images/districts, images/pois, images/actors, images/items, audio}/
```

`minigames/` only has files for types with a defined mechanic (`dice.ts`, `duel.ts`) plus the `index.ts` registry — `lockpicking.ts` and `fishing.ts` don't exist yet and shouldn't be stubbed out ahead of their specs (`game-design-spec.md` § Open Design Gaps, item 1). Same reasoning for `components/minigames/`: only `DiceGame.tsx`/`DuelGame.tsx` exist; the other two minigame types get their own UI component once their mechanic is specified.

`src/content/` uses categorized subfolders per node type, not a flat directory.

## 8. Asset Handling

- Asset paths: `/public/content/assets/images/{districts,pois,actors,items}/` and `/public/content/assets/audio/`.
- Filenames: `snake_case` (e.g. `lantern_ward_bg.webp`). The extension itself is **not enforced anywhere** — `imageAsset`/`entrySoundAsset` are plain `z.string()` fields (`shared.ts`, no format/extension validation), and `AssetFallback`/`playSound` pass the path straight through to `<img src>`/`new Audio()`, format-agnostic. `.webp` in examples throughout this doc and the starter content is a convention from when those were placeholder filenames with no real file behind them yet, not a requirement — `.jpg`/`.png`/whatever the source art actually is works identically.
- Paths inside content JSON are relative/absolute web paths resolved dynamically by rendering components — never imported directly into engine code.
- **Every content-authored path is root-relative (`/content/assets/...`) and must be run through `src/engine/utils/resolveAssetUrl.ts` before it becomes a real `src`/`Audio()` call** — the app builds with a non-root Vite `base` (`/broadsheet-rapier/`, for GitHub Pages), so a literal root-relative path 404s under that base in both dev and production. `AssetFallback` and `playSound` are the only two chokepoints that turn a content path into a request, and both already resolve through it; nothing else should construct an `<img src>`/`new Audio()` directly from a content field. See `docs/decisions.md` for the incident this closes (invisible until the first real asset file was actually added).
- Missing/failed asset load renders a placeholder: bright purple border (`border-purple-600 bg-purple-950/80`), warning icon, text `MISSING: [asset_path]`. Implemented once as a shared `AssetFallback` component wrapping every image/audio reference — never reimplemented ad hoc per component.

### Content Loading (implemented)

- **Every content JSON file `App.tsx` imports is parsed through its Zod schema at load time, via `src/contentLoader.ts`'s `loadContent(schema, data, label)`, not consumed as a raw static import.** `loadContent` calls the schema's `safeParse` and throws a clear, labeled error immediately if it fails — the same strictness `content-integrity.test.ts` already enforces at test time, now also enforced in production, not only in tests.
- **Why this exists, concretely:** a schema field declared with `.default(...)` (e.g. `DialogueChoiceSchema.commands`, `DialogueNodeSchema.choices`, `PoiSchema.costShifts`, `ActorSchema.factionIds`) is only ever defaulted when the data is actually run through `.parse()`/`.safeParse()`. A raw static `import` of the JSON returns it exactly as authored — a field omitted in that JSON stays `undefined`/absent at runtime, not the schema's declared default. `content-integrity.test.ts` and `schemas.test.ts` both only ever exercise the *parsed* shape, so they pass regardless of whether the raw JSON includes the field — they cannot catch this class of gap. It was found for real: a dialogue choice omitting `commands` crashed at runtime (`commands is not iterable`) despite every test passing, because `App.tsx` loaded it via raw `import` at the time. See `docs/decisions.md`.
- **Practical consequence for anyone writing a component that consumes content:** any prop sourced from an `App.tsx` content import can be assumed to already be the fully validated, defaulted shape its schema promises. Don't add a defensive `?? []`/`?? 0` fallback at the point of use for a "the field might be missing because content omitted it" concern — that concern is closed at the loading boundary. (A defensive fallback is still appropriate for a genuinely different concern, e.g. "this lookup might not find a matching item at all" — `pois.find(...)` returning `undefined` is not this class of gap.)
- **Scope:** this covers content-JSON loading only. `dispatchCommand`'s own input at the `playerStore.ts` boundary (commands built by `App.tsx`/`DialogueOverlay.tsx` as plain TypeScript object literals) is unrelated and still unvalidated at runtime — see §4's `StateCommandSchema` scoping note. Not addressed by this mechanism, and out of scope for it.

### Audio Handling (implemented)

- Shared fail-silent player: `src/engine/audio/playSound.ts`. Takes an asset path and an injectable `{ audioFactory? }` option (defaulting to `(src) => new Audio(src)`), attempts playback, and swallows all three failure shapes — the factory throwing synchronously, `.play()` throwing synchronously, and `.play()` returning a rejected promise — without ever throwing, blocking, or interrupting gameplay. At most logs a `console.warn` in dev (`import.meta.env.DEV`).
- **Deliberate contrast with the visual `AssetFallback` rule above.** A missing/failed *image* must be loudly, visibly flagged (purple `MISSING` placeholder) because content authors need to catch it during development. A missing/failed *sound* must degrade silently — SFX are non-blocking and non-critical to gameplay, and an audible glitch or a thrown error would be a worse player experience than simply no sound. Same underlying "missing asset" problem, opposite resolution, because the two asset kinds have different failure costs. `game-design-spec.md` §10 states this as a domain-level rule, not just an implementation detail.
- Two independent trigger mechanisms, matching how each sound is owned:
  - **Logic-driven**: dice win/lose in `DiceGame.tsx` (`WIN_SOUND_ASSET`/`LOSE_SOUND_ASSET` constants, fired from `throwDice` right after the roll result is computed) — component-owned, tied to a game-logic outcome (`result.isVictory`), not content data. Not schema-driven. Takes an injectable `playSound?: (src: string) => void` prop (defaulting to the real utility), mirroring the existing injectable `random` prop, for deterministic tests.
  - **Content-driven**: optional `entrySoundAsset` on the District and POI content schemas (same optionality pattern as `imageAsset`), played via `playSound` in `App.tsx` — for POI, in `onSelectPoi` (a real "player chose to enter this POI" moment); for District, in a mount-only `useEffect` against the currently-resolved district, **not** in `onLeave` (which dispatches `COMMAND_MOVE_TO_DISTRICT` today but only means "left a POI back into the same district" — there's no real district-to-district travel yet, so wiring the sound there would misrepresent "leaving a building" as "arriving in a district"). Both call sites are wrapped in small named functions (`triggerPoiEntryEffects`, `triggerDistrictEntryEffects`) rather than inline checks, so a second entry-effect type wouldn't mean scattered inline logic — see `game-design-spec.md`'s systemic-progression gap for why this isn't generalized further yet.
- No music or looping ambience in this phase — every sound triggered by this system is a one-shot SFX tied to a specific moment.

## 9. Minigame Runner Architecture

- Minigames are stateless runners in `src/engine/minigames/`, one file per `MinigameType`, registered in an `index.ts` lookup keyed by type (`minigameResolvers`).
- Launched via `COMMAND_START_MINIGAME(payload)`. Resolved via `COMMAND_RESOLVE_MINIGAME(isVictory)`, which dispatches the payload's `onSuccessCommands` or `onFailureCommands`.
- This section defines the plumbing contract; `LOCKPICKING`/`FISHING` mechanics remain an open design gap — see `game-design-spec.md` §9 and § Open Design Gaps.

### DICE (implemented)

- Pure resolution logic in `src/engine/minigames/dice.ts`: `rollDice(random)` rolls two d6 (even sum wins, odd loses); `resolveDiceWager(wager, random)` additionally computes `payout` (2x wager on win, 0 on loss) and `netChange` (`payout - wager`). Both take an injectable `RandomSource = () => number` (defaulting to `Math.random`) so resolution is deterministically testable.
- Wager: `MIN_WAGER = 5`, `MAX_WAGER = 100`, `WAGER_STEP = 5` (all bronze). `clampWager(desired, maxAffordable)` clamps into range, falling back to the player's total if it's below `MIN_WAGER` (caller must disable throwing in that case) — see `maxAffordableWager`.
- UI: `src/engine/components/minigames/DiceGame.tsx`. Reads/dispatches the store directly (like `WorldClockHud`/`ManagementDrawer`/`MinigameOverlay` — it's player-state-native, not content-derived, so it doesn't need props-only decoupling). Interaction is a single click on "Throw" — no press-and-hold charge mechanic (deferred, `game-design-spec.md` § Open Design Gaps item 8).
- **Wager stays in sync with `activeMinigame` via re-dispatching `COMMAND_START_MINIGAME`.** Since the wager is chosen *after* the minigame is launched (the player can still be adjusting the stepper), and `onSuccessCommands`/`onFailureCommands` must already contain the correct `COMMAND_ADJUST_CURRENCY` amount by the time `COMMAND_RESOLVE_MINIGAME` fires, `DiceGame` re-dispatches `COMMAND_START_MINIGAME` with a freshly-baked payload (`config.wager` plus matching `onSuccessCommands`/`onFailureCommands`) on every stepper click, and once defensively on mount. `COMMAND_RESOLVE_MINIGAME` itself never needed to change — it already dispatches whichever fixed command list matches the roll outcome, per the existing contract.
- **`COMMAND_CANCEL_MINIGAME`**: clears `activeMinigame` with no consequence — neither `onSuccessCommands` nor `onFailureCommands` run. `DiceGame`'s "Leave" button (visible whenever the player hasn't just thrown — including when they can't afford `MIN_WAGER`) dispatches it. Added because `COMMAND_RESOLVE_MINIGAME` always applies one side or the other; there was no existing way to back out of a launched minigame without a win/lose consequence, which meant a player with too little to afford even the minimum wager had no way to close the modal at all.
- `MinigameOverlay` routes by `activeMinigame.type`: `DICE` renders `DiceGame`, `DUEL` renders `DuelGame`; every other type still renders the original generic Victory/Defeat shell (unimplemented mechanics stay unimplemented, not silently faked).

### DUEL (implemented)

- Pure resolution logic in `src/engine/minigames/duel.ts`: `evaluateDuelTurn(context: DuelContext, playerAction: DuelAction, opponentAction: DuelAction)` resolves one turn deterministically (no RNG); `chooseOpponentAction(context: DuelContext, random?: RandomSource)` picks the opponent's action via fixed heuristics, using an injectable RNG only for its fallback tie-break — same `RandomSource = () => number` pattern as `dice.ts`.
- `DuelContext` bundles `player`/`opponent` (`{ energy: number; poise: number }`), a three-step `distance: DistanceState` (`OUT_OF_MEASURE | IN_MEASURE | CLOSE_QUARTERS`), `lastPlayerAction: DuelAction | null`, and `playerReputation` (a snapshot of `PlayerState.reputation`, same shape) — deliberately a single extensible context object, not positional parameters, so later additions (equipped weapon, etc.) don't change either function's signature (`game-design-spec.md` § Open Design Gaps, item 11).
- Five `DuelAction`s: `THRUST` (energy damage, requires `IN_MEASURE`), `PARRY_RIPOSTE` (negates and counters a matching `THRUST`/`DIRTY_TRICK` this turn), `FEINT` (poise drain + shifts distance one step toward `CLOSE_QUARTERS`), `TAUNT` (poise drain, with a bonus gated on the player's `faction_wagering_ring` reputation — a hand-authored worked example, not a general system), `DIRTY_TRICK` (energy + poise damage, requires `CLOSE_QUARTERS`). A combatant whose poise is already 0 at the start of the turn takes bonus "guard-break" damage from a landed `THRUST`/`DIRTY_TRICK`. All constants (`THRUST_DAMAGE`, `RIPOSTE_COUNTER_DAMAGE`, `FEINT_POISE_DRAIN`, `DIRTY_TRICK_DAMAGE`/`_POISE_DRAIN`, `TAUNT_POISE_DRAIN_BASE`/`_REPUTATION_BONUS`/`_REPUTATION_THRESHOLD`, `GUARD_BREAK_BONUS_DAMAGE`, `OPPONENT_LOW_POISE_THRESHOLD`/`_HEALTHY_ENERGY_THRESHOLD`, `PLAYER_STARTING_ENERGY`/`_POISE`) are placeholder/first-mechanic numbers, same treatment as `dice.ts`'s wager constants — see `docs/features/feature_rapier_duel.md`.
- The duel ends only on `energy <= 0` (`PLAYER_VICTORY`/`PLAYER_DEFEAT`); poise never ends it by itself, it only feeds `chooseOpponentAction` and the UI.
- `DuelConfig` (the opponent's launch parameters — `opponentId`, `opponentName`, `opponentStartingEnergy`, `opponentStartingPoise`, optional `startingDistance`) is authored per encounter; the player's own starting `energy`/`poise` are a fixed 100/100 owned by `DuelGame.tsx` itself, not `PlayerState`-derived or per-encounter-configurable this phase.
- UI: `src/engine/components/minigames/DuelGame.tsx`, mirroring `DiceGame.tsx`'s pattern — session-local phase state (`choosing` → `resolving` → looping until `outcome !== "ONGOING"` → `result`), injectable `random`/`playSound` props, a turn log, action buttons disabled per current distance-legality, "Collect" dispatching `COMMAND_RESOLVE_MINIGAME`, "Leave" dispatching `COMMAND_CANCEL_MINIGAME` at any point before result.
- **No in-content trigger exists yet** — nothing in `App.tsx` or any content JSON dispatches `COMMAND_START_MINIGAME` with `type: "DUEL"` this phase. Engine-only; see `docs/features/feature_rapier_duel.md`'s Reachability section.
