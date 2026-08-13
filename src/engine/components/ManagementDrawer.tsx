import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../store/playerStore";
import { AssetFallback } from "./AssetFallback";
import { SEASONS, SHIFTS, WEATHERS } from "../types";

function cycleNext<T extends string>(options: readonly T[], current: T): T {
  const index = options.indexOf(current);
  return options[(index + 1) % options.length];
}

// Content-derived display data, not the Item content type itself —
// src/engine/ never imports src/content/ directly (web-implementation.md
// §3); App.tsx resolves the full Item and passes down only what this
// component needs to render, same pattern as NodeInteractionCanvas's
// `actors` prop.
export interface ItemDisplayData {
  name: string;
  description: string;
  imageAsset: string;
}

// Same content-derived-props pattern as ItemDisplayData, but this is the
// *full* roster (every actor) — met-status filtering happens in this
// component against the live `dialogueProgress` store slice, not here,
// mirroring the Inventory tab's existing split (items = content shape,
// inventory = store state, combined at render time).
export interface RosterEntryData {
  id: string;
  name: string;
  title: string;
  description: string;
  imageAsset?: string;
  factionNames: string[];
  dialogueId: string;
}

type ManagementTab = "CASE_BOARD" | "ENDEAVORS" | "INVENTORY" | "ROSTER";

const TABS: Array<{ id: ManagementTab; label: string }> = [
  { id: "CASE_BOARD", label: "Case Board" },
  { id: "ENDEAVORS", label: "Endeavors" },
  { id: "INVENTORY", label: "Inventory" },
  { id: "ROSTER", label: "Roster" },
];

export interface ManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  endeavorTitles: Record<string, string>;
  // endeavorId -> phaseId -> that phase's authored objectiveText, so the
  // Endeavors tab can show prose ("Someone paid good silver to keep that
  // press silent...") instead of the raw content id (`phase_confront_the_buyer`).
  // Content-derived, same pattern as endeavorTitles/items/roster.
  phaseObjectives: Record<string, Record<string, string>>;
  // endeavorId -> phaseId -> whether that phase is terminal (no
  // nextPhaseOnSuccess) — the same "reaching it is the representation of
  // completion" rule the notification system's Endeavor-completion effect
  // already uses (web-implementation.md §3/§10). Content-derived; lets the
  // Endeavors tab split active from completed without importing content
  // itself.
  phaseIsTerminal: Record<string, Record<string, boolean>>;
  items: Record<string, ItemDisplayData>;
  roster: RosterEntryData[];
}

