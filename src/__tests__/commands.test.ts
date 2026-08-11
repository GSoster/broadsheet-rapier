import { describe, expect, it } from "vitest";
import { applyCommand } from "../engine/store/commands";
import { initialPlayerState } from "../engine/store/playerStore";
import type { PlayerState } from "../engine/types";

function makeState(overrides: Partial<PlayerState> = {}): PlayerState {
  return { ...initialPlayerState, ...overrides };
}

describe("COMMAND_ADVANCE_SHIFT", () => {
  it("advances MORNING -> AFTERNOON -> EVENING -> NIGHT without changing the day", () => {
    let state = makeState({ worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" } });

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
    const state = makeState({ worldClock: { shift: "NIGHT", day: 1, season: "SPRING", weather: "CLEAR" } });
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

  it("adjusts normally when the result stays within [-100, 100]", () => {
    const state = makeState({ reputation: { factions: { faction_city_watch: 10 }, actors: {} } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_REPUTATION",
      payload: { targetType: "faction", targetId: "faction_city_watch", amount: 15 },
    });
    expect(next.reputation.factions.faction_city_watch).toBe(25);
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
      worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" },
      currentLocation: { settlementId: "settlement_valdeombra_city", districtId: "district_lantern_ward" },
    });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_DISTRICT",
      payload: { districtId: "district_other" },
    });
    expect(next.currentLocation.districtId).toBe("district_other");
    expect(next.currentLocation.settlementId).toBe("settlement_valdeombra_city");
    expect(next.worldClock.shift).toBe("MORNING");
    expect(next.worldClock.day).toBe(1);
  });

  it("COMMAND_MOVE_TO_DISTRICT clears poiId when moving out of a POI", () => {
    const state = makeState({
      currentLocation: {
        settlementId: "settlement_valdeombra_city",
        districtId: "district_lantern_ward",
        poiId: "poi_crooked_hour_tavern",
      },
    });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_DISTRICT",
      payload: { districtId: "district_lantern_ward" },
    });
    expect(next.currentLocation.poiId).toBeUndefined();
    expect("poiId" in next.currentLocation).toBe(false);
  });

  it("COMMAND_MOVE_TO_SETTLEMENT costs 1 shift", () => {
    const state = makeState({
      worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" },
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
      worldClock: { shift: "NIGHT", day: 1, season: "SPRING", weather: "CLEAR" },
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

describe("COMMAND_MOVE_TO_POI", () => {
  it("sets the poi and advances shifts by the supplied costShifts, leaving settlement/district untouched", () => {
    const state = makeState({
      worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" },
      currentLocation: { settlementId: "settlement_valdeombra_city", districtId: "district_lantern_ward" },
    });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_POI",
      payload: { poiId: "poi_crooked_hour_tavern", costShifts: 1 },
    });
    expect(next.currentLocation).toEqual({
      settlementId: "settlement_valdeombra_city",
      districtId: "district_lantern_ward",
      poiId: "poi_crooked_hour_tavern",
    });
    expect(next.worldClock.shift).toBe("AFTERNOON");
  });

  it("does not advance shifts when costShifts is omitted", () => {
    const state = makeState({ worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" } });
    const next = applyCommand(state, {
      type: "COMMAND_MOVE_TO_POI",
      payload: { poiId: "poi_crooked_hour_tavern" },
    });
    expect(next.worldClock.shift).toBe("MORNING");
  });
});

describe("COMMAND_ADD_ITEM / COMMAND_REMOVE_ITEM", () => {
  it("adds a new item and increases quantity on repeat adds", () => {
    let state = makeState();
    state = applyCommand(state, {
      type: "COMMAND_ADD_ITEM",
      payload: { itemId: "item_lockpick", quantity: 1 },
    });
    expect(state.inventory).toEqual([{ itemId: "item_lockpick", quantity: 1 }]);

    state = applyCommand(state, {
      type: "COMMAND_ADD_ITEM",
      payload: { itemId: "item_lockpick", quantity: 2 },
    });
    expect(state.inventory).toEqual([{ itemId: "item_lockpick", quantity: 3 }]);
  });

  it("removes quantity and drops the item entry once it hits zero, leaving other items untouched", () => {
    const state = makeState({
      inventory: [
        { itemId: "item_lockpick", quantity: 3 },
        { itemId: "item_broadsheet", quantity: 1 },
      ],
    });
    const next = applyCommand(state, {
      type: "COMMAND_REMOVE_ITEM",
      payload: { itemId: "item_lockpick", quantity: 3 },
    });
    expect(next.inventory).toEqual([{ itemId: "item_broadsheet", quantity: 1 }]);
  });
});

describe("COMMAND_UNLOCK_CLUE", () => {
  it("adds a clue without duplicating an already-unlocked one", () => {
    const state = makeState({ unlockedClues: ["clue_torn_ledger_page"] });
    const next = applyCommand(state, {
      type: "COMMAND_UNLOCK_CLUE",
      payload: { clueId: "clue_torn_ledger_page" },
    });
    expect(next.unlockedClues).toEqual(["clue_torn_ledger_page"]);

    const withNewClue = applyCommand(state, {
      type: "COMMAND_UNLOCK_CLUE",
      payload: { clueId: "clue_wax_seal" },
    });
    expect(withNewClue.unlockedClues).toEqual(["clue_torn_ledger_page", "clue_wax_seal"]);
  });
});

describe("COMMAND_START_ENDEAVOR / COMMAND_ADVANCE_ENDEAVOR_PHASE", () => {
  it("starts an endeavor at the supplied initial phase", () => {
    const state = makeState();
    const next = applyCommand(state, {
      type: "COMMAND_START_ENDEAVOR",
      payload: { endeavorId: "endeavor_the_missing_broadsheet", initialPhaseId: "phase_ask_around" },
    });
    expect(next.activeEndeavors.endeavor_the_missing_broadsheet).toEqual({
      currentPhaseId: "phase_ask_around",
      logHistory: [],
    });
  });

  it("advances the phase, logs the prior phase, and unlocks any completed-phase nodes", () => {
    const state = makeState({
      activeEndeavors: {
        endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
      },
    });
    const next = applyCommand(state, {
      type: "COMMAND_ADVANCE_ENDEAVOR_PHASE",
      payload: {
        endeavorId: "endeavor_the_missing_broadsheet",
        nextPhaseId: "phase_confront_the_buyer",
        unlocksNodesOnComplete: ["poi_crooked_hour_tavern"],
      },
    });
    expect(next.activeEndeavors.endeavor_the_missing_broadsheet).toEqual({
      currentPhaseId: "phase_confront_the_buyer",
      logHistory: ["phase_ask_around"],
    });
    expect(next.unlockedNodes.poi_crooked_hour_tavern).toBe(true);
  });
});
