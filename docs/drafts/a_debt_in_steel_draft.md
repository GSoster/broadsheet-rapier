# "A Debt in Steel" — Dialogue Draft

Endeavor id: `endeavor_a_debt_in_steel`
District: `district_lantern_ward` (existing, no change)
New POI: `poi_widowmaker_alley` — officially filed under a flat City Watch designation, called Widowmaker Alley by everyone who actually uses it.
Actors: `actor_bookkeeper` (existing, title-as-name, real name never given), `actor_anselm_draye` (new, the Debtor), `actor_duro_vantry` (new, the Wagering Ring's duelist)
Faction: `faction_wagering_ring` (existing)

Phases: `phase_the_challenge` → `phase_the_second` → `phase_arrival_widowmaker` → `phase_the_offer` → `phase_the_duel` → `phase_the_reckoning` → `phase_resolved`

This is written to match the structure of the existing `dialogue_mara_venn` tree. Everywhere a Command fires, or the DUEL minigame starts, is called out in prose right above the JSON so it's easy to scan.

A few Command types and one field below aren't confirmed against the actual engine, they're written the way the existing patterns suggest they'd work, but should be checked in the technical conversation before anyone builds against them. Full list at the bottom.

---

## Phase: the Challenge

Witnessed scene at the Crooked Hour, not a conversation the player initiates. This is where the paperwork line lands, in the Bookkeeper's own voice. Ends by starting the Endeavor, with `initialPhaseId` pointing past this scene to `phase_the_second`, same pattern as the existing Mara Venn tree where `COMMAND_START_ENDEAVOR` points at the phase that follows the trigger, not the trigger itself.

```json
{
  "id": "dialogue_the_challenge",
  "startNodeId": "node_terms_read",
  "nodes": {
    "node_terms_read": {
      "id": "node_terms_read",
      "speaker": "The Bookkeeper",
      "text": "He unrolls a strip of paper and reads it the way another man might read a shipping manifest. \"Twelve silver, outstanding since the Feast of Saint Ilona. By the Ring's own charter, the debt may be settled in coin, in kind, or\" — a glance at the man beside him — \"in blood, properly witnessed.\"",
      "choices": [
        {
          "id": "choice_keep_watching",
          "text": "Keep watching.",
          "nextNodeId": "node_terms_set",
          "commands": []
        }
      ]
    },
    "node_terms_set": {
      "id": "node_terms_set",
      "speaker": "The Bookkeeper",
      "text": "He taps the paper twice, rolls it, tucks it away. \"Filed and witnessed. The instrument is to be settled off Cutpurse Row, three days hence, at dusk. The clerks call it Instrument of Debt Resolution, District Filing 114.\" A dry pause. \"Everyone else calls it Widowmaker Alley. Even violence goes through paperwork in this city.\"",
      "choices": [
        {
          "id": "choice_watch_face_fall",
          "text": "Watch the debtor's face fall.",
          "commands": [
            {
              "type": "COMMAND_START_ENDEAVOR",
              "payload": { "endeavorId": "endeavor_a_debt_in_steel", "initialPhaseId": "phase_the_second" }
            }
          ]
        }
      ]
    }
  }
}
```

---

## Phase: the Second

Anselm Draye approaches the player directly. A genuine decline here is a real off-ramp, no pressure, this is before anyone's committed to anything. The fee is payment for standing by, not for fighting, so it's small and it's separate from what comes later.

```json
{
  "id": "dialogue_anselm_recruit",
  "startNodeId": "node_ask_second",
  "nodes": {
    "node_ask_second": {
      "id": "node_ask_second",
      "speaker": "Anselm Draye",
      "text": "\"You saw that. Twelve silver I don't have, and now a blade I've never held with any conviction.\" He's not quite looking at you. \"I need someone at my shoulder Thursday. Just to stand there. Will you?\"",
      "choices": [
        {
          "id": "choice_agree_to_stand",
          "text": "\"I'll stand with you.\"",
          "nextNodeId": "node_fee_offered",
          "commands": []
        },
        {
          "id": "choice_decline_second",
          "text": "\"This isn't my fight.\"",
          "commands": []
        }
      ]
    },
    "node_fee_offered": {
      "id": "node_fee_offered",
      "speaker": "Anselm Draye",
      "text": "Relief, badly hidden. \"Three silver now, whatever happens Thursday. You're owed that much for the company alone.\"",
      "choices": [
        {
          "id": "choice_accept_fee",
          "text": "\"Agreed.\"",
          "commands": [
            {
              "type": "COMMAND_ADJUST_CURRENCY",
              "payload": { "currency": "SILVER", "amount": 3 }
            },
            {
              "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE",
              "payload": {
                "endeavorId": "endeavor_a_debt_in_steel",
                "nextPhaseId": "phase_arrival_widowmaker",
                "unlocksNodesOnComplete": []
              }
            }
          ]
        }
      ]
    }
  }
}
```

Declining ends the conversation with no Commands fired. The Endeavor simply doesn't advance, the player can presumably come back and talk to Anselm again later if they change their mind, that's a design choice for the technical conversation rather than something this Dialogue needs to enforce.

---

## Phase: Arrival at Widowmaker Alley

Pure scene-setting at the new POI, crowd already gathering. One optional branch shows the system's existing Shift and Faction reputation gating doing real work here, no new mechanic, just reused exactly as the Mara Venn tree already uses `requires`.

```json
{
  "id": "dialogue_widowmaker_arrival",
  "startNodeId": "node_arrival",
  "nodes": {
    "node_arrival": {
      "id": "node_arrival",
      "speaker": "Narration",
      "text": "Widowmaker Alley is narrower than its reputation. Lanterns have been strung between the walls, and a loose ring of onlookers has already claimed the good footing. Duro Vantry stands apart, rolling his shoulders. Anselm hasn't stopped checking the exits.",
      "choices": [
        {
          "id": "choice_recognized_by_ring",
          "text": "(A few in the crowd nod your way.)",
          "requires": {
            "minFactionReputation": { "factionId": "faction_wagering_ring", "value": 20 }
          },
          "nextNodeId": "node_friendly_crowd",
          "commands": []
        },
        {
          "id": "choice_take_place",
          "text": "Take your place beside Anselm.",
          "commands": [
            {
              "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE",
              "payload": {
                "endeavorId": "endeavor_a_debt_in_steel",
                "nextPhaseId": "phase_the_offer",
                "unlocksNodesOnComplete": []
              }
            }
          ]
        }
      ]
    },
    "node_friendly_crowd": {
      "id": "node_friendly_crowd",
      "speaker": "Narration",
      "text": "Someone passes a flask your way without being asked. Whatever else happens tonight, you're not a stranger here.",
      "choices": [
        {
          "id": "choice_take_place_friendly",
          "text": "Take your place beside Anselm.",
          "commands": [
            {
              "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE",
              "payload": {
                "endeavorId": "endeavor_a_debt_in_steel",
                "nextPhaseId": "phase_the_offer",
                "unlocksNodesOnComplete": []
              }
            }
          ]
        }
      ]
    }
  }
}
```

(`minFactionReputation` is written by analogy to the confirmed `minActorReputation` field on the Mara Venn tree, same shape, different target. Worth a quick confirm that the Requirement schema actually supports a Faction target the same way, rather than assuming.)

---

## Phase: the Offer

This is the two-round pressure structure: decline once, get pushed back with the crowd and the terms themselves doing the pushing, decline twice, and the third node removes the real option entirely, both remaining choices lead to the same place. Every path through this Dialogue ends the same way, at the DUEL.

```json
{
  "id": "dialogue_the_offer",
  "startNodeId": "node_first_offer",
  "nodes": {
    "node_first_offer": {
      "id": "node_first_offer",
      "speaker": "Anselm Draye",
      "text": "He grabs your sleeve, low and fast. \"Take my place. Please. Whatever's owed, I'll pay double, and there's a rapier in it too, Vantry's own if you win it off him, better steel than anything I could afford you otherwise.\"",
      "choices": [
        {
          "id": "choice_accept_swap_first",
          "text": "\"I'll fight in your place.\"",
          "nextNodeId": "node_pre_duel",
          "commands": []
        },
        {
          "id": "choice_decline_swap_first",
          "text": "\"Find someone else.\"",
          "nextNodeId": "node_pressure",
          "commands": []
        }
      ]
    },
    "node_pressure": {
      "id": "node_pressure",
      "speaker": "Narration",
      "text": "The crowd's noticed the delay. Someone near the back starts a slow, mocking clap. Vantry hasn't moved, but he's watching now. Anselm's grip tightens. \"They came to see steel move, not to wait on my nerve. Please.\"",
      "choices": [
        {
          "id": "choice_accept_swap_second",
          "text": "\"Fine. I'll do it.\"",
          "nextNodeId": "node_pre_duel",
          "commands": []
        },
        {
          "id": "choice_decline_swap_second",
          "text": "\"I said no.\"",
          "nextNodeId": "node_no_way_out",
          "commands": []
        }
      ]
    },
    "node_no_way_out": {
      "id": "node_no_way_out",
      "speaker": "Duro Vantry",
      "text": "He looks past Anselm entirely, straight at you, and there's nothing unfriendly in it, which is worse. \"You're standing where his second stands. That's the whole of the custom. Doesn't much matter who holds the blade, only that someone does.\"",
      "choices": [
        {
          "id": "choice_grip_the_rapier",
          "text": "Grip the rapier.",
          "nextNodeId": "node_pre_duel",
          "commands": []
        },
        {
          "id": "choice_no_walking_away",
          "text": "There's no walking away now.",
          "nextNodeId": "node_pre_duel",
          "commands": []
        }
      ]
    },
    "node_pre_duel": {
      "id": "node_pre_duel",
      "speaker": "Narration",
      "text": "Anselm steps back into the crowd. Vantry draws.",
      "choices": [
        {
          "id": "choice_begin_duel",
          "text": "Begin the duel.",
          "commands": [
            {
              "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE",
              "payload": {
                "endeavorId": "endeavor_a_debt_in_steel",
                "nextPhaseId": "phase_the_duel",
                "unlocksNodesOnComplete": []
              }
            },
            {
              "type": "COMMAND_START_MINIGAME",
              "payload": {
                "minigameType": "DUEL",
                "opponentActorId": "actor_duro_vantry",
                "locationId": "poi_widowmaker_alley"
              }
            }
          ]
        }
      ]
    }
  }
}
```

`COMMAND_START_MINIGAME` doesn't exist in anything confirmed so far, DICE is currently entered through a POI action ("Gamble"), not a Dialogue Command. This is the one spot in the whole draft that most needs a real answer from the engine side: does a Dialogue Choice trigger a Minigame directly, or does this Choice just end the conversation and a POI action picks up from there? Written here the way it reads most naturally, but flagged.

---

## Phase: the Reckoning

Two separate Dialogues, one per outcome. Something on the Minigame side has to decide which one plays, that wiring isn't something this draft can specify.

**Win:**

```json
{
  "id": "dialogue_reckoning_win",
  "startNodeId": "node_victory",
  "nodes": {
    "node_victory": {
      "id": "node_victory",
      "speaker": "Duro Vantry",
      "text": "He lowers the blade, breathing hard, and there's something almost like respect in it. \"Debt's settled. Ring's satisfied.\" He nods once at the rapier. \"That's yours now, if you can hold it better than he could.\"",
      "choices": [
        {
          "id": "choice_take_winnings",
          "text": "Take the payment and the rapier.",
          "commands": [
            {
              "type": "COMMAND_ADJUST_CURRENCY",
              "payload": { "currency": "SILVER", "amount": 24 }
            },
            {
              "type": "COMMAND_GRANT_ITEM",
              "payload": { "itemId": "item_vantry_rapier", "quantity": 1 }
            },
            {
              "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE",
              "payload": {
                "endeavorId": "endeavor_a_debt_in_steel",
                "nextPhaseId": "phase_resolved",
                "unlocksNodesOnComplete": []
              }
            }
          ]
        }
      ]
    }
  }
}
```

**Lose:**

```json
{
  "id": "dialogue_reckoning_lose",
  "startNodeId": "node_defeat",
  "nodes": {
    "node_defeat": {
      "id": "node_defeat",
      "speaker": "Duro Vantry",
      "text": "He steps back, satisfied, wiping his blade. \"Debt's settled my way, then.\" Around you, the crowd's already losing interest, moving on to whatever's next. Nobody paid to see the second lose, they paid to see it settled.",
      "choices": [
        {
          "id": "choice_leave_widowmaker",
          "text": "Leave the alley.",
          "commands": [
            {
              "type": "COMMAND_ADJUST_REPUTATION",
              "payload": { "targetType": "faction", "targetId": "faction_wagering_ring", "amount": -10 }
            },
            {
              "type": "COMMAND_ADVANCE_ENDEAVOR_PHASE",
              "payload": {
                "endeavorId": "endeavor_a_debt_in_steel",
                "nextPhaseId": "phase_resolved",
                "unlocksNodesOnComplete": []
              }
            }
          ]
        }
      ]
    }
  }
}
```

The 3 silver from `phase_the_second` was already paid before the duel even started, so it's kept either way without needing any special handling here, nothing claws it back on a loss.

---

## Flags for the technical conversation

Things in this draft that follow the existing patterns by analogy but aren't confirmed:

- `COMMAND_ADJUST_CURRENCY` — shape assumed from the reputation Command's shape. Payload here is `{ currency, amount }`.
- `COMMAND_START_MINIGAME` — doesn't exist yet anywhere confirmed. Biggest open question in this draft: does a Dialogue Choice start a Minigame directly, or does the transition happen some other way (ending the Dialogue, then a POI action)?
- `COMMAND_GRANT_ITEM` — item/inventory Commands were confirmed to exist for losing an item on Minigame failure, but the shape for granting one as a reward hasn't been confirmed the same way.
- `minFactionReputation` on a Choice's `requires` — written by analogy to the confirmed `minActorReputation`, not itself confirmed to exist.

Everything else, `COMMAND_START_ENDEAVOR`, `COMMAND_ADVANCE_ENDEAVOR_PHASE`, `COMMAND_ADJUST_REPUTATION` targeting a Faction, `minActorReputation` gating, is used exactly as it already appears in the Mara Venn tree.
