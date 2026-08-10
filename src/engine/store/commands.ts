import type { CommandType, MinigameLauncherPayload, PlayerState, Shift, StateCommand } from "../types";
import { SHIFTS } from "../types";

type CommandHandler = (state: PlayerState, payload: Record<string, unknown>) => PlayerState;

function nextShift(shift: Shift): Shift {
  const index = SHIFTS.indexOf(shift);
  return SHIFTS[(index + 1) % SHIFTS.length];
}

function applyNextDay(state: PlayerState): PlayerState {
  return {
    ...state,
    worldClock: { ...state.worldClock, shift: "MORNING", day: state.worldClock.day + 1 },
  };
}

function applyAdvanceShift(state: PlayerState): PlayerState {
  if (state.worldClock.shift === "NIGHT") {
    return applyNextDay(state);
  }
  return {
    ...state,
    worldClock: { ...state.worldClock, shift: nextShift(state.worldClock.shift) },
  };
}

function advanceShiftsBy(state: PlayerState, count: number): PlayerState {
  let next = state;
  for (let i = 0; i < count; i++) {
    next = applyAdvanceShift(next);
  }
  return next;
}

function normalizeCurrencies(currencies: PlayerState["currencies"]): PlayerState["currencies"] {
  let { gold, silver, bronze } = currencies;
  silver += Math.floor(bronze / 20);
  bronze = bronze % 20;
  gold += Math.floor(silver / 20);
  silver = silver % 20;
  return { gold, silver, bronze };
}

function clampReputation(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

type DispatchableCommandType = Exclude<CommandType, "COMMAND_NEXT_DAY">;

const handlers: Record<DispatchableCommandType, CommandHandler> = {
  COMMAND_ADVANCE_SHIFT: (state) => applyAdvanceShift(state),

  COMMAND_UNLOCK_NODE: (state, payload) => {
    const { nodeId } = payload as { nodeId: string };
    return { ...state, unlockedNodes: { ...state.unlockedNodes, [nodeId]: true } };
  },

  COMMAND_MOVE_TO_SETTLEMENT: (state, payload) => {
    const { settlementId, districtId } = payload as { settlementId: string; districtId: string };
    const moved: PlayerState = {
      ...state,
      currentLocation: { settlementId, districtId, poiId: undefined },
    };
    return applyAdvanceShift(moved);
  },

  COMMAND_MOVE_TO_DISTRICT: (state, payload) => {
    const { districtId } = payload as { districtId: string };
    return {
      ...state,
      currentLocation: { ...state.currentLocation, districtId, poiId: undefined },
    };
  },

  COMMAND_MOVE_TO_POI: (state, payload) => {
    const { poiId, costShifts } = payload as { poiId: string; costShifts?: number };
    const moved: PlayerState = {
      ...state,
      currentLocation: { ...state.currentLocation, poiId },
    };
    return costShifts && costShifts > 0 ? advanceShiftsBy(moved, costShifts) : moved;
  },

  COMMAND_ADJUST_CURRENCY: (state, payload) => {
    const { denomination, amount } = payload as {
      denomination: "gold" | "silver" | "bronze";
      amount: number;
    };
    const currencies = { ...state.currencies, [denomination]: state.currencies[denomination] + amount };
    return { ...state, currencies: normalizeCurrencies(currencies) };
  },

  COMMAND_ADJUST_REPUTATION: (state, payload) => {
    const { targetType, targetId, amount } = payload as {
      targetType: "faction" | "actor";
      targetId: string;
      amount: number;
    };
    const key = targetType === "faction" ? "factions" : "actors";
    const current = state.reputation[key][targetId] ?? 0;
    return {
      ...state,
      reputation: {
        ...state.reputation,
        [key]: { ...state.reputation[key], [targetId]: clampReputation(current + amount) },
      },
    };
  },

  COMMAND_ADD_ITEM: (state, payload) => {
    const { itemId, quantity } = payload as { itemId: string; quantity: number };
    const existing = state.inventory.find((item) => item.itemId === itemId);
    const inventory = existing
      ? state.inventory.map((item) =>
          item.itemId === itemId ? { ...item, quantity: item.quantity + quantity } : item
        )
      : [...state.inventory, { itemId, quantity }];
    return { ...state, inventory };
  },

  COMMAND_REMOVE_ITEM: (state, payload) => {
    const { itemId, quantity } = payload as { itemId: string; quantity: number };
    const inventory = state.inventory
      .map((item) => (item.itemId === itemId ? { ...item, quantity: item.quantity - quantity } : item))
      .filter((item) => item.quantity > 0);
    return { ...state, inventory };
  },

  COMMAND_UNLOCK_CLUE: (state, payload) => {
    const { clueId } = payload as { clueId: string };
    return state.unlockedClues.includes(clueId)
      ? state
      : { ...state, unlockedClues: [...state.unlockedClues, clueId] };
  },

  COMMAND_START_ENDEAVOR: (state, payload) => {
    const { endeavorId, initialPhaseId } = payload as { endeavorId: string; initialPhaseId: string };
    return {
      ...state,
      activeEndeavors: {
        ...state.activeEndeavors,
        [endeavorId]: { currentPhaseId: initialPhaseId, logHistory: [] },
      },
    };
  },

  COMMAND_ADVANCE_ENDEAVOR_PHASE: (state, payload) => {
    const { endeavorId, nextPhaseId, unlocksNodesOnComplete } = payload as {
      endeavorId: string;
      nextPhaseId: string;
      unlocksNodesOnComplete?: string[];
    };
    const endeavor = state.activeEndeavors[endeavorId];
    const updatedEndeavors = {
      ...state.activeEndeavors,
      [endeavorId]: {
        currentPhaseId: nextPhaseId,
        logHistory: [...endeavor.logHistory, endeavor.currentPhaseId],
      },
    };
    const unlockedNodes = { ...state.unlockedNodes };
    for (const nodeId of unlocksNodesOnComplete ?? []) {
      unlockedNodes[nodeId] = true;
    }
    return { ...state, activeEndeavors: updatedEndeavors, unlockedNodes };
  },

  COMMAND_START_MINIGAME: (state, payload) => {
    return { ...state, activeMinigame: payload as unknown as MinigameLauncherPayload };
  },

  COMMAND_RESOLVE_MINIGAME: (state, payload) => {
    const { isVictory } = payload as { isVictory: boolean };
    const minigame = state.activeMinigame;
    if (!minigame) return state;
    const followUpCommands = isVictory ? minigame.onSuccessCommands : minigame.onFailureCommands;
    let next: PlayerState = { ...state, activeMinigame: null };
    for (const command of followUpCommands) {
      next = applyCommand(next, command);
    }
    return next;
  },
};

export function applyCommand(state: PlayerState, command: StateCommand): PlayerState {
  if (command.type === "COMMAND_NEXT_DAY") {
    throw new Error(
      "COMMAND_NEXT_DAY is internal-only and cannot be dispatched directly; it runs as part of COMMAND_ADVANCE_SHIFT."
    );
  }
  const handler = handlers[command.type];
  return handler(state, command.payload);
}
