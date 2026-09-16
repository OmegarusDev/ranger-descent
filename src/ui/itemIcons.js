/**
 * Hand-drawn shop / pack glyphs — gold-ink SVGs instead of emoji.
 */
import { consumableIconSvg, getConsumable } from "../data/consumables.js";

const STROKE = "#c9a227";
const INK = "#2c1a0c";

function svg(inner) {
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${inner}</svg>`;
}

function arrowIcon(type, color = "#c4a574") {
  const c = color || "#c4a574";
  const fletch = `<path d="M9 20 L12 17 L15 20" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  const shaft = `<rect x="11.15" y="7.5" width="1.7" height="11.2" fill="${c}"/>`;
  const heads = {
    wood: `<path d="M12 3 L16 8 H8 Z" fill="${c}" stroke="${STROKE}" stroke-width="0.7"/>`,
    flint: `<path d="M12 2.8 L16.2 8.2 L12 7 L7.8 8.2 Z" fill="#8a8478" stroke="${STROKE}" stroke-width="0.7"/>`,
    iron: `<path d="M12 2.6 L15.6 7.4 H8.4 Z" fill="#9aa0a8" stroke="${STROKE}" stroke-width="0.8"/>`,
    steel: `<path d="M12 2.4 L16 7.6 H8 Z" fill="#c8d0d8" stroke="${STROKE}" stroke-width="0.8"/>`,
    fire: `<path d="M12 2.8 C14.8 6 16 8 12 8 C8 8 9.2 6 12 2.8 Z" fill="#e07a3a" stroke="${STROKE}" stroke-width="0.7"/><path d="M12 4.2 C13.2 6 13.6 7.2 12 7.2 C10.4 7.2 10.8 6 12 4.2 Z" fill="#f3ead4"/>`,
    ice: `<path d="M12 3 L14.8 7.6 L12 6.4 L9.2 7.6 Z" fill="#c8e8f0" stroke="#7eb8c9" stroke-width="0.8"/><path d="M12 3 V8.2 M9.4 5.2 H14.6" stroke="#7eb8c9" stroke-width="0.8"/>`,
    piercing: `<path d="M12 2.2 L14.2 8 H9.8 Z" fill="#e8d5a0" stroke="${STROKE}" stroke-width="0.7"/>`,
    double: `<path d="M8.2 3.2 L11 8 H7 Z" fill="${c}" stroke="${STROKE}" stroke-width="0.7"/><path d="M15.8 3.2 L17 8 H13 Z" fill="${c}" stroke="${STROKE}" stroke-width="0.7"/>`,
    stun: `<circle cx="12" cy="6.2" r="3.4" fill="#c9b070" stroke="${STROKE}" stroke-width="0.9"/>`,
    poison: `<path d="M12 3 L15.4 8 H8.6 Z" fill="#6a3a78" stroke="${STROKE}" stroke-width="0.7"/><circle cx="12" cy="6.2" r="1.2" fill="#9a6bb8"/>`,
    oil: `<circle cx="12" cy="6.4" r="3.2" fill="#5a4018" stroke="${STROKE}" stroke-width="0.8"/><path d="M12 4.2 Q13.6 6.4 12 8" fill="#8a7040"/>`,
    silver: `<path d="M12 2.6 L13.6 6.2 L17.2 6.4 L14.4 8.8 L15.2 12.2 L12 10.2 L8.8 12.2 L9.6 8.8 L6.8 6.4 L10.4 6.2 Z" fill="#e8eef4" stroke="${STROKE}" stroke-width="0.6"/>`,
    barbed: `<path d="M12 2.8 L15.8 8.2 L12 7 L8.2 8.2 Z" fill="#a85848" stroke="${STROKE}" stroke-width="0.7"/><path d="M8.6 8.4 L7.2 10.6 M15.4 8.4 L16.8 10.6" stroke="#a85848" stroke-width="1.1"/>`,
    shock: `<path d="M13.4 2.6 L9.2 9.2 H12.2 L10.6 14.2 L16.2 7.2 H13.2 Z" fill="#7ec8e0" stroke="${STROKE}" stroke-width="0.7"/>`,
  };
  const head = heads[type] || heads.wood;
  if (type === "double") {
    return svg(`<rect x="8.2" y="8" width="1.5" height="10" fill="${c}"/><rect x="14.3" y="8" width="1.5" height="10" fill="${c}"/>${head}<path d="M6.6 20 L8.9 17.2 L11.2 20" fill="none" stroke="${c}" stroke-width="1.1"/><path d="M12.8 20 L15.1 17.2 L17.4 20" fill="none" stroke="${c}" stroke-width="1.1"/>`);
  }
  if (type === "shock") {
    return svg(`${heads.shock}${fletch}`);
  }
  return svg(`${head}${shaft}${fletch}`);
}

