// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageSelector } from "../../engine/components/LanguageSelector";
import { useLocaleStore } from "../../engine/store/localeStore";
import i18n from "../../engine/i18n";

beforeEach(() => {
  localStorage.clear();
  useLocaleStore.setState({ locale: "en" });
});

describe("LanguageSelector", () => {
  it("renders both locale options, with the store's current locale selected", () => {
    render(<LanguageSelector />);
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Português (Brasil)")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("en");
  });

  it("selecting a language updates useLocaleStore", () => {
    render(<LanguageSelector />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pt-BR" } });
    expect(useLocaleStore.getState().locale).toBe("pt-BR");
  });

  it("switching locale updates i18next's active language once App.tsx's effect would run — confirmed here by driving i18n directly, the same call App.tsx's useEffect makes", async () => {
    render(<LanguageSelector />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pt-BR" } });
    await i18n.changeLanguage(useLocaleStore.getState().locale);
    expect(i18n.language).toBe("pt-BR");
    expect(i18n.t("common.close")).toBe("Fechar");
    await i18n.changeLanguage("en");
  });
});
