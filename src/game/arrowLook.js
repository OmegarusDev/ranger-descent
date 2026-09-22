/**
 * Visual profile for a crafted arrow.
 * Wood is always a sharpened shaft. Other heads keep their own geometry.
 * Fill is the material. The outline is the element. Count is the flight.
 */
import { parseArrow } from "./arrowCraft.js";

export function getArrowLook(type, level = 1) {
  const spec = parseArrow(type, level);
  const mat = spec.materialDef;
  const el = spec.elementDef;
  const wood = spec.material === "wood";
  const outline = el.tint || mat.edge;
  const fill = wood ? mat.shaft : mat.head;
  return {
    type: spec.id,
    name: spec.name,
    color: mat.color,
    head: spec.head,
    shape: wood ? "sharpened" : spec.head,
    material: spec.material,
    element: spec.element,
    flight: spec.flight,
    shafts: spec.flightDef.count,
    quality: spec.quality,
    fill,
    shade: wood ? mat.head : mat.edge,
    outline,
    shaftColor: mat.shaft,
    headColor: fill,
    edgeColor: mat.edge,
    fletchColor: el.fletch || mat.fletch,
    glow: el.glow || null,
    spread: spec.flightDef.kind === "spread" ? spec.flightDef.spread : 0,
  };
}
