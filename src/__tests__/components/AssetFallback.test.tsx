// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssetFallback } from "../../engine/components/AssetFallback";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AssetFallback", () => {
  it("renders the image normally before any load error", () => {
    render(<AssetFallback src="/content/assets/images/pois/crooked_hour_tavern.webp" alt="The Crooked Hour" />);
    const img = screen.getByRole("img", { name: "The Crooked Hour" });
    expect(img).toHaveAttribute("src", "/content/assets/images/pois/crooked_hour_tavern.webp");
    expect(screen.queryByText(/MISSING:/)).not.toBeInTheDocument();
  });

  it("renders the purple MISSING placeholder once the image fails to load", () => {
    render(<AssetFallback src="/content/assets/images/pois/crooked_hour_tavern.webp" alt="The Crooked Hour" />);
    fireEvent.error(screen.getByRole("img", { name: "The Crooked Hour" }));
    expect(
      screen.getByText("MISSING: /content/assets/images/pois/crooked_hour_tavern.webp")
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders an audio element for kind='audio'", () => {
    const { container } = render(
      <AssetFallback src="/content/assets/audio/tavern_ambience.mp3" alt="Tavern ambience" kind="audio" />
    );
    expect(container.querySelector("audio")).toHaveAttribute(
      "src",
      "/content/assets/audio/tavern_ambience.mp3"
    );
  });

  it("resolves the src against a non-root Vite BASE_URL (e.g. GitHub Pages deploy)", () => {
    vi.stubEnv("BASE_URL", "/broadsheet-rapier/");
    render(<AssetFallback src="/content/assets/images/pois/crooked_hour_tavern.webp" alt="The Crooked Hour" />);
    const img = screen.getByRole("img", { name: "The Crooked Hour" });
    expect(img).toHaveAttribute("src", "/broadsheet-rapier/content/assets/images/pois/crooked_hour_tavern.webp");
  });

  it("shows the original authored path (not the resolved URL) in the MISSING label", () => {
    vi.stubEnv("BASE_URL", "/broadsheet-rapier/");
    render(<AssetFallback src="/content/assets/images/pois/crooked_hour_tavern.webp" alt="The Crooked Hour" />);
    fireEvent.error(screen.getByRole("img", { name: "The Crooked Hour" }));
    expect(
      screen.getByText("MISSING: /content/assets/images/pois/crooked_hour_tavern.webp")
    ).toBeInTheDocument();
  });
});
