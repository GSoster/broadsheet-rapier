export type RandomSource = () => number;

export interface DiceRollResult {
  dice: [number, number];
  sum: number;
  isVictory: boolean;
}

export interface DiceWagerResolution extends DiceRollResult {
  wager: number;
  payout: number;
  netChange: number;
}

export const MIN_WAGER = 5;
export const MAX_WAGER = 100;
export const WAGER_STEP = 5;

function rollDie(random: RandomSource): number {
  return Math.floor(random() * 6) + 1;
}

export function rollDice(random: RandomSource = Math.random): DiceRollResult {
  const dice: [number, number] = [rollDie(random), rollDie(random)];
  const sum = dice[0] + dice[1];
  return { dice, sum, isVictory: sum % 2 === 0 };
}

export function resolveDiceWager(wager: number, random: RandomSource = Math.random): DiceWagerResolution {
  const roll = rollDice(random);
  const payout = roll.isVictory ? wager * 2 : 0;
  return { ...roll, wager, payout, netChange: payout - wager };
}

export function maxAffordableWager(totalBronze: number): number {
  return Math.min(MAX_WAGER, Math.max(0, totalBronze));
}

export function clampWager(desired: number, maxAffordable: number): number {
  const upperBound = maxAffordableWager(maxAffordable);
  // If the player can't even afford MIN_WAGER, fall back to whatever they
  // have (the caller is responsible for disabling the throw in that case).
  const lowerBound = Math.min(MIN_WAGER, upperBound);
  return Math.min(upperBound, Math.max(lowerBound, desired));
}
