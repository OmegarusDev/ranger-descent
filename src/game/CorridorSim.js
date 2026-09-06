import { CONFIG } from "../data/config.js";
import { QuiverDeckManager } from "./QuiverDeckManager.js";
import { SubstrateGrid } from "./SubstrateGrid.js";
import { AutoMagicSystem } from "./AutoMagicSystem.js";
import { GameStateManager } from "./GameStateManager.js";

let _nextId = 1;

const ENEMY_DEFS = {
  slime:          { hp: 10,  speed: 35,  size: 1.2, color: "#b84a55", souls: 1, armor: "none", contactDmg: 4 },
  slime_large:    { hp: 30,  speed: 25,  size: 1.8, color: "#c45a65", souls: 2, armor: "none", contactDmg: 6, splitTo: "slime", splitCount: 2 },
  slime_huge:     { hp: 60,  speed: 18,  size: 2.4, color: "#d46a75", souls: 4, armor: "none", contactDmg: 8, splitTo: "slime_large", splitCount: 2 },
  goblin_runt:    { hp: 8,   speed: 55,  size: 0.8, color: "#6aaa5a", souls: 1, armor: "none", contactDmg: 3 },
  goblin_warrior: { hp: 18,  speed: 42,  size: 1.0, color: "#5a9a4a", souls: 2, armor: "none", contactDmg: 5 },
  goblin_chieftain:{ hp: 40, speed: 35,  size: 1.3, color: "#4a8a3a", souls: 4, armor: "none", contactDmg: 7 },
  imp:            { hp: 6,   speed: 70,  size: 0.7, color: "#d4892a", souls: 1, armor: "none", contactDmg: 3 },
  scamp:          { hp: 12,  speed: 60,  size: 0.8, color: "#e0a030", souls: 2, armor: "none", contactDmg: 4 },
  demon:          { hp: 35,  speed: 45,  size: 1.2, color: "#c04040", souls: 4, armor: "none", contactDmg: 7 },
  skeleton:       { hp: 50,  speed: 22,  size: 1.4, color: "#c8c0b0", souls: 3, armor: "none", contactDmg: 7 },
  skeleton_archer:{ hp: 25,  speed: 28,  size: 1.2, color: "#b0a898", souls: 2, armor: "none", contactDmg: 4 },
  hauler:         { hp: 80,  speed: 18,  size: 1.6, color: "#8a96a0", souls: 4, armor: "heavy", contactDmg: 10 },
  ghoul:          { hp: 15,  speed: 40,  size: 0.9, color: "#7a6a5a", souls: 1, armor: "none", contactDmg: 4 },
  wight:          { hp: 30,  speed: 35,  size: 1.1, color: "#6a5a4a", souls: 2, armor: "none", contactDmg: 6 },
  wraith:         { hp: 18,  speed: 55,  size: 0.85,color: "#8a7ab8", souls: 2, armor: "energy", contactDmg: 5 },
  vampire:        { hp: 35,  speed: 45,  size: 1.0, color: "#a02020", souls: 3, armor: "none", contactDmg: 6, lifeSteal: true },
  vampire_lord:   { hp: 60,  speed: 50,  size: 1.3, color: "#801010", souls: 5, armor: "none", contactDmg: 8, lifeSteal: true },
  lich:           { hp: 50,  speed: 30,  size: 1.2, color: "#6040a0", souls: 4, armor: "none", summonRate: 5, contactDmg: 5 },
  bat:            { hp: 6,   speed: 90,  size: 0.4, color: "#4a3a5a", souls: 1, armor: "none", flying: true, contactDmg: 2, poison: 2 },
  spider:         { hp: 8,   speed: 60,  size: 0.6, color: "#5a4a3a", souls: 1, armor: "none", contactDmg: 3, poison: 1 },
  giant_spider:   { hp: 25,  speed: 50,  size: 1.0, color: "#4a3a2a", souls: 2, armor: "none", contactDmg: 5, poison: 3 },
  orc:            { hp: 35,  speed: 40,  size: 1.1, color: "#5a7a4a", souls: 3, armor: "none", contactDmg: 7 },
  ogre:           { hp: 70,  speed: 25,  size: 1.5, color: "#6a8a5a", souls: 5, armor: "heavy", contactDmg: 10 },
  troll:          { hp: 50,  speed: 35,  size: 1.3, color: "#4a6a3a", souls: 4, armor: "none", contactDmg: 8, regen: 2 },
  boss_grunt:     { hp: 200, speed: 18,  size: 2.2, color: "#c4305a", souls: 20, armor: "heavy", contactDmg: 12 },
  boss_warden:    { hp: 250, speed: 12,  size: 2.2, color: "#3d9a8e", souls: 25, armor: "insulated", shieldHp: 60, contactDmg: 10 },
  boss_wraith:    { hp: 180, speed: 28,  size: 2.0, color: "#c9a227", souls: 30, armor: "energy", contactDmg: 15 },
  boss_death_knight: { hp: 250, speed: 22, size: 2.4, color: "#2a2a3a", souls: 30, armor: "heavy", contactDmg: 15 },
  boss_lich_king: { hp: 300, speed: 15, size: 2.2, color: "#4a2a6a", souls: 40, armor: "none", summonRate: 3, contactDmg: 10 },
  boss_spider_queen: { hp: 200, speed: 35, size: 2.0, color: "#3a2a1a", souls: 25, armor: "none", contactDmg: 12, poison: 5 },
};

