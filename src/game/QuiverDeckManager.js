/**
 * QuiverDeckManager — collection, run deck, and a 4-card fire queue.
 * Storage never autofeeds. Capacity is how many cards you may bring.
 */
import { CONFIG } from "../data/config.js";

/** Material shafts plus the elemental / trick cards. */
export const ARROW_DEFS = {
  wood: {
    type: "wood", name: "Wood Arrow", short: "WD", icon: "➤",
    cost: 6, damage: 1, shop: true, color: "#c4a574",
    desc: "A cheap shaft. Starter ammo.", stats: "1 dmg",
  },
  flint: {
    type: "flint", name: "Flint Arrow", short: "FL", icon: "◆",
    cost: 12, damage: 2, shop: true, color: "#8a8478",
    desc: "Knapped stone head.", stats: "2 dmg",
  },
  iron: {
    type: "iron", name: "Iron Arrow", short: "IR", icon: "➤",
    cost: 22, damage: 3, shop: true, color: "#9aa0a8",
    desc: "Forged head. Better vs armour.", stats: "3 dmg",
  },
  steel: {
    type: "steel", name: "Steel Arrow", short: "ST", icon: "➤",
    cost: 36, damage: 4, shop: true, color: "#c8d0d8",
    desc: "Hardened steel tip.", stats: "4 dmg",
  },
  silver: {
    type: "silver", name: "Silver Arrow", short: "SV", icon: "✧",
    cost: 38, damage: 3, shop: true, color: "#e8eef4", vsUndead: 1.5,
    desc: "Blessed silver. Bites the dead.", stats: "3 dmg · +50% undead",
  },
  obsidian: {
    type: "obsidian", name: "Obsidian Arrow", short: "OB", icon: "◇",
    cost: 55, damage: 5, shop: true, color: "#6a4a78",
    desc: "Volcanic glass. Fragile, vicious.", stats: "5 dmg",
  },
  fire: {
    type: "fire", name: "Fire Arrow", short: "FR", icon: "🔥",
    cost: 30, damage: 2, shop: true, color: "#e07a3a",
    desc: "Burns. Ignites oil.", stats: "2 dmg · burn",
  },
  ice: {
    type: "ice", name: "Ice Arrow", short: "IC", icon: "❄",
    cost: 30, damage: 2, shop: true, color: "#7eb8c9",
    desc: "Slows. Douses flame.", stats: "2 dmg · slow",
  },
  oil: {
    type: "oil", name: "Oil Arrow", short: "OL", icon: "●",
    cost: 26, damage: 1, shop: true, color: "#8a7040",
    desc: "Coats. Fire ignites.", stats: "1 dmg · coat",
  },
  moss: {
    type: "moss", name: "Moss Arrow", short: "MS", icon: "❀",
    cost: 24, damage: 1, shop: true, color: "#6a9a5a",
    desc: "Seeds moss on dry stone.", stats: "1 dmg · moss",
  },
  poison: {
    type: "poison", name: "Poison Arrow", short: "PS", icon: "☠",
    cost: 30, damage: 2, shop: true, color: "#9a6bb8",
    desc: "Venom on the tip.", stats: "2 dmg · poison",
  },
  piercing: {
    type: "piercing", name: "Piercing Arrow", short: "PR", icon: "➶",
    cost: 42, damage: 3, shop: true, color: "#e8d5a0",
    desc: "Passes through three foes.", stats: "3 dmg · hits 3",
  },
  double: {
    type: "double", name: "Twin Shot", short: "TW", icon: "⇉",
    cost: 48, damage: 2, shop: true, color: "#d8b878",
    desc: "Looses two shafts.", stats: "2 dmg · two arrows",
  },
};

export const ARROW_TYPES = Object.keys(ARROW_DEFS);

const QUEUE_SIZE = CONFIG.QUEUE_SIZE || 4;
const ALIASES = { normal: "wood", kinetic: "wood" };

export function getArrowDef(type) {
  const key = ALIASES[type] || type;
  return ARROW_DEFS[key] || ARROW_DEFS.wood;
}

export function getArrowDamage(type, level = 1) {
  const def = getArrowDef(type);
  return (def.damage || 1) + Math.max(0, (level || 1) - 1);
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
    icon: def.icon,
    section: "arrows",
    element: def.type,
    color: def.color,
  };
}

export function getShopArrowCatalog() {
  return Object.values(ARROW_DEFS).filter((d) => d.shop).map(toShopArrow);
}

export function rollShopArrows(n = 3, rand = Math.random) {
  const pool = getShopArrowCatalog();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, Math.min(n, pool.length));
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
    this.capacity = 10;
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

  moveArrowToQuiver(storageIndex) {
    if (storageIndex < 0 || storageIndex >= this.storage.length) return false;
    if (this.queue.length + this.deck.length >= this.capacity) return false;
    const arrow = this.storage.splice(storageIndex, 1)[0];
    this.deck.push(arrow);
    return true;
  }

  moveArrowToStorage(quiverIndex) {
    const loaded = this.peekQuiver();
    if (quiverIndex < 0 || quiverIndex >= loaded.length) return false;
    let arrow;
    if (quiverIndex < this.queue.length) arrow = this.queue.splice(quiverIndex, 1)[0];
    else arrow = this.deck.splice(quiverIndex - this.queue.length, 1)[0];
    this.storage.push(arrow);
    return true;
  }

  /** Put a storage arrow into a quiver slot, or clear the slot when storageIndex is null. */
  setQuiverSlot(quiverIndex, storageIndex = null) {
    const loaded = this.peekQuiver();
    if (storageIndex == null) {
      return this.moveArrowToStorage(quiverIndex);
    }
    if (storageIndex < 0 || storageIndex >= this.storage.length) return false;
    const incoming = this.storage.splice(storageIndex, 1)[0];
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
      this.storage.push(old);
      return true;
    }
    if (loaded.length >= this.capacity) {
      this.storage.splice(storageIndex, 0, incoming);
      return false;
    }
    this.deck.push(incoming);
    return true;
  }

  tick() {
    return null;
  }

  get isShuffling() {
    return this._shuffling;
  }

  get quiverCount() {
    return this.queue.length + this.deck.length;
  }

  get queueCount() {
    return this.queue.length;
  }

  get deckCount() {
    return this.deck.length;
  }

  get storageCount() {
    return this.storage.length;
  }

  get totalArrows() {
    return this.queue.length + this.deck.length + this.storage.length;
  }

  getCounts() {
    const counts = {};
    for (const a of [...this.queue, ...this.deck, ...this.storage]) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return counts;
  }

  setDeck(arrows) {
    const made = arrows.map(a => createArrow(a.type, a.level));
    this.queue = [];
    this.deck = made.slice(0, this.capacity);
    this.storage = made.slice(this.capacity);
  }

  serialize() {
    return {
      deck: this.deck.map(a => ({ type: a.type, level: a.level })),
      queue: this.queue.map(a => ({ type: a.type, level: a.level })),
      storage: this.storage.map(a => ({ type: a.type, level: a.level })),
      capacity: this.capacity,
      seeded: this._seeded,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.deck = (data.deck || data.quiver || []).map(a => createArrow(a.type, a.level));
    this.queue = (data.queue || []).map(a => createArrow(a.type, a.level));
    this.storage = (data.storage || []).map(a => createArrow(a.type, a.level));
    this.capacity = data.capacity || 6;
    this._seeded = !!(data.seeded || this.deck.length || this.storage.length);
    this.packForHub();
  }
}
