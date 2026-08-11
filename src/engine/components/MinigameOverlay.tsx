import { usePlayerStore } from "../store/playerStore";

export function MinigameOverlay() {
  const activeMinigame = usePlayerStore((state) => state.activeMinigame);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);

  if (!activeMinigame) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex w-full max-w-md flex-col gap-4 rounded border border-indigo-800 bg-neutral-950 p-6 text-indigo-100">
        <p className="text-xs uppercase tracking-wide text-indigo-400">{activeMinigame.type}</p>
        <p className="text-sm text-indigo-300">
          Minigame mechanics aren&apos;t specified yet (see the open design gaps in
          game-design-spec.md) — this is the dispatch plumbing only.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              dispatchCommand({ type: "COMMAND_RESOLVE_MINIGAME", payload: { isVictory: false } })
            }
            className="rounded border border-red-800 bg-red-950/60 px-3 py-1 text-xs uppercase tracking-wide hover:bg-red-900/60"
          >
            Resolve as Defeat
          </button>
          <button
            type="button"
            onClick={() =>
              dispatchCommand({ type: "COMMAND_RESOLVE_MINIGAME", payload: { isVictory: true } })
            }
            className="rounded border border-emerald-800 bg-emerald-950/60 px-3 py-1 text-xs uppercase tracking-wide hover:bg-emerald-900/60"
          >
            Resolve as Victory
          </button>
        </div>
      </div>
    </div>
  );
}
