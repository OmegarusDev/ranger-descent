/**
 * QuiverDeckManager — collection, run deck, and a 4-card fire queue.
 * Storage never autofeeds. Capacity is how many cards you may bring.
 *
 * Arrow economy: specials start ~₡10. Ammo buys are the delve backbone.
 */
import { CONFIG } from "../data/config.js";

/**
 * Early-game focused catalog. `tier` gates hub shop rolls.
 * damage = physical on hit. fireDamage / iceDamage are bonus elemental.
 */
export const ARROW_DEFS = {
  wood: {
    type: "wood", name: "Wood Arrow", short: "WD", icon: "➤",
    cost: 3, damage: 1, shop: false, tier: 1, color: "#c4a574",
    desc: "Soft pine. You fletch these yourself when the quiver runs dry.", stats: "1 phys",
  },
  flint: {
    type: "flint", name: "Flint Arrow", short: "FL", icon: "◆",
    cost: 5, damage: 2, shop: true, tier: 1, color: "#8a8478",
    desc: "Knapped tip. Looks brittle — it isn't. Soft against plate.", stats: "2 phys",
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


const QUEUE_SIZE = CONFIG.QUEUE_SIZE || 4;
const ALIASES = { normal: "wood", kinetic: "wood", frost: "ice", twin: "double" };

/** Normalize persisted or legacy arrow types at the domain boundary. */
export function normalizeArrowType(type) {
  const key = ALIASES[type] || type;
  return ARROW_DEFS[key] ? key : "wood";
}

export function normalizeArrowLevel(level = 1) {
  const n = Number(level);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(CONFIG.ARROW_MAX_LEVEL, Math.floor(n)));
}

export function getArrowDef(type) {
  return ARROW_DEFS[normalizeArrowType(type)];
}

/** Physical damage only (elemental is applied separately on hit). */
export function getArrowDamage(type, level = 1) {
  const def = getArrowDef(type);
  return (def.damage || 1) + Math.max(0, normalizeArrowLevel(level) - 1);
}

export function getArrowFireDamage(type, level = 1) {
  const def = getArrowDef(type);
  if (!def.fireDamage) return 0;
  return def.fireDamage + Math.max(0, normalizeArrowLevel(level) - 1);
}

export function getArrowIceDamage(type, level = 1) {
  const def = getArrowDef(type);
  if (!def.iceDamage) return 0;
  return def.iceDamage + Math.floor(Math.max(0, normalizeArrowLevel(level) - 1) * 0.5);
}

export function arrowShort(type) {
  return getArrowDef(type).short;
}

/** Meta progress for hub shop quality (visits + elevators unlocked). */
export function shopProgressScore(hubVisits = 0, elevUnlocked = 0) {
  return Math.max(0, (hubVisits | 0) + (elevUnlocked | 0) * 3);
}

/** Run depth for hall loot quality. */
export function lootProgressScore(floorIndex = 0, elevatorIndex = 0) {
  return Math.max(0, (elevatorIndex | 0) * 10 + (floorIndex | 0));
}

/**
 * Max arrow level offered at this progress.
 * Shop gets a slight edge over dungeon finds at the same score.
 */
export function arrowLevelCapForProgress(score = 0, { shop = false } = {}) {
  let cap = 1;
  if (score >= 2) cap = 2;
  if (score >= 8) cap = 3;
  if (score >= 18) cap = 4;
  if (score >= 36) cap = 5;
  if (shop && score >= 3) cap = Math.min(CONFIG.ARROW_MAX_LEVEL, cap + 1);
  return Math.min(CONFIG.ARROW_MAX_LEVEL, Math.max(1, cap));
}

/**
 * Roll 1..cap. Loot leans low; shop leans a bit higher within the same cap.
 */
export function rollArrowLevel(rand = Math.random, cap = 1, { favorHigh = false } = {}) {
  const max = Math.max(1, Math.min(CONFIG.ARROW_MAX_LEVEL, cap | 0));
  if (max <= 1) return 1;
  let total = 0;
  const weights = [];
  for (let lv = 1; lv <= max; lv++) {
    const w = favorHigh
      ? 1.4 + lv * 0.9
      : (max - lv + 1) * (max - lv + 1);
    weights.push(w);
    total += w;
  }
  let r = (typeof rand === "function" ? rand() : Math.random()) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i + 1;
  }
  return max;
}

export function arrowShopCost(baseCost, level = 1) {
  const lv = Math.max(1, level | 0);
  return Math.max(1, Math.round((baseCost || 1) * (1 + (lv - 1) * 0.7)));
}

