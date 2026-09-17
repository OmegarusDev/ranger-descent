import test from "node:test";
import assert from "node:assert/strict";
import { InputHandler } from "../src/game/InputHandler.js";
import { CONFIG } from "../src/data/config.js";

function fakeCanvas() {
  return {
    addEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 400, height: 700 };
    },
    clientWidth: 400,
    clientHeight: 700,
  };
}

function pointer(id, x, y, extra = {}) {
  return { pointerId: id, pointerType: "mouse", clientX: x, clientY: y, ...extra };
}

test("aborting a full draw swallows the release instead of firing", () => {
  const input = new InputHandler(fakeCanvas());
  let fired = 0;
  let tapped = 0;
  input.onDragEnd = () => { fired += 1; };
  input.onTap = () => { tapped += 1; };

  input._onDown(pointer(7, 200, 500));
  input._onMove(pointer(7, 200, 620));
  assert.equal(input.isDragging, true);
  assert.ok(input.power >= CONFIG.SLINGSHOT_MIN_POWER);

  input.abortDraw();
  assert.equal(input.isDragging, false);
  assert.equal(input.power, 0);

  input.choiceMode = true;
  input._onUp(pointer(7, 200, 620));
  assert.equal(fired, 0);
  assert.equal(tapped, 0);
});

test("a later click on the spoils card still works after the aborted pointer is up", async () => {
  const input = new InputHandler(fakeCanvas());
  let tapped = 0;
  input.onTap = () => { tapped += 1; };

  input._onDown(pointer(3, 200, 500));
  input._onMove(pointer(3, 180, 600));
  input.abortDraw();
  assert.equal(input.takeSwallowedPointer(3), true);
  input._onUp(pointer(3, 180, 600));

  await new Promise((resolve) => queueMicrotask(resolve));

  input.choiceMode = true;
  input._onDown(pointer(3, 40, 400));
  input._onUp(pointer(3, 40, 400));
  assert.equal(tapped, 1);
});
