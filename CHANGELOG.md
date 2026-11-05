# Kiragon Homebrew 1.1.0

- Replaced the 90-minute global Abyssal deadline with an indefinitely repeating 10-minute bell.
- Each bell subtracts 2 Will from every enrolled character, so stronger Will saves last longer.
- Added generic `repeat: true` clocks and `loss: fixed` with configurable `amount` to the pack engine.
- Preserves legacy fixed-length clocks for other packs, including Fate Scars.
- Migrates the original built-in Abyss pack (version 1.1.0), resetting its old clock while preserving actor non-clock Erosion.
- Adjusted countdown display, pause, resume, manual advancement, combat cost, and offline clock catch-up for repeat bells.
- Added tests for differential survival and repeating clocks.

# Changelog

## 1.0.0

- First general-purpose Kiragon PF2e mechanic-pack runtime.
- Configurable character resources, clocks, staged modifiers, actions and per-pack state.
- JSON file import/export/editor and pack enable/disable controls.
- PF2e actor/item template importer, signature NPC resource attacks and conditions.
- Conversion of Abyssal Erosion to a standalone mechanic pack, preserving three level-13-party NPCs.
- Legacy actor-state migration from the original Abyssal Erosion module.
- Automated pure-engine and mocked Foundry integration tests and GitHub Release workflow.
