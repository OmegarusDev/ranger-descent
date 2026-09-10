import test from "node:test";
import assert from "node:assert/strict";
import { CorridorSim } from "../src/game/CorridorSim.js";

test("reports absolute floors and repeating floor-local waves", () => {
  const sim = new CorridorSim();
  sim.elevatorIndex = 0;
  sim.floorIndex = 0;
  sim.sectionIndex = 0;
  assert.equal(sim.getFloorNumber(), 1);
  assert.equal(sim.getWaveNumber(), 1);

  sim.elevatorIndex = 9;
  sim.floorIndex = 9;
  sim.sectionIndex = 9;
  assert.equal(sim.getFloorNumber(), 100);
  assert.equal(sim.getWaveNumber(), 10);
});

test("junction selection enters the requested transition without rerolling", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  const choice = { direction: "left", groups: [["slime"]], coinBonus: 1 };
  sim.junctionChoices = [choice];
  sim.junctionPending = true;

  sim.chooseJunction("left");

  assert.equal(sim.junctionPending, false);
  assert.equal(sim.turning, true);
  assert.equal(sim._pendingEncounter, choice);
  assert.equal(sim._pendingTurnDir, "left");
});

test("full wood quivers account for rejected wood loot without stashing it", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.capacity = 1;
  sim.quiver.addToQuiver({ type: "wood", level: 1 });

  const result = sim._collectLootPiece({
    kind: "arrow",
    type: "wood",
    level: 1,
    label: "Wood Arrow",
  });

  assert.equal(result.status, "lost");
  assert.equal(sim.runStash.arrows.length, 0);
  assert.deepEqual(sim.quiver.peekQuiver().map((a) => a.type), ["wood"]);
});

test("elevator checkpoints bank the purse before continuing", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.runCoins = 12;
  sim.elevatorIndex = 0;

  sim._rideElevator();

  assert.equal(sim.elevatorCheckpointPending, true);
  assert.equal(sim.state.coins, 12);
  assert.equal(sim.state.runCoins, 0);
  assert.equal(sim.state.getMaxElevatorUnlocked(), 1);

  assert.equal(sim.continueAtElevator(), true);
  assert.equal(sim.elevatorCheckpointPending, false);
  assert.equal(sim.elevatorIndex, 1);
  assert.equal(sim.waveActive, true);
});
