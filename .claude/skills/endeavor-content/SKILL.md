---
name: endeavor-content
description: Author a new dialogue-driven Endeavor's content (phases, dialogues, Actors, POIs) for Broadsheet & Rapier, using only patterns confirmed real across the two Endeavors built so far.
---

# endeavor-content

Use this when authoring a new Endeavor's dialogue content — a phase
outline, its Dialogue JSON files, and any new Actors/POIs it needs.
Everything below is confirmed against two real, shipped
implementations (`dialogue_mara_venn.json` /
`endeavor_the_missing_broadsheet`, and the full `endeavor_a_debt_in_steel`
build — see `docs/features/content_a_debt_in_steel.md`), not
speculation about a pattern that might generalize. If a new Endeavor
needs something neither of those two actually did, that's a real gap —
flag it, don't guess.

This is content work, not engine work: per `docs/feature-workflow.md`
§2 stage 4, if anything here turns out to need a *new* command type,
schema field, or minigame type, that's a Feature/Engine spec
dependency, not something to invent inline.

## 1. Command payload cheat sheet

The single most common revision needed across every content draft so
far has been a guessed command payload shape turning out wrong. These
are the real shapes (`src/engine/types/index.ts`), copy-paste ready:

```json
{ "type": "COMMAND_ADJUST_CURRENCY", "payload": { "denomination": "gold" | "silver" | "bronze", "amount": 5 } }
{ "type": "COMMAND_ADJUST_REPUTATION", "payload": { "targetType": "faction" | "actor", "targetId": "faction_x", "amount": 5 } }
{ "type": "COMMAND_ADD_ITEM", "payload": { "itemId": "item_x", "quantity": 1 } }
{ "type": "COMMAND_REMOVE_ITEM", "payload": { "itemId": "item_x", "quantity": 1 } }
{ "type": "COMMAND_START_ENDEAVOR", "payload": { "endeavorId": "endeavor_x", "initialPhaseId": "phase_x" } }
{ "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE", "payload": { "endeavorId": "endeavor_x", "nextPhaseId": "phase_y", "unlocksNodesOnComplete": ["actor_x"] } }
{ "type": "COMMAND_UNLOCK_CLUE", "payload": { "clueId": "clue_x" } }
{ "type": "COMMAND_ENTER_DIALOGUE_NODE", "payload": { "dialogueId": "dialogue_x", "nodeId": "node_x" } }
{ "type": "COMMAND_OPEN_DIALOGUE", "payload": { "dialogueId": "dialogue_x" } }
{ "type": "COMMAND_CLOSE_DIALOGUE", "payload": {} }
{
  "type": "COMMAND_START_MINIGAME",
  "payload": {
    "type": "DUEL",
    "sourceId": "poi_x",
    "config": { "opponentId": "actor_x", "opponentName": "Name", "opponentStartingEnergy": 100, "opponentStartingPoise": 80 },
    "onSuccessCommands": [ /* StateCommand[] */ ],
    "onFailureCommands": [ /* StateCommand[] */ ]
  }
}
```

Real mistakes both drafts made before correction, so future drafts
don't repeat them:
- `COMMAND_ADJUST_CURRENCY`'s field is `denomination`, not `currency`; the value is a lowercase string (`"silver"`), not an enum-style constant (`"SILVER"`).
- There is no `COMMAND_GRANT_ITEM` — it's `COMMAND_ADD_ITEM`.
- `COMMAND_START_MINIGAME`'s payload is the full discriminated `MinigameLauncherPayload` (`type`/`sourceId`/`config`/`onSuccessCommands`/`onFailureCommands`), not a slimmed-down `{minigameType, opponentActorId, locationId}`-style guess.
- A `DialogueChoice` that ends the conversation **omits** `nextNodeId` entirely (don't set it to `null` or `""` in content — `null` is a command-*payload*-level concept, not an authored-JSON one; see `dialogue.schema.ts`'s comment on this exact distinction).
- `minActorReputation`/`minFactionReputation`/`requiredClues`/`allowedShifts`/`nodeVisits` are all real `DialogueRequirement` fields, confirmed — reuse them freely on a choice's `requires`.