const ICONS = {
  bag: svg(`<path d="M6 9 H18 L17 20 H7 Z" fill="#6b4424" stroke="${STROKE}" stroke-width="1.35"/><path d="M9 9 V7.2 C9 5.4 15 5.4 15 7.2 V9" fill="none" stroke="${STROKE}" stroke-width="1.4"/><path d="M8 13 H16" stroke="#c9a227" stroke-width="1.15"/>`),
  pouch: svg(`<path d="M7 10 C6 14 7 20 12 20 C17 20 18 14 17 10 Z" fill="#8a5a28" stroke="${STROKE}" stroke-width="1.35"/><path d="M9.2 10 C10 7.4 14 7.4 14.8 10" fill="none" stroke="${STROKE}" stroke-width="1.4"/><circle cx="12" cy="14.5" r="1.5" fill="${STROKE}"/>`),
  quiver: svg(`<path d="M8 20 L10 4 H14 L16 20 Z" fill="#6b4424" stroke="${STROKE}" stroke-width="1.35"/><path d="M10.4 4 L11.2 1.6 H12.8 L13.6 4" fill="#c4a574" stroke="${STROKE}" stroke-width="0.9"/><path d="M8.6 12 H15.4" stroke="#c9a227" stroke-width="1.15"/>`),
  bow: svg(`<path d="M18 3.4 C12.8 4.4 6.6 7.8 6.8 12 C6.6 16.2 12.8 19.6 18 20.6" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/><path d="M17.4 4.4 C12.8 5.4 8 8.2 8.2 12 C8 15.8 12.8 18.6 17.4 19.6" fill="none" stroke="#6b4424" stroke-width="1.05"/><path d="M18 3.6 V20.4" fill="none" stroke="#c4a574" stroke-width="1.2" stroke-linecap="round"/><rect x="7.3" y="10.3" width="2.7" height="3.4" rx="0.7" fill="#6b4424" stroke="${STROKE}" stroke-width="0.55"/>`),
  dagger: svg(`<path d="M12 3 L14.2 12 H9.8 Z" fill="#c8d0d8" stroke="${STROKE}" stroke-width="1"/><rect x="9" y="12" width="6" height="2.2" fill="#6b4424" stroke="${STROKE}" stroke-width="0.85"/><rect x="11.2" y="14" width="1.6" height="7" fill="#5a3418"/>`),
  amulet: svg(`<circle cx="12" cy="14" r="5.2" fill="#4a7a3a" stroke="${STROKE}" stroke-width="1.3"/><circle cx="12" cy="14" r="2.2" fill="#c9a227"/><path d="M12 3 C10 7 8.5 8.5 8.5 9.5" fill="none" stroke="${STROKE}" stroke-width="1.3"/>`),
  head: svg(`<path d="M6 14 C6 7.5 18 7.5 18 14 V17 H6 Z" fill="#6a5a48" stroke="${STROKE}" stroke-width="1.3"/><path d="M7 14 H17" stroke="${INK}" stroke-width="0.9"/><rect x="8.5" y="9.2" width="7" height="3" fill="#2a2018"/>`),
  body: svg(`<path d="M7 7 L12 5 L17 7 L16.2 20 H7.8 Z" fill="#5a4a38" stroke="${STROKE}" stroke-width="1.3"/><path d="M12 5 V20" stroke="#c9a227" stroke-width="0.95"/>`),
  feet: svg(`<path d="M6 10 H13 L17 18 H6 Z" fill="#4a3418" stroke="${STROKE}" stroke-width="1.3"/><path d="M6 14 H16" stroke="#c9a227" stroke-width="0.95"/>`),
  unknown: svg(`<rect x="5" y="5" width="14" height="14" fill="none" stroke="${STROKE}" stroke-width="1.4"/><path d="M9 9 L15 15 M15 9 L9 15" stroke="${STROKE}" stroke-width="1.25"/>`),
};

const SHADOW = "#c9b08a";

