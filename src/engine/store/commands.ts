import type { CommandType, MinigameLauncherPayload, PlayerState, Shift, StateCommand } from "../types";
import { SHIFTS } from "../types";
import { applyModifiers, type ModifierKey, type ModifierSet } from "../modifiers";

// Threaded through applyCommand so handlers can look up the player's active
// item-granted modifiers without commands.ts importing content itself — the
// ModifierSet is collected upstream (modifierResolution.ts) and handed in.
// Optional throughout: an omitted ctx (or omitted ctx.modifiers) behaves
// exactly as an empty ModifierSet would, preserving every pre-modifier-system
// call site and test unchanged (docs/features/feature_modifier_system.md §2.10).
export interface ApplyCommandContext {
  modifiers?: ModifierSet;
}

type CommandHandler = (
  state: PlayerState,
  payload: Record<string, unknown>,
  ctx: ApplyCommandContext
) => PlayerState;

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

export function currenciesToBronzeEquivalent(currencies: PlayerState["currencies"]): number {
  return currencies.gold * 400 + currencies.silver * 20 + currencies.bronze;
}

export function bronzeEquivalentToCurrencies(totalBronze: number): PlayerState["currencies"] {
  // Hard floor: total value can never go negative — this is the store-level
  // guarantee, not just a UI-layer convention (a negative total clamps to 0).
  const clamped = Math.max(0, totalBronze);
  const gold = Math.floor(clamped / 400);
  const remainder = clamped % 400;
  const silver = Math.floor(remainder / 20);
  const bronze = remainder % 20;
  return { gold, silver, bronze };
}

