# Kiragon Homebrew Engine v1.3.1

## What changed in v1.3.1

- **Fixed startup behavior:** The Abyss stopwatch runs through combat by default. Earlier releases could immediately pause it whenever a combat was already active.
- **Reduced drain:** Every bell now removes **1 Will** instead of 2. Bell interval remains configurable, defaulting to 10 minutes.
- **Live stopwatch:** Counts upward from 00:00. Time is calculated from a stored timestamp, so delayed browser ticks are caught up when the primary GM reconnects.
- **Save-data migration:** Existing Abyssal Erosion packs with 2 Will per bell are updated automatically, preserving existing loss, recorded bells, and custom bell interval. It converts the extra historical Will loss into permanent recorded spending to prevent healing characters on upgrade. Non-Abyss packs are untouched.
- **Still GM-authoritative:** An active primary GM client must be connected for bells to apply to characters. A running stopwatch computes elapsed real time and catches up once the GM reconnects; Foundry is not a background server timer.

### Quick test (as the first active GM)

1. Open Kiragon, enable Abyssal Erosion and enroll one player-owned character.
2. Check the stopwatch shows **Paused** and **00:00** after Reset; press **Start / Resume**. It should show **Running** and advance every second.
3. Use **+10 min** to trigger an immediate bell and confirm Identity falls exactly 1 point.
4. If it still does not advance, open Foundry's browser developer console (F12) and look for Kiragon errors. Other logged-in GMs should close the world for testing.
5. Resetting the stopwatch **never refunds** Will lost to previous bells. Use Reset this pack only if you deliberately want to erase enrolled character state.

## Previously added in v1.2.0

- **Player characters only:** The GM dashboard's enrollment and monster target lists contain PF2e `character` actors with **Owner** permission assigned to at least one non-GM player. Ordinary NPCs and unassigned GM character sheets are excluded. Assign character ownership in Foundry before enrolling.
- **A stopwatch, not a deadline:** The Abyss clock begins at **00:00** and counts upward forever, ringing a bell every 10 minutes by default. The dashboard shows the elapsed time, bells sounded, and time until the next bell.
- **Bell cadence:** Change the bell interval directly from the GM dashboard (whole minutes). The stopwatch must be reset to change the interval. You can pause/resume, advance +1/+5/+10 minutes, or reset.
- **Safe stopwatch reset:** Resetting carries clock-inflicted Erosion into permanent recorded spending, so Will is *not* restored. To fully restart a campaign, use the existing **Reset this pack** control (which removes character enrollment and state), then reenroll.
- **Player-facing HUD:** A compact, read-only display of the current player's enrolled character(s), each custom resource, current polarization tier, and the Surge/Crash details of their key attribute. Other players' characters are not shown. The HUD opens automatically for players with an enrolled character, unless they disable **Automatically open Kiragon HUD for players** under module settings.

## Foundry installation and update

For a direct installation, extract `kiragon-homebrew.zip` into your Foundry `Data/modules/kiragon-homebrew/` folder. Otherwise, publish the release assets `module.json` and `kiragon-homebrew.zip` under the GitHub release tag `v1.3.1`; Foundry can update using:

`https://github.com/tobiasputz/kiragon-homebrew/releases/latest/download/module.json`

**GM dashboard macro:**
```js
game.modules.get('kiragon-homebrew').api.open();
```

**Player HUD macro (also works for GM preview):**
```js
game.modules.get('kiragon-homebrew').api.openHUD();
```

The original `api.open()` macro now routes ordinary players to their HUD and GMs to the management dashboard.

**Settings:** Enable the module inside the PF2e world; assign the player accounts **Owner** permission for their character actors. Enable the Abyssal Erosion pack, enroll the player characters, and press Start / Resume on the stopwatch. Each bell subtracts 1 Will from enrolled characters, and the remaining Will determines each character's key-attribute polarization. All monster abilities and other homebrew packs remain available.

**Note:** If you already customized the Abyssal Erosion JSON pack, your saved definition is preserved. The new stopwatch UI works with its existing `repeat: true` clock. The module is designed for Foundry VTT 13 and PF2e and has been checked with automated mocks, but not executed in a live Foundry world.

---

# Kiragon — Modular Homebrew Engine

**Foundry VTT 13+ · Pathfinder Second Edition · v1.0.0**

