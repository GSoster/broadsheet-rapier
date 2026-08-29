// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "../engine/store/localeStore";

const STORAGE_KEY = "broadsheet_rapier_locale";

beforeEach(() => {
  localStorage.clear();
  useLocaleStore.setState({ locale: "en" });
});

describe("useLocaleStore", () => {
  it("defaults to 'en'", () => {
    expect(useLocaleStore.getState().locale).toBe("en");
  });

  it("setLocale updates the store", () => {
    useLocaleStore.getState().setLocale("pt-BR");
    expect(useLocaleStore.getState().locale).toBe("pt-BR");
  });

  it("persists under its own localStorage key, independent of PlayerState", () => {
    useLocaleStore.getState().setLocale("pt-BR");
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);
    expect(persisted.state.locale).toBe("pt-BR");
    // The proof this store is fully decoupled from save-file persistence:
    // its key is its own, distinct from broadsheet_rapier_player_state,
    // and persistence.test.ts's PlayerState key-list assertion needs no
    // change at all for this feature.
    expect(localStorage.getItem("broadsheet_rapier_player_state")).toBeNull();
  });
});
