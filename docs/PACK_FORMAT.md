# Mechanic Pack JSON — Schema 1

Kiragon pack files are self-contained UTF-8 JSON objects. Open the module's **Pack Library & JSON Editor** to import or edit them. Each pack must have unique, stable `id` values for itself, clocks, tracks, actions, adversaries and item templates. All IDs must match `[a-z][a-z0-9-]{1,49}`.

## Minimal working example

```json
{
  "schema": 1,
  "id": "arcane-burn",
  "name": "Arcane Burn",
  "version": "0.1.0",
  "description": "An unstable weave of magic makes adventurers burn through a reservoir.",
  "clocks": [
    {"id": "surge", "label": "Surge Timer", "minutes": 30, "bells": 6, "pauseDuringCombat": true, "combatCostMinutes": 5}
  ],
  "tracks": [
    {
      "id": "stability",
      "label": "Arcane Stability",
      "source": "fixed", "initial": 12,
      "normalLabel": "Stable", "terminalLabel": "Consumed by the Weave",
      "clock": {"id": "surge", "loss": "fractional", "fraction": 0.5},
      "tiers": [
        {"atOrBelow": 0.5, "label": "Unstable", "power": 0},
        {"atOrBelow": 0.25, "label": "Critical", "power": 0}
      ],
      "effects": [
        {"kind": "flat-modifier", "selector": "arcana", "basedOn": "missing", "multiplier": -0.5, "type": "status", "label": "Arcane Instability", "minTier": 1}
      ]
    }
  ],
  "actions": [
    {"id":"spend", "label":"Spend 2 Stability", "track":"stability", "kind":"adjust", "amount":-2},
    {"id":"recover", "label":"Recover 1 Stability", "track":"stability", "kind":"adjust", "amount":1}
  ],
  "adversaries": [],
  "items": []
}
```

The engine does not interpret arbitrary script text or custom JavaScript in JSON files. It only recognizes the built-in action kinds, resource effects and attack procedures below.

## Tracks

`source`: `actor-will` (captures the original PF2e Will save modifier at enrollment) or `fixed` (requires positive integer `initial`).

A track's **current value** equals baseline minus scheduled clock loss minus manually spent resource plus restored resource, clamped between zero and baseline. `clock.fraction` is a number between 0 and 1, where `1.0` drains the entire baseline across all bells. When `fraction` is exactly 1 and the last bell sounds, the track reaches zero **regardless of previous healing**. If the track becomes zero by any means it is marked *Lost* and cannot be restored except by a GM reset/unenrollment.

`tiers` must list descending `atOrBelow` fractions, such as 0.75 → 0.5 → 0.25. Each tier has `label` and integer `power`. Power is used by `key-attribute` effects and `surrender` actions.

`effects`: supported kinds:

- `flat-modifier`: adds a PF2e `FlatModifier` to the affected actor. Fields: `selector` (e.g. `will`, `fortitude`, `reflex`, `athletics`, `arcana`, `attack`), `basedOn` (`missing`, `remaining`, `tier`, `power`, `fixed`), numeric `multiplier`, optional `type` (`status`, `circumstance`, `item`, or `untyped`), `label`, and optional integer `minTier` / `maxTier`.
- `key-attribute`: adds a PF2e `ActiveEffectLike` rule that targets `system.abilities.<key>.mod`, with `basedOn: "power"`. This is experimental; PF2e derived-stat effects should be tested on a disposable character in your system version.

A `flat-modifier` on `will` based on `missing` automatically compensates for the **Wisdom** increase when the key ability is Wisdom, preventing the boosted Wisdom from canceling Erosion.

## Actions

Each action requires `id`, `label`, `kind`, and a valid `track` id. Optional fields include `description`, `requiresTier`, `once: "expedition" | "encounter-or-bell"`, and `group` (a shared cooldown category).

| `kind` | Fields | Effect |
| --- | --- | --- |
| `adjust` | `amount` signed integer | Positive restores; negative drains |
| `rupture` | `costByTier` array | Drains the current tier's configured value |
| `surrender` | `surrender` integer, `restore` integer | Permanently sacrifices some available power for resource restoration |
| `overdrive` | `amount` negative, optional `bonus` | Drains resource, grants a temporary item rule effect |
| `announce` | `description` | Posts a scene/roleplay prompt to chat |
| `grant-effect` | `bonus` | Grants a short-lived PF2e Effect item |

`bonus` is a PF2e FlatModifier template: `{"selector":"attack", "value":1, "type":"circumstance", "removeAfterRoll":true}`. Its selector is configured by the pack, not automatically inferred from the character's attributes. A temporary effect lasts one minute or until an eligible roll uses it.

## Adversaries

Each `adversaries[]` record contains `id`, `actor` (a native PF2e NPC actor source), and `abilities[]`.

- `save`: the GM launches a target PF2e save against a fixed `dc`, using `defense: "reflex" | "fortitude" | "will" | "perception"`.
- `skill-vs-perception`: the monster rolls a `skill` (e.g. `deception`) against the target's Perception DC.

Each ability defines `track` (which pool to reduce) and `erosion` mapping degree names to nonnegative integer resource loss, for example `{"criticalFailure":2,"failure":1}` for a targeted save or `{"criticalSuccess":2,"success":1}` for an offensive skill check. Optional `conditionOnCriticalFailure` attempts to apply a PF2e condition to the target. Range, duration and creature tactics should be detailed in `note` and are GM-adjudicated.

Imported NPCs are ordinary **world Actors**, tagged to avoid duplicates. Their normal PF2e actions, skills and sheets still work. The module-specific resource attacks are resolved through the **Adversaries** section of the Kiragon dashboard.

## Importable PF2e Items

Top-level `items` is optional. Each entry has a unique `id` and an ordinary native PF2e `Item` source under `document`:

```json
"items": [
  {
    "id": "scar-effect",
    "document": {
      "name": "Scar of the Veil",
      "type": "effect",
      "system": {
        "description": {"value": "<p>A supernatural mark.</p>"},
        "duration": {"value": -1, "unit": "unlimited", "sustained": false},
        "traits": {"value": []},
        "rules": [{"key": "FlatModifier", "selector": "will", "type": "status", "value": -1}]
      }
    }
  }
]
```

You can also import PF2e feats, spells and equipment using their native Foundry Item source data. Importing puts them in the **Items directory**; it does not automatically grant them to player characters. Import is idempotent by pack id + item id.

## Changing an installed pack

- **Safe:** edit descriptions, new actions, thresholds and supported effects; export a backup before every change.
- **Use caution:** changing clock minutes/bells after the timer has started can produce unexpected bell transitions (stored runtime state persists until reset).
- **Disallowed while characters enrolled:** removing existing track ids. Use `Reset this pack` to clear their state first.
- **Avoid:** changing pack id (creates a different, parallel pack) or using two modules to modify the same character simultaneously.

## Other Notes

The JSON parser validates identifiers, component shapes, action kinds, track references, clocks, outcomes, and basic resource data. It is **not** a complete validation of all PF2e actor/item source document shapes; Foundry will validate those when importing them, and may reject source data created for incompatible PF2e versions. Imported content is not automatically rendered in a compendium pack: the initial implementation imports into world Actors/Items, and exports rules as standalone JSON.
