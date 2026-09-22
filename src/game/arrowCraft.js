/**
 * Five-axis arrows. 7 materials × 4 heads × 5 flights × 7 elements × 7 grades.
 * Stats are the GDD ratios, scaled to this game's hit points (wood point ≈ 1).
 */
export const MATERIALS = [
  { id: "wood", name: "Wood", tier: 1, phys: 1, vel: 1, break: 0.5, shaft: "#c4a070", head: "#8a6230", edge: "#3a2414", fletch: "#6b3418", color: "#c4a070" },
  { id: "bronze", name: "Bronze", tier: 2, phys: 2, vel: 1.07, break: 0.35, shaft: "#c4844a", head: "#a86228", edge: "#4a2810", fletch: "#6b3418", color: "#b87333" },
  { id: "iron", name: "Iron", tier: 3, phys: 3, vel: 1.17, break: 0.2, shaft: "#8e949c", head: "#5c646c", edge: "#1c2024", fletch: "#5a4030", color: "#9aa0a8" },
  { id: "steel", name: "Steel", tier: 4, phys: 4, vel: 1.33, break: 0.1, shaft: "#d5dbe0", head: "#aeb6be", edge: "#2a3036", fletch: "#4a4040", color: "#c8d0d8" },
  { id: "silver", name: "Silver", tier: 5, phys: 4, vel: 1.27, break: 0.25, undead: 2, shaft: "#f4f7fb", head: "#d5dee8", edge: "#5a6a78", fletch: "#8aa0b8", color: "#e8eef4" },
  { id: "obsidian", name: "Obsidian", tier: 6, phys: 5, vel: 1.2, break: 0.6, crit: 0.25, shaft: "#2a2430", head: "#3c334c", edge: "#c9a227", fletch: "#4a3058", color: "#3a2a38" },
  { id: "elven", name: "Elven", tier: 7, phys: 5, vel: 1.67, break: 0.05, shaft: "#f3ead4", head: "#e4c56a", edge: "#8a6818", fletch: "#c9a227", color: "#e8d48a" },
];

export const HEADS = [
  { id: "point", name: "Point", phys: 1, pen: 0 },
  { id: "broadhead", name: "Broadhead", phys: 1.35, pen: -0.2 },
  { id: "bodkin", name: "Bodkin", phys: 0.85, pen: 0.5 },
  { id: "barbed", name: "Barbed", phys: 0.9, pen: 0.1, bleed: 4.2, bleedDps: 2.2 },
];

export const FLIGHTS = [
  { id: "single", name: "Single", omit: true, count: 1, kind: "single", scalar: 1, spread: 0 },
  { id: "double-burst", name: "Double-Burst", count: 2, kind: "burst", scalar: 0.85, spread: 0 },
  { id: "triple-burst", name: "Triple-Burst", count: 3, kind: "burst", scalar: 0.75, spread: 0 },
  { id: "double-spread", name: "Double-Spread", count: 2, kind: "spread", scalar: 0.8, spread: 5 * Math.PI / 180 },
  { id: "triple-spread", name: "Triple-Spread", count: 3, kind: "spread", scalar: 0.7, spread: 10 * Math.PI / 180 },
];

export const ELEMENTS = [
  { id: "none", name: "None", omit: true, flat: 0 },
  { id: "flame", name: "Flame", flat: 2, channel: "fire", burn: 4, burnDps: 2, tint: "#e07030", fletch: "#ffb45a", glow: "rgba(224,112,48,0.55)" },
  { id: "ice", name: "Ice", flat: 1, channel: "frost", slow: 3, slowFactor: 0.32, tint: "#d8f0ff", fletch: "#6aa0c8", glow: "rgba(126,184,201,0.5)" },
  { id: "poison", name: "Poison", flat: 1, channel: "nature", poison: 6, poisonDps: 2, tint: "#6aaa5a", fletch: "#3d6a32", glow: "rgba(90,154,74,0.45)" },
  { id: "lightning", name: "Lightning", flat: 2, channel: "shock", stun: 0.55, tint: "#e8d56a", fletch: "#f0e878", glow: "rgba(232,213,106,0.5)" },
  { id: "holy", name: "Holy", flat: 2, channel: "holy", undead: 3, tint: "#f3ead4", fletch: "#e8c56a", glow: "rgba(243,234,212,0.45)" },
  { id: "enchanted", name: "Enchanted", flat: 2, channel: "arcane", tint: "#b090d8", fletch: "#6a4a8a", glow: "rgba(176,144,216,0.5)" },
];

export const QUALITIES = [
  { id: "rusty", name: "Rusty", stat: 0.8, vel: 0.9, break: 1.5 },
  { id: "shoddy", name: "Shoddy", stat: 0.9, vel: 0.95, break: 1.2 },
  { id: "basic", name: "Basic", omit: true, stat: 1, vel: 1, break: 1 },
  { id: "fine", name: "Fine", stat: 1.15, vel: 1.05, break: 0.8 },
  { id: "quality", name: "Quality", stat: 1.3, vel: 1.1, break: 0.5 },
  { id: "epic", name: "Epic", stat: 1.45, vel: 1.2, break: 0.2 },
  { id: "legendary", name: "Legendary", stat: 1.65, vel: 1.3, break: 0 },
];

