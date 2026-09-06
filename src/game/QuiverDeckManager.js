/**
 * QuiverDeckManager — 20-card arrow deck with 4-card HUD queue,
 * draw/shuffle, individual leveling (1→5), and compound fusion.
 *
 * No rendering or game state dependencies — pure data management.
 */
import { CONFIG } from "../data/config.js";

/** Arrow element types. */
export const ARROW_TYPES = [
  "normal", "fire", "oil", "moss",
  "poison", "ice", "piercing",
];

/** Compound arrow recipes: two Lvl 5 base arrows → compound. */
export const FUSION_RECIPES = new Map([
  ["fire+oil",     "explosive"],
  ["oil+fire",     "explosive"],
  ["poison+oil",   "corrosive"],
  ["oil+poison",   "corrosive"],
  ["moss+oil",     "wildfire"],
  ["oil+moss",     "wildfire"],
  ["poison+moss",  "toxic_canopy"],
  ["moss+poison",  "toxic_canopy"],
  ["ice+fire",     "thermal_shock"],
  ["fire+ice",     "thermal_shock"],
  ["poison+ice",   "cryogenic"],
  ["ice+poison",   "cryogenic"],
  ["fire+piercing","inferno_pierce"],
  ["piercing+fire","inferno_pierce"],
  ["ice+piercing", "shatter"],
  ["piercing+ice", "shatter"],
  ["oil+piercing", "sticky_explosive"],
  ["piercing+oil", "sticky_explosive"],
]);

/**
 * Create an arrow card.
 * @param {string} type - one of ARROW_TYPES or compound
 * @param {number} level - 1..5
 */
export function createArrow(type, level = 1) {
  return { type, level: Math.max(1, Math.min(CONFIG.ARROW_MAX_LEVEL, level)) };
}

export class QuiverDeckManager {
  constructor() {
    /** Full deck of arrow cards (20). */
    this.deck = [];
    /** Current 4-card HUD queue. */
    this.queue = [];
    /** Index into deck for next draw. */
    this._drawIndex = 0;
    /** Shuffle delay timer (seconds). */
    this._shuffleDelay = 0;
    this._shuffling = false;
    /** Xp tracking per arrow type. */
    this._xp = new Map();
    /** Compound arrows discovered. */
    this.compounds = new Set();
  }

  /** Initialize deck with a balanced starter set. */
  initStarter() {
    this.deck = [];
    const startSize = 8;
    for (let i = 0; i < startSize; i++) {
      this.deck.push(createArrow("normal"));
    }
    this._drawIndex = 0;
    this._fillQueue();
  }

  /** Fill the HUD queue from the deck. */
  _fillQueue() {
    while (this.queue.length < CONFIG.QUEUE_SIZE && this._drawIndex < this.deck.length) {
      this.queue.push(this.deck[this._drawIndex++]);
    }
    // If deck exhausted, trigger reshuffle
    if (this._drawIndex >= this.deck.length && this.queue.length < CONFIG.QUEUE_SIZE) {
      this._startShuffle();
    }
  }

  _startShuffle() {
    this._shuffling = true;
    this._shuffleDelay = 1.0; // 1-second shuffle animation window
  }

  /**
   * Call each frame with dt.
   * Returns "shuffle" when shuffle completes, null otherwise.
   */
  tick(dt) {
    if (!this._shuffling) return null;
    this._shuffleDelay -= dt;
    if (this._shuffleDelay <= 0) {
      this._shuffleDeck();
      this._shuffling = false;
      this._fillQueue();
      return "shuffle";
    }
    return null;
  }

  _shuffleDeck() {
    // Fisher-Yates shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this._drawIndex = 0;
  }

  /**
   * Fire the next arrow from the queue.
   * Returns the arrow card or null if empty/shuffling.
   */
  fireArrow() {
    if (this._shuffling || this.queue.length === 0) return null;
    const arrow = this.queue.shift();
    this._fillQueue();
    return arrow;
  }

