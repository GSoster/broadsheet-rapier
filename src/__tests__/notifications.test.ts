import { describe, expect, it } from "vitest";
import { diffForNotifications, formatCurrencyDelta } from "../engine/store/notifications";
import { initialPlayerState } from "../engine/store/playerStore";
import type { PlayerState } from "../engine/types";

function makeState(overrides: Partial<PlayerState> = {}): PlayerState {
  return { ...initialPlayerState, ...overrides };
}

describe("diffForNotifications", () => {
  it("returns nothing when currency, inventory, and reputation are all unchanged", () => {
    const state = makeState();
    expect(diffForNotifications(state, state)).toEqual([]);
  });

  it("detects a currency gain", () => {
    const before = makeState({ currencies: { gold: 0, silver: 0, bronze: 0 } });
    const after = makeState({ currencies: { gold: 0, silver: 1, bronze: 0 } });
    expect(diffForNotifications(before, after)).toEqual([{ tone: "gain", kind: "CURRENCY", deltaBronze: 20 }]);
  });

  it("detects a currency loss", () => {
    const before = makeState({ currencies: { gold: 0, silver: 1, bronze: 0 } });
    const after = makeState({ currencies: { gold: 0, silver: 0, bronze: 0 } });
    expect(diffForNotifications(before, after)).toEqual([{ tone: "loss", kind: "CURRENCY", deltaBronze: -20 }]);
  });

  it("detects a brand-new item being added", () => {
    const before = makeState({ inventory: [] });
    const after = makeState({ inventory: [{ itemId: "item_rapier", quantity: 1 }] });
    expect(diffForNotifications(before, after)).toEqual([
      { tone: "gain", kind: "ITEM", itemId: "item_rapier", quantity: 1 },
    ]);
  });

  it("detects an existing item's quantity decreasing, without removing the entry entirely", () => {
    const before = makeState({ inventory: [{ itemId: "item_rapier", quantity: 2 }] });
    const after = makeState({ inventory: [{ itemId: "item_rapier", quantity: 1 }] });
    expect(diffForNotifications(before, after)).toEqual([
      { tone: "loss", kind: "ITEM", itemId: "item_rapier", quantity: -1 },
    ]);
  });

  it("detects multiple simultaneous item deltas", () => {
    const before = makeState({
      inventory: [
        { itemId: "item_rapier", quantity: 1 },
        { itemId: "item_vantry_rapier", quantity: 0 },
      ],
    });
    const after = makeState({
      inventory: [
        { itemId: "item_rapier", quantity: 0 },
        { itemId: "item_vantry_rapier", quantity: 1 },
      ],
    });
    const events = diffForNotifications(before, after);
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        { tone: "loss", kind: "ITEM", itemId: "item_rapier", quantity: -1 },
        { tone: "gain", kind: "ITEM", itemId: "item_vantry_rapier", quantity: 1 },
      ])
    );
  });

  it("detects an actor reputation gain and a faction reputation loss independently", () => {
    const before = makeState({ reputation: { actors: {}, factions: { faction_wagering_ring: 0 } } });
    const after = makeState({
      reputation: { actors: { actor_mara_venn: 5 }, factions: { faction_wagering_ring: -10 } },
    });
    const events = diffForNotifications(before, after);
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        { tone: "gain", kind: "REPUTATION", targetType: "actor", targetId: "actor_mara_venn", amount: 5 },
        { tone: "loss", kind: "REPUTATION", targetType: "faction", targetId: "faction_wagering_ring", amount: -10 },
      ])
    );
  });

  it("a combined multi-domain diff (currency + item + reputation) produces one event per domain — the real shape a duel win/loss produces", () => {
    const before = makeState({
      currencies: { gold: 0, silver: 0, bronze: 0 },
      inventory: [],
      reputation: { actors: {}, factions: {} },
    });
    const after = makeState({
      currencies: { gold: 0, silver: 24, bronze: 0 },
      inventory: [{ itemId: "item_vantry_rapier", quantity: 1 }],
      reputation: { actors: {}, factions: { faction_wagering_ring: -10 } },
    });
    const events = diffForNotifications(before, after);
    expect(events).toHaveLength(3);
  });
});

describe("formatCurrencyDelta", () => {
  it("formats a positive delta with a leading +", () => {
    expect(formatCurrencyDelta(60)).toBe("+3 Silver");
  });

  it("formats a negative delta with a leading -, using the absolute magnitude", () => {
    expect(formatCurrencyDelta(-60)).toBe("-3 Silver");
  });

  it("breaks a compound delta down across denominations", () => {
    expect(formatCurrencyDelta(424)).toBe("+1 Gold, 1 Silver, 4 Bronze");
  });

  it("omits zero denominations from the breakdown", () => {
    expect(formatCurrencyDelta(1)).toBe("+1 Bronze");
  });
});
