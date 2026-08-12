import { resolveDiceWager } from "./dice";
import { evaluateDuelTurn } from "./duel";

// Registry of pure minigame resolvers, keyed by MinigameType. DICE and DUEL
// have defined mechanics so far — LOCKPICKING and FISHING remain open design
// gaps (game-design-spec.md §9) and are intentionally absent here rather than
// stubbed with placeholder logic.
export const minigameResolvers = {
  DICE: resolveDiceWager,
  DUEL: evaluateDuelTurn,
} as const;
