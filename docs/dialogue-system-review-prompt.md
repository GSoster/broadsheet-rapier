# Design Review Request: Dialogue-Branching System (Broadsheet & Rapier / Thornwall Engine)

**Revision note:** this is the second pass. The custom Zod-tree recommendation stood after the first review, but five structural issues and four smaller gaps were found and are resolved below — not appended as notes, but built into the schema/command sketch itself. Where the first pass left something as an open question, this pass makes a decision and states it.

## What I need from you

Check whether the decisions below actually hold up, and whether resolving them introduced any new problems. This should now be spec-ready — if you find something that still isn't pinned down, say so explicitly rather than assuming it's implied.

## Project context

React 19 + TypeScript (strict) + Vite + Tailwind + Zustand + Zod 4 + Framer Motion + Vitest. Runtime dependencies today: `framer-motion`, `lucide-react`, `react`, `react-dom`, `zod`, `zustand`.

Architecture is CQRS-inspired. UI dispatches `StateCommand` objects; command handlers in `src/engine/store/commands.ts` are pure functions `(PlayerState, payload) -> PlayerState`, collected in a `handlers` record and invoked through a single `applyCommand(state, command)` entry point. `src/engine/` never imports from `src/content/`; content-derived data crosses the boundary via payloads/props supplied by a caller outside `src/engine/` (`App.tsx`).

Current types (`src/engine/types/index.ts`), unchanged from the first pass:

```typescript
export type CommandType =
  | "COMMAND_ADVANCE_SHIFT"
  | "COMMAND_UNLOCK_NODE"
  | "COMMAND_MOVE_TO_SETTLEMENT"
  | "COMMAND_MOVE_TO_DISTRICT"
  | "COMMAND_MOVE_TO_POI"
  | "COMMAND_ADJUST_CURRENCY"
  | "COMMAND_ADJUST_REPUTATION"
  | "COMMAND_ADD_ITEM"
  | "COMMAND_REMOVE_ITEM"
  | "COMMAND_UNLOCK_CLUE"
  | "COMMAND_START_ENDEAVOR"
  | "COMMAND_ADVANCE_ENDEAVOR_PHASE"
  | "COMMAND_START_MINIGAME"
  | "COMMAND_RESOLVE_MINIGAME"
  | "COMMAND_CANCEL_MINIGAME"
  | "COMMAND_NEXT_DAY";

export interface StateCommand<T = Record<string, unknown>> {
  type: CommandType;
  payload: T;
}
```

`applyCommand` already treats `COMMAND_NEXT_DAY` as internal-only:

```typescript
type DispatchableCommandType = Exclude<CommandType, "COMMAND_NEXT_DAY">;

export function applyCommand(state: PlayerState, command: StateCommand): PlayerState {
  if (command.type === "COMMAND_NEXT_DAY") {
    throw new Error(
      "COMMAND_NEXT_DAY is internal-only and cannot be dispatched directly; it runs as part of COMMAND_ADVANCE_SHIFT."
    );
  }
  const handler = handlers[command.type];
  return handler(state, command.payload);
}
```

`commands.ts` already has one precedent for a public command delegating to a private helper: `COMMAND_ADVANCE_SHIFT`'s handler calls `applyAdvanceShift`, which internally calls the non-dispatchable `applyNextDay` when the shift rolls from `NIGHT`. The dialogue command split below (issue 4) follows this exact shape.

`docs/decisions.md` has two precedents load-bearing for this revision:

*The `Shift` type lives in `src/engine/types/index.ts` (`SHIFTS` array, `Shift` type). `src/content/schemas/shared.ts` imports `SHIFTS` from `../../engine/types` and builds `ShiftSchema = z.enum(SHIFTS)` from it — the Zod schema is derived from the engine type, never the reverse. Confirmed in the current code, not just asserted.*

*`COMMAND_UNLOCK_CLUE` was briefly reused as an endeavor-completion marker (dispatching it with a dedicated clue id to signal "this phase is paid off"), then reverted: "repurposing `unlockedClues` (meant for narrative discoveries) as a mechanical 'already paid' flag was the wrong call — it solved a real problem... by overloading a system that means something else." The fix was removing the overload entirely, not relocating it to a different existing field.*

