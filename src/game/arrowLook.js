/**
 * Visual profile for an existing ARROW_DEFS type.
 * The five GDD axes (material / head / flight / element / quality) are tags
 * on the live catalog — not a 4,200-item generator.
 */
import { getArrowDef, normalizeArrowLevel, normalizeArrowType } from "./QuiverDeckManager.js";

const MATERIALS = {
  wood: { shaft: "#c4a070", head: "#8a6230", fletch: "#6b3418" },
  stone: { shaft: "#b8a888", head: "#8a8478", fletch: "#5a5048" },
  iron: { shaft: "#d0c8b8", head: "#9aa0a8", fletch: "#5a4030" },
  steel: { shaft: "#d8dce0", head: "#c8d0d8", fletch: "#4a4040" },
  silver: { shaft: "#e8eef4", head: "#f4f8fc", fletch: "#8aa0b8" },
  copper: { shaft: "#d0b070", head: "#c9a050", fletch: "#c9a227" },
};

/** Per-type axis tags. Quality is the arrow's level (1–5). */
const PROFILES = {
  wood: { head: "point", material: "wood", element: "none", flight: "single", shafts: 1 },
  flint: { head: "flint", material: "stone", element: "none", flight: "single", shafts: 1 },
  iron: { head: "point", material: "iron", element: "none", flight: "single", shafts: 1 },
  steel: { head: "point", material: "steel", element: "none", flight: "single", shafts: 1 },
  silver: { head: "star", material: "silver", element: "none", flight: "single", shafts: 1 },
  fire: { head: "flame", material: "iron", element: "flame", flight: "single", shafts: 1 },
  ice: { head: "ice", material: "steel", element: "ice", flight: "single", shafts: 1 },
  piercing: { head: "bodkin", material: "steel", element: "none", flight: "single", shafts: 1 },
  double: { head: "point", material: "wood", element: "none", flight: "spread", shafts: 2 },
  stun: { head: "blunt", material: "iron", element: "none", flight: "single", shafts: 1 },
  poison: { head: "point", material: "iron", element: "poison", flight: "single", shafts: 1 },
  oil: { head: "blunt", material: "wood", element: "oil", flight: "single", shafts: 1 },
  barbed: { head: "barbed", material: "iron", element: "none", flight: "single", shafts: 1 },
  shock: { head: "bolt", material: "copper", element: "shock", flight: "single", shafts: 1 },
};

const ELEMENT = {
  none: { glow: null, fletch: null, head: null },
  flame: { glow: "rgba(224, 112, 48, 0.55)", fletch: "#ffb45a", head: "#e07030" },
  ice: { glow: "rgba(180, 230, 255, 0.5)", fletch: "#6aa0c8", head: "#d8f0ff" },
  poison: { glow: "rgba(160, 80, 200, 0.5)", fletch: "#6a3a78", head: "#c070e0" },
  oil: { glow: "rgba(90, 64, 24, 0.4)", fletch: "#5a4018", head: "#8a7040" },
  shock: { glow: "rgba(240, 232, 120, 0.55)", fletch: "#f0e878", head: "#7ec8e0" },
};

export function getArrowLook(type, level = 1) {
  const key = normalizeArrowType(type);
  const def = getArrowDef(key);
  const quality = normalizeArrowLevel(level);
  const profile = PROFILES[key] || PROFILES.wood;
  const mat = MATERIALS[profile.material] || MATERIALS.wood;
  const el = ELEMENT[profile.element] || ELEMENT.none;
  return {
    type: key,
    name: def.name,
    color: def.color,
    head: profile.head,
    material: profile.material,
    element: profile.element,
    flight: profile.flight,
    shafts: profile.shafts,
    quality,
    shaftColor: mat.shaft,
    headColor: el.head || mat.head,
    fletchColor: el.fletch || mat.fletch,
    glow: el.glow,
    spread: profile.flight === "spread" ? 0.09 : 0,
  };
}