function clampReputation(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function enterDialogueNode(state: PlayerState, dialogueId: string, nodeId: string): PlayerState {
  const existing = state.dialogueProgress[dialogueId];
  const visitCounts = { ...(existing?.visitCounts ?? {}) };
  visitCounts[nodeId] = (visitCounts[nodeId] ?? 0) + 1;
  return {
    ...state,
    dialogueProgress: {
      ...state.dialogueProgress,
      [dialogueId]: { currentNodeId: nodeId, visitCounts },
    },
  };
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
      currentLocation: { settlementId, districtId },
    };
    return applyAdvanceShift(moved);
  },

  COMMAND_MOVE_TO_DISTRICT: (state, payload) => {
    const { districtId } = payload as { districtId: string };
    return {
      ...state,
      currentLocation: { settlementId: state.currentLocation.settlementId, districtId },
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

  // Modifier key is derived from the sign of `amount` (GAIN vs. LOSS), unless
  // `payload.modifierKey` overrides it — the one escape valve a command
  // needs (the dice minigame's CURRENCY_GAMBLING_WINNINGS carve-out, so an
  // item bonus can't quietly break dice's EV-neutral odds). The magnitude is
  // scaled in bronze-equivalent, not the payload's own denomination, because
  // rounding in a coarse unit (e.g. gold) would destroy a small percentage
  // before it could apply. amount === 0 short-circuits before any modifier
  // pass — Math.sign(0) === 0 must never conjure currency out of a no-op.
  // See docs/features/feature_modifier_system.md §2.8.
  COMMAND_ADJUST_CURRENCY: (state, payload, ctx) => {
    const { denomination, amount, modifierKey } = payload as {
      denomination: "gold" | "silver" | "bronze";
      amount: number;
      modifierKey?: string;
    };
    if (amount === 0) {
      return state;
    }
    const denominationValueInBronze = denomination === "gold" ? 400 : denomination === "silver" ? 20 : 1;
    const magnitude = Math.abs(amount) * denominationValueInBronze;
    const key = modifierKey ?? (amount > 0 ? "CURRENCY_GAIN" : "CURRENCY_LOSS");
    const modifiedMagnitude = applyModifiers(magnitude, ctx.modifiers ?? [], key);
    const signedDelta = Math.sign(amount) * modifiedMagnitude;
    const nextTotal = currenciesToBronzeEquivalent(state.currencies) + signedDelta;
    return { ...state, currencies: bronzeEquivalentToCurrencies(nextTotal) };
  },

  COMMAND_ADJUST_REPUTATION: (state, payload, ctx) => {
    const { targetType, targetId, amount } = payload as {
      targetType: "faction" | "actor";
      targetId: string;
      amount: number;
    };
    if (amount === 0) {
      return state;
    }
    const key = targetType === "faction" ? "factions" : "actors";
    const modifierKey: ModifierKey = amount > 0 ? "REPUTATION_GAIN" : "REPUTATION_LOSS";
    const modifiedMagnitude = applyModifiers(Math.abs(amount), ctx.modifiers ?? [], modifierKey, targetId);
    const signedDelta = Math.sign(amount) * modifiedMagnitude;
    const current = state.reputation[key][targetId] ?? 0;
    return {
      ...state,
      reputation: {
        ...state.reputation,
        [key]: { ...state.reputation[key], [targetId]: clampReputation(current + signedDelta) },
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

  COMMAND_RESOLVE_MINIGAME: (state, payload, ctx) => {
    const { isVictory } = payload as { isVictory: boolean };
    const minigame = state.activeMinigame;
    if (!minigame) return state;
    const followUpCommands = isVictory ? minigame.onSuccessCommands : minigame.onFailureCommands;
    let next: PlayerState = { ...state, activeMinigame: null };
    for (const command of followUpCommands) {
      next = applyCommand(next, command, ctx);
    }
    return next;
  },

  // Leaves/cancels the active minigame with no consequence — neither
  // onSuccessCommands nor onFailureCommands run. Distinct from
  // COMMAND_RESOLVE_MINIGAME, which always applies one side or the other;
  // this is for backing out before playing (e.g. a wager the player can't
  // or no longer wants to afford), not a win/lose outcome.
  COMMAND_CANCEL_MINIGAME: (state) => ({ ...state, activeMinigame: null }),

  // Pure bookkeeping: opening or resuming a conversation. No commands field
  // in the payload shape at all — this command cannot have side effects, by
  // construction, not by convention.
  COMMAND_ENTER_DIALOGUE_NODE: (state, payload) => {
    const { dialogueId, nodeId } = payload as { dialogueId: string; nodeId: string };
    return enterDialogueNode(state, dialogueId, nodeId);
  },

  // Advances AND dispatches consequences. Always has a commands field
  // (possibly empty), because a choice with no listed consequences is still
  // explicitly "this was a choice selection," not "this was bookkeeping."
  // nextNodeId is nullable at the command-payload level: null means "this
  // choice ends the conversation," handled by skipping the dialogueProgress
  // update entirely, not by substituting the current node id back in (which
  // would double-count a visit to the node the player is leaving).
  COMMAND_SELECT_DIALOGUE_CHOICE: (state, payload, ctx) => {
    const { dialogueId, nextNodeId, commands } = payload as {
      dialogueId: string;
      nextNodeId: string | null;
      commands?: StateCommand[];
    };
    let next = nextNodeId === null ? state : enterDialogueNode(state, dialogueId, nextNodeId);
    // `commands` defaults to [] at the DialogueChoiceSchema level, but that
    // Zod default only applies when content is actually parsed through the
    // schema — App.tsx's static JSON imports never are (see
    // docs/web-implementation.md §4's discriminated-union scoping note), so
    // a choice that omits `commands` in its authored JSON reaches this
    // handler as `undefined`, not `[]`. Same `?? []` pattern already used for
    // COMMAND_ADVANCE_ENDEAVOR_PHASE's optional unlocksNodesOnComplete.
    for (const command of commands ?? []) {
      next = applyCommand(next, command, ctx);
    }
    return next;
  },

  // Sets which dialogue is visible. Deliberately separate from
  // COMMAND_ENTER_DIALOGUE_NODE (which stays pure bookkeeping, no side
  // effects) — the same reasoning that kept COMMAND_ENTER_DIALOGUE_NODE and
  // COMMAND_SELECT_DIALOGUE_CHOICE apart. Dispatched alongside
  // COMMAND_ENTER_DIALOGUE_NODE wherever a dialogue is opened, including
  // from a minigame's onSuccessCommands/onFailureCommands.
  COMMAND_OPEN_DIALOGUE: (state, payload) => {
    const { dialogueId } = payload as { dialogueId: string };
    return { ...state, activeDialogue: { dialogueId } };
  },

  // Clears activeDialogue with no consequence — mirrors
  // COMMAND_CANCEL_MINIGAME exactly (unconditional, no guard, nothing else
  // changes). Dispatched from the Close button, an ending dialogue choice,
  // and leaving the POI mid-conversation.
  COMMAND_CLOSE_DIALOGUE: (state) => ({ ...state, activeDialogue: null }),
};

export function applyCommand(
  state: PlayerState,
  command: StateCommand,
  ctx: ApplyCommandContext = {}
): PlayerState {
  if (command.type === "COMMAND_NEXT_DAY") {
    throw new Error(
      "COMMAND_NEXT_DAY is internal-only and cannot be dispatched directly; it runs as part of COMMAND_ADVANCE_SHIFT."
    );
  }
  const handler = handlers[command.type];
  return handler(state, command.payload, ctx);
}
