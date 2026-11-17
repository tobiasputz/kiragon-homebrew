# Kiragon Homebrew — Leif's Hope: Abyss Encounters (v1.0.0)

**Drop-in content expansion, NOT a replacement module.** Compatible design target: existing `kiragon-homebrew` module v1.3.x; PF2e world in Foundry VTT v13+. This expansion has no separate module manifest and does not overwrite Kiragon files.

## Installation

1. Make a world backup before modifying Foundry data.
2. Stop Foundry (or ensure that it is not updating modules). Extract `Kiragon-Leifs-Hope-Expansion-v1.0.0.zip` **into `FoundryVTT/Data/modules/`**, allowing the single contained `kiragon-homebrew/` folder to merge with the existing one. Do **not** delete or replace the existing Kiragon module. The new content lands in `Data/modules/kiragon-homebrew/expansions/leifs-hope/`.
3. Restart Foundry and enable `Kiragon Homebrew` in your PF2e world. Keep `Abyssal Erosion` mechanic pack enabled in Kiragon.
4. Create a **Script** macro in Foundry, and paste exactly:

   ```js
   await (await import('/modules/kiragon-homebrew/expansions/leifs-hope/scripts/install.mjs')).install();
   ```

   Alternative: create a blank macro and use **Import Data** on the separately provided `Kiragon-Install-Leifs-Hope-Macro.json`; then run it as GM.
5. Run the installer **once** as GM. It idempotently creates NPCs under **Actors > Kiragon — Abyss: Leif's Hope**, five encounter **Journals**, two permanent boon **Items**, and eight GM **Macros** plus the installer. Running again does not duplicate them.
6. Open **Kiragon — Open Erosion Dashboard** to enroll PCs as before and start or continue your normal Kiragon stopwatch. Open the new encounter macros as the scene happens.

## Included scenes

- **01 The Footsteps That Arrive First** — chase, 3 VP, GM chase macro.
- **02 The Thing That Begs to Be Killed** — Grief, comfort 3 VP; can be suppressed but never killed.
- **03 Joy vs Anger: Contest of Feelings** — 5 rounds, each PC independent Happiness and Anger 0–5; first 5 grants one permanent boon and costs one Erosion Will; neither threshold gives nothing. Alternative reconciliation is 3 VP for each emotion. GM competition macro automatically calls the **existing** Kiragon API to debit exactly 1 Identity (Will) when threshold is reached, and adds the permanent boon Item to the PC. If the Kiragon call fails, it records **PENDING** and offers a 'Repair Pending Gifts' button instead of silently losing rewards.
- **04 The Four Who Are One** — Fear, Shame, Love, Anger; all four must be accepted. GM fragment tracker macro.
- **05 Leif's Hope / The End of Wanting** — unique level-16 boss Resignation, 6 VP in 3 barriers, plus its PF2e NPC sheet. Boss cannot die. Hope is a separate being from the existing guiding wisp, whose identity is not changed.

## Art and tokens

Portraits for Joy and Anger use **the user's original two supplied images**, without new artwork. The Grief, Resignation, and Hope portraits reuse art already generated in the conversation. Each has a 512 × 512 transparent, round-cropped `.webp` token. Leif's four emotions intentionally reuse the same Hope/Leif image because they appear identical. No new images were generated to build this content pack.

## Kiragon interoperability and Erosion safety

The original Kiragon module remains the owner of the Erosion clock, player enrollment, and state. This expansion stores **encounter-specific counters** in a GM Journal's world flags under `kiragon-homebrew`, and interacts with the original pack only when a contest winner reaches 5 points:

```js
await game.modules.get('kiragon-homebrew').api.adjust(
  actor, 'abyssal-erosion', 'identity', -1,
  'Contest of Feelings: 5 joy' // or anger
);
```

The contest never directly edits actor ability scores or the Erosion timer. The separate `Kiragon — Reset Abyss Trackers` macro resets only these five encounter trackers; it **does not** restore Erosion Will or remove earned gifts.

### Automation boundaries

- **Automated:** NPC/Journals/Items/Macro creation; contest counters; 5-point winner detection; one Kiragon Erosion debit on threshold; delivery of the permanent world Item to the PC; progress persistence; VP & reconciliation tracking; Four-fragment decisions.
- **GM adjudication:** actual rolls, actions/targets/ranges, condition application, PF2e bonuses, once-per-day use of gift abilities, boss strike effects, damage totals and boss Fractured Certainty, temporary dispersal/reform at 0 HP, and any failure consequences. For convenience, a **Kiragon — Reform Emotion (Selected)** macro restores a selected defeated emotional NPC to 1 HP (full HP for Resignation). The fight's narrative victory condition is **never creature death**.
- If your Kiragon pack's API has changed from v1.3.x, the prize will be shown as **PENDING** rather than the module modifying Erosion by an unsafe alternative method. Test the whole flow on a disposable PC before your session.
- The existing stopwatch continues ticking; there are no additional timed drains unless explicitly triggered by the original Erosion pack or manually by the GM for the final boss ability.

## GM quick checks

1. Place Joy and Anger on a scene; their portraits and token images should render.
2. Open the contest macro. Add +1 and +2 Happiness to one test PC until it reaches 5. Verify only one Erosion point is drained, and **Gift of Joy (Abyss)** is added to their actions. Attempt extra point additions: nothing should change. Use a disposable test character and restore its state afterward.
3. Test a different PC at 4 Anger and 4 Happiness, then end the round-5 contest; no boon and no extra Erosion should be applied.
4. Check the boss macro increments each 2-VP stage, never crossing stages by excess points from a critical success.
5. Check that **Kiragon — Open Erosion Dashboard** still opens the original stopwatch as before.

## Technical notes

Content creation is idempotent using `flags.kiragon-homebrew.leifsHopeActor`, `.leifsHopeId`, `.leifsHopeBoon`, and `.leifsHopeMacro`. The state Journal is tagged `leifsHopeKind = 'state'`. Changes to actor sheets or Journals after import are retained on subsequent installer runs (not overwritten). For a content update, remove individual tagged world docs before reinstalling, or edit manually. The content pack deliberately contains no `module.json` and no Kiragon core files.
