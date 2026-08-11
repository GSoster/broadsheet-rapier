// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MinigameOverlay } from "../../engine/components/MinigameOverlay";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("MinigameOverlay", () => {
  it("renders nothing when there is no active minigame", () => {
    const { container } = render(<MinigameOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the overlay with the active minigame's type once one is active", () => {
    usePlayerStore.setState({
      activeMinigame: {
        type: "DUEL",
        sourceId: "actor_mara_venn",
        config: {},
        onSuccessCommands: [],
        onFailureCommands: [],
      },
    });
    render(<MinigameOverlay />);
    expect(screen.getByText("DUEL")).toBeInTheDocument();
  });

  it("dispatches COMMAND_RESOLVE_MINIGAME with isVictory true and clears activeMinigame on victory", () => {
    usePlayerStore.setState({
      activeMinigame: {
        type: "DUEL",
        sourceId: "actor_mara_venn",
        config: {},
        onSuccessCommands: [{ type: "COMMAND_UNLOCK_NODE", payload: { nodeId: "poi_crooked_hour_tavern" } }],
        onFailureCommands: [],
      },
    });
    render(<MinigameOverlay />);
    fireEvent.click(screen.getByText("Resolve as Victory"));
    const state = usePlayerStore.getState();
    expect(state.activeMinigame).toBeNull();
    expect(state.unlockedNodes.poi_crooked_hour_tavern).toBe(true);
  });

  it("dispatches COMMAND_RESOLVE_MINIGAME with isVictory false on defeat", () => {
    usePlayerStore.setState({
      activeMinigame: {
        type: "DUEL",
        sourceId: "actor_mara_venn",
        config: {},
        onSuccessCommands: [],
        onFailureCommands: [
          {
            type: "COMMAND_ADJUST_REPUTATION",
            payload: { targetType: "actor", targetId: "actor_mara_venn", amount: -10 },
          },
        ],
      },
    });
    render(<MinigameOverlay />);
    fireEvent.click(screen.getByText("Resolve as Defeat"));
    const state = usePlayerStore.getState();
    expect(state.activeMinigame).toBeNull();
    expect(state.reputation.actors.actor_mara_venn).toBe(-10);
  });

  it("renders DiceGame instead of the generic shell when the active minigame is DICE", () => {
    usePlayerStore.setState({
      activeMinigame: {
        type: "DICE",
        sourceId: "poi_crooked_hour_tavern",
        config: { wager: 20 },
        onSuccessCommands: [],
        onFailureCommands: [],
      },
    });
    render(<MinigameOverlay />);
    expect(screen.getByText("Dice — Even Wins, Odd Loses")).toBeInTheDocument();
    expect(screen.queryByText("DICE")).not.toBeInTheDocument();
    expect(screen.queryByText(/dispatch plumbing only/)).not.toBeInTheDocument();
  });
});
