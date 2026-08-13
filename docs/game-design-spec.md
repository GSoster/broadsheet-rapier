# Game Design Specification (Engine-Agnostic)

This document defines what the game *is*, independent of implementation. If the project ever migrates off web technology (e.g. to Godot), this file is the one that should still be true unchanged. Anything specific to the current web stack lives in `docs/web-implementation.md` instead.

## 1. Setting

Broadsheet & Rapier. 17th-century swashbuckler fantasy, city of Valdeombra. Full lore, era constraints, and tone in `docs/world-lore.md` and `docs/narrative-inspirations.md`.

## 2. Domain Vocabulary

- **Territory:** Macro nation/region. Deferred — not modeled until macro-world/regional travel exists.
- **Settlement:** Macro hub city or area.
- **District:** Neighborhood within a Settlement.
- **PointOfInterest (POI):** Specific interactive location inside a District.
- **Actor:** Any interactable person, animal, or key dynamic entity.
- **Faction:** An organization tracking player reputation.
- **Endeavor:** A narrative arc — quest, mystery, heist, or personal pursuit — made of ordered Phases.
- **Shift:** Discrete unit of time: `MORNING`, `AFTERNOON`, `EVENING`, `NIGHT`.

## 3. Entity Identification

Every content entity has a stable `id` in `snake_case`, prefixed by its type (e.g. `poi_crooked_hour_tavern`, `actor_mara_venn`, `faction_city_watch`). This convention is part of the content model itself, not a code-style choice — it should carry forward regardless of engine.

## 4. World Clock & Time Rules

- Time advances in discrete Shifts: `MORNING → AFTERNOON → EVENING → NIGHT → (next day) MORNING`.
- Moving between Districts inside the same Settlement costs 0 Shifts.
- Moving between Settlements costs 1 Shift.
- Performing a heavy action or minigame costs 1 Shift.
- Exceeding `NIGHT` advances the day counter and resets to `MORNING`.
- The world also tracks a Season (`SPRING`, `SUMMER`, `AUTUMN`, `WINTER`) and a current Weather state.

## 5. Currency System

Three denominations: Bronze, Silver, Gold.
- 20 Bronze = 1 Silver
- 20 Silver = 1 Gold (400 Bronze = 1 Gold)

## 6. Progression & Unlocking

Settlement, District, POI, Actor, and Endeavor nodes each carry an `isUnlocked` state. Locked nodes are visible but inaccessible until unlocked by narrative progression (typically via Endeavor phase completion). A locked node should never be silently hidden — the player should see that something exists and is currently inaccessible.

## 7. Faction & Reputation Model

Player reputation is tracked per-Faction and per-Actor on a `-100` to `+100` scale.