Kiragon is a **data-driven, extensible GM homebrew toolkit**. Instead of one hard-coded Abyss adventure, it runs multiple independently installable *mechanic packs* (JSON files). Each pack can define resource pools, timed clocks, stages/thresholds, automated PF2e rule-element effects, GM actions, world item templates, and NPCs with custom attacks against those resources.

**Included packs:**

1. `Abyssal Erosion` — your original adventure: Will-based identity, escalating key-attribute power, indefinite 10-minute stopwatch, emotional temptations and ruptures, and three spectral monsters for a level-13 party.
2. `Fate Scars (Example)` — a small unrelated pool and ritual clock, with a sample PF2e Effect item; suitable as a starter template.

Packs are **disabled until the GM enables them**. Mechanics from one pack do not interfere with another pack's actor flags, clocks or rule-element effect items.

## Install manually (no GitHub needed)

Extract the contents of `kiragon-homebrew.zip` into:

```
FoundryVTT/Data/modules/kiragon-homebrew/
  module.json
  scripts/
  styles/
  packs/
```

The `module.json` must be directly inside the `kiragon-homebrew` folder. Restart Foundry and turn on **Kiragon — Modular Homebrew Engine** in **Game Settings → Manage Modules**. For a GitHub release install, see `GITHUB.md`.

**IMPORTANT:** Disable the old `Abyssal Erosion` module to prevent duplicate sheet effects or competing clocks. Its old state can be migrated after enabling this replacement.

## Quick start

1. Open a **PF2e** world as a GM.
2. Open **Kiragon Homebrew Engine** from Token controls or Game Settings, or use this macro:

```js
game.modules.get('kiragon-homebrew').api.open();
```

3. Select **Abyssal Erosion** and click **Enable pack**.
4. Enroll each player character. The engine captures their starting Will modifier (avoid temporary buffs while enrolling) and finds their key ability.
5. Click **Import NPCs** in the Adversaries section to create Grasping Regret (level 12), Hollow One (level 13), and Mirror of Longing (level 14) in the Actors directory.
6. Run the **Abyssal stopwatch**. Every 10 minutes (or after GM manual advancement), a bell progressively reduces their Identity pool. The same track gains key-attribute power at 75%, 50%, and 25% Will remaining.
7. Use the actor cards for Erosion, emotional Ruptures, Overdrive, recovery, and the NPC signature-ability roller.

Clocks are **real time**, not Foundry's game-time clock. While a clock runs, the primary active GM handles bell transitions. Other custom packs may optionally pause during combat; the Abyss stopwatch does not pause by default. Other players see the updated world state and actor effects.

## Use other homebrew packs

Open the dashboard **Pack Library & JSON Editor** to:

- Import a compatible `.json` pack from your computer.
- Edit an existing pack's JSON, validate it, and save it into the Foundry world.
- Create a new pack by copying the small Fate Scars example.
- Export a pack for backup, sharing or Git version control.
- Enable/disable packs independently, enroll actors and run their unique clocks.
- Import a pack's **PF2e NPC actor templates** into the Actors directory and its **PF2e item templates** into Items.

The import format is documented in [`docs/PACK_FORMAT.md`](docs/PACK_FORMAT.md). There is no eval or dynamic user-script execution: imported pack logic is restricted to explicitly supported actions. Rich actor/item source documents still come from the importing GM—review third-party JSON before installing it.

### Supported mechanics

| Component | Options |
| --- | --- |
| Resource | Starting value from a PF2e Will save or fixed integer; drain, recovery, irreversible zero threshold |
| Clock | Real-world countdown, configurable bells, optional combat pause / fixed combat cost |
| Clock drain | Percentage of original resource drained proportionally with bells |
| Tiers | Thresholds based on percentage remaining, names and increasing `power` |
| Sheet effects | PF2e `FlatModifier` and key-attribute `ActiveEffectLike` (with optional tier limits) |
| Actor actions | Adjust resource, resist a rupture, announce narrative choice, Overdrive, surrender power for healing, grant a temporary effect |
| Creature abilities | Target PF2e Fortitude/Reflex/Will/Perception or roll NPC skill vs Perception DC, mapping degree of success to resource loss |
| World templates | Import NPCs, spells, feats, effects or other native PF2e Items as JSON documents |

