// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LanguageSelector } from "../../engine/components/LanguageSelector";
import { useLocaleStore } from "../../engine/store/localeStore";
import i18n from "../../engine/i18n";

beforeEach(() => {
  localStorage.clear();
  useLocaleStore.setState({ locale: "en" });
});

describe("LanguageSelector", () => {
  it("the closed control shows the current locale's flag and name", () => {
    render(<LanguageSelector />);
    const button = screen.getByRole("button", { expanded: false });
    expect(within(button).getByRole("img", { name: "United States flag" })).toBeInTheDocument();
    expect(within(button).getByText("English")).toBeInTheDocument();
    // The dropdown list isn't rendered at all until opened.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opening the list shows a flag icon next to EVERY option, not just the closed control — the reason this is a custom listbox instead of a native <select>", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByRole("img", { name: "United States flag" })).toBeInTheDocument();
    expect(within(listbox).getByRole("img", { name: "Brazil flag" })).toBeInTheDocument();
    expect(within(listbox).getByText("English")).toBeInTheDocument();
    expect(within(listbox).getByText("Português (Brasil)")).toBeInTheDocument();
  });

  it("selecting an option updates useLocaleStore, closes the list, and updates the closed control's flag", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("option", { name: /Português/ }));

    expect(useLocaleStore.getState().locale).toBe("pt-BR");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { expanded: false });
    expect(within(button).getByRole("img", { name: "Brazil flag" })).toBeInTheDocument();
  });

  it("pressing Escape while open closes the list without changing the locale", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(useLocaleStore.getState().locale).toBe("en");
  });

  it("clicking outside the control while open closes the list", () => {
    render(
      <div>
        <LanguageSelector />
        <button type="button">elsewhere</button>
      </div>
    );
    // The toggle button's accessible name is its aria-label ("Language"),
    // not the visible locale text inside it.
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("switching locale updates i18next's active language once App.tsx's effect would run — confirmed here by driving i18n directly, the same call App.tsx's useEffect makes", async () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("option", { name: /Português/ }));
    await i18n.changeLanguage(useLocaleStore.getState().locale);
    expect(i18n.language).toBe("pt-BR");
    expect(i18n.t("common.close")).toBe("Fechar");
    await i18n.changeLanguage("en");
  });
});
