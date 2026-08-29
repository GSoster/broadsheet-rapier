// Query-time aggregation of per-item stat bonuses. Never stores an
// accumulated value on PlayerState — a ModifierSet is collected fresh from
// owned items and applied at the moment a base value is needed. Pure, no
// src/content/ imports (docs/features/feature_modifier_system.md §2.4/§2.11).

export const MODIFIER_KEYS = [
  "DUEL_DAMAGE_DEALT",
  "DUEL_DAMAGE_TAKEN",
  "DUEL_STARTING_POISE",
  "CURRENCY_GAIN",
  "CURRENCY_LOSS",
  "REPUTATION_GAIN",
  "REPUTATION_LOSS",
] as const;

export type ModifierKey = (typeof MODIFIER_KEYS)[number];

export type ModifierOp = "FLAT" | "PERCENT";

export interface Modifier {
  key: ModifierKey;
  op: ModifierOp;
  value: number;
  targetId?: string;
  sourceId: string;
  sourceLabel: string;
}

export type ModifierSet = readonly Modifier[];

// Widened for the one escape valve that needs it: COMMAND_ADJUST_CURRENCY's
// optional modifierKey override (§2.8) can name a key, like
// CURRENCY_GAMBLING_WINNINGS, that's deliberately NOT one of MODIFIER_KEYS —
// no Modifier can ever be authored against it, so a query for it always
// returns empty, guaranteeing inertness by construction. `string & {}`
// widens the literal-union without losing autocomplete on the real keys.
export type ModifierQueryKey = ModifierKey | (string & {});

// §2.4's targeting rule: a modifier matches a query when the query's target
// is at least as specific as the modifier's. An untargeted query returns
// only untargeted modifiers — a targeted modifier never leaks into a general
// query, chosen because the opposite reading fails silently.
export function selectModifiers(
  set: ModifierSet,
  key: ModifierQueryKey,
  targetId?: string,
): Modifier[] {
  return set.filter((modifier) => {
    if (modifier.key !== key) return false;
    if (modifier.targetId === undefined) return true;
    return modifier.targetId === targetId;
  });
}

// §2.7: max(0, round((base + ΣFLAT) × (1 + ΣPERCENT))). FLAT applies before
// PERCENT; PERCENT modifiers sum additively, not multiplicatively (no PoE
// "more" tier). Math.round is applied once at the end, never per-step.
export function applyModifiers(
  base: number,
  set: ModifierSet,
  key: ModifierQueryKey,
  targetId?: string,
): number {
  const matching = selectModifiers(set, key, targetId);
  let flatSum = 0;
  let percentSum = 0;
  for (const modifier of matching) {
    if (modifier.op === "FLAT") {
      flatSum += modifier.value;
    } else {
      percentSum += modifier.value;
    }
  }
  const result = Math.round((base + flatSum) * (1 + percentSum));
  return Math.max(0, result);
}