const BY = {
  material: Object.fromEntries(MATERIALS.map((x) => [x.id, x])),
  head: Object.fromEntries(HEADS.map((x) => [x.id, x])),
  flight: Object.fromEntries(FLIGHTS.map((x) => [x.id, x])),
  element: Object.fromEntries(ELEMENTS.map((x) => [x.id, x])),
  quality: Object.fromEntries(QUALITIES.map((x) => [x.id, x])),
};

/** Old fixed types, kept so saves and loot strings still resolve. */
const LEGACY = {
  wood: "basic.single.none.wood.point",
  flint: "basic.single.none.bronze.point",
  iron: "basic.single.none.iron.point",
  steel: "basic.single.none.steel.point",
  silver: "basic.single.none.silver.point",
  fire: "basic.single.flame.iron.point",
  ice: "basic.single.ice.steel.point",
  piercing: "basic.single.none.steel.bodkin",
  double: "basic.double-spread.none.wood.point",
  stun: "basic.single.lightning.iron.point",
  poison: "basic.single.poison.iron.point",
  oil: "basic.single.flame.wood.broadhead",
  barbed: "basic.single.none.iron.barbed",
  shock: "basic.single.lightning.steel.point",
};

const LEVEL_GRADE = [null, "basic", "fine", "quality", "epic", "legendary"];
const NAME_ALIAS = { normal: "wood", kinetic: "wood", frost: "ice", twin: "double" };

const WOOD_MIN_GRADE = QUALITIES.findIndex((q) => q.id === "basic");

/** Wood is never rusty or shoddy. A green shaft does not rust. */
function gradesForMaterial(materialId, grades) {
  if (materialId !== "wood") return grades;
  const allowed = grades.filter((g) => QUALITIES.indexOf(g) >= WOOD_MIN_GRADE);
  return allowed.length ? allowed : [BY.quality.basic];
}

export function arrowPermutationCount() {
  const rest = HEADS.length * FLIGHTS.length * ELEMENTS.length;
  const woodGrades = QUALITIES.length - WOOD_MIN_GRADE;
  const otherMats = MATERIALS.length - 1;
  return otherMats * QUALITIES.length * rest + woodGrades * rest;
}

export function craftArrowId({ quality = "basic", flight = "single", element = "none", material = "wood", head = "point" } = {}) {
  return `${quality}.${flight}.${element}.${material}.${head}`;
}

function gradeForLevel(level) {
  const n = Math.max(1, Math.min(5, level | 0));
  return LEVEL_GRADE[n] || "basic";
}

export function parseArrow(type, level = 1) {
  const named = NAME_ALIAS[type] || type;
  let id = LEGACY[named] || named;
  if (!id || !BY.quality[String(id).split(".")[0]]) id = LEGACY.wood;
  let [quality, flight, element, material, head] = String(id).split(".");
  if (LEGACY[named] && level > 1) quality = gradeForLevel(level);
  const flightDef = BY.flight[flight] || BY.flight.single;
  const elementDef = BY.element[element] || BY.element.none;
  const materialDef = BY.material[material] || BY.material.wood;
  let qualityDef = BY.quality[quality] || BY.quality.basic;
  if (materialDef.id === "wood" && QUALITIES.indexOf(qualityDef) < WOOD_MIN_GRADE) {
    qualityDef = BY.quality.basic;
  }
  const headDef = BY.head[head] || BY.head.point;
  const spec = {
    id: craftArrowId({
      quality: qualityDef.id,
      flight: flightDef.id,
      element: elementDef.id,
      material: materialDef.id,
      head: headDef.id,
    }),
    quality: qualityDef.id,
    flight: flightDef.id,
    element: elementDef.id,
    material: materialDef.id,
    head: headDef.id,
    qualityDef,
    flightDef,
    elementDef,
    materialDef,
    headDef,
  };
  spec.name = arrowName(spec);
  spec.phys = arrowPhys(spec);
  spec.elem = arrowElem(spec);
  spec.break = arrowBreak(spec);
  spec.vel = materialDef.vel * qualityDef.vel;
  return spec;
}

export function arrowName(spec) {
  const parts = [];
  if (!spec.qualityDef.omit) parts.push(spec.qualityDef.name);
  if (!spec.flightDef.omit) parts.push(spec.flightDef.name);
  if (!spec.elementDef.omit) parts.push(spec.elementDef.name);
  parts.push(spec.materialDef.name, spec.headDef.name, "Arrow");
  return parts.join(" ");
}

export function arrowPhys(spec) {
  return spec.materialDef.phys * spec.headDef.phys * spec.flightDef.scalar * spec.qualityDef.stat;
}

export function arrowElem(spec) {
  return (spec.elementDef.flat || 0) * spec.qualityDef.stat;
}

