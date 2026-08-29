import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { usePlayerStore } from "../../store/playerStore";
import { currenciesToBronzeEquivalent } from "../../store/commands";
import { minigameResolvers } from "../../minigames";
import { clampWager, maxAffordableWager, MIN_WAGER, WAGER_STEP, type DiceRollResult } from "../../minigames/dice";
import { playSound } from "../../audio/playSound";
import { formatCurrencyAbbreviated } from "../../i18n/formatCurrency";

const WIN_SOUND_ASSET = "/content/assets/audio/dice_win.mp3";
const LOSE_SOUND_ASSET = "/content/assets/audio/dice_lose.mp3";

export interface DiceGameProps {
  sourceId: string;
  /** Injectable random source for deterministic tests; defaults to Math.random. */
  random?: () => number;
  /** Injectable sound player for deterministic tests; defaults to the shared playSound utility. */
  playSound?: (src: string) => void;
}

const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [25, 25],
    [75, 75],
  ],
  3: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  4: [
    [25, 25],
    [25, 75],
    [75, 25],
    [75, 75],
  ],
  5: [
    [25, 25],
    [25, 75],
    [50, 50],
    [75, 25],
    [75, 75],
  ],
  6: [
    [25, 25],
    [25, 50],
    [25, 75],
    [75, 25],
    [75, 50],
    [75, 75],
  ],
};

function Die({ value, rolling }: { value: number | null; rolling: boolean }) {
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 1, 1.1, 1] } : { rotate: 0, scale: 1 }}
      transition={rolling ? { duration: 0.7, ease: "easeInOut" } : { duration: 0.15 }}
      className="relative h-16 w-16 rounded-lg border-2 border-stone-400 bg-stone-50 shadow-inner"
    >
      {value !== null
        ? PIP_LAYOUTS[value].map(([x, y], i) => (
            <span
              key={i}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-900"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))
        : null}
    </motion.div>
  );
}

export function DiceGame({ sourceId, random, playSound: playSoundProp = playSound }: DiceGameProps) {
  const { t } = useTranslation();
  const currencies = usePlayerStore((state) => state.currencies);
  const activeMinigame = usePlayerStore((state) => state.activeMinigame);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);

  const [phase, setPhase] = useState<"betting" | "rolling" | "result">("betting");
  const [rollResult, setRollResult] = useState<DiceRollResult | null>(null);

  const maxWager = maxAffordableWager(currenciesToBronzeEquivalent(currencies));
  const canAffordMinimum = maxWager >= MIN_WAGER;
  const wager = clampWager(
    (activeMinigame?.type === "DICE" ? activeMinigame.config.wager : undefined) ?? 20,
    currenciesToBronzeEquivalent(currencies)
  );

  const setWager = (nextWager: number) => {
    const clamped = clampWager(nextWager, currenciesToBronzeEquivalent(currencies));
    dispatchCommand({
      type: "COMMAND_START_MINIGAME",
      payload: {
        type: "DICE",
        sourceId,
        config: { wager: clamped },
        onSuccessCommands: [
          {
            type: "COMMAND_ADJUST_CURRENCY",
            // Overrides the sign-derived CURRENCY_GAIN key — an item's
            // currency bonus would otherwise make dice's even-odds throw
            // positive-EV (docs/features/feature_modifier_system.md §2.8).
            // No item is authored against this key, so it's inert today.
            payload: { denomination: "bronze", amount: clamped, modifierKey: "CURRENCY_GAMBLING_WINNINGS" },
          },
        ],
        onFailureCommands: [
          {
            type: "COMMAND_ADJUST_CURRENCY",
            payload: { denomination: "bronze", amount: -clamped, modifierKey: "CURRENCY_GAMBLING_WINNINGS" },
          },
        ],
      },
    });
  };

  // Ensure activeMinigame carries this component's own onSuccess/onFailure
  // commands (baked with the current wager) even if it mounted without one —
  // e.g. a future caller that opens the modal before dispatching
  // COMMAND_START_MINIGAME itself. The Gamble action normally dispatches it
  // first, so in practice this is a defensive sync, not the primary path.
  useEffect(() => {
    if (activeMinigame?.type !== "DICE") {
      setWager(wager);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const throwDice = () => {
    if (phase !== "betting" || !canAffordMinimum) return;
    setPhase("rolling");
    window.setTimeout(() => {
      const result = minigameResolvers.DICE(wager, random);
      setRollResult(result);
      playSoundProp(result.isVictory ? WIN_SOUND_ASSET : LOSE_SOUND_ASSET);
      setPhase("result");
    }, 700);
  };

  const collect = () => {
    if (!rollResult) return;
    dispatchCommand({ type: "COMMAND_RESOLVE_MINIGAME", payload: { isVictory: rollResult.isVictory } });
    setPhase("betting");
    setRollResult(null);
  };

  const leave = () => {
    dispatchCommand({ type: "COMMAND_CANCEL_MINIGAME", payload: {} });
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border-4 border-amber-900 bg-gradient-to-b from-amber-800 to-amber-950 p-6 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-amber-200">{t("dice.header")}</p>

      <div className="flex gap-4">
        <Die value={phase === "result" && rollResult ? rollResult.dice[0] : null} rolling={phase === "rolling"} />
        <Die value={phase === "result" && rollResult ? rollResult.dice[1] : null} rolling={phase === "rolling"} />
      </div>

      {phase === "result" && rollResult ? (
        <div className="text-center">
          <p className={`text-lg font-semibold ${rollResult.isVictory ? "text-emerald-300" : "text-red-300"}`}>
            {rollResult.isVictory ? t("dice.win", { wager }) : t("dice.lose", { wager })}
          </p>
          <p className="text-xs text-amber-200">
            {t("dice.rolled", { sum: rollResult.sum, parity: rollResult.sum % 2 === 0 ? t("dice.even") : t("dice.odd") })}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWager(wager - WAGER_STEP)}
            disabled={phase !== "betting" || wager <= MIN_WAGER}
            className="h-8 w-8 rounded border border-amber-600 text-amber-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-300"
          >
            −
          </button>
          <span className="w-28 text-center text-sm text-amber-100">{t("dice.wager", { wager })}</span>
          <button
            type="button"
            onClick={() => setWager(wager + WAGER_STEP)}
            disabled={phase !== "betting" || wager >= maxWager}
            className="h-8 w-8 rounded border border-amber-600 text-amber-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-300"
          >
            +
          </button>
        </div>
      )}

      <p className="text-xs text-amber-300">{t("currency.balance", { amounts: formatCurrencyAbbreviated(currencies, t) })}</p>

      {phase === "result" && rollResult ? (
        <button
          type="button"
          onClick={collect}
          className="rounded border border-amber-600 bg-amber-900/60 px-4 py-2 text-sm uppercase tracking-wide text-amber-100 hover:bg-amber-800/60"
        >
          {rollResult.isVictory ? t("dice.collect") : t("dice.continueLabel")}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={throwDice}
            disabled={!canAffordMinimum || phase === "rolling"}
            className="rounded border border-amber-600 bg-amber-900/60 px-4 py-2 text-sm uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-amber-800/60"
          >
            {canAffordMinimum ? t("dice.throwLabel") : t("dice.notEnoughCoin")}
          </button>
          <button
            type="button"
            onClick={leave}
            disabled={phase === "rolling"}
            className="rounded border border-amber-800 px-4 py-2 text-sm uppercase tracking-wide text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-500 enabled:hover:text-amber-100"
          >
            {t("dice.leave")}
          </button>
        </div>
      )}
    </div>
  );
}
