import { resolveDiceWager } from "./dice";

// Registry of pure minigame resolvers, keyed by MinigameType. Only DICE has a
// defined mechanic so far — DUEL, LOCKPICKING, and FISHING remain open design
// gaps (game-design-spec.md §9) and are intentionally absent here rather than
// stubbed with placeholder logic.
export const minigameResolvers = {
  DICE: resolveDiceWager,
} as const;