const BEHAVIOR_MAP = {
  slime: "advance", slime_large: "advance", slime_huge: "advance",
  goblin_runt: "swarm", goblin_warrior: "swarm_slow", goblin_chieftain: "swarm_slow",
  imp: "notice", scamp: "notice", demon: "swarm_slow",
  skeleton: "advance", skeleton_archer: "archer", hauler: "advance",
  ghoul: "advance", wight: "advance", wraith: "zigzag",
  vampire: "notice", vampire_lord: "notice", lich: "summoner",
  bat: "hover", spider: "swarm", giant_spider: "swarm_slow",
  orc: "swarm_slow", ogre: "advance", troll: "swarm_slow",
  boss_grunt: "charge", boss_warden: "shielded", boss_wraith: "zigzag",
  boss_death_knight: "charge", boss_lich_king: "summoner", boss_spider_queen: "swarm_slow",
};

function createEnemy(type, worldX, worldZ) {
  const d = ENEMY_DEFS[type] || ENEMY_DEFS.slime;
  return {
    id: _nextId++, type, x: worldX, worldZ,
    behavior: BEHAVIOR_MAP[type] || "advance",
    hp: d.hp, maxHp: d.hp, speed: d.speed, size: d.size,
    color: d.color, souls: d.souls, armor: d.armor,
    flying: d.flying || false,
    shieldHp: d.shieldHp || 0, maxShieldHp: d.shieldHp || 0,
    shieldRegen: d.shieldHp ? 2 : 0,
    burnT: 0, poisonT: 0, slowT: 0, shredT: 0,
    _lateralTarget: 0, _lateralTimer: 0,
    _lurkT: 0,
    _chargeTimer: 2, _charging: false,
    _weaveDir: Math.random() > 0.5 ? 1 : -1,
    _zigzagPhase: Math.random() * Math.PI * 2,
    _summonTimer: 0, _summonRate: d.summonRate || 0,
    _splitDone: false,
    _hitFlash: 0,
  };
}

function createProjectile(worldX, worldZ, vx, vz, damage, element, ownerId) {
  return {
    id: _nextId++, x: worldX, worldZ, vx, vz,
    damage, element: element || "normal", ownerId,
    life: 4,
    _trail: [],
  };
}

const CONTACT_DIST = 30;
const HALF_CORRIDOR = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;
const SEGMENT_LENGTH = 800;

