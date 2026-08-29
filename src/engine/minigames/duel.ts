import type { TFunction } from "i18next";
import i18n from "../i18n";
import { applyModifiers, type ModifierSet } from "../modifiers";

export type RandomSource = () => number;

// Defaults evaluateDuelTurn's `t` to English — same "optional param, sane
// default" shape chooseOpponentAction's `random: RandomSource = Math.random`
// already uses. DuelGame.tsx always passes its own live, locale-aware `t`
// from useTranslation(); tests that don't care about localization (the vast
// majority of duel.test.ts) don't need to pass one at all.
const defaultT: TFunction = i18n.getFixedT("en");

export type DistanceState = "OUT_OF_MEASURE" | "IN_MEASURE" | "CLOSE_QUARTERS";

export type DuelAction = "THRUST" | "PARRY_RIPOSTE" | "FEINT" | "TAUNT" | "DIRTY_TRICK";

export interface CombatantState {
  energy: number;
  poise: number;
}

export interface DuelContext {
  player: CombatantState;
  opponent: CombatantState;
  distance: DistanceState;
  // The player's action from the previous turn (null on turn 1) — feeds
  // chooseOpponentAction's "parry after an aggressive player action" heuristic.
  lastPlayerAction: DuelAction | null;
  // Snapshot of PlayerState.reputation, same shape — lets TAUNT (and any
  // future action) read reputation without widening either function's
  // signature. Deliberately open to further extension later (equipped
  // weapon, etc.) the same way — see game-design-spec.md Open Design Gaps.
  playerReputation: { factions: Record<string, number>; actors: Record<string, number> };
  // The player's active item-granted modifiers (docs/features/
  // feature_modifier_system.md §2.8's "context extension, no command"
  // treatment). Only DUEL_DAMAGE_DEALT is wired this phase — it modifies the
  // damage the PLAYER's own Thrust/Dirty Trick deals, not damage the player
  // takes (DUEL_DAMAGE_TAKEN/DUEL_STARTING_POISE stay unwired, matching the
  // one worked example the spec actually gives).
  modifiers: ModifierSet;
}

export type DuelOutcome = "ONGOING" | "PLAYER_VICTORY" | "PLAYER_DEFEAT";

export interface DuelTurnResult {
  player: CombatantState;
  opponent: CombatantState;
  distance: DistanceState;
  playerAction: DuelAction;
  opponentAction: DuelAction;
  log: string[];
  outcome: DuelOutcome;
}

// Placeholder/first-mechanic numbers, not balanced ones — same treatment as
// dice.ts's MIN_WAGER/MAX_WAGER/WAGER_STEP. See docs/features/feature_rapier_duel.md.
export const PLAYER_STARTING_ENERGY = 100;
export const PLAYER_STARTING_POISE = 100;

export const THRUST_DAMAGE = 15;
export const RIPOSTE_COUNTER_DAMAGE = 20;
export const FEINT_POISE_DRAIN = 10;
export const DIRTY_TRICK_DAMAGE = 20;
export const DIRTY_TRICK_POISE_DRAIN = 10;
export const TAUNT_POISE_DRAIN_BASE = 5;
export const TAUNT_POISE_DRAIN_REPUTATION_BONUS = 10;
export const TAUNT_REPUTATION_THRESHOLD = 10;
// A broken guard (poise already at 0 when a Thrust/Dirty Trick lands) is a
// real opening, not just flavor — bonus damage on top of the base hit.
export const GUARD_BREAK_BONUS_DAMAGE = 15;

export const OPPONENT_LOW_POISE_THRESHOLD = 30;
export const OPPONENT_HEALTHY_ENERGY_THRESHOLD = 40;

// This duel's worked example: Taunt's reputation check targets one specific
// faction, hardcoded here — not a general reputation-driven-taunt system.
const TAUNT_TARGET_FACTION_ID = "faction_wagering_ring";

const AGGRESSIVE_ACTIONS: ReadonlySet<DuelAction> = new Set(["THRUST", "DIRTY_TRICK"]);

