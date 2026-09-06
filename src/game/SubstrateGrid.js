/**
 * SubstrateGrid — tracks corridor floor tile states (Oil, Moss, Water, Fire,
 * Dry, Ice) and processes real-time elemental chain reactions when struck
 * by arrows or spells.
 *
 * No rendering or entity dependencies — pure data + reaction logic.
 */
import { CONFIG } from "../data/config.js";

/** Substrate types on the corridor floor. */
export const SUBSTRATE = {
  DRY: 0,
  OIL: 1,
  MOSS: 2,
  WATER: 3,
  FIRE: 4,
  ICE: 5,
  TOXIC: 6,
  CORROSIVE: 7,
  WILDFIRE: 8,
};

export const SUBSTRATE_NAMES = {
  [SUBSTRATE.DRY]: "dry",
  [SUBSTRATE.OIL]: "oil",
  [SUBSTRATE.MOSS]: "moss",
  [SUBSTRATE.WATER]: "water",
  [SUBSTRATE.FIRE]: "fire",
  [SUBSTRATE.ICE]: "ice",
  [SUBSTRATE.TOXIC]: "toxic",
  [SUBSTRATE.CORROSIVE]: "corrosive",
  [SUBSTRATE.WILDFIRE]: "wildfire",
};

export const SUBSTRATE_COLORS = {
  [SUBSTRATE.DRY]: "#1c222a",
  [SUBSTRATE.OIL]: "#2a1e12",
  [SUBSTRATE.MOSS]: "#1a2a18",
  [SUBSTRATE.WATER]: "#14202a",
  [SUBSTRATE.FIRE]: "#3a1a0a",
  [SUBSTRATE.ICE]: "#1a2830",
  [SUBSTRATE.TOXIC]: "#201428",
  [SUBSTRATE.CORROSIVE]: "#1a2812",
  [SUBSTRATE.WILDFIRE]: "#3a220a",
};

/**
 * Reaction result: what happens when an arrow hits a substrate tile.
 * Returns an array of effects to apply.
 */
const REACTIONS = new Map([
  // Oil + Fire Arrow → Inferno Detonation (AoE fire burst)
  ["oil+fire", [
    { type: "aoe_damage", element: "fire", radius: 2, damage: 15 },
    { type: "substrate_spread", to: SUBSTRATE.FIRE, radius: 1 },
    { type: "vfx", effect: "inferno" },
  ]],

  // Moss + Oil + Fire Arrow → Wildfire Patch (persistent fire zone)
  ["moss+fire", [
    { type: "dot_zone", element: "fire", duration: 5, dps: 3 },
    { type: "substrate_convert", to: SUBSTRATE.WILDFIRE },
    { type: "vfx", effect: "wildfire" },
  ]],

  // Moss + Oil + Poison Arrow → Toxic Canopy (stacking poison fog)
  ["moss+poison", [
    { type: "dot_zone", element: "poison", duration: 6, dps: 2 },
    { type: "status_stack", status: "poison", stacks: 3 },
    { type: "substrate_convert", to: SUBSTRATE.TOXIC },
    { type: "vfx", effect: "toxic_canopy" },
  ]],

  // Ice + Fire Arrow → Thermal Shock (shatters frozen targets)
  ["ice+fire", [
    { type: "instant_shatter" },
    { type: "aoe_damage", element: "fire", radius: 1, damage: 8 },
    { type: "substrate_convert", to: SUBSTRATE.DRY },
    { type: "vfx", effect: "thermal_shock" },
  ]],

  // Poison + Oil → Corrosive Acid (strips Heavy Armor)
  ["oil+poison", [
    { type: "strip_armor", armorType: "heavy" },
    { type: "dot_single", element: "acid", duration: 4, dps: 4 },
    { type: "substrate_convert", to: SUBSTRATE.CORROSIVE },
    { type: "vfx", effect: "corrosive" },
  ]],

  // Fire Arrow on Dry → minor ignite
  ["dry+fire", [
    { type: "substrate_spread", to: SUBSTRATE.FIRE, radius: 0 },
    { type: "vfx", effect: "ignite" },
  ]],

  // Ice Arrow on Water → freeze
  ["water+ice", [
    { type: "substrate_convert", to: SUBSTRATE.ICE },
    { type: "vfx", effect: "freeze" },
  ]],

  // Fire Arrow on Ice → melt
  ["ice+fire_direct", [
    { type: "substrate_convert", to: SUBSTRATE.WATER },
    { type: "vfx", effect: "melt" },
  ]],
]);

/**
 * Lookup a reaction by substrate + arrow element.
 * Arrow element is the arrow's type; substrate is the tile's state.
 */
function reactionKey(substrateType, arrowElement) {
  const sub = SUBSTRATE_NAMES[substrateType] || "dry";
  return `${sub}+${arrowElement}`;
}

export class SubstrateGrid {
  constructor() {
    this.cols = CONFIG.SUBSTRATE_COLS;
    this.rows = CONFIG.SUBSTRATE_ROWS;
    this.cells = new Uint8Array(this.cols * this.rows); // all DRY by default
    this._pendingReactions = [];
  }

  init() {
    this.cells.fill(SUBSTRATE.DRY);
    // Scatter some starting substrates for variety
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);
      const types = [SUBSTRATE.OIL, SUBSTRATE.MOSS, SUBSTRATE.WATER, SUBSTRATE.ICE];
      this.set(x, y, types[Math.floor(Math.random() * types.length)]);
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  get(x, y) {
    return this.inBounds(x, y) ? this.cells[y * this.cols + x] : SUBSTRATE.DRY;
  }

