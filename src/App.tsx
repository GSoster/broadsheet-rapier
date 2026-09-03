import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "./engine/i18n";
import { useLocaleStore } from "./engine/store/localeStore";
import { usePlayerStore } from "./engine/store/playerStore";
import { currenciesToBronzeEquivalent } from "./engine/store/commands";
import { clampWager } from "./engine/minigames/dice";
import { playSound } from "./engine/audio/playSound";
import { WorldClockHud } from "./engine/components/WorldClockHud";
import { WorldNavigationView } from "./engine/components/WorldNavigationView";
import { NodeInteractionCanvas, type NodeInteractionAction } from "./engine/components/NodeInteractionCanvas";
import { ManagementDrawer } from "./engine/components/ManagementDrawer";
import { MinigameOverlay } from "./engine/components/MinigameOverlay";
import { DialogueOverlay } from "./engine/components/DialogueOverlay";
import { NotificationTray } from "./engine/components/NotificationTray";
import { resolveNotificationMessage } from "./notificationResolution";

import settlementRaw from "./content/settlements/settlement_valdeombra_city.json";
import districtRaw from "./content/districts/district_lantern_ward.json";
import poiRaw from "./content/pois/poi_crooked_hour_tavern.json";
import poiWidowmakerAlleyRaw from "./content/pois/poi_widowmaker_alley.json";
import actorRaw from "./content/actors/actor_mara_venn.json";
import actorBookkeeperRaw from "./content/actors/actor_bookkeeper.json";
import actorAnselmDrayeRaw from "./content/actors/actor_anselm_draye.json";
import actorDuroVantryRaw from "./content/actors/actor_duro_vantry.json";
import endeavorRaw from "./content/endeavors/endeavor_the_missing_broadsheet.json";
import endeavorDebtInSteelRaw from "./content/endeavors/endeavor_a_debt_in_steel.json";
import dialogueMaraVennRaw from "./content/dialogues/dialogue_mara_venn.json";
import dialogueBookkeeperDefaultRaw from "./content/dialogues/dialogue_bookkeeper_default.json";
import dialogueDuroVantryDefaultRaw from "./content/dialogues/dialogue_duro_vantry_default.json";
import dialogueTheChallengeRaw from "./content/dialogues/dialogue_the_challenge.json";
import dialogueAnselmRecruitRaw from "./content/dialogues/dialogue_anselm_recruit.json";
import dialogueWidowmakerArrivalRaw from "./content/dialogues/dialogue_widowmaker_arrival.json";
import dialogueTheOfferRaw from "./content/dialogues/dialogue_the_offer.json";
import dialogueReckoningWinRaw from "./content/dialogues/dialogue_reckoning_win.json";
import dialogueReckoningLoseRaw from "./content/dialogues/dialogue_reckoning_lose.json";
import itemRapierRaw from "./content/items/item_rapier.json";
import itemVantryRapierRaw from "./content/items/item_vantry_rapier.json";
import itemDuellistsRapierRaw from "./content/items/item_duellists_rapier.json";
import itemLetterOfIntroductionRaw from "./content/items/item_letter_of_introduction.json";
import itemPendantOfEasyCoinRaw from "./content/items/item_pendant_of_easy_coin.json";
import factionCityWatchRaw from "./content/factions/faction_city_watch.json";
import factionWageringRingRaw from "./content/factions/faction_wagering_ring.json";
import { SettlementSchema } from "./content/schemas/settlement.schema";
import { DistrictSchema } from "./content/schemas/district.schema";
import { PoiSchema } from "./content/schemas/poi.schema";
import { ActorSchema } from "./content/schemas/actor.schema";
import { EndeavorSchema } from "./content/schemas/endeavor.schema";
import { DialogueSchema } from "./content/schemas/dialogue.schema";
import { ItemSchema, type Item } from "./content/schemas/item.schema";
import { FactionSchema } from "./content/schemas/faction.schema";
import { BaseNodeTranslatableSchema } from "./content/schemas/shared";
import { ActorTranslatableSchema } from "./content/schemas/actor.schema";
import { EndeavorTranslatableSchema } from "./content/schemas/endeavor.schema";
import { DialogueTranslatableSchema } from "./content/schemas/dialogue.schema";
import type { ItemDisplayData, RosterEntryData } from "./engine/components/ManagementDrawer";
import { loadContent } from "./contentLoader";
import {
  applyLocaleOverlay,
  mergeActorTranslatable,
  mergeBaseNodeTranslatable,
  mergeDialogueTranslatable,
  mergeEndeavorTranslatable,
} from "./contentLocalization";
import { resolveDialogueEntryNodeId } from "./dialogueResolution";
import { collectActiveModifiers } from "./modifierResolution";
import { computeDistrictEntryEffects, computePoiEntryEffects, type EntryEffect } from "./engine/utils/entryEffects";
import { isNodeUnlocked } from "./engine/utils/isNodeUnlocked";

