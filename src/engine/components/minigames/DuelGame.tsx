import { useState } from "react";
import { motion } from "framer-motion";
import { usePlayerStore } from "../../store/playerStore";
import { minigameResolvers } from "../../minigames";
import {
  ACTION_LABELS,
  chooseOpponentAction,
  PLAYER_STARTING_ENERGY,
  PLAYER_STARTING_POISE,
  type CombatantState,
  type DistanceState,
  type DuelAction,
  type DuelContext,
  type DuelOutcome,
} from "../../minigames/duel";
import { selectModifiers, type ModifierSet } from "../../modifiers";
import { playSound } from "../../audio/playSound";
import { Tooltip } from "../Tooltip";

const WIN_SOUND_ASSET = "/content/assets/audio/duel_win.mp3";
const LOSE_SOUND_ASSET = "/content/assets/audio/duel_lose.mp3";

const RESOLVE_DELAY_MS = 500;

// Button order — labels come from the shared ACTION_LABELS map (duel.ts) so
// the buttons and the duel log never drift into two different names for the
// same action.
const ACTIONS: DuelAction[] = ["THRUST", "PARRY_RIPOSTE", "FEINT", "TAUNT", "DIRTY_TRICK"];

// Player-facing explanations, kept here rather than in duel.ts: ACTION_LABELS
// is short display text the log itself renders (engine-adjacent), this is
// longer descriptive copy only ever shown in a UI tooltip.
const ACTION_DESCRIPTIONS: Record<DuelAction, string> = {
  THRUST: "A direct strike — only works In Measure. Deals energy damage, more if the opponent's guard is already broken. Parried, it costs you energy instead.",
  PARRY_RIPOSTE: "Holds your guard. Blocks and counters an incoming Thrust or Dirty Trick for energy damage. Does nothing if the opponent doesn't attack.",
  FEINT: "Drains the opponent's poise and closes the distance one step. Safe to use at any range.",
  TAUNT: "Drains the opponent's poise from any range — more if your standing with the Wagering Ring is high enough.",
  DIRTY_TRICK: "An underhanded strike — only works at Close Quarters. Deals energy damage and extra poise drain, more if the opponent's guard is already broken.",
};

const DISTANCE_DESCRIPTIONS: Record<DistanceState, string> = {
  OUT_OF_MEASURE: "Too far apart for Thrust or Dirty Trick. Feint to close the distance.",
  IN_MEASURE: "Close enough for Thrust. Still too far for a Dirty Trick — Feint again to reach Close Quarters.",
  CLOSE_QUARTERS: "Close enough for a Dirty Trick. Too close for Thrust to connect.",
};

// Actions where the PLAYER deals damage to the opponent — the exact set
// wired to DUEL_DAMAGE_DEALT in duel.ts (THRUST/DIRTY_TRICK's own hit, and a
// successful PARRY_RIPOSTE's counter-damage).
const DAMAGE_DEALING_ACTIONS: ReadonlySet<DuelAction> = new Set(["THRUST", "DIRTY_TRICK", "PARRY_RIPOSTE"]);

// Stage 3 of the modifier rollout (docs/features/feature_modifier_system.md
// §2.9): surfaces active DUEL_DAMAGE_DEALT modifiers in the action tooltip,
// rather than leaving an equipped-feeling bonus invisible to the player.
function describeDamageModifiers(modifiers: ModifierSet): string {
  const matching = selectModifiers(modifiers, "DUEL_DAMAGE_DEALT");
  if (matching.length === 0) return "";
  const parts = matching.map((m) => {
    const magnitude = m.op === "FLAT" ? `${m.value >= 0 ? "+" : ""}${m.value}` : `${m.value >= 0 ? "+" : ""}${Math.round(m.value * 100)}%`;
    return `${magnitude} from ${m.sourceLabel}`;
  });
  return ` Damage bonus: ${parts.join(", ")}.`;
}

function describeAction(action: DuelAction, modifiers: ModifierSet): string {
  const base = ACTION_DESCRIPTIONS[action];
  return DAMAGE_DEALING_ACTIONS.has(action) ? base + describeDamageModifiers(modifiers) : base;
}

const ENERGY_DESCRIPTION = "Health for this duel. Reaches 0 and that side loses.";
const POISE_DESCRIPTION =
  "Guard. Once it reaches 0, the next Thrust or Dirty Trick that lands against that side deals bonus damage.";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest-first so "Parry & Riposte" matches whole, not a partial overlap
