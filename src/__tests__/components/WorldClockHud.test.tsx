// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorldClockHud } from "../../engine/components/WorldClockHud";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("WorldClockHud", () => {
  it("renders the current day/shift/season/weather and currencies from the store", () => {
    usePlayerStore.setState({
      worldClock: { shift: "AFTERNOON", day: 3, season: "AUTUMN", weather: "RAIN" },
      currencies: { gold: 2, silver: 5, bronze: 10 },
    });
    render(<WorldClockHud />);
    expect(screen.getByText("Day 3")).toBeInTheDocument();
    expect(screen.getByText("AFTERNOON")).toBeInTheDocument();
    expect(screen.getByText("AUTUMN")).toBeInTheDocument();
    expect(screen.getByText("RAIN")).toBeInTheDocument();
    expect(screen.getByText("2g")).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
    expect(screen.getByText("10b")).toBeInTheDocument();
  });

  it("dispatches COMMAND_ADVANCE_SHIFT when the Advance Shift button is clicked", () => {
    render(<WorldClockHud />);
    fireEvent.click(screen.getByText("Advance Shift"));
    expect(usePlayerStore.getState().worldClock.shift).toBe("AFTERNOON");
  });
});