  set(x, y, type) {
    if (this.inBounds(x, y)) this.cells[y * this.cols + x] = type;
  }

  /** Get the grid cell index for flat access. */
  _idx(x, y) {
    return y * this.cols + x;
  }

  /**
   * Process an arrow impact on a substrate tile.
   * @param {number} gridX - grid column
   * @param {number} gridY - grid row
   * @param {string} arrowElement - arrow type (fire, oil, poison, ice, etc.)
   * @returns {Array} effects to apply
   */
  onArrowImpact(gridX, gridY, arrowElement) {
    const substrate = this.get(gridX, gridY);
    const key = reactionKey(substrate, arrowElement);
    const reaction = REACTIONS.get(key);

    const effects = [];

    if (reaction) {
      effects.push(...reaction);
    }

    // Default: fire/oil/poison/ice arrows can spread their element to dry tiles
    if (effects.length === 0 || !effects.some(e => e.type === "substrate_spread")) {
      if (arrowElement === "oil" && substrate === SUBSTRATE.DRY) {
        effects.push({ type: "substrate_convert", to: SUBSTRATE.OIL });
      } else if (arrowElement === "moss" && substrate === SUBSTRATE.DRY) {
        effects.push({ type: "substrate_convert", to: SUBSTRATE.MOSS });
      } else if (arrowElement === "ice" && substrate === SUBSTRATE.DRY) {
        effects.push({ type: "substrate_convert", to: SUBSTRATE.ICE });
      }
    }

    // Queue reactions for deferred processing
    for (const effect of effects) {
      if (effect.type === "substrate_spread" || effect.type === "substrate_convert") {
        this._pendingReactions.push({ x: gridX, y: gridY, effect });
      }
    }

    return effects;
  }

  /**
   * Process a spell/hex impact on a substrate tile.
   */
  onSpellImpact(gridX, gridY, spellElement) {
    const substrate = this.get(gridX, gridY);
    const effects = [];

    if (spellElement === "fire") {
      if (substrate === SUBSTRATE.OIL) {
        effects.push({ type: "aoe_damage", element: "fire", radius: 2, damage: 10 });
        effects.push({ type: "substrate_spread", to: SUBSTRATE.FIRE, radius: 1 });
      } else if (substrate === SUBSTRATE.MOSS) {
        effects.push({ type: "substrate_convert", to: SUBSTRATE.WILDFIRE });
        effects.push({ type: "dot_zone", element: "fire", duration: 4, dps: 2 });
      } else if (substrate === SUBSTRATE.ICE) {
        effects.push({ type: "substrate_convert", to: SUBSTRATE.WATER });
        effects.push({ type: "vfx", effect: "melt" });
      } else {
        effects.push({ type: "substrate_spread", to: SUBSTRATE.FIRE, radius: 0 });
      }
    } else if (spellElement === "ice") {
      if (substrate === SUBSTRATE.WATER) {
        effects.push({ type: "substrate_convert", to: SUBSTRATE.ICE });
      }
    }

    return effects;
  }

  /**
   * Tick pending reactions (deferred spread/convert).
   * Call once per frame. Returns list of resolved effects.
   */
  tickReactions() {
    const resolved = [];
    const pending = this._pendingReactions;
    this._pendingReactions = [];

    for (const { x, y, effect } of pending) {
      if (effect.type === "substrate_convert") {
        this.set(x, y, effect.to);
        resolved.push({ x, y, effect });
      } else if (effect.type === "substrate_spread") {
        const radius = effect.radius || 1;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (Math.hypot(dx, dy) > radius) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (this.inBounds(nx, ny) && this.get(nx, ny) === SUBSTRATE.DRY) {
              this.set(nx, ny, effect.to);
              resolved.push({ x: nx, y: ny, effect });
            }
          }
        }
      }
    }
    return resolved;
  }

  /**
   * Get tile state for rendering.
   * Returns an object with type, color, and animation hints.
   */
  getTileInfo(x, y) {
    const type = this.get(x, y);
    return {
      type,
      name: SUBSTRATE_NAMES[type],
      color: SUBSTRATE_COLORS[type],
      isActive: type !== SUBSTRATE.DRY,
    };
  }

  /**
   * Get all active (non-dry) tiles for rendering optimization.
   */
  getActiveTiles() {
    const tiles = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const type = this.get(x, y);
        if (type !== SUBSTRATE.DRY) {
          tiles.push({ x, y, type, name: SUBSTRATE_NAMES[type] });
        }
      }
    }
    return tiles;
  }

  /** Clear all substrates. */
  clear() {
    this.cells.fill(SUBSTRATE.DRY);
    this._pendingReactions.length = 0;
  }

  /** Serialize for save/load. */
  serialize() {
    return {
      cols: this.cols,
      rows: this.rows,
      cells: Array.from(this.cells),
    };
  }

  deserialize(data) {
    if (!data) return;
    this.cols = data.cols || CONFIG.SUBSTRATE_COLS;
    this.rows = data.rows || CONFIG.SUBSTRATE_ROWS;
    this.cells = new Uint8Array(data.cells || new Array(this.cols * this.rows).fill(0));
  }
}
