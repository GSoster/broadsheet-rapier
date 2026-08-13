import { describe, expect, it } from "vitest";
import { isNodeUnlocked } from "../engine/utils/isNodeUnlocked";

describe("isNodeUnlocked", () => {
  it("is true when the static isUnlocked field is true, regardless of unlockedNodes", () => {
    expect(isNodeUnlocked({ isUnlocked: true }, "poi_x", {})).toBe(true);
  });

  it("is true when isUnlocked is true even if unlockedNodes explicitly has it false/absent", () => {
    expect(isNodeUnlocked({ isUnlocked: true }, "poi_x", { poi_x: false })).toBe(true);
  });

  it("is false when isUnlocked is false and unlockedNodes has no entry for this id", () => {
    expect(isNodeUnlocked({ isUnlocked: false }, "poi_x", {})).toBe(false);
  });

  it("is false when isUnlocked is false and unlockedNodes[id] is false", () => {
    expect(isNodeUnlocked({ isUnlocked: false }, "poi_x", { poi_x: false })).toBe(false);
  });

  it("is true when isUnlocked is false but unlockedNodes[id] is true (the player-earned-unlock case)", () => {
    expect(isNodeUnlocked({ isUnlocked: false }, "poi_x", { poi_x: true })).toBe(true);
  });

  it("only checks the matching id — an unrelated node's unlockedNodes entry doesn't leak", () => {
    expect(isNodeUnlocked({ isUnlocked: false }, "poi_x", { poi_y: true })).toBe(false);
  });
});
