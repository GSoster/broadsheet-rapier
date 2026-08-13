# Feature: Node-Unlock Rendering

## Goal

Fix a real, previously-undetected defect: `PlayerState.unlockedNodes` — the dynamic record `COMMAND_UNLOCK_NODE` and `EndeavorPhase.unlocksNodesOnComplete` write to — is never read by any renderer anywhere in the app. Dispatching `COMMAND_UNLOCK_NODE` today changes state but has zero observable effect on anything a player sees, for any node type. `WorldNavigationView`'s existing POI lock indicator (`"??? (locked)"`) reads only the *static* `Poi.isUnlocked` content field, never `unlockedNodes`. `NodeInteractionCanvas`'s actor list renders every id in `Poi.actorIds` unconditionally — no lock check of any kind, `NodeInteractionActor` doesn't even have an `isUnlocked` field.

## Classification

Feature/Engine. Pre-existing bug fix, unrelated to entry-effects/auto-triggers — deliberately a separate file from `feature_dialogue_visibility_and_auto_triggers.md`, even though its `autoStartOnEnter` addendum depends on this spec's helper (see that file's Addendum Open Questions).

## Existing-capability check

`PlayerState.unlockedNodes: Record<string, boolean>`, `COMMAND_UNLOCK_NODE`, and `EndeavorPhase.unlocksNodesOnComplete` all already exist and are already correctly *written* (tested in `commands.test.ts`, `minigames.test.ts`, `DuelGame.test.tsx`). Nothing new needed at the write side. `Actor`/`Poi`/`Endeavor` all already have a static `isUnlocked: boolean` from `BaseNodeFieldsSchema`. The gap is entirely on the *read* side — no renderer merges the static default with the dynamic record.

**Reuse-of-meaning check**: `isNodeUnlocked` reads two already-existing fields (`isUnlocked`, `unlockedNodes`), doesn't repurpose either — it's the missing glue between two things that already mean exactly what they're documented to mean, not a new meaning for either.

## Design

```ts
// src/engine/utils/isNodeUnlocked.ts (new) — mirrors evaluator.ts's/
// entryEffects.ts's placement and locally-owned-minimal-type pattern.

// COMMAND_UNLOCK_NODE and EndeavorPhase.unlocksNodesOnComplete both only
// ever set true — confirmed explicitly, not left implicit: grepped every
// unlockedNodes write site in commands.ts, and there is no command or
// code path anywhere that ever sets a node back to false or removes an
// entry. unlockedNodes is therefore monotonic: once true, permanently
// true for the rest of the save. isNodeUnlocked relies on this — it's a
// plain OR, not a live/reactive lock that could ever re-lock something.
export function isNodeUnlocked(
  node: { isUnlocked: boolean },
  nodeId: string,
  unlockedNodes: Record<string, boolean>
): boolean {
  return node.isUnlocked || !!unlockedNodes[nodeId];
}
```

Applied at both existing render sites, plus the one about to exist for Endeavor via the dialogue-visibility addendum:

