import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePlayerStore } from "../../store/playerStore";
import { currenciesToBronzeEquivalent } from "../../store/commands";
import { minigameResolvers } from "../../minigames";
import { clampWager, maxAffordableWager, MIN_WAGER, WAGER_STEP, type DiceRollResult } from "../../minigames/dice";

export interface DiceGameProps {
  sourceId: string;
  /** Injectable random source for deterministic tests; defaults to Math.random. */
  random?: () => number;
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

export function DiceGame({ sourceId, random }: DiceGameProps) {
  const currencies = usePlayerStore((state) => state.currencies);
  const activeMinigame = usePlayerStore((state) => state.activeMinigame);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);

  const [phase, setPhase] = useState<"betting" | "rolling" | "result">("betting");
  const [rollResult, setRollResult] = useState<DiceRollResult | null>(null);

  const maxWager = maxAffordableWager(currenciesToBronzeEquivalent(currencies));
  const canAffordMinimum = maxWager >= MIN_WAGER;
  const wager = clampWager(
    (activeMinigame?.config.wager as number | undefined) ?? 20,
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
          { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "bronze", amount: clamped } },
        ],
        onFailureCommands: [
          { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "bronze", amount: -clamped } },
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
      <p className="text-xs uppercase tracking-wide text-amber-200">Dice — Even Wins, Odd Loses</p>

      <div className="flex gap-4">
        <Die value={phase === "result" && rollResult ? rollResult.dice[0] : null} rolling={phase === "rolling"} />
        <Die value={phase === "result" && rollResult ? rollResult.dice[1] : null} rolling={phase === "rolling"} />
      </div>

      {phase === "result" && rollResult ? (
        <div className="text-center">
          <p className={`text-lg font-semibold ${rollResult.isVictory ? "text-emerald-300" : "text-red-300"}`}>
            {rollResult.isVictory ? `You win ${wager} bronze!` : `You lose ${wager} bronze.`}
          </p>
          <p className="text-xs text-amber-200">Rolled {rollResult.sum}</p>
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
          <span className="w-28 text-center text-sm text-amber-100">{wager} bronze wager</span>
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

      <p className="text-xs text-amber-300">
        Balance: {currencies.gold}g {currencies.silver}s {currencies.bronze}b
      </p>

      {phase === "result" ? (
        <button
          type="button"
          onClick={collect}
          className="rounded border border-amber-600 bg-amber-900/60 px-4 py-2 text-sm uppercase tracking-wide text-amber-100 hover:bg-amber-800/60"
        >
          Collect
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={throwDice}
            disabled={!canAffordMinimum || phase === "rolling"}
            className="rounded border border-amber-600 bg-amber-900/60 px-4 py-2 text-sm uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-amber-800/60"
          >
            {canAffordMinimum ? "Throw" : "Not enough coin"}
          </button>
          <button
            type="button"
            onClick={leave}
            disabled={phase === "rolling"}
            className="rounded border border-amber-800 px-4 py-2 text-sm uppercase tracking-wide text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-500 enabled:hover:text-amber-100"
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
