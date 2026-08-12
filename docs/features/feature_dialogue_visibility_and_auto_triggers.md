# Feature: Dialogue Visibility & Auto-Triggers

## Goal

Let a dialogue be opened by something other than a direct actor click — specifically, an Endeavor phase auto-triggering a dialogue when the player enters a specific POI while that phase is active, and a minigame outcome opening a dialogue via its `onSuccessCommands`/`onFailureCommands`. Neither is possible today because "which dialogue is showing" lives in `App.tsx`'s local `openDialogueId` React state, which nothing in the command-dispatch pipeline (a pure function over `PlayerState`) can reach.

## Classification

Feature/Engine.

## Existing-capability check

- `PlayerState.dialogueProgress` already tracks node/visit bookkeeping per dialogue — untouched by this spec.
- `COMMAND_ENTER_DIALOGUE_NODE` already exists and is already pure bookkeeping with no side effects "by construction" (its own code comment). This spec keeps that contract exactly as-is — it does **not** start also controlling visibility. A new `COMMAND_OPEN_DIALOGUE` is dispatched alongside it wherever a click currently does both implicitly, mirroring why `COMMAND_ENTER_DIALOGUE_NODE` and `COMMAND_SELECT_DIALOGUE_CHOICE` were kept separate in the first place (`docs/features/feature_dialogue_branching.md`).
- `activeMinigame: MinigameLauncherPayload | null` on `PlayerState` is the direct precedent for `activeDialogue` — same shape of problem (a command-driven overlay that must be visible/resolvable from store state, not local component state), same solution.
- `triggerPoiEntryEffects`/`triggerDistrictEntryEffects` (`App.tsx`) already exist for `entrySoundAsset`. `game-design-spec.md` Open Design Gap #9 explicitly named this exact fork in the road: *"not a content-driven registry of typed on-enter effects — that generalization is reasonable once a second real effect type exists, not before."* A dialogue auto-trigger is that second effect type. This spec resolves that specific sentence of gap #9; the larger "systemic progression design" portion of gap #9 is unrelated and stays open.
- **Reuse-of-meaning check**: `COMMAND_ENTER_DIALOGUE_NODE` reused as-is (unchanged meaning — still pure bookkeeping). `entrySoundAsset`'s meaning is unchanged (still "play this sound on entry"); only the code path that reads it is refactored. `EndeavorPhase` gains a new optional field, not a repurposed existing one.

## Design

### 1. `activeDialogue` moves into `PlayerState`

```ts
export interface PlayerState {
  ...
  activeMinigame: MinigameLauncherPayload | null;
  activeDialogue: { dialogueId: string } | null;
  ...
}
```
`PlayerStateSchema` gains `activeDialogue: z.object({ dialogueId: z.string() }).strict().nullable()`. `playerStore.ts`'s `extractPlayerState` gains `activeDialogue: store.activeDialogue,` — same persistence treatment as `activeMinigame` (included in the Zustand `persist` partialize, for the same reason `activeMinigame` already is: consistent precedent, not a new deviation introduced here).

`App.tsx`'s local `openDialogueId` `useState` is removed. `openDialogue`/`openNode` are now derived from `usePlayerStore((s) => s.activeDialogue)` instead.

**Portrait resolution changes shape, not just source.** Today, `speakerImageAsset` is resolved via `actors.find(a => a.id === selectedActorId)` — which only works because a click set `selectedActorId` right before opening. That precondition won't hold for an auto-triggered or minigame-triggered dialogue (nothing selected an actor). Since `Actor.dialogueId` is a stable, already-existing reverse link, this spec proposes resolving the speaker instead via `actors.find(a => a.dialogueId === activeDialogue?.dialogueId)` — correct for every open path (click, auto-trigger, minigame), not just the click path. `selectedActorId` stays as local state, but narrows to *only* driving `NodeInteractionCanvas`'s button-highlight styling, no longer doing double duty for portrait resolution.

### 2. `COMMAND_OPEN_DIALOGUE` (new)

