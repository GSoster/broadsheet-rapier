# Feature: Dialogue Speaker Reference (`speakerActorId`)

## Goal

Replace the fragile, silent-failure-prone speaker-portrait resolution (`App.tsx` matching `DialogueNode.speaker`, a free-text display string, against `Actor.name` by exact string equality) with an explicit, referentially-checked id reference — so a typo, a rename, or a translation drifting out of sync degrades loudly (a failing test) instead of silently (a missing portrait a player might not notice).

## Classification

Feature/Engine.

## Issue

[#7](https://github.com/GSoster/broadsheet-rapier/issues/7) — "DialogueNode.speaker matches Actor.name by string equality — fragile, should be an explicit reference."

## Existing-capability check

- `Actor.dialogueId: string` (already an explicit id-based reference, not a name match) is the direct precedent — same shape of fix, applied to the *reverse* direction (a dialogue node pointing back at the Actor speaking it).
- `content-integrity.test.ts`'s existing referential-integrity pattern (`Actor.factionIds -> Faction`, `POI.actorIds -> Actor` + reverse, `District.poiIds -> POI` + reverse, `Actor.dialogueId -> Dialogue`) is the exact mechanism to extend — one more `describe` block, same shape.
- **Reuse-of-meaning check**: `speakerActorId` is a genuinely new field, not a repurposed existing one — no risk to an existing consumer's meaning. `DialogueNode.speaker` itself keeps its current meaning (the *displayed* speaker label) unchanged; it stops being asked to *also* double as a portrait lookup key, which is the fix.

## Design

Add an optional field to `DialogueNodeSchema`:

```ts
// src/content/schemas/dialogue.schema.ts
export const DialogueNodeSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  speakerActorId: z.string().optional(),
  text: z.string(),
  choices: z.array(DialogueChoiceSchema).default([]),
});
```

`App.tsx`'s portrait resolution (currently `localizedActors.find((a) => a.name === openNode?.speaker)`) becomes: prefer `speakerActorId` when present (a direct `actors.find((a) => a.id === openNode.speakerActorId)`, immune to locale — ids never translate), falling back to today's name-match when absent. No existing content needs to change to stay valid; nothing breaks if `speakerActorId` is never set for a given node.

**Resolving the issue's open question** (does `speakerActorId` become required for new content, or does the name-match stay a permanent parallel path forever?): both, but for different reasons — **required for new dialogue content where the speaker is a real Actor** (see `feature-workflow.md` template addition below), and the name-match path stays **permanently for narration-style non-Actor speakers** (`"speaker": "Narration"`, used in `dialogue_the_offer`/`dialogue_widowmaker_arrival` for scene-setting text with no attached portrait) — those have no `Actor` to reference at all, so `speakerActorId` is not optional-because-lazy there, it's structurally inapplicable. The fallback path is what correctly keeps rendering *no* portrait for a narration line, exactly as it does today.

**Migrating existing content now, not incrementally.** The issue's proposed direction allowed incremental migration to avoid forcing an immediate rewrite. In practice all 4 real Actor-speaking dialogues resolve to exactly 7 node-level `speaker` fields across 7 files — small and mechanical enough to just do now rather than leave as a known gap:

| Dialogue file | `speaker` | `speakerActorId` to add |
|---|---|---|
| `dialogue_mara_venn.json` | Mara Venn | `actor_mara_venn` |
| `dialogue_anselm_recruit.json` | Anselm Draye | `actor_anselm_draye` |
| `dialogue_bookkeeper_default.json` | The Bookkeeper | `actor_bookkeeper` |
| `dialogue_the_challenge.json` | The Bookkeeper | `actor_bookkeeper` |
| `dialogue_duro_vantry_default.json` | Duro Vantry | `actor_duro_vantry` |
| `dialogue_reckoning_win.json` | Duro Vantry | `actor_duro_vantry` |
| `dialogue_reckoning_lose.json` | Duro Vantry | `actor_duro_vantry` |

`dialogue_the_offer.json` and `dialogue_widowmaker_arrival.json` (`"speaker": "Narration"`) are left as-is — no `speakerActorId`, by design (see above).

`speakerActorId` is not a translatable field (an id never localizes) — `DialogueTranslatableNodeSchema` is not extended; only the canonical English file carries it.

## Integration points

- `App.tsx`'s `speakerActor` lookup (currently line ~483) — existing site, resolution logic changed (id-first, name-match fallback), not moved.
- `content-integrity.test.ts` — new `describe("DialogueNode.speakerActorId -> Actor")` block, mirroring `Actor.dialogueId -> Dialogue`'s existing shape exactly.
- `docs/feature-workflow.md` §4's Content/Adventure template — gains a line requiring `speakerActorId` on any new dialogue node whose speaker is a real Actor, mirroring how the localization-overlay requirement was added there.

## Reachability

Player-visible effect is nil by design (portraits already resolve correctly for the 4 real Actors today via the name-match path) — this is a robustness fix, not a new player-facing capability. Confirmed via a manual dev-server pass: opened `dialogue_mara_venn`, `dialogue_the_challenge` (Bookkeeper), and `dialogue_reckoning_win`/`dialogue_reckoning_lose` (Duro Vantry) from a fresh save, portraits render identically to before the change, in both English and pt-BR.

## Consistency check

- `docs/decisions.md`'s 2026-08-29 entry documenting the original localization-phase friction (renaming `actor_bookkeeper`'s translated name required manually keeping dialogue `speaker` fields in lockstep) is the record this spec resolves — no wording change needed there, it's a historical account of the problem, not a claim about current behavior.
- `game-design-spec.md` Open Design Gap #14 (Actor reuse across Endeavors has no phase-conditional dialogue mechanism) is adjacent but distinct — not affected by this change.
- `App.tsx`'s existing inline comment above the `speakerActor` lookup (explaining why it matches on display name rather than `Actor.dialogueId`) is updated to describe the new id-first/name-fallback behavior instead of the old name-only behavior.

## Environment notes

None — no build/runtime config involved.

## Test plan

- `content-integrity.test.ts`: new referential-integrity block, `speakerActorId -> Actor`, one `it` per node that sets it (7 nodes across 7 files per the table above) — mirrors `Actor.dialogueId -> Dialogue`'s existing pattern.
- `schemas.test.ts`: one valid fixture with `speakerActorId` set, one valid fixture without it (proving the field stays genuinely optional, not silently required by the schema).
- No new component test needed — `App.tsx`'s speaker-portrait resolution is plain data lookup, not itself component-rendered logic with its own test file; existing `DialogueOverlay` tests are untouched since `node.speaker`'s display behavior is unchanged.

## Content-schema scaling note

`content-integrity.test.ts`'s dialogue glob already covers every dialogue file — the new referential-integrity block iterates the same already-loaded `dialogues` array, no new glob pattern needed. `speakerActorId` has no `.default(...)` (it's a bare `.optional()`), so the dialogue-choice-`.default([])` gap category (raw content bypassing a schema default) doesn't apply here — there's no default value to fail to reach.

## Open questions / explicitly deferred scope

- Whether a future lint/authoring-time check should *warn* (not fail) when a new dialogue node's `speaker` text exactly matches a real Actor's `name` but `speakerActorId` is unset, catching an author who forgot to set it rather than relying on code review — deferred; no such tooling exists elsewhere in this project's content-authoring flow yet, and the referential-integrity test only checks what's present, not what's missing.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` → Added — "`DialogueNode.speakerActorId`...".
- decisions.md: 2026-09-03 entry recording the migrate-now-not-incrementally call.
