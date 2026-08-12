# Feature: Dialogue Branching System

## Goal

Replace `Actor.initialDialogue` (a single static string, with a hardcoded reputation-swap special-case for Mara Venn baked into `App.tsx`) with a real branching-dialogue mechanism: content-authored dialogue trees with requirement-gated choices and choice-triggered `StateCommand` consequences, resolved through the existing `applyCommand` pipeline. Mara Venn's tree is the one real content instance this phase ships, replacing her hardcoded reputation/endeavor logic with the general mechanism it was meant to prove exists.

## Classification

Feature/Engine.

## Existing-capability check

`Actor.initialDialogue: z.string()` had no branching, no persisted conversation state, and no requirement/consequence mechanism — `game-design-spec.md` Open Design Gap #6 names this explicitly. The only "branching" that existed was hand-rolled: `App.tsx` swapped in a different hardcoded string once `reputation.actors[MARA_ID] >= 10`, and unconditionally dispatched `COMMAND_ADJUST_REPUTATION`/`COMMAND_START_ENDEAVOR`/`COMMAND_ADVANCE_ENDEAVOR_PHASE` on every actor-name click, regardless of anything said in the (nonexistent) conversation.

Everything this phase needed already existed as a *pattern* to extend, not invent from scratch: `StateCommand`/`applyCommand` (dialogue choices dispatch through the same pipeline `COMMAND_RESOLVE_MINIGAME` already uses — no new dispatch mechanism), the `Shift`/`ShiftSchema` engine-type-owns/content-schema-derives precedent (applied to the new `DialogueRequirement`/`DialogueRequirementSchema` pair), and the `NodeInteractionAction { id, label, disabled?, onClick }` pass-all-flag-unavailable pattern (applied to dialogue choices — unavailable choices render disabled, not hidden).

**Does this change what an existing primitive means to its other consumers?** `StateCommandSchema` is restructured from a loose `{ type, payload: Record<string, unknown> }` schema into a `.strict()` discriminated union. This doesn't change what any existing command *means* — every payload shape stays identical, only now enforced at parse time instead of silently accepted. `COMMAND_UNLOCK_CLUE`/other existing commands keep their existing semantics untouched; nothing is repurposed (the category-B mistake this project has hit before, `feature_dice_minigame.md`).

**Breaking change, deliberately not migration-shimmed:** `Actor.initialDialogue: z.string()` → `Actor.dialogueId: z.string()`. One actor in the project, no live players, `resetProgress()` already establishes save data isn't precious at this stage — a compatibility layer for a one-file rename would be over-engineering relative to everything else this project has kept minimal.

## Integration points

