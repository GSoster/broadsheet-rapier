// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DialogueOverlay, type DialogueOverlayNode } from "../../engine/components/DialogueOverlay";
import { initialPlayerState, usePlayerStore } from "../../engine/store/playerStore";

beforeEach(() => {
  usePlayerStore.setState({ ...initialPlayerState, eventLog: [] });
});

const node: DialogueOverlayNode = {
  id: "node_engaged",
  speaker: "Mara Venn",
  text: "She leans in.",
  choices: [
    { id: "choice_available", text: "Ask again", nextNodeId: "node_engaged", commands: [] },
    {
      id: "choice_gated",
      text: "Press for the lead",
      nextNodeId: "node_lead_revealed",
      requires: { minActorReputation: { actorId: "actor_mara_venn", value: 10 } },
      commands: [],
    },
    { id: "choice_end", text: "Leave", commands: [] },
  ],
};

describe("DialogueOverlay", () => {
  it("renders nothing when node is null", () => {
    const { container } = render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the node's text and every choice", () => {
    render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={node} onClose={vi.fn()} />);
    expect(screen.getByText(/She leans in/)).toBeInTheDocument();
    expect(screen.getByText("Ask again")).toBeInTheDocument();
    expect(screen.getByText("Press for the lead")).toBeInTheDocument();
    expect(screen.getByText("Leave")).toBeInTheDocument();
  });

  it("renders a choice with an unmet requirement as disabled", () => {
    render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={node} onClose={vi.fn()} />);
    expect(screen.getByText("Press for the lead").closest("button")).toBeDisabled();
  });

  it("renders a choice with a met requirement as enabled", () => {
    usePlayerStore.setState({ reputation: { factions: {}, actors: { actor_mara_venn: 10 } } });
    render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={node} onClose={vi.fn()} />);
    expect(screen.getByText("Press for the lead").closest("button")).not.toBeDisabled();
  });

  it("dispatches COMMAND_SELECT_DIALOGUE_CHOICE with nextNodeId when clicking a continuing choice", () => {
    render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={node} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Ask again"));
    expect(usePlayerStore.getState().dialogueProgress.dialogue_mara_venn.currentNodeId).toBe("node_engaged");
  });

  it("dispatches with nextNodeId: null and calls onClose when clicking an ending choice", () => {
    const onClose = vi.fn();
    render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={node} onClose={onClose} />);
    fireEvent.click(screen.getByText("Leave"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().dialogueProgress.dialogue_mara_venn).toBeUndefined();
  });

  it("does not call onClose when clicking a continuing choice", () => {
    const onClose = vi.fn();
    render(<DialogueOverlay dialogueId="dialogue_mara_venn" node={node} onClose={onClose} />);
    fireEvent.click(screen.getByText("Ask again"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
