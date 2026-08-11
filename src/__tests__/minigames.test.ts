import { describe, expect, it } from "vitest";
import { applyCommand } from "../engine/store/commands";
import { initialPlayerState } from "../engine/store/playerStore";
import type { MinigameLauncherPayload, PlayerState } from "../engine/types";

function makeState(overrides: Partial<PlayerState> = {}): PlayerState {
  return { ...initialPlayerState, ...overrides };
}

function makeMinigame(overrides: Partial<MinigameLauncherPayload> = {}): MinigameLauncherPayload {
  return {
    type: "DUEL",
    sourceId: "actor_mara_venn",
    config: {},
    onSuccessCommands: [],
    onFailureCommands: [],
    ...overrides,
  };
}

describe("COMMAND_START_MINIGAME", () => {
  it("sets activeMinigame to the dispatched payload, verbatim", () => {
    const state = makeState();
    const minigame = makeMinigame();
    const next = applyCommand(state, {
      type: "COMMAND_START_MINIGAME",
      payload: minigame as unknown as Record<string, unknown>,
    });
    expect(next.activeMinigame).toEqual(minigame);
  });
});

describe("COMMAND_RESOLVE_MINIGAME", () => {
  const minigame = makeMinigame({
    onSuccessCommands: [{ type: "COMMAND_UNLOCK_NODE", payload: { nodeId: "poi_crooked_hour_tavern" } }],
    onFailureCommands: [
      {
        type: "COMMAND_ADJUST_REPUTATION",
        payload: { targetType: "actor", targetId: "actor_mara_venn", amount: -10 },
      },
    ],
  });

  it("dispatches onSuccessCommands and clears activeMinigame on victory", () => {
    const state = makeState({ activeMinigame: minigame });
    const next = applyCommand(state, { type: "COMMAND_RESOLVE_MINIGAME", payload: { isVictory: true } });
    expect(next.activeMinigame).toBeNull();
    expect(next.unlockedNodes.poi_crooked_hour_tavern).toBe(true);
    expect(next.reputation.actors.actor_mara_venn).toBeUndefined();
  });

  it("dispatches onFailureCommands and clears activeMinigame on defeat", () => {
    const state = makeState({ activeMinigame: minigame });
    const next = applyCommand(state, { type: "COMMAND_RESOLVE_MINIGAME", payload: { isVictory: false } });
    expect(next.activeMinigame).toBeNull();
    expect(next.reputation.actors.actor_mara_venn).toBe(-10);
    expect(next.unlockedNodes.poi_crooked_hour_tavern).toBeUndefined();
  });

  it("is a no-op when there is no active minigame", () => {
    const state = makeState({ activeMinigame: null });
    const next = applyCommand(state, { type: "COMMAND_RESOLVE_MINIGAME", payload: { isVictory: true } });
    expect(next).toBe(state);
  });
});

describe("COMMAND_CANCEL_MINIGAME", () => {
  it("clears activeMinigame without running onSuccessCommands or onFailureCommands", () => {
    const minigame = makeMinigame({
      onSuccessCommands: [{ type: "COMMAND_UNLOCK_NODE", payload: { nodeId: "poi_crooked_hour_tavern" } }],
      onFailureCommands: [
        {
          type: "COMMAND_ADJUST_REPUTATION",
          payload: { targetType: "actor", targetId: "actor_mara_venn", amount: -10 },
        },
      ],
    });
    const state = makeState({ activeMinigame: minigame });
    const next = applyCommand(state, { type: "COMMAND_CANCEL_MINIGAME", payload: {} });
    expect(next.activeMinigame).toBeNull();
    expect(next.unlockedNodes.poi_crooked_hour_tavern).toBeUndefined();
    expect(next.reputation.actors.actor_mara_venn).toBeUndefined();
  });

  it("leaves unrelated state untouched when there was no active minigame", () => {
    const state = makeState({ activeMinigame: null, currencies: { gold: 0, silver: 2, bronze: 10 } });
    const next = applyCommand(state, { type: "COMMAND_CANCEL_MINIGAME", payload: {} });
    expect(next.activeMinigame).toBeNull();
    expect(next.currencies).toEqual({ gold: 0, silver: 2, bronze: 10 });
  });
});
