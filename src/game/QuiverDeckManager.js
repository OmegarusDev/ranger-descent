/**
 * QuiverDeckManager — collection, run deck, and a 4-card fire queue.
 * Storage never autofeeds. Capacity is how many cards you may bring.
 *
 * Arrow economy: specials start ~₡10. Ammo buys are the delve backbone.
 */
import { CONFIG } from "../data/config.js?v=29";

/**
 * Early-game focused catalog. `tier` gates hub shop rolls.
 * damage = physical on hit. fireDamage / iceDamage are bonus elemental.
 */
export const ARROW_DEFS = {
  wood: {
    type: "wood", name: "Wood Arrow", short: "WD", icon: "➤",
    cost: 3, damage: 1, shop: true, tier: 1, color: "#c4a574",
    desc: "Soft pine. Cheap filler for the quiver.", stats: "1 phys",
  },
  flint: {
    type: "flint", name: "Flint Arrow", short: "FL", icon: "◆",
    cost: 5, damage: 2, shop: true, tier: 1, color: "#8a8478",
    desc: "Knapped tip. Still soft against plate.", stats: "2 phys",
  },
  iron: {
    type: "iron", name: "Iron Arrow", short: "IR", icon: "➤",
    cost: 8, damage: 3, shop: true, tier: 1, color: "#9aa0a8",
    desc: "Forged head. Holds up on armour.", stats: "3 phys · solid vs armour",
    hardTip: true,
  },
  fire: {
    type: "fire", name: "Fire Arrow", short: "FR", icon: "🔥",
    cost: 10, damage: 2, fireDamage: 2, shop: true, tier: 1, color: "#e07a3a",
    desc: "Pitch-soaked. Physical hit plus a burst of flame, then burning.",
    stats: "2 phys + 2 fire · burn",
    burn: 3.5, burnDps: 3.2,
  },
  ice: {
    type: "ice", name: "Ice Arrow", short: "IC", icon: "❄",
    cost: 10, damage: 2, iceDamage: 1, shop: true, tier: 1, color: "#7eb8c9",
    desc: "Rimed tip. Bites with frost and chills their stride. Kills flame.",
    stats: "2 phys + 1 frost · chill",
    slow: 3.4, slowFactor: 0.32,
  },
  piercing: {
    type: "piercing", name: "Piercing Arrow", short: "PR", icon: "➶",
    cost: 10, damage: 2, shop: true, tier: 1, color: "#e8d5a0",
    desc: "Bodkin tip. Through flesh into the foe behind — or straight through plate.",
    stats: "2 phys · pierce 1 / punch armour",
    pierce: 1,
  },
  double: {
    type: "double", name: "Twin Shot", short: "TW", icon: "⇉",
    cost: 10, damage: 2, shop: true, tier: 1, color: "#d8b878",
    desc: "Two shafts for one draw. Depth insurance.",
    stats: "2 phys × 2 shafts",
  },
  stun: {
    type: "stun", name: "Stun Arrow", short: "SN", icon: "◉",
    cost: 10, damage: 1, shop: true, tier: 1, color: "#c9b070",
    desc: "Heavy blunt tip. Knocks the wind out of them.",
    stats: "1 phys · stun",
    stun: 0.95,
  },
  poison: {
    type: "poison", name: "Poison Arrow", short: "PS", icon: "☠",
    cost: 10, damage: 1, shop: true, tier: 1, color: "#9a6bb8",
    desc: "Venom on the tip. Keeps working after the hit.",
    stats: "1 phys · poison",
    poison: 4.5, poisonDps: 2.4,
  },
  oil: {
    type: "oil", name: "Oil Arrow", short: "OL", icon: "●",
    cost: 8, damage: 1, shop: true, tier: 1, color: "#8a7040",
    desc: "Slicks the wound. A Fire Arrow turns it into an inferno.",
    stats: "1 phys · oil coat",
  },
  silver: {
    type: "silver", name: "Silver Arrow", short: "SV", icon: "✧",
    cost: 12, damage: 2, shop: true, tier: 2, color: "#e8eef4", vsUndead: 1.6,
    desc: "Blessed silver. The dead hate it.",
    stats: "2 phys · +60% undead",
  },
  barbed: {
    type: "barbed", name: "Barbed Arrow", short: "BB", icon: "✸",
    cost: 11, damage: 2, shop: true, tier: 2, color: "#a85848",
    desc: "Hooks that tear free. Leaves them bleeding.",
    stats: "2 phys · bleed",
    bleed: 4.2, bleedDps: 2.2,
  },
  shock: {
    type: "shock", name: "Shock Arrow", short: "SK", icon: "⚡",
    cost: 14, damage: 2, shop: true, tier: 2, color: "#7ec8e0",
    desc: "Copper-wrapped. Jolts and staggers. Softens energy wards.",
    stats: "2 phys · jolt · vs energy",
    stun: 0.55, vsEnergy: 1.35,
  },
  steel: {
    type: "steel", name: "Steel Arrow", short: "SL", icon: "➤",
    cost: 16, damage: 4, shop: true, tier: 2, color: "#c8d0d8",
    desc: "Hardened tip for deeper floors.",
    stats: "4 phys · strong vs armour",
    hardTip: true,
  },
};

