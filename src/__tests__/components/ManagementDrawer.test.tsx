// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ManagementDrawer, type ManagementDrawerProps } from "../../engine/components/ManagementDrawer";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

// Local default-props helper (CONTRIBUTING.md: "any component test file
// whose component takes 3+ required props needs one") — ManagementDrawer's
// prop list has grown three times now (items, then roster, then
// phaseObjectives), each time rippling a one-line addition into every
// existing render call until this existed.
function renderDrawer(overrides: Partial<ManagementDrawerProps> = {}) {
  const defaults: ManagementDrawerProps = {
    isOpen: true,
    onClose: vi.fn(),
    endeavorTitles: {},
    phaseObjectives: {},
    phaseIsTerminal: {},
    items: {},
    roster: [],
  };
  return render(<ManagementDrawer {...defaults} {...overrides} />);
}

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("ManagementDrawer", () => {
  it("renders nothing when isOpen is false", () => {
    renderDrawer({ isOpen: false });
    expect(screen.queryByText("Journal")).not.toBeInTheDocument();
  });

  it("defaults to the Case Board tab, listing unlocked clues", () => {
    usePlayerStore.setState({ unlockedClues: ["clue_torn_ledger_page"] });
    renderDrawer();
    expect(screen.getByText("clue_torn_ledger_page")).toBeInTheDocument();
  });

  it("switches to the Endeavors tab and shows the active endeavor's title and phase objective text", () => {
    usePlayerStore.setState({
      activeEndeavors: {
        endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
      },
    });
    renderDrawer({
      endeavorTitles: { endeavor_the_missing_broadsheet: "The Missing Broadsheet" },
      phaseObjectives: {
        endeavor_the_missing_broadsheet: { phase_ask_around: "Ask around the Lantern Ward." },
      },
    });
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("The Missing Broadsheet")).toBeInTheDocument();
    expect(screen.getByText("Ask around the Lantern Ward.")).toBeInTheDocument();
  });

  it("falls back to the raw phase id when no objectiveText is provided for it", () => {
    usePlayerStore.setState({
      activeEndeavors: {
        endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
      },
    });
    renderDrawer({ endeavorTitles: { endeavor_the_missing_broadsheet: "The Missing Broadsheet" } });
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("phase_ask_around")).toBeInTheDocument();
  });

  it("splits ongoing and completed endeavors under a separator, completed last and marked", () => {
    usePlayerStore.setState({
      activeEndeavors: {
        endeavor_ongoing: { currentPhaseId: "phase_a", logHistory: [] },
        endeavor_done: { currentPhaseId: "phase_terminal", logHistory: [] },
      },
    });
    renderDrawer({
      endeavorTitles: { endeavor_ongoing: "Ongoing One", endeavor_done: "Finished One" },
      phaseIsTerminal: { endeavor_done: { phase_terminal: true } },
    });
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("Ongoing One")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("✓ Finished One")).toBeInTheDocument();
  });

  it("shows the 'no active endeavors right now' message when every started endeavor is completed", () => {
    usePlayerStore.setState({
      activeEndeavors: { endeavor_done: { currentPhaseId: "phase_terminal", logHistory: [] } },
    });
    renderDrawer({
      endeavorTitles: { endeavor_done: "Finished One" },
      phaseIsTerminal: { endeavor_done: { phase_terminal: true } },
    });
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("No active endeavors right now.")).toBeInTheDocument();
    expect(screen.getByText("✓ Finished One")).toBeInTheDocument();
  });

  it("shows no Completed section when no started endeavor has reached a terminal phase", () => {
    usePlayerStore.setState({
      activeEndeavors: { endeavor_ongoing: { currentPhaseId: "phase_a", logHistory: [] } },
    });
    renderDrawer({ endeavorTitles: { endeavor_ongoing: "Ongoing One" } });
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("Ongoing One")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("switches to the Inventory tab and falls back to the raw itemId when no item data is provided", () => {
    usePlayerStore.setState({ inventory: [{ itemId: "item_lockpick", quantity: 2 }] });
    renderDrawer();
    fireEvent.click(screen.getByText("Inventory"));
    expect(screen.getByText("item_lockpick ×2")).toBeInTheDocument();
  });

  it("renders an item's resolved name, description, and image when item data is provided", () => {
    usePlayerStore.setState({ inventory: [{ itemId: "item_rapier", quantity: 1 }] });
    renderDrawer({
      items: {
        item_rapier: {
          name: "Rapier",
          description: "A well-balanced dueling blade.",
          imageAsset: "/content/assets/images/items/rapier.webp",
        },
      },
    });
    fireEvent.click(screen.getByText("Inventory"));
    expect(screen.getByText("Rapier ×1")).toBeInTheDocument();
    expect(screen.getByText("A well-balanced dueling blade.")).toBeInTheDocument();
    expect(screen.getByAltText("Rapier")).toBeInTheDocument();
    expect(screen.queryByText("item_rapier ×1")).not.toBeInTheDocument();
  });

  it("fires onClose when Close is clicked", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("Reset Progress (dev-only)", () => {
    it("shows the Reset Progress button when import.meta.env.DEV is true", () => {
      renderDrawer();
      expect(screen.getByText("Reset Progress (Dev)")).toBeInTheDocument();
    });

    it("hides the Reset Progress button when import.meta.env.DEV is false", () => {
      vi.stubEnv("DEV", false);
      renderDrawer();
      expect(screen.queryByText("Reset Progress (Dev)")).not.toBeInTheDocument();
      vi.unstubAllEnvs();
    });

    it("requires a confirm step before resetting, and does nothing on Cancel", () => {
      usePlayerStore.setState({ currencies: { gold: 1, silver: 0, bronze: 0 } });
      renderDrawer();

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
      renderDrawer();

      fireEvent.click(screen.getByText("Reset Progress (Dev)"));
      fireEvent.click(screen.getByText("Confirm Reset"));

      expect(usePlayerStore.getState().currencies).toEqual(initialPlayerState.currencies);
      expect(usePlayerStore.getState().unlockedClues).toEqual([]);
    });
  });

  describe("World Clock dev tools (dev-only)", () => {
    it("shows the World Clock dev tools when import.meta.env.DEV is true", () => {
      renderDrawer();
      expect(screen.getByText("World Clock (Dev)")).toBeInTheDocument();
    });

    it("hides the World Clock dev tools when import.meta.env.DEV is false", () => {
      vi.stubEnv("DEV", false);
      renderDrawer();
      expect(screen.queryByText("World Clock (Dev)")).not.toBeInTheDocument();
      vi.unstubAllEnvs();
    });

    it("cycles Shift forward, wrapping from NIGHT back to MORNING", () => {
      usePlayerStore.setState({ worldClock: { shift: "NIGHT", day: 1, season: "SPRING", weather: "CLEAR" } });
      renderDrawer();
      const shiftRow = screen.getByText("Shift: NIGHT").parentElement!;
      fireEvent.click(within(shiftRow).getByText("Next"));
      expect(usePlayerStore.getState().worldClock.shift).toBe("MORNING");
    });

    it("cycles Season forward, wrapping from WINTER back to SPRING", () => {
      usePlayerStore.setState({ worldClock: { shift: "MORNING", day: 1, season: "WINTER", weather: "CLEAR" } });
      renderDrawer();
      const seasonRow = screen.getByText("Season: WINTER").parentElement!;
      fireEvent.click(within(seasonRow).getByText("Next"));
      expect(usePlayerStore.getState().worldClock.season).toBe("SPRING");
    });

    it("cycles Weather forward, wrapping from STORM back to CLEAR", () => {
      usePlayerStore.setState({ worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "STORM" } });
      renderDrawer();
      const weatherRow = screen.getByText("Weather: STORM").parentElement!;
      fireEvent.click(within(weatherRow).getByText("Next"));
      expect(usePlayerStore.getState().worldClock.weather).toBe("CLEAR");
    });

    it("increments the Day and disables the decrement button at day 1", () => {
      renderDrawer();
      const dayRow = screen.getByText("Day: 1").parentElement!;
      expect(within(dayRow).getByText("−")).toBeDisabled();

      fireEvent.click(within(dayRow).getByText("+"));
      expect(usePlayerStore.getState().worldClock.day).toBe(2);
    });

    it("decrements the Day but never below 1", () => {
      usePlayerStore.setState({ worldClock: { shift: "MORNING", day: 2, season: "SPRING", weather: "CLEAR" } });
      renderDrawer();
      const dayRow = screen.getByText("Day: 2").parentElement!;
      fireEvent.click(within(dayRow).getByText("−"));
      expect(usePlayerStore.getState().worldClock.day).toBe(1);
      expect(within(screen.getByText("Day: 1").parentElement!).getByText("−")).toBeDisabled();
    });
  });

  describe("Roster tab", () => {
    const maraEntry = {
      id: "actor_mara_venn",
      name: "Mara Venn",
      title: "Wagering Ring Regular",
      description: "A fixture at the Crooked Hour's back tables.",
      imageAsset: "/content/assets/images/actors/mara_venn.webp",
      factionNames: ["The Wagering Ring"],
      dialogueId: "dialogue_mara_venn",
    };

    it("shows the empty state when the player hasn't met anyone yet", () => {
      renderDrawer({ roster: [maraEntry] });
      fireEvent.click(screen.getByText("Roster"));
      expect(screen.getByText("You haven't met anyone yet.")).toBeInTheDocument();
      expect(screen.queryByText("Mara Venn")).not.toBeInTheDocument();
    });

    it("renders a met actor's name, title, description, image, and faction(s)", () => {
      usePlayerStore.setState({
        dialogueProgress: { dialogue_mara_venn: { currentNodeId: "node_greeting", visitCounts: {} } },
      });
      renderDrawer({ roster: [maraEntry] });
      fireEvent.click(screen.getByText("Roster"));
      expect(screen.getByText("Mara Venn")).toBeInTheDocument();
      expect(screen.getByText("Wagering Ring Regular")).toBeInTheDocument();
      expect(screen.getByText("The Wagering Ring")).toBeInTheDocument();
      expect(screen.getByText("A fixture at the Crooked Hour's back tables.")).toBeInTheDocument();
      expect(screen.getByAltText("Mara Venn")).toBeInTheDocument();
    });

    it("excludes an actor not yet present in dialogueProgress", () => {
      usePlayerStore.setState({
        dialogueProgress: { dialogue_someone_else: { currentNodeId: "node_x", visitCounts: {} } },
      });
      renderDrawer({ roster: [maraEntry] });
      fireEvent.click(screen.getByText("Roster"));
      expect(screen.queryByText("Mara Venn")).not.toBeInTheDocument();
      expect(screen.getByText("You haven't met anyone yet.")).toBeInTheDocument();
    });

    it("renders no faction line and no portrait when they're absent, without any placeholder text", () => {
      usePlayerStore.setState({
        dialogueProgress: { dialogue_mara_venn: { currentNodeId: "node_greeting", visitCounts: {} } },
      });
      renderDrawer({ roster: [{ ...maraEntry, imageAsset: undefined, factionNames: [] }] });
      fireEvent.click(screen.getByText("Roster"));
      expect(screen.getByText("Mara Venn")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.queryByText("The Wagering Ring")).not.toBeInTheDocument();
      expect(screen.queryByText(/Faction/)).not.toBeInTheDocument();
    });

    it("joins multiple faction names with a comma", () => {
      usePlayerStore.setState({
        dialogueProgress: { dialogue_mara_venn: { currentNodeId: "node_greeting", visitCounts: {} } },
      });
      renderDrawer({ roster: [{ ...maraEntry, factionNames: ["The Wagering Ring", "City Watch"] }] });
      fireEvent.click(screen.getByText("Roster"));
      expect(screen.getByText("The Wagering Ring, City Watch")).toBeInTheDocument();
    });
  });
});
