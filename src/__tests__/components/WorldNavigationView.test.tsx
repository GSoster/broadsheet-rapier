// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorldNavigationView } from "../../engine/components/WorldNavigationView";

describe("WorldNavigationView", () => {
  const pois = [
    { id: "poi_crooked_hour_tavern", name: "The Crooked Hour", isUnlocked: true },
    { id: "poi_locked_warehouse", name: "The Locked Warehouse", isUnlocked: false },
  ];

  it("renders the settlement/district headings and the POI list from props", () => {
    render(
      <WorldNavigationView
        settlementName="Valdeombra"
        districtName="Lantern Ward"
        pois={pois}
        onSelectPoi={vi.fn()}
      />
    );
    expect(screen.getByText("Valdeombra")).toBeInTheDocument();
    expect(screen.getByText("Lantern Ward")).toBeInTheDocument();
    expect(screen.getByText("The Crooked Hour")).toBeInTheDocument();
  });

  it("shows locked POIs as unlabeled and disabled rather than hiding them", () => {
    render(
      <WorldNavigationView
        settlementName="Valdeombra"
        districtName="Lantern Ward"
        pois={pois}
        onSelectPoi={vi.fn()}
      />
    );
    const lockedButton = screen.getByText("??? (locked)");
    expect(lockedButton).toBeDisabled();
    expect(screen.queryByText("The Locked Warehouse")).not.toBeInTheDocument();
  });

  it("fires onSelectPoi with the clicked POI's id", () => {
    const onSelectPoi = vi.fn();
    render(
      <WorldNavigationView
        settlementName="Valdeombra"
        districtName="Lantern Ward"
        pois={pois}
        onSelectPoi={onSelectPoi}
      />
    );
    fireEvent.click(screen.getByText("The Crooked Hour"));
    expect(onSelectPoi).toHaveBeenCalledWith("poi_crooked_hour_tavern");
    expect(onSelectPoi).toHaveBeenCalledTimes(1);
  });

  it("does not fire onSelectPoi when a locked POI is clicked", () => {
    const onSelectPoi = vi.fn();
    render(
      <WorldNavigationView
        settlementName="Valdeombra"
        districtName="Lantern Ward"
        pois={pois}
        onSelectPoi={onSelectPoi}
      />
    );
    fireEvent.click(screen.getByText("??? (locked)"));
    expect(onSelectPoi).not.toHaveBeenCalled();
  });
});