- **`WorldNavigationView`'s POI list**, built in `App.tsx` (`pois.map((p) => ({ id: p.id, name: p.name, isUnlocked: p.isUnlocked }))`). Fix: `isUnlocked: isNodeUnlocked(p, p.id, unlockedNodes)`. **This is a behavior fix to existing, already-shipped code, not new scope** — flagged explicitly in the commit/report, since it changes what a real player sees for the first time (a POI authored `isUnlocked: false` that has since been unlocked via `COMMAND_UNLOCK_NODE` would previously have stayed permanently shown as locked; it will now correctly show unlocked).
- **`NodeInteractionCanvas`'s actor list.** `NodeInteractionActor` gains `isUnlocked: boolean`. `App.tsx`'s actor-list builder (`actors.filter(...).map((a) => ({ id: a.id, name: a.name, title: a.title }))`) adds `isUnlocked: isNodeUnlocked(a, a.id, unlockedNodes)`. `NodeInteractionCanvas.tsx` renders a locked actor the same way `WorldNavigationView` renders a locked POI — `disabled={!actor.isUnlocked}`, name replaced with a locked placeholder — mirroring the existing `"??? (locked)"` pattern exactly, not inventing new copy or styling for the same concept.
- **Endeavor visibility.** Nothing checks `Endeavor.isUnlocked` today (confirmed: no read site exists, since only one endeavor exists and it's always unlocked). This spec's helper is what `feature_dialogue_visibility_and_auto_triggers.md`'s `autoStartOnEnter` addendum uses for its lock guard — the first real Endeavor read site, landing there rather than here since no Endeavor render site (a list, a journal entry) exists yet to retrofit independently.

## Integration points

- `App.tsx`'s `pois.map(...)` building `WorldNavigationView`'s prop — existing site, behavior-fixed.
- `App.tsx`'s `actors.filter(...).map(...)` building `NodeInteractionCanvas`'s `actors` prop — existing site, gains the field.
- `NodeInteractionCanvas.tsx`'s actor button rendering — existing site, gains the disabled/locked branch.
- `computePoiEntryEffects`'s `autoStartOnEnter` guard (`feature_dialogue_visibility_and_auto_triggers.md` addendum) — new site in a different spec, same helper, same semantics, landed together per that spec's stated dependency.

## Reachability

The POI fix is immediately reachable and player-visible today — the one shipped POI (`poi_crooked_hour_tavern`) is authored `isUnlocked: true` already, so there's no currently-locked-then-unlocked POI to observe the fix against in the live starter content, but the mechanism itself is exercised by unit tests and is correct the moment any content author sets `isUnlocked: false` plus a matching unlock trigger. No existing content currently authors a locked Actor or a `false`-`isUnlocked` Endeavor, so the Actor/Endeavor sides need a content instance to be player-reachable in the running app — out of scope for this Feature/Engine spec per `feature-workflow.md` §2 stage 3 (content sequencing is its own later phase).

## Consistency check

- `game-design-spec.md` §6 ("A locked node should never be silently hidden — the player should see that something exists and is currently inaccessible") — this spec is what actually makes that sentence true for the first time for POIs, and true at all for Actors. That section currently reads as already-satisfied, which was inaccurate; no wording change needed there since the *rule* was always correctly stated, only the *implementation* was missing.
- `docs/decisions.md` gets its own dated entry (separate from this spec's implementation entry) recording the defect-finding itself, given how significant "unlocking has never worked" is as a finding — not just folded into a routine "what changed" note.
- `game-design-spec.md` Open Design Gaps gets a new numbered entry recording the defect (see below), cross-referencing this spec.

## Environment notes

None.

## Test plan

- New `src/__tests__/isNodeUnlocked.test.ts`: static `isUnlocked: true` alone → true; static `false` + no `unlockedNodes` entry → false; static `false` + `unlockedNodes[id] = true` → true; static `true` + `unlockedNodes[id]` absent/false → still true (static never downgrades dynamic, and vice versa — it's a pure OR, confirmed both directions).
- `WorldNavigationView.test.tsx` — already existed and already covers locked/unlocked POI rendering correctly (confirmed on inspection: the component's own render logic was never the bug — only what `App.tsx` computed for its `isUnlocked` prop was). No changes needed here.
- `NodeInteractionCanvas.test.tsx` — existing file, updated: its `actors` fixture gains `isUnlocked`, and two new tests cover a locked actor rendering disabled with the `"??? (locked)"` placeholder (mirroring `WorldNavigationView`'s existing test pattern exactly) and not firing `onSelectActor` when clicked.

## Content-schema scaling note

No schema changes — both fields (`isUnlocked`, `unlockedNodes`) already exist and are already validated. Nothing new for `content-integrity.test.ts` to cover.

## Open questions / explicitly deferred scope

- No content currently authors a locked Actor or a `false`-`isUnlocked` Endeavor — this spec fixes the mechanism; authoring an actual locked-then-unlocked story beat is separate content work, sequenced after this lands.
- Whether `isNodeUnlocked` should eventually apply to Districts/Settlements too (they also have static `isUnlocked` per `BaseNodeFieldsSchema`) is not addressed here. Deliberately out of scope for the same reason as everything else this project defers rather than builds ahead of need: no current content authors a locked District/Settlement, and no render site exists yet to retrofit — not an oversight, the same discipline already applied elsewhere in this project (e.g. Territory, per `game-design-spec.md` §2).

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "`isNodeUnlocked` helper...", "**Fixed:** `WorldNavigationView`'s POI lock check...".
- decisions.md: the original defect-finding entry (dated when found), plus this spec and `feature_dialogue_visibility_and_auto_triggers.md`'s addendum landed together in the same pass, per the stated cross-spec dependency (the helper before `autoStartOnEnter`'s guard, not after).
