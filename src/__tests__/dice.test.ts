import { describe, expect, it } from "vitest";
import {
  clampWager,
  MAX_WAGER,
  MIN_WAGER,
  resolveDiceWager,
  rollDice,
  WAGER_STEP,
} from "../engine/minigames/dice";

function stubRandomForDice(faceA: number, faceB: number) {
  const sequence = [(faceA - 1) / 6, (faceB - 1) / 6];
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

describe("rollDice win/lose boundary", () => {
  // Every even sum reachable on 2d6 (2,4,6,8,10,12) — explicitly asserted,
  // not just parity, so this fails loudly if a specific sum is ever wrong.
  const winningFaces: Array<[number, number, number]> = [
    [1, 1, 2],
    [1, 3, 4],
    [2, 4, 6],
    [3, 5, 8],
    [4, 6, 10],
    [6, 6, 12],
  ];
  // Every odd sum reachable on 2d6 (3,5,7,9,11).
  const losingFaces: Array<[number, number, number]> = [
    [1, 2, 3],
    [2, 3, 5],
    [3, 4, 7],
    [4, 5, 9],
    [5, 6, 11],
  ];

  it.each(winningFaces)("dice %i + %i sums to %i (even) and is a win", (a, b, expectedSum) => {
    const result = rollDice(stubRandomForDice(a, b));
    expect(result.sum).toBe(expectedSum);
    expect(result.sum % 2).toBe(0);
    expect(result.isVictory).toBe(true);
  });

  it.each(losingFaces)("dice %i + %i sums to %i (odd) and is a loss", (a, b, expectedSum) => {
    const result = rollDice(stubRandomForDice(a, b));
    expect(result.sum).toBe(expectedSum);
    expect(result.sum % 2).toBe(1);
    expect(result.isVictory).toBe(false);
  });

  it("covers all six possible even sums (2,4,6,8,10,12) as wins", () => {
    const sums = winningFaces.map(([a, b]) => rollDice(stubRandomForDice(a, b)).sum);
    expect(sums.sort((x, y) => x - y)).toEqual([2, 4, 6, 8, 10, 12]);
  });
});

describe("resolveDiceWager", () => {
  it("pays out 2x the wager on an even (winning) roll", () => {
    const result = resolveDiceWager(20, stubRandomForDice(2, 2)); // sum 4
    expect(result.isVictory).toBe(true);
    expect(result.payout).toBe(40);
    expect(result.netChange).toBe(20);
  });

  it("deducts the full wager on an odd (losing) roll", () => {
    const result = resolveDiceWager(20, stubRandomForDice(1, 2)); // sum 3
    expect(result.isVictory).toBe(false);
    expect(result.payout).toBe(0);
    expect(result.netChange).toBe(-20);
  });
});

describe("clampWager", () => {
  it("respects MIN_WAGER/MAX_WAGER constants (5, 100)", () => {
    expect(MIN_WAGER).toBe(5);
    expect(MAX_WAGER).toBe(100);
    expect(WAGER_STEP).toBe(5);
  });

  it("clamps below MIN_WAGER up to MIN_WAGER when affordable", () => {
    expect(clampWager(3, 1000)).toBe(5);
  });

  it("clamps above MAX_WAGER down to MAX_WAGER", () => {
    expect(clampWager(500, 1000)).toBe(100);
  });

  it("leaves an in-range wager untouched", () => {
    expect(clampWager(20, 1000)).toBe(20);
  });

  it("caps at the player's total when it's lower than MAX_WAGER", () => {
    expect(clampWager(50, 30)).toBe(30);
  });

  it("falls back to the player's total even when it's below MIN_WAGER", () => {
    expect(clampWager(20, 3)).toBe(3);
  });
});
