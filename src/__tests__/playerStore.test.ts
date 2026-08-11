import { beforeEach, describe, expect, it } from "vitest";
import { initialPlayerState, parseAndValidateSave, usePlayerStore } from "../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("initial state", () => {
  it("matches the documented PlayerState shape", () => {
    const state = usePlayerStore.getState();
    expect(state.currencies).toEqual({ gold: 0, silver: 0, bronze: 0 });
    expect(state.worldClock).toEqual({ shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" });
    expect(state.currentLocation).toEqual({ settlementId: "", districtId: "" });
    expect(state.reputation).toEqual({ factions: {}, actors: {} });
    expect(state.inventory).toEqual([]);
    expect(state.unlockedNodes).toEqual({});
    expect(state.unlockedClues).toEqual([]);
    expect(state.activeEndeavors).toEqual({});
    expect(state.activeMinigame).toBeNull();
    expect(state.eventLog).toEqual([]);
  });
});

describe("dispatchCommand", () => {
  it("normalizes currency at the 400 bronze = 1 gold boundary", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: 400 },
    });
    expect(usePlayerStore.getState().currencies).toEqual({ gold: 1, silver: 0, bronze: 0 });
  });

  it("rolls NIGHT over into the next day's MORNING", () => {
    usePlayerStore.setState({ worldClock: { shift: "NIGHT", day: 1, season: "SPRING", weather: "CLEAR" } });
    usePlayerStore.getState().dispatchCommand({ type: "COMMAND_ADVANCE_SHIFT", payload: {} });
    const { shift, day } = usePlayerStore.getState().worldClock;
    expect(shift).toBe("MORNING");
    expect(day).toBe(2);
  });

  it("unlocks a node by ID without disturbing the rest of the state", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_UNLOCK_NODE",
      payload: { nodeId: "district_lantern_ward" },
    });
    const state = usePlayerStore.getState();
    expect(state.unlockedNodes).toEqual({ district_lantern_ward: true });
    expect(state.currencies).toEqual({ gold: 0, silver: 0, bronze: 0 });
  });

  it("appends a matching entry to the in-memory event log", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_UNLOCK_NODE",
      payload: { nodeId: "district_lantern_ward" },
    });
    const log = usePlayerStore.getState().eventLog;
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe("COMMAND_UNLOCK_NODE");
    expect(log[0].payload).toEqual({ nodeId: "district_lantern_ward" });
  });

  it("throws and leaves state untouched if COMMAND_NEXT_DAY is dispatched directly", () => {
    expect(() =>
      usePlayerStore.getState().dispatchCommand({ type: "COMMAND_NEXT_DAY", payload: {} })
    ).toThrow();
    expect(usePlayerStore.getState().worldClock).toEqual({ shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" });
  });
});

describe("parseAndValidateSave", () => {
  const populatedSave = {
    ...initialPlayerState,
    currencies: { gold: 2, silver: 5, bronze: 10 },
    worldClock: { shift: "EVENING", day: 3, season: "AUTUMN", weather: "CLEAR" },
    currentLocation: {
      settlementId: "settlement_valdeombra_city",
      districtId: "district_lantern_ward",
      poiId: "poi_crooked_hour_tavern",
    },
    reputation: { factions: { faction_city_watch: 20 }, actors: {} },
    unlockedNodes: { district_lantern_ward: true },
    unlockedClues: ["clue_torn_ledger_page"],
  };

  it("round-trips a valid save", () => {
    const result = parseAndValidateSave(JSON.stringify(populatedSave));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(populatedSave);
    }
  });

  it("rejects malformed JSON without throwing", () => {
    const result = parseAndValidateSave("{ not valid json");
    expect(result.success).toBe(false);
  });

  it("rejects a save missing a required field, without throwing", () => {
    const invalid: Record<string, unknown> = { ...populatedSave };
    delete invalid.worldClock;
    const result = parseAndValidateSave(JSON.stringify(invalid));
    expect(result.success).toBe(false);
  });

  it("rejects a save with an invalid Shift enum value, without throwing", () => {
    const invalid = { ...populatedSave, worldClock: { ...populatedSave.worldClock, shift: "NOON" } };
    const result = parseAndValidateSave(JSON.stringify(invalid));
    expect(result.success).toBe(false);
  });

  it("rejects a save with a wrong-typed field, without throwing", () => {
    const invalid = { ...populatedSave, worldClock: { ...populatedSave.worldClock, day: "three" } };
    const result = parseAndValidateSave(JSON.stringify(invalid));
    expect(result.success).toBe(false);
  });

  it("does not mutate current store state on rejection", () => {
    const before = usePlayerStore.getState();
    parseAndValidateSave("{ not valid json");
    parseAndValidateSave(JSON.stringify({ ...populatedSave, worldClock: undefined }));
    expect(usePlayerStore.getState()).toBe(before);
  });
});