// Every content file is parsed through its schema here, once, at module
// load — see contentLoader.ts for why. Nothing below this point ever reads
// a *Raw import directly.
const settlement = loadContent(SettlementSchema, settlementRaw, "settlement_valdeombra_city");
const district = loadContent(DistrictSchema, districtRaw, "district_lantern_ward");
const poi = loadContent(PoiSchema, poiRaw, "poi_crooked_hour_tavern");
const poiWidowmakerAlley = loadContent(PoiSchema, poiWidowmakerAlleyRaw, "poi_widowmaker_alley");
const actor = loadContent(ActorSchema, actorRaw, "actor_mara_venn");
const actorBookkeeper = loadContent(ActorSchema, actorBookkeeperRaw, "actor_bookkeeper");
const actorAnselmDraye = loadContent(ActorSchema, actorAnselmDrayeRaw, "actor_anselm_draye");
const actorDuroVantry = loadContent(ActorSchema, actorDuroVantryRaw, "actor_duro_vantry");
const endeavor = loadContent(EndeavorSchema, endeavorRaw, "endeavor_the_missing_broadsheet");
const endeavorDebtInSteel = loadContent(EndeavorSchema, endeavorDebtInSteelRaw, "endeavor_a_debt_in_steel");
const dialogueMaraVenn = loadContent(DialogueSchema, dialogueMaraVennRaw, "dialogue_mara_venn");
const dialogueBookkeeperDefault = loadContent(
  DialogueSchema,
  dialogueBookkeeperDefaultRaw,
  "dialogue_bookkeeper_default"
);
const dialogueDuroVantryDefault = loadContent(
  DialogueSchema,
  dialogueDuroVantryDefaultRaw,
  "dialogue_duro_vantry_default"
);
const dialogueTheChallenge = loadContent(DialogueSchema, dialogueTheChallengeRaw, "dialogue_the_challenge");
const dialogueAnselmRecruit = loadContent(DialogueSchema, dialogueAnselmRecruitRaw, "dialogue_anselm_recruit");
const dialogueWidowmakerArrival = loadContent(
  DialogueSchema,
  dialogueWidowmakerArrivalRaw,
  "dialogue_widowmaker_arrival"
);
const dialogueTheOffer = loadContent(DialogueSchema, dialogueTheOfferRaw, "dialogue_the_offer");
const dialogueReckoningWin = loadContent(DialogueSchema, dialogueReckoningWinRaw, "dialogue_reckoning_win");
const dialogueReckoningLose = loadContent(DialogueSchema, dialogueReckoningLoseRaw, "dialogue_reckoning_lose");
const itemRapier = loadContent(ItemSchema, itemRapierRaw, "item_rapier");
const itemVantryRapier = loadContent(ItemSchema, itemVantryRapierRaw, "item_vantry_rapier");
const factionCityWatch = loadContent(FactionSchema, factionCityWatchRaw, "faction_city_watch");
const factionWageringRing = loadContent(FactionSchema, factionWageringRingRaw, "faction_wagering_ring");

const pois = [poi, poiWidowmakerAlley];
const actors = [actor, actorBookkeeper, actorAnselmDraye, actorDuroVantry];
const factions = [factionCityWatch, factionWageringRing];
const endeavors = [endeavor, endeavorDebtInSteel];
const endeavorsById = Object.fromEntries(endeavors.map((e) => [e.id, e]));

