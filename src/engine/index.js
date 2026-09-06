/**
 * RenderEngine2D5 — public API surface.
 * Import from "engine/RenderEngine2D5.js" for the full engine.
 * Re-export sub-modules for convenience.
 */
export { RenderEngine2D5, renderDescriptor } from "./RenderEngine2D5.js";
export { CorridorCamera, CAMERA, setCameraPitch, deckRy } from "./corridorCamera.js";
export { FxSystem } from "./fx.js";
export {
  shade, withAlpha, matsFrom, hash21,
  roundRect, fillPoly, strokePoly,
} from "./drawUtil.js";
export {
  vz, cyl25, box25, frustum25, diamondPrism25,
  ring25, rivetRing, capEllipse,
} from "./prims25.js";
