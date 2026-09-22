/**
 * Hand-drawn shop / pack glyphs — gold-ink SVGs instead of emoji.
 */
import { consumableIconSvg, getConsumable } from "../data/consumables.js";
import { getArrowLook } from "../game/arrowLook.js";

const STROKE = "#c9a227";
const INK = "#2c1a0c";

function svg(inner, className = "") {
  const cls = className ? ` class="${className}"` : "";
  return `<svg viewBox="0 0 24 24" width="24" height="24"${cls} aria-hidden="true">${inner}</svg>`;
}

/** Fan pivot. Shafts are drawn past this and clipped flush with the frame. */
const NOCK = 14.4;
const SHAFT_END = 17.6;
const SHAFT_W = 0.82;
const SHAFT_COLOR = "#c4a070";
let _clip = 0;

/** Head geometry only. Wood never uses these — its shaft is sharpened instead. */
const HEAD_ART = {
  point: {
    fill: "M0,-7.5 L5.5,6.7 L0,5.3 L-5.5,6.7 Z",
    shade: "M0,-7.5 L0,5.3 L-5.5,6.7 Z",
    tip: -7.5,
  },
  broadhead: {
    fill: "M0,-8 L7.6,4.6 L3.05,5.6 L0,8 L-3.05,5.6 L-7.6,4.6 Z",
    shade: "M0,-8 L0,8 L-3.05,5.6 L-7.6,4.6 Z",
    tip: -8,
  },
  bodkin: {
    fill: "M0,-8.2 L1.7,8 L0,6.7 L-1.7,8 Z",
    shade: "M0,-8.2 L0,6.7 L-1.7,8 Z",
    tip: -8.2,
  },
  barbed: {
    fill: "M0,-7 L5.5,5.6 L1.75,4.5 L0,7.6 L-1.75,4.5 L-5.5,5.6 Z M4.1,5.05 L7,9.8 L1.9,6.7 Z M-4.1,5.05 L-7,9.8 L-1.9,6.7 Z",
    shade: "M0,-7 L0,7.6 L-1.75,4.5 L-5.5,5.6 Z",
    tip: -7,
  },
};

const WOOD_SHAFT = `M0,-4.8 L${SHAFT_W},-1.9 L${SHAFT_W},${SHAFT_END} L-${SHAFT_W},${SHAFT_END} L-${SHAFT_W},-1.9 Z`;

function qualityFrame(quality) {
  const frame = {
    rusty: ["#6b4424", 1.35, "1.5 1.3"],
    shoddy: ["#5c3a22", 2.15, ""],
    basic: ["#3e342c", 1.2, ""],
    fine: ["#2f4a66", 1.4, ""],
    quality: ["#8a6414", 1.65, ""],
    epic: ["#6a4a8a", 1.7, ""],
    legendary: ["#2c1a0c", 1.8, ""],
  }[quality] || ["#3e342c", 1.2, ""];
  const dash = frame[2] ? ` stroke-dasharray="${frame[2]}"` : "";
  let inner = "";
  if (quality === "epic") inner = `<rect x="2.35" y="2.35" width="19.3" height="19.3" fill="none" stroke="#c9b0e0" stroke-width="0.65"/>`;
  if (quality === "legendary") inner = `<rect x="2.4" y="2.4" width="19.2" height="19.2" fill="none" stroke="#c9a227" stroke-width="0.8"/>`;
  return `<rect x="1.1" y="1.1" width="21.8" height="21.8" fill="none" stroke="${frame[0]}" stroke-width="${frame[1]}"${dash}/>${inner}`;
}

function parchment() {
  return `<rect width="24" height="24" fill="#e8d2a2"/>`
    + `<rect width="24" height="24" fill="#f8e7c0" opacity="0.35"/>`
    + `<rect y="14" width="24" height="10" fill="#b88848" opacity="0.1"/>`
    + `<path d="M1.6 8.4 H22.4 M1.6 16.2 H22.4" stroke="#8a5a30" stroke-width="0.22" opacity="0.22"/>`;
}