const dialogueList = [
  dialogueMaraVenn,
  dialogueBookkeeperDefault,
  dialogueDuroVantryDefault,
  dialogueTheChallenge,
  dialogueAnselmRecruit,
  dialogueWidowmakerArrival,
  dialogueTheOffer,
  dialogueReckoningWin,
  dialogueReckoningLose,
];
const itemDuellistsRapier = loadContent(ItemSchema, itemDuellistsRapierRaw, "item_duellists_rapier");
const itemLetterOfIntroduction = loadContent(ItemSchema, itemLetterOfIntroductionRaw, "item_letter_of_introduction");
const itemPendantOfEasyCoin = loadContent(ItemSchema, itemPendantOfEasyCoinRaw, "item_pendant_of_easy_coin");
const itemList = [
  itemRapier,
  itemVantryRapier,
  itemDuellistsRapier,
  itemLetterOfIntroduction,
  itemPendantOfEasyCoin,
];
// Full parsed (canonical, English) Item objects, keyed by id —
// modifierResolution.ts's collectActiveModifiers only ever needs `.modifiers`,
// which a locale overlay never touches (only name/description do), so this
// deliberately stays module-scope/English rather than recomputed per locale.
const itemRecordsById: Record<string, Item> = Object.fromEntries(itemList.map((item) => [item.id, item]));
// Locale overlay discovery — a glob (not per-file static imports, which
// would break the build for every not-yet-translated file) since most
// content has no translation yet; this only ever matches files that
// actually exist. `import: "default"` returns each matched file's parsed
// JSON directly rather than an ESM module wrapper. Currently pt-BR only
// (the one non-English locale shipped this phase) — a third locale would
// need its own glob, or a generalized multi-locale pattern (see
// docs/features/feature_localization.md's Open Questions).
const ptBrOverlayModules = import.meta.glob<Record<string, unknown>>("./content/**/*.pt-BR.json", {
  eager: true,
  import: "default",
});
const ptBrOverlaysById: Record<string, unknown> = {};
for (const [path, data] of Object.entries(ptBrOverlayModules)) {
  const filename = path.split("/").pop() ?? path;
  ptBrOverlaysById[filename.replace(/\.pt-BR\.json$/, "")] = data;
}

const ENDEAVOR_ID = "endeavor_the_missing_broadsheet";

// Every content-derived lookup map that could carry translated text
// (item/endeavor names, titles, objective text) is computed reactively
// inside App() instead (localizedItemNames, localizedEndeavorTitles,
// localizedPhaseObjectives, etc. — see the localization block below).
// phaseIsTerminal below is the one exception: it's purely structural
// (whether a phase has nextPhaseOnSuccess), never translated text, so it
// stays module-scope against the canonical English endeavors.
// Same "no nextPhaseOnSuccess = terminal = reaching it is the
// representation of completion" rule the notification system's
// Endeavor-completion effect uses (web-implementation.md §3/§10) — reused
// here, not reinvented, so the Endeavors tab's active/completed split
// agrees with what already triggers a "Completed: ..." toast.
const phaseIsTerminal = Object.fromEntries(
  endeavors.map((e) => [
    e.id,
    Object.fromEntries(Object.entries(e.phases).map(([phaseId, phase]) => [phaseId, phase.nextPhaseOnSuccess === undefined])),
  ])
);

