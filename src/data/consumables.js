/**
 * Canonical consumable catalog — potions and scrolls share one effect model.
 *
 * Potion amounts are first-pass values pending balance review.
 * Scrolls are supported by the use API but are not sold or dropped yet.
 * AutoMagic remains dormant; scroll effects call GameStateManager directly.
 */
import { CONFIG } from "./config.js";

export const CONSUMABLE_DEFS = {
  potion_salve: {
    id: "potion_salve",
    name: "Herbal Remedy",
    short: "Remedy",
    kind: "potion",
    slot: "potion",
    cost: 12,
    icon: "✚",
    desc: "A bitter draught of crushed herbs. Fits the bag.",
    stats: "Restores HP.",
    section: "potions",
    shop: true,
    effect: { type: "heal", amount: CONFIG.POTION_SALVE_HEAL },
  },
  potion_bandage: {
    id: "potion_bandage",
    name: "Field Bandage",
    short: "Bandage",
    kind: "potion",
    slot: "potion",
    cost: 20,
    icon: "✚",
    desc: "Linen and resin. Bind a wound between halls.",
    stats: "Restores HP.",
    section: "potions",
    shop: true,
    effect: { type: "heal", amount: CONFIG.POTION_BANDAGE_HEAL },
  },
  potion_antidote: {
    id: "potion_antidote",
    name: "Antidote",
    short: "Antidote",
    kind: "potion",
    slot: "potion",
    cost: 14,
    icon: "✚",
    desc: "Burns contact venom out of the blood.",
    stats: "Clears poison.",
    section: "potions",
    shop: true,
    effect: { type: "curePoison" },
  },
  scroll_ward: {
    id: "scroll_ward",
    name: "Scroll of Warding",
    short: "Ward",
    kind: "scroll",
    slot: "scroll",
    cost: 20,
    icon: "📜",
    desc: "A folded ward. Raises a brief shield.",
    stats: "Temporary shield.",
    section: "scrolls",
    shop: false,
    effect: { type: "shield", amount: 8 },
  },
  scroll_fortify: {
    id: "scroll_fortify",
    name: "Scroll of Fortify",
    short: "Fortify",
    kind: "scroll",
    slot: "scroll",
    cost: 22,
    icon: "📜",
    desc: "Ink that steadies the drawing arm.",
    stats: "Brief damage boost.",
    section: "scrolls",
    shop: false,
    effect: { type: "damage_boost", multiplier: 1.5, duration: 5 },
  },
};

export function getConsumable(id) {
  if (!id || typeof id !== "string") return null;
  return CONSUMABLE_DEFS[id] || null;
}

export function isConsumable(id) {
  return !!getConsumable(id);
}

export function consumableLabel(id) {
  return getConsumable(id)?.name || id;
}

export function shopConsumables() {
  return Object.values(CONSUMABLE_DEFS).filter((item) => item.shop);
}
