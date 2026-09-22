import test from "node:test";
import assert from "node:assert/strict";
import {
  arrowPermutationCount, flightShots, parseArrow,
} from "../src/game/arrowCraft.js";
import { getArrowDamage, isWoodType } from "../src/game/QuiverDeckManager.js";
import { CorridorSim } from "../src/game/CorridorSim.js";

test("the five axes cover every combination", () => {
  const rest = 4 * 5 * 7;
  assert.equal(arrowPermutationCount(), 6 * 7 * rest + 5 * rest);
  const rustyWood = parseArrow("rusty.single.flame.wood.broadhead");
  assert.equal(rustyWood.quality, "basic");
  assert.equal(rustyWood.id, "basic.single.flame.wood.broadhead");
  assert.equal(parseArrow("shoddy.double-burst.none.wood.point").quality, "basic");
  assert.equal(parseArrow("rusty.single.none.iron.point").quality, "rusty");
  const spec = parseArrow("epic.double-spread.lightning.steel.bodkin");
  assert.equal(spec.name, "Epic Double-Spread Lightning Steel Bodkin Arrow");
  assert.equal(flightShots(spec).length, 2);
  assert.equal(getArrowDamage("wood", 1), 1);
  assert.equal(isWoodType("wood"), true);
  assert.equal(isWoodType("basic.single.none.wood.broadhead"), false);
});

test("a spread flight launches every head from one draw", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.queue = [];
  sim.quiver.deck = [];
  sim.quiver.addToQuiver({ type: "basic.triple-spread.none.iron.point", level: 1 });
  sim.playerWorldZ = 0;
  sim.playerWorldX = 0;
  sim.fireArrow({ angle: 0, speed: 400 });
  assert.equal(sim.projectiles.length, 3);
  assert.equal(sim.quiver.quiverCount, 0);
});
