# Current Architecture Contract

This document describes the live codebase. Changes must preserve or improve
observable game behaviour. A refactor is not complete until the relevant
contract tests and manual smoke checks pass.

## Boundaries

- `src/game/` owns simulation, state, progression, combat, loot, and inventory.
- `src/engine/` owns canvas rendering, projection, FX, and input-independent drawing.
- `src/ui/` owns hub sheets and loadout presentation.
- `src/main.js` wires the simulation, engine, and HTML UI.
- `src/data/` owns tunable constants.

The engine must not import game rules. Game data is passed into renderers as
small descriptors when a visual needs it.

## Public Simulation Behaviour

These behaviours are externally visible and must remain stable unless the
change is explicitly approved:

- Runs start with the equipped quiver and current progression.
- Combat remains fixed-step and real-time.
- Junction choices use the rolled `junctionChoices` payload and call
  `chooseJunction(direction)`.
- Hall loot is acknowledged before approach to a junction or elevator.
- Wood never enters permanent arrow storage.
- Death, victory, escape, and elevator checkpoints reconcile currency and loot
  exactly once.

## Persistence

Save data is normalized at load boundaries. Ordinary mid-run state is
ephemeral. Elevator checkpoints bank the purse, reconcile recoverable stash,
and save a safe persistent snapshot before offering continue or return.

Legacy `pouch` item arrays are ignored. Bag and pouch capacities clamp to
their current maxima, and pouch capacity cannot exceed bag size.

## Inventory

- `state.bag` holds carried consumable instances. Starts at 2 slots, max 8.
  Extra bag slots cost 100, then double (200, 400, …) up to 8.
- `state.pouchBindings` points at bag indexes for real-time HUD use. Starts at
  1 slot, max 5, and cannot exceed current bag size. Extra pouch slots cost
  200, then double (400, 800, 1600).
- `CorridorSim.useConsumable()` is the only consumable path for bag and pouch.
- Hub selling uses centralized sell values. Bows cannot be sold. Equipped or
  pouch-bound items must be unequipped or unbound first.

## Dormant Magic

`AutoMagicSystem`, `hexUnlock`, and `prayerUnlock` are intentionally dormant.
They remain for a future Magic patch and must not be integrated into ordinary
runs during this cycle.

## Change Rule

Prefer the smallest change that removes a confirmed defect or clarifies an
existing contract. Do not duplicate a domain rule in UI code. Add a focused
test before changing a persistence, quiver, progression, loot, or transition
invariant.
