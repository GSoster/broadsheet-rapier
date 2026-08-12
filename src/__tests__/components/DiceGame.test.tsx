// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DiceGame } from "../../engine/components/minigames/DiceGame";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

function stubRandomForDice(faceA: number, faceB: number) {
  const sequence = [(faceA - 1) / 6, (faceB - 1) / 6];
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("DiceGame", () => {
  it("defaults the wager to 20 bronze and shows the current balance", () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 5, bronze: 10 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" />);
    expect(screen.getByText("20 bronze wager")).toBeInTheDocument();
    expect(screen.getByText("Balance: 0g 5s 10b")).toBeInTheDocument();
  });

  it("increases and decreases the wager by WAGER_STEP within range", () => {
    usePlayerStore.setState({ currencies: { gold: 1, silver: 0, bronze: 0 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" />);
    fireEvent.click(screen.getByText("+"));
    expect(screen.getByText("25 bronze wager")).toBeInTheDocument();
    fireEvent.click(screen.getByText("−"));
    fireEvent.click(screen.getByText("−"));
    expect(screen.getByText("15 bronze wager")).toBeInTheDocument();
  });

  it("disables Throw and shows 'Not enough coin' when the player can't afford MIN_WAGER", () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 2 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" />);
    const throwButton = screen.getByText("Not enough coin");
    expect(throwButton).toBeDisabled();
  });

  it("Leave stays enabled and clears activeMinigame even when the player can't afford MIN_WAGER", () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 2 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" />);
    const leaveButton = screen.getByText("Leave");
    expect(leaveButton).not.toBeDisabled();
    fireEvent.click(leaveButton);
    expect(usePlayerStore.getState().activeMinigame).toBeNull();
  });

  it("Leave cancels a bet in progress without applying any currency change", () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 50 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" />);
    fireEvent.click(screen.getByText("+")); // wager now 25, activeMinigame set
    fireEvent.click(screen.getByText("Leave"));
    expect(usePlayerStore.getState().activeMinigame).toBeNull();
    expect(usePlayerStore.getState().currencies).toEqual({ gold: 0, silver: 0, bronze: 50 });
  });

  it("shows a win result and credits the wager after a winning throw", async () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 50 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" random={stubRandomForDice(2, 2)} />); // sum 4, even
    fireEvent.click(screen.getByText("Throw"));
    await waitFor(() => expect(screen.getByText("You win 20 bronze!")).toBeInTheDocument());
    expect(screen.getByText("Rolled 4 (Even)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Collect"));
    // 50 + 20 = 70 bronze-equivalent, normalized: 3 silver + 10 bronze
    expect(usePlayerStore.getState().currencies).toEqual({ gold: 0, silver: 3, bronze: 10 });
    expect(usePlayerStore.getState().activeMinigame).toBeNull();
  });

  it("shows a loss result and deducts the wager after a losing throw", async () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 50 } });
    render(<DiceGame sourceId="poi_crooked_hour_tavern" random={stubRandomForDice(1, 2)} />); // sum 3, odd
    fireEvent.click(screen.getByText("Throw"));
    await waitFor(() => expect(screen.getByText("You lose 20 bronze.")).toBeInTheDocument());
    expect(screen.getByText("Rolled 3 (Odd)")).toBeInTheDocument();
    expect(screen.queryByText("Collect")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Continue"));
    // 50 - 20 = 30 bronze-equivalent, normalized: 1 silver + 10 bronze
    expect(usePlayerStore.getState().currencies).toEqual({ gold: 0, silver: 1, bronze: 10 });
    expect(usePlayerStore.getState().activeMinigame).toBeNull();
  });

  it("plays the win sound on a winning throw", async () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 50 } });
    const playSoundSpy = vi.fn();
    render(
      <DiceGame sourceId="poi_crooked_hour_tavern" random={stubRandomForDice(2, 2)} playSound={playSoundSpy} />
    );
    fireEvent.click(screen.getByText("Throw"));
    await waitFor(() => expect(screen.getByText("You win 20 bronze!")).toBeInTheDocument());
    expect(playSoundSpy).toHaveBeenCalledTimes(1);
    expect(playSoundSpy).toHaveBeenCalledWith(expect.stringContaining("dice_win"));
  });

  it("plays the lose sound on a losing throw", async () => {
    usePlayerStore.setState({ currencies: { gold: 0, silver: 0, bronze: 50 } });
    const playSoundSpy = vi.fn();
    render(
      <DiceGame sourceId="poi_crooked_hour_tavern" random={stubRandomForDice(1, 2)} playSound={playSoundSpy} />
    );
    fireEvent.click(screen.getByText("Throw"));
    await waitFor(() => expect(screen.getByText("You lose 20 bronze.")).toBeInTheDocument());
    expect(playSoundSpy).toHaveBeenCalledTimes(1);
    expect(playSoundSpy).toHaveBeenCalledWith(expect.stringContaining("dice_lose"));
  });
});
