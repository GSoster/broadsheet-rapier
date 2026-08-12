// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeInteractionCanvas } from "../../engine/components/NodeInteractionCanvas";

describe("NodeInteractionCanvas", () => {
  const actors = [{ id: "actor_mara_venn", name: "Mara Venn", title: "Wagering Ring Regular" }];

  it("renders the POI name/description and its actors", () => {
    render(
      <NodeInteractionCanvas
        poiName="The Crooked Hour"
        poiDescription="A tavern with a floor that slopes toward the door."
        actors={actors}
        selectedActorId={null}
        onSelectActor={vi.fn()}
        onLeave={vi.fn()}
      />
    );
    expect(screen.getByText("The Crooked Hour")).toBeInTheDocument();
    expect(screen.getByText(/floor that slopes/)).toBeInTheDocument();
    expect(screen.getByText(/Mara Venn/)).toBeInTheDocument();
  });

  it("fires onSelectActor with the clicked actor's id", () => {
    const onSelectActor = vi.fn();
    render(
      <NodeInteractionCanvas
        poiName="The Crooked Hour"
        poiDescription="desc"
        actors={actors}
        selectedActorId={null}
        onSelectActor={onSelectActor}
        onLeave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(/Mara Venn/));
    expect(onSelectActor).toHaveBeenCalledWith("actor_mara_venn");
  });

  it("highlights the actor button matching selectedActorId", () => {
    render(
      <NodeInteractionCanvas
        poiName="The Crooked Hour"
        poiDescription="desc"
        actors={actors}
        selectedActorId="actor_mara_venn"
        onSelectActor={vi.fn()}
        onLeave={vi.fn()}
      />
    );
    expect(screen.getByText(/Mara Venn/).closest("button")).toHaveClass("border-indigo-400");
  });

  it("fires onLeave when the Back button is clicked", () => {
    const onLeave = vi.fn();
    render(
      <NodeInteractionCanvas
        poiName="The Crooked Hour"
        poiDescription="desc"
        actors={actors}
        selectedActorId={null}
        onSelectActor={vi.fn()}
        onLeave={onLeave}
      />
    );
    fireEvent.click(screen.getByText(/Back/));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
