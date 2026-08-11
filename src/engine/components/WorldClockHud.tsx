import { usePlayerStore } from "../store/playerStore";

export function WorldClockHud() {
  const worldClock = usePlayerStore((state) => state.worldClock);
  const currencies = usePlayerStore((state) => state.currencies);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 border-b border-indigo-900 bg-neutral-950/95 px-4 py-2 text-sm text-indigo-100">
      <div className="flex items-center gap-3">
        <span>Day {worldClock.day}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{worldClock.shift}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{worldClock.season}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{worldClock.weather}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{currencies.gold}g</span>
        <span>{currencies.silver}s</span>
        <span>{currencies.bronze}b</span>
        <button
          type="button"
          onClick={() => dispatchCommand({ type: "COMMAND_ADVANCE_SHIFT", payload: {} })}
          className="rounded border border-indigo-700 bg-indigo-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-indigo-100 hover:bg-indigo-800"
        >
          Advance Shift
        </button>
      </div>
    </header>
  );
}
