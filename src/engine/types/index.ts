import { z } from "zod";

export type CommandType =
  | "COMMAND_ADVANCE_SHIFT"
  | "COMMAND_UNLOCK_NODE"
  | "COMMAND_MOVE_TO_SETTLEMENT"
  | "COMMAND_MOVE_TO_DISTRICT"
  | "COMMAND_MOVE_TO_POI"
  | "COMMAND_ADJUST_CURRENCY"
  | "COMMAND_ADJUST_REPUTATION"
  | "COMMAND_ADD_ITEM"
  | "COMMAND_REMOVE_ITEM"
  | "COMMAND_UNLOCK_CLUE"
  | "COMMAND_START_ENDEAVOR"
  | "COMMAND_ADVANCE_ENDEAVOR_PHASE"
  | "COMMAND_START_MINIGAME"
  | "COMMAND_RESOLVE_MINIGAME"
  | "COMMAND_NEXT_DAY";

export interface StateCommand<T = Record<string, unknown>> {
  type: CommandType;
  payload: T;
}

export type MinigameType = "DUEL" | "LOCKPICKING" | "FISHING" | "DICE";

export interface MinigameLauncherPayload {
  type: MinigameType;
  sourceId: string;
  config: Record<string, any>;
  onSuccessCommands: StateCommand[];
  onFailureCommands: StateCommand[];
}

export interface PlayerState {
  currencies: { gold: number; silver: number; bronze: number };
  worldClock: {
    shift: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
    day: number;
    season: "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
  };
  currentLocation: {
    settlementId: string;
    districtId: string;
    poiId?: string;
  };
  reputation: {
    factions: Record<string, number>;
    actors: Record<string, number>;
  };
  inventory: Array<{ itemId: string; quantity: number }>;
  unlockedNodes: Record<string, boolean>;
  unlockedClues: string[];
  activeEndeavors: Record<string, { currentPhaseId: string; logHistory: string[] }>;
  activeMinigame: MinigameLauncherPayload | null;
}

const StateCommandSchema: z.ZodType<StateCommand> = z.object({
  type: z.enum([
    "COMMAND_ADVANCE_SHIFT",
    "COMMAND_UNLOCK_NODE",
    "COMMAND_MOVE_TO_SETTLEMENT",
    "COMMAND_MOVE_TO_DISTRICT",
    "COMMAND_MOVE_TO_POI",
    "COMMAND_ADJUST_CURRENCY",
    "COMMAND_ADJUST_REPUTATION",
    "COMMAND_ADD_ITEM",
    "COMMAND_REMOVE_ITEM",
    "COMMAND_UNLOCK_CLUE",
    "COMMAND_START_ENDEAVOR",
    "COMMAND_ADVANCE_ENDEAVOR_PHASE",
    "COMMAND_START_MINIGAME",
    "COMMAND_RESOLVE_MINIGAME",
    "COMMAND_NEXT_DAY",
  ]),
  payload: z.record(z.string(), z.unknown()),
});

const MinigameLauncherPayloadSchema: z.ZodType<MinigameLauncherPayload> = z.object({
  type: z.enum(["DUEL", "LOCKPICKING", "FISHING", "DICE"]),
  sourceId: z.string(),
  config: z.record(z.string(), z.any()),
  onSuccessCommands: z.array(StateCommandSchema),
  onFailureCommands: z.array(StateCommandSchema),
});

export const PlayerStateSchema: z.ZodType<PlayerState> = z.object({
  currencies: z.object({
    gold: z.number(),
    silver: z.number(),
    bronze: z.number(),
  }),
  worldClock: z.object({
    shift: z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]),
    day: z.number(),
    season: z.enum(["SPRING", "SUMMER", "AUTUMN", "WINTER"]),
  }),
  currentLocation: z.object({
    settlementId: z.string(),
    districtId: z.string(),
    poiId: z.string().optional(),
  }),
  reputation: z.object({
    factions: z.record(z.string(), z.number()),
    actors: z.record(z.string(), z.number()),
  }),
  inventory: z.array(
    z.object({
      itemId: z.string(),
      quantity: z.number(),
    })
  ),
  unlockedNodes: z.record(z.string(), z.boolean()),
  unlockedClues: z.array(z.string()),
  activeEndeavors: z.record(
    z.string(),
    z.object({
      currentPhaseId: z.string(),
      logHistory: z.array(z.string()),
    })
  ),
  activeMinigame: MinigameLauncherPayloadSchema.nullable(),
});