**First concrete reputation effect implemented, as a worked example:** engaging Mara Venn (`actor_mara_venn`) in her dialogue tree grants +5 actor-level reputation per choice that engages with the conversation (not per click — see Open Design Gap #6, now resolved); at 10 reputation with her, a reputation-gated choice becomes available, revealing a lead and advancing `endeavor_the_missing_broadsheet` from `phase_ask_around` to `phase_confront_the_buyer`. This is one hand-authored, actor-specific threshold expressed as dialogue-choice `requires`/`commands` (`dialogue_mara_venn.json`), not a general system — it proves reputation *can* drive dialogue/narrative branching, nothing more.

**Open design gap — still not defined:** general, faction-wide tiered reputation effects (access restrictions, pricing, hostility thresholds) applying systematically across actors/factions. The Mara Venn example above does not resolve this gap — do not let an implementer generalize from it into a tier system without a spec for one.

## 8. Content Data Model

Conceptual field reference (concrete types live in `web-implementation.md`):

- **Base fields** (Settlement, District, POI, Actor): id, name, description, unlock state, optional image reference.
- **District / POI** additionally: optional controlling faction, optional per-faction influence weighting.
- **POI** additionally: parent District, movement cost in Shifts, which Shifts it's available during, the Actors present there.
- **District** additionally: parent Settlement, the POIs it contains.
- **Settlement** additionally: the Districts it contains.
- **Actor** additionally: home POI, faction affiliations (an Actor may belong to multiple Factions), a title, an initial line of dialogue.
- **Faction**: base fields only.
- **Endeavor**: id, title, description, unlock state, its starting Phase, and its full set of Phases.
- **EndeavorPhase**: id, objective text, optionally required Clues, the Phase that follows on success, and any nodes it unlocks on completion.
- **Item**: id, name, description, unlock state, a *required* image reference (unlike the other node types, an Item always needs a visible representation), and whether it's stackable (accumulates as a quantity) or unique (one-of-a-kind). `item_rapier` is the first and only Item so far — see Open Design Gap #12 for what isn't built yet.

## 9. Minigames

Four types exist conceptually: `DUEL`, `LOCKPICKING`, `FISHING`, `DICE`. Each is triggered from a source (an Actor, a POI action, an Endeavor phase) and resolves to success or failure, which in turn triggers narrative/state consequences.

**`DICE` is resolved** (first concrete minigame mechanic): roll two six-sided dice against a player-chosen wager. An even sum wins and pays out 2x the wager; an odd sum loses and the wager is deducted. No skill or difficulty scaling — pure chance, transparent odds (a coin flip's worth of even/odd across the 2–12 range). Wager range, stepping, and the click-to-throw interaction are specified in `web-implementation.md`. Chosen for being simple, fully testable, and legible to the player at a glance — a deliberately minimal first mechanic, not a template every future minigame must follow.

**`DUEL` is resolved** (second concrete minigame mechanic): a discrete, turn-based finite-state duel. Each turn the player and an opponent both pick one action — Thrust, Parry & Riposte, Feint, Taunt, or Dirty Trick — resolved deterministically against an `energy`/`poise` stat pair and a three-step distance track (`OUT_OF_MEASURE`/`IN_MEASURE`/`CLOSE_QUARTERS`). Thrust and Dirty Trick deal energy damage (the latter only at Close Quarters); Parry & Riposte negates a matching incoming attack and counters; Feint drains poise and closes distance; Taunt drains poise, with a reputation-gated bonus checking the player's standing with `faction_wagering_ring` (a hand-authored worked example for this one duel, not a general taunt-vs-reputation system). A combatant whose poise is already at 0 takes bonus damage from a landed Thrust or Dirty Trick ("guard-break"). The duel ends when either side's energy reaches 0. See `docs/features/feature_rapier_duel.md` for the full mechanic and every placeholder constant. As with `DICE`, a deliberately first-pass mechanic, not a template every future minigame must follow — no in-content trigger exists yet, so it isn't reachable in-app this phase (see that spec's Reachability section).

**Open design gap — not yet defined for the remaining two types:** the actual resolution mechanic, difficulty model, and win condition for `LOCKPICKING` and `FISHING` (`DICE` and `DUEL` are now resolved, see above). Only the *contract* (launch with config, resolve to success/failure, dispatch consequence commands) is currently specified for them, in `web-implementation.md`. Do not implement gameplay mechanics for either of these without a mechanic spec first.

## 10. Asset Principle

Every visual/audio asset is categorized by the node type it belongs to (District, POI, Actor, or general audio). If a **visual** asset is missing or fails to load, this must be visibly and unmistakably flagged during development and testing — never fail silently or render a blank space. **Audio assets follow the opposite rule: a missing or failed sound must degrade gracefully and fail silently — at most a console warning during development — and must never block or visibly/audibly interrupt play.** (Concrete implementation of both rules is in `web-implementation.md`.)

## 11. Save / Load

Player progress must be persistable across sessions, and portable as an exportable/importable file so a player can move saves between devices. (Concrete implementation is in `web-implementation.md`.)

---

## Open Design Gaps — Must Be Resolved Before Implementing Beyond the Technical Scaffold

1. Minigame resolution mechanics — formulas, difficulty scaling, win conditions — for `LOCKPICKING` and `FISHING` (`DICE` and `DUEL` are now resolved, see §9). `MinigameLauncherPayload.config` is now a discriminated union keyed off `type` covering `DiceConfig | DuelConfig` (see `web-implementation.md` §4); `LOCKPICKING`/`FISHING` still fall back to an untyped `Record<string, unknown>` until their mechanics are defined, at which point they should join the union as `LockpickingConfig | FishingConfig` too.
2. Reputation tiers and their gameplay effects.
3. Economy balance — prices, rewards, costs for actions and goods.
4. Endeavor content beyond the single starter slice (`endeavor_the_missing_broadsheet`) — its actual phase-by-phase design.
5. Weather has no update mechanism. `worldClock.weather` (`web-implementation.md` §4) is set once at initialization and nothing — no command, no automatic rotation — ever changes it. Deferred until a narrative or minigame system actually needs it (e.g. a `DUEL` affected by rain, an Endeavor phase gated on `STORM`).
6. **Resolved.** Dialogue branching/variation now has a general mechanism: `Actor.dialogueId` points at a `Dialogue` content file (branching nodes/choices, `web-implementation.md` §5), each choice optionally gated by a `DialogueRequirement` (clues, actor/faction reputation thresholds, allowed shifts, node-visit counts) and optionally carrying `commands: StateCommand[]` run through the existing `applyCommand` pipeline. See `docs/features/feature_dialogue_branching.md`. Mara Venn's tree (`dialogue_mara_venn.json`) is the one real content instance built so far, replacing her previously hand-hardcoded reputation-gated second line (formerly documented here in §7) with content-driven choices. Authoring further dialogue trees for other actors is content work, not a further engine gap.
7. No anti-grinding/cooldown on repeated Actor conversations. Talking to Mara Venn repeatedly grants +5 reputation every time with no cooldown or diminishing returns, so reputation can be farmed instantly by repeat-clicking. Intentional for this phase — not a bug — but a real gap: any future reputation-gated content needs a decision on whether repeatable conversations should be capped, cooled down, or made one-time.
8. Dice minigame interaction is click-to-throw, not press-and-hold. A press-and-hold "charge" mechanic (wager or outcome influenced by hold duration) was considered and explicitly deferred as future polish — the current interaction is a single click/tap on "Throw" that resolves immediately. Not a design gap requiring a spec before proceeding, just noted so it isn't mistaken for an oversight.
9. Systemic progression design — repeatable/always-available activities (see the dice minigame as a first instance) versus unique Endeavor content, avoiding soft-locks, and how repeated player actions should be acknowledged narratively rather than silently grinding. Reference: `docs/narrative-inspirations.md` Section 4 (Fallen London — including its design-principles subsection — OGame, BiteFight). Not yet designed as a general system — needs its own spec before generalizing beyond the one existing gambling loop. **The smaller, related half of this gap is resolved:** the one-off `triggerPoiEntryEffects`/`triggerDistrictEntryEffects` functions in `App.tsx` are now a typed on-enter-effects registry (`src/engine/utils/entryEffects.ts`, `EntryEffect` = `SOUND | DIALOGUE`), generalized once a second real effect type (`EndeavorPhase.autoDialogueOnEnter`) actually existed, per the plan this gap already laid out. See `docs/features/feature_dialogue_visibility_and_auto_triggers.md`. The larger "systemic progression design" question above is untouched by this and remains fully open.
10. Whether players should ever get a non-dev "Reset Progress" option. The dev-only version (`ManagementDrawer`, gated on `import.meta.env.DEV`) exists purely as a testing/verification tool — it resets `PlayerState` to `initialPlayerState`, nothing more. Whether a player-facing reset/new-game option should exist, and if so under what framing (a deliberate "start over" choice vs. an accidental-data-loss risk) is an open product question, not decided by the dev tool's existence. Do not make the dev-only button always-visible as a way of implicitly deciding this.

11. `DUEL` poise defaults don't yet scale with equipment. The player's starting poise is a flat 100 (`docs/features/feature_rapier_duel.md`), and each opponent's is author-configured per encounter via `DuelConfig` — neither is derived from what rapier the player owns. The intent is for a better-equipped rapier to eventually raise the player's poise (a better guard), and for the opponent's own weapon to eventually inform `chooseOpponentAction`'s heuristics — but no "equipped item" concept exists yet; `PlayerState.inventory` only tracks owned quantity, not what's equipped. Not building either now. `DuelContext` was deliberately shaped so this becomes a context-extension later, not a signature change to `evaluateDuelTurn`/`chooseOpponentAction` — logged here so it isn't lost.

12. Item's `stackable` field (schema-level distinction between quantity-accumulating and one-of-a-kind items, §8) has no enforcement anywhere. `COMMAND_ADD_ITEM` still unconditionally merges-by-`itemId`/sums `quantity` (`src/engine/store/commands.ts`) regardless of `stackable` — a non-stackable item added a second time would just become `quantity: 2`, not rejected or capped at 1. Not fixed yet because nothing in the game currently adds a second copy of any item to expose the gap. Also open, and closely related to #11 above: no "equipped" state exists at all — a player owning two rapiers (once a second one is authored) has no way to indicate which is in use, and no comparison/swap UI is designed. Both need their own short spec before implementing, same as every other gap in this list.

13. **Node-unlock rendering was silently non-functional for the entire project history.** `PlayerState.unlockedNodes` (written by `COMMAND_UNLOCK_NODE` and `EndeavorPhase.unlocksNodesOnComplete`) has never been read by any renderer — `WorldNavigationView`'s POI lock indicator checked only the static `isUnlocked` content field, and `NodeInteractionCanvas`'s actor list had no lock check at all. §6's "a locked node should never be silently hidden" was true in the sense that nothing was ever actually locked-then-shown-as-locked at runtime; the player-earned-unlock half of the mechanic simply had no observable effect. See `docs/features/feature_node_unlock_rendering.md` for the fix (a shared `isNodeUnlocked` helper applied at both render sites) and `docs/decisions.md` for how this was found.

14. **Actor reuse across multiple Endeavors has no phase-conditional dialogue mechanism.** `Actor.dialogueId` is a single fixed reference — an Actor durable enough to be reused across several Endeavors (or several phases of the same one) has no way to point at different content depending on which Endeavor/phase is currently relevant, only ever the one dialogue authored at content-authoring time. First surfaced as a real, not hypothetical, concern with `actor_bookkeeper` (`docs/features/content_a_debt_in_steel.md`) — a second concrete motivating case, given the same shape of question already existed implicitly for `actor_mara_venn`. Not building a fix now — needs its own short spec (likely some form of phase-conditional or priority-ordered dialogue selection) before implementing, same as every other gap in this list.

None of these should be invented by an implementer (human or AI) filling a gap. Each needs its own short spec, added to this file or a new `docs/` file, before code implementing it is written.
