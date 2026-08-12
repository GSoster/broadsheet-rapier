import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAssetUrl } from "../engine/utils/resolveAssetUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAssetUrl", () => {
  it("leaves a root-relative path unchanged when BASE_URL is '/'", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(resolveAssetUrl("/content/assets/images/items/rapier.jpg")).toBe(
      "/content/assets/images/items/rapier.jpg"
    );
  });

  it("prefixes with a non-root BASE_URL without double-slashing", () => {
    vi.stubEnv("BASE_URL", "/broadsheet-rapier/");
    expect(resolveAssetUrl("/content/assets/images/items/rapier.jpg")).toBe(
      "/broadsheet-rapier/content/assets/images/items/rapier.jpg"
    );
  });
});
