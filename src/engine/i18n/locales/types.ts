// Shared shape both locale dictionaries must satisfy — TypeScript itself
// rejects a missing or extra key at compile time, a stronger guarantee than
// the runtime key-completeness test (src/__tests__/i18n.test.ts) alone.
// i18next's count-based pluralization (`_one`/`_other` suffixed keys) is
// plain data here — nothing about this type enforces the suffix convention,
// only that both locales define exactly the same set of keys.
export interface LocaleDictionary {
  common: {
    journal: string;
    close: string;
    back: string;
    locked: string;
    language: string;
  };
  worldClock: {
    day: string;
    advanceShift: string;
    shift: { MORNING: string; AFTERNOON: string; EVENING: string; NIGHT: string };
    season: { SPRING: string; SUMMER: string; AUTUMN: string; WINTER: string };
    weather: { CLEAR: string; RAIN: string; FOG: string; STORM: string };
  };
  currency: {
    goldAbbr: string;
    silverAbbr: string;
    bronzeAbbr: string;
    gold_one: string;
    gold_other: string;
    silver_one: string;
    silver_other: string;
    bronze_one: string;
    bronze_other: string;
    balance: string;
  };
  notifications: {
    reputationDelta: string;
    completed: string;
  };
  duel: {
    actions: { THRUST: string; PARRY_RIPOSTE: string; FEINT: string; TAUNT: string; DIRTY_TRICK: string };
    descriptions: { THRUST: string; PARRY_RIPOSTE: string; FEINT: string; TAUNT: string; DIRTY_TRICK: string };
    distanceLabel: { OUT_OF_MEASURE: string; IN_MEASURE: string; CLOSE_QUARTERS: string };
    distanceDescriptions: { OUT_OF_MEASURE: string; IN_MEASURE: string; CLOSE_QUARTERS: string };
    energyDescription: string;
    poiseDescription: string;
    header: string;
    you: string;
    opponentFallback: string;
    energyLabel: string;
    poiseLabel: string;
    energyAria: string;
    poiseAria: string;
    begins: string;
    victory: string;
    defeat: string;
    collect: string;
    flee: string;
    noRetreat: string;
    damageBonus: string;
    damageBonusPart: string;
    log: {
      fails: string;
      opponentFails: string;
      opponentParries: string;
      guardBrokenYours: string;
      landsFor: string;
      holdGuard: string;
      youParry: string;
      guardBrokenTheirs: string;
      opponentLandsFor: string;
      opponentHoldsGuard: string;
      feintYours: string;
      feintTheirs: string;
      tauntYours: string;
      tauntTheirs: string;
    };
  };
  dice: {
    header: string;
    win: string;
    lose: string;
    rolled: string;
    even: string;
    odd: string;
    wager: string;
    collect: string;
    continueLabel: string;
    throwLabel: string;
    notEnoughCoin: string;
    leave: string;
  };
  managementDrawer: {
    tabs: { caseBoard: string; endeavors: string; inventory: string; roster: string };
    noClues: string;
    noActiveEndeavors: string;
    completed: string;
    noActiveEndeavorsShort: string;
    empty: string;
    noRoster: string;
  };
  dialogueOverlay: {
    close: string;
  };
  minigameOverlay: {
    placeholderNote: string;
    resolveDefeat: string;
    resolveVictory: string;
  };
  assetFallback: {
    missing: string;
  };
  actions: {
    gamble: string;
    payBuyerAfford: string;
    payBuyerCantAfford: string;
    payBuyerPaid: string;
  };
  enums: {
    minigameType: { LOCKPICKING: string; FISHING: string; DICE: string; DUEL: string };
  };
}
