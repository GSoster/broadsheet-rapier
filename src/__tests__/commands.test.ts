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

  it("borrows down from silver when a bronze loss exceeds the bronze on hand", () => {
    const state = makeState({ currencies: { gold: 0, silver: 1, bronze: 0 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: -5 },
    });
    // 20 bronze-equivalent - 5 = 15 -> breaks the silver down into bronze
    expect(next.currencies).toEqual({ gold: 0, silver: 0, bronze: 15 });
  });

  it("borrows down from gold into silver on a moderate loss", () => {
    const state = makeState({ currencies: { gold: 1, silver: 0, bronze: 0 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: -10 },
    });
    // 400 bronze-equivalent - 10 = 390 -> 0 gold, 19 silver, 10 bronze
    expect(next.currencies).toEqual({ gold: 0, silver: 19, bronze: 10 });
  });

  it("borrows down from gold all the way through silver into bronze on a large loss", () => {
    const state = makeState({ currencies: { gold: 1, silver: 0, bronze: 0 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: -395 },
    });
    // 400 bronze-equivalent - 395 = 5 -> 0 gold, 0 silver (fully broken down), 5 bronze
    expect(next.currencies).toEqual({ gold: 0, silver: 0, bronze: 5 });
  });

  it("clamps at zero rather than going negative when a loss exceeds total holdings", () => {
    const state = makeState({ currencies: { gold: 0, silver: 0, bronze: 10 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: -50 },
    });
    expect(next.currencies).toEqual({ gold: 0, silver: 0, bronze: 0 });
  });

  it("clamps at zero even when the loss is denominated in gold/silver directly", () => {
    const state = makeState({ currencies: { gold: 0, silver: 2, bronze: 5 } });
    const next = applyCommand(state, {
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "silver", amount: -10 },
    });
    expect(next.currencies).toEqual({ gold: 0, silver: 0, bronze: 0 });
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
    let state = makeState({ inventory: [] });
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

describe("COMMAND_ENTER_DIALOGUE_NODE", () => {
  it("sets currentNodeId and increments the visit count on first entry", () => {
    const state = makeState();
    const next = applyCommand(state, {
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: "dialogue_mara_venn", nodeId: "node_greeting" },
    });
    expect(next.dialogueProgress.dialogue_mara_venn).toEqual({
      currentNodeId: "node_greeting",
      visitCounts: { node_greeting: 1 },
    });
  });

  it("increments the visit count again on a repeat visit to the same node", () => {
    const state = makeState({
      dialogueProgress: {
        dialogue_mara_venn: { currentNodeId: "node_greeting", visitCounts: { node_greeting: 1 } },
      },
    });
    const next = applyCommand(state, {
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: "dialogue_mara_venn", nodeId: "node_greeting" },
    });
    expect(next.dialogueProgress.dialogue_mara_venn.visitCounts.node_greeting).toBe(2);
  });

  it("leaves other dialogues' progress untouched", () => {
    const state = makeState({
      dialogueProgress: {
        dialogue_other: { currentNodeId: "node_x", visitCounts: { node_x: 3 } },
      },
    });
    const next = applyCommand(state, {
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: "dialogue_mara_venn", nodeId: "node_greeting" },
    });
    expect(next.dialogueProgress.dialogue_other).toEqual({
      currentNodeId: "node_x",
      visitCounts: { node_x: 3 },
    });
  });
});