```ts
// CommandType
| "COMMAND_OPEN_DIALOGUE"

// StateCommandSchema entry
z.object({
  type: z.literal("COMMAND_OPEN_DIALOGUE"),
  payload: z.object({ dialogueId: z.string() }).strict(),
}),

// commands.ts handler
COMMAND_OPEN_DIALOGUE: (state, payload) => {
  const { dialogueId } = payload as { dialogueId: string };
  return { ...state, activeDialogue: { dialogueId } };
},
```
Dispatched as a second, separate `dispatchCommand` call immediately after `COMMAND_ENTER_DIALOGUE_NODE`, everywhere a dialogue is opened: `handleSelectActor` (existing actor-click path), the new entry-effect executor (below), and — for free, per decision 4 — any `onSuccessCommands`/`onFailureCommands` array that lists both commands in sequence (the existing per-command loop in `COMMAND_RESOLVE_MINIGAME`'s handler already applies a command list one at a time; no change needed there).

### 3. Closing `activeDialogue` — **flagged, not yet decided** (see Open Questions)

Three places currently call `DialogueOverlay`'s `onClose` prop (→ today, `setOpenDialogueId(null)`): the new "Close" button, an ending choice (`nextNodeId === undefined` in `handleSelectChoice`), and `NodeInteractionCanvas.onLeave`. None of this was covered by the four scoping decisions. Proposed, symmetric with how opening works: a new `COMMAND_CLOSE_DIALOGUE` (empty payload), mirroring `COMMAND_CANCEL_MINIGAME` exactly (`(state) => ({ ...state, activeDialogue: null })`), dispatched from all three sites instead of calling a local closer. This keeps `COMMAND_SELECT_DIALOGUE_CHOICE`'s contract unchanged (still just "advance progress + run consequences") rather than teaching it to also clear visibility on an ending choice — same reasoning decision 2 already applied to keep opening out of `COMMAND_ENTER_DIALOGUE_NODE`. Flagging this as a proposal requiring explicit confirmation, not a decided point, since it wasn't in the scoping round's four decisions.

### 4. Entry-effects registry generalization

`App.tsx`'s two effect-trigger functions become effect *computation* + a shared executor:

```ts
type EntryEffect =
  | { type: "SOUND"; asset: string }
  | { type: "DIALOGUE"; dialogueId: string; nodeId?: string };

function computePoiEntryEffects(
  poi: (typeof pois)[number],
  activeEndeavors: PlayerState["activeEndeavors"]
): EntryEffect[] {
  const effects: EntryEffect[] = [];
  if (poi.entrySoundAsset) effects.push({ type: "SOUND", asset: poi.entrySoundAsset });
  for (const [endeavorId, progress] of Object.entries(activeEndeavors)) {
    const trigger = endeavorsById[endeavorId]?.phases[progress.currentPhaseId]?.autoDialogueOnEnter;
    if (trigger && trigger.poiId === poi.id) {
      effects.push({ type: "DIALOGUE", dialogueId: trigger.dialogueId, nodeId: trigger.nodeId });
    }
  }
  return effects;
}
```
District's equivalent stays sound-only in *capability* (`autoDialogueOnEnter` is POI-scoped, see below) but is proposed to route through the same `EntryEffect[]`/executor shape rather than keep its own bespoke function, so there's one code path instead of two near-duplicates. Flagged as a minor judgment call, not load-bearing either way.

The **executor** moves inside `App()` (not a top-level function, per decision 3) since dialogue effects need `dispatchCommand`/`dialogues`/`dialogueProgress` from component scope:

```ts
function executeEntryEffect(effect: EntryEffect) {
  if (effect.type === "SOUND") {
    playSound(effect.asset);
    return;
  }
  const nodeId = effect.nodeId ?? resolveDialogueEntryNodeId(dialogues[effect.dialogueId], dialogueProgress[effect.dialogueId]);
  dispatchCommand({ type: "COMMAND_ENTER_DIALOGUE_NODE", payload: { dialogueId: effect.dialogueId, nodeId } });
  dispatchCommand({ type: "COMMAND_OPEN_DIALOGUE", payload: { dialogueId: effect.dialogueId } });
}
```
Call sites: `onSelectPoi` (replacing the current inline `entrySoundAsset` check) and the district mount `useEffect` (replacing `triggerDistrictEntryEffects`).

### 5. `EndeavorPhase` schema addition

```ts
export const EndeavorPhaseSchema = z.object({
  id: z.string(),
  objectiveText: z.string(),
  requiredClues: z.array(z.string()).optional(),
  nextPhaseOnSuccess: z.string().optional(),
  unlocksNodesOnComplete: z.array(z.string()),
  autoDialogueOnEnter: z
    .object({
      poiId: z.string(),
      dialogueId: z.string(),
      nodeId: z.string().optional(), // omitted = resolveDialogueEntryNodeId's normal resume/start logic
    })
    .strict()
    .optional(),
});
```
Purely additive/optional — no existing `EndeavorPhase` content needs to change to stay valid.

## Integration points

- `handleSelectActor` (`App.tsx`) — dispatches `COMMAND_ENTER_DIALOGUE_NODE` + `COMMAND_OPEN_DIALOGUE` instead of `dispatchCommand` + `setOpenDialogueId`. Correct moment: unchanged, still "player clicked an actor."
- `onSelectPoi` (`App.tsx`) — replaces the inline `entrySoundAsset` check with `computePoiEntryEffects(...).forEach(executeEntryEffect)`. Correct moment: unchanged, still POI selection.
- District mount `useEffect` — same swap for `triggerDistrictEntryEffects`.
- `DialogueOverlay`'s Close button, ending-choice branch, and `NodeInteractionCanvas.onLeave` — each dispatches the proposed `COMMAND_CLOSE_DIALOGUE` (pending confirmation, see Open Questions) instead of calling a local closer prop. `DialogueOverlay`'s `onClose` prop likely goes away entirely once closing is store-driven — App.tsx would derive `activeDialogue === null` reactively rather than being told to close imperatively. Flagged alongside the close-command question, since the two are the same decision.

## Reachability

The `activeDialogue`/`COMMAND_OPEN_DIALOGUE` migration is immediately reachable — every existing dialogue-open path (Mara Venn, actor-click) already exercises it, unchanged from the player's perspective. The **new** `autoDialogueOnEnter` capability itself has **no content instance yet** — `endeavor_the_missing_broadsheet.json`'s phases don't currently want one (the existing flow is entirely actor-click-driven). This spec makes the engine capability real and tested; wiring an actual phase to use it is content work, sequenced after this lands (`feature-workflow.md` §2 stage 3) — same "engine-only, no in-content trigger yet" shape as `feature_rapier_duel.md`.

## Consistency check

- `docs/web-implementation.md` §3's "Ephemeral UI selection state stays local, not in `PlayerState`" bullet currently cites dialogue visibility as the example of state that stays local — that sentence becomes false and needs rewriting once this lands.
- `docs/decisions.md` has an entry ("Actor-selection state... kept as local React state, not added to `PlayerState`") that this spec partially reverses (dialogue-open state moves to the store; actor-button-highlight selection state does not). Needs a "Reversed, partially" follow-up entry in the same style already used once before for the `COMMAND_UNLOCK_CLUE`-as-completion-flag reversal.
- `game-design-spec.md` Open Design Gap #9's `triggerPoiEntryEffects`/`triggerDistrictEntryEffects` sentence needs updating to reflect the generalization, without overclaiming the rest of gap #9 as resolved.

## Environment notes

None.

## Test plan

- `commands.test.ts`: `COMMAND_OPEN_DIALOGUE` sets `activeDialogue`; `COMMAND_CLOSE_DIALOGUE` (pending confirmation) clears it unconditionally, no-op when already null, mirroring existing `COMMAND_CANCEL_MINIGAME` tests.
- `playerStore.test.ts`: `activeDialogue` included in the persisted-keys assertion (mirrors the existing `activeMinigame` coverage in `persistence.test.ts`).
- A new test module for the entry-effects computation (`computePoiEntryEffects` or wherever it ends up living testably) covering: sound-only, dialogue-only, both, neither, and the case where an active endeavor's phase has `autoDialogueOnEnter` for a *different* POI (must not fire).
- `App.tsx`-level behavior (portrait resolving via `dialogueId` reverse lookup instead of `selectedActorId`) is presently untested at the component level (no `App.test.tsx` exists) — flagged as a pre-existing gap this spec doesn't newly introduce, not something it's expected to close either.
- Referential integrity: extend `content-integrity.test.ts` to check `EndeavorPhase.autoDialogueOnEnter.poiId -> POI` and `.dialogueId -> Dialogue`, mirroring the existing `Actor.dialogueId -> Dialogue` check added when dialogue branching landed.

## Content-schema scaling note

`autoDialogueOnEnter` is a new optional field with no `.default(...)`, so the `App.tsx` parse-on-load reachability concern (`web-implementation.md`'s Content Loading section) doesn't apply — an omitted field is `undefined` whether parsed or raw, same as `DialogueRequirementSchema`'s `requires` field already is.

## Open questions / explicitly deferred scope

1. **How `activeDialogue` gets cleared — not yet decided.** Proposed: a new `COMMAND_CLOSE_DIALOGUE`, symmetric with `COMMAND_OPEN_DIALOGUE` and mirroring `COMMAND_CANCEL_MINIGAME`'s precedent. Needs explicit confirmation before implementation (see Design §3 / Integration points).
2. **District's entry-effect function routed through the same `EntryEffect[]` shape as POI's, even though it can only ever produce a `SOUND` effect today** — minor, either way works, flagged so it isn't an accidental inconsistency.
3. **No content authored yet** exercising `autoDialogueOnEnter` — deliberate, see Reachability. A follow-up Content/Adventure spec would author the actual trigger (e.g. for a scene the "A Debt in Steel" endeavor wants).
4. Whether `DialogueOverlay` should keep an `onClose` prop at all once closing is store-driven, or whether `App.tsx` should stop rendering it once `activeDialogue` is null (the way `MinigameOverlay` already returns `null` internally when `activeMinigame` is null) — a small structural choice, deferred to implementation, doesn't affect the command/schema design above either way.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "`activeDialogue` moves dialogue visibility into `PlayerState`...", "`COMMAND_OPEN_DIALOGUE`/`COMMAND_CLOSE_DIALOGUE`...", "`EndeavorPhase.autoDialogueOnEnter`...", "entry-effects registry generalized...".
- decisions.md: the partial reversal of the actor-selection-state decision, the portrait-resolution switch to a `dialogueId` reverse lookup, `DialogueOverlay` dropping `onClose` to follow `MinigameOverlay`'s precedent, and the `entryEffects.ts` extraction beyond the spec's original code sketch.

All three confirmed decisions from review landed as specified: `COMMAND_CLOSE_DIALOGUE` mirrors `COMMAND_CANCEL_MINIGAME` exactly; District's entry-effects route through the same `EntryEffect[]` shape as POI's; `DialogueOverlay` drops `onClose` following `MinigameOverlay`'s precedent (with `node`/`speakerImageAsset` still passed in, since only `App.tsx` has resolved content to give it).
