import { useState } from "react";
import { usePlayerStore } from "./engine/store/playerStore";
import { WorldClockHud } from "./engine/components/WorldClockHud";
import { WorldNavigationView } from "./engine/components/WorldNavigationView";
import { NodeInteractionCanvas } from "./engine/components/NodeInteractionCanvas";
import { ManagementDrawer } from "./engine/components/ManagementDrawer";
import { MinigameOverlay } from "./engine/components/MinigameOverlay";

import settlement from "./content/settlements/settlement_valdeombra_city.json";
import district from "./content/districts/district_lantern_ward.json";
import poi from "./content/pois/poi_crooked_hour_tavern.json";
import actor from "./content/actors/actor_mara_venn.json";
import endeavor from "./content/endeavors/endeavor_the_missing_broadsheet.json";

const pois = [poi];
const actors = [actor];

function App() {
  const currentLocation = usePlayerStore((state) => state.currentLocation);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  const currentPoi = pois.find((p) => p.id === currentLocation.poiId);
  const selectedActor = actors.find((a) => a.id === selectedActorId) ?? null;

  return (
    <div className="min-h-screen bg-neutral-950 pt-14 text-indigo-100">
      <WorldClockHud />

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed right-4 top-16 z-30 rounded border border-indigo-800 bg-neutral-900 px-3 py-1 text-xs uppercase tracking-wide hover:border-indigo-500"
      >
        Journal
      </button>

      {currentPoi ? (
        <NodeInteractionCanvas
          poiName={currentPoi.name}
          poiDescription={currentPoi.description}
          imageAsset={currentPoi.imageAsset}
          actors={actors
            .filter((a) => currentPoi.actorIds.includes(a.id))
            .map((a) => ({ id: a.id, name: a.name, title: a.title }))}
          selectedActor={selectedActor}
          onSelectActor={setSelectedActorId}
          onLeave={() => {
            setSelectedActorId(null);
            dispatchCommand({
              type: "COMMAND_MOVE_TO_DISTRICT",
              payload: { districtId: currentLocation.districtId },
            });
          }}
        />
      ) : (
        <WorldNavigationView
          settlementName={settlement.name}
          districtName={district.name}
          pois={pois.map((p) => ({ id: p.id, name: p.name, isUnlocked: p.isUnlocked }))}
          onSelectPoi={(poiId) => {
            const target = pois.find((p) => p.id === poiId);
            dispatchCommand({
              type: "COMMAND_MOVE_TO_POI",
              payload: { poiId, costShifts: target?.costShifts ?? 0 },
            });
          }}
        />
      )}

      <ManagementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        endeavorTitles={{ [endeavor.id]: endeavor.title }}
      />
      <MinigameOverlay />
    </div>
  );
}

export default App;
