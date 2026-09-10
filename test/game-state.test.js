import test from "node:test";
import assert from "node:assert/strict";
import { GameStateManager } from "../src/game/GameStateManager.js";

test("normalizes malformed save progression and pouch data", () => {
  const state = new GameStateManager();
  state.deserialize({
    coins: "17",
    totalCoinsEarned: "bad",
    maxElevatorUnlocked: 99,
    selectedStartElevator: 99,
    notebookElevators: [2, 2, -1, 99, 4.8],
    pouch: ["potion_salve", 42, "potion_tonic"],
    pouchCapacity: 99,
  });

  assert.equal(state.coins, 17);
  assert.equal(state.totalCoinsEarned, 0);
  assert.equal(state.getMaxElevatorUnlocked(), 9);
  assert.equal(state.getStartElevator(), 9);
  assert.deepEqual(state.notebookElevators, [2, 4]);
  assert.deepEqual(state.pouch, ["potion_salve", null]);
  assert.equal(state.pouchCapacity, 2);
  assert.equal(state.serialize().schemaVersion, 2);
});

test("terminal phases cannot receive new damage or kill coins", () => {
  const state = new GameStateManager();
  state.startRun();
  state.die();
  const hp = state.playerHp;

  assert.equal(state.awardKillCoins(20), 0);
  assert.equal(state.damagePlayer(20), hp);
  assert.equal(state.runCoins, 0);
});
