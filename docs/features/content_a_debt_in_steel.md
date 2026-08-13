# Content: "A Debt in Steel"

## Goal

A short, self-contained Endeavor at the Crooked Hour / Widowmaker Alley: the player witnesses a debtor (Anselm Draye) sentenced by the Wagering Ring to a duel he can't win, is recruited to stand as his second, and is ultimately pressured into fighting Duro Vantry in his place — resolved by the `DUEL` minigame, with a win/lose branch that pays out differently. First real content to exercise `Endeavor.autoStartOnEnter`, the phase-change trigger, `isNodeUnlocked`-gated actor/POI reveals, and a dialogue-choice-triggered `DUEL`.

## Classification

Content/Adventure.

## Existing-capability check

References only capability that already exists and has shipped:
- `Endeavor.autoStartOnEnter` / `EndeavorPhase.autoDialogueOnEnter` (`feature_dialogue_visibility_and_auto_triggers.md`) and its phase-change `useEffect` — the core mechanism this content is written to exercise end-to-end for the first time.
- `isNodeUnlocked` / `unlocksNodesOnComplete` on `COMMAND_ADVANCE_ENDEAVOR_PHASE`'s payload (`feature_node_unlock_rendering.md`) — first real use for Actor/POI reveals outside its own test suite.
- `COMMAND_START_MINIGAME` with a `DUEL` payload, `onSuccessCommands`/`onFailureCommands` (`feature_rapier_duel.md`) — first real in-content trigger; also the first real use of a minigame outcome opening a dialogue via `onSuccessCommands`/`onFailureCommands` dispatching `COMMAND_ENTER_DIALOGUE_NODE` + `COMMAND_OPEN_DIALOGUE`, a capability `feature_dialogue_visibility_and_auto_triggers.md` explicitly called out as "gained for free" but never exercised.
- `COMMAND_ADJUST_CURRENCY` (`{denomination, amount}`), `COMMAND_ADD_ITEM` (`{itemId, quantity}`), `COMMAND_ADJUST_REPUTATION`, `minFactionReputation`/`minActorReputation` dialogue requirements — all already exist, all used exactly as-is.

**No new engine capability needed.** The source draft (`docs/drafts/a_debt_in_steel_draft.md`) guessed at several of these before they existed or were confirmed; every guess below is corrected to the real shape, not left as originally drafted:
- `COMMAND_ADJUST_CURRENCY` payload corrected from the draft's guessed `{currency, amount}` to the real `{denomination: "gold"|"silver"|"bronze", amount}`.
- `COMMAND_GRANT_ITEM` doesn't exist — corrected to the real `COMMAND_ADD_ITEM` `{itemId, quantity}`.
- `COMMAND_START_MINIGAME`'s payload corrected from the draft's guessed `{minigameType, opponentActorId, locationId}` to the real discriminated `MinigameLauncherPayload` shape (`{type: "DUEL", sourceId, config: DuelConfig, onSuccessCommands, onFailureCommands}`).
- `minFactionReputation` — the draft flagged this as unconfirmed; it already exists on `DialogueRequirement`, exactly as drafted. No correction needed.
- The draft's `dialogue_the_challenge` ending choice dispatched `COMMAND_START_ENDEAVOR` directly (its only way to get the scene to start something). With `autoStartOnEnter` now shipped, `COMMAND_START_ENDEAVOR` is dispatched automatically on POI entry instead — the dialogue's ending choice now dispatches `COMMAND_ADVANCE_ENDEAVOR_PHASE` to `phase_the_second`.

**Reuse-of-meaning check:** every command above is used for exactly what it already means to its other consumers (currency, inventory, reputation, endeavor phase, dialogue visibility, minigame launch) — nothing is repurposed.

## Endeavor phase outline

`endeavor_a_debt_in_steel`, `isUnlocked: true`, `initialPhaseId: phase_the_challenge`. Seven phases, matching the draft's structure unchanged:

