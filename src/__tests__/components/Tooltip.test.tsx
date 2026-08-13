// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip } from "../../engine/components/Tooltip";

describe("Tooltip", () => {
  it("renders its children", () => {
    render(
      <Tooltip label="Explanation text">
        <span>Trigger</span>
      </Tooltip>
    );
    expect(screen.getByText("Trigger")).toBeInTheDocument();
  });

  it("renders the label in the document (present, not conditionally mounted)", () => {
    render(
      <Tooltip label="Explanation text">
        <span>Trigger</span>
      </Tooltip>
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Explanation text");
  });
});
