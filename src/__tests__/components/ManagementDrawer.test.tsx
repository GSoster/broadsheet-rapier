// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ManagementDrawer } from "../../engine/components/ManagementDrawer";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("ManagementDrawer", () => {
  it("renders nothing when isOpen is false", () => {
    render(<ManagementDrawer isOpen={false} onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
    expect(screen.queryByText("Journal")).not.toBeInTheDocument();
  });

  it("defaults to the Case Board tab, listing unlocked clues", () => {
    usePlayerStore.setState({ unlockedClues: ["clue_torn_ledger_page"] });
    render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
    expect(screen.getByText("clue_torn_ledger_page")).toBeInTheDocument();
  });

  it("switches to the Endeavors tab and shows the active endeavor's title and phase", () => {
    usePlayerStore.setState({
      activeEndeavors: {
        endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
      },
    });
    render(
      <ManagementDrawer
        isOpen
        onClose={vi.fn()}
        endeavorTitles={{ endeavor_the_missing_broadsheet: "The Missing Broadsheet" }}
        items={{}}
      />
    );
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("The Missing Broadsheet")).toBeInTheDocument();
    expect(screen.getByText("Phase: phase_ask_around")).toBeInTheDocument();
  });

  it("switches to the Inventory tab and falls back to the raw itemId when no item data is provided", () => {
    usePlayerStore.setState({ inventory: [{ itemId: "item_lockpick", quantity: 2 }] });
    render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
    fireEvent.click(screen.getByText("Inventory"));
    expect(screen.getByText("item_lockpick ×2")).toBeInTheDocument();
  });

  it("renders an item's resolved name, description, and image when item data is provided", () => {
    usePlayerStore.setState({ inventory: [{ itemId: "item_rapier", quantity: 1 }] });
    render(
      <ManagementDrawer
        isOpen
        onClose={vi.fn()}
        endeavorTitles={{}}
        items={{
          item_rapier: {
            name: "Rapier",
            description: "A well-balanced dueling blade.",
            imageAsset: "/content/assets/images/items/rapier.webp",
          },
        }}
      />
    );
    fireEvent.click(screen.getByText("Inventory"));
    expect(screen.getByText("Rapier ×1")).toBeInTheDocument();
    expect(screen.getByText("A well-balanced dueling blade.")).toBeInTheDocument();
    expect(screen.getByAltText("Rapier")).toBeInTheDocument();
    expect(screen.queryByText("item_rapier ×1")).not.toBeInTheDocument();
  });

  it("fires onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<ManagementDrawer isOpen onClose={onClose} endeavorTitles={{}} items={{}} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("Reset Progress (dev-only)", () => {
    it("shows the Reset Progress button when import.meta.env.DEV is true", () => {
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      expect(screen.getByText("Reset Progress (Dev)")).toBeInTheDocument();
    });

    it("hides the Reset Progress button when import.meta.env.DEV is false", () => {
      vi.stubEnv("DEV", false);
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      expect(screen.queryByText("Reset Progress (Dev)")).not.toBeInTheDocument();
      vi.unstubAllEnvs();
    });

    it("requires a confirm step before resetting, and does nothing on Cancel", () => {
      usePlayerStore.setState({ currencies: { gold: 1, silver: 0, bronze: 0 } });
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);

      fireEvent.click(screen.getByText("Reset Progress (Dev)"));
      expect(screen.getByText("Reset all progress? This cannot be undone.")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Reset all progress? This cannot be undone.")).not.toBeInTheDocument();
      expect(usePlayerStore.getState().currencies).toEqual({ gold: 1, silver: 0, bronze: 0 });
    });

    it("resets to initialPlayerState after Confirm Reset", () => {
      usePlayerStore.setState({
        currencies: { gold: 1, silver: 0, bronze: 0 },
        unlockedClues: ["clue_torn_ledger_page"],
      });
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);

      fireEvent.click(screen.getByText("Reset Progress (Dev)"));
      fireEvent.click(screen.getByText("Confirm Reset"));

      expect(usePlayerStore.getState().currencies).toEqual(initialPlayerState.currencies);
      expect(usePlayerStore.getState().unlockedClues).toEqual([]);
    });
  });

  describe("World Clock dev tools (dev-only)", () => {
    it("shows the World Clock dev tools when import.meta.env.DEV is true", () => {
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      expect(screen.getByText("World Clock (Dev)")).toBeInTheDocument();
    });

    it("hides the World Clock dev tools when import.meta.env.DEV is false", () => {
      vi.stubEnv("DEV", false);
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      expect(screen.queryByText("World Clock (Dev)")).not.toBeInTheDocument();
      vi.unstubAllEnvs();
    });

    it("cycles Shift forward, wrapping from NIGHT back to MORNING", () => {
      usePlayerStore.setState({ worldClock: { shift: "NIGHT", day: 1, season: "SPRING", weather: "CLEAR" } });
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      const shiftRow = screen.getByText("Shift: NIGHT").parentElement!;
      fireEvent.click(within(shiftRow).getByText("Next"));
      expect(usePlayerStore.getState().worldClock.shift).toBe("MORNING");
    });

    it("cycles Season forward, wrapping from WINTER back to SPRING", () => {
      usePlayerStore.setState({ worldClock: { shift: "MORNING", day: 1, season: "WINTER", weather: "CLEAR" } });
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      const seasonRow = screen.getByText("Season: WINTER").parentElement!;
      fireEvent.click(within(seasonRow).getByText("Next"));
      expect(usePlayerStore.getState().worldClock.season).toBe("SPRING");
    });

    it("cycles Weather forward, wrapping from STORM back to CLEAR", () => {
      usePlayerStore.setState({ worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "STORM" } });
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      const weatherRow = screen.getByText("Weather: STORM").parentElement!;
      fireEvent.click(within(weatherRow).getByText("Next"));
      expect(usePlayerStore.getState().worldClock.weather).toBe("CLEAR");
    });

    it("increments the Day and disables the decrement button at day 1", () => {
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      const dayRow = screen.getByText("Day: 1").parentElement!;
      expect(within(dayRow).getByText("−")).toBeDisabled();

      fireEvent.click(within(dayRow).getByText("+"));
      expect(usePlayerStore.getState().worldClock.day).toBe(2);
    });

    it("decrements the Day but never below 1", () => {
      usePlayerStore.setState({ worldClock: { shift: "MORNING", day: 2, season: "SPRING", weather: "CLEAR" } });
      render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} items={{}} />);
      const dayRow = screen.getByText("Day: 2").parentElement!;
      fireEvent.click(within(dayRow).getByText("−"));
      expect(usePlayerStore.getState().worldClock.day).toBe(1);
      expect(within(screen.getByText("Day: 1").parentElement!).getByText("−")).toBeDisabled();
    });
  });
});
