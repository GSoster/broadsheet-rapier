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

**First concrete reputation effect implemented, as a worked example:** talking to Mara Venn (`actor_mara_venn`) grants +5 actor-level reputation each time; at 10 reputation with her, a new dialogue line unlocks and `endeavor_the_missing_broadsheet` auto-advances from `phase_ask_around` to `phase_confront_the_buyer`. This is one hand-authored, actor-specific threshold, not a general system — it proves reputation *can* drive dialogue/narrative branching, nothing more.

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

## 9. Minigames

Four types exist conceptually: `DUEL`, `LOCKPICKING`, `FISHING`, `DICE`. Each is triggered from a source (an Actor, a POI action, an Endeavor phase) and resolves to success or failure, which in turn triggers narrative/state consequences.

**`DICE` is resolved** (first concrete minigame mechanic): roll two six-sided dice against a player-chosen wager. An even sum wins and pays out 2x the wager; an odd sum loses and the wager is deducted. No skill or difficulty scaling — pure chance, transparent odds (a coin flip's worth of even/odd across the 2–12 range). Wager range, stepping, and the click-to-throw interaction are specified in `web-implementation.md`. Chosen for being simple, fully testable, and legible to the player at a glance — a deliberately minimal first mechanic, not a template every future minigame must follow.

**Open design gap — not yet defined for the remaining three types:** the actual resolution mechanic, difficulty model, and win condition for `DUEL`, `LOCKPICKING`, and `FISHING`. Only the *contract* (launch with config, resolve to success/failure, dispatch consequence commands) is currently specified for them, in `web-implementation.md`. Do not implement gameplay mechanics for any of these three without a mechanic spec first.

## 10. Asset Principle

Every visual/audio asset is categorized by the node type it belongs to (District, POI, Actor, or general audio). If a **visual** asset is missing or fails to load, this must be visibly and unmistakably flagged during development and testing — never fail silently or render a blank space. **Audio assets follow the opposite rule: a missing or failed sound must degrade gracefully and fail silently — at most a console warning during development — and must never block or visibly/audibly interrupt play.** (Concrete implementation of both rules is in `web-implementation.md`.)

## 11. Save / Load

Player progress must be persistable across sessions, and portable as an exportable/importable file so a player can move saves between devices. (Concrete implementation is in `web-implementation.md`.)

---

## Open Design Gaps — Must Be Resolved Before Implementing Beyond the Technical Scaffold

1. Minigame resolution mechanics — formulas, difficulty scaling, win conditions — for `DUEL`, `LOCKPICKING`, and `FISHING` (`DICE` is now resolved, see §9). Once all four are defined, `MinigameLauncherPayload.config` (currently `Record<string, unknown>` as an untyped placeholder — see `web-implementation.md` §4) should become a discriminated union keyed off `type` — `DuelConfig | LockpickingConfig | FishingConfig | DiceConfig` — instead of staying a loose record.
2. Reputation tiers and their gameplay effects.
3. Economy balance — prices, rewards, costs for actions and goods.
4. Endeavor content beyond the single starter slice (`endeavor_the_missing_broadsheet`) — its actual phase-by-phase design.
5. Weather has no update mechanism. `worldClock.weather` (`web-implementation.md` §4) is set once at initialization and nothing — no command, no automatic rotation — ever changes it. Deferred until a narrative or minigame system actually needs it (e.g. a `DUEL` affected by rain, an Endeavor phase gated on `STORM`).
6. Dialogue branching/variation. `Actor.initialDialogue` is a single static string with no mechanism to vary based on game state (endeavor phase, unlocked clues, reputation). The state to drive this already exists (`activeEndeavors`, `unlockedClues`, `reputation`) — only the mechanism connecting dialogue content to that state is undefined. Needs its own spec before implementing beyond one static line per Actor. (Mara Venn's reputation-gated second line, §7, is one hand-authored instance of this, not the general mechanism.)
7. No anti-grinding/cooldown on repeated Actor conversations. Talking to Mara Venn repeatedly grants +5 reputation every time with no cooldown or diminishing returns, so reputation can be farmed instantly by repeat-clicking. Intentional for this phase — not a bug — but a real gap: any future reputation-gated content needs a decision on whether repeatable conversations should be capped, cooled down, or made one-time.
8. Dice minigame interaction is click-to-throw, not press-and-hold. A press-and-hold "charge" mechanic (wager or outcome influenced by hold duration) was considered and explicitly deferred as future polish — the current interaction is a single click/tap on "Throw" that resolves immediately. Not a design gap requiring a spec before proceeding, just noted so it isn't mistaken for an oversight.
9. Systemic progression design — repeatable/always-available activities (see the dice minigame as a first instance) versus unique Endeavor content, avoiding soft-locks, and how repeated player actions should be acknowledged narratively rather than silently grinding. Reference: `docs/narrative-inspirations.md` Section 4 (Fallen London — including its design-principles subsection — OGame, BiteFight). Not yet designed as a general system — needs its own spec before generalizing beyond the one existing gambling loop. Related, smaller-scale instance of the same "don't generalize prematurely" principle: `triggerPoiEntryEffects`/`triggerDistrictEntryEffects` in `App.tsx` are one-off named functions for entry sounds, not a content-driven registry of typed on-enter effects — that generalization is reasonable once a second real effect type exists, not before.

None of these should be invented by an implementer (human or AI) filling a gap. Each needs its own short spec, added to this file or a new `docs/` file, before code implementing it is written.
