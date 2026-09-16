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

test("junction selection hidden-loads the next hall before the turn starts", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  const choice = { direction: "left", groups: [["slime"]], coinBonus: 1 };
  sim.junctionChoices = [choice];
  sim.junctionPending = true;

  sim.chooseJunction("left");

  assert.equal(sim.junctionPending, false);
  assert.equal(sim.turning, true);
  assert.equal(sim._pendingTurnDir, "left");
  assert.equal(sim.waveActive, true);
  assert.ok(sim.enemies.length > 0, "first pack should exist before the camera turns");
  assert.equal(sim.movingForward, false);
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

test("a tap on a close centered enemy stabs with the dagger", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.equipped.dagger = "dagger_iron";
  sim.movingForward = false;
  sim.enemies.push({
    id: 1,
    type: "slime",
    x: 0,
    worldZ: sim.playerWorldZ + 22,
    hp: 8,
    maxHp: 8,
    shieldHp: 0,
    size: 1,
  });

  const hit = sim.tryDaggerAt(200, 400, () => true);

  assert.equal(hit, true);
  assert.ok(sim.enemies[0].hp < 8);
  assert.ok((sim.state.daggerCooldown || 0) > 0);
});

test("a tap that misses the foe does not stab", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.equipped.dagger = "dagger_iron";
  sim.enemies.push({
    id: 2,
    type: "slime",
    x: 0,
    worldZ: sim.playerWorldZ + 70,
    hp: 8,
    maxHp: 8,
    shieldHp: 0,
    size: 1,
  });

  const hit = sim.tryDaggerAt(200, 400, () => false);

  assert.equal(hit, false);
  assert.equal(sim.enemies[0].hp, 8);
});

test("an in-your-face tap stabs even if the sprite hit-test misses", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.equipped.dagger = "dagger_iron";
  sim.enemies.push({
    id: 3,
    type: "slime",
    x: 0,
    worldZ: sim.playerWorldZ + 24,
    hp: 8,
    maxHp: 8,
    shieldHp: 0,
    size: 1,
  });

  const hit = sim.tryDaggerAt(200, 400, () => false);

  assert.equal(hit, true);
  assert.ok(sim.enemies[0].hp < 8);
});

test("side aim sends the arrow along the same yaw as the bow", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.addToQuiver({ type: "wood", level: 1 });
  const yaw = 0.9;
  sim.fireArrow({
    angle: yaw,
    vector: { x: Math.sin(yaw), y: -Math.cos(yaw) },
    speed: 400,
  });
  const p = sim.projectiles[0];
  assert.ok(p);
  assert.ok(Math.abs(p.vx / p.vz - Math.tan(yaw)) < 0.02);
  assert.ok(p.vz > 0);
});

test("aim yaw is clamped so shots cannot wrap behind the ranger", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.addToQuiver({ type: "wood", level: 1 });
  sim.fireArrow({ angle: 2.4, vector: { x: 1, y: 0 }, speed: 400 });
  const p = sim.projectiles[0];
  assert.ok(p);
  const fired = Math.atan2(p.vx, p.vz);
  assert.ok(fired > 1.2);
  assert.ok(fired <= 1.28001);
});

test("spawn lanes spread across most of the hall", () => {
  const sim = new CorridorSim();
  const lanes = sim._pickSpawnLanes(3);
  const span = Math.max(...lanes) - Math.min(...lanes);
  assert.ok(span > 80);
});

test("firing during arrow cooldown emits not-ready feedback", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.quiver.addToQuiver({ type: "wood", level: 1 });
  let blocked = 0;
  sim.on("arrow_not_ready", () => { blocked++; });
  sim.state.arrowCooldown = 0.4;
  const shot = sim.fireArrow({ vector: { x: 0, y: -1 }, speed: 400 });
  assert.equal(shot, null);
  assert.equal(blocked, 1);
  assert.equal(sim.quiver.peekQuiver().length >= 1, true);
});

test("clearing a wave starts the walk to the fork without a loot pause", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.waveActive = false;
  sim.waveQueue = [];
  sim.enemies = [];
  sim._beginWaveLootSequence("junction");
  assert.equal(sim.lootPending, false);
  assert.ok(sim._approachingJunction || sim.junctionPending);
  assert.ok(sim.pendingWaveReport);
});

test("combat hold keeps the map camera on the ranger", () => {
  const sim = new CorridorSim();
  sim.initRun();
  sim.waveActive = true;
  sim.waveQueue = ["hold"];
  sim.enemies = [{
    id: 99, type: "slime", x: 0, worldZ: 900, hp: 99, maxHp: 99,
    speed: 0, size: 1, behavior: "advance",
    slowT: 0, _hitStun: 0, _squash: 0, _contactCd: 0,
  }];
  const hold = sim.segmentEndZ - 280;
  let n = 0;
  while (sim.playerWorldZ < hold - 0.01 && n++ < 20000) sim.tick();
  for (let i = 0; i < 90; i++) sim.tick();
  assert.ok(Math.abs(sim.playerWorldZ - hold) < 1e-9);
  assert.ok(Math.abs(sim.mapZ - sim.playerWorldZ) < 1e-9);
  assert.equal(sim.mapX, 0);
});

