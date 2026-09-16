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

const ITEM_ICONS = {
  potion_salve: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><ellipse cx="12" cy="16" rx="6" ry="5.5" fill="#2a4a28" stroke="#c9a227" stroke-width="1.4"/><path d="M8 16.5 Q12 19 16 16.5" fill="#5a9a48"/><rect x="10" y="4" width="4" height="6" rx="1" fill="#6b4424" stroke="#c9a227" stroke-width="1"/><path d="M7 9 Q12 5 17 10" fill="none" stroke="#6aaa5a" stroke-width="1.5"/><circle cx="16.5" cy="8" r="2.2" fill="#4a8a3a"/></svg>`,
  potion_bandage: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="4" y="8" width="16" height="9" rx="2" fill="#e8dcc4" stroke="#8a6818" stroke-width="1.4"/><rect x="4" y="11" width="16" height="3" fill="#d4c4a0"/><path d="M12 10.2 V14.8 M10.2 12.5 H13.8" stroke="#c45a4a" stroke-width="1.7" stroke-linecap="round"/><rect x="3.5" y="7" width="4" height="11" rx="1" fill="#c8b898" stroke="#6b4424" stroke-width="1"/></svg>`,
  potion_antidote: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 7 H15 L16.5 20 H7.5 Z" fill="#1e3a28" stroke="#c9a227" stroke-width="1.4"/><path d="M9.4 12 L15.2 18.5" fill="#3d8a58"/><rect x="10" y="3.5" width="4" height="4" rx="0.8" fill="#6b4424" stroke="#c9a227" stroke-width="1"/><circle cx="12" cy="14" r="2.1" fill="#7ecf7a"/></svg>`,
  scroll_ward: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 6 Q7 4 9 6 V19 Q7 17 5 19 Z" fill="#c9a227"/><path d="M19 6 Q17 4 15 6 V19 Q17 17 19 19 Z" fill="#c9a227"/><rect x="8" y="5" width="8" height="14" fill="#e8dcc4" stroke="#8a6818" stroke-width="1.1"/><path d="M12 8.5 L14.4 10.2 L13.6 13.2 H10.4 L9.6 10.2 Z" fill="none" stroke="#4a7a9a" stroke-width="1.4"/></svg>`,
  scroll_fortify: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 6 Q7 4 9 6 V19 Q7 17 5 19 Z" fill="#c9a227"/><path d="M19 6 Q17 4 15 6 V19 Q17 17 19 19 Z" fill="#c9a227"/><rect x="8" y="5" width="8" height="14" fill="#e8dcc4" stroke="#8a6818" stroke-width="1.1"/><path d="M12 9 L14.2 12.2 H12.7 V15.5 H11.3 V12.2 H9.8 Z" fill="#c45a4a"/></svg>`,
};

export function consumableIconSvg(id) {
  if (ITEM_ICONS[id]) return ITEM_ICONS[id];
  const def = getConsumable(id);
  if (def && def.kind === "scroll") return ITEM_ICONS.scroll_ward;
  return ITEM_ICONS.potion_salve;
}