export class CorridorSim {
  constructor() {
    this.state = new GameStateManager();
    this.quiver = new QuiverDeckManager();
    this.substrates = new SubstrateGrid();
    this.autoMagic = new AutoMagicSystem();
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.waveIndex = 0;
    this.waveActive = false;
    this.runTime = 0;
    this.running = false;
    this._listeners = new Map();

    this.playerWorldX = 0;
    this.playerWorldZ = 0;
    this.segmentIndex = 0;
    this.segmentStartZ = 0;
    this.segmentEndZ = SEGMENT_LENGTH;
    this.movingForward = true;
    this.junctionChoices = null;
    this.junctionPending = false;
    this.turnAngle = 0;
    this.turnTarget = 0;
    this.turning = false;
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  emit(type, data = {}) {
    const e = { kind: type, tick: this.tickIndex || 0, ...data };
    for (const fn of (this._listeners.get(type) || [])) fn(e);
    for (const fn of (this._listeners.get("*") || [])) fn(e);
  }

  initRun() {
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.waveIndex = 0;
    this.runTime = 0;
    this.playerWorldX = 0;
    this.playerWorldZ = 0;
    this.segmentIndex = 0;
    this.segmentStartZ = 0;
    this.segmentEndZ = SEGMENT_LENGTH;
    this.movingForward = true;
    this.junctionChoices = null;
    this.junctionPending = false;
    this.turnAngle = 0;
    this.turnTarget = 0;
    this.turning = false;
    this.quiver.initStarter();
    this.substrates.init();
    this.autoMagic.reset();
    this.autoMagic.unlockAll();
    this.state.startRun();
    this.state.applyUpgrades();
    this.running = true;
    this._startWave();
    this.emit("run_start");
  }

  tick() {
    if (!this.running) return;
    this.tickIndex = (this.tickIndex || 0) + 1;
    this.runTime += this.dt;
    this.dt = 1 / 60;

    if (this.turning) {
      const prev = this.turnAngle;
      this.turnAngle += (this.turnTarget - this.turnAngle) * 0.15;
      if (Math.abs(this.turnAngle - this.turnTarget) < 0.5) {
        this.turnAngle = this.turnTarget;
        this.turning = false;
        this.turnComplete();
      }
    }

    if (this.movingForward && !this.junctionPending && !this.turning) {
      this.playerWorldZ += CONFIG.PLAYER_SPEED;
      this.state.playerZ = this.playerWorldZ;
      this.state.runDistance = this.playerWorldZ;
    }

    this._tickSpawning();
    this._tickEnemies();
    this._tickProjectiles();
    this._tickEnemyProjectiles();
    this._tickAutoMagic();
    this.substrates.tickReactions();
    const shuffleEvt = this.quiver.tick(this.dt);
    if (shuffleEvt) this.emit("quiver_shuffle");

    if (this.state.arrowCooldown > 0) {
      this.state.arrowCooldown = Math.max(0, this.state.arrowCooldown - this.dt);
    }

    if (this.movingForward && !this.junctionPending && this.playerWorldZ >= this.segmentEndZ - 100) {
      this._showJunction();
    }
  }

  // ─── Segment / Junction ──────────────────────────────────

  _showJunction() {
    this.junctionPending = true;
    this.movingForward = false;
    const choices = ["forward"];
    const r1 = Math.random();
    if (r1 > 0.25) choices.push("left");
    const r2 = Math.random();
    if (r2 > 0.25) choices.push("right");
    if (choices.length === 1) choices.push(Math.random() > 0.5 ? "left" : "right");

    this.junctionChoices = choices.map(dir => {
      const types = this._pickJunctionEnemies();
      return { direction: dir, enemyTypes: types };
    });
    this.emit("junction_show", { choices: this.junctionChoices });
  }

  _pickJunctionEnemies() {
    const w = this.waveIndex;
    const pool = ["slime", "goblin_runt"];
    if (w >= 2) pool.push("imp");
    if (w >= 3) pool.push("slime_large", "goblin_warrior");
    if (w >= 4) pool.push("skeleton", "skeleton_archer");
    if (w >= 5) pool.push("flyer", "warden");
    const count = 2 + Math.floor(Math.random() * 3);
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return [...new Set(result)];
  }

  chooseJunction(direction) {
    const choice = this.junctionChoices.find(c => c.direction === direction);
    if (!choice) return;
    this.junctionPending = false;
    this._pendingEnemyTypes = choice.enemyTypes;
    let angle = 0;
    if (direction === "left") angle = -90;
    else if (direction === "right") angle = 90;
    if (angle !== 0) {
      this.turnTarget = this.turnAngle + angle;
      this.turning = true;
    } else {
      this._advanceSegment();
    }
  }

  turnComplete() {
    this._advanceSegment();
  }

  _advanceSegment() {
    this.segmentIndex++;
    this.segmentStartZ = this.playerWorldZ;
    this.segmentEndZ = this.playerWorldZ + SEGMENT_LENGTH;
    this.movingForward = true;
    this._startWave();
  }

  // ─── Spawning ────────────────────────────────────────────

  _startWave() {
    this.waveIndex++;
    const enemyTypes = this._pendingEnemyTypes || this._generateWaveEnemies();
    this._pendingEnemyTypes = null;
    this.waveActive = true;
    this.waveQueue = [];

    const startZ = this.playerWorldZ + 200;
    const endZ = this.segmentEndZ - 50;
    for (let i = 0; i < enemyTypes.length; i++) {
      const t = enemyTypes[i];
      const frac = i / Math.max(1, enemyTypes.length - 1);
      const ez = startZ + (endZ - startZ) * frac;
      const ex = (Math.random() - 0.5) * HALF_CORRIDOR * 1.2;
      this.waveQueue.push({ type: t, worldX: ex, worldZ: ez });
    }
    this.spawnTimer = 0.3;
    this.emit("wave_start", { wave: this.waveIndex });
  }

  _generateWaveEnemies() {
    const n = Math.floor(2 + this.waveIndex * 1.5);
    const w = this.waveIndex;
    const list = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if      (r < 0.30)                     list.push("slime");
      else if (r < 0.50)                     list.push("goblin_runt");
      else if (r < 0.60 && w >= 2)           list.push("imp");
      else if (r < 0.65 && w >= 2)           list.push("bat");
      else if (r < 0.70 && w >= 3)           list.push("slime_large");
      else if (r < 0.75 && w >= 3)           list.push("goblin_warrior");
      else if (r < 0.78 && w >= 3)           list.push("ghoul");
      else if (r < 0.81 && w >= 4)           list.push("skeleton");
      else if (r < 0.84 && w >= 4)           list.push("skeleton_archer");
      else if (r < 0.86 && w >= 4)           list.push("spider");
      else if (r < 0.88 && w >= 5)           list.push("wight");
      else if (r < 0.90 && w >= 5)           list.push("scamp");
      else if (r < 0.92 && w >= 5)           list.push("orc");
      else if (r < 0.94 && w >= 6)           list.push("slime_huge");
      else if (r < 0.95 && w >= 6)           list.push("giant_spider");
      else if (r < 0.96 && w >= 6)           list.push("troll");
      else if (r < 0.97 && w >= 7)           list.push("goblin_chieftain");
      else if (r < 0.98 && w >= 7)           list.push("wraith");
      else if (r < 0.99 && w >= 7)           list.push("vampire");
      else if (r < 0.995 && w >= 8)          list.push("hauler");
      else if (r < 0.998 && w >= 8)          list.push("demon");
      else if (r < 1.00 && w >= 9)           list.push("lich");
      else                                   list.push("slime");
    }
    if (this.waveIndex % 5 === 0) {
      const br = Math.random();
      if (br < 0.25) list.push("boss_grunt");
      else if (br < 0.45) list.push("boss_warden");
      else if (br < 0.65) list.push("boss_wraith");
      else if (br < 0.80) list.push("boss_death_knight");
      else if (br < 0.90) list.push("boss_spider_queen");
      else list.push("boss_lich_king");
    }
    return list;
  }

