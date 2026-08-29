// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initialPlayerState, usePlayerStore } from "../engine/store/playerStore";

const STORAGE_KEY = "broadsheet_rapier_player_state";

beforeEach(() => {
  localStorage.clear();
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [], notifications: [] });
});

describe("localStorage persistence", () => {
  it("never writes eventLog to the persisted save, even after dispatching commands", () => {
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_UNLOCK_NODE",
      payload: { nodeId: "district_lantern_ward" },
    });
    usePlayerStore.getState().dispatchCommand({
      type: "COMMAND_ADJUST_CURRENCY",
      payload: { denomination: "bronze", amount: 5 },
    });

    // Confirm the in-memory log actually grew (so this test would fail if
    // the exclusion broke) before checking what got persisted.
    expect(usePlayerStore.getState().eventLog.length).toBe(2);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);

    expect(persisted.state).not.toHaveProperty("eventLog");
    expect(persisted.state).not.toHaveProperty("notifications");
    expect(persisted.state).not.toHaveProperty("dispatchCommand");
    expect(persisted.state).not.toHaveProperty("exportSave");
    expect(persisted.state).not.toHaveProperty("importSave");
    // activeModifiers: store-only, same treatment as eventLog/notifications
    // (docs/features/feature_modifier_system.md) — recomputed from inventory
    // on every load, never itself a save-file value.
    expect(persisted.state).not.toHaveProperty("activeModifiers");
    expect(persisted.state).not.toHaveProperty("setActiveModifiers");
    expect(Object.keys(persisted.state).sort()).toEqual(
      [
        "activeDialogue",
        "activeEndeavors",
        "activeMinigame",
        "currencies",
        "currentLocation",
        "dialogueProgress",
        "inventory",
        "reputation",
        "unlockedClues",
        "unlockedNodes",
        "worldClock",
      ].sort()
    );
  });
});
