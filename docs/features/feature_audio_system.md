# Feature: Sound-Effect System

**Backfilled retroactively** — written after implementation, alongside `feature_dice_minigame.md`, to seed `docs/features/` with real examples rather than an empty directory. Includes the mistake that was caught during plan review, not just the clean final result.

## Goal

Establish one-shot sound-effect playback (no music, no looping ambience) via two mechanisms: logic-driven (dice win/lose) and content-driven (an optional entry sound on District/POI), both fail-silent on missing/failed assets — a deliberate contrast with the visual `AssetFallback` rule, which stays loud.

## Classification

Feature/Engine.

## Existing-capability check

Nothing existing covered audio playback at all — `AssetFallback`'s `kind="audio"` renders a visible `<audio controls>` element, a "browsable" pattern, not a fire-and-forget SFX player. `game-design-spec.md` §10 stated *all* assets (visual and audio) "must never fail silently" — directly contradicting this feature's requirement, so the spec text itself needed amending (not just appending alongside), which was flagged explicitly and done as part of this phase rather than left contradictory.

**Is this logic-driven or content-driven?** This question — asked explicitly because the spec template's existing-capability-check section forces it — is what produced the phase's core design decision: dice win/lose has no content-JSON representation to hang a schema field off, so it's component-owned; District/POI entry is exactly what `imageAsset` already models, so it's an optional schema field. Two mechanisms, one shared utility, rather than forcing both through either shape.

## Integration points

- **Dice win/lose** — `DiceGame.tsx`'s `throwDice`, fired right after `setRollResult`. Correct moment: the roll outcome is known.
- **POI entry** — `App.tsx`'s `onSelectPoi`. Correct moment: a real "player chose to enter this POI" event.
- **District entry** — **this is where a category-C/H-shaped mistake was caught in plan review, before code existed.** The original plan wired district entry to `onLeave` (the only existing `COMMAND_MOVE_TO_DISTRICT` call site) — but `onLeave` means "stepped out of a POI back into the same district," not "arrived in a district." Reviewed and corrected to a mount-only `useEffect` against the currently-resolved district before any implementation happened. This is the workflow's proof case: writing the integration points down and reviewing them first caught the mistake for free, the same shape of error that cost two turns when it happened to Mara Venn's title in the dice-minigame phase (caught only after implementation there).

## Reachability

Verified via a real browser: initial load correctly attempted the district sound (hit the browser's autoplay-policy block — a real failure mode, handled cleanly), and entering the tavern correctly attempted its own (hit a real missing-file error). **A second reachability gap was found here too**: the district content file (`district_lantern_ward.json`) had no `entrySoundAsset` value at all — only the POI got one, per the original task's literal scope — so there was nothing for the district trigger to actually attempt until this was noticed during the requested manual verification and a placeholder was added specifically to make that verification real.

## Consistency check

N/A — no existing entity's attributes were touched by this feature.

## Environment notes

None — purely client-side, no CI-specific behavior.

## Test plan

- `playSound.test.ts`: injectable-factory tests for all three failure shapes (factory throws, `.play()` throws, `.play()` rejects) plus the non-promise-return guard and dev-only console warning — all in the default `node` environment (no jsdom needed, since the factory is injected).
- `DiceGame.test.tsx`: win/lose sound-call assertions via an injected `playSound` spy.
- `schemas.test.ts`: `entrySoundAsset` optional-with-and-without on both District and POI.

## Content-schema scaling note

New optional field on two existing schemas (District, POI) — automatically covered by `content-integrity.test.ts`'s existing glob; no new pattern needed.

## Open questions / deferred scope

- `triggerPoiEntryEffects`/`triggerDistrictEntryEffects` are one-off named functions, not a content-driven registry of typed on-enter effects — noted in `game-design-spec.md` Open Design Gap #9 as a reasonable future generalization once a second real effect type exists, not before.
- The district mount effect's empty dependency array is only correct because `district` is a static import today — flagged with an in-code comment for whoever adds real district-to-district travel later.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "Sound-effect system: a shared, deliberately fail-silent `playSound` utility...".
- decisions.md: the two-mechanism split and `entrySoundAsset`-not-`ambientSoundAsset` naming; the district-trigger-point reconsideration (`onLeave` → mount effect).