| Phase | Trigger | Ends via |
|---|---|---|
| `phase_the_challenge` | `Endeavor.autoStartOnEnter` at `poi_crooked_hour_tavern` → `dialogue_the_challenge` | Ending choice advances to `phase_the_second`, unlocks `actor_anselm_draye` |
| `phase_the_second` | `autoDialogueOnEnter` at `poi_crooked_hour_tavern` (same POI, no re-entry — the phase-change trigger) → `dialogue_anselm_recruit` | Accepting advances to `phase_arrival_widowmaker`, pays 3 silver, unlocks `poi_widowmaker_alley` + `actor_duro_vantry`. Declining ends the conversation with no commands — the endeavor stays at `phase_the_second`, and Anselm (now unlocked, clickable) can be re-approached later via the same dialogue. |
| `phase_arrival_widowmaker` | `autoDialogueOnEnter` at `poi_widowmaker_alley` → `dialogue_widowmaker_arrival` | Advances to `phase_the_offer` (one branch gated on `minFactionReputation(faction_wagering_ring, 20)`, reused exactly as `dialogue_mara_venn` already uses `minActorReputation`) |
| `phase_the_offer` | `autoDialogueOnEnter` at `poi_widowmaker_alley` (same POI, phase-change trigger again) → `dialogue_the_offer` | The two-round pressure structure from the draft, unchanged. Final choice advances to `phase_the_duel` and dispatches `COMMAND_START_MINIGAME` (`DUEL`, opponent `actor_duro_vantry`) |
| `phase_the_duel` | Minigame-driven, no dialogue trigger | `onSuccessCommands`/`onFailureCommands` advance to `phase_the_reckoning` and open `dialogue_reckoning_win`/`dialogue_reckoning_lose` |
| `phase_the_reckoning` | Opened directly by the minigame outcome (not `autoDialogueOnEnter`) | Win: +24 silver, `item_vantry_rapier`, advance to `phase_resolved`. Lose: −10 `faction_wagering_ring` reputation, advance to `phase_resolved`. The 3-silver fee from `phase_the_second` is never clawed back either way, per the draft. |
| `phase_resolved` | Terminal | — |

## Actor/POI list

- **`poi_widowmaker_alley`** (new). `district_lantern_ward`, `isUnlocked: false` — unlocked by `phase_the_second`'s accept-fee choice (see above). Without this, the POI would be permanently unreachable; the draft didn't specify an unlock point for it, so this is a judgment call, not something stated explicitly in either the draft or the revision list.
- **`actor_bookkeeper`** (new, real durable Actor — see below). `isUnlocked: true`, added to `poi_crooked_hour_tavern.actorIds`.
- **`actor_anselm_draye`** (new). `isUnlocked: false`, unlocked at the end of `phase_the_challenge`. Lives at `poi_crooked_hour_tavern`.
- **`actor_duro_vantry`** (new). `isUnlocked: false`, unlocked at the end of `phase_the_second`. Lives at `poi_widowmaker_alley`.
- **`item_vantry_rapier`** (new) — the win reward.

## Actor.dialogueId design (item 6 + the parallel case for Anselm/Duro)

`actor_bookkeeper.dialogueId` points at a **new, separate, small standalone `dialogue_bookkeeper_default`** ("filed and witnessed, same as always" — a two-line brush-off), not `dialogue_the_challenge` — that scene opens via `autoStartOnEnter`, never by clicking him, and conflating "the one scripted scene he appears in" with "what a click on him does" would break the moment a second endeavor wants to reuse him with different relevant content. He's authored `isUnlocked: true` and durable specifically so he's reusable.

The same click-vs-scripted-scene split applies, narrower, to the two new Actors:
- **`actor_anselm_draye.dialogueId` = `dialogue_anselm_recruit`** (reused, not a separate default) — deliberately, so a player who declines at `phase_the_second` can click him again later to reconsider (the draft explicitly floats this as intended, not enforced). `resolveDialogueEntryNodeId` resumes at his last-visited node, so a decline resumes at the ask; an accept (which ends the conversation) would resume at the fee-offered node if re-clicked after already advancing past `phase_the_second`, which is a minor rough edge (no phase-conditional dialogue selection exists — the exact gap being logged below) but not a broken/dead-end state, and no current content path re-triggers it in practice.
- **`actor_duro_vantry.dialogueId` = a new, separate, small standalone `dialogue_duro_vantry_default`** (a single unfriendly, unhurried line) — he has no "come back and reconsider" case, so pointing his `dialogueId` at any of the scripted scenes would be purely arbitrary; a standalone default is the more honest minimal choice, same reasoning as the Bookkeeper.