Also relevant, `web-implementation.md` §3: POI-level actions are a generic `actions?: NodeInteractionAction[]` prop, each shaped `{ id, label, disabled?, onClick }` — unavailable actions are passed through and marked `disabled`, not filtered out of the array before it reaches the component.

And `src/engine/audio/playSound.ts`'s documented split: a failed image load is loud (`AssetFallback` renders a visible "MISSING" placeholder, because content authors need to catch it), a failed sound load is silent to the player but `console.warn`'d in `import.meta.env.DEV`, because "an audible glitch or a thrown error would be a worse player experience than simply no sound."

`src/engine/store/playerStore.ts` has three places a new `PlayerState` field must be threaded through, confirmed by reading the file rather than assumed: `initialPlayerState` (the reset/default value), `extractPlayerState` (an explicit field-by-field allowlist — a field can exist on the Zustand store via spread and still be silently absent from export/persistence if it's not listed here), and `PlayerStateSchema` (import validation). `src/__tests__/persistence.test.ts` independently pins the exact persisted key set with a hardcoded sorted array, so a forgotten field fails that test immediately rather than silently.

`src/__tests__/content-integrity.test.ts` has two describe blocks: one that runs every real content file (enumerated via `import.meta.glob`) through its Zod schema, and one for referential integrity — cross-file id references that Zod's per-file validation can't catch (e.g. `Actor.factionIds -> Faction`, `POI.actorIds -> Actor` plus the reverse `Actor.poiId`, `District.poiIds -> POI` plus the reverse `POI.districtId`). It's explicit that this is a deliberately scoped, extensible pattern, not a general mechanism.

## 1. Reframed recommendation

Bundle size was the first pass's headline argument. That's the wrong argument: `framer-motion` alone already outweighs inkjs (127KB min/31KB gzip) or `yarn-bound` (48KB min/11.6KB gzip) by a wide margin, so "the custom option is lighter" isn't actually a meaningful differentiator in a codebase that already ships Framer Motion. Dropping it as the headline.

The real case for the custom Zod tree is architectural, and it's threefold. It needs no state-sync bridge: ink and Yarn Spinner both hold dialogue state (variables, current knot, visit counts) in their own runtime object, separate from `PlayerState`, which means every reputation/clue/shift check and every command-triggering choice has to cross a translation layer in both directions. The custom tree has no second state object — the evaluator and the interpolation resolver read `PlayerState` directly. It needs no second content format: dialogue becomes another JSON content type validated by Zod, consistent with `settlements/`, `districts/`, `pois/`, `actors/`, `factions/`, `endeavors/`, instead of `.ink` or `.yarn` files sitting outside that convention. And it reuses the existing command mechanism directly: a choice's `commands: StateCommand[]` is resolved through the same `applyCommand` loop `COMMAND_RESOLVE_MINIGAME` already uses, with no new dispatch mechanism to build.

One correction to the first pass: the objection to ink's save-state handling was stated inaccurately. `story.state.ToJson()` produces real, well-formed JSON — the actual problem is that it's JSON with a shape this project's Zod schemas don't know about and don't validate, an opaque blob next to a `PlayerState` where every other field is typed and schema-checked. That's a real inconsistency, just not "it isn't JSON."

One argument the first pass missed: a Zod schema is something a model can be asked to produce as reliable structured output. If AI-assisted content authoring is a plausible future direction for this project (the current pass with visit counts already turned "reduce dialogue to prose plus a small formatted schema" into an explicit non-concern for authoring), that's a real point in favor of a schema-shaped format specifically, and not one that transfers to ink's or Yarn's bespoke script syntax, which a model would have to be taught as a second language rather than asked to fill in a known JSON shape.

## 2. `StateCommandSchema` as a discriminated union

The current schema is too loose for content-authored commands specifically:

```typescript
const StateCommandSchema: z.ZodType<StateCommand> = z.object({
  type: z.enum([...]),
  payload: z.record(z.string(), z.unknown()),
});
```

A dialogue choice's `commands` array is authored content, increasingly likely to be AI-authored content — not application code written by someone who'll hit a TypeScript compile error on a typo'd field. Right now a malformed payload (missing `denomination`, an extra unrelated key, `amount` as a string) passes `safeParse` and only fails when `applyCommand` actually runs the handler and destructures the payload. This looseness already exists for `MinigameLauncherPayload.onSuccessCommands`/`onFailureCommands`, but dialogue is what makes it urgent, since dialogue commands are the first case where command arrays are meant to be written by something other than the person who wrote the handler code.

Restructured as a discriminated union, one payload schema per command, `.strict()` so unexpected keys fail validation instead of being silently stripped:

```typescript
const StateCommandSchema: z.ZodType<StateCommand> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("COMMAND_ADVANCE_SHIFT"), payload: z.object({}).strict() }),
  z.object({
    type: z.literal("COMMAND_UNLOCK_NODE"),
    payload: z.object({ nodeId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_MOVE_TO_SETTLEMENT"),
    payload: z.object({ settlementId: z.string(), districtId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_MOVE_TO_DISTRICT"),
    payload: z.object({ districtId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_MOVE_TO_POI"),
    payload: z.object({ poiId: z.string(), costShifts: z.number().optional() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADJUST_CURRENCY"),
    payload: z
      .object({ denomination: z.enum(["gold", "silver", "bronze"]), amount: z.number() })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADJUST_REPUTATION"),
    payload: z
      .object({ targetType: z.enum(["faction", "actor"]), targetId: z.string(), amount: z.number() })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADD_ITEM"),
    payload: z.object({ itemId: z.string(), quantity: z.number() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_REMOVE_ITEM"),
    payload: z.object({ itemId: z.string(), quantity: z.number() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_UNLOCK_CLUE"),
    payload: z.object({ clueId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_START_ENDEAVOR"),
    payload: z.object({ endeavorId: z.string(), initialPhaseId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADVANCE_ENDEAVOR_PHASE"),
    payload: z
      .object({
        endeavorId: z.string(),
        nextPhaseId: z.string(),
        unlocksNodesOnComplete: z.array(z.string()).optional(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_START_MINIGAME"),
    payload: z.lazy(() => MinigameLauncherPayloadSchema),
  }),
  z.object({
    type: z.literal("COMMAND_RESOLVE_MINIGAME"),
    payload: z.object({ isVictory: z.boolean() }).strict(),
  }),
  z.object({ type: z.literal("COMMAND_CANCEL_MINIGAME"), payload: z.object({}).strict() }),
]);

const MinigameLauncherPayloadSchema: z.ZodType<MinigameLauncherPayload> = z.object({
  type: z.enum(["DUEL", "LOCKPICKING", "FISHING", "DICE"]),
  sourceId: z.string(),
  config: z.record(z.string(), z.unknown()),
  onSuccessCommands: z.lazy(() => z.array(StateCommandSchema)),
  onFailureCommands: z.lazy(() => z.array(StateCommandSchema)),
});
```

Note the `z.lazy()` on both sides of the `StateCommandSchema` <-> `MinigameLauncherPayloadSchema` reference: `COMMAND_START_MINIGAME`'s payload is a `MinigameLauncherPayload`, whose own two command-array fields are `StateCommand[]`. That's genuine mutual recursion and needs `z.lazy()` to defer evaluation until both schemas exist. This resolves the first pass's open question about recursion the other way round — the dialogue schema itself turned out not to need it (see issue 3), but this did.

`COMMAND_NEXT_DAY` is not a member of this union at all, which is the resolution to gap (a) below.

**Scoping decision: where does this validation actually run?** Checked directly against the code rather than assumed. `dispatchCommand` in `playerStore.ts` calls `applyCommand(extractPlayerState(store), command)` directly — there is no `StateCommandSchema.parse`/`safeParse` call anywhere on that path. Every handler in `commands.ts` still does a raw `payload as {...}` cast, and `App.tsx`'s own `dispatchCommand` call sites (`COMMAND_ADJUST_REPUTATION`, `COMMAND_START_MINIGAME`, `COMMAND_MOVE_TO_POI`, etc.) are plain TypeScript object literals, checked by the compiler, never run through the schema at runtime. Content JSON is loaded the same way: `App.tsx` does `import actor from "./content/actors/actor_mara_venn.json"`, a static import with no runtime `.parse()` call. The only place any of these schemas run against real data outside a test file is `parseAndValidateSave` (`PlayerStateSchema.safeParse`, used for save-file import) — and that does reach nested `StateCommand[]` fields, since `activeMinigame`'s `MinigameLauncherPayloadSchema` is part of `PlayerStateSchema`. Everything else — `ActorSchema`, `DialogueSchema`, and by extension `DialogueChoiceSchema.commands` — is only ever exercised inside `content-integrity.test.ts` and `schemas.test.ts`, both of which run under `npm run test`, not in the shipped app.

So, stated explicitly: this discriminated union guarantees content is well-formed at test/CI time — a malformed dialogue choice fails a test before merge, the same guarantee `content-integrity.test.ts` already gives every other content type — and it guarantees a valid shape on save-file import. It adds no runtime protection to commands dispatched from application code (`App.tsx` today, `DialogueOverlay.tsx` once it exists). Those remain TypeScript-only, exactly as before this revision, and remain exposed to the same class of `payload`/handler mismatch the schema change was meant to close for content. Closing that second gap — validating `dispatchCommand`'s input at the `playerStore.ts` boundary itself — is a separate, larger change; it would touch every dispatch call site in the app, not just dialogue, and is out of scope here. Noted explicitly so the boundary of what this fix buys isn't left implied.

## 3. Referential integrity, extending the existing test file

New describe block in `src/__tests__/content-integrity.test.ts`, following its existing shape exactly (a `contentGroups` entry for schema validation, a describe block for cross-reference checks against the already-loaded id sets) rather than a separate mechanism:

```typescript
// add to contentGroups:
{ label: "dialogues", schema: DialogueSchema, files: import.meta.glob("../content/dialogues/*.json", { eager: true }) },

// add alongside the existing top-level id sets (factionIdSet, actorIdSet, poiIdSet) —
// same scope, same pattern, not nested inside a describe block:
const dialogues = loadAll(groupFiles("dialogues"));
const dialogueIdSet = new Set(dialogues.map((dialogue) => dialogue.id as string));

// add to the referential-integrity section, alongside the existing three. This is the
// fourth cross-file relationship (Actor.dialogueId -> Dialogue), shown in full rather
// than described, matching how the other three are backed by real code:
describe("Actor.dialogueId -> Dialogue", () => {
  for (const actor of actors) {
    const dialogueId = actor.dialogueId as string;
    it(`${actor.id}.dialogueId references an existing dialogue ("${dialogueId}")`, () => {
      expect(dialogueIdSet.has(dialogueId)).toBe(true);
    });
  }
});

describe("Dialogue node id consistency and node references", () => {
  for (const dialogue of dialogues) {
    const nodes = dialogue.nodes as Record<string, { id: string; choices?: Array<{ nextNodeId?: string }> }>;
    const nodeKeys = new Set(Object.keys(nodes));

    for (const [key, node] of Object.entries(nodes)) {
      it(`${dialogue.id}.nodes["${key}"].id matches its own key`, () => {
        expect(node.id).toBe(key);
      });
    }

    it(`${dialogue.id}.startNodeId ("${dialogue.startNodeId}") resolves to a real node`, () => {
      expect(nodeKeys.has(dialogue.startNodeId as string)).toBe(true);
    });

    for (const [key, node] of Object.entries(nodes)) {
      for (const choice of node.choices ?? []) {
        if (choice.nextNodeId === undefined) continue; // omitted = ends the conversation, not a reference
        it(`${dialogue.id}.nodes["${key}"] choice references an existing node ("${choice.nextNodeId}")`, () => {
          expect(nodeKeys.has(choice.nextNodeId as string)).toBe(true);
        });
      }
    }
  }
});
```

`Actor.dialogueId -> Dialogue` follows the file's existing convention exactly: a top-level id set built once (`dialogueIdSet`, same shape as `factionIdSet`/`actorIdSet`/`poiIdSet`), then one `it` per actor checking membership — no new mechanism, just the fourth instance of the pattern already used three times.

## 4. Splitting the dialogue command

The first pass's single `COMMAND_ADVANCE_DIALOGUE` inferred "did this have consequences" from whether its `commands` array happened to be empty — the same category of mistake as the reverted `COMMAND_UNLOCK_CLUE`-as-completion-flag decision: using a field's incidental state to carry a meaning the field wasn't built to express. Splitting into two commands that mirror the existing `applyAdvanceShift`/`applyNextDay` public-handler-calls-private-helper shape:

```typescript
function enterDialogueNode(state: PlayerState, dialogueId: string, nodeId: string): PlayerState {
  const existing = state.dialogueProgress[dialogueId];
  const visitCounts = { ...(existing?.visitCounts ?? {}) };
  visitCounts[nodeId] = (visitCounts[nodeId] ?? 0) + 1;
  return {
    ...state,
    dialogueProgress: {
      ...state.dialogueProgress,
      [dialogueId]: { currentNodeId: nodeId, visitCounts },
    },
  };
}

// Pure bookkeeping: opening or resuming a conversation. No commands field in
// the payload shape at all — this command cannot have side effects, by
// construction, not by convention.
COMMAND_ENTER_DIALOGUE_NODE: (state, payload) => {
  const { dialogueId, nodeId } = payload as { dialogueId: string; nodeId: string };
  return enterDialogueNode(state, dialogueId, nodeId);
},

// Advances AND dispatches consequences. Always has a commands field (possibly
// empty), because a choice with no listed consequences is still explicitly
// "this was a choice selection," not "this was bookkeeping." nextNodeId is
// nullable at the command-payload level: null means "this choice ends the
// conversation," and is handled by skipping the dialogueProgress update
// entirely, not by substituting the current node id back in (which would
// double-count a visit to the node the player is leaving).
COMMAND_SELECT_DIALOGUE_CHOICE: (state, payload) => {
  const { dialogueId, nextNodeId, commands } = payload as {
    dialogueId: string;
    nextNodeId: string | null;
    commands: StateCommand[];
  };
  let next = nextNodeId === null ? state : enterDialogueNode(state, dialogueId, nextNodeId);
  for (const command of commands) {
    next = applyCommand(next, command);
  }
  return next;
},
```

Corresponding discriminated-union members:

```typescript
z.object({
  type: z.literal("COMMAND_ENTER_DIALOGUE_NODE"),
  payload: z.object({ dialogueId: z.string(), nodeId: z.string() }).strict(),
}),
z.object({
  type: z.literal("COMMAND_SELECT_DIALOGUE_CHOICE"),
  payload: z
    .object({
      dialogueId: z.string(),
      nextNodeId: z.string().nullable(),
      commands: z.lazy(() => z.array(StateCommandSchema)),
    })
    .strict(),
}),
```

**Confirmed explicitly: yes, a choice can have both `commands` and no `nextNodeId`** — "pay a price, then the conversation ends" is a real, supported case, not an oversight left standing. The previous wording ("a choice with no `nextNodeId` dispatches neither command") was wrong: as written, it meant an ending choice could never have consequences, which is a real restriction with no stated justification, so it's fixed rather than adopted.

Corrected call sites: opening or resuming a conversation dispatches `COMMAND_ENTER_DIALOGUE_NODE`, unconditionally. Selecting *any* choice dispatches `COMMAND_SELECT_DIALOGUE_CHOICE`, unconditionally — `DialogueOverlay` builds the payload as `{ dialogueId, nextNodeId: choice.nextNodeId ?? null, commands: choice.commands }`. This is a deliberate translation: `DialogueChoiceSchema.nextNodeId` stays `z.string().optional()` at the content level (omitted reads naturally as "ends the conversation" to an author), while the command payload uses `.nullable()` (`null` is an explicit runtime value, not an absent key) — the two are different types for a reason, and the `?? null` at the dispatch site is where that translation happens, not a mismatch. After dispatch, `DialogueOverlay` closes the view locally when `choice.nextNodeId` was undefined — that close is React state, not a `PlayerState` transition, consistent with the rest of this document.

This also means there's now exactly one rule for choice selection ("always dispatch `COMMAND_SELECT_DIALOGUE_CHOICE`") instead of a branch on whether the choice happens to end the conversation, and it mirrors an existing precedent rather than introducing a new one: `COMMAND_CANCEL_MINIGAME` is already dispatched for a no-consequence "leave" action in the minigame flow (`DiceGame`'s "Leave" button) rather than the UI silently closing without dispatching anything. A dialogue choice that ends the conversation with zero commands is the same shape — a real dispatch, just one whose `commands` array happens to be empty and whose `nextNodeId` happens to be `null`.

