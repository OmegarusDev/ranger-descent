/**
 * Tunable numeric constants — playtest-adjustable, never design-unknowns.
 */
export const CONFIG = {
  // Camera pitch clamp (degrees)
  PITCH_MIN: 8,
  PITCH_MAX: 58,
  PITCH_DEFAULT: 24,

  // Corridor dimensions (grid units)
  CORRIDOR_WIDTH: 5,
  CORRIDOR_LENGTH: 500,
  CELL_SIZE: 40,
  /** Worldspace hall length. Far junction must stay inside the view far plane. */
  HALL_LENGTH: 560,
  /** Stop this far short of the fork so the camera stands in the junction. */
  JUNCTION_STOP: 52,

  // On-rails movement
  PLAYER_SPEED: 0.2,
  ENEMY_SPEED_MULTIPLIER: 1.15,

  // Dungeon: 10 halls/floor × 10 floors/block × 10 blocks → final boss.
  // Start shafts: Gate (floors 1–10) plus unlockable E1–E9 (floor 11+). No E10.
  SECTIONS_PER_FLOOR: 10,
  FLOORS_PER_ELEVATOR: 10,
  ELEVATORS_PER_RUN: 10,
  /** Unlockable start elevators (E1–E9). Index 0 is Gate / surface. */
  START_ELEVATORS: 9,

  // Slingshot
  SLINGSHOT_MAX_POWER: 24,
  SLINGSHOT_MIN_POWER: 2,
  ARROW_SPEED: 400,
  ARROW_COOLDOWN_MULTIPLIER: 1.5,

  // Quiver
  QUEUE_SIZE: 4,
  ARROW_MAX_LEVEL: 5,

  // Bag holds carried consumables. Quick Pouch bindings point at bag indexes.
  BAG_CAPACITY_START: 2,
  BAG_CAPACITY_MAX: 8,
  BAG_SLOT_BASE_COST: 100,
  POUCH_CAPACITY_START: 1,
  POUCH_CAPACITY_MAX: 5,
  POUCH_SLOT_BASE_COST: 200,

  // Hub selling — 50% of purchase/base value. Arrow selling is a balance toggle.
  SELL_VALUE_RATIO: 0.5,
  SELL_STORAGE_ARROWS: true,

  POTION_SALVE_HEAL: 5,
  POTION_BANDAGE_HEAL: 10,
};