test("post-clear approach never slams past a short stride", () => {
  const sim = new CorridorSim();
  sim.initRun();
  sim.enemies = [];
  sim.waveQueue = [];
  sim.waveActive = false;
  sim._beginApproachToJunction();
  let maxStep = 0;
  for (let i = 0; i < 2500 && (sim._approachingJunction || sim.playerWorldZ < sim.segmentEndZ - 120); i++) {
    const z = sim.playerWorldZ;
    sim.tick();
    maxStep = Math.max(maxStep, sim.playerWorldZ - z);
  }
  assert.ok(maxStep > 0);
  assert.ok(maxStep <= 0.2 * 2.4 + 1e-6);
});

test("spoils are offered while walking to the fork", () => {
  const sim = new CorridorSim();
  sim.initRun();
  let shown = 0;
  sim.on("junction_show", () => { shown += 1; });
  sim._beginApproachToJunction();
  assert.equal(shown, 1);
  assert.equal(sim.junctionPending, true);
  assert.equal(sim._approachingJunction, true);
  assert.equal(sim.isWalkingView(), true);
});

test("choosing a path during the approach waits until the fork", () => {
  const sim = new CorridorSim();
  sim.initRun();
  sim._beginApproachToJunction();
  const dir = sim.junctionChoices[0].direction;
  const z = sim.playerWorldZ;
  sim.chooseJunction(dir);
  assert.equal(sim.junctionPending, false);
  assert.equal(sim._queuedJunctionDir, dir);
  assert.equal(sim.turning, false);
  assert.equal(sim._approachingJunction, true);
  sim.tick();
  assert.ok(sim.playerWorldZ > z);
});

test("snapping to the fork keeps the map with world Z", () => {
  const sim = new CorridorSim();
  sim.initRun();
  const stopAt = sim.segmentEndZ - 120;
  sim.playerWorldZ = stopAt - 0.4;
  sim.mapZ = sim.playerWorldZ;
  sim.mapX = 0;
  sim._beginApproachToJunction();
  assert.equal(sim.playerWorldZ, stopAt);
  assert.equal(sim.mapZ, stopAt);
  assert.equal(sim.junctionPending, true);
});

test("paused elevator ticks do not interpolate the last stride", () => {
  const sim = new CorridorSim();
  sim.initRun();
  sim.tick();
  sim.elevatorCheckpointPending = true;
  const z = sim.playerWorldZ;
  const mapZ = sim.mapZ;
  sim.tick();
  const cam = sim.renderCam(0.5);
  assert.equal(cam.playerWorldZ, z);
  assert.equal(cam.mapZ, mapZ);
});

test("combat hold stops walk-bob once the ranger is parked", () => {
  const sim = new CorridorSim();
  sim.initRun();
  sim.waveActive = true;
  sim.waveQueue = ["hold"];
  sim.enemies = [{
    id: 99, type: "slime", x: 0, worldZ: 900, hp: 99, maxHp: 99,
    speed: 0, size: 1, behavior: "advance",
    slowT: 0, _hitStun: 0, _squash: 0, _contactCd: 0,
  }];
  assert.equal(sim.isWalkingView(), true);
  const hold = sim.segmentEndZ - 280;
  let n = 0;
  while (sim.playerWorldZ < hold - 0.01 && n++ < 20000) sim.tick();
  assert.equal(sim.isWalkingView(), false);
});

test("entity depth can follow an interpolated camera Z", () => {
  const sim = new CorridorSim();
  sim.initRun();
  sim.enemies = [{
    id: 1, type: "slime", x: 0, worldZ: sim.playerWorldZ + 40, hp: 5, maxHp: 5,
    speed: 0, size: 1, behavior: "advance",
    slowT: 0, _hitStun: 0, _squash: 0, _contactCd: 0,
  }];
  const mid = sim.playerWorldZ + 4;
  const list = sim.getAllEntities(mid);
  const foe = list.find((e) => e.type === "enemy");
  assert.ok(foe);
  assert.equal(foe.entity.dist, 36);
});

test("turning poses next-hall packs in the chosen mouth", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.junctionChoices = [{ direction: "right", groups: [["slime"]], coinBonus: 0 }];
  sim.junctionPending = true;
  sim.chooseJunction("right");
  const z = sim.playerWorldZ;
  const posed = sim.poseForTurnView({ x: 8, worldZ: z + 200, dist: 200 }, z);
  assert.ok(posed);
  assert.ok(posed.x > 150);
  assert.ok(posed.dist <= 120);
  assert.ok(posed.dist >= 12);
  sim.turnU = 0.9;
  const late = sim.poseForTurnView({ x: 8, worldZ: z + 200, dist: 200 }, z);
  assert.ok(late);
  assert.ok(late.dist > posed.dist);
  assert.ok(Math.abs(late.x - 8) < Math.abs(posed.x - 8));
});
