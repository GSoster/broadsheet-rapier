import { useState } from "react";
import { motion } from "framer-motion";
import { usePlayerStore } from "../../store/playerStore";
import { minigameResolvers } from "../../minigames";
import {
  chooseOpponentAction,
  PLAYER_STARTING_ENERGY,
  PLAYER_STARTING_POISE,
  type CombatantState,
  type DistanceState,
  type DuelAction,
  type DuelContext,
  type DuelOutcome,
} from "../../minigames/duel";
import { playSound } from "../../audio/playSound";

const WIN_SOUND_ASSET = "/content/assets/audio/duel_win.mp3";
const LOSE_SOUND_ASSET = "/content/assets/audio/duel_lose.mp3";

const RESOLVE_DELAY_MS = 500;

const ACTIONS: Array<{ action: DuelAction; label: string }> = [
  { action: "THRUST", label: "Thrust" },
  { action: "PARRY_RIPOSTE", label: "Parry & Riposte" },
  { action: "FEINT", label: "Feint" },
  { action: "TAUNT", label: "Taunt" },
  { action: "DIRTY_TRICK", label: "Dirty Trick" },
];

function isActionLegal(action: DuelAction, distance: DistanceState): boolean {
  if (action === "THRUST") return distance === "IN_MEASURE";
  if (action === "DIRTY_TRICK") return distance === "CLOSE_QUARTERS";
  return true;
}

export interface DuelGameProps {
  sourceId: string;
  /** Injectable random source for deterministic tests; defaults to Math.random. */
  random?: () => number;
  /** Injectable sound player for deterministic tests; defaults to the shared playSound utility. */
  playSound?: (src: string) => void;
}

export function DuelGame({ random, playSound: playSoundProp = playSound }: DuelGameProps) {
  const reputation = usePlayerStore((state) => state.reputation);
  const activeMinigame = usePlayerStore((state) => state.activeMinigame);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);

  const config = activeMinigame?.type === "DUEL" ? activeMinigame.config : undefined;

  const [phase, setPhase] = useState<"choosing" | "resolving" | "result">("choosing");
  const [player, setPlayer] = useState<CombatantState>({
    energy: PLAYER_STARTING_ENERGY,
    poise: PLAYER_STARTING_POISE,
  });
  const [opponent, setOpponent] = useState<CombatantState>({
    energy: config?.opponentStartingEnergy ?? 0,
    poise: config?.opponentStartingPoise ?? 0,
  });
  const [distance, setDistance] = useState<DistanceState>(config?.startingDistance ?? "OUT_OF_MEASURE");
  const [lastPlayerAction, setLastPlayerAction] = useState<DuelAction | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<DuelOutcome>("ONGOING");

  const opponentName = config?.opponentName ?? "Opponent";

  const chooseAction = (playerAction: DuelAction) => {
    if (phase !== "choosing" || !isActionLegal(playerAction, distance)) return;
    setPhase("resolving");
    window.setTimeout(() => {
      const context: DuelContext = {
        player,
        opponent,
        distance,
        lastPlayerAction,
        playerReputation: reputation,
      };
      const opponentAction = chooseOpponentAction(context, random);
      const result = minigameResolvers.DUEL(context, playerAction, opponentAction);

      setPlayer(result.player);
      setOpponent(result.opponent);
      setDistance(result.distance);
      setLastPlayerAction(playerAction);
      setLog((prev) => [...prev, ...result.log]);
      setOutcome(result.outcome);

      if (result.outcome !== "ONGOING") {
        playSoundProp(result.outcome === "PLAYER_VICTORY" ? WIN_SOUND_ASSET : LOSE_SOUND_ASSET);
        setPhase("result");
      } else {
        setPhase("choosing");
      }
    }, RESOLVE_DELAY_MS);
  };

  const collect = () => {
    dispatchCommand({
      type: "COMMAND_RESOLVE_MINIGAME",
      payload: { isVictory: outcome === "PLAYER_VICTORY" },
    });
  };

  const flee = () => {
    dispatchCommand({ type: "COMMAND_CANCEL_MINIGAME", payload: {} });
  };

  return (
    <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg border-4 border-stone-700 bg-gradient-to-b from-stone-800 to-stone-950 p-6 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-stone-300">Rapier Duel — {opponentName}</p>

      <div className="flex justify-between gap-4">
        <div className="flex-1 text-sm text-stone-200">
          <p>You</p>
          <p>Energy: {player.energy}</p>
          <p>Poise: {player.poise}</p>
        </div>
        <motion.div
          animate={phase === "resolving" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{ duration: RESOLVE_DELAY_MS / 1000, ease: "easeInOut" }}
          className="flex items-center text-xs uppercase tracking-wide text-stone-400"
        >
          {distance.replace(/_/g, " ")}
        </motion.div>
        <div className="flex-1 text-right text-sm text-stone-200">
          <p>{opponentName}</p>
          <p>Energy: {opponent.energy}</p>
          <p>Poise: {opponent.poise}</p>
        </div>
      </div>

      <div className="h-24 overflow-y-auto rounded border border-stone-700 bg-stone-900/60 p-2 text-xs text-stone-300">
        {log.length === 0 ? <p className="text-stone-500">The duel begins.</p> : log.map((entry, i) => <p key={i}>{entry}</p>)}
      </div>

      {phase === "result" ? (
        <div className="text-center">
          <p className={`text-lg font-semibold ${outcome === "PLAYER_VICTORY" ? "text-emerald-300" : "text-red-300"}`}>
            {outcome === "PLAYER_VICTORY" ? "Victory!" : "Defeated."}
          </p>
          <button
            type="button"
            onClick={collect}
            className="mt-3 rounded border border-stone-500 bg-stone-800/60 px-4 py-2 text-sm uppercase tracking-wide text-stone-100 hover:bg-stone-700/60"
          >
            Collect
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map(({ action, label }) => {
              const legal = isActionLegal(action, distance);
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => chooseAction(action)}
                  disabled={phase !== "choosing" || !legal}
                  className="rounded border border-stone-600 bg-stone-800/60 px-3 py-2 text-xs uppercase tracking-wide text-stone-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-stone-700/60"
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={flee}
            disabled={phase === "resolving"}
            className="rounded border border-stone-800 px-4 py-2 text-sm uppercase tracking-wide text-stone-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-stone-500 enabled:hover:text-stone-100"
          >
            Flee
          </button>
        </>
      )}
    </div>
  );
}
