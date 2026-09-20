import test from "node:test";
import assert from "node:assert/strict";
import { ARROW_DEFS } from "../src/game/QuiverDeckManager.js";
import { getArrowLook } from "../src/game/arrowLook.js";
import { CorridorSim } from "../src/game/CorridorSim.js";

test("arrow looks map existing types onto distinct head/element/flight tags", () => {
  assert.equal(getArrowLook("wood").head, "point");
  assert.equal(getArrowLook("wood").element, "none");
  assert.equal(getArrowLook("fire").head, "flame");
  assert.equal(getArrowLook("fire").element, "flame");
  assert.equal(getArrowLook("piercing").head, "bodkin");
  assert.equal(getArrowLook("barbed").head, "barbed");
  assert.equal(getArrowLook("double").shafts, 2);
  assert.equal(getArrowLook("double").flight, "spread");
  assert.equal(getArrowLook("shock").head, "bolt");
  assert.equal(getArrowLook("shock").element, "shock");
  assert.equal(getArrowLook("poison").element, "poison");
  assert.equal(getArrowLook("ice").element, "ice");
  assert.equal(getArrowLook("silver").head, "star");
  assert.equal(getArrowLook("stun").head, "blunt");
  const keys = new Set(Object.keys(ARROW_DEFS).map((t) => {
    const look = getArrowLook(t);
    return `${look.head}:${look.element}:${look.flight}:${look.material}`;
  }));
  assert.ok(keys.size >= 10, "types should not all share one silhouette");
});

test("quality grade follows arrow level", () => {
  assert.equal(getArrowLook("steel", 1).quality, 1);
  assert.equal(getArrowLook("steel", 5).quality, 5);
});

test("nock stamps look onto the live projectile without consuming the quiver", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.queue = [];
  sim.quiver.deck = [];
  sim.quiver.addToQuiver({ type: "barbed", level: 2 });
  const before = sim.quiver.quiverCount;
  sim.nockArrow({ pulling: true, angle: 0.2, speed: 400 });
  assert.equal(sim.quiver.quiverCount, before);
  assert.equal(sim.nocked.look.head, "barbed");
  assert.equal(sim.nocked.headColor, getArrowLook("barbed", 2).headColor);
  sim.clearNocked();
  assert.equal(sim.nocked, null);
  assert.equal(sim.quiver.quiverCount, before);
});
