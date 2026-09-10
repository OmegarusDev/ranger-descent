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

## Dormant Magic

`AutoMagicSystem`, `hexUnlock`, and `prayerUnlock` are intentionally dormant.
They remain for a future Magic patch and must not be integrated into ordinary
runs during this cycle.

## Change Rule

Prefer the smallest change that removes a confirmed defect or clarifies an
existing contract. Do not duplicate a domain rule in UI code. Add a focused
test before changing a persistence, quiver, progression, loot, or transition
invariant.
