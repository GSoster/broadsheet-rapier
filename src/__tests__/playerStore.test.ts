import { beforeEach, describe, expect, it } from "vitest";
import { initialPlayerState, parseAndValidateSave, usePlayerStore } from "../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [], notifications: [] });
});

describe("initial state", () => {
  it("matches the documented PlayerState shape", () => {
    const state = usePlayerStore.getState();
    expect(state.currencies).toEqual({ gold: 0, silver: 2, bronze: 10 });
    expect(state.worldClock).toEqual({ shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" });
    expect(state.currentLocation).toEqual({ settlementId: "", districtId: "" });
    expect(state.reputation).toEqual({ factions: {}, actors: {} });
    expect(state.inventory).toEqual([{ itemId: "item_rapier", quantity: 1 }]);
    expect(state.unlockedNodes).toEqual({});
    expect(state.unlockedClues).toEqual([]);
    expect(state.activeEndeavors).toEqual({});
    expect(state.activeMinigame).toBeNull();
    expect(state.activeDialogue).toBeNull();
    expect(state.eventLog).toEqual([]);
  });
});

describe("dispatchCommand", () => {
  it("normalizes currency at the 400 bronze = 1 gold boundary", () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 0 } });
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
    expect(state.currencies).toEqual({ gold: 0, silver: 2, bronze: 10 });
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

describe("dispatchCommand — notifications", () => {
  it("pushes a CURRENCY notification for a direct COMMAND_ADJUST_CURRENCY dispatch", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "silver", amount: 3 },
    });
    const notifications = usePlayerStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ kind: "CURRENCY", tone: "gain", deltaBronze: 60 });
  });

  it("pushes no notification when a command doesn't touch currency/item/reputation", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_UNLOCK_NODE",
      payload: { nodeId: "district_lantern_ward" },
    });
    expect(usePlayerStore.getState().notifications).toEqual([]);
  });

  // The important case: currency/item changes buried inside a
  // COMMAND_SELECT_DIALOGUE_CHOICE's nested `commands` never go through
  // dispatchCommand individually (commands.ts applies them via a direct
  // recursive applyCommand call, not a second dispatchCommand call) — only
  // the final resulting PlayerState reflects them. A notification design
  // that switched on the dispatched command's own `type` would miss this
  // entirely; the before/after diff must not.
  it("pushes notifications for currency/item changes nested inside a dialogue choice's commands", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_SELECT_DIALOGUE_CHOICE",
      payload: {
        dialogueId: "dialogue_placeholder",
        nextNodeId: null,
        commands: [
          { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "silver", amount: 24 } },
          { type: "COMMAND_ADD_ITEM", payload: { itemId: "item_vantry_rapier", quantity: 1 } },
        ],
      },
    });
    const notifications = usePlayerStore.getState().notifications;
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "CURRENCY", tone: "gain", deltaBronze: 480 }),
        expect.objectContaining({ kind: "ITEM", tone: "gain", itemId: "item_vantry_rapier", quantity: 1 }),
      ])
    );
  });

  it("pushes a REPUTATION notification for COMMAND_ADJUST_REPUTATION", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_ADJUST_REPUTATION",
      payload: { targetType: "actor", targetId: "actor_mara_venn", amount: 5 },
    });
    const notifications = usePlayerStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: "REPUTATION",
      tone: "gain",
      targetType: "actor",
      targetId: "actor_mara_venn",
      amount: 5,
    });
  });
});

describe("dismissNotification / pushNotification", () => {
  it("removes only the matching notification by id", () => {
    usePlayerStore.getState().pushNotification({ tone: "info", kind: "ENDEAVOR_COMPLETE", endeavorId: "endeavor_a" });
    usePlayerStore.getState().pushNotification({ tone: "info", kind: "ENDEAVOR_COMPLETE", endeavorId: "endeavor_b" });
    const [first, second] = usePlayerStore.getState().notifications;
    usePlayerStore.getState().dismissNotification(first.id);
    const remaining = usePlayerStore.getState().notifications;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});

describe("resetProgress / importSave clear notifications", () => {
  it("resetProgress clears notifications alongside eventLog", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "silver", amount: 3 },
    });
    expect(usePlayerStore.getState().notifications).toHaveLength(1);
    usePlayerStore.getState().resetProgress();
    expect(usePlayerStore.getState().notifications).toEqual([]);
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