describe("COMMAND_SELECT_DIALOGUE_CHOICE", () => {
  it("advances currentNodeId and runs the choice's commands", () => {
    const state = makeState({
      dialogueProgress: {
        dialogue_mara_venn: { currentNodeId: "node_greeting", visitCounts: { node_greeting: 1 } },
      },
    });
    const next = applyCommand(state, {
      type: "COMMAND_SELECT_DIALOGUE_CHOICE",
      payload: {
        dialogueId: "dialogue_mara_venn",
        nextNodeId: "node_engaged",
        commands: [
          { type: "COMMAND_ADJUST_REPUTATION", payload: { targetType: "actor", targetId: "actor_mara_venn", amount: 5 } },
        ],
      },
    });
    expect(next.dialogueProgress.dialogue_mara_venn.currentNodeId).toBe("node_engaged");
    expect(next.dialogueProgress.dialogue_mara_venn.visitCounts.node_engaged).toBe(1);
    expect(next.reputation.actors.actor_mara_venn).toBe(5);
  });

  it("with nextNodeId: null, skips the dialogueProgress update but still runs commands", () => {
    const state = makeState({
      dialogueProgress: {
        dialogue_mara_venn: { currentNodeId: "node_lead_revealed", visitCounts: { node_lead_revealed: 1 } },
      },
      activeEndeavors: {
        endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
      },
    });
    const next = applyCommand(state, {
      type: "COMMAND_SELECT_DIALOGUE_CHOICE",
      payload: {
        dialogueId: "dialogue_mara_venn",
        nextNodeId: null,
        commands: [
          {
            type: "COMMAND_ADVANCE_ENDEAVOR_PHASE",
            payload: {
              endeavorId: "endeavor_the_missing_broadsheet",
              nextPhaseId: "phase_confront_the_buyer",
              unlocksNodesOnComplete: [],
            },
          },
        ],
      },
    });
    expect(next.dialogueProgress.dialogue_mara_venn).toEqual({
      currentNodeId: "node_lead_revealed",
      visitCounts: { node_lead_revealed: 1 },
    });
    expect(next.activeEndeavors.endeavor_the_missing_broadsheet.currentPhaseId).toBe("phase_confront_the_buyer");
  });

  it("tolerates a missing commands field (statically-imported content bypasses the schema's .default([]))", () => {
    const state = makeState();
    const next = applyCommand(state, {
      type: "COMMAND_SELECT_DIALOGUE_CHOICE",
      payload: { dialogueId: "dialogue_mara_venn", nextNodeId: "node_greeting" },
    });
    expect(next.dialogueProgress.dialogue_mara_venn.currentNodeId).toBe("node_greeting");
  });

  it("an empty commands array is a no-op beyond the node transition", () => {
    const state = makeState();
    const next = applyCommand(state, {
      type: "COMMAND_SELECT_DIALOGUE_CHOICE",
      payload: { dialogueId: "dialogue_mara_venn", nextNodeId: "node_greeting", commands: [] },
    });
    expect(next.dialogueProgress.dialogue_mara_venn.currentNodeId).toBe("node_greeting");
    expect(next.currencies).toEqual(state.currencies);
    expect(next.reputation).toEqual(state.reputation);
  });
});

describe("COMMAND_OPEN_DIALOGUE", () => {
  it("sets activeDialogue to the given dialogueId", () => {
    const state = makeState();
    const next = applyCommand(state, {
      type: "COMMAND_OPEN_DIALOGUE",
      payload: { dialogueId: "dialogue_mara_venn" },
    });
    expect(next.activeDialogue).toEqual({ dialogueId: "dialogue_mara_venn" });
  });
});

describe("COMMAND_CLOSE_DIALOGUE", () => {
  it("clears activeDialogue without touching anything else", () => {
    const state = makeState({
      activeDialogue: { dialogueId: "dialogue_mara_venn" },
      currencies: { gold: 0, silver: 2, bronze: 10 },
    });
    const next = applyCommand(state, { type: "COMMAND_CLOSE_DIALOGUE", payload: {} });
    expect(next.activeDialogue).toBeNull();
    expect(next.currencies).toEqual({ gold: 0, silver: 2, bronze: 10 });
  });

  it("is a harmless unconditional clear when there was no active dialogue", () => {
    const state = makeState({ activeDialogue: null });
    const next = applyCommand(state, { type: "COMMAND_CLOSE_DIALOGUE", payload: {} });
    expect(next.activeDialogue).toBeNull();
  });
});