## 2. `Endeavor.onPoiEnter` vs. `EndeavorPhase.onPoiEnter` — which one, when

Both fields share one shape, `{ poiId: string; onEnter: EntryEffect[] }`
(`PoiEntryTriggerSchema` — formerly two separately-named, independently
ad-hoc fields, `autoStartOnEnter`/`autoDialogueOnEnter`, unified in
`docs/features/feature_triggerable_effects.md`; if you see either old name
in an existing content file or older doc prose, that's stale, not a second
real mechanism). `onEnter` is an array — in practice, for a dialogue
auto-trigger, author exactly one `{ "type": "DIALOGUE", "dialogueId": "...", "nodeId"?: "..." }`
entry in it, matching every real instance built so far.

- **`Endeavor.onPoiEnter`** (on the Endeavor itself): use this for the Endeavor's *opening* scene — a witnessed or ambient moment the player didn't click into, the first time they enter a specific POI. The engine auto-fires `COMMAND_START_ENDEAVOR` (with the Endeavor's own `initialPhaseId`) *before* running `onEnter`'s effects, automatically, the first time the POI is entered while the Endeavor isn't yet in `activeEndeavors` — **never author a `START_ENDEAVOR` effect yourself inside `onEnter`**; the engine always synthesizes it from the Endeavor's own `id`/`initialPhaseId`, so a content-authored one would be a second, driftable source of truth for a fact the file already states. Never fires again once started — no re-entry guard needed in content.
- **`EndeavorPhase.onPoiEnter`** (same shape, on a specific phase): use this for every *subsequent* scripted beat while the Endeavor is already active — a scene that should just happen when the player reaches the right POI at the right phase, no click required.
- **A phase's ending dialogue choice never dispatches `COMMAND_START_ENDEAVOR`** — only the very first scene does, and only via `Endeavor.onPoiEnter`. Every later phase transition is `COMMAND_ADVANCE_ENDEAVOR_PHASE`.
- **The same-POI chain (the important one to get right):** `onPoiEnter`'s `DIALOGUE` effect fires on the `onSelectPoi` entry moment *and* on a phase-change `useEffect` that catches the case where the player is already standing in the POI when the phase advances. This means two consecutive phases can both auto-trigger at the *same* POI with no re-entry in between — confirmed twice now (tavern: challenge → recruit; Widowmaker Alley: arrival → offer). You don't need to merge two beats into one Dialogue file to work around a re-entry requirement; author them as separate phases/Dialogues and let the chain handle it, as long as the ending choice of the first (a) has no `nextNodeId` (so it closes the dialogue) and (b) dispatches `COMMAND_ADVANCE_ENDEAVOR_PHASE` in its `commands`. Both conditions are required — the phase-change effect is guarded on `activeDialogue === null`, so a choice that omits `nextNodeId` but forgets to end up with `activeDialogue` cleared won't fire it, and a choice that advances the phase but keeps `nextNodeId` set won't close the dialogue either.
- **A `DUEL` (or any minigame) outcome can open a dialogue too**, via `onSuccessCommands`/`onFailureCommands` dispatching `COMMAND_ENTER_DIALOGUE_NODE` + `COMMAND_OPEN_DIALOGUE` together (with an explicit `nodeId`, since nothing resolves "resume" logic inside a command payload) — this is how a duel's win/lose narration opens automatically without a third trigger mechanism.

## 3. `isUnlocked` / `unlocksNodesOnComplete` for staged reveals

- A new Actor or POI that shouldn't be visible/reachable from the start ships `"isUnlocked": false` in its content file.
- It becomes visible/navigable by being named in the `unlocksNodesOnComplete` array of a `COMMAND_ADVANCE_ENDEAVOR_PHASE` payload, authored on whichever dialogue choice's `commands` performs the phase transition that should reveal it. This is a **payload-level** field on the *command*, not something read off the `EndeavorPhase` content definition automatically — the `EndeavorPhase.unlocksNodesOnComplete` field exists in content too, and by established precedent (`endeavor_the_missing_broadsheet`, `endeavor_a_debt_in_steel`) should be kept mirroring the same list for documentation purposes, but confirm before relying on it: as of both real Endeavors built so far, nothing in `commands.ts`/`entryEffects.ts` actually *reads* the content-level copy — only the payload-level one is functional.
- **Never ship a locked Actor/POI with no unlock trigger anywhere in the content.** This is a real reachability bug, not a hypothetical one — it was caught during `content_a_debt_in_steel.md`'s own drafting (the source draft never specified an unlock point for its new POI). If it's not obvious which phase transition should carry the unlock, that's worth flagging explicitly rather than deciding silently, the same as any other judgment call.
- Pick the unlock point that's the first moment the thing becomes narratively real to the player (a debtor becomes a named recruit once the *ask* phase begins; a location and its duelist become real once the player has committed to going there) — not, e.g., the moment they're merely mentioned in flavor text.

## 4. `Actor.dialogueId` — one fixed reference, so plan the split up front

Every Actor's `dialogueId` is a single, permanent pointer — there's no
mechanism to vary it by active Endeavor or phase (`game-design-spec.md`
Open Design Gap #14, logged from this exact recurring question). Before
authoring a new Actor that appears in a scripted, auto-triggered scene,
decide explicitly:

- **If the Actor is meant to be reusable across future content** (a
  faction functionary, a recurring fixture — e.g. `actor_bookkeeper`):
  give them `isUnlocked: true` and a **separate, small, standalone
  default Dialogue** for `dialogueId` (a two-line brush-off is enough).
  Never point their `dialogueId` at the one scripted scene they
  currently appear in — that scene opens via `Endeavor.onPoiEnter`/
  `EndeavorPhase.onPoiEnter`, never by clicking them, and conflating the
  two breaks the moment a second Endeavor wants different content from
  the same Actor.
- **If the Actor exists only for this one Endeavor and has a real
  "come back and reconsider" case** (a recruit who can be re-approached
  after declining — e.g. `actor_anselm_draye`): it's fine to point
  `dialogueId` straight at the scripted-scene Dialogue itself, reused.
  `resolveDialogueEntryNodeId` resumes at the Actor's last-visited node
  on re-click, which is correct for a genuine reconsider-later case, and
  a minor, accepted rough edge (resuming at a stale mid-conversation
  node) for one that's already been completed and isn't expected to be
  re-clicked in practice.
- **If the Actor exists only for this one Endeavor with no reconsider
  case** (e.g. `actor_duro_vantry`): still give them a separate,
  minimal standalone default Dialogue rather than pointing at any
  scripted scene arbitrarily — cheap to author, and avoids an arbitrary
  choice among several scripted scenes they might appear in.
- Whichever choice is made, it's a per-Actor judgment call, not a
  single rule — say explicitly in the spec/decisions entry which case
  applies and why, the same way `content_a_debt_in_steel.md` did for
  its three new Actors.

## 5. Standing checklist: the chained-trigger test

**Not something to be reminded of per prompt — run this every time a
new phase chain relies on `onPoiEnter` (Endeavor- or phase-level),
without being asked.** Automated referential-integrity checks
(`content-integrity.test.ts`) confirm every trigger's `poiId`/`dialogueId`
*resolves*, but they do not confirm the trigger actually *fires* at the
right moment in a live render+dispatch loop — that needs a real browser
pass:

1. From a fresh save (Reset Progress or a clean dev-server load), enter
   the POI that should auto-start or auto-open the first scene in the
   chain. Confirm it opens with no click needed.
2. Complete that scene via its ending choice. Confirm the *next*
   scripted scene opens automatically **without leaving and
   re-entering the POI**, if it's authored to trigger at the same POI —
   this is the one path a same-session click-through can silently skip
   past without ever proving the phase-change trigger (not just the
   POI-entry trigger) actually fired.
3. Repeat step 2 for every same-POI link in the chain (there can be more
   than one — `endeavor_a_debt_in_steel` has two, at two different
   POIs).
4. Check the browser console for errors, not just that the right text
   appeared on screen — a silently-swallowed exception won't show up in
   a screenshot.

Use the `ui-visual-check` skill's scripted-interaction pattern for
this (a throwaway Playwright script driving clicks, not the one-shot
screenshot command) — see `docs/features/content_a_debt_in_steel.md`'s
Status section for a worked example of what the check confirmed.
