import test from "node:test";
import assert from "node:assert/strict";
import { ARROW_DEFS } from "../src/game/QuiverDeckManager.js";
import { getArrowLook } from "../src/game/arrowLook.js";
import { CorridorSim } from "../src/game/CorridorSim.js";
import { arrowIconSvg } from "../src/ui/itemIcons.js";

test("arrow looks map types onto head, element, and flight", () => {
  assert.equal(getArrowLook("wood").head, "point");
  assert.equal(getArrowLook("wood").shape, "sharpened");
  assert.equal(getArrowLook("wood").element, "none");
  assert.equal(getArrowLook("fire").head, "point");
  assert.equal(getArrowLook("fire").element, "flame");
  assert.equal(getArrowLook("piercing").head, "bodkin");
  assert.equal(getArrowLook("piercing").shape, "bodkin");
  assert.equal(getArrowLook("barbed").head, "barbed");
  assert.equal(getArrowLook("double").shafts, 2);
  assert.equal(getArrowLook("double").flight, "double-spread");
  assert.equal(getArrowLook("shock").head, "point");
  assert.equal(getArrowLook("shock").element, "lightning");
  assert.equal(getArrowLook("poison").element, "poison");
  assert.equal(getArrowLook("ice").element, "ice");
  assert.equal(getArrowLook("silver").head, "point");
  assert.equal(getArrowLook("stun").head, "point");
  assert.equal(getArrowLook("stun").element, "lightning");
  assert.equal(getArrowLook("basic.single.none.wood.broadhead").shape, "sharpened");
  assert.equal(getArrowLook("basic.single.none.wood.bodkin").shape, "sharpened");
  assert.equal(getArrowLook("basic.single.none.iron.broadhead").shape, "broadhead");
  const keys = new Set(Object.keys(ARROW_DEFS).map((t) => {
    const look = getArrowLook(t);
    return `${look.shape}:${look.element}:${look.flight}:${look.material}`;
  }));
  assert.ok(keys.size >= 10, "types should not all share one silhouette");
});

test("quality grade follows arrow level", () => {
  assert.equal(getArrowLook("steel", 1).quality, "basic");
  assert.equal(getArrowLook("steel", 5).quality, "legendary");
});

test("wood tips share one sharpened shaft", () => {
  const mark = 'd="M0,-4.8 L0.82,-1.9 L0.82,17.6 L-0.82,17.6 L-0.82,-1.9 Z"';
  const point = arrowIconSvg("basic.single.none.wood.point");
  const broad = arrowIconSvg("basic.single.none.wood.broadhead");
  const bodkin = arrowIconSvg("basic.single.none.wood.bodkin");
  const iron = arrowIconSvg("basic.single.none.iron.bodkin");
  for (const icon of [point, broad, bodkin]) {
    assert.match(icon, /data-shape="sharpened"/);
    assert.ok(icon.includes(mark));
  }
  assert.match(iron, /data-shape="bodkin"/);
  assert.equal(iron.includes(mark), false);
});

test("icon pieces follow head, material, element, count, and quality", () => {
  const icon = arrowIconSvg("epic.double-spread.lightning.steel.bodkin");
  assert.match(icon, /data-shape="bodkin"/);
  assert.match(icon, /data-material="steel"/);
  assert.match(icon, /data-element="lightning"/);
  assert.match(icon, /data-count="2"/);
  assert.match(icon, /data-quality="epic"/);
  assert.match(icon, /#e8d56a/i);
  assert.match(icon, /#aeb6be/i);
  assert.match(icon, /#6a4a8a/);
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
  assert.equal(sim.nocked.look.shape, "barbed");
  assert.equal(sim.nocked.headColor, getArrowLook("barbed", 2).headColor);
  sim.clearNocked();
  assert.equal(sim.nocked, null);
  assert.equal(sim.quiver.quiverCount, before);
});