  /** Peek at the current queue without consuming. */
  peekQueue() {
    return [...this.queue];
  }

  /** Check if shuffle animation is playing. */
  get isShuffling() {
    return this._shuffling;
  }

  /** Get remaining arrows in deck. */
  get remaining() {
    return this.deck.length - this._drawIndex;
  }

  /** Get total arrows available (deck remaining + queue). */
  get totalAvailable() {
    return this.remaining + this.queue.length;
  }

  /**
   * Add XP to a specific arrow type. When enough XP accumulates,
   * the next arrow of that type drawn will be one level higher.
   */
  addXp(type, amount) {
    const cur = this._xp.get(type) || 0;
    this._xp.set(type, cur + amount);
    // Check if any arrows in deck/queue should level up
    this._tryLevelUp(type);
  }

  _tryLevelUp(type) {
    const xp = this._xp.get(type) || 0;
    const threshold = 5; // XP per level
    for (const arrow of this.deck) {
      if (arrow.type === type && arrow.level < CONFIG.ARROW_MAX_LEVEL) {
        const needed = (arrow.level) * threshold;
        if (xp >= needed) {
          arrow.level++;
          this._xp.set(type, xp - threshold);
          return;
        }
      }
    }
    for (const arrow of this.queue) {
      if (arrow.type === type && arrow.level < CONFIG.ARROW_MAX_LEVEL) {
        const needed = (arrow.level) * threshold;
        if (xp >= needed) {
          arrow.level++;
          this._xp.set(type, xp - threshold);
          return;
        }
      }
    }
  }

  /**
   * Attempt fusion: if two adjacent arrows in the queue are both Lvl 5
   * and have a valid recipe, merge them into a compound arrow.
   * Returns the compound arrow or null.
   */
  tryFusion() {
    for (let i = 0; i < this.queue.length - 1; i++) {
      const a = this.queue[i];
      const b = this.queue[i + 1];
      if (a.level < CONFIG.ARROW_MAX_LEVEL || b.level < CONFIG.ARROW_MAX_LEVEL) continue;
      const key = `${a.type}+${b.type}`;
      const compoundType = FUSION_RECIPES.get(key);
      if (!compoundType) continue;
      // Merge: remove both, insert compound at position
      this.queue.splice(i, 2);
      const compound = createArrow(compoundType, CONFIG.ARROW_MAX_LEVEL);
      this.queue.splice(i, 0, compound);
      this.compounds.add(compoundType);
      return compound;
    }
    return null;
  }

  /** Get all arrows in deck+queue with their counts. */
  getCounts() {
    const counts = {};
    for (const a of [...this.deck, ...this.queue]) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return counts;
  }

  /** Get XP progress for a type (current / threshold). */
  xpProgress(type) {
    const xp = this._xp.get(type) || 0;
    const threshold = 5;
    return { current: xp % threshold, threshold };
  }

  /** Replace the deck entirely (for save/load or meta upgrades). */
  setDeck(arrows) {
    this.deck = arrows.map(a => ({ ...a }));
    this._drawIndex = 0;
    this.queue = [];
    this._fillQueue();
  }

  /** Serialize for save. */
  serialize() {
    return {
      deck: this.deck.map(a => ({ ...a })),
      queue: this.queue.map(a => ({ ...a })),
      drawIndex: this._drawIndex,
      xp: Object.fromEntries(this._xp),
      compounds: [...this.compounds],
    };
  }

  deserialize(data) {
    if (!data) return;
    this.deck = (data.deck || []).map(a => createArrow(a.type, a.level));
    this.queue = (data.queue || []).map(a => createArrow(a.type, a.level));
    this._drawIndex = data.drawIndex || 0;
    this._xp = new Map(Object.entries(data.xp || {}));
    this.compounds = new Set(data.compounds || []);
  }
}