## 5. Boundary fix and where filtering actually happens

`DialogueRequirement`'s TypeScript shape belongs in `src/engine/types/index.ts`, with `dialogue.schema.ts`'s Zod schema derived from it — this is the `Shift`/`ShiftSchema` pattern applied consistently, not a new rule:

```typescript
// src/engine/types/index.ts
export interface DialogueRequirement {
  requiredClues?: string[];
  minActorReputation?: { actorId: string; value: number };
  minFactionReputation?: { factionId: string; value: number };
  allowedShifts?: Shift[];
  nodeVisits?: { nodeId?: string; min?: number; max?: number };
}
```

```typescript
// src/content/schemas/dialogue.schema.ts
import type { DialogueRequirement } from "../../engine/types";
import { ShiftSchema } from "./shared";

const DialogueRequirementSchema: z.ZodType<DialogueRequirement> = z.object({
  requiredClues: z.array(z.string()).optional(),
  minActorReputation: z.object({ actorId: z.string(), value: z.number() }).optional(),
  minFactionReputation: z.object({ factionId: z.string(), value: z.number() }).optional(),
  allowedShifts: z.array(ShiftSchema).optional(),
  nodeVisits: z
    .object({ nodeId: z.string().optional(), min: z.number().optional(), max: z.number().optional() })
    .optional(),
});

const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  nextNodeId: z.string().optional(),
  requires: DialogueRequirementSchema.optional(),
  commands: z.array(StateCommandSchema).default([]),
});

const DialogueNodeSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  text: z.string(),
  choices: z.array(DialogueChoiceSchema).default([]),
});

export const DialogueSchema = z.object({
  id: z.string(),
  startNodeId: z.string(),
  nodes: z.record(z.string(), DialogueNodeSchema),
});
```

