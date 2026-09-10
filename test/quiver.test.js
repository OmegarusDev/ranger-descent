import test from "node:test";
import assert from "node:assert/strict";
import { QuiverDeckManager } from "../src/game/QuiverDeckManager.js";

test("loads a stored arrow into an open quiver slot", () => {
  const quiver = new QuiverDeckManager();
  quiver.capacity = 2;
  quiver.addToQuiver({ type: "wood", level: 1 });
  quiver.addToStorage({ type: "iron", level: 1 });

  assert.equal(quiver.setQuiverSlot(quiver.quiverCount, 0), true);
  assert.deepEqual(quiver.peekQuiver().map((a) => a.type), ["wood", "iron"]);
  assert.equal(quiver.peekStorage().length, 0);
});

test("wood arrows cannot move into storage", () => {
  const quiver = new QuiverDeckManager();
  quiver.capacity = 1;
  quiver.addToQuiver({ type: "wood", level: 1 });

  assert.equal(quiver.moveArrowToStorage(0), false);
  assert.deepEqual(quiver.peekQuiver().map((a) => a.type), ["wood"]);
  assert.equal(quiver.peekStorage().length, 0);
});

test("replacing wood with a stored arrow does not store the wood shaft", () => {
  const quiver = new QuiverDeckManager();
  quiver.capacity = 1;
  quiver.addToQuiver({ type: "wood", level: 1 });
  quiver.addToStorage({ type: "steel", level: 1 });

  assert.equal(quiver.setQuiverSlot(0, 0), true);
  assert.deepEqual(quiver.peekQuiver().map((a) => a.type), ["steel"]);
  assert.equal(quiver.peekStorage().length, 0);
});

test("normalizes malformed persisted arrows", () => {
  const quiver = new QuiverDeckManager();
  quiver.deserialize({
    capacity: 99,
    deck: [{ type: "moss", level: "bad" }, { type: "iron", level: 99 }],
    storage: [{ type: "moss", level: 2 }, { type: "steel", level: 2 }],
  });

  assert.equal(quiver.capacity, 30);
  assert.deepEqual(quiver.peekQuiver().map((a) => [a.type, a.level]), [["wood", 1], ["iron", 5]]);
  assert.deepEqual(quiver.peekStorage().map((a) => [a.type, a.level]), [["steel", 2]]);
});
