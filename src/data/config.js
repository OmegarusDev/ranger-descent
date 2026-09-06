/**
 * Tunable numeric constants — playtest-adjustable, never design-unknowns.
 */
export const CONFIG = {
  // Camera pitch clamp (degrees)
  PITCH_MIN: 8,
  PITCH_MAX: 58,
  PITCH_DEFAULT: 24,

  // Corridor dimensions (grid units)
  CORRIDOR_WIDTH: 10,
  CORRIDOR_LENGTH: 500,
  CELL_SIZE: 40,

  // On-rails movement
  PLAYER_SPEED: 4.5,

  // Slingshot
  SLINGSHOT_MAX_POWER: 24,
  SLINGSHOT_MIN_POWER: 2,
  ARROW_SPEED: 400,

  // Quiver
  DECK_SIZE: 20,
  QUEUE_SIZE: 4,
  ARROW_MAX_LEVEL: 5,

  // Souls
  SOULS_PER_KILL: 1,

  // Substrate
  SUBSTRATE_COLS: 8,
  SUBSTRATE_ROWS: 500,
};
