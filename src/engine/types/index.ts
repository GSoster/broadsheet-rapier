import { z } from "zod";
import type { DistanceState } from "../minigames/duel";

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
  | "COMMAND_CANCEL_MINIGAME"
  | "COMMAND_ENTER_DIALOGUE_NODE"
  | "COMMAND_SELECT_DIALOGUE_CHOICE"
  | "COMMAND_OPEN_DIALOGUE"
  | "COMMAND_CLOSE_DIALOGUE"
  | "COMMAND_NEXT_DAY";

export interface StateCommand<T = Record<string, unknown>> {
  type: CommandType;
  payload: T;
}

export type MinigameType = "DUEL" | "LOCKPICKING" | "FISHING" | "DICE";

export const SHIFTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;
export type Shift = (typeof SHIFTS)[number];

export const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as const;
export type Season = (typeof SEASONS)[number];

export const WEATHERS = ["CLEAR", "RAIN", "FOG", "STORM"] as const;
export type Weather = (typeof WEATHERS)[number];

// DistanceState is re-exported from the duel resolver (its natural home,
// mirroring dice.ts owning its own types) rather than duplicated here.
export type { DistanceState };

export interface DiceConfig {
  wager: number;
}

export interface DuelConfig {
  opponentId: string;
  opponentName: string;
  opponentStartingEnergy: number;
  opponentStartingPoise: number;
  startingDistance?: DistanceState; // default OUT_OF_MEASURE if omitted
  // Whether the player can back out via "Flee" (COMMAND_CANCEL_MINIGAME)
  // before a winner is decided — default true if omitted, matching every
  // DUEL authored before this field existed. A story-critical duel with no
  // way back into it once fled (no re-trigger path if the player leaves)
  // should author this false, or Flee would let the player permanently
  // strand the Endeavor mid-phase. See docs/decisions.md.
  allowFlee?: boolean;
}

// A discriminated union keyed on `type` — DICE and DUEL now have real
// per-type config shapes; LOCKPICKING/FISHING keep the untyped bag until
// their mechanics are defined (game-design-spec.md Open Design Gaps, item 1).
export type MinigameLauncherPayload =
  | {
      type: "DICE";
      sourceId: string;
      config: DiceConfig;
      onSuccessCommands: StateCommand[];
      onFailureCommands: StateCommand[];
    }
  | {
      type: "DUEL";
      sourceId: string;
      config: DuelConfig;
      onSuccessCommands: StateCommand[];
      onFailureCommands: StateCommand[];
    }
  | {
      type: "LOCKPICKING" | "FISHING";
      sourceId: string;
      config: Record<string, unknown>;
      onSuccessCommands: StateCommand[];
      onFailureCommands: StateCommand[];
    };

// Gates a dialogue choice's availability against PlayerState. `nodeVisits.nodeId`
// omitted means "the node this requirement is attached to" — see the evaluator
// for the exact (already-incremented-before-evaluation) counting semantics.
export interface DialogueRequirement {
  requiredClues?: string[];
  minActorReputation?: { actorId: string; value: number };
  minFactionReputation?: { factionId: string; value: number };
  allowedShifts?: Shift[];
  nodeVisits?: { nodeId?: string; min?: number; max?: number };
}