export function arrowBreak(spec) {
  if (spec.qualityDef.id === "legendary") return 0;
  return Math.max(0, Math.min(1, spec.materialDef.break * spec.qualityDef.break));
}

/** Extra shafts from one draw. The first entry is the primary shot. */
export function flightShots(spec) {
  const f = spec.flightDef;
  if (f.kind === "spread" && f.count === 2) {
    return [{ yaw: -f.spread, back: 0 }, { yaw: f.spread, back: 0 }];
  }
  if (f.kind === "spread") {
    return [{ yaw: -f.spread, back: 0 }, { yaw: 0, back: 0 }, { yaw: f.spread, back: 0 }];
  }
  if (f.kind === "burst") {
    return Array.from({ length: f.count }, (_, i) => ({ yaw: 0, back: i * 16 }));
  }
  return [{ yaw: 0, back: 0 }];
}

/** Keep an enemy's material, element, and head. Flight and grade vary with depth. */
export function rollThemedArrow(type, level = 1, rand = Math.random) {
  const base = parseArrow(type, level);
  const cap = Math.max(0, QUALITIES.indexOf(base.qualityDef));
  const grades = gradesForMaterial(base.material, QUALITIES.slice(0, cap + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return parseArrow(craftArrowId({
    quality: pick(grades).id,
    flight: pick(FLIGHTS).id,
    element: base.element,
    material: base.material,
    head: base.head,
  }));
}

export function arrowTag(spec) {
  const q = { rusty: "Ry", shoddy: "Sh", basic: "", fine: "Fn", quality: "Ql", epic: "Ep", legendary: "Lg" };
  const f = { single: "", "double-burst": "2B", "triple-burst": "3B", "double-spread": "2S", "triple-spread": "3S" };
  const e = { none: "", flame: "Fl", ice: "Ic", poison: "Po", lightning: "Lt", holy: "Ho", enchanted: "En" };
  const m = { wood: "Wd", bronze: "Bz", iron: "Ir", steel: "St", silver: "Sv", obsidian: "Ob", elven: "El" };
  const h = spec.material === "wood" ? { point: "", broadhead: "", bodkin: "", barbed: "" } : { point: "", broadhead: "Br", bodkin: "Bo", barbed: "Ba" };
  return [q[spec.quality], f[spec.flight], e[spec.element], m[spec.material], h[spec.head] || ""].filter(Boolean).join("");
}

export function rollCraftedArrow(rand = Math.random, { maxTier = 7, maxGrade = 6 } = {}) {
  const mats = MATERIALS.filter((m) => m.tier <= maxTier);
  const grades = QUALITIES.filter((_, i) => i <= maxGrade);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const material = pick(mats);
  return parseArrow(craftArrowId({
    quality: pick(gradesForMaterial(material.id, grades)).id,
    flight: pick(FLIGHTS).id,
    element: pick(ELEMENTS).id,
    material: material.id,
    head: pick(HEADS).id,
  }));
}

const _defs = new Map();

/** Shape consumed by the quiver, shop, and shot pipeline. */
export function arrowDef(type, level = 1) {
  const spec = parseArrow(type, level);
  const key = `${spec.id}@${level}`;
  const hit = _defs.get(key);
  if (hit) return hit;
  const el = spec.elementDef;
  const def = {
    type: spec.id,
    legacy: LEGACY[type] ? type : null,
    name: spec.name,
    desc: spec.name,
    cost: 4 + spec.materialDef.tier * 3 + (QUALITIES.indexOf(spec.qualityDef) * 2) + (el.flat ? 4 : 0),
    damage: spec.phys,
    fireDamage: el.channel === "fire" ? spec.elem : 0,
    iceDamage: el.channel === "frost" ? spec.elem : 0,
    elemDamage: el.channel && el.channel !== "fire" && el.channel !== "frost" ? spec.elem : 0,
    shop: spec.id !== LEGACY.wood,
    tier: spec.materialDef.tier,
    color: spec.materialDef.color,
    element: el.id,
    material: spec.materialDef.id,
    head: spec.headDef.id,
    flight: spec.flightDef.id,
    quality: spec.qualityDef.id,
    break: spec.break,
    vel: spec.vel,
    pen: spec.headDef.pen,
    critBonus: spec.materialDef.crit || 0,
    undeadPhys: spec.materialDef.undead || 1,
    undeadElem: el.undead || 1,
    short: arrowTag(spec),
    hardTip: spec.materialDef.id !== "wood" && (spec.headDef.id === "bodkin" || spec.materialDef.id === "iron" || spec.materialDef.id === "steel"),
    pierce: spec.headDef.id === "bodkin" ? 1 : 0,
    burn: el.burn,
    burnDps: el.burnDps,
    slow: el.slow,
    slowFactor: el.slowFactor,
    poison: el.poison,
    poisonDps: el.poisonDps,
    stun: el.stun,
    bleed: spec.headDef.bleed,
    bleedDps: spec.headDef.bleedDps,
    icon: "➤",
  };
  _defs.set(key, def);
  return def;
}
