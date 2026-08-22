# Feature: Triggerable Effects (Shared Trigger Schema)

## Goal

Unify three independently-invented content fields that all express the same
idea — "when this condition is met, run these effects" — into a shared,
composable pattern: `District/POI.entrySoundAsset`, `EndeavorPhase.autoDialogueOnEnter`,
`Endeavor.autoStartOnEnter`. This is the third real instance of the pattern,
which per this project's own discipline (`game-design-spec.md` Open Design
Gap #9's treatment of the first generalization) is when unification is
warranted, not before. Behavior-preserving: no player-visible change, only
an internal schema/engine reshape plus a content migration.

## Classification

Feature/Engine.

## Existing-capability check

`EntryEffect` (`SOUND | DIALOGUE | START_ENDEAVOR`) and its shared executor
(`executeEntryEffect` in `App.tsx`) already exist and already generalize the
*effect payload* correctly — nothing about `EntryEffect` itself needed to
change. The gap was entirely upstream of that: three separate content fields
constructing `EntryEffect`-shaped values through three different ad-hoc
shapes, two of which (`autoDialogueOnEnter`, `autoStartOnEnter`) were
confirmed byte-identical Zod objects declared twice.

**Reuse-of-meaning check**: `EntryEffect`'s meaning to its other consumers
(`computePoiEntryEffects`, `computeDistrictEntryEffects`, `executeEntryEffect`)
is unchanged — it's still "a normalized effect to run." Only *how content
authors express which effects fire, and under what condition* changed.

## Design

