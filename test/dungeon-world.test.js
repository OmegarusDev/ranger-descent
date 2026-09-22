import test from "node:test";
import assert from "node:assert/strict";
import { DungeonWorld } from "../src/engine/dungeon/world.js";

function straight(over = {}) {
  const ahead = over.ahead ?? 460;
  return {
    segmentIndex: 0,
    heading: 0,
    camX: 0,
    camZ: over.camZ ?? 100,
    along: over.along ?? 100,
    ahead,
    junction: {
      dist: ahead,
      left: true,
      right: true,
      forward: true,
      elevator: false,
    },
    ...over,
    ahead,
  };
}

test("a hall already shows its three-way, with no brick cap ahead", () => {
  const w = new DungeonWorld();
  w.sync(straight());
  assert.equal(w.isOpenAt(0, 200), true);
  assert.equal(w.isOpenAt(-200, 560), true, "left mouth is open from the start");
  assert.equal(w.isOpenAt(200, 560), true, "right mouth is open from the start");
  assert.equal(w.isOpenAt(0, 700), true, "forward continues through the fork");
  assert.equal(w.isOpenAt(0, 560 + 560), true, "the next junction is carved before you enter it");
  assert.equal(w.isOpenAt(-200, 560 + 560), true);
  const before = w.open.size;
  w.sync(straight());
  assert.equal(w.open.size, before);
});

test("the far junction is the same shape on every arm", () => {
  const w = new DungeonWorld();
  w.sync(straight({ camZ: 80, along: 80, ahead: 480 }));
  const forkZ = 560;
  assert.equal(w.isOpenAt(0, forkZ + 560), true);
  assert.equal(w.isOpenAt(-560, forkZ), true);
  assert.equal(w.isOpenAt(560, forkZ), true);
  assert.equal(w.isOpenAt(-560, forkZ + 200), true, "left arm ends in a forward opening");
  assert.equal(w.isOpenAt(560, forkZ - 200), true, "right arm ends in a forward opening");
});

test("a left turn keeps the walked fork and does not punch the next T", () => {
  const w = new DungeonWorld();
  w.sync(straight({ camZ: 200, along: 200, ahead: 360 }));
  assert.equal(w.isOpenAt(0, 200), true);
  w.sync({
    segmentIndex: 1,
    camX: -52,
    camZ: 560,
    heading: -Math.PI / 2,
    ahead: 508,
    along: 52,
    corner: {
      forkX: 0,
      forkZ: 560,
      originX: 0,
      originZ: 440,
      oldHeading: 0,
      chosen: "left",
      left: true,
      right: true,
      forward: true,
    },
  });
  assert.equal(w.isOpenAt(0, 300), true, "the hall you walked is still open");
  assert.equal(w.isOpenAt(-400, 560), true, "the chosen arm is the new hall");
  assert.equal(w.isOpenAt(-560 - 200, 560), true, "that arm already ends in a forward opening");
  assert.equal(w.isOpenAt(-560, 560 + 200), true, "and in a side opening");
  const size = w.open.size;
  w.sync({
    segmentIndex: 1,
    camX: -80,
    camZ: 560,
    heading: -Math.PI / 2,
    ahead: 480,
    along: 80,
    corner: {
      forkX: 0,
      forkZ: 560,
      originX: 0,
      originZ: 440,
      oldHeading: 0,
      chosen: "left",
      left: true,
      right: true,
      forward: true,
    },
  });
  assert.equal(w.open.size, size, "holding the corner does not stamp another T");
});
