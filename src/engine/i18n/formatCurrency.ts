import type { TFunction } from "i18next";
import type { PlayerState } from "../types";
import { bronzeEquivalentToCurrencies } from "../store/commands";

// Unified currency formatting — previously three independent hardcoded
// implementations (WorldClockHud.tsx, DiceGame.tsx, notifications.ts's
// formatCurrencyDelta), each spelling out "Gold"/"Silver"/"Bronze" or their
// abbreviations separately. Consolidated here so translating currency
// vocabulary happens once, not three times with a risk of drifting apart.
// See docs/features/feature_localization.md.

// Compact inline form (HUD, dice wager/balance): "{{n}}{{abbr}}" per
// denomination, e.g. "3g 1s 12b" / "3o 1p 12b" in pt-BR.
export function formatCurrencyAbbreviated(currencies: PlayerState["currencies"], t: TFunction): string {
  return [
    `${currencies.gold}${t("currency.goldAbbr")}`,
    `${currencies.silver}${t("currency.silverAbbr")}`,
    `${currencies.bronze}${t("currency.bronzeAbbr")}`,
  ].join(" ");
}

// Signed, pluralized breakdown for notifications (e.g. "+3 Gold Coins, 1
// Silver Coin") from a raw signed bronze-equivalent delta — mirrors the
// original formatCurrencyDelta this replaces (notifications.ts), now
// routing each nonzero denomination through i18next's count-based
// interpolation (`currency.gold_one`/`_other` etc.) so plural forms are
// correct per locale, not just English's invariant "Gold".
export function formatCurrencyDelta(deltaBronze: number, t: TFunction): string {
  const sign = deltaBronze > 0 ? "+" : "-";
  const breakdown = bronzeEquivalentToCurrencies(Math.abs(deltaBronze));
  const parts: string[] = [];
  if (breakdown.gold > 0) parts.push(t("currency.gold", { count: breakdown.gold }));
  if (breakdown.silver > 0) parts.push(t("currency.silver", { count: breakdown.silver }));
  if (breakdown.bronze > 0) parts.push(t("currency.bronze", { count: breakdown.bronze }));
  return `${sign}${parts.join(", ")}`;
}
