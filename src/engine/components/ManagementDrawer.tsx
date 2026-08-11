import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../store/playerStore";

type ManagementTab = "CASE_BOARD" | "ENDEAVORS" | "INVENTORY";

const TABS: Array<{ id: ManagementTab; label: string }> = [
  { id: "CASE_BOARD", label: "Case Board" },
  { id: "ENDEAVORS", label: "Endeavors" },
  { id: "INVENTORY", label: "Inventory" },
];

export interface ManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  endeavorTitles: Record<string, string>;
}

export function ManagementDrawer({ isOpen, onClose, endeavorTitles }: ManagementDrawerProps) {
  const [tab, setTab] = useState<ManagementTab>("CASE_BOARD");
  const unlockedClues = usePlayerStore((state) => state.unlockedClues);
  const activeEndeavors = usePlayerStore((state) => state.activeEndeavors);
  const inventory = usePlayerStore((state) => state.inventory);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.2 }}
          className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-indigo-900 bg-neutral-950 text-indigo-100"
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
                <ul className="flex flex-col gap-3">
                  {Object.entries(activeEndeavors).map(([endeavorId, endeavor]) => (
                    <li key={endeavorId}>
                      <p className="font-medium">{endeavorTitles[endeavorId] ?? endeavorId}</p>
                      <p className="text-indigo-400">Phase: {endeavor.currentPhaseId}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-indigo-400">No active endeavors.</p>
              )
            ) : null}
            {tab === "INVENTORY" ? (
              inventory.length ? (
                <ul className="flex flex-col gap-2">
                  {inventory.map((item) => (
                    <li key={item.itemId}>
                      {item.itemId} &times;{item.quantity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-indigo-400">Empty.</p>
              )
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