export const ARROW_TYPES = Object.keys(ARROW_DEFS);

const QUEUE_SIZE = CONFIG.QUEUE_SIZE || 4;
const ALIASES = { normal: "wood", kinetic: "wood", frost: "ice", twin: "double" };

export function getArrowDef(type) {
  const key = ALIASES[type] || type;
  return ARROW_DEFS[key] || ARROW_DEFS.wood;
}

/** Physical damage only (elemental is applied separately on hit). */
export function getArrowDamage(type, level = 1) {
  const def = getArrowDef(type);
  return (def.damage || 1) + Math.max(0, (level || 1) - 1);
}

export function getArrowFireDamage(type, level = 1) {
  const def = getArrowDef(type);
  if (!def.fireDamage) return 0;
  return def.fireDamage + Math.max(0, (level || 1) - 1);
}

export function getArrowIceDamage(type, level = 1) {
  const def = getArrowDef(type);
  if (!def.iceDamage) return 0;
  return def.iceDamage + Math.floor(Math.max(0, (level || 1) - 1) * 0.5);
}

export function arrowShort(type) {
  return getArrowDef(type).short;
}

export function toShopArrow(def) {
  return {
    id: `${def.type}_arrows`,
    name: def.name,
    slot: "ammo",
    cost: def.cost,
    desc: def.desc,
    stats: def.stats,
    icon: def.icon || "➤",
    section: "arrows",
    element: def.type,
    color: def.color,
    tier: def.tier || 1,
  };
}

export function getShopArrowCatalog(maxTier = 99) {
  return Object.values(ARROW_DEFS)
    .filter((d) => d.shop && (d.tier || 1) <= maxTier)
    .map(toShopArrow);
}

/** Weighted early pool — specials and cheap shafts show up often. */
export function rollShopArrows(n = 3, rand = Math.random, hubVisits = 0) {
  const maxTier = hubVisits < 2 ? 1 : hubVisits < 7 ? 2 : 3;
  const catalog = Object.values(ARROW_DEFS).filter((d) => d.shop && (d.tier || 1) <= maxTier);
  const weighted = [];
  for (const d of catalog) {
    const w = d.tier === 1 ? (d.cost <= 10 ? 3 : 2) : 1;
    for (let i = 0; i < w; i++) weighted.push(d);
  }
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = weighted[i];
    weighted[i] = weighted[j];
    weighted[j] = t;
  }
  const picked = [];
  const seen = new Set();
  for (const d of weighted) {
    if (seen.has(d.type)) continue;
    seen.add(d.type);
    picked.push(toShopArrow(d));
    if (picked.length >= n) break;
  }
  return picked;
}

export function createArrow(type, level = 1) {
  const t = ALIASES[type] || type || "wood";
  return { type: t, level: Math.max(1, Math.min(CONFIG.ARROW_MAX_LEVEL, level)), id: _nextId++ };
}

let _nextId = 1;

function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

export class QuiverDeckManager {
  constructor() {
    this.deck = [];
    this.queue = [];
    this.storage = [];
    this.capacity = 8;
    this._shuffleDelay = 0;
    this._shuffling = false;
    this._seeded = false;
  }

