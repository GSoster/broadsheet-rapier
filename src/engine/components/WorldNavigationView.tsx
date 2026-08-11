export interface WorldNavigationPoi {
  id: string;
  name: string;
  isUnlocked: boolean;
}

export interface WorldNavigationViewProps {
  settlementName: string;
  districtName: string;
  pois: WorldNavigationPoi[];
  onSelectPoi: (poiId: string) => void;
}

export function WorldNavigationView({
  settlementName,
  districtName,
  pois,
  onSelectPoi,
}: WorldNavigationViewProps) {
  return (
    <section className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-indigo-400">{settlementName}</p>
        <h1 className="text-2xl font-semibold text-indigo-100">{districtName}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pois.map((poi) => (
          <button
            key={poi.id}
            type="button"
            disabled={!poi.isUnlocked}
            onClick={() => onSelectPoi(poi.id)}
            className="rounded border border-indigo-800 bg-neutral-900 p-4 text-left text-sm text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-indigo-500"
          >
            {poi.isUnlocked ? poi.name : "??? (locked)"}
          </button>
        ))}
      </div>
    </section>
  );
}