**New Open Design Gap for `game-design-spec.md`:** reusing an Actor across multiple endeavors/phases with different relevant content has no mechanism — `Actor.dialogueId` is a single fixed reference. This is the second concrete motivating case (Bookkeeper) after none previously, flagged as real and moderately likely to recur, not hypothetical. Not built now — logged only.

## Tone check

Era/tone: duels-as-paperwork, a Ring that formalizes violence through "filed and witnessed" bureaucratic language, and Anselm's cowardice-not-malice framing are consistent with the *Garrett P.I.* / *Fafhrd and the Gray Mouser* priority tier (street-level, morally grey, procedural-but-dangerous city institutions) per `narrative-inspirations.md`, and with `world-lore.md`'s established Wagering Ring faction flavor (already the frame for `dialogue_mara_venn`'s reputation loop). No new lore invented — Widowmaker Alley is filed as a real City Watch address (District Filing 114) inside the existing Lantern Ward, not a new district.

## Balance flag, not balance invention

Every reward/cost number below is carried over from the draft as-is or newly authored by direct analogy, flagged against the still-open economy-balance gap (`game-design-spec.md` Open Design Gap #3) — none of these are final figures:
- 12 silver debt (flavor only, never actually charged to the player), 3 silver standing fee, 24 silver win payout, `item_vantry_rapier` as a bonus win reward, −10 faction reputation on loss.
- `DuelConfig` for Duro Vantry: `opponentStartingEnergy: 100`, `opponentStartingPoise: 80` — picked to read as "a practiced but not overwhelming duelist" (slightly lower poise than the player's flat 100 per `feature_rapier_duel.md`), not derived from any documented difficulty model, since none exists yet (Open Design Gap #1 covers `DUEL`'s own resolution mechanic, not per-encounter difficulty tuning, which remains fully un-specified).

## Integration points

- `App.tsx`: new content imports (POI, 3 Actors, 1 Endeavor, 7 Dialogues, 1 Item) parsed through `loadContent`, appended to the existing `pois`/`actors`/`endeavors`/`dialogues`/`itemsById` arrays/maps — same pattern as every existing entry, no new wiring code needed since `entryEffects.ts`/`App.tsx`'s effects already generalize across POI/Endeavor counts.
- `poi_crooked_hour_tavern.json`: `actorIds` gains `actor_bookkeeper` and `actor_anselm_draye` (both live there).
- `district_lantern_ward.json`: `poiIds` gains `poi_widowmaker_alley`.

## Reachability

From a fresh save: player starts able to reach `poi_crooked_hour_tavern` (already unlocked). First entry auto-starts `phase_the_challenge` (`autoStartOnEnter`, gated on `isNodeUnlocked` — the endeavor itself is authored `isUnlocked: true`, so this fires unconditionally on first entry). The full chain from there to `phase_resolved` requires no POI-locked or otherwise unreachable step — `poi_widowmaker_alley` and both new Actors unlock exactly when the story needs them visible, verified against `isNodeUnlocked`'s existing test coverage plus this content's own end-to-end check (see Test plan).

## Consistency check

- `poi_crooked_hour_tavern.json`'s `actorIds` and `district_lantern_ward.json`'s `poiIds` are the only existing files touched — both are the direct addition points, not incidental.
- `game-design-spec.md` §8 (Actor content model) and §9 (minigames) stay accurate as written — nothing here changes what those fields mean, only adds a second real instance.
- No other content references `poi_crooked_hour_tavern` or `district_lantern_ward` in a way this changes.

## Environment notes

None — no build/runtime-config-derived values introduced. Art assets for `actor_bookkeeper`, `actor_anselm_draye`, `actor_duro_vantry`, and `item_vantry_rapier` don't exist yet; each `imageAsset` points at a sensibly-named path under `public/content/assets/images/` that isn't populated. Per `game-design-spec.md` §10, `AssetFallback` visibly flags a missing/failed visual asset rather than failing silently — this is the intended, already-established behavior for a not-yet-supplied image, not a bug to fix in this pass. `poi_widowmaker_alley`'s art (`widowmaker_alley.jpg`) was already supplied and committed in a prior turn.

## Test plan

- `content-integrity.test.ts` covers schema validation and referential integrity (`Actor.factionIds`→Faction, `POI.actorIds`↔`Actor.poiId`, `District.poiIds`↔`POI.districtId`, `Actor.dialogueId`→Dialogue, dialogue node/choice references, `autoDialogueOnEnter`/`autoStartOnEnter`→POI/Dialogue) automatically via its existing glob — no test changes needed, every new file is picked up for free.
- **Chained-trigger end-to-end check** (the first real content to exercise this path): from a fresh save, enter `poi_crooked_hour_tavern` → confirm `dialogue_the_challenge` opens automatically → complete it → confirm `dialogue_anselm_recruit` opens automatically **without leaving the POI**, proving the phase-change `useEffect` (not just the `onSelectPoi` entry path) actually fires on a same-POI phase advance. Repeat the same check at `poi_widowmaker_alley` for `dialogue_widowmaker_arrival` → `dialogue_the_offer`. Verified live via the `ui-visual-check` skill, since this is the first real content exercising that specific engine path and no automated test currently drives `App.tsx`'s full render+dispatch loop across a phase transition.
- Manual reachability check per `feature-workflow.md` §2 stage 7: Reset Progress, replay the full chain to `phase_resolved` via both the win and lose branches (two separate playthroughs, since they diverge at the duel).

## Content-schema scaling note

No schema changes. `content-integrity.test.ts`'s existing glob/referential-integrity checks already scale to this content with zero test-file edits.

## Open questions / explicitly deferred scope

- `poi_widowmaker_alley`'s unlock point (`phase_the_second`'s accept-fee choice) isn't explicitly specified by either the draft or the revision list — a judgment call made here since leaving it `isUnlocked: false` with no unlock trigger anywhere would make it permanently unreachable, breaking the Reachability requirement outright.
- `actor_anselm_draye`'s re-click-after-accepting behavior (resumes at `node_fee_offered` rather than something phase-aware) is a known minor rough edge, not a dead end, tied directly to the new Open Design Gap logged above. Not fixed here — logged, not invented around.
- `EndeavorPhase.unlocksNodesOnComplete` (the content-level field, distinct from the same-named key on `COMMAND_ADVANCE_ENDEAVOR_PHASE`'s payload) appears to be informational only — nothing in `commands.ts`/`entryEffects.ts` actually reads it; only the payload-level copy on the triggering dialogue choice is functional. This content mirrors both anyway, matching `endeavor_the_missing_broadsheet`'s existing precedent. Pre-existing duplication, not introduced or fixed by this content — out of scope to resolve here.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "'A Debt in Steel' (`endeavor_a_debt_in_steel`)...".
- decisions.md: 2026-08-13 entries covering the command-shape corrections, the Bookkeeper/Vantry/Anselm `dialogueId` split, the two unlock-point judgment calls, and the `unlocksNodesOnComplete` duplication note.
- `game-design-spec.md` Open Design Gap #14 added (Actor.dialogueId reuse across Endeavors).
- Chained-trigger end-to-end check performed live via `ui-visual-check` (headless Chromium, scripted click-through): confirmed `dialogue_the_challenge` auto-opens on first tavern entry, `dialogue_anselm_recruit` auto-opens at the same POI on phase advance with no re-entry, `poi_widowmaker_alley` + `actor_duro_vantry` unlock and become navigable/visible after accepting, `dialogue_widowmaker_arrival` auto-opens on alley entry, and `dialogue_the_offer` auto-opens at the same POI on phase advance with no re-entry — the phase-change trigger's first real exercise, twice over, both correct. Zero console errors throughout.