  initStarter() {
    this.deck = [];
    this.queue = [];
    this.storage = [];
    for (let i = 0; i < this.capacity; i++) {
      this.deck.push(createArrow("wood"));
    }
    this._seeded = true;
  }

  /** Hub / run-start: one loaded pile, extras back to collection. */
  packForHub() {
    this.deck = [...this.queue, ...this.deck];
    this.queue = [];
    while (this.deck.length > this.capacity) {
      this.storage.push(this.deck.pop());
    }
  }

  prepareForRun() {
    this.packForHub();
    if (this.totalArrows === 0) this.initStarter();
  }

  drawOne() {
    if (this.queue.length >= QUEUE_SIZE || this.deck.length === 0) return;
    this.queue.push(this.deck.shift());
  }

  shuffleForWave() {
    this.deck = shuffleInPlace([...this.queue, ...this.deck]);
    this.queue = [];
    while (this.queue.length < QUEUE_SIZE && this.deck.length > 0) {
      this.queue.push(this.deck.shift());
    }
  }

  fireArrow() {
    if (this._shuffling) return null;
    if (this.queue.length === 0) this.drawOne();
    if (this.queue.length === 0) return null;
    const arrow = this.queue.shift();
    this.drawOne();
    return arrow;
  }

  shuffleQuiver() {
    this.shuffleForWave();
  }

  peekQueue() {
    return [...this.queue];
  }

  peekQuiver() {
    return [...this.queue, ...this.deck];
  }

  peekStorage() {
    return [...this.storage];
  }

  addToStorage(arrow) {
    this.storage.push(createArrow(arrow.type, arrow.level));
  }

  addToQuiver(arrow) {
    if (this.queue.length + this.deck.length < this.capacity) {
      this.deck.push(createArrow(arrow.type, arrow.level));
      return true;
    }
    return false;
  }

  moveArrowToStorage(quiverIndex) {
    const loaded = this.peekQuiver();
    if (quiverIndex < 0 || quiverIndex >= loaded.length) return false;
    let arrow;
    if (quiverIndex < this.queue.length) arrow = this.queue.splice(quiverIndex, 1)[0];
    else arrow = this.deck.splice(quiverIndex - this.queue.length, 1)[0];
    if (!arrow) return false;
    this.storage.push(arrow);
    return true;
  }

  /** Put a storage arrow into a quiver slot, or clear the slot when storageIndex is null. */
  setQuiverSlot(quiverIndex, storageIndex = null) {
    if (storageIndex == null) {
      return this.moveArrowToStorage(quiverIndex);
    }
    const incoming = this.storage[storageIndex];
    if (!incoming) return false;
    const loaded = this.peekQuiver();
    if (quiverIndex >= 0 && quiverIndex < loaded.length) {
      let old;
      if (quiverIndex < this.queue.length) {
        old = this.queue[quiverIndex];
        this.queue[quiverIndex] = incoming;
      } else {
        const di = quiverIndex - this.queue.length;
        old = this.deck[di];
        this.deck[di] = incoming;
      }
      this.storage[storageIndex] = old;
      return true;
    }
    if (loaded.length >= this.capacity) {
      return false;
    }
    this.storage.splice(storageIndex, 1);
    this.deck.push(incoming);
    return true;
  }

  get quiverCount() {
    return this.queue.length + this.deck.length;
  }

  get totalArrows() {
    return this.quiverCount + this.storage.length;
  }

  tick(dt) {
    if (!this._shuffling) return null;
    this._shuffleDelay -= dt;
    if (this._shuffleDelay > 0) return null;
    this._shuffling = false;
    this.shuffleForWave();
    return { type: "shuffle_done" };
  }

  serialize() {
    return {
      deck: this.peekQuiver().map((a) => ({ type: a.type, level: a.level })),
      storage: this.storage.map((a) => ({ type: a.type, level: a.level })),
      capacity: this.capacity,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.capacity = data.capacity || 8;
    const made = (data.deck || data.quiver || []).map((a) => createArrow(a.type, a.level));
    this.queue = [];
    this.deck = made.slice(0, this.capacity);
    this.storage = [
      ...made.slice(this.capacity),
      ...(data.storage || []).map((a) => createArrow(a.type, a.level)),
    ];
    this._seeded = true;
  }
}