No `z.lazy()` needed here — `nextNodeId` is a string id, not a nested node object, so `DialogueNodeSchema` doesn't reference itself.

The evaluator (`src/engine/utils/evaluator.ts`, `evaluateDialogueRequirement(playerState: PlayerState, requirement?: DialogueRequirement): boolean`) takes only engine types, no content import, so it's legitimately engine code — unlike content *lookup* (resolving a `dialogueId`/`nodeId` to an actual `DialogueNode`), which does require importing `src/content/` and therefore must happen in `App.tsx`, matching the `WorldNavigationView`/`NodeInteractionCanvas` precedent.

The two responsibilities split accordingly. `App.tsx` resolves `dialogueId` + `currentNodeId` (from `dialogueProgress`, or `startNodeId` if absent) to a `DialogueNode` and passes the whole node, unfiltered, as a prop to a new `src/engine/components/DialogueOverlay.tsx`. `DialogueOverlay` reads `PlayerState` from the store itself (it's an engine component, this is already how `MinigameOverlay` works) and calls `evaluateDialogueRequirement` per choice to compute availability.

Explicit decision on filtering vs. flagging: pass all choices through, annotate with a computed `isAvailable`, don't filter the array before it reaches the component. This matches the existing `NodeInteractionAction` shape (`{ id, label, disabled?, onClick }`) already used for POI actions in `web-implementation.md` §3 — unavailable options are represented, not omitted. `DialogueOverlay` renders unavailable choices disabled rather than hiding them.

## Smaller gaps

**(a) Excluding `COMMAND_NEXT_DAY` from content-authored command arrays.** Resolved structurally, not with a refinement or a separate test: `COMMAND_NEXT_DAY` is simply never a member of the `StateCommandSchema` discriminated union (section 2). Since every command array in the schema — `MinigameLauncherPayload.onSuccessCommands`/`onFailureCommands` and `DialogueChoice.commands` alike — is typed as `z.array(StateCommandSchema)`, no content file, dialogue or otherwise, can construct a validated `StateCommand` of that type. This is stronger than a refinement (which would need to duplicate the exclusion at every array site) or a content-integrity test (which only catches it after the fact); scoping the union correctly makes it a schema-level impossibility everywhere at once. `CommandType` (the TS union used internally, e.g. for `applyCommand`'s early-throw check) still includes `COMMAND_NEXT_DAY`, since it's a real internal value — only `StateCommandSchema`'s discriminated union excludes it.

**(b) Threading `dialogueProgress` through the full `PlayerState` lifecycle.** Explicitly, not assumed: add `dialogueProgress: Record<string, { currentNodeId: string; visitCounts: Record<string, number> }>` to `PlayerState` and `PlayerStateSchema`; add `dialogueProgress: {}` to `initialPlayerState` in `playerStore.ts`; add `dialogueProgress: store.dialogueProgress` to `extractPlayerState`; add `"dialogueProgress"` to the hardcoded sorted key array in `src/__tests__/persistence.test.ts`, which will otherwise fail the moment the field starts being persisted (a real regression guard, not just a maintenance chore). `resetProgress()` needs no separate change — it already resets to `initialPlayerState` wholesale.

**(c) Defensive fallback for a `currentNodeId` no longer present in content.** Dialogue trees are more likely to get restructured out from under existing saves than endeavor phases are, so this needs handling now, not later. Modeled on `playSound`'s split (silent/non-blocking for the player, logged for the developer), not `AssetFallback`'s (loud, dev-facing-by-design) — a missing dialogue node is a runtime data-consistency issue affecting a player mid-session, not a content-authoring mistake that should visibly break the screen:

```typescript
function resolveDialogueEntryNodeId(dialogue: Dialogue, progress?: { currentNodeId: string }): string {
  const candidateId = progress?.currentNodeId ?? dialogue.startNodeId;
  if (dialogue.nodes[candidateId]) return candidateId;
  if (import.meta.env.DEV) {
    console.warn(
      `[dialogue] "${dialogue.id}" has no node "${candidateId}" (saved progress is stale); falling back to startNodeId.`
    );
  }
  return dialogue.startNodeId;
}
```

Called from `App.tsx` alongside the content-lookup step, before a node is passed down as a prop — never inside the pure `PlayerState` reducer, consistent with `applyCommand` staying free of I/O and console output.

**(d) `nodeVisits` semantics, pinned down.** `nodeId` omitted means "the node this requirement is attached to" (the common case: gating on how many times the player has seen this specific line). `nodeId` set means an explicit cross-reference to a different node's visit count (e.g. gating a choice on having already reached some other node elsewhere in the tree). Before-vs-after: the increment in `enterDialogueNode` happens as part of the `COMMAND_ENTER_DIALOGUE_NODE`/`COMMAND_SELECT_DIALOGUE_CHOICE` handler, which always runs before the node is rendered or its choices evaluated — so `nodeVisits` reflects the count **after** the current visit is already registered, never before. Concretely: on the very first time a node is ever reached, `visitCounts[nodeId]` is already `1` by the time `DialogueOverlay` evaluates requirements for that render. A "first time seeing this" check is `nodeVisits: { max: 1 }`, not `min: 1` (which would be true on every visit, including the first, since 1 already satisfies "at least 1"). A "only after you've seen this before" check is `nodeVisits: { min: 2 }`.

## Status

Schema (`DialogueSchema`, `DialogueChoiceSchema`, `DialogueNodeSchema`, `DialogueRequirementSchema`), the restructured `StateCommandSchema`, the split commands (`COMMAND_ENTER_DIALOGUE_NODE`, `COMMAND_SELECT_DIALOGUE_CHOICE`), the `PlayerState`/`playerStore.ts`/`persistence.test.ts` threading, the fallback behavior, and the `nodeVisits` semantics are all resolved above. The two items the previous pass left open are now decided as well:

`Actor.initialDialogue: z.string()` becomes `Actor.dialogueId: z.string()` as a clean breaking change, no backward-compatibility layer. There is exactly one actor in the project (`actor_mara_venn.json`), no live players, and `resetProgress()` already establishes that save data isn't precious at this stage — a migration path for a one-file rename would be over-engineering relative to everything else this project has deliberately kept minimal. `actor.schema.ts` and `actor_mara_venn.json` get updated in the same phase as the rest of this feature, not staged separately.

`nodeVisits` staying a counting mechanism only, not a resolution of `game-design-spec.md` open gap #7 (what reputation gain should actually gate or trigger once a threshold is hit), is confirmed correct. Build the counting mechanism now; gap #7 stays open until a concrete feature — most likely the second endeavor — forces an actual answer. Nothing further to decide here.

This document is spec-ready: every schema, command, boundary, and fallback decision above is final pending review, not a placeholder.

Third pass closed three remaining items: the `StateCommandSchema` validation-scoping decision is now explicit (section 2), the `Actor.dialogueId -> Dialogue` referential-integrity check is now real code instead of a description (section 3), and `COMMAND_SELECT_DIALOGUE_CHOICE` now supports an ending choice with consequences via a nullable `nextNodeId`, fixing what was an unstated restriction (section 4). Nothing left open.
