# SYSTEM RULES & DOMAIN SPECIFICATION

## 1. Domain Vocabulary
- **Territory:** Macro nation/region (e.g., `territory_crown_lands`). Deferred — no schema or content until macro-world/regional travel is implemented.
- **Settlement:** Macro hub city or area (e.g., `settlement_valdeombra_city`).
- **District:** Neighborhood within a Settlement (e.g., `district_lantern_ward`, `district_low_quays`).
- **PointOfInterest (POI):** Specific interactive node inside a District (e.g., `poi_crooked_hour_tavern`).
- **Actor:** Any interactable person, animal, or key dynamic entity.
- **Faction:** An organizational group tracking player reputation (e.g., `faction_city_watch`).
- **Endeavor:** A narrative arc, quest, mystery, heist, or personal pursuit.
- **Shift:** Discrete unit of time (`MORNING`, `AFTERNOON`, `EVENING`, `NIGHT`).

## 2. Naming & Case Conventions
- **JSON Files & Entity IDs:** `snake_case` (e.g., `actor_mara_venn.json`, `district_lantern_ward.json`).
- **JSON Properties & JS Variables:** `camelCase` (e.g., `costShifts`, `unlockedPois`).
- **React Components & TS Types:** `PascalCase` (e.g., `CaseBoard.tsx`, `WorldClock.tsx`).
- **State Commands & Events:** `UPPER_SNAKE_CASE` (e.g., `COMMAND_ADVANCE_SHIFT`, `COMMAND_START_MINIGAME`).

## 3. World Engine & Rules

### A. Progression & Unlocking Engine
All macro nodes (`Settlement`, `District`, `POI`, `Actor`, `Endeavor`) contain an `isUnlocked` boolean. Locked nodes render as grayed-out UI elements displaying a lock indicator and hover hint. Unlocks occur via the `COMMAND_UNLOCK_NODE` state command.

### B. World Clock State
Tracks `currentShift`, `currentDay`, `currentSeason` (`SPRING`, `SUMMER`, `AUTUMN`, `WINTER`), and `currentWeather`.
- Moving between Districts inside a Settlement costs `0 Shifts`.
- Moving between Settlements costs `1 Shift`.
- Performing heavy actions/minigames costs `1 Shift`.
- Exceeding `NIGHT` shift triggers `COMMAND_NEXT_DAY` and sets shift to `MORNING`. `COMMAND_NEXT_DAY` is **internal-only**: it is triggered automatically inside the `COMMAND_ADVANCE_SHIFT` handler and is never dispatched directly by the UI.

### C. Currencies & Value Conversion
Currencies use Bronze, Silver, and Gold.
- 20 Bronze = 1 Silver
- 20 Silver = 1 Gold (400 Bronze total)

### D. Asset Fallback Indicator Rule
If an image or audio asset fails to load or is missing from public paths, render a high-visibility placeholder box with a bright purple border (`border-purple-600 bg-purple-950/80`), warning icon, and text displaying `MISSING: [asset_path]`.

### E. Asset Directory Structure
Static content assets are isolated alongside data content, kept separate from `src/engine/` so the engine remains asset-agnostic:
- `/public/content/assets/images/districts/`
- `/public/content/assets/images/pois/`
- `/public/content/assets/images/actors/`
- `/public/content/assets/audio/`

Asset filenames use `snake_case` (e.g., `lantern_ward_bg.webp`). Paths inside content JSON are relative/absolute web paths resolved by rendering components — never imported directly into engine code.

### F. Minigames
- `MinigameType = 'DUEL' | 'LOCKPICKING' | 'FISHING' | 'DICE'`.
- Minigames are stateless runners in `src/engine/minigames/`, driven entirely by a `MinigameLauncherPayload` passed at runtime (see §4).
- Launched via `COMMAND_START_MINIGAME(payload)`, resolved via `COMMAND_RESOLVE_MINIGAME(isVictory)`, which dispatches the payload's `onSuccessCommands` or `onFailureCommands`.

## 4. State Architecture & Storage

### Architectural Model
- `src/engine/` is purely generic, event-driven, and decoupled from narrative content. It must not import from `src/content/`.
- State updates follow a CQRS pattern: UI components dispatch explicit `StateCommand` objects (`UPPER_SNAKE_CASE` `type`). Command handlers mutate state and emit state-change events.
- Narrative content, world nodes, quests, and minigame configurations live strictly as JSON in `src/content/`.

### Player State Interface
```typescript
export interface PlayerState {
  currencies: { gold: number; silver: number; bronze: number };
  worldClock: {
    shift: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
    day: number;
    season: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  };
  currentLocation: {
    settlementId: string;
    districtId: string;
    poiId?: string;
  };
  reputation: {
    factions: Record<string, number>; // faction_id -> score (-100 to +100)
    actors: Record<string, number>;   // actor_id -> score (-100 to +100)
  };
  inventory: Array<{
    itemId: string;
    quantity: number;
  }>;
  unlockedNodes: Record<string, boolean>; // node_id -> isUnlocked
  unlockedClues: string[];
  activeEndeavors: Record<string, { currentPhaseId: string; logHistory: string[] }>;
  activeMinigame: MinigameLauncherPayload | null;
}

export type MinigameType = 'DUEL' | 'LOCKPICKING' | 'FISHING' | 'DICE';

export interface MinigameLauncherPayload {
  type: MinigameType;
  sourceId: string;
  config: Record<string, any>;
  onSuccessCommands: StateCommand[];
  onFailureCommands: StateCommand[];
}

export interface StateCommand<T = Record<string, unknown>> {
  type: CommandType;
  payload: T;
}
```

### Persistence
- Zustand `persist` middleware, `localStorage`, key `broadsheet_rapier_player_state`.
- `exportSave()` downloads the current `PlayerState` as a `.json` file. `importSave(file)` parses and validates the file against a `PlayerStateSchema` (structural check — required fields and correct types/enums, no version migration logic) before writing to state. A failed validation rejects the import without touching current state.

## 5. Content Schema Field Reference

- **Base node fields** (Settlement, District, POI, Actor): `id`, `name`, `description`, `isUnlocked`, `imageAsset?`.
- **District / POI** additionally: `controllingFactionId?: string`, `factionInfluence?: Record<string, number>`.
- **POI** additionally: `districtId`, `costShifts` (default 0), `availableShifts: Shift[]`, `actorIds: string[]`.
- **District** additionally: `settlementId`, `poiIds: string[]`.
- **Settlement** additionally: `districtIds: string[]`.
- **Actor** additionally: `poiId`, `factionIds: string[]` (multiple affiliations, default `[]`), `title`, `initialDialogue`.
- **Faction**: base fields only.
- **Endeavor**: `id`, `title`, `description`, `isUnlocked`, `initialPhaseId`, `phases: Record<string, EndeavorPhase>`.
- **EndeavorPhase**: `id`, `objectiveText`, `requiredClues?: string[]`, `nextPhaseOnSuccess?: string`, `unlocksNodesOnComplete: string[]`.

All content JSON under `src/content/` must validate against its corresponding Zod schema in `src/content/schemas/`.
