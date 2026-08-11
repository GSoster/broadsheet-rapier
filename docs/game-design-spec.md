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

**Open design gap — not yet defined:** what specific reputation values *do* in gameplay (dialogue changes, access restrictions, pricing, hostility thresholds). This must be specified before reputation effects are implemented — do not let an implementer invent tier thresholds or effects.

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

**Open design gap — not yet defined:** the actual resolution mechanic, difficulty model, and win condition for each minigame type. Only the *contract* (launch with config, resolve to success/failure, dispatch consequence commands) is currently specified, in `web-implementation.md`. Do not implement gameplay mechanics for any minigame without a mechanic spec for that type.

## 10. Asset Principle

Every visual/audio asset is categorized by the node type it belongs to (District, POI, Actor, or general audio). If an asset is missing or fails to load, this must be visibly and unmistakably flagged during development and testing — never fail silently or render a blank space. (Concrete implementation of this rule is in `web-implementation.md`.)

## 11. Save / Load

Player progress must be persistable across sessions, and portable as an exportable/importable file so a player can move saves between devices. (Concrete implementation is in `web-implementation.md`.)

---

## Open Design Gaps — Must Be Resolved Before Implementing Beyond the Technical Scaffold

1. Minigame resolution mechanics (all four types) — formulas, difficulty scaling, win conditions. Once these are defined, `MinigameLauncherPayload.config` (currently `Record<string, unknown>` as an untyped placeholder — see `web-implementation.md` §4) should become a discriminated union keyed off `type` — `DuelConfig | LockpickingConfig | FishingConfig | DiceConfig` — instead of staying a loose record.
2. Reputation tiers and their gameplay effects.
3. Economy balance — prices, rewards, costs for actions and goods.
4. Endeavor content beyond the single starter slice (`endeavor_the_missing_broadsheet`) — its actual phase-by-phase design.
5. Weather has no update mechanism. `worldClock.weather` (`web-implementation.md` §4) is set once at initialization and nothing — no command, no automatic rotation — ever changes it. Deferred until a narrative or minigame system actually needs it (e.g. a `DUEL` affected by rain, an Endeavor phase gated on `STORM`).
6. Dialogue branching/variation. `Actor.initialDialogue` is a single static string with no mechanism to vary based on game state (endeavor phase, unlocked clues, reputation). The state to drive this already exists (`activeEndeavors`, `unlockedClues`, `reputation`) — only the mechanism connecting dialogue content to that state is undefined. Needs its own spec before implementing beyond one static line per Actor.

None of these should be invented by an implementer (human or AI) filling a gap. Each needs its own short spec, added to this file or a new `docs/` file, before code implementing it is written.
