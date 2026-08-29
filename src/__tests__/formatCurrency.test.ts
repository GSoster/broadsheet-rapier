import { describe, expect, it } from "vitest";
import i18n from "../engine/i18n";
import { formatCurrencyAbbreviated, formatCurrencyDelta } from "../engine/i18n/formatCurrency";
import { initialPlayerState } from "../engine/store/playerStore";

// Uses the REAL i18next instance (src/engine/i18n/index.ts), not a stub —
// this is the explicit environment check docs/features/feature_localization.md
// calls for: confirming i18next/react-i18next's plural-rules engine
// actually behaves correctly under Vitest's jsdom environment, not assumed
// from local dev-server behavior alone.
const tEn = i18n.getFixedT("en");
const tPtBR = i18n.getFixedT("pt-BR");

describe("formatCurrencyDelta", () => {
  it("formats a positive delta with a leading +", () => {
    expect(formatCurrencyDelta(60, tEn)).toBe("+3 Silver Coins");
  });

  it("formats a negative delta with a leading -, using the absolute magnitude", () => {
    expect(formatCurrencyDelta(-60, tEn)).toBe("-3 Silver Coins");
  });

  it("breaks a compound delta down across denominations", () => {
    expect(formatCurrencyDelta(424, tEn)).toBe("+1 Gold Coin, 1 Silver Coin, 4 Bronze Coins");
  });

  it("omits zero denominations from the breakdown", () => {
    expect(formatCurrencyDelta(1, tEn)).toBe("+1 Bronze Coin");
  });

  // The concrete proof i18next was chosen over a hand-rolled t(): real
  // Portuguese singular/plural forms at 0/1/2+ quantities, routed through
  // i18next's count-based interpolation (`currency.gold_one`/`_other`),
  // not a naive `${count} ${t('gold')}` concatenation that would render the
  // same word regardless of count.
  describe("Portuguese (pt-BR) plural forms", () => {
    it("uses the singular form at exactly 1", () => {
      expect(formatCurrencyDelta(1, tPtBR)).toBe("+1 Moeda de Bronze");
    });

    it("uses the plural form at 2+", () => {
      expect(formatCurrencyDelta(2, tPtBR)).toBe("+2 Moedas de Bronze");
    });

    it("uses the plural form across all three denominations in a compound delta", () => {
      expect(formatCurrencyDelta(424, tPtBR)).toBe("+1 Moeda de Ouro, 1 Moeda de Prata, 4 Moedas de Bronze");
    });

    it("a zero-magnitude denomination is omitted, never rendered as a 'zero' plural form", () => {
      // 20 bronze-equivalent = 1 silver, 0 bronze — bronze must not appear
      // at all, not as "0 Moedas de Bronze".
      expect(formatCurrencyDelta(20, tPtBR)).toBe("+1 Moeda de Prata");
    });
  });
});

describe("formatCurrencyAbbreviated", () => {
  it("formats each denomination with its locale-specific abbreviation (en)", () => {
    const currencies = { ...initialPlayerState.currencies, gold: 1, silver: 2, bronze: 3 };
    expect(formatCurrencyAbbreviated(currencies, tEn)).toBe("1g 2s 3b");
  });

  it("formats each denomination with its locale-specific abbreviation (pt-BR)", () => {
    const currencies = { ...initialPlayerState.currencies, gold: 1, silver: 2, bronze: 3 };
    expect(formatCurrencyAbbreviated(currencies, tPtBR)).toBe("1o 2p 3b");
  });
});