  _tickSpawning() {
    if (!this.waveActive) return;
    if (this.waveQueue.length > 0) {
      this.spawnTimer -= this.dt;
      if (this.spawnTimer <= 0) {
        const next = this.waveQueue.shift();
        const enemy = createEnemy(next.type, next.worldX, next.worldZ);
        this.enemies.push(enemy);
        this.emit("enemy_spawn", { enemy });
        this.spawnTimer = 0.4;
      }
    }
    if (this.waveQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this._recoverArrows();
      this.emit("wave_end", { wave: this.waveIndex });
    }
  }

  _recoverArrows() {
    const lootChance = this.state.getLootChance();
    const arrowsUsed = this.state.arrowsFired;
    for (let i = 0; i < arrowsUsed; i++) {
      if (Math.random() < lootChance) {
        this.quiver.addToStorage({ type: "normal", level: 1 });
      }
    }
  }

  // ─── Enemies ─────────────────────────────────────────────

  _tickEnemies() {
    const dt = this.dt;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const relDist = e.worldZ - this.playerWorldZ;
      e.dist = relDist;
      const spd = e.speed * dt * (e.slowT > 0 ? 0.4 : 1);

      switch (e.behavior) {
        case "advance":
          e._lurkT = (e._lurkT || 0) + dt;
          if (e._lurkT < 0.6) {
            e.worldZ -= spd * 0.15;
          } else if (e._lurkT < 0.9) {
            e.worldZ -= spd * 3.5;
          } else {
            e._lurkT = 0;
          }
          {
            const drift = Math.min(Math.abs(e.x), spd * 0.3);
            e.x -= Math.sign(e.x) * drift;
          }
          break;
        case "swarm": {
          e._swarmTimer = (e._swarmTimer || 0) + dt;
          e._swarmDodgeSeq = e._swarmDodgeSeq || [-1, 1, 1, -1];
          e._swarmDodgeIdx = e._swarmDodgeIdx || 0;
          const walkDur = 1.6;
          const dodgeDur = 0.2;
          const cycleT = e._swarmTimer % (walkDur + dodgeDur);
          if (cycleT < walkDur) {
            e.worldZ -= spd * 1.0;
          } else {
            e.worldZ -= spd * 0.4;
            const dir = e._swarmDodgeSeq[e._swarmDodgeIdx % 4];
            e.x += dir * spd * 2.5;
          }
          if (e._swarmTimer >= walkDur + dodgeDur) {
            e._swarmTimer = 0;
            e._swarmDodgeIdx++;
          }
          break;
        }
        case "swarm_slow": {
          e._swarmTimer = (e._swarmTimer || 0) + dt;
          e._swarmDodgeSeq = e._swarmDodgeSeq || [-1, 1, 1, -1];
          e._swarmDodgeIdx = e._swarmDodgeIdx || 0;
          const walkDurS = 2.0;
          const dodgeDurS = 0.25;
          const cycleTS = e._swarmTimer % (walkDurS + dodgeDurS);
          if (cycleTS < walkDurS) {
            e.worldZ -= spd * 0.8;
          } else {
            e.worldZ -= spd * 0.3;
            const dirS = e._swarmDodgeSeq[e._swarmDodgeIdx % 4];
            e.x += dirS * spd * 1.8;
          }
          if (e._swarmTimer >= walkDurS + dodgeDurS) {
            e._swarmTimer = 0;
            e._swarmDodgeIdx++;
          }
          break;
        }
        case "notice":
          if (!e._noticePhase) {
            e._noticePhase = "walk";
            e._noticeTimer = 0;
            e._noticeStartZ = e.worldZ;
            e._shootCooldown = 0;
          }
          e._noticeTimer += dt;
          if (e._noticePhase === "walk") {
            e.worldZ -= spd * 0.3;
            if (e._noticeStartZ - e.worldZ > 150) {
              e._noticePhase = "alert";
              e._noticeTimer = 0;
            }
          } else if (e._noticePhase === "alert") {
            e.worldZ -= spd * 1.2;
            const dxN = this.playerWorldX - e.x;
            e.x += Math.sign(dxN) * Math.min(Math.abs(dxN), spd * 1.5);
            if (relDist < 150) {
              e._noticePhase = "shoot";
              e._noticeTimer = 0;
            }
          } else if (e._noticePhase === "shoot") {
            e._shootCooldown -= dt;
            if (e._shootCooldown <= 0) {
              this._spawnEnemyProjectile(e.x, e.worldZ, 3, 180);
              e._shootCooldown = 1.8;
            }
            e.worldZ -= spd * 0.15;
          }
          break;
        case "archer":
          if (!e._archerPhase) {
            e._archerPhase = "walk";
            e._archerTimer = 0;
            e._shootCooldown = 0;
          }
          e._archerTimer += dt;
          if (e._archerPhase === "walk") {
            e.worldZ -= spd * 0.4;
            if (relDist < 300) {
              e._archerPhase = "shoot";
              e._archerTimer = 0;
            }
          } else if (e._archerPhase === "shoot") {
            e._shootCooldown -= dt;
            if (e._shootCooldown <= 0) {
              this._spawnEnemyProjectile(e.x, e.worldZ, 5, 160);
              e._shootCooldown = 2.2;
            }
            e.worldZ -= spd * 0.1;
            e._lateralTimer -= dt;
            if (e._lateralTimer <= 0) {
              e._weaveDir *= -1;
              e._lateralTimer = 1.0 + Math.random() * 0.5;
            }
            e.x += e._weaveDir * spd * 0.6;
          }
          break;
        case "hover": {
          const ideal = this.playerWorldZ + 250;
          if (e.worldZ > ideal + 50) e.worldZ -= spd * 0.3;
          else if (e.worldZ < ideal - 50) e.worldZ += spd * 0.3;
          e._lateralTimer -= dt;
          if (e._lateralTimer <= 0) {
            e._lateralTarget = this.playerWorldX + (Math.random() - 0.5) * HALF_CORRIDOR * 1.5;
            e._lateralTimer = 1.5 + Math.random();
          }
          const dx = e._lateralTarget - e.x;
          e.x += Math.sign(dx) * Math.min(Math.abs(dx), spd * 0.8);
          break;
        }
        case "shielded":
          e.worldZ -= spd * 0.8;
          if (e.shieldHp < e.maxShieldHp)
            e.shieldHp = Math.min(e.maxShieldHp, e.shieldHp + e.shieldRegen * dt);
          {
            const driftShield = Math.min(Math.abs(e.x), spd * 0.15);
            e.x -= Math.sign(e.x) * driftShield;
          }
          break;
        case "zigzag":
          e.worldZ -= spd * 0.8;
          e._zigzagPhase += dt * 5;
          e.x += Math.sin(e._zigzagPhase) * spd * 1.5;
          {
            const driftZig = Math.min(Math.abs(e.x), spd * 0.2);
            e.x -= Math.sign(e.x) * driftZig;
          }
          break;
        case "weave":
          e.worldZ -= spd * 0.7;
          e._lateralTimer -= dt;
          if (e._lateralTimer <= 0) { e._weaveDir *= -1; e._lateralTimer = 0.7 + Math.random() * 0.5; }
          e.x += e._weaveDir * spd;
          break;
        case "charge":
          e._chargeTimer -= dt;
          if (e._chargeTimer <= 0) { e._charging = !e._charging; e._chargeTimer = e._charging ? 0.5 : 2.5; }
          e.worldZ -= spd * (e._charging ? 3.0 : 0.2);
          break;
        case "summoner":
          e.worldZ -= spd * 0.4;
          e._summonTimer -= dt;
          if (e._summonTimer <= 0 && this.enemies.length < 30) {
            e._summonTimer = e._summonRate;
            const summonType = this.waveIndex < 5 ? "slime" : this.waveIndex < 10 ? "ghoul" : "wight";
            const child = createEnemy(summonType, e.x + (Math.random() - 0.5) * 30, e.worldZ + 40);
            child._splitDone = true;
            this.enemies.push(child);
          }
          break;
        case "splits":
          e.worldZ -= spd;
          break;
      }

      e.x = Math.max(-HALF_CORRIDOR, Math.min(HALF_CORRIDOR, e.x));

      if (e.burnT > 0) { e.burnT -= dt; e.hp -= 4 * dt; }
      if (e.poisonT > 0) { e.poisonT -= dt; e.hp -= 2.5 * dt; }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.shredT > 0) e.shredT -= dt;
      if (e._hitFlash > 0) e._hitFlash = Math.max(0, e._hitFlash - 0.05);