- **`COMMAND_ENTER_DIALOGUE_NODE`** — dispatched from `App.tsx`'s actor-selection handler, unconditionally, whenever an actor with a `dialogueId` is selected. Correct moment: opening or resuming a conversation is exactly what this command represents; it carries no `commands` field by construction, so it cannot have side effects.
- **`COMMAND_SELECT_DIALOGUE_CHOICE`** — dispatched from `DialogueOverlay` on every choice click, unconditionally (mirrors the existing `COMMAND_CANCEL_MINIGAME`-on-Leave precedent: a real dispatch even when the choice's `commands` array is empty and it ends the conversation).
- **`DialogueOverlay` mount point** — `App.tsx`, as a sibling of `MinigameOverlay`, not nested inside `NodeInteractionCanvas`. Same reasoning as the existing overlay: dialogue is a full-viewport modal interaction, not part of the POI canvas's own layout.
- **Mara's reputation bump / endeavor start / endeavor phase advance** — moved from unconditional `App.tsx` click-handler side effects into `commands` arrays on specific dialogue choices in `dialogue_mara_venn.json` (`choice_ask_about_broadsheet`, `choice_ask_again`, `choice_thank_and_advance`). This is a deliberate behavior change, confirmed with the project owner before implementation: reputation now accrues from engaging in conversation choices, not from any click on the actor's name.

## Reachability

Verified via the dev-only Reset Progress button + reload (not hand-clearing `localStorage`), per `feature-workflow.md` §2 stage 7: from a fresh save, walk to the tavern, select Mara Venn, and complete the full path — `choice_ask_about_broadsheet` (reputation 0→5, endeavor starts at `phase_ask_around`) → `node_engaged` → `choice_ask_again` (reputation 5→10) → `choice_press_for_lead` (now available, was disabled below 10) → `node_lead_revealed` → `choice_thank_and_advance` (endeavor advances to `phase_confront_the_buyer`, conversation ends). This reaches the reputation-gated line and the endeavor-completion action ("Pay off the buyer") within a single conversation, not two separate approaches — the tree was deliberately shaped (a self-looping `choice_ask_again` in `node_engaged`) so this reachability holds without needing to leave and re-approach Mara.

## Consistency check

Grepped for `initialDialogue`, `MARA_ID`, `MARA_LEAD_DIALOGUE`, `REPUTATION_THRESHOLD_FOR_LEAD`, and `selectedActor.initialDialogue` across `src/` and `docs/` after implementation — all removed or updated, no stale references left. `NodeInteractionCanvas`'s prop surface (`selectedActor` → `selectedActorId`) and its existing component test were updated together, not left referencing the removed shape.

## Environment notes

None — purely client-side content/store/component change, no CI-specific behavior.

## Test plan

- `commands.test.ts`: `COMMAND_ENTER_DIALOGUE_NODE` visit-count increment and cross-dialogue isolation; `COMMAND_SELECT_DIALOGUE_CHOICE` advancing state and running `commands`, `nextNodeId: null` skipping the `dialogueProgress` update without skipping `commands`, empty `commands` as a no-op beyond the transition.
- `evaluator.test.ts` (new): one case per `DialogueRequirement` field (`requiredClues`, `minActorReputation`, `minFactionReputation`, `allowedShifts`, `nodeVisits` — including the omitted-`nodeId`-means-current-node and the already-incremented-before-evaluation semantics from the design doc), `undefined` requirement → always available, and `resolveDialogueEntryNodeId`'s three cases (no progress, valid saved node, stale saved node with dev-only warning).
- `schemas.test.ts`: valid `DialogueSchema` fixture; invalid cases — missing `startNodeId`, an unknown command type inside `choices[].commands`, `.strict()` rejecting an unexpected payload key on an existing command.
- `content-integrity.test.ts`: new `dialogues` content group; `Actor.dialogueId -> Dialogue` referential check; dialogue node id/reference consistency (node key matches its own `id`, `startNodeId` resolves, every `nextNodeId` resolves).
- `persistence.test.ts`: `"dialogueProgress"` added to the hardcoded sorted persisted-key array — this is a real regression guard (the test fails immediately if the field is added to the store but not threaded through `extractPlayerState`).
- `components/DialogueOverlay.test.tsx` (new): renders nothing when no node is open; renders node text and all choices; a choice with an unmet `requires` renders disabled but still present; clicking an available choice dispatches `COMMAND_SELECT_DIALOGUE_CHOICE` with `nextNodeId: choice.nextNodeId ?? null`; an ending choice (`nextNodeId` undefined) calls `onClose`, a continuing choice does not.

## Content-schema scaling note

New content group (`dialogues`) added to `content-integrity.test.ts`'s existing glob-based `contentGroups` array — automatically covers any future dialogue file with zero further test changes, same pattern already used for the other five content types.

## Open questions / explicitly deferred scope

- **`CommandType` (TS union) and `StateCommandSchema` (Zod discriminated union) are now two independently-maintained lists** that must stay in sync by hand — `CommandType` includes `COMMAND_NEXT_DAY` (used by `applyCommand`'s internal throw-check), `StateCommandSchema` deliberately excludes it. Nothing enforces "every dispatchable `CommandType` has exactly one `StateCommandSchema` member" at compile time. Accepted debt for this phase; a type-level consistency check would need its own design and is out of scope here.
- **`evaluateDialogueRequirement`'s signature deviates from the design doc's literal two-argument sketch** (`playerState`, `requirement?`) — it needs the current node id and dialogue id to resolve `nodeVisits`' omitted-`nodeId` case and to key into `dialogueProgress`, so the actual signature is `(playerState, requirement, currentNodeId, dialogueId)`. Mechanical necessity, not a design disagreement.
- **`dispatchCommand`'s input at the `playerStore.ts` boundary is still unvalidated at runtime** — the discriminated union guarantees content is well-formed at test/CI time and on save-file import only, exactly as scoped in the design doc. `App.tsx` and `DialogueOverlay.tsx` dispatch sites remain TypeScript-only. Real, separate future work, not touched here.
- **Reputation gain via `choice_ask_again` stays uncapped and cooldown-free**, matching the old code's behavior exactly — `game-design-spec.md` Open Design Gap #7 is left exactly as open as before, just relocated from an `App.tsx` click handler into dialogue-choice content.
- **`nodeVisits` is not exercised in `dialogue_mara_venn.json`'s content** — the task's explicit ask was `requires`/`commands`/ends-with-consequences coverage, all three of which the tree exercises without needing `nodeVisits`. Coverage for that field lives at the unit-test level (`evaluator.test.ts`) only.
- **Resolving `game-design-spec.md` open gap #7** (what reputation gain should actually gate/trigger generally) and **any second endeavor or dialogue tree beyond Mara Venn's** are explicitly out of scope for this phase.
- **`content-integrity.test.ts`/`schemas.test.ts` validate the schema-conformant shape, not the raw runtime shape `App.tsx` actually consumes — a real, generalizable gap, not unique to `commands`.** Confirmed empirically: temporarily removing `choice_press_for_lead`'s `"commands": []` from `dialogue_mara_venn.json` and re-running both test files still passed 48/48 — Zod's `.default([])` fills the field in during `safeParse`, and the tests only assert on the parsed-and-defaulted result. `App.tsx` never calls `.parse()`/`.safeParse()` on content JSON (static `import`, per the design doc's §2 validation-scoping note); it consumes the raw, undefaulted object, so a choice omitting `commands` reached `COMMAND_SELECT_DIALOGUE_CHOICE`'s handler as `undefined` and crashed (`commands is not iterable`) despite every test passing. Fixed for `commands` with a defensive `commands ?? []` in the handler (see `commands.ts`). `DialogueNodeSchema.choices: z.array(DialogueChoiceSchema).default([])` has the identical exposure — `DialogueOverlay` does `node.choices.map(...)` with no fallback, so a future node that omits `choices` would throw the same way, undetected by either test file — not fixed here since no current content triggers it and the task's scope was `requires`/`commands` specifically, but flagged so it isn't rediscovered as a surprise. `DialogueChoiceSchema.requires` is not exposed to this class of bug: it's `.optional()` with no `.default()`, so omitted and parsed-but-absent both correctly produce `undefined`, and `evaluateDialogueRequirement`'s first line (`if (!requirement) return true;`) already treats that as "no requirement" — confirmed by the existing "returns true when no requirement is given" test in `evaluator.test.ts`, no gap, no fix needed. General takeaway for future optional-with-`.default()` content fields: either give the consuming code a defensive `?? default` at the point of use (as done for `commands`), or stop relying on static JSON `import` and route content through its schema's `.parse()` at load time — the latter is the real fix but is exactly the larger, separate `dispatchCommand`/content-loading validation work already noted above as out of scope.

  **Update, closed as a follow-up in the same phase:** the loading-boundary fix above was implemented — `src/contentLoader.ts`'s `loadContent` now runs every `App.tsx` content import through its schema, so `DialogueNodeSchema.choices` is covered by the same mechanism without needing its own defensive patch. See `docs/decisions.md` (2026-08-11) for the full audit and rationale. `dispatchCommand`'s own input validation at the `playerStore.ts` boundary remains explicitly out of scope, unaffected by this fix.

## Status

Implemented. CHANGELOG: `[Unreleased]` — "Branching dialogue system…", "Referential-integrity checks…extended to cover `Actor.dialogueId -> Dialogue`…", "`StateCommandSchema` restructured…", "**Breaking:** `Actor.initialDialogue`…replaced by `Actor.dialogueId`…", "Mara Venn's reputation gain…moved from unconditional `App.tsx` click-handler side effects into `commands`…".