// with a shorter label — not actually reachable with today's five labels
// (none is a substring of another), but cheap insurance against it becoming
// true if a future action's label is.
const ACTION_LABEL_PATTERN = new RegExp(
  `(${Object.values(ACTION_LABELS)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})`,
  "g"
);

// Bolds any duel-action name appearing in a log line (e.g. "Your Thrust
// lands for 15 energy.") without duel.ts needing to know anything about
// presentation — it only ever emits plain strings.
function renderLogEntry(entry: string): Array<string | { bold: string }> {
  return entry.split(ACTION_LABEL_PATTERN).map((part) => (Object.values(ACTION_LABELS).includes(part) ? { bold: part } : part));
}

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
  const activeModifiers = usePlayerStore((state) => state.activeModifiers);
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
  // Default true — every DUEL authored before this field existed keeps
  // Fleeing available; a story-critical duel with no way back in once fled
  // authors this false instead (see DuelConfig's comment, docs/decisions.md).
  const allowFlee = config?.allowFlee ?? true;

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
        modifiers: activeModifiers,
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
          <p>
            Energy: {player.energy}{" "}
            <Tooltip label={ENERGY_DESCRIPTION}>
              <span aria-label="What is Energy?" className="cursor-help text-stone-500">
                (?)
              </span>
            </Tooltip>
          </p>
          <p>
            Poise: {player.poise}{" "}
            <Tooltip label={POISE_DESCRIPTION}>
              <span aria-label="What is Poise?" className="cursor-help text-stone-500">
                (?)
              </span>
            </Tooltip>
          </p>
        </div>
        <Tooltip label={DISTANCE_DESCRIPTIONS[distance]} className="flex-none">
          <motion.div
            animate={phase === "resolving" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={{ duration: RESOLVE_DELAY_MS / 1000, ease: "easeInOut" }}
            className="flex cursor-help items-center text-xs uppercase tracking-wide text-stone-400"
          >
            {distance.replace(/_/g, " ")}
          </motion.div>
        </Tooltip>
        <div className="flex-1 text-right text-sm text-stone-200">
          <p>{opponentName}</p>
          <p>
            Energy: {opponent.energy}{" "}
            <Tooltip label={ENERGY_DESCRIPTION}>
              <span aria-label="What is Energy?" className="cursor-help text-stone-500">
                (?)
              </span>
            </Tooltip>
          </p>
          <p>
            Poise: {opponent.poise}{" "}
            <Tooltip label={POISE_DESCRIPTION}>
              <span aria-label="What is Poise?" className="cursor-help text-stone-500">
                (?)
              </span>
            </Tooltip>
          </p>
        </div>
      </div>

      <div className="h-24 overflow-y-auto rounded border border-stone-700 bg-stone-900/60 p-2 text-xs text-stone-300">
        {log.length === 0 ? (
          <p className="text-stone-500">The duel begins.</p>
        ) : (
          log.map((entry, i) => (
            <p key={i}>
              {renderLogEntry(entry).map((part, j) =>
                typeof part === "string" ? part : <strong key={j}>{part.bold}</strong>
              )}
            </p>
          ))
        )}
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
            {ACTIONS.map((action) => {
              const legal = isActionLegal(action, distance);
              return (
                <Tooltip key={action} label={describeAction(action, activeModifiers)} className="w-full">
                  <button
                    type="button"
                    onClick={() => chooseAction(action)}
                    disabled={phase !== "choosing" || !legal}
                    className="w-full rounded border border-stone-600 bg-stone-800/60 px-3 py-2 text-xs uppercase tracking-wide text-stone-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-stone-700/60"
                  >
                    {ACTION_LABELS[action]}
                  </button>
                </Tooltip>
              );
            })}
          </div>
          {allowFlee ? (
            <button
              type="button"
              onClick={flee}
              disabled={phase === "resolving"}
              className="rounded border border-stone-800 px-4 py-2 text-sm uppercase tracking-wide text-stone-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-stone-500 enabled:hover:text-stone-100"
            >
              Flee
            </button>
          ) : (
            <p className="text-center text-xs uppercase tracking-wide text-stone-600">There's no retreat from this duel.</p>
          )}
        </>
      )}
    </div>
  );
}