      const def = ENEMY_DEFS[e.type];
      if (def?.regen && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + def.regen * dt);
      }
      if (def?.lifeSteal && relDist < CONTACT_DIST && relDist > -20) {
        e.hp = Math.min(e.maxHp, e.hp + 2 * dt);
      }

      if (!e.flying && relDist < CONTACT_DIST && relDist > -20) {
        const dmg = (e.behavior === "charge" && e._charging) ? (def?.contactDmg || 4) * 3 : (def?.contactDmg || 4);
        this.state.damagePlayer(dmg);
        this.emit("player_hit", { damage: dmg, enemy: e });
        this.enemies.splice(i, 1);
        continue;
      }

      if (relDist < -100) { this.enemies.splice(i, 1); continue; }

      if (e.hp <= 0) {
        this.state.enemiesKilled++;
        this.emit("enemy_death", { enemy: e, x: e.x, dist: relDist });
        const def = ENEMY_DEFS[e.type];
        if (def.splitTo && !e._splitDone) {
          for (let s = 0; s < (def.splitCount || 2); s++) {
            const child = createEnemy(def.splitTo, e.x + (s ? 15 : -15), e.worldZ + 10);
            child._splitDone = true;
            this.enemies.push(child);
          }
        }
        this.enemies.splice(i, 1);
      }
    }
  }

  // ─── Projectiles ─────────────────────────────────────────

  _tickProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * this.dt;
      p.worldZ += p.vz * this.dt;
      p.life -= this.dt;
      p._trail.push({ x: p.x, worldZ: p.worldZ });
      if (p._trail.length > 8) p._trail.shift();

      const relDist = p.worldZ - this.playerWorldZ;
      if (p.life <= 0 || relDist > 800) {
        this.projectiles.splice(i, 1); continue;
      }

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dx = p.x - e.x;
        const ddist = relDist - e.dist;
        const hitR = (e.size * CONFIG.CELL_SIZE) * 0.5;
        if (dx * dx + ddist * ddist < hitR * hitR) {
          let dmg = this._calcDamage(p, e);
          e.hp -= dmg;
          e._hitFlash = 1;
          this.emit("projectile_hit", { projectile: p, enemy: e, x: p.x, dist: relDist, damage: dmg });
          this._applyStatus(p, e);
          this.substrates.onArrowImpact(
            Math.floor(p.x / CONFIG.CELL_SIZE),
            Math.floor(relDist / CONFIG.CELL_SIZE),
            p.element
          );
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  _calcDamage(proj, enemy) {
    let d = proj.damage;
    const el = proj.element;
    if (enemy.armor === "heavy" && (el === "normal" || el === "piercing" || el === "kinetic")) d *= 0.5;
    if (enemy.armor === "insulated" && (el === "fire" || el === "shock")) d *= 0.5;
    if (enemy.armor === "energy") { d *= 0.7; if (proj.ownerId === "player") this.state.damagePlayer(Math.floor(proj.damage * 0.3)); }
    if (enemy.shredT > 0) d = proj.damage;
    return Math.max(1, Math.floor(d));
  }

  _applyStatus(proj, e) {
    const el = proj.element;
    if (el === "fire") e.burnT = Math.max(e.burnT, 3);
    else if (el === "poison") e.poisonT = Math.max(e.poisonT, 4);
    else if (el === "ice") e.slowT = Math.max(e.slowT, 2);
    else if (el === "acid") e.shredT = Math.max(e.shredT, 3);
  }

  _spawnEnemyProjectile(worldX, worldZ, damage, speed) {
    const dx = this.playerWorldX - worldX;
    const dz = this.playerWorldZ - worldZ;
    const len = Math.hypot(dx, dz) || 1;
    this.enemyProjectiles.push({
      id: _nextId++, x: worldX, worldZ,
      vx: (dx / len) * speed,
      vz: (dz / len) * speed,
      damage, life: 4,
    });
  }

  _tickEnemyProjectiles() {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.x += p.vx * this.dt;
      p.worldZ += p.vz * this.dt;
      p.life -= this.dt;

      const relDist = p.worldZ - this.playerWorldZ;
      if (p.life <= 0 || relDist < -100 || relDist > 800) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (relDist < CONTACT_DIST && relDist > -20 && Math.abs(p.x - this.playerWorldX) < 30) {
        this.state.damagePlayer(p.damage);
        this.emit("player_hit", { damage: p.damage, enemy: null });
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  // ─── Auto-Magic ──────────────────────────────────────────

  _tickAutoMagic() {
    const actions = this.autoMagic.tick(this.dt);
    if (!actions.length) return;
    const pos = { x: this.playerWorldX, y: this.playerWorldZ };
    const targeted = this.autoMagic.acquireTargets(actions, this.enemies, pos);
    for (const a of targeted) {
      if (a.type === "hex" && a.target) {
        const dx = a.target.x - pos.x;
        const dy = a.target.worldZ - pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const spd = 200;
        this.projectiles.push(createProjectile(
          pos.x, pos.y, (dx / dist) * spd, (dy / dist) * spd,
          a.def.damage, a.def.element, "hex"
        ));
        this.emit("hex_fire", { def: a.def, target: a.target });
      } else if (a.type === "prayer") {
        this._applyPrayer(a.def);
        this.emit("prayer_cast", { def: a.def });
      }
    }
  }

  _applyPrayer(def) {
    switch (def.effect) {
      case "shield":          this.state.activateShield(30); break;
      case "soul_multiplier": this.state.activateSoulMultiplier(2, def.duration); break;
      case "damage_boost":    this.state.activateDamageBoost(1.5, def.duration); break;
      case "instant_burst":   this.state.activateInstantBurst(3); break;
    }
  }

  // ─── Arrow Firing ────────────────────────────────────────

  fireArrow(trajectory) {
    if (!trajectory) return null;
    if (this.state.arrowCooldown > 0) return null;
    const arrow = this.quiver.fireArrow();
    if (!arrow) return null;
    this.state.arrowsFired++;
    this.state.arrowCooldown = this.state.getArrowCooldown();

    const spd = trajectory.speed;
    const vx = trajectory.vector.x * spd * 0.4;
    const vz = -trajectory.vector.y * spd * 0.8;

    const proj = createProjectile(
      this.playerWorldX, this.playerWorldZ,
      vx, vz,
      1 + arrow.level, arrow.type, "player"
    );
    this.projectiles.push(proj);
    this.emit("arrow_fire", { arrow, projectile: proj });

    if (this.state.consumeBurst()) {
      setTimeout(() => {
        const b = this.quiver.fireArrow();
        if (b) {
          this.projectiles.push(createProjectile(
            this.playerWorldX, this.playerWorldZ, vx * 1.1, vz * 1.1,
            1 + b.level, b.type, "player"
          ));
        }
      }, 80);
    }
    return arrow;
  }

  // ─── Depth Sort ──────────────────────────────────────────

  getAllEntities() {
    const px = this.playerWorldX;
    const pz = this.playerWorldZ;
    const list = [
      { depth: 0, type: "player", x: px, dist: 0 },
    ];
    for (const e of this.enemies) {
      const d = e.worldZ - pz;
      e.dist = d;
      list.push({ depth: d, type: "enemy", entity: e });
    }
    for (const p of this.projectiles) {
      list.push({ depth: p.worldZ - pz, type: "projectile", entity: p });
    }
    for (const p of this.enemyProjectiles) {
      list.push({ depth: p.worldZ - pz, type: "enemy_projectile", entity: p });
    }
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }

  pause() { this.running = false; }
  resume() { this.running = true; }
  destroy() { this.running = false; this.enemies = []; this.projectiles = []; this.enemyProjectiles = []; }
}