export function ManagementDrawer({
  isOpen,
  onClose,
  endeavorTitles,
  phaseObjectives,
  phaseIsTerminal,
  items,
  roster,
}: ManagementDrawerProps) {
  const [tab, setTab] = useState<ManagementTab>("CASE_BOARD");
  const [isConfirmingReset, setConfirmingReset] = useState(false);
  const unlockedClues = usePlayerStore((state) => state.unlockedClues);
  const activeEndeavors = usePlayerStore((state) => state.activeEndeavors);
  const inventory = usePlayerStore((state) => state.inventory);
  const resetProgress = usePlayerStore((state) => state.resetProgress);
  const worldClock = usePlayerStore((state) => state.worldClock);
  const devSetWorldClock = usePlayerStore((state) => state.devSetWorldClock);
  const dialogueProgress = usePlayerStore((state) => state.dialogueProgress);
  const metRoster = roster.filter((entry) => dialogueProgress[entry.dialogueId] !== undefined);

  const activeEndeavorEntries = Object.entries(activeEndeavors);
  const completedEndeavors = activeEndeavorEntries.filter(
    ([endeavorId, endeavor]) => phaseIsTerminal[endeavorId]?.[endeavor.currentPhaseId] === true
  );
  const ongoingEndeavors = activeEndeavorEntries.filter(
    ([endeavorId, endeavor]) => phaseIsTerminal[endeavorId]?.[endeavor.currentPhaseId] !== true
  );

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.2 }}
          className="fixed inset-y-0 right-0 z-50 flex w-[30rem] flex-col border-l border-indigo-900 bg-neutral-950 text-indigo-100"
        >
          <div className="flex items-center justify-between border-b border-indigo-900 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Journal</h2>
            <button type="button" onClick={onClose} className="text-indigo-400 hover:text-indigo-100">
              Close
            </button>
          </div>
          <nav className="flex border-b border-indigo-900 text-xs">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 px-3 py-2 uppercase tracking-wide ${
                  tab === id ? "bg-indigo-900/60 text-indigo-100" : "text-indigo-400 hover:text-indigo-200"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {tab === "CASE_BOARD" ? (
              unlockedClues.length ? (
                <ul className="flex flex-col gap-2">
                  {unlockedClues.map((clueId) => (
                    <li key={clueId}>{clueId}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-indigo-400">No clues gathered yet.</p>
              )
            ) : null}
            {tab === "ENDEAVORS" ? (
              Object.keys(activeEndeavors).length ? (
                <div className="flex flex-col gap-4">
                  {ongoingEndeavors.length ? (
                    <ul className="flex flex-col gap-3">
                      {ongoingEndeavors.map(([endeavorId, endeavor]) => (
                        <li key={endeavorId}>
                          <p className="font-medium">{endeavorTitles[endeavorId] ?? endeavorId}</p>
                          <p className="text-indigo-400">
                            {phaseObjectives[endeavorId]?.[endeavor.currentPhaseId] ?? endeavor.currentPhaseId}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-indigo-400">No active endeavors right now.</p>
                  )}
                  {completedEndeavors.length ? (
                    <div className="border-t border-indigo-900 pt-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-indigo-500">Completed</p>
                      <ul className="flex flex-col gap-3 opacity-60">
                        {completedEndeavors.map(([endeavorId, endeavor]) => (
                          <li key={endeavorId}>
                            <p className="font-medium">✓ {endeavorTitles[endeavorId] ?? endeavorId}</p>
                            <p className="text-indigo-400">
                              {phaseObjectives[endeavorId]?.[endeavor.currentPhaseId] ?? endeavor.currentPhaseId}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-indigo-400">No active endeavors.</p>
              )
            ) : null}
            {tab === "INVENTORY" ? (
              inventory.length ? (
                <ul className="flex flex-col gap-3">
                  {inventory.map((item) => {
                    const itemData = items[item.itemId];
                    return (
                      <li key={item.itemId} className="flex gap-3">
                        {itemData ? (
                          <>
                            <AssetFallback
                              src={itemData.imageAsset}
                              alt={itemData.name}
                              className="h-12 w-12 flex-none rounded object-cover"
                            />
                            <div>
                              <p className="font-medium">
                                {itemData.name} &times;{item.quantity}
                              </p>
                              <p className="text-indigo-400">{itemData.description}</p>
                            </div>
                          </>
                        ) : (
                          <p>
                            {item.itemId} &times;{item.quantity}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-indigo-400">Empty.</p>
              )
            ) : null}
            {tab === "ROSTER" ? (
              metRoster.length ? (
                <ul className="flex flex-col gap-4">
                  {metRoster.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      {entry.imageAsset ? (
                        <AssetFallback
                          src={entry.imageAsset}
                          alt={entry.name}
                          className="h-16 w-16 flex-none rounded object-cover"
                        />
                      ) : null}
                      <div>
                        {entry.name ? <p className="font-medium">{entry.name}</p> : null}
                        {entry.title ? <p className="text-indigo-400">{entry.title}</p> : null}
                        {entry.factionNames.length > 0 ? (
                          <p className="text-indigo-400">{entry.factionNames.join(", ")}</p>
                        ) : null}
                        {entry.description ? <p className="mt-1 text-indigo-300">{entry.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-indigo-400">You haven&apos;t met anyone yet.</p>
              )
            ) : null}
          </div>
          {import.meta.env.DEV ? (
            <div className="border-t border-red-900 p-4">
              <div className="mb-4 flex flex-col gap-2 border-b border-red-900 pb-4">
                <p className="text-xs uppercase tracking-wide text-red-400">World Clock (Dev)</p>
                <div className="flex items-center justify-between text-xs text-indigo-100">
                  <span>Shift: {worldClock.shift}</span>
                  <button
                    type="button"
                    onClick={() => devSetWorldClock({ shift: cycleNext(SHIFTS, worldClock.shift) })}
                    className="rounded border border-indigo-700 px-2 py-1 uppercase tracking-wide text-indigo-300 hover:border-indigo-500 hover:text-indigo-100"
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-100">
                  <span>Season: {worldClock.season}</span>
                  <button
                    type="button"
                    onClick={() => devSetWorldClock({ season: cycleNext(SEASONS, worldClock.season) })}
                    className="rounded border border-indigo-700 px-2 py-1 uppercase tracking-wide text-indigo-300 hover:border-indigo-500 hover:text-indigo-100"
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-100">
                  <span>Weather: {worldClock.weather}</span>
                  <button
                    type="button"
                    onClick={() => devSetWorldClock({ weather: cycleNext(WEATHERS, worldClock.weather) })}
                    className="rounded border border-indigo-700 px-2 py-1 uppercase tracking-wide text-indigo-300 hover:border-indigo-500 hover:text-indigo-100"
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-100">
                  <span>Day: {worldClock.day}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => devSetWorldClock({ day: Math.max(1, worldClock.day - 1) })}
                      disabled={worldClock.day <= 1}
                      className="rounded border border-indigo-700 px-2 py-1 text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-indigo-500 enabled:hover:text-indigo-100"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => devSetWorldClock({ day: worldClock.day + 1 })}
                      className="rounded border border-indigo-700 px-2 py-1 text-indigo-300 hover:border-indigo-500 hover:text-indigo-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {isConfirmingReset ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-red-300">Reset all progress? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetProgress();
                        setConfirmingReset(false);
                      }}
                      className="flex-1 rounded border border-red-700 bg-red-950/60 px-3 py-1 text-xs uppercase tracking-wide text-red-200 hover:bg-red-900/60"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="flex-1 rounded border border-indigo-800 px-3 py-1 text-xs uppercase tracking-wide text-indigo-300 hover:border-indigo-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="w-full rounded border border-red-900 px-3 py-1 text-xs uppercase tracking-wide text-red-400 hover:border-red-600 hover:text-red-200"
                >
                  Reset Progress (Dev)
                </button>
              )}
            </div>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
