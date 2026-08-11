// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManagementDrawer } from "../../engine/components/ManagementDrawer";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

describe("ManagementDrawer", () => {
  it("renders nothing when isOpen is false", () => {
    render(<ManagementDrawer isOpen={false} onClose={vi.fn()} endeavorTitles={{}} />);
    expect(screen.queryByText("Journal")).not.toBeInTheDocument();
  });

  it("defaults to the Case Board tab, listing unlocked clues", () => {
    usePlayerStore.setState({ unlockedClues: ["clue_torn_ledger_page"] });
    render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} />);
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
      />
    );
    fireEvent.click(screen.getByText("Endeavors"));
    expect(screen.getByText("The Missing Broadsheet")).toBeInTheDocument();
    expect(screen.getByText("Phase: phase_ask_around")).toBeInTheDocument();
  });

  it("switches to the Inventory tab and lists items with quantities", () => {
    usePlayerStore.setState({ inventory: [{ itemId: "item_lockpick", quantity: 2 }] });
    render(<ManagementDrawer isOpen onClose={vi.fn()} endeavorTitles={{}} />);
    fireEvent.click(screen.getByText("Inventory"));
    expect(screen.getByText("item_lockpick ×2")).toBeInTheDocument();
  });

  it("fires onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<ManagementDrawer isOpen onClose={onClose} endeavorTitles={{}} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