// Human-readable, locale-aware labels for the raw DuelAction enum — shared
// by the log strings below and DuelGame.tsx's action buttons/log
// highlighting, so the two never drift into two different names for the
// same action. The underlying DuelAction enum values themselves never
// localize (docs/features/feature_localization.md) — only this rendered
// label does.
export function getActionLabels(t: TFunction): Record<DuelAction, string> {
  return {
    THRUST: t("duel.actions.THRUST"),
    PARRY_RIPOSTE: t("duel.actions.PARRY_RIPOSTE"),
    FEINT: t("duel.actions.FEINT"),
    TAUNT: t("duel.actions.TAUNT"),
    DIRTY_TRICK: t("duel.actions.DIRTY_TRICK"),
  };
}

function isLegal(action: DuelAction, distance: DistanceState): boolean {
  if (action === "THRUST") return distance === "IN_MEASURE";
  if (action === "DIRTY_TRICK") return distance === "CLOSE_QUARTERS";
  return true;
}

function closeDistance(distance: DistanceState): DistanceState {
  if (distance === "OUT_OF_MEASURE") return "IN_MEASURE";
  return "CLOSE_QUARTERS";
}

function clampFloor(value: number): number {
  return Math.max(0, value);
}

export function evaluateDuelTurn(
  context: DuelContext,
  playerAction: DuelAction,
  opponentAction: DuelAction,
  t: TFunction = defaultT
): DuelTurnResult {
  const labels = getActionLabels(t);
  const log: string[] = [];
  const player: CombatantState = { ...context.player };
  const opponent: CombatantState = { ...context.opponent };
  let distance = context.distance;

  const playerLegal = isLegal(playerAction, distance);
  const opponentLegal = isLegal(opponentAction, distance);
  if (!playerLegal) log.push(t("duel.log.fails", { action: labels[playerAction] }));
  if (!opponentLegal) log.push(t("duel.log.opponentFails", { action: labels[opponentAction] }));

  const playerAttacks = playerLegal && AGGRESSIVE_ACTIONS.has(playerAction);
  const opponentAttacks = opponentLegal && AGGRESSIVE_ACTIONS.has(opponentAction);

  const opponentParriesPlayer = opponentAction === "PARRY_RIPOSTE" && playerAttacks;
  const playerParriesOpponent = playerAction === "PARRY_RIPOSTE" && opponentAttacks;

  // Guard-break is evaluated off the pre-turn poise (context), not any
  // mid-turn-updated value — a hit's own poise drain doesn't retroactively
  // bonus itself, and only a landed Thrust/Dirty Trick benefits from it.
  const opponentGuardBroken = context.opponent.poise <= 0;
  const playerGuardBroken = context.player.poise <= 0;

  if (playerAttacks && opponentParriesPlayer) {
    const damage = RIPOSTE_COUNTER_DAMAGE;
    player.energy = clampFloor(player.energy - damage);
    log.push(t("duel.log.opponentParries", { action: labels[playerAction], damage }));
  } else if (playerAttacks) {
    let damage = playerAction === "THRUST" ? THRUST_DAMAGE : DIRTY_TRICK_DAMAGE;
    if (opponentGuardBroken) {
      damage += GUARD_BREAK_BONUS_DAMAGE;
      log.push(t("duel.log.guardBrokenYours", { action: labels[playerAction] }));
    }
    // Damage the player deals — the only duel calculation site wired to
    // modifiers this phase (docs/features/feature_modifier_system.md §2.9).
    damage = applyModifiers(damage, context.modifiers, "DUEL_DAMAGE_DEALT");
    opponent.energy = clampFloor(opponent.energy - damage);
    if (playerAction === "DIRTY_TRICK") {
      opponent.poise = clampFloor(opponent.poise - DIRTY_TRICK_POISE_DRAIN);
    }
    log.push(t("duel.log.landsFor", { action: labels[playerAction], damage }));
  } else if (playerAction === "PARRY_RIPOSTE") {
    log.push(t("duel.log.holdGuard"));
  }

  if (opponentAttacks && playerParriesOpponent) {
    const damage = applyModifiers(RIPOSTE_COUNTER_DAMAGE, context.modifiers, "DUEL_DAMAGE_DEALT");
    opponent.energy = clampFloor(opponent.energy - damage);
    log.push(t("duel.log.youParry", { action: labels[opponentAction], damage }));
  } else if (opponentAttacks) {
    let damage = opponentAction === "THRUST" ? THRUST_DAMAGE : DIRTY_TRICK_DAMAGE;
    if (playerGuardBroken) {
      damage += GUARD_BREAK_BONUS_DAMAGE;
      log.push(t("duel.log.guardBrokenTheirs"));
    }
    player.energy = clampFloor(player.energy - damage);
    if (opponentAction === "DIRTY_TRICK") {
      player.poise = clampFloor(player.poise - DIRTY_TRICK_POISE_DRAIN);
    }
    log.push(t("duel.log.opponentLandsFor", { action: labels[opponentAction], damage }));
  } else if (opponentAction === "PARRY_RIPOSTE") {
    log.push(t("duel.log.opponentHoldsGuard"));
  }

  if (playerAction === "FEINT") {
    opponent.poise = clampFloor(opponent.poise - FEINT_POISE_DRAIN);
    log.push(t("duel.log.feintYours", { action: labels.FEINT, amount: FEINT_POISE_DRAIN }));
  }
  if (opponentAction === "FEINT") {
    player.poise = clampFloor(player.poise - FEINT_POISE_DRAIN);
    log.push(t("duel.log.feintTheirs", { action: labels.FEINT, amount: FEINT_POISE_DRAIN }));
  }
  // A single step regardless of how many sides Feint this turn — mutual
  // Feints don't chain into a double shift.
  if (playerAction === "FEINT" || opponentAction === "FEINT") {
    distance = closeDistance(distance);
  }

  if (playerAction === "TAUNT") {
    const reputation = context.playerReputation.factions[TAUNT_TARGET_FACTION_ID] ?? 0;
    let drain = TAUNT_POISE_DRAIN_BASE;
    if (reputation >= TAUNT_REPUTATION_THRESHOLD) {
      drain += TAUNT_POISE_DRAIN_REPUTATION_BONUS;
    }
    opponent.poise = clampFloor(opponent.poise - drain);
    log.push(t("duel.log.tauntYours", { action: labels.TAUNT, amount: drain }));
  }
  if (opponentAction === "TAUNT") {
    player.poise = clampFloor(player.poise - TAUNT_POISE_DRAIN_BASE);
    log.push(t("duel.log.tauntTheirs", { action: labels.TAUNT, amount: TAUNT_POISE_DRAIN_BASE }));
  }

  let outcome: DuelOutcome = "ONGOING";
  if (player.energy <= 0) {
    outcome = "PLAYER_DEFEAT";
  } else if (opponent.energy <= 0) {
    outcome = "PLAYER_VICTORY";
  }

  return { player, opponent, distance, playerAction, opponentAction, log, outcome };
}

export function chooseOpponentAction(context: DuelContext, random: RandomSource = Math.random): DuelAction {
  if (context.opponent.poise <= OPPONENT_LOW_POISE_THRESHOLD) {
    return "FEINT";
  }
  if (context.lastPlayerAction !== null && AGGRESSIVE_ACTIONS.has(context.lastPlayerAction)) {
    return "PARRY_RIPOSTE";
  }
  const healthy = context.opponent.energy > OPPONENT_HEALTHY_ENERGY_THRESHOLD;
  if (healthy && context.distance === "IN_MEASURE") {
    return "THRUST";
  }
  if (healthy && context.distance === "CLOSE_QUARTERS") {
    return "DIRTY_TRICK";
  }
  if (context.distance === "OUT_OF_MEASURE") {
    return "FEINT";
  }
  return random() < 0.5 ? "FEINT" : "PARRY_RIPOSTE";
}