**Not supported in v1.0:** arbitrary JavaScript action scripts; visual drag-and-drop mechanic authoring; automatic AoE targeting; adjudicating NPC attack ranges; automatic expiration of narrative conditions; synchronization to game-world time; class/item creation forms beyond native PF2e item JSON. The dashboard's JSON editor is the primary authoring interface.

## Existing Abyssal Erosion migration

1. **Back up the world** in Foundry before updating.
2. Disable the original `abyssal-erosion` module (leave it installed if you want to migrate its flags).
3. Enable Kiragon, then **Enable pack** for Abyssal Erosion.
4. Click **Import old Abyssal Erosion character states** and confirm. Only actors not already enrolled are migrated; old managed Abyss effect items are removed, preserving Will pool, key ability, accumulated drain and recovery.
5. The old clock is **not** migrated: choose a clean countdown or manually advance the new clock to your session's point. Do not enable both modules together.

Actors' flags are stored under `flags.kiragon-homebrew.packs.<pack-id>`. World pack definitions and clock states are stored as Foundry world settings. Exporting a pack does **not** include party progress or active clock state.

## Console/API (for macros)

```js
const api = game.modules.get('kiragon-homebrew').api;
api.open();
const actor = game.actors.getName('My Character');
// If the pack is enabled:
await api.enroll(actor, 'abyssal-erosion');
await api.adjust(actor, 'abyssal-erosion', 'identity', -2, 'Abyssal attack');
await api.action(actor, 'abyssal-erosion', 'rupture-resist');
console.log(api.getResource(actor, 'abyssal-erosion', 'identity'));
// Import the included creatures
await api.importAdversaries('abyssal-erosion');
// View the currently installed JSON packs
console.log(api.listPacks());
```

For a new custom pack:

```js
const pack = JSON.parse('{"schema":1,"id":"..."}'); // Replace with a complete pack document
await api.importPack(pack);
await api.enable(pack.id);
```

## PF2e-specific caveats / testing

- The module is **not a full replacement for the PF2e rules system**. It creates actual PF2e Effect items on characters via `FlatModifier` and `ActiveEffectLike` Rule Elements. These are recomputed, not destructive changes to source attributes.
- The Abyssal **Wisdom** power boost includes a corresponding offset to its Will penalty: it should not replenish the identity it is consuming.
- Imported NPCs are standard actor documents, but their signature Erosion abilities are launched **from Kiragon's dashboard**. Most supplementary conditions and durations are explained in chat and may need GM adjudication.
- The Overdrive demonstration grants **+1 circumstance to the next attack roll** (not all key-ability checks). Change the `bonus.selector` in its pack definition to suit your table.
- `ActiveEffectLike` on an ability modifier and system internals can change between PF2e versions. Confirm your character's derived attributes, strikes, spell DC and Will behavior with a test actor **before** your live session. This has been validated with automated Node tests, not a running Foundry client.
- A character marked Lost remains lost until explicitly unenrolled or the pack is reset. A clock whose `fraction` is 1 makes the last bell an absolute deadline, even if resources were restored.

## Development / tests

```bash
node --test tests/*.test.mjs
python3 tools/build_release.py --repository YOUR_ACCOUNT/YOUR_REPO --tag v1.0.0
```

To install from GitHub releases, use the `module.json` file uploaded to the release, not GitHub's `/blob/` viewer. The release workflow generates the appropriate `download` URL and ZIP archive.

This is a custom, unofficial Foundry module. Back up world data before migrating or changing pack IDs. The automations and JSON schema are explicitly limited for reliability and safe debugging.


## Erosion: repeating bell (v1.1.0)

The Abyss pack no longer has a universal time limit. Every **10 minutes of active exposure**, each enrolled character suffers **2 Erosion**, measured as a loss of their starting Will modifier. A character starting with Will +16 survives 8 bells (80 minutes); Will +24 survives 12 bells (120 minutes), before additional monster drains, recovery, or temptation. The bell repeats indefinitely and its next interval countdown resets automatically.

The frequency and drain are editable in the JSON pack: `clocks[0].minutes` and `tracks[0].clock.amount`. The mechanic does **not** drain a percentage of each character's original Will. Monster abilities still deal independent Erosion. The global timer counts exposure, not an automatic ending.

Existing worlds with the original built-in Abyss pack version `1.1.0` are upgraded automatically: enrolled characters keep their recorded non-clock Erosion, but the old absolute clock is reset. If you manually customized that earlier built-in pack, export it before upgrading. Custom packs with other version numbers are left unchanged.