function shadowSvg(inner) {
  return `<svg viewBox="0 0 24 24" width="24" height="24" class="pack-slot-empty-icon" fill="${SHADOW}" stroke="none" aria-hidden="true">${inner}</svg>`;
}

/** Flat filled silhouettes — empty-slot shadows, no inner detail. */
const SLOT_EMPTY = {
  cape: shadowSvg(`<path d="M7 5 L12 8 L17 5 L19 20 Q12 16 5 20 Z"/>`),
  head: shadowSvg(`<path d="M6 14 C6 7.4 18 7.4 18 14 V18 H6 Z"/>`),
  amulet: shadowSvg(`<rect x="11.1" y="3" width="1.8" height="6"/><circle cx="12" cy="14.5" r="5.2"/>`),
  bow: `<svg viewBox="0 0 24 24" width="24" height="24" class="pack-slot-empty-icon" fill="none" stroke="${SHADOW}" stroke-linecap="round" aria-hidden="true"><path d="M18 3.4 C12.8 4.4 6.6 7.8 6.8 12 C6.6 16.2 12.8 19.6 18 20.6" stroke-width="2.3"/><path d="M18 3.6 V20.4" stroke-width="1.25"/></svg>`,
  body: shadowSvg(`<path d="M7 7 L12 4.8 L17 7 L16.2 20 H7.8 Z"/>`),
  dagger: shadowSvg(`<path d="M12 3 L14.4 13.2 H9.6 Z"/><rect x="8.6" y="13" width="6.8" height="2.4"/><rect x="11.1" y="15.2" width="1.8" height="6"/>`),
  arms: shadowSvg(`<path d="M8.2 5 H15.8 L16.4 10.2 H7.6 Z"/><path d="M8 10.2 H16 L15 20 H9 Z"/>`),
  belt: shadowSvg(`<rect x="3.5" y="10.2" width="17" height="3.8" rx="0.6"/><rect x="10" y="8.8" width="4" height="6.4" rx="0.5"/>`),
  quiver: shadowSvg(`<path d="M8 20 L10 4 H14 L16 20 Z"/><rect x="10.6" y="1.6" width="2.8" height="2.6"/>`),
  legs: shadowSvg(`<rect x="7.2" y="4" width="3.6" height="16.5"/><rect x="13.2" y="4" width="3.6" height="16.5"/>`),
  feet: shadowSvg(`<path d="M6 11 H13.2 L18 20 H6 Z"/>`),
};

/** Flat silhouette for an empty paper-doll slot. */
export function slotIconSvg(slot) {
  return SLOT_EMPTY[slot] || shadowSvg(`<rect x="6" y="6" width="12" height="12" rx="1.5"/>`);
}

/** Tiny pouch pip for a bag cell bound to the quick pouch. */
export function pouchPipSvg() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 10 C6 14 7 20 12 20 C17 20 18 14 17 10 Z" fill="#8a5a28" stroke="${STROKE}" stroke-width="1.5"/><path d="M9.2 10 C10 7.4 14 7.4 14.8 10" fill="none" stroke="${STROKE}" stroke-width="1.4"/></svg>`;
}

/** SVG markup for a shop / pack item. */
export function itemIconSvg(item) {
  if (!item) return ICONS.unknown;
  if (typeof item === "string") {
    const potion = getConsumable(item);
    if (potion) return consumableIconSvg(item);
    item = { id: item };
  }
  const type = item.type || item.element;
  if (item.section === "arrows" || item.slot === "ammo" || (type && item.color)) {
    return arrowIcon(type, item.color);
  }
  if (item.kind === "bag_upgrade" || (item.id && String(item.id).startsWith("bag_slot"))) return ICONS.bag;
  if (item.kind === "pouch_upgrade" || (item.id && String(item.id).startsWith("pouch_slot"))) return ICONS.pouch;
  if (item.section === "quivers" || item.slot === "quiver") return ICONS.quiver;
  if (item.slot === "bow") return ICONS.bow;
  if (item.slot === "dagger") return ICONS.dagger;
  if (item.slot === "amulet") return ICONS.amulet;
  if (item.slot === "head") return ICONS.head;
  if (item.slot === "body") return ICONS.body;
  if (item.slot === "feet") return ICONS.feet;
  if (item.id && getConsumable(item.id)) return consumableIconSvg(item.id);
  if (item.section === "potions" || item.kind === "potion") return consumableIconSvg(item.id);
  return ICONS.unknown;
}

export function arrowIconSvg(type, color) {
  return arrowIcon(type, color);
}