function App() {
  const { t } = useTranslation();
  const locale = useLocaleStore((state) => state.locale);

  // Drives i18next from the locale store — the only place changeLanguage is
  // called. See docs/features/feature_localization.md.
  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale]);

  // Locale-resolved versions of EVERY content instance — generic, not a
  // hardcoded per-entity list, so a newly-authored overlay file (any
  // content type, any id) is picked up automatically. Each `useMemo` is
  // keyed on `locale` and recomputes on every change — NOT memoized only on
  // mount — so a dialogue already open when the player switches language
  // updates live, not just the next time it's opened
  // (docs/features/feature_localization.md's Reachability section). An id
  // with no overlay file for the current locale is a pure pass-through to
  // the canonical English value via `applyLocaleOverlay`.
  const localizedSettlement = useMemo(
    () =>
      applyLocaleOverlay(
        settlement,
        BaseNodeTranslatableSchema,
        locale === "en" ? undefined : ptBrOverlaysById[settlement.id],
        settlement.id,
        mergeBaseNodeTranslatable
      ),
    [locale]
  );
  const localizedDistrict = useMemo(
    () =>
      applyLocaleOverlay(
        district,
        BaseNodeTranslatableSchema,
        locale === "en" ? undefined : ptBrOverlaysById[district.id],
        district.id,
        mergeBaseNodeTranslatable
      ),
    [locale]
  );
  const localizedPois = useMemo(
    () =>
      pois.map((p) =>
        applyLocaleOverlay(
          p,
          BaseNodeTranslatableSchema,
          locale === "en" ? undefined : ptBrOverlaysById[p.id],
          p.id,
          mergeBaseNodeTranslatable
        )
      ),
    [locale]
  );
  const localizedActors = useMemo(
    () =>
      actors.map((a) =>
        applyLocaleOverlay(
          a,
          ActorTranslatableSchema,
          locale === "en" ? undefined : ptBrOverlaysById[a.id],
          a.id,
          mergeActorTranslatable
        )
      ),
    [locale]
  );
  const localizedFactions = useMemo(
    () =>
      factions.map((f) =>
        applyLocaleOverlay(
          f,
          BaseNodeTranslatableSchema,
          locale === "en" ? undefined : ptBrOverlaysById[f.id],
          f.id,
          mergeBaseNodeTranslatable
        )
      ),
    [locale]
  );
  const localizedItemList = useMemo(
    () =>
      itemList.map((item) =>
        applyLocaleOverlay(
          item,
          BaseNodeTranslatableSchema,
          locale === "en" ? undefined : ptBrOverlaysById[item.id],
          item.id,
          mergeBaseNodeTranslatable
        )
      ),
    [locale]
  );
  const localizedEndeavors = useMemo(
    () =>
      endeavors.map((e) =>
        applyLocaleOverlay(
          e,
          EndeavorTranslatableSchema,
          locale === "en" ? undefined : ptBrOverlaysById[e.id],
          e.id,
          mergeEndeavorTranslatable
        )
      ),
    [locale]
  );
  const localizedDialogueList = useMemo(
    () =>
      dialogueList.map((d) =>
        applyLocaleOverlay(
          d,
          DialogueTranslatableSchema,
          locale === "en" ? undefined : ptBrOverlaysById[d.id],
          d.id,
          mergeDialogueTranslatable
        )
      ),
    [locale]
  );
  const localizedDialogues = useMemo(
    () => Object.fromEntries(localizedDialogueList.map((d) => [d.id, d])),
    [localizedDialogueList]
  );
  const localizedFactionsById = useMemo(
    () => Object.fromEntries(localizedFactions.map((f) => [f.id, f])),
    [localizedFactions]
  );
  const localizedRosterEntries: RosterEntryData[] = useMemo(
    () =>
      localizedActors.map((a) => ({
        id: a.id,
        name: a.name,
        title: a.title,
        description: a.description,
        imageAsset: a.imageAsset,
        factionNames: a.factionIds.map((fid) => localizedFactionsById[fid]?.name ?? fid),
        dialogueId: a.dialogueId,
      })),
    [localizedActors, localizedFactionsById]
  );
  const localizedActorNames = useMemo(
    () => Object.fromEntries(localizedActors.map((a) => [a.id, a.name])),
    [localizedActors]
  );
  const localizedFactionNames = useMemo(
    () => Object.fromEntries(localizedFactions.map((f) => [f.id, f.name])),
    [localizedFactions]
  );
  const localizedItemsById: Record<string, ItemDisplayData> = useMemo(
    () =>
      Object.fromEntries(
        localizedItemList.map((item) => [
          item.id,
          { name: item.name, description: item.description, imageAsset: item.imageAsset },
        ])
      ),
    [localizedItemList]
  );
  const localizedItemNames = useMemo(
    () => Object.fromEntries(localizedItemList.map((item) => [item.id, item.name])),
    [localizedItemList]
  );
  const localizedEndeavorTitles = useMemo(
    () => Object.fromEntries(localizedEndeavors.map((e) => [e.id, e.title])),
    [localizedEndeavors]
  );
  const localizedPhaseObjectives = useMemo(
    () =>
      Object.fromEntries(
        localizedEndeavors.map((e) => [
          e.id,
          Object.fromEntries(Object.entries(e.phases).map(([phaseId, phase]) => [phaseId, phase.objectiveText])),
        ])
      ),
    [localizedEndeavors]
  );

  const currentLocation = usePlayerStore((state) => state.currentLocation);
  const currencies = usePlayerStore((state) => state.currencies);
  const inventory = usePlayerStore((state) => state.inventory);
  const setActiveModifiers = usePlayerStore((state) => state.setActiveModifiers);
  const activeEndeavors = usePlayerStore((state) => state.activeEndeavors);
  const unlockedNodes = usePlayerStore((state) => state.unlockedNodes);
  const dialogueProgress = usePlayerStore((state) => state.dialogueProgress);
  const activeDialogue = usePlayerStore((state) => state.activeDialogue);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);
  const notifications = usePlayerStore((state) => state.notifications);
  const dismissNotification = usePlayerStore((state) => state.dismissNotification);
  const pushNotification = usePlayerStore((state) => state.pushNotification);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  // Purely cosmetic click-acknowledgement for "Pay off the buyer" — the
  // action itself is deliberately repeatable with no one-time gate
  // (web-implementation.md §3), so this doesn't disable the action
  // permanently, only long enough for a click to visibly register instead
  // of looking unresponsive (the currency toast is the only other feedback,
  // and it's easy to miss if you're not looking at the corner).
  const [buyerJustPaid, setBuyerJustPaid] = useState(false);

  // Turns a computed EntryEffect into the actual side effect. Lives inside
  // App() (not a top-level function) since DIALOGUE effects need
  // dispatchCommand/dialogues/dialogueProgress from component scope.
  function executeEntryEffect(effect: EntryEffect) {
    if (effect.type === "SOUND") {
      playSound(effect.asset);
      return;
    }
    if (effect.type === "START_ENDEAVOR") {
      dispatchCommand({
        type: "COMMAND_START_ENDEAVOR",
        payload: { endeavorId: effect.endeavorId, initialPhaseId: effect.initialPhaseId },
      });
      return;
    }
    const nodeId = effect.nodeId ?? resolveDialogueEntryNodeId(localizedDialogues[effect.dialogueId], dialogueProgress[effect.dialogueId]);
    dispatchCommand({
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: effect.dialogueId, nodeId },
    });
    dispatchCommand({ type: "COMMAND_OPEN_DIALOGUE", payload: { dialogueId: effect.dialogueId } });
  }

  // Recomputes the store's activeModifiers whenever owned items change.
  // Keyed on `inventory` only — once `equipped` exists (deferred, §3.1),
  // it joins this dependency list. See docs/features/
  // feature_modifier_system.md §2.8's named limitation: this recompute
  // happens a render cycle after dispatchCommand runs, so a command that
  // both grants a modifier-bearing item and needs that modifier applied
  // within the same dispatch isn't supported yet.
  useEffect(() => {
    setActiveModifiers(collectActiveModifiers({ inventory }, itemRecordsById));
  }, [inventory, setActiveModifiers]);

  useEffect(() => {
    computeDistrictEntryEffects(district).forEach(executeEntryEffect);
    // district is a static top-level import today, so this effect correctly
    // runs once on mount; once real district-to-district travel exists,
    // district will need to become reactive and this effect's dependencies
    // must be revisited, or entry sound will silently stop firing on
    // district changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires an EndeavorPhase's onPoiEnter for the POI the player is
  // ALREADY standing in, when a phase change makes it newly applicable —
  // the onSelectPoi call site only fires on the POI-selection moment
  // itself, which misses this case (docs/features/
  // feature_dialogue_visibility_and_auto_triggers.md addendum).
  // Deliberately narrower than onSelectPoi's full effect list: SOUND/
  // START_ENDEAVOR are excluded (replaying entry SFX or re-starting an
  // endeavor on every unrelated phase change would be a regression), and
  // it never fires over an already-open dialogue.
  useEffect(() => {
    if (currentLocation.poiId && activeDialogue === null) {
      const target = localizedPois.find((p) => p.id === currentLocation.poiId);
      if (target) {
        computePoiEntryEffects(target, activeEndeavors, endeavorsById, unlockedNodes)
          .filter((effect): effect is Extract<EntryEffect, { type: "DIALOGUE" }> => effect.type === "DIALOGUE")
          .forEach(executeEntryEffect);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndeavors]);

  // Fires an "Endeavor completed" notification the moment an Endeavor's
  // phase transitions INTO a terminal one (no nextPhaseOnSuccess) — separate
  // from the dialogue-trigger effect above since this needs to compare
  // against the PREVIOUS phase, not just react to the current one.
  // prevActiveEndeavorsRef is seeded with activeEndeavors itself (not {}/
  // undefined) so the first comparison after mount is always against
  // itself — otherwise a save reloaded with an already-completed Endeavor
  // would fire a false "completed" toast on every page load, since this
  // effect still runs once after the first render regardless of its
  // dependency array. See docs/features/feature_notification_system.md.
  const prevActiveEndeavorsRef = useRef(activeEndeavors);
  useEffect(() => {
    for (const [endeavorId, progress] of Object.entries(activeEndeavors)) {
      const previousPhaseId = prevActiveEndeavorsRef.current[endeavorId]?.currentPhaseId;
      if (previousPhaseId === progress.currentPhaseId) continue;
      const phase = endeavorsById[endeavorId]?.phases[progress.currentPhaseId];
      if (phase && phase.nextPhaseOnSuccess === undefined) {
        pushNotification({ tone: "info", kind: "ENDEAVOR_COMPLETE", endeavorId });
      }
    }
    prevActiveEndeavorsRef.current = activeEndeavors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndeavors]);

  const currentPoi = localizedPois.find((p) => p.id === currentLocation.poiId);

  const openDialogue = activeDialogue ? localizedDialogues[activeDialogue.dialogueId] : null;
  const openNode = openDialogue
    ? openDialogue.nodes[resolveDialogueEntryNodeId(openDialogue, dialogueProgress[openDialogue.id])]
    : null;
  // Prefers speakerActorId (an explicit, referentially-checked reference,
  // immune to locale since ids never translate) when the node sets one;
  // falls back to matching display name against Actor.name for a
  // narration-style node with no Actor to reference (e.g. "Narration") —
  // see docs/features/feature_dialogue_speaker_reference.md. A scene an
  // Actor *appears* in (an Endeavor's/EndeavorPhase's onPoiEnter, or a
  // minigame's onSuccessCommands/onFailureCommands opening a reckoning
  // dialogue) is very often not that Actor's own home dialogue (see
  // docs/features/content_a_debt_in_steel.md's dialogueId-split design and
  // game-design-spec.md Open Design Gap #14) — either resolution path
  // still needs to resolve a portrait for every scene that Actor speaks
  // in, not just their own.
  const speakerActor = openNode?.speakerActorId
    ? localizedActors.find((a) => a.id === openNode.speakerActorId)
    : localizedActors.find((a) => a.name === openNode?.speaker);

  const handleSelectActor = (actorId: string) => {
    setSelectedActorId(actorId);
    const selected = localizedActors.find((a) => a.id === actorId);
    const dialogue = selected ? localizedDialogues[selected.dialogueId] : undefined;
    if (!dialogue) return;

    const entryNodeId = resolveDialogueEntryNodeId(dialogue, dialogueProgress[dialogue.id]);
    dispatchCommand({
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: dialogue.id, nodeId: entryNodeId },
    });
    dispatchCommand({ type: "COMMAND_OPEN_DIALOGUE", payload: { dialogueId: dialogue.id } });
  };

  function buildPoiActions(activePoi: (typeof pois)[number]): NodeInteractionAction[] {
    const actions: NodeInteractionAction[] = [];

    if (activePoi.id === "poi_crooked_hour_tavern") {
      actions.push({
        id: "action_gamble",
        label: t("actions.gamble"),
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
          label: buyerJustPaid
            ? t("actions.payBuyerPaid")
            : canAfford
              ? t("actions.payBuyerAfford")
              : t("actions.payBuyerCantAfford"),
          disabled: buyerJustPaid || !canAfford,
          onClick: () => {
            dispatchCommand({
              type: "COMMAND_ADJUST_CURRENCY",
              payload: { denomination: "silver", amount: -1 },
            });
            setBuyerJustPaid(true);
            window.setTimeout(() => setBuyerJustPaid(false), 1200);
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
        {t("common.journal")}
      </button>

      {currentPoi ? (
        <NodeInteractionCanvas
          poiName={currentPoi.name}
          poiDescription={currentPoi.description}
          imageAsset={currentPoi.imageAsset}
          actors={localizedActors
            .filter((a) => currentPoi.actorIds.includes(a.id))
            .map((a) => ({ id: a.id, name: a.name, title: a.title, isUnlocked: isNodeUnlocked(a, a.id, unlockedNodes) }))}
          selectedActorId={selectedActorId}
          actions={buildPoiActions(currentPoi)}
          onSelectActor={handleSelectActor}
          onLeave={() => {
            setSelectedActorId(null);
            dispatchCommand({ type: "COMMAND_CLOSE_DIALOGUE", payload: {} });
            dispatchCommand({
              type: "COMMAND_MOVE_TO_DISTRICT",
              payload: { districtId: currentLocation.districtId },
            });
          }}
        />
      ) : (
        <WorldNavigationView
          settlementName={localizedSettlement.name}
          districtName={localizedDistrict.name}
          // BEHAVIOR FIX (not new scope): this previously read p.isUnlocked
          // directly, the static content default only — PlayerState.unlockedNodes
          // (written by COMMAND_UNLOCK_NODE / EndeavorPhase.unlocksNodesOnComplete)
          // was never consulted, so a POI's lock state could never actually
          // change at runtime. See game-design-spec.md Open Design Gap #13,
          // docs/features/feature_node_unlock_rendering.md, docs/decisions.md.
          pois={localizedPois.map((p) => ({ id: p.id, name: p.name, isUnlocked: isNodeUnlocked(p, p.id, unlockedNodes) }))}
          onSelectPoi={(poiId) => {
            const target = localizedPois.find((p) => p.id === poiId);
            if (target) {
              computePoiEntryEffects(target, activeEndeavors, endeavorsById, unlockedNodes).forEach(executeEntryEffect);
            }
            dispatchCommand({
              // target.costShifts is guaranteed present (PoiSchema's
              // .default(0) applied at load time by contentLoader.ts) once
              // target itself resolves — the `? :` only covers "no matching
              // poi found", not a missing/undefaulted field.
              type: "COMMAND_MOVE_TO_POI",
              payload: { poiId, costShifts: target ? target.costShifts : 0 },
            });
          }}
        />
      )}

      <ManagementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        endeavorTitles={localizedEndeavorTitles}
        phaseObjectives={localizedPhaseObjectives}
        phaseIsTerminal={phaseIsTerminal}
        items={localizedItemsById}
        roster={localizedRosterEntries}
      />
      <MinigameOverlay />
      <DialogueOverlay
        dialogueId={activeDialogue?.dialogueId ?? ""}
        node={openNode}
        speakerImageAsset={speakerActor?.imageAsset}
      />
      <NotificationTray
        notifications={notifications.map((event) =>
          resolveNotificationMessage(event, {
            itemNames: localizedItemNames,
            actorNames: localizedActorNames,
            factionNames: localizedFactionNames,
            endeavorTitles: localizedEndeavorTitles,
            t,
          })
        )}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

export default App;
