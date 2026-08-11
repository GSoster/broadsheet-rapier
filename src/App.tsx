import { useEffect, useState } from "react";
import { usePlayerStore } from "./engine/store/playerStore";
import { currenciesToBronzeEquivalent } from "./engine/store/commands";
import { clampWager } from "./engine/minigames/dice";
import { playSound } from "./engine/audio/playSound";
import { WorldClockHud } from "./engine/components/WorldClockHud";
import { WorldNavigationView } from "./engine/components/WorldNavigationView";
import { NodeInteractionCanvas, type NodeInteractionAction } from "./engine/components/NodeInteractionCanvas";
import { ManagementDrawer } from "./engine/components/ManagementDrawer";
import { MinigameOverlay } from "./engine/components/MinigameOverlay";

import settlement from "./content/settlements/settlement_valdeombra_city.json";
import district from "./content/districts/district_lantern_ward.json";
import poi from "./content/pois/poi_crooked_hour_tavern.json";
import actor from "./content/actors/actor_mara_venn.json";
import endeavor from "./content/endeavors/endeavor_the_missing_broadsheet.json";

const pois = [poi];
const actors = [actor];

const MARA_ID = "actor_mara_venn";
const ENDEAVOR_ID = "endeavor_the_missing_broadsheet";
const REPUTATION_THRESHOLD_FOR_LEAD = 10;
const MARA_LEAD_DIALOGUE =
  "There's a name — Corvin Thale, runs the numbers out of a warehouse near the Salt Quay. He's the one who paid to keep that press quiet. Careful how you go at him.";

// Small named trigger functions rather than inline checks next to the
// dispatch/mount logic — cheap now, and avoids scattered inline effect
// checks accumulating in App.tsx if a second entry-effect type is ever
// added. Deliberately not generalized into an on-enter-effects registry;
// see game-design-spec.md's systemic-progression gap for why.
function triggerDistrictEntryEffects(activeDistrict: typeof district): void {
  if (activeDistrict.entrySoundAsset) {
    playSound(activeDistrict.entrySoundAsset);
  }
}

function triggerPoiEntryEffects(activePoi: (typeof pois)[number]): void {
  if (activePoi.entrySoundAsset) {
    playSound(activePoi.entrySoundAsset);
  }
}

function App() {
  const currentLocation = usePlayerStore((state) => state.currentLocation);
  const currencies = usePlayerStore((state) => state.currencies);
  const reputation = usePlayerStore((state) => state.reputation);
  const activeEndeavors = usePlayerStore((state) => state.activeEndeavors);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  useEffect(() => {
    triggerDistrictEntryEffects(district);
    // district is a static top-level import today, so this effect correctly
    // runs once on mount; once real district-to-district travel exists,
    // district will need to become reactive and this effect's dependencies
    // must be revisited, or entry sound will silently stop firing on
    // district changes.
  }, []);

  const currentPoi = pois.find((p) => p.id === currentLocation.poiId);

  const maraReputation = reputation.actors[MARA_ID] ?? 0;
  const maraDialogue = maraReputation >= REPUTATION_THRESHOLD_FOR_LEAD ? MARA_LEAD_DIALOGUE : actor.initialDialogue;

  const selectedActorRaw = actors.find((a) => a.id === selectedActorId) ?? null;
  const selectedActor = selectedActorRaw
    ? {
        id: selectedActorRaw.id,
        name: selectedActorRaw.name,
        title: selectedActorRaw.title,
        initialDialogue: selectedActorRaw.id === MARA_ID ? maraDialogue : selectedActorRaw.initialDialogue,
      }
    : null;

  const handleSelectActor = (actorId: string) => {
    setSelectedActorId(actorId);
    if (actorId !== MARA_ID) return;

    dispatchCommand({
      type: "COMMAND_ADJUST_REPUTATION",
      payload: { targetType: "actor", targetId: MARA_ID, amount: 5 },
    });

    const afterReputationBump = usePlayerStore.getState();
    const hasStartedEndeavor = Boolean(afterReputationBump.activeEndeavors[ENDEAVOR_ID]);

    if (!hasStartedEndeavor) {
      dispatchCommand({
        type: "COMMAND_START_ENDEAVOR",
        payload: { endeavorId: ENDEAVOR_ID, initialPhaseId: "phase_ask_around" },
      });
    }

    const updatedReputation = afterReputationBump.reputation.actors[MARA_ID] ?? 0;
    const currentPhase = afterReputationBump.activeEndeavors[ENDEAVOR_ID]?.currentPhaseId ?? "phase_ask_around";

    if (updatedReputation >= REPUTATION_THRESHOLD_FOR_LEAD && currentPhase === "phase_ask_around") {
      dispatchCommand({
        type: "COMMAND_ADVANCE_ENDEAVOR_PHASE",
        payload: {
          endeavorId: ENDEAVOR_ID,
          nextPhaseId: "phase_confront_the_buyer",
          unlocksNodesOnComplete: [],
        },
      });
    }
  };

  function buildPoiActions(activePoi: (typeof pois)[number]): NodeInteractionAction[] {
    const actions: NodeInteractionAction[] = [];

    if (activePoi.id === "poi_crooked_hour_tavern") {
      actions.push({
        id: "action_gamble",
        label: "Gamble",
        onClick: () => {
          const wager = clampWager(20, currenciesToBronzeEquivalent(currencies));
          dispatchCommand({
            type: "COMMAND_START_MINIGAME",
            payload: {
              type: "DICE",
              sourceId: activePoi.id,
              config: { wager },
              onSuccessCommands: [
                { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "bronze", amount: wager } },
              ],
              onFailureCommands: [
                { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "bronze", amount: -wager } },
              ],
            },
          });
        },
      });

      const endeavorState = activeEndeavors[ENDEAVOR_ID];
      if (endeavorState?.currentPhaseId === "phase_confront_the_buyer") {
        const canAfford = currenciesToBronzeEquivalent(currencies) >= 20;
        actions.push({
          id: "action_pay_off_buyer",
          label: canAfford ? "Pay off the buyer (1 silver)" : "Pay off the buyer (need 1 silver)",
          disabled: !canAfford,
          onClick: () => {
            dispatchCommand({
              type: "COMMAND_ADJUST_CURRENCY",
              payload: { denomination: "silver", amount: -1 },
            });
          },
        });
      }
    }

    return actions;
  }

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
          actions={buildPoiActions(currentPoi)}
          onSelectActor={handleSelectActor}
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
            if (target) {
              triggerPoiEntryEffects(target);
            }
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
