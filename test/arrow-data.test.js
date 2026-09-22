import test from "node:test";
import assert from "node:assert/strict";
import { ARROW_DEFS, getArrowStats, toShopArrow } from "../src/game/QuiverDeckManager.js";

test("arrow summaries follow the crafted axes", () => {
  assert.match(getArrowStats("stun"), /shock/);
  assert.match(getArrowStats("oil"), /fire/);
  assert.match(getArrowStats("oil"), /burn/);
  assert.match(getArrowStats("silver"), /undead/);
  assert.match(getArrowStats("barbed"), /bleed/);
  assert.match(getArrowStats("shock"), /shock/);
  assert.match(getArrowStats("double"), /double-spread/);
});

test("shop arrows use the canonical effect summary", () => {
  const arrow = toShopArrow(ARROW_DEFS.fire, 2);
  assert.match(arrow.name, /Fine/);
  assert.match(arrow.stats, /fire/);
  assert.match(arrow.stats, /burn/);
  assert.match(arrow.stats, /fine/);
  assert.equal(arrow.type, arrow.element);
});