export interface PlayerState {
  currencies: { gold: number; silver: number; bronze: number };
  worldClock: {
    shift: Shift;
    day: number;
    season: Season;
    weather: Weather;
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
  activeDialogue: { dialogueId: string } | null;
  dialogueProgress: Record<string, { currentNodeId: string; visitCounts: Record<string, number> }>;
}

// Restructured from a loose `{ type, payload: Record<string, unknown> }` shape into
// a `.strict()` discriminated union: content-authored command arrays (dialogue
// choices, minigame success/failure commands) are increasingly likely to be
// AI-authored, not application code a TS compile error would catch. This makes a
// malformed payload (missing field, wrong type, extra key) fail `safeParse`
// instead of silently passing and only breaking when a handler destructures it.
//
// Scoping, stated explicitly: this validates content at test/CI time
// (content-integrity.test.ts, schemas.test.ts) and on save-file import
// (parseAndValidateSave). It does NOT run on dispatchCommand's input at the
// playerStore.ts boundary — App.tsx's and DialogueOverlay's dispatch call sites
// stay TypeScript-only, same as before this change. Validating that boundary is
// separate, out-of-scope future work.
//
// COMMAND_NEXT_DAY is deliberately not a member of this union — it's
// internal-only (see applyCommand's throw-check) and must never be
// constructible as content-authored StateCommand JSON. CommandType (the TS
// union above) still includes it, since it's a real internal value used by
// applyCommand/DispatchableCommandType; only this schema excludes it. That
// means CommandType and this union are two lists maintained by hand — nothing
// enforces they stay in sync at compile time. Accepted debt for this phase,
// see docs/features/feature_dialogue_branching.md's Open Questions.
// Annotated as z.ZodType<StateCommand<any>>, not z.ZodType<StateCommand>: the
// discriminated union's inferred output has a per-command concrete payload
// type (e.g. MinigameLauncherPayload for COMMAND_START_MINIGAME), which is
// stricter than — and not assignable to — StateCommand's default generic
// `payload: Record<string, unknown>`. `any` here sidesteps that variance
// check without weakening runtime validation at all (the union members
// themselves are still fully typed/`.strict()`) — it only affects the
// static type this schema is declared to produce. An explicit annotation is
// also required regardless of which type is chosen, since z.lazy() makes
// this self-referential and TS can't infer through that without one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; `unknown` isn't viable here (breaks assignability for callers expecting StateCommand's default Record<string, unknown> payload)
export const StateCommandSchema: z.ZodType<StateCommand<any>> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("COMMAND_ADVANCE_SHIFT"), payload: z.object({}).strict() }),
  z.object({
    type: z.literal("COMMAND_UNLOCK_NODE"),
    payload: z.object({ nodeId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_MOVE_TO_SETTLEMENT"),
    payload: z.object({ settlementId: z.string(), districtId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_MOVE_TO_DISTRICT"),
    payload: z.object({ districtId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_MOVE_TO_POI"),
    payload: z.object({ poiId: z.string(), costShifts: z.number().optional() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADJUST_CURRENCY"),
    payload: z
      .object({ denomination: z.enum(["gold", "silver", "bronze"]), amount: z.number() })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADJUST_REPUTATION"),
    payload: z
      .object({ targetType: z.enum(["faction", "actor"]), targetId: z.string(), amount: z.number() })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADD_ITEM"),
    payload: z.object({ itemId: z.string(), quantity: z.number() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_REMOVE_ITEM"),
    payload: z.object({ itemId: z.string(), quantity: z.number() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_UNLOCK_CLUE"),
    payload: z.object({ clueId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_START_ENDEAVOR"),
    payload: z.object({ endeavorId: z.string(), initialPhaseId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_ADVANCE_ENDEAVOR_PHASE"),
    payload: z
      .object({
        endeavorId: z.string(),
        nextPhaseId: z.string(),
        unlocksNodesOnComplete: z.array(z.string()).optional(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_START_MINIGAME"),
    payload: z.lazy(() => MinigameLauncherPayloadSchema),
  }),
  z.object({
    type: z.literal("COMMAND_RESOLVE_MINIGAME"),
    payload: z.object({ isVictory: z.boolean() }).strict(),
  }),
  z.object({ type: z.literal("COMMAND_CANCEL_MINIGAME"), payload: z.object({}).strict() }),
  z.object({
    type: z.literal("COMMAND_ENTER_DIALOGUE_NODE"),
    payload: z.object({ dialogueId: z.string(), nodeId: z.string() }).strict(),
  }),
  z.object({
    type: z.literal("COMMAND_SELECT_DIALOGUE_CHOICE"),
    payload: z
      .object({
        dialogueId: z.string(),
        nextNodeId: z.string().nullable(),
        commands: z.lazy(() => z.array(StateCommandSchema)),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("COMMAND_OPEN_DIALOGUE"),
    payload: z.object({ dialogueId: z.string() }).strict(),
  }),
  z.object({ type: z.literal("COMMAND_CLOSE_DIALOGUE"), payload: z.object({}).strict() }),
]);

const DiceConfigSchema = z.object({ wager: z.number() }).strict();

const DuelConfigSchema = z
  .object({
    opponentId: z.string(),
    opponentName: z.string(),
    opponentStartingEnergy: z.number(),
    opponentStartingPoise: z.number(),
    startingDistance: z.enum(["OUT_OF_MEASURE", "IN_MEASURE", "CLOSE_QUARTERS"]).optional(),
    allowFlee: z.boolean().optional(),
  })
  .strict();

const MinigameLauncherPayloadSchema: z.ZodType<MinigameLauncherPayload> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("DICE"),
    sourceId: z.string(),
    config: DiceConfigSchema,
    onSuccessCommands: z.lazy(() => z.array(StateCommandSchema)),
    onFailureCommands: z.lazy(() => z.array(StateCommandSchema)),
  }),
  z.object({
    type: z.literal("DUEL"),
    sourceId: z.string(),
    config: DuelConfigSchema,
    onSuccessCommands: z.lazy(() => z.array(StateCommandSchema)),
    onFailureCommands: z.lazy(() => z.array(StateCommandSchema)),
  }),
  z.object({
    type: z.enum(["LOCKPICKING", "FISHING"]),
    sourceId: z.string(),
    config: z.record(z.string(), z.unknown()),
    onSuccessCommands: z.lazy(() => z.array(StateCommandSchema)),
    onFailureCommands: z.lazy(() => z.array(StateCommandSchema)),
  }),
]);

export const PlayerStateSchema: z.ZodType<PlayerState> = z.object({
  currencies: z.object({
    gold: z.number(),
    silver: z.number(),
    bronze: z.number(),
  }),
  worldClock: z.object({
    shift: z.enum(SHIFTS),
    day: z.number(),
    season: z.enum(SEASONS),
    weather: z.enum(WEATHERS),
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
  activeDialogue: z.object({ dialogueId: z.string() }).strict().nullable(),
  dialogueProgress: z.record(
    z.string(),
    z.object({
      currentNodeId: z.string(),
      visitCounts: z.record(z.string(), z.number()),
    })
  ),
});