function elementMark(element, color, tip) {
  const y = tip;
  if (element === "flame") return `<path d="M${2.2},${y + 0.4} C${3.6},${y + 1.5} ${3.7},${y + 3.1} ${2.1},${y + 3.7}" fill="none" stroke="${color}" stroke-width="0.75" stroke-linecap="round"/>`;
  if (element === "ice") return `<path d="M${-1.7},${y + 0.5} L${-3.1},${y - 0.7} M${1.7},${y + 0.8} L${3.2},${y - 0.3}" fill="none" stroke="${color}" stroke-width="0.7" stroke-linecap="round"/>`;
  if (element === "poison") return `<circle cx="2.5" cy="${y + 3.4}" r="0.95" fill="${color}"/>`;
  if (element === "lightning") return `<path d="M${2.7},${y + 0.2} L${1.2},${y + 2} H${2.5} L${0.9},${y + 4.2}" fill="none" stroke="${color}" stroke-width="0.75" stroke-linejoin="round"/>`;
  if (element === "holy") return `<circle cx="0" cy="${y + 1.6}" r="2.15" fill="none" stroke="${color}" stroke-width="0.6"/>`;
  if (element === "enchanted") return `<path d="M-3.4,${y + 0.6} Q0,${y + 2.2} 3.4,${y + 0.6}" fill="none" stroke="${color}" stroke-width="0.75"/>`;
  return "";
}

function oneArrow(look, { stroke = true, mark = false } = {}) {
  const fill = look.fill;
  const shade = look.shade;
  const outline = look.outline;
  if (look.shape === "sharpened") {
    const side = `M-0.16,-3.7 L-0.16,${SHAFT_END - 0.5} L-${SHAFT_W - 0.22},${SHAFT_END - 0.5} L-${SHAFT_W * 0.55},-1.7 Z`;
    const ink = stroke ? `<path d="${WOOD_SHAFT}" fill="none" stroke="${outline}" stroke-width="0.7" stroke-linejoin="round"/>` : "";
    const glyph = mark ? elementMark(look.element, outline, -4.4) : "";
    return `<path d="${WOOD_SHAFT}" fill="${fill}"/><path d="${side}" fill="${shade}" opacity="0.4"/>${ink}${glyph}`;
  }
  const art = HEAD_ART[look.shape] || HEAD_ART.point;
  const ink = stroke ? `<path d="${art.fill}" fill="none" stroke="${outline}" stroke-width="1.02" stroke-linejoin="round"/>` : "";
  const glyph = mark ? elementMark(look.element, outline, art.tip) : "";
  return `<rect x="${-SHAFT_W}" y="5.4" width="${SHAFT_W * 2}" height="${SHAFT_END - 5.4}" fill="${SHAFT_COLOR}"/>`
    + `<path d="${art.fill}" fill="${fill}"/>`
    + `<path d="${art.shade}" fill="${shade}" opacity="0.38"/>`
    + ink
    + glyph;
}

/** Paint order is back to front. Burst stacks; spread fans from the nock. */
function flightPlacements(flight) {
  if (flight === "double-burst") return [{ x: -1.25, y: 0.35, rot: 0 }, { x: 0.35, y: 0, rot: 0 }];
  if (flight === "triple-burst") return [{ x: -1.55, y: 0.4, rot: 0 }, { x: 1.55, y: 0.4, rot: 0 }, { x: 0, y: 0, rot: 0 }];
  if (flight === "double-spread") return [{ x: 0, y: 0, rot: -18 }, { x: 0, y: 0, rot: 18 }];
  if (flight === "triple-spread") return [{ x: 0, y: 0, rot: -22 }, { x: 0, y: 0, rot: 22 }, { x: 0, y: 0, rot: 0 }];
  return [{ x: 0, y: 0, rot: 0 }];
}

function arrowIcon(type, _color = "#c4a574", level = 1) {
  const look = getArrowLook(type, level);
  const cid = `aq${++_clip}`;
  const places = flightPlacements(look.flight);
  const burst = look.flight.endsWith("burst");
  const last = places.length - 1;
  const heads = places.map((p, i) => (
    `<g transform="translate(${p.x} ${p.y}) rotate(${p.rot} 0 ${NOCK})">${oneArrow(look, {
      stroke: !burst || i === last,
      mark: i === last,
    })}</g>`
  )).join("");
  const inner = `${parchment()}<defs><clipPath id="${cid}"><rect x="1.75" y="1.75" width="20.5" height="20.5"/></clipPath></defs>`
    + `<g clip-path="url(#${cid})"><g transform="translate(12 12) rotate(-45)">${heads}</g></g>${qualityFrame(look.quality)}`;
  return `<svg viewBox="0 0 24 24" width="24" height="24" class="rq-icon" aria-hidden="true" data-shape="${look.shape}" data-head="${look.head}" data-flight="${look.flight}" data-quality="${look.quality}" data-element="${look.element}" data-material="${look.material}" data-count="${look.shafts}">${inner}</svg>`;
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
    return arrowIcon(type, item.color, item.level || 1);
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

export function arrowIconSvg(type, color, level = 1) {
  return arrowIcon(type, color, level);
}
