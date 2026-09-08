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

  // On-rails movement
  PLAYER_SPEED: 0.2,

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

  // Quiver
  QUEUE_SIZE: 4,
  ARROW_MAX_LEVEL: 5,


};
