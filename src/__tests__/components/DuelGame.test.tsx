// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DuelGame } from "../../engine/components/minigames/DuelGame";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";
import { THRUST_DAMAGE } from "../../engine/minigames/duel";
import type { MinigameLauncherPayload } from "../../engine/types";

function makeDuelMinigame(overrides: Partial<MinigameLauncherPayload> = {}): MinigameLauncherPayload {
  return {
    type: "DUEL",
    sourceId: "actor_placeholder_opponent",
    config: {
      opponentId: "actor_placeholder_opponent",
      opponentName: "Placeholder Rival",
      opponentStartingEnergy: 100,
      opponentStartingPoise: 100,
      startingDistance: "IN_MEASURE",
    },
    onSuccessCommands: [],
    onFailureCommands: [],
    ...overrides,
  } as MinigameLauncherPayload;
}

function advance() {
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DuelGame", () => {
  it("disables Thrust out of measure and Dirty Trick outside close quarters", () => {
    usePlayerStore.setState({
      activeMinigame: makeDuelMinigame({
        config: {
          opponentId: "actor_placeholder_opponent",
          opponentName: "Placeholder Rival",
          opponentStartingEnergy: 100,
          opponentStartingPoise: 100,
          startingDistance: "OUT_OF_MEASURE",
        },
      }),
    });
    render(<DuelGame sourceId="actor_placeholder_opponent" />);
    expect(screen.getByText("Thrust")).toBeDisabled();
    expect(screen.getByText("Dirty Trick")).toBeDisabled();
    expect(screen.getByText("Feint")).not.toBeDisabled();
    expect(screen.getByText("Parry & Riposte")).not.toBeDisabled();
    expect(screen.getByText("Taunt")).not.toBeDisabled();
  });

  it("hides Flee and shows a fallback message when the config disallows it", () => {
    usePlayerStore.setState({
      activeMinigame: makeDuelMinigame({
        config: {
          opponentId: "actor_placeholder_opponent",
          opponentName: "Placeholder Rival",
          opponentStartingEnergy: 100,
          opponentStartingPoise: 100,
          allowFlee: false,
        },
      }),
    });
    render(<DuelGame sourceId="actor_placeholder_opponent" />);
    expect(screen.queryByText("Flee")).not.toBeInTheDocument();
    expect(screen.getByText("There's no retreat from this duel.")).toBeInTheDocument();
  });

  it("Flee clears activeMinigame without applying any consequence commands", () => {
    usePlayerStore.setState({
      activeMinigame: makeDuelMinigame({
        onSuccessCommands: [{ type: "COMMAND_UNLOCK_NODE", payload: { nodeId: "poi_should_not_unlock" } }],
        onFailureCommands: [{ type: "COMMAND_UNLOCK_NODE", payload: { nodeId: "poi_should_not_unlock" } }],
      }),
    });
    render(<DuelGame sourceId="actor_placeholder_opponent" />);
    fireEvent.click(screen.getByText("Flee"));
    expect(usePlayerStore.getState().activeMinigame).toBeNull();
    expect(usePlayerStore.getState().unlockedNodes.poi_should_not_unlock).toBeUndefined();
  });

  it("wins the duel and runs onSuccessCommands on Collect", () => {
    usePlayerStore.setState({
      activeMinigame: makeDuelMinigame({
        config: {
          opponentId: "actor_placeholder_opponent",
          opponentName: "Placeholder Rival",
          opponentStartingEnergy: THRUST_DAMAGE,
          opponentStartingPoise: 100,
          startingDistance: "IN_MEASURE",
        },
        onSuccessCommands: [{ type: "COMMAND_UNLOCK_NODE", payload: { nodeId: "poi_crooked_hour_tavern" } }],
      }),
    });
    // random forces the opponent's tie-break fallback toward FEINT (not a
    // parry) so the player's Thrust is guaranteed to land.
    render(<DuelGame sourceId="actor_placeholder_opponent" random={() => 0} />);
    fireEvent.click(screen.getByText("Thrust"));
    advance();
    expect(screen.getByText("Victory!")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Collect"));
    const state = usePlayerStore.getState();
    expect(state.activeMinigame).toBeNull();
    expect(state.unlockedNodes.poi_crooked_hour_tavern).toBe(true);
  });

  it("loses the duel and runs onFailureCommands on Collect", () => {
    usePlayerStore.setState({
      activeMinigame: makeDuelMinigame({
        config: {
          opponentId: "actor_placeholder_opponent",
          opponentName: "Placeholder Rival",
          opponentStartingEnergy: 100000,
          opponentStartingPoise: 100000,
          startingDistance: "IN_MEASURE",
        },
        onFailureCommands: [
          { type: "COMMAND_ADJUST_REPUTATION", payload: { targetType: "actor", targetId: "actor_placeholder_opponent", amount: -10 } },
        ],
      }),
    });
    render(<DuelGame sourceId="actor_placeholder_opponent" />);
    // Player Taunts every turn (never aggressive, always legal); the
    // opponent — healthy, in measure, never provoked into parrying — Thrusts
    // back every turn per chooseOpponentAction's heuristics. 100 / 15 energy
    // takes 7 hits to reach 0.
    for (let i = 0; i < 7; i++) {
      // getByRole (not getByText): after the first turn resolves, the duel
      // log itself contains a bolded "Taunt" (see DuelGame's action-name
      // highlighting) — getByText("Taunt") would then match both the button
      // and the log entry, which is ambiguous. Scoping to the button role
      // is both the fix and the more correct query regardless.
      fireEvent.click(screen.getByRole("button", { name: "Taunt" }));
      advance();
    }
    expect(screen.getByText("Defeated.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Collect"));
    const state = usePlayerStore.getState();
    expect(state.activeMinigame).toBeNull();
    expect(state.reputation.actors.actor_placeholder_opponent).toBe(-10);
  });

  it("Taunt drains bonus poise when the player's wagering-ring reputation meets the threshold", () => {
    usePlayerStore.setState({
      reputation: { factions: { faction_wagering_ring: 50 }, actors: {} },
      activeMinigame: makeDuelMinigame({
        config: {
          opponentId: "actor_placeholder_opponent",
          opponentName: "Placeholder Rival",
          opponentStartingEnergy: 100000,
          opponentStartingPoise: 60,
          startingDistance: "IN_MEASURE",
        },
      }),
    });
    render(<DuelGame sourceId="actor_placeholder_opponent" />);
    fireEvent.click(screen.getByText("Taunt"));
    advance();
    expect(screen.getByText("Poise: 45")).toBeInTheDocument();
  });

  it("Taunt drains only the base poise amount without sufficient reputation", () => {
    usePlayerStore.setState({
      activeMinigame: makeDuelMinigame({
        config: {
          opponentId: "actor_placeholder_opponent",
          opponentName: "Placeholder Rival",
          opponentStartingEnergy: 100000,
          opponentStartingPoise: 60,
          startingDistance: "IN_MEASURE",
        },
      }),
    });
    render(<DuelGame sourceId="actor_placeholder_opponent" />);
    fireEvent.click(screen.getByText("Taunt"));
    advance();
    expect(screen.getByText("Poise: 55")).toBeInTheDocument();
  });
});
