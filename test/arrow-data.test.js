import test from "node:test";
import assert from "node:assert/strict";
import { ARROW_DEFS, getArrowStats, toShopArrow } from "../src/game/QuiverDeckManager.js";

test("arrow summaries include every implemented effect family", () => {
  assert.match(getArrowStats("stun"), /stun/);
  assert.match(getArrowStats("oil"), /oil coat/);
  assert.match(getArrowStats("silver"), /undead/);
  assert.match(getArrowStats("barbed"), /bleed/);
  assert.match(getArrowStats("shock"), /vs energy/);
  assert.match(getArrowStats("double"), /wood follow-up/);
});

test("shop arrows use the canonical effect summary", () => {
  const arrow = toShopArrow(ARROW_DEFS.fire, 2);
  assert.match(arrow.stats, /fire/);
  assert.match(arrow.stats, /burn/);
  assert.match(arrow.stats, /Lv2/);
});
