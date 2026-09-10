import test from "node:test";
import assert from "node:assert/strict";
import { CorridorSim, ENEMY_DEFS } from "../src/game/CorridorSim.js";

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
  assert.equal(result.discarded[0].reason, "no_room");
  assert.equal(sim.runStash.arrows.length, 0);
  assert.deepEqual(sim.quiver.peekQuiver().map((a) => a.type), ["wood"]);
});

test("settling a wave report replaces wood and records the discarded shaft", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.capacity = 1;
  sim.quiver.addToQuiver({ type: "wood", level: 1 });
  const report = {
    kills: [{ drop: { kind: "arrow", type: "iron", level: 1, label: "Iron Arrow" } }],
    ground: null,
  };

  sim._collectWaveReport(report);

  assert.deepEqual(sim.quiver.peekQuiver().map((a) => a.type), ["iron"]);
  assert.deepEqual(report.discarded.map((item) => [item.label, item.reason]), [["Wood Arrow", "replaced"]]);
});

test("acknowledging a settled report does not collect its loot twice", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.capacity = 1;
  sim.quiver.addToQuiver({ type: "wood", level: 1 });
  sim.pendingWaveReport = sim._collectWaveReport({
    kills: [{ drop: { kind: "arrow", type: "iron", level: 1, label: "Iron Arrow" } }],
    ground: null,
  });
  sim.lootPending = true;
  sim._afterLootAction = "junction";

  sim.acknowledgeWaveLoot();

  assert.deepEqual(sim.quiver.peekQuiver().map((a) => a.type), ["iron"]);
});

test("firing the last arrow and trying again emit distinct ammo feedback", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.capacity = 1;
  sim.quiver.addToQuiver({ type: "wood", level: 1 });
  let lastArrow = 0;
  let empty = 0;
  sim.on("last_arrow", () => { lastArrow++; });
  sim.on("quiver_empty", () => { empty++; });

  sim.fireArrow({ vector: { x: 0, y: -1 }, speed: 400 });
  sim.state.arrowCooldown = 0;
  sim.fireArrow({ vector: { x: 0, y: -1 }, speed: 400 });

  assert.equal(lastArrow, 1);
  assert.equal(empty, 1);
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

test("floor guardians are included in junction metadata", () => {
  const sim = new CorridorSim();
  const plan = sim._planEncounter(
    ["slime"],
    5,
    { floorIndex: 9, elevatorIndex: 0, sectionIndex: 9 },
    0,
  );

  assert.equal(plan.enemyTypes.includes("boss_grunt"), true);
  assert.equal(plan.families.length > 0, true);
  assert.equal(plan.threat > 5, true);
});

test("loot reports use awarded rather than base kill coins", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.upgrades.luck = 20;
  const enemy = { type: "ogre", hp: 0, worldZ: 100, x: 0 };
  sim.enemies = [enemy];
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    sim._killEnemy(enemy, 0, ENEMY_DEFS.ogre, 100);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(sim.waveLootLog[0].baseCoins, 5);
  assert.equal(sim.waveLootLog[0].coins, 7);
});
