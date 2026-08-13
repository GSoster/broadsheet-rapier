import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlayerState, StateCommand } from "../types";
import { PlayerStateSchema } from "../types";
import { applyCommand } from "./commands";
import { createEvent, type StateChangeEvent } from "./events";
import { diffForNotifications, toNotificationEvent, type NotificationEvent, type RawNotificationEvent } from "./notifications";

export const initialPlayerState: PlayerState = {
  // A small starting purse (50 bronze-equivalent) so the dice minigame is
  // reachable from a fresh save — see docs/decisions.md. Not a balanced
  // economy number; economy balance remains an open design gap.
  currencies: { gold: 0, silver: 2, bronze: 10 },
  worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" },
  currentLocation: { settlementId: "", districtId: "" },
  reputation: { factions: {}, actors: {} },
  // Starter rapier — flavor/inventory-only this phase, doesn't gate Thrust or
  // any other duel action, and poise is not yet derived from it (see
  // game-design-spec.md § Open Design Gaps, item 11).
  inventory: [{ itemId: "item_rapier", quantity: 1 }],
  unlockedNodes: {},
  unlockedClues: [],
  activeEndeavors: {},
  activeMinigame: null,
  activeDialogue: null,
  dialogueProgress: {},
};

interface PlayerStore extends PlayerState {
  eventLog: StateChangeEvent[];
  // Ephemeral, store-only, never persisted — same treatment as eventLog. A
  // toast reload-resurrecting after a page refresh would be wrong (nothing
  // "just happened" from the player's perspective), so this deliberately
  // never touches PlayerState/PlayerStateSchema. See
  // docs/features/feature_notification_system.md.
  notifications: NotificationEvent[];
  dispatchCommand: (command: StateCommand) => void;
  dismissNotification: (id: string) => void;
  // For content-aware call sites outside commands.ts (App.tsx's
  // Endeavor-completion detection, which needs endeavor content src/engine/
  // may never read) that need to add a notification without going through
  // a PlayerState-changing command.
  pushNotification: (event: RawNotificationEvent) => void;
  exportSave: () => void;
  importSave: (file: File) => Promise<{ success: boolean; error?: string }>;
  /**
   * Resets save/progress data to initialPlayerState — same conceptual
   * operation as importSave, but targeting a fixed reset value instead of
   * an imported file. Does not touch static content JSON (settlements,
   * districts, actors, etc.) — that's the world itself, not progress.
   */
  resetProgress: () => void;
  /**
   * Dev-only test aid: directly overwrites part of worldClock, bypassing
   * the StateCommand pipeline entirely (no event log entry, no
   * applyCommand). Not a CommandType — cycling season/shift/weather/day for
   * testing isn't a real player action and shouldn't be constructible from
   * content-authored command lists. Mirrors resetProgress's precedent of a
   * store-native dev action rather than a dispatchable command; the
   * ManagementDrawer UI that calls this is gated on import.meta.env.DEV.
   */
  devSetWorldClock: (patch: Partial<PlayerState["worldClock"]>) => void;
}

function extractPlayerState(store: PlayerStore): PlayerState {
  return {
    currencies: store.currencies,
    worldClock: store.worldClock,
    currentLocation: store.currentLocation,
    reputation: store.reputation,
    inventory: store.inventory,
    unlockedNodes: store.unlockedNodes,
    unlockedClues: store.unlockedClues,
    activeEndeavors: store.activeEndeavors,
    activeMinigame: store.activeMinigame,
    activeDialogue: store.activeDialogue,
    dialogueProgress: store.dialogueProgress,
  };
}

export type SaveValidationResult =
  | { success: true; data: PlayerState }
  | { success: false; error: string };

export function parseAndValidateSave(rawJson: string): SaveValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { success: false, error: "File is not valid JSON." };
  }
  const result = PlayerStateSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: "Save file does not match the expected PlayerState shape." };
  }
  return { success: true, data: result.data };
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      ...initialPlayerState,
      eventLog: [],
      notifications: [],

      dispatchCommand: (command) => {
        set((store) => {
          const before = extractPlayerState(store);
          const nextPlayerState = applyCommand(before, command);
          const newNotifications = diffForNotifications(before, nextPlayerState).map(toNotificationEvent);
          return {
            ...nextPlayerState,
            eventLog: [...store.eventLog, createEvent(command)],
            notifications: [...store.notifications, ...newNotifications],
          };
        });
      },

      dismissNotification: (id) => {
        set((store) => ({ notifications: store.notifications.filter((n) => n.id !== id) }));
      },

      pushNotification: (event) => {
        set((store) => ({ notifications: [...store.notifications, toNotificationEvent(event)] }));
      },

      exportSave: () => {
        const playerState = extractPlayerState(get());
        const blob = new Blob([JSON.stringify(playerState, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "broadsheet_rapier_save.json";
        anchor.click();
        URL.revokeObjectURL(url);
      },

      importSave: async (file) => {
        const text = await file.text();
        const result = parseAndValidateSave(text);
        if (!result.success) {
          return { success: false, error: result.error };
        }
        set({ ...result.data, eventLog: [], notifications: [] });
        return { success: true };
      },

      resetProgress: () => {
        set({ ...initialPlayerState, eventLog: [], notifications: [] });
      },

      devSetWorldClock: (patch) => {
        set((store) => ({ worldClock: { ...store.worldClock, ...patch } }));
      },
    }),
    {
      name: "broadsheet_rapier_player_state",
      partialize: (store) => extractPlayerState(store),
    }
  )
);
