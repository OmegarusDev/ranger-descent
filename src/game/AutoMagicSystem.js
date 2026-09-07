/**
 * AutoMagicSystem — manages cooldown timers and auto-target acquisition
 * for Hexes (offensive) and Prayers (support/utility) that fire on intervals.
 *
 * No rendering dependencies. Exposes timer state for HUD display.
 */

/** Hex definitions — auto-targeted offensive spells. */
export const HEX_DEFS = [
  {
    id: "hex_seeking",
    name: "Hex of Seeking",
    description: "Fires a homing bolt at the nearest enemy.",
    cooldown: 3.5,
    damage: 8,
    range: 5,
    element: "kinetic",
    color: "#d8d2c4",
  },
  {
    id: "hex_ignition",
    name: "Hex of Ignition",
    description: "Launches a fireball that ignites the target.",
    cooldown: 5.0,
    damage: 12,
    range: 6,
    element: "fire",
    color: "#e07a3a",
  },
  {
    id: "hex_frostbite",
    name: "Hex of Frostbite",
    description: "Chills and slows the nearest enemy.",
    cooldown: 4.0,
    damage: 6,
    range: 5,
    element: "frost",
    color: "#7eb8c9",
  },
  {
    id: "hex_corrosion",
    name: "Hex of Corrosion",
    description: "Strips armor from the strongest enemy.",
    cooldown: 6.0,
    damage: 4,
    range: 7,
    element: "acid",
    color: "#7aad5c",
  },
];

/** Prayer definitions — auto-cast support/utility spells. */
export const PRAYER_DEFS = [
  {
    id: "prayer_sanctuary",
    name: "Prayer of Sanctuary",
    description: "Creates a brief shield around the player.",
    cooldown: 12.0,
    duration: 3.0,
    effect: "shield",
    color: "#9ec8e8",
  },
  {
    id: "prayer_harvest",
    name: "Prayer of Harvest",
    description: "Doubles Soul drops for a short time.",
    cooldown: 18.0,
    duration: 6.0,
    effect: "soul_multiplier",
    color: "#c9a227",
  },
  {
    id: "prayer_fortify",
    name: "Prayer of Fortify",
    description: "Increases arrow damage by 50% briefly.",
    cooldown: 15.0,
    duration: 5.0,
    effect: "damage_boost",
    color: "#d4783a",
  },
  {
    id: "prayer_quicksilver",
    name: "Prayer of Quicksilver",
    description: "Fires the next 3 arrows instantly.",
    cooldown: 20.0,
    duration: 0,
    effect: "instant_burst",
    color: "#6ab0c8",
  },
];

class MagicTimer {
  constructor(def) {
    this.def = def;
    this.cooldownRemaining = def.cooldown;
    this.active = false;
    this.activeRemaining = 0;
    this.unlocked = false;
  }

  get isReady() {
    return this.unlocked && this.cooldownRemaining <= 0 && !this.active;
  }

  get cooldownProgress() {
    return 1 - (this.cooldownRemaining / this.def.cooldown);
  }

  get isActive() {
    return this.active;
  }

  tick(dt) {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }
    if (this.active) {
      this.activeRemaining -= dt;
      if (this.activeRemaining <= 0) {
        this.active = false;
        this.cooldownRemaining = this.def.cooldown;
      }
    }
  }

  trigger() {
    if (!this.isReady) return false;
    this.active = true;
    this.activeRemaining = this.def.duration;
    if (this.def.duration <= 0) {
      // Instant effect — immediately go on cooldown
      this.active = false;
      this.cooldownRemaining = this.def.cooldown;
    }
    return true;
  }

  unlock() {
    this.unlocked = true;
    this.cooldownRemaining = 0;
  }
}

export class AutoMagicSystem {
  constructor() {
    this.hexes = HEX_DEFS.map(d => new MagicTimer(d));
    this.prayers = PRAYER_DEFS.map(d => new MagicTimer(d));
  }

  /** Unlock a specific hex or prayer by id. */
  unlock(id) {
    for (const h of this.hexes) {
      if (h.def.id === id) { h.unlock(); return true; }
    }
    for (const p of this.prayers) {
      if (p.def.id === id) { p.unlock(); return true; }
    }
    return false;
  }

  /** Unlock all hexes and prayers (for testing). */
  unlockAll() {
    for (const h of this.hexes) h.unlock();
    for (const p of this.prayers) p.unlock();
  }

  /**
   * Tick all timers. Returns an array of actions ready to fire:
   * { type: "hex"|"prayer", def, timer }
   */
  tick(dt) {
    const actions = [];
    for (const h of this.hexes) {
      h.tick(dt);
      if (h.isReady) {
        h.trigger();
        actions.push({ type: "hex", def: h.def, timer: h });
      }
    }
    for (const p of this.prayers) {
      p.tick(dt);
      if (p.isReady) {
        p.trigger();
        actions.push({ type: "prayer", def: p.def, timer: p });
      }
    }
    return actions;
  }

  /**
   * For each hex action, find the best target from a list of entities.
   * Returns the action with target attached.
   */
  acquireTargets(actions, entities, playerPos) {
    for (const action of actions) {
      if (action.type !== "hex") continue;
      const range = action.def.range;
      let best = null;
      let bestDist = Infinity;
      for (const e of entities) {
        if (e.hp <= 0) continue;
        const dx = e.x - playerPos.x;
        const dy = (e.dist != null ? e.dist : e.worldZ - playerPos.y);
        const dist = Math.hypot(dx, dy);
        const reach = range > 40 ? range : range * 40;
        if (dist <= reach && dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
      action.target = best;
    }
    return actions;
  }

  /** Get all unlocked timers for HUD display. */
  getAllTimers() {
    return [
      ...this.hexes.filter(h => h.unlocked).map(h => ({
        id: h.def.id, name: h.def.name, color: h.def.color,
        cooldown: h.def.cooldown,
        remaining: h.cooldownRemaining,
        progress: h.cooldownProgress,
        active: h.active,
      })),
      ...this.prayers.filter(p => p.unlocked).map(p => ({
        id: p.def.id, name: p.def.name, color: p.def.color,
        cooldown: p.def.cooldown,
        remaining: p.cooldownRemaining,
        progress: p.cooldownProgress,
        active: p.active,
      })),
    ];
  }

  /** Reset all timers (new run). */
  reset() {
    for (const h of this.hexes) {
      h.cooldownRemaining = h.def.cooldown;
      h.active = false;
    }
    for (const p of this.prayers) {
      p.cooldownRemaining = p.def.cooldown;
      p.active = false;
    }
  }

  serialize() {
    return {
      hexes: this.hexes.map(h => ({
        id: h.def.id, unlocked: h.unlocked,
        cooldownRemaining: h.cooldownRemaining,
      })),
      prayers: this.prayers.map(p => ({
        id: p.def.id, unlocked: p.unlocked,
        cooldownRemaining: p.cooldownRemaining,
      })),
    };
  }

  deserialize(data) {
    if (!data) return;
    for (const h of data.hexes || []) {
      const t = this.hexes.find(x => x.def.id === h.id);
      if (t) {
        t.unlocked = h.unlocked;
        t.cooldownRemaining = h.cooldownRemaining;
      }
    }
    for (const p of data.prayers || []) {
      const t = this.prayers.find(x => x.def.id === p.id);
      if (t) {
        t.unlocked = p.unlocked;
        t.cooldownRemaining = p.cooldownRemaining;
      }
    }
  }
}
