/**
 * QuiverDeckManager — Manages arrows in quiver (active) and storage (spares).
 * Quiver holds up to 8 arrows ready to fire. Storage holds spare arrows.
 */
import { CONFIG } from "../data/config.js";

export const ARROW_TYPES = [
  "normal", "fire", "oil", "moss",
  "poison", "ice", "piercing",
];

export function createArrow(type, level = 1) {
  return { type, level: Math.max(1, Math.min(CONFIG.ARROW_MAX_LEVEL, level)), id: _nextId++ };
}

let _nextId = 1;

export class QuiverDeckManager {
  constructor() {
    this.quiver = [];
    this.storage = [];
    this.capacity = 8;
    this._shuffleDelay = 0;
    this._shuffling = false;
  }

  initStarter() {
    this.quiver = [];
    this.storage = [];
    for (let i = 0; i < this.capacity; i++) {
      this.quiver.push(createArrow("normal"));
    }
    for (let i = 0; i < 2; i++) {
      this.storage.push(createArrow("normal"));
    }
  }

  fireArrow() {
    if (this._shuffling || this.quiver.length === 0) return null;
    return this.quiver.shift();
  }

  peekQuiver() {
    return [...this.quiver];
  }

  peekStorage() {
    return [...this.storage];
  }

  addToStorage(arrow) {
    this.storage.push(createArrow(arrow.type, arrow.level));
  }

  addToQuiver(arrow) {
    if (this.quiver.length < this.capacity) {
      this.quiver.push(createArrow(arrow.type, arrow.level));
      return true;
    }
    return false;
  }

  moveArrowToQuiver(storageIndex) {
    if (storageIndex < 0 || storageIndex >= this.storage.length) return false;
    if (this.quiver.length >= this.capacity) return false;
    const arrow = this.storage.splice(storageIndex, 1)[0];
    this.quiver.push(arrow);
    return true;
  }

  moveArrowToStorage(quiverIndex) {
    if (quiverIndex < 0 || quiverIndex >= this.quiver.length) return false;
    const arrow = this.quiver.splice(quiverIndex, 1)[0];
    this.storage.push(arrow);
    return true;
  }

  tick(dt) {
    return null;
  }

  get isShuffling() {
    return this._shuffling;
  }

  get quiverCount() {
    return this.quiver.length;
  }

  get storageCount() {
    return this.storage.length;
  }

  get totalArrows() {
    return this.quiver.length + this.storage.length;
  }

  getCounts() {
    const counts = {};
    for (const a of [...this.quiver, ...this.storage]) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return counts;
  }

  setDeck(arrows) {
    this.quiver = arrows.slice(0, this.capacity).map(a => createArrow(a.type, a.level));
    this.storage = arrows.slice(this.capacity).map(a => createArrow(a.type, a.level));
  }

  serialize() {
    return {
      quiver: this.quiver.map(a => ({ type: a.type, level: a.level })),
      storage: this.storage.map(a => ({ type: a.type, level: a.level })),
      capacity: this.capacity,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.quiver = (data.quiver || []).map(a => createArrow(a.type, a.level));
    this.storage = (data.storage || []).map(a => createArrow(a.type, a.level));
    this.capacity = data.capacity || 8;
  }
}