export function toShopArrow(def, level = 1) {
  const lv = Math.max(1, Math.min(CONFIG.ARROW_MAX_LEVEL, level | 0));
  const phys = getArrowDamage(def.type, lv);
  const fire = getArrowFireDamage(def.type, lv);
  const ice = getArrowIceDamage(def.type, lv);
  let stats = `${phys} phys`;
  if (fire) stats += ` + ${fire} fire`;
  if (ice) stats += ` + ${ice} frost`;
  if (def.burn) stats += " · burn";
  if (def.slow) stats += " · chill";
  if (def.pierce) stats += " · pierce";
  if (def.poison) stats += " · poison";
  if (def.hardTip) stats += " · vs armour";
  if (lv > 1) stats += ` · Lv${lv}`;
  return {
    id: lv <= 1 ? `${def.type}_arrows` : `${def.type}_arrows_lv${lv}`,
    name: lv <= 1 ? def.name : `${def.name} Lv${lv}`,
    slot: "ammo",
    cost: arrowShopCost(def.cost, lv),
    desc: def.desc,
    stats,
    icon: def.icon || "➤",
    section: "arrows",
    element: def.type,
    type: def.type,
    level: lv,
    color: def.color,
    tier: def.tier || 1,
  };
}

export function getShopArrowCatalog(maxTier = 99) {
  return Object.values(ARROW_DEFS)
    .filter((d) => d.shop && (d.tier || 1) <= maxTier)
    .map((d) => toShopArrow(d, 1));
}

/** Weighted early pool — specials and cheap shafts show up often. Levels rise with progress. */
export function rollShopArrows(n = 3, rand = Math.random, hubVisits = 0, elevUnlocked = 0) {
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
  const score = shopProgressScore(hubVisits, elevUnlocked);
  const cap = arrowLevelCapForProgress(score, { shop: true });
  const picked = [];
  const seen = new Set();
  for (const d of weighted) {
    if (seen.has(d.type)) continue;
    seen.add(d.type);
    const level = rollArrowLevel(rand, cap, { favorHigh: true });
    picked.push(toShopArrow(d, level));
    if (picked.length >= n) break;
  }
  return picked;
}

export function isWoodType(type) {
  return normalizeArrowType(type) === "wood";
}

export function createArrow(type, level = 1) {
  return { type: normalizeArrowType(type), level: normalizeArrowLevel(level), id: _nextId++ };
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

  initStarter(fillerType = "wood") {
    this.deck = [];
    this.queue = [];
    // Storage is never wiped — only the loaded quiver is seeded.
    this.fillEmptySlots(fillerType);
    this._seeded = true;
  }

  /**
   * Fill unloaded quiver slots only. Never overwrites loaded shafts or storage.
   */
  fillEmptySlots(fillerType = "wood", level = 1) {
    while (this.queue.length + this.deck.length < this.capacity) {
      this.deck.push(createArrow(fillerType, level));
    }
  }

  /** Hub / run-start: one loaded pile; overflow spares go to chest (never wood). */
  packForHub() {
    this.deck = [...this.queue, ...this.deck];
    this.queue = [];
    while (this.deck.length > this.capacity) {
      const a = this.deck.pop();
      if (a && !isWoodType(a.type)) this.storage.push(a);
    }
  }

  prepareForRun(fillerType = "wood") {
    this.packForHub();
    this.fillEmptySlots(fillerType);
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

  isWoodType(type) {
    return isWoodType(type);
  }

  addToStorage(arrow) {
    if (!arrow || isWoodType(arrow.type)) return false;
    this.storage.push(createArrow(arrow.type, arrow.level));
    return true;
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
    const inQueue = quiverIndex < this.queue.length;
    let arrow;
    if (inQueue) arrow = this.queue.splice(quiverIndex, 1)[0];
    else arrow = this.deck.splice(quiverIndex - this.queue.length, 1)[0];
    if (!arrow) return false;
    if (isWoodType(arrow.type)) {
      if (inQueue) this.queue.splice(quiverIndex, 0, arrow);
      else this.deck.splice(quiverIndex - this.queue.length, 0, arrow);
      return false;
    }
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
      this.storage.splice(storageIndex, 1);
      if (old && !isWoodType(old.type)) this.storage.push(old);
      // Wood displaced from the quiver is discarded, never chested.
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
    const rawCapacity = Number(data.capacity);
    this.capacity = Number.isFinite(rawCapacity)
      ? Math.max(1, Math.min(30, Math.floor(rawCapacity)))
      : 10;
    const rawDeck = Array.isArray(data.deck) ? data.deck : (Array.isArray(data.quiver) ? data.quiver : []);
    const rawStorage = Array.isArray(data.storage) ? data.storage : [];
    const made = rawDeck
      .filter((a) => a && typeof a === "object")
      .map((a) => createArrow(a.type, a.level));
    this.queue = [];
    this.deck = made.slice(0, this.capacity);
    const overflow = made.slice(this.capacity).filter((a) => !isWoodType(a.type));
    this.storage = [
      ...overflow,
      ...rawStorage
        .filter((a) => a && typeof a === "object")
        .map((a) => createArrow(a.type, a.level))
        .filter((a) => !isWoodType(a.type)),
    ];
    this._seeded = true;
  }
}