Two schema fragments, not one — deliberately not literal uniformity across
all four content types, because District/POI's trigger condition is
implicit ("this node itself was entered") while EndeavorPhase/Endeavor's is
targeted ("a specific, different POI was entered while this phase/endeavor
is in the relevant runtime state"). Content is static JSON; it cannot
express "while this phase is active" any other way than by having the
phase/endeavor own the trigger and name its target.

```ts
// src/content/schemas/shared.ts

export const TriggerableSchema = z.object({
  onEnter: z.array(EntryEffectSchema).default([]),
});

export const PoiEntryTriggerSchema = z
  .object({
    poiId: z.string(),
    onEnter: z.array(EntryEffectSchema),
  })
  .strict();
```

`TriggerableSchema` composes into `DistrictSchema`/`PoiSchema` via
`.extend(TriggerableSchema.shape)`, replacing `entrySoundAsset: z.string().optional()`.
`PoiEntryTriggerSchema` becomes `onPoiEnter: PoiEntryTriggerSchema.optional()`
on both `EndeavorPhaseSchema` (replacing `autoDialogueOnEnter`) and
`EndeavorSchema` (replacing `autoStartOnEnter`) — same field name both
places, removing the previous byte-identical-shape duplication entirely.

**`EntryEffect` moved, not reshaped.** It was a TS-only type in
`src/engine/utils/entryEffects.ts` with no Zod mirror — fine while purely an
internal computed value, not fine once directly content-authorable. Moved
(type + new `EntryEffectSchema`, a `.strict()` discriminated union on
`type`, same pattern as `StateCommandSchema`) into `src/engine/types/index.ts`,
alongside the project's other Zod-mirrored shared vocabulary
(`StateCommandSchema`, `MinigameLauncherPayloadSchema`) — matching the
boundary rule `docs/engine.md` §5 documents. `entryEffects.ts` now imports
`EntryEffect` from `../types` and re-exports it, so existing call sites
(`App.tsx`'s import) needed no change.

**Two things confirmed not to generalize as neatly as they first looked —
handled deliberately, not silently forced uniform:**

1. **The `isNodeUnlocked` gate stays asymmetric and call-site-specific.**
   `EndeavorPhase.onPoiEnter`'s path has no unlock-check (an *active*
   endeavor's phase, by construction, already passed the unlock check when
   the endeavor started); `Endeavor.onPoiEnter`'s not-yet-started path alone
   calls `isNodeUnlocked`, since it's evaluating an endeavor that could
   still be locked. This gating logic is not part of either schema fragment
   — it remains inside `computePoiEntryEffects`, unchanged in shape, just
   reading the renamed field.
2. **`START_ENDEAVOR` stays synthesized by the engine, never
   content-authored.** The trigger object only ever supplied
   `{ poiId, dialogueId, nodeId? }`; the `START_ENDEAVOR` effect's
   `endeavorId`/`initialPhaseId` were always pulled from the *parent*
   `Endeavor` object, not the trigger. Kept that way deliberately:
   `Endeavor.onPoiEnter.onEnter` in authored JSON only ever contains the
   `DIALOGUE` effect (same authoring burden as before); letting an author
   hand-write `{ type: "START_ENDEAVOR", endeavorId: "...", initialPhaseId: "..." }`
   would restate values that already exist as that same file's own `id`/
   `initialPhaseId` — a needless two-sources-of-truth drift risk for zero
   present benefit.

**`onExit` — considered, not built.** Nothing today fires on leaving a
location; this would be genuinely new capability, not a retrofit. Two
reasons against building it now: (1) same discipline this whole change is
built on — "third instance is when you generalize" applies even harder to
something with *zero* real instances; (2) `feature_audio_system.md` already
records `entrySoundAsset` almost being wired to `onLeave` and being caught
in review as semantically wrong, since the current `onLeave` call site only
ever means "left a POI back into the same district," not a generic "left
this location" moment — adding `onExit` now would either sit unused or
invite that same wrong wiring a second time. The shape doesn't foreclose it:
`onExit?: EntryEffect[]` slots into `TriggerableSchema` later as a pure,
non-breaking addition once a real need and a real trigger moment both exist.

## Integration points

- `src/content/schemas/shared.ts` — new `TriggerableSchema`, `PoiEntryTriggerSchema`.
- `src/content/schemas/district.schema.ts`, `poi.schema.ts` — `entrySoundAsset` → `onEnter`.
- `src/content/schemas/endeavor.schema.ts` — `autoDialogueOnEnter`/`autoStartOnEnter` → `onPoiEnter` (both).
- `src/engine/types/index.ts` — `EntryEffect` type + `EntryEffectSchema` added.
- `src/engine/utils/entryEffects.ts` — `computePoiEntryEffects`/`computeDistrictEntryEffects` read the renamed fields; `App.tsx`'s `executeEntryEffect` **unchanged** — it already switched on `EntryEffect.type`, agnostic to which content field produced it, confirming the original executor design was already correctly factored for this.
- Content: `district_lantern_ward.json`, `poi_crooked_hour_tavern.json`, `endeavor_a_debt_in_steel.json` (3 phase-level + 1 endeavor-level trigger) — value migration, no new authoring.

## Reachability

Manually verified via a scripted Playwright pass against the real running
app (dev server, real content, not a unit test), from a fresh load: Lantern
Ward's district-mount `SOUND` effect requested its asset; entering The
Crooked Hour requested its `SOUND` asset and opened `dialogue_the_challenge`
(the `Endeavor.onPoiEnter` auto-start firing `START_ENDEAVOR` + `DIALOGUE`
together); completing that dialogue advanced to `phase_the_second` and
auto-opened `dialogue_anselm_recruit` via the phase-change re-trigger path
(same POI, dialogue closed then immediately reopened); completing that
advanced to `phase_arrival_widowmaker` **without** falsely re-firing (target
POI mismatch — Widowmaker Alley, not the tavern, confirming targeted
triggers don't fire on the wrong node); leaving the tavern and entering the
newly-unlocked Widowmaker Alley opened `dialogue_widowmaker_arrival`;
completing that advanced to `phase_the_offer` and auto-opened
`dialogue_the_offer` (same-POI re-trigger again). Full chain: the challenge
→ the second → arrival → the offer, matching the pre-migration behavior
exactly. No console errors beyond the expected fail-silent `playSound`
warnings for placeholder audio paths (the existing, documented audio
failure mode, not a regression).

## Consistency check

- `docs/engine.md` §2 (EntryEffect section) — updated: new field names,
  `EntryEffectSchema`'s new location, the two schema fragments, both
  flagged non-uniformities.
- `docs/web-implementation.md` — Content Schema Field Reference (§5),
  content-driven audio section, and two further stray references to the old
  field names in prose — all updated.
- `docs/game-design-spec.md` Open Design Gap #9 — updated to describe the
  two-fragment unification, cross-referencing this spec.
- `docs/features/feature_dialogue_visibility_and_auto_triggers.md` —
  **not edited**. Historical record of what was decided/built at the time
  (append-only paper trail, same treatment as `decisions.md`/`CHANGELOG.md`);
  this spec supersedes its schema going forward without rewriting history.

## Environment notes

None — no build/runtime-config-derived values involved.

## Test plan

- `schemas.test.ts` — the 6 existing blocks covering the 3 old fields
  (accept with/without, reject-extra-key-via-`.strict()`) rewritten to the
  new `onEnter`/`onPoiEnter` shapes; same assertions, same intent.
- `entryEffects.test.ts` — fixtures renamed to `onEnter`/`onPoiEnter`; same
  coverage preserved (SOUND-only, DIALOGUE matching/non-matching poiId, both
  together, the full endeavor-auto-start sub-describe: fire-on-match,
  no-fire-when-already-active at any phase including terminal,
  no-fire-when-locked, fire-once-unlocked, no-fire-on-different-poiId).
- `content-integrity.test.ts` — the two referential-integrity checks
  (`EndeavorPhase.onPoiEnter`/`Endeavor.onPoiEnter` → real POI/Dialogue)
  updated to the new shape; also corrected surrounding comments that had
  gone stale claiming "no real content sets this yet" (already false before
  this change — `endeavor_a_debt_in_steel.json` sets both).
- Manual reachability pass (see above) — the real regression-risk surface
  for a behavior-preserving refactor is silent wiring drift, which the type
  checker/unit tests can't catch on their own; verified against the actual
  running app instead of trusting type-cleanliness alone.

## Content-schema scaling note

`TriggerableSchema.onEnter` is a new `.default([])` field — confirmed
reachable through `App.tsx`'s `loadContent` parse-on-load path (District/POI
already load through it, same as every other content type), not just proven
by a passing schema test. `content-integrity.test.ts`'s existing glob-based
coverage already scales to new content generically; this migration changes
field shape, not that scaling property.

## Open questions / explicitly deferred scope

- `onPoiEnter` kept singular (one target POI), not an array of targets —
  behavior-preserving and YAGNI-consistent with the `onExit` reasoning
  above. Trivially widened to an array later, non-breaking, if a second real
  instance ever needs multiple targets.
- `onExit` — explicitly deferred, see Design section above.
- Exact Zod composition syntax (`.extend(Fragment.shape)`) matches the
  existing `BaseNodeFieldsSchema` composition convention already used by
  every node schema — not a new pattern introduced here.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — schema/engine reshape + content migration entry.
- decisions.md: judgment calls from this design (two fragments not one;
  `onPoiEnter` singular; `START_ENDEAVOR` kept synthesized; `onExit` deferred).
