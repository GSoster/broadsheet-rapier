import { describe, expect, it } from "vitest";
import { applyCommand } from "../engine/store/commands";
import { initialPlayerState } from "../engine/store/playerStore";
import type { PlayerState } from "../engine/types";

function makeState(overrides: Partial<PlayerState> = {}): PlayerState {
  return { ...initialPlayerState, ...overrides };
}

describe("COMMAND_ADVANCE_SHIFT", () => {
  it("advances MORNING -> AFTERNOON -> EVENING -> NIGHT without changing the day", () => {
    let state = makeState({ worldClock: { shift: "MORNING", day: 1, season: "SPRING" } });

    state = applyCommand(state, { type: "COMMAND_ADVANCE_SHIFT", payload: {} });
    expect(state.worldClock.shift).toBe("AFTERNOON");
    expect(state.worldClock.day).toBe(1);

    state = applyCommand(state, { type: "COMMAND_ADVANCE_SHIFT", payload: {} });
    expect(state.worldClock.shift).toBe("EVENING");
    expect(state.worldClock.day).toBe(1);

    state = applyCommand(state, { type: "COMMAND_ADVANCE_SHIFT", payload: {} });
    expect(state.worldClock.shift).toBe("NIGHT");
    expect(state.worldClock.day).toBe(1);
  });

  it("rolls NIGHT over into the next day's MORNING", () => {
    const state = makeState({ worldClock: { shift: "NIGHT", day: 1, season: "SPRING" } });
    const next = applyCommand(state, { type: "COMMAND_ADVANCE_SHIFT", payload: {} });
    expect(next.worldClock.shift).toBe("MORNING");
    expect(next.worldClock.day).toBe(2);
  });

  it("rejects COMMAND_NEXT_DAY dispatched directly", () => {
    const state = makeState();
    expect(() => applyCommand(state, { type: "COMMAND_NEXT_DAY", payload: {} })).toThrow();
  });
});

describe("COMMAND_ADJUST_CURRENCY", () => {
  it("carries bronze into silver at the 20:1 boundary", () => {
    const state = makeState({ currencies: { gold: 0, silver: 0, bronze: 0 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: 25 },
    });
    expect(next.currencies).toEqual({ gold: 0, silver: 1, bronze: 5 });
  });

  it("carries through both bronze->silver and silver->gold in a single adjustment", () => {
    const state = makeState({ currencies: { gold: 0, silver: 0, bronze: 0 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: 500 },
    });
    // 500 bronze = 25 silver = 1 gold + 5 silver
    expect(next.currencies).toEqual({ gold: 1, silver: 5, bronze: 0 });
  });

  it("normalizes at exactly the 400 bronze = 1 gold boundary", () => {
    const state = makeState({ currencies: { gold: 0, silver: 0, bronze: 0 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: 400 },
    });
    expect(next.currencies).toEqual({ gold: 1, silver: 0, bronze: 0 });
  });
});

describe("COMMAND_ADJUST_REPUTATION", () => {
  it("clamps at +100", () => {
    const state = makeState({ reputation: { factions: { faction_city_watch: 90 }, actors: {} } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_REPUTATION",
      payload: { targetType: "faction", targetId: "faction_city_watch", amount: 50 },
    });
    expect(next.reputation.factions.faction_city_watch).toBe(100);
  });

  it("clamps at -100", () => {
    const state = makeState({ reputation: { factions: {}, actors: { actor_mara_venn: -90 } } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_REPUTATION",
      payload: { targetType: "actor", targetId: "actor_mara_venn", amount: -50 },
    });
    expect(next.reputation.actors.actor_mara_venn).toBe(-100);
  });
});

describe("COMMAND_UNLOCK_NODE", () => {
  it("unlocks only the targeted node, leaving others untouched", () => {
    const state = makeState({
      unlockedNodes: { poi_crooked_hour_tavern: true, district_lantern_ward: false },
    });
    const next = applyCommand(state, {
      type: "COMMAND_UNLOCK_NODE",
      payload: { nodeId: "district_lantern_ward" },
    });
    expect(next.unlockedNodes.district_lantern_ward).toBe(true);
    expect(next.unlockedNodes.poi_crooked_hour_tavern).toBe(true);
  });
});

describe("movement shift costs", () => {
  it("COMMAND_MOVE_TO_DISTRICT costs 0 shifts", () => {
    const state = makeState({
      worldClock: { shift: "MORNING", day: 1, season: "SPRING" },
      currentLocation: { settlementId: "settlement_valdeombra_city", districtId: "district_lantern_ward" },
    });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_DISTRICT",
      payload: { districtId: "district_other" },
    });
    expect(next.currentLocation.districtId).toBe("district_other");
    expect(next.worldClock.shift).toBe("MORNING");
    expect(next.worldClock.day).toBe(1);
  });

  it("COMMAND_MOVE_TO_SETTLEMENT costs 1 shift", () => {
    const state = makeState({
      worldClock: { shift: "MORNING", day: 1, season: "SPRING" },
      currentLocation: { settlementId: "settlement_valdeombra_city", districtId: "district_lantern_ward" },
    });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_SETTLEMENT",
      payload: { settlementId: "settlement_other", districtId: "district_other" },
    });
    expect(next.currentLocation).toEqual({
      settlementId: "settlement_other",
      districtId: "district_other",
    });
    expect(next.worldClock.shift).toBe("AFTERNOON");
    expect(next.worldClock.day).toBe(1);
  });

  it("COMMAND_MOVE_TO_SETTLEMENT rolls the day over when departing on NIGHT", () => {
    const state = makeState({
      worldClock: { shift: "NIGHT", day: 1, season: "SPRING" },
      currentLocation: { settlementId: "settlement_valdeombra_city", districtId: "district_lantern_ward" },
    });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_SETTLEMENT",
      payload: { settlementId: "settlement_other", districtId: "district_other" },
    });
    expect(next.worldClock.shift).toBe("MORNING");
    expect(next.worldClock.day).toBe(2);
  });
});
