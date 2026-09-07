import { CONFIG } from "../data/config.js?v=26";
import { QuiverDeckManager, getArrowDef, getArrowDamage } from "./QuiverDeckManager.js?v=30";
import { SubstrateGrid } from "./SubstrateGrid.js";
import { AutoMagicSystem } from "./AutoMagicSystem.js";
import { GameStateManager } from "./GameStateManager.js?v=34";

let _nextId = 1;

const ENEMY_DEFS = {
  slime:          { hp: 5,   speed: 9,   size: 0.85, color: "#b84a55", souls: 1, armor: "none", contactDmg: 4 },
  slime_large:    { hp: 14,  speed: 7,   size: 1.3, color: "#c45a65", souls: 2, armor: "none", contactDmg: 6, splitTo: "slime", splitCount: 2 },
  slime_huge:     { hp: 28,  speed: 5,   size: 1.75, color: "#d46a75", souls: 4, armor: "none", contactDmg: 8, splitTo: "slime_large", splitCount: 2 },
  goblin_runt:    { hp: 7,   speed: 20,  size: 1.2, color: "#6aaa5a", souls: 1, armor: "none", contactDmg: 3 },
  goblin_warrior: { hp: 14,  speed: 16,  size: 1.5, color: "#5a9a4a", souls: 2, armor: "none", contactDmg: 5 },
  goblin_chieftain:{ hp: 22, speed: 13,  size: 2.0, color: "#4a8a3a", souls: 4, armor: "none", contactDmg: 7 },
  imp:            { hp: 8,   speed: 24,  size: 1.1, color: "#d4892a", souls: 1, armor: "none", contactDmg: 3 },
  scamp:          { hp: 12,  speed: 22,  size: 1.2, color: "#e0a030", souls: 2, armor: "none", contactDmg: 4 },
  demon:          { hp: 20,  speed: 16,  size: 1.8, color: "#c04040", souls: 4, armor: "none", contactDmg: 7 },
  skeleton:       { hp: 18,  speed: 11,  size: 2.1, color: "#c8c0b0", souls: 3, armor: "none", contactDmg: 7 },
  skeleton_archer:{ hp: 12,  speed: 12,  size: 1.8, color: "#b0a898", souls: 2, armor: "none", contactDmg: 4 },
  hauler:         { hp: 32,  speed: 8,   size: 2.4, color: "#8a96a0", souls: 4, armor: "heavy", contactDmg: 10 },
  ghoul:          { hp: 10,  speed: 15,  size: 1.4, color: "#7a6a5a", souls: 1, armor: "none", contactDmg: 4 },
  wight:          { hp: 16,  speed: 13,  size: 1.7, color: "#6a5a4a", souls: 2, armor: "none", contactDmg: 6 },
  wraith:         { hp: 12,  speed: 18,  size: 1.3, color: "#8a7ab8", souls: 2, armor: "energy", contactDmg: 5 },
  vampire:        { hp: 18,  speed: 17,  size: 1.5, color: "#a02020", souls: 3, armor: "none", contactDmg: 6, lifeSteal: true },
  vampire_lord:   { hp: 28,  speed: 19,  size: 2.0, color: "#801010", souls: 5, armor: "none", contactDmg: 8, lifeSteal: true },
  lich:           { hp: 22,  speed: 10,  size: 1.8, color: "#6040a0", souls: 4, armor: "none", summonRate: 5, contactDmg: 5 },
  bat:            { hp: 4,   speed: 28,  size: 0.6, color: "#4a3a5a", souls: 1, armor: "none", flying: true, contactDmg: 2, poison: 2 },
  spider:         { hp: 6,   speed: 20,  size: 0.9, color: "#5a4a3a", souls: 1, armor: "none", contactDmg: 3, poison: 1 },
  giant_spider:   { hp: 16,  speed: 16,  size: 1.5, color: "#4a3a2a", souls: 2, armor: "none", contactDmg: 5, poison: 3 },
  orc:            { hp: 18,  speed: 14,  size: 1.7, color: "#5a7a4a", souls: 3, armor: "none", contactDmg: 7 },
  ogre:           { hp: 28,  speed: 9,   size: 2.3, color: "#6a8a5a", souls: 5, armor: "heavy", contactDmg: 10 },
  troll:          { hp: 22,  speed: 12,  size: 2.0, color: "#4a6a3a", souls: 4, armor: "none", contactDmg: 8, regen: 2 },
  boss_grunt:     { hp: 200, speed: 10,  size: 3.3, color: "#c4305a", souls: 20, armor: "heavy", contactDmg: 12 },
  boss_warden:    { hp: 250, speed: 8,   size: 3.3, color: "#3d9a8e", souls: 25, armor: "insulated", shieldHp: 60, contactDmg: 10 },
  boss_wraith:    { hp: 180, speed: 14,  size: 3.0, color: "#c9a227", souls: 30, armor: "energy", contactDmg: 15 },
  boss_death_knight: { hp: 250, speed: 11, size: 3.6, color: "#2a2a3a", souls: 30, armor: "heavy", contactDmg: 15 },
  boss_lich_king: { hp: 300, speed: 8,  size: 3.3, color: "#4a2a6a", souls: 40, armor: "none", summonRate: 3, contactDmg: 10 },
  boss_spider_queen: { hp: 200, speed: 14, size: 3.0, color: "#3a2a1a", souls: 25, armor: "none", contactDmg: 12, poison: 5 },
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

/** Shot-economy HP: fodder gains +1 every 2 floors, elites +2. Elevators add 25%. */
function scaleEnemyHp(base, floorIndex, elevatorIndex) {
  const step = Math.floor((floorIndex || 0) / 2);
  const per = (base || 1) >= 12 ? 2 : 1;
  const elevMult = 1 + (elevatorIndex || 0) * 0.25;
  return Math.max(1, Math.round((base + step * per) * elevMult));
}

function createEnemy(type, worldX, worldZ, floorIndex = 0, elevatorIndex = 0) {
  const d = ENEMY_DEFS[type] || ENEMY_DEFS.slime;
  const hp = scaleEnemyHp(d.hp || 10, floorIndex, elevatorIndex);
  return {
    id: _nextId++, type, x: worldX, worldZ,
    behavior: BEHAVIOR_MAP[type] || "advance",
    hp, maxHp: hp, speed: d.speed, size: d.size,
    color: d.color, souls: d.souls, armor: d.armor,
    flying: d.flying || false,
    shieldHp: d.shieldHp || 0, maxShieldHp: d.shieldHp || 0,
    shieldRegen: d.shieldHp ? 2 : 0,
    burnT: 0, poisonT: 0, slowT: 0, shredT: 0, oiledT: 0,
    _lateralTarget: 0, _lateralTimer: 0,
    _lurkT: 0,
    _chargeTimer: 2, _charging: false,
    _weaveDir: Math.random() > 0.5 ? 1 : -1,
    _zigzagPhase: Math.random() * Math.PI * 2,
    _summonTimer: 0, _summonRate: d.summonRate || 0,
    _splitDone: false,
    _hitFlash: 0,
    _hitStun: 0,
    _squash: 0,
    _contactCd: 0,
  };
}

function createProjectile(worldX, worldZ, vx, vz, damage, element, ownerId) {
  return {
    id: _nextId++, x: worldX, worldZ, vx, vz,
    damage, element: element || "normal", ownerId,
    life: 4,
    pierceLeft: element === "piercing" ? 3 : 1,
    _hitIds: [],
    _trail: [],
  };
}

const CONTACT_DIST = 30;
const HALF_CORRIDOR = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;
/** Visible fight band — full corridor half is wider than a portrait view. */
const FIGHT_LANE = HALF_CORRIDOR * 0.22;
const SEGMENT_LENGTH = 800;
/** Fork sits this far ahead when the wave is over. */
const JUNCTION_STOP = 180;
/** Groups appear this far down the hall and walk in. */
const PACK_NEAR = 420;

export function enemyFamily(type = "") {
  if (type.includes("slime")) return "slime";
  if (type.includes("goblin")) return "goblin";
  if (type.includes("skeleton") || type === "hauler") return "skeleton";
  if (/ghoul|wight|wraith|lich|vampire/.test(type)) return "undead";
  if (type.includes("spider")) return "spider";
  if (type.includes("bat")) return "bat";
  if (/imp|scamp|demon/.test(type)) return "demon";
  if (/orc|ogre|troll/.test(type)) return "brute";
  return "beast";
}

function enemyThreat(type, floorIndex, elevatorIndex) {
  const d = ENEMY_DEFS[type] || ENEMY_DEFS.slime;
  return scaleEnemyHp(d.hp || 5, floorIndex, elevatorIndex);
}

function hallBudget(floorIndex, sectionIndex, elevatorIndex) {
  return 10 + floorIndex * 5 + elevatorIndex * 14 + Math.floor(sectionIndex * 1.5);
}

function packIntoGroups(types) {
  const groups = [];
  for (let i = 0; i < types.length;) {
    if (i + 1 < types.length && (types.length - i !== 3 || groups.length > 0)) {
      groups.push([types[i], types[i + 1]]);
      i += 2;
    } else {
      groups.push([types[i]]);
      i += 1;
    }
  }
  return groups.length ? groups : [["slime"]];
}

function composeWaveForBudget(roster, target, floorIndex, elevatorIndex) {
  const pool = roster.length <= 6 ? roster : [roster[0], roster[1], ...roster.slice(-4)];
  const cost = (t) => enemyThreat(t, floorIndex, elevatorIndex);
  let best = null;
  let bestDiff = 999;
  const walk = (arr, spent) => {
    if (arr.length && Math.abs(spent - target) < bestDiff) {
      bestDiff = Math.abs(spent - target);
      best = arr.slice();
    }
    if (arr.length >= 4 || spent >= target + 4) return;
    for (const t of pool) walk([...arr, t], spent + cost(t));
  };
  walk([], 0);
  const types = best && best.length ? best : [pool[0] || "slime"];
  const threat = types.reduce((s, t) => s + cost(t), 0);
  return { groups: packIntoGroups(types), threat, enemyTypes: [...new Set(types)] };
}

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
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
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
    this.turnFrom = 0;
    this.turnT = 0;
    this.turnDur = 0.42;
    this.turnU = 0;
    this.turning = false;
    this.heading = 0;
    this.mapX = 0;
    this.mapZ = 0;
    this.pathPts = [{ x: 0, y: 0 }];
    this.waveQueue = [];
    this.waveGroups = [];
    this.groupGap = 0;
    this._pendingEncounter = null;
    this._waveSoulBonus = 0;
    this.floorIndex = 0;
    this.sectionIndex = 0;
    this.elevatorIndex = 0;
    this.hitStop = 0;
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
    this._pendingEncounter = null;
    this._waveSoulBonus = 0;
    this.turnAngle = 0;
    this.turnTarget = 0;
    this.turnFrom = 0;
    this.turnT = 0;
    this.turnU = 0;
    this.turning = false;
    this.heading = 0;
    this.mapX = 0;
    this.mapZ = 0;
    this.pathPts = [{ x: 0, y: 0 }];
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
    this.waveGroups = [];
    this.groupGap = 0;
    this.floorIndex = 0;
    this.sectionIndex = 0;
    this.elevatorIndex = 0;
    this.hitStop = 0;
    this.quiver.capacity = this.state.getQuiverCapacity();
    this.quiver.prepareForRun();
    this.substrates.init();
    this.autoMagic.reset();
    this.state.startRun();
    this.state.applyUpgrades();
    this.running = true;
    this._startWave();
    this.emit("run_start");
  }

  tick() {
    if (!this.running) return;
    if (this.state.phase !== "run") {
      this.running = false;
      return;
    }
    this.tickIndex = (this.tickIndex || 0) + 1;
    this.dt = 1 / 60;
    this.runTime += this.dt;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - this.dt);
      return;
    }

    if (this.turning) {
      this.turnT += this.dt;
      this.turnU = Math.min(1, this.turnT / this.turnDur);
      const e = this.turnU * this.turnU * (3 - 2 * this.turnU);
      this.turnAngle = this.turnFrom + (this.turnTarget - this.turnFrom) * e;
      if (this.turnU >= 1) {
        this.turnAngle = this.turnTarget;
        this.turning = false;
        this.turnComplete();
      }
    }

    if (this.movingForward && !this.junctionPending && !this.turning) {
      this.playerWorldZ += CONFIG.PLAYER_SPEED;
      const rad = (this.heading * Math.PI) / 180;
      this.mapX += Math.sin(rad) * CONFIG.PLAYER_SPEED;
      this.mapZ += Math.cos(rad) * CONFIG.PLAYER_SPEED;
      this.state.playerZ = this.playerWorldZ;
      this.state.runDistance = this.playerWorldZ;

      if (!this._waveCleared() && this.playerWorldZ > this.segmentEndZ - JUNCTION_STOP) {
        this.playerWorldZ = this.segmentEndZ - JUNCTION_STOP;
      }
    }

    this._tickSpawning();
    this._tickEnemies();
    if (this.state.phase !== "run") {
      this.running = false;
      return;
    }
    this.state.tickBonuses(this.dt);
    this._tickProjectiles();
    this._tickEnemyProjectiles();
    this._tickAutoMagic();
    this.substrates.tickReactions();
    const shuffleEvt = this.quiver.tick(this.dt);
    if (shuffleEvt) this.emit("quiver_shuffle");

    if (this.state.arrowCooldown > 0) {
      this.state.arrowCooldown = Math.max(0, this.state.arrowCooldown - this.dt);
    }
  }

  _waveCleared() {
    return !this.waveActive
      && (!this.waveQueue || this.waveQueue.length === 0)
      && this.enemies.length === 0;
  }

  // ─── Segment / Junction ──────────────────────────────────

  _rollJunction() {
    const next = this._peekNextDepth();
    const roster = this._rosterForFloorAt(next.floorIndex, next.elevatorIndex);
    const mid = hallBudget(next.floorIndex, next.sectionIndex, next.elevatorIndex);
    const plans = [
      this._planEncounter(roster, Math.round(mid * 0.75), next, 0),
      this._planEncounter(roster, mid, next, 1),
      this._planEncounter(roster, Math.round(mid * 1.4), next, 2),
    ];
    const dirs = ["left", "forward", "right"];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = dirs[i];
      dirs[i] = dirs[j];
      dirs[j] = t;
    }
    this.junctionChoices = dirs.map((direction, i) => ({ direction, ...plans[i] }));
    this.junctionPending = false;
  }

  _peekNextDepth() {
    const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
    const floors = CONFIG.FLOORS_PER_ELEVATOR || 10;
    let sectionIndex = this.sectionIndex + 1;
    let floorIndex = this.floorIndex;
    let elevatorIndex = this.elevatorIndex;
    if (sectionIndex >= halls) {
      sectionIndex = 0;
      floorIndex++;
      if (floorIndex >= floors) {
        floorIndex = 0;
        elevatorIndex++;
      }
    }
    return { sectionIndex, floorIndex, elevatorIndex };
  }

  _planEncounter(roster, target, depth, soulBonus) {
    const built = composeWaveForBudget(roster, target, depth.floorIndex, depth.elevatorIndex);
    if (depth.floorIndex === 9 && depth.sectionIndex === 9) {
      const bosses = ["boss_grunt", "boss_warden", "boss_wraith", "boss_death_knight", "boss_spider_queen", "boss_lich_king"];
      built.groups.push([bosses[depth.elevatorIndex % bosses.length]]);
    }
    const families = [...new Set(built.groups.flat().map(enemyFamily))];
    return {
      groups: built.groups,
      threat: built.threat,
      enemyTypes: built.enemyTypes,
      families,
      soulBonus,
    };
  }

  _showJunction() {
    if (!this.junctionChoices || !this.junctionChoices.length) this._rollJunction();
    this.junctionPending = true;
    this.movingForward = false;
    this.emit("junction_show", { choices: this.junctionChoices });
  }

  chooseJunction(direction) {
    if (!this.junctionPending || !this.junctionChoices || !this.junctionChoices.length) return;
    const choice = this.junctionChoices.find((c) => c.direction === direction);
    if (!choice) return;
    direction = choice.direction;
    this.junctionPending = false;
    this._pendingEncounter = choice;
    this._pendingTurnDir = direction;
    this.emit("junction_chosen", { direction });
    if (direction === "left" || direction === "right") {
      this.turning = true;
      this.turnFrom = 0;
      this.turnAngle = 0;
      this.turnTarget = direction === "left" ? -90 : 90;
      this.turnT = 0;
      this.turnU = 0;
      this.movingForward = false;
    } else {
      this.turning = false;
      this.turnAngle = 0;
      this.turnTarget = 0;
      this.turnU = 0;
      this._advanceSegment();
    }
  }

  turnComplete() {
    if (this._pendingTurnDir === "left") this.heading -= 90;
    else if (this._pendingTurnDir === "right") this.heading += 90;
    this.pathPts.push({ x: this.mapX, y: this.mapZ });
    this.turnAngle = 0;
    this.turnTarget = 0;
    this.turnU = 0;
    this._pendingTurnDir = null;
    this._advanceSegment();
  }

  _advanceSegment() {
    const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
    const floors = CONFIG.FLOORS_PER_ELEVATOR || 10;
    this.sectionIndex++;
    if (this.sectionIndex >= halls) {
      this.sectionIndex = 0;
      this.floorIndex++;
      if (this.floorIndex >= floors) {
        this.floorIndex = 0;
        this.elevatorIndex++;
      }
    }
    this.segmentIndex++;
    this.segmentStartZ = this.playerWorldZ;
    this.segmentEndZ = this.playerWorldZ + SEGMENT_LENGTH;
    this.movingForward = true;
    this._startWave();
  }

  // ─── Spawning ────────────────────────────────────────────

  _startWave() {
    this.waveIndex++;
    this.waveActive = true;
    this.waveQueue = [];
    if (this._pendingEncounter) {
      this.waveGroups = this._pendingEncounter.groups;
      this._waveSoulBonus = this._pendingEncounter.soulBonus || 0;
      this._pendingEncounter = null;
    } else {
      this.waveGroups = this._openingWave();
      this._waveSoulBonus = 0;
    }
    this.groupGap = 0.2;
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
    this.quiver.shuffleForWave();
    this._rollJunction();
    this.emit("wave_start", {
      wave: this.waveIndex,
      floor: this.floorIndex + 1,
      section: this.sectionIndex + 1,
    });
  }

  _rosterForFloor() {
    return this._rosterForFloorAt(this.floorIndex, this.elevatorIndex);
  }

  _rosterForFloorAt(f, e) {
    const r = ["slime", "goblin_runt"];
    if (f >= 1 || e) r.push("imp");
    if (f >= 2) r.push("slime_large", "goblin_warrior", "bat");
    if (f >= 3) r.push("skeleton", "skeleton_archer", "ghoul");
    if (f >= 4) r.push("spider", "wight");
    if (f >= 5) r.push("orc", "scamp");
    if (f >= 6) r.push("slime_huge", "troll");
    if (f >= 7) r.push("goblin_chieftain", "wraith");
    if (f >= 8) r.push("vampire", "hauler");
    if (f >= 9 || e > 0) r.push("demon", "lich");
    return r;
  }

  _openingWave() {
    if (this.elevatorIndex === 0 && this.floorIndex === 0 && this.sectionIndex === 0) {
      return [["slime", "slime"]];
    }
    const built = composeWaveForBudget(
      this._rosterForFloor(),
      hallBudget(this.floorIndex, this.sectionIndex, this.elevatorIndex),
      this.floorIndex,
      this.elevatorIndex
    );
    return built.groups;
  }

  getProgressLabel() {
    const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
    const fl = this.floorIndex + 1;
    const hall = this.sectionIndex + 1;
    if (this.elevatorIndex > 0) return `E${this.elevatorIndex + 1}  Fl. ${fl}  ${hall}/${halls}`;
    return `Fl. ${fl}  ${hall}/${halls}`;
  }

  _groupGapSeconds() {
    return Math.max(0.4, 1.7 - this.floorIndex * 0.12 - this.elevatorIndex * 0.25);
  }

  _spawnGroup(types) {
    const z = this.playerWorldZ + PACK_NEAR;
    const n = types.length;
    for (let i = 0; i < n; i++) {
      let ex;
      if (n === 1) {
        ex = (Math.random() - 0.5) * FIGHT_LANE;
      } else {
        const t = n === 2 ? (i === 0 ? -1 : 1) : (i / (n - 1) - 0.5) * 2;
        ex = t * FIGHT_LANE * 0.85;
      }
      const enemy = createEnemy(types[i], ex, z + i * 18, this.floorIndex, this.elevatorIndex);
      this.enemies.push(enemy);
      this.emit("enemy_spawn", { enemy });
    }
  }

  _tickSpawning() {
    if (!this.waveActive) return;

    if (this.enemies.length === 0 && this.waveGroups.length > 0) {
      this.groupGap -= this.dt;
      if (this.groupGap <= 0) {
        this._spawnGroup(this.waveGroups.shift());
        this.groupGap = this._groupGapSeconds();
      }
    }

    if (this.waveGroups.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this._recoverArrows();
      this._closeSegmentToJunction();
      if (this._waveSoulBonus) {
        this.state.awardKillSouls(this._waveSoulBonus);
        this._waveSoulBonus = 0;
      }
      this.emit("wave_end", { wave: this.waveIndex });
      const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
      const floors = CONFIG.FLOORS_PER_ELEVATOR || 10;
      if (this.floorIndex >= floors - 1 && this.sectionIndex >= halls - 1) {
        this.state.victory();
        return;
      }
      this._showJunction();
    }
  }

  /** Each spent arrow has a 95% chance to return; the rest break. */
  _recoverArrows() {
    const spent = this.waveSpentArrows || [];
    this.waveSpentArrows = [];
    this.waveArrowsFired = 0;
    const chance = this.state.getArrowReturnChance();
    for (const a of spent) {
      if (Math.random() >= chance) continue;
      if (!this.quiver.addToQuiver(a)) this.quiver.addToStorage(a);
    }
  }

  /** After the fight, the fork sits just ahead — no empty march. */
  _closeSegmentToJunction() {
    const ahead = JUNCTION_STOP + 10;
    if (this.segmentEndZ - this.playerWorldZ > ahead + 24) {
      this.segmentEndZ = this.playerWorldZ + ahead;
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
      if (e._hitStun > 0) e._hitStun = Math.max(0, e._hitStun - dt);
      if (e._squash > 0) e._squash = Math.max(0, e._squash - dt * 5.5);
      if (e._contactCd > 0) e._contactCd = Math.max(0, e._contactCd - dt);

      if (e._hitStun <= 0) switch (e.behavior) {
        case "advance":
          e._lurkT = (e._lurkT || 0) + dt;
          if (e._lurkT < 1.4) {
            e.worldZ -= spd * 0.55;
          } else if (e._lurkT < 1.75) {
            e.worldZ -= spd * 1.15;
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
            e.worldZ -= spd * 0.85;
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
            e._lateralTarget = this.playerWorldX + (Math.random() - 0.5) * FIGHT_LANE * 1.5;
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
          e.worldZ -= spd * (e._charging ? 1.55 : 0.25);
          break;
        case "summoner":
          e.worldZ -= spd * 0.4;
          e._summonTimer -= dt;
          if (e._summonTimer <= 0 && this.enemies.length < 30) {
            e._summonTimer = e._summonRate;
            const summonType = this.waveIndex < 5 ? "slime" : this.waveIndex < 10 ? "ghoul" : "wight";
            const child = createEnemy(summonType, e.x + (Math.random() - 0.5) * 30, e.worldZ + 40, this.floorIndex, this.elevatorIndex);
            child._splitDone = true;
            this.enemies.push(child);
          }
          break;
        case "splits":
          e.worldZ -= spd;
          break;
      }

      if (e._hitStun <= 0) this._funnelTowardCenter(e, relDist, dt);
      const dist = e.worldZ - this.playerWorldZ;
      e.dist = dist;

      if (e.burnT > 0) { e.burnT -= dt; e.hp -= 4 * dt; }
      if (e.poisonT > 0) { e.poisonT -= dt; e.hp -= 2.5 * dt; }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.shredT > 0) e.shredT -= dt;
      if (e.oiledT > 0) e.oiledT -= dt;
      if (e._hitFlash > 0) e._hitFlash = Math.max(0, e._hitFlash - 0.045);

      const def = ENEMY_DEFS[e.type];
      if (def?.regen && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + def.regen * dt);
      }
      const onAxis = Math.abs(e.x - this.playerWorldX) < 26;
      if (def?.lifeSteal && dist < CONTACT_DIST && dist > 6 && onAxis) {
        e.hp = Math.min(e.maxHp, e.hp + 2 * dt);
      }

      if (e.hp <= 0) {
        this._killEnemy(e, i, def, relDist);
        continue;
      }

      if (dist < CONTACT_DIST && dist > 6 && onAxis && (e._contactCd || 0) <= 0) {
        const dmg = (e.behavior === "charge" && e._charging) ? (def?.contactDmg || 4) * 3 : (def?.contactDmg || 4);
        this.state.damagePlayer(dmg);
        this.emit("player_hit", { damage: dmg, enemy: e });
        e._contactCd = 0.95;
        e._hitStun = 0.32;
        e._squash = 1;
        e.worldZ += e.flying ? 36 : 52;
        e.x += Math.sign(e.x || (Math.random() - 0.5)) * 6;
        this.hitStop = Math.max(this.hitStop, 0.07);
        continue;
      }
    }
  }

  _killEnemy(e, index, def, relDist) {
    this.state.enemiesKilled++;
    this.state.awardKillSouls(e.souls || def?.souls || 1);
    this.emit("enemy_death", { enemy: e, x: e.x, dist: relDist });
    if (def?.splitTo && !e._splitDone) {
      for (let s = 0; s < (def.splitCount || 2); s++) {
        const child = createEnemy(def.splitTo, e.x + (s ? 15 : -15), e.worldZ + 10, this.floorIndex, this.elevatorIndex);
        child._splitDone = true;
        this.enemies.push(child);
      }
    }
    this.enemies.splice(index, 1);
  }

  /**
   * Enemies may start on the sides, but they must creep into the
   * center as they close. Off-axis bodies cannot walk past the player.
   */
  _funnelTowardCenter(e, relDist, dt) {
    const px = this.playerWorldX;
    const close = Math.max(0, Math.min(1, 1 - (relDist - 28) / 280));
    const maxOff = FIGHT_LANE * (1.15 - close * 0.55) + 4;
    let dx = e.x - px;
    if (Math.abs(dx) > maxOff) {
      const pull = Math.abs(dx) - maxOff;
      e.x -= Math.sign(dx) * Math.min(pull, (10 + close * 55) * dt);
    } else if (close > 0.2) {
      e.x += (px - e.x) * close * 2.2 * dt;
    }
    e.x = Math.max(-FIGHT_LANE * 1.15, Math.min(FIGHT_LANE * 1.15, e.x));

    if (e.flying) return;

    const off = Math.abs(e.x - px);
    const floor = off > 24 ? 40 : 16;
    if (e.worldZ < this.playerWorldZ + floor) {
      e.worldZ = this.playerWorldZ + floor;
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
        const hitR = (e.size * CONFIG.CELL_SIZE) * 0.7;
        if (p._hitIds && p._hitIds.includes(e.id)) continue;
        if (dx * dx + ddist * ddist < hitR * hitR) {
          if (!p._hitIds) p._hitIds = [];
          p._hitIds.push(e.id);
          const raw = this._calcDamage(p, e);
          let dmg = raw;
          if (e.shieldHp > 0) {
            const absorbed = Math.min(e.shieldHp, dmg);
            e.shieldHp -= absorbed;
            dmg -= absorbed;
          }
          if (dmg > 0) e.hp -= dmg;
          e._hitFlash = 1;
          e._hitStun = Math.max(e._hitStun || 0, 0.12);
          e._squash = 1;
          e.worldZ += 18;
          e.x += Math.sign(e.x - p.x || 1) * 3;
          this.hitStop = Math.max(this.hitStop, 0.045);
          this.emit("projectile_hit", { projectile: p, enemy: e, x: p.x, dist: relDist, damage: raw });
          this._applyStatus(p, e);
          this.substrates.onArrowImpact(
            Math.floor(p.x / CONFIG.CELL_SIZE),
            Math.floor(relDist / CONFIG.CELL_SIZE),
            p.element
          );
          p.pierceLeft = (p.pierceLeft || 1) - 1;
          if (p.pierceLeft <= 0) this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  _calcDamage(proj, enemy) {
    let d = proj.damage;
    const el = proj.element;
    const def = getArrowDef(el);
    if (def.vsUndead && /skeleton|ghoul|wight|wraith|lich|vampire/.test(enemy.type || "")) {
      d *= def.vsUndead;
    }
    const soft = el === "wood" || el === "flint" || el === "normal" || el === "kinetic";
    if (enemy.armor === "heavy" && soft) d *= 0.5;
    else if (enemy.armor === "heavy" && el === "iron") d *= 0.8;
    if (enemy.armor === "insulated" && (el === "fire" || el === "shock")) d *= 0.5;
    if (enemy.armor === "energy") { d *= 0.7; if (proj.ownerId === "player") this.state.damagePlayer(Math.floor(proj.damage * 0.3)); }
    if (enemy.shredT > 0) d = proj.damage;
    if (proj.ownerId === "player") {
      d += this.state.getStrengthBonus();
      d *= this.state.runBonuses.damageMultiplier || 1;
      if (Math.random() < this.state.getCritChance()) d *= this.state.getCritMultiplier();
    }
    return Math.max(1, Math.floor(d));
  }

  _applyStatus(proj, e) {
    const el = proj.element;
    if (el === "fire") {
      if (e.slowT > 0) e.slowT = 0;
      if (e.oiledT > 0) {
        e.oiledT = 0;
        e.burnT = Math.max(e.burnT, 5);
        e.hp -= 6;
      } else {
        e.burnT = Math.max(e.burnT, 3);
      }
    } else if (el === "ice" || el === "frost") {
      if (e.burnT > 0) e.burnT = 0;
      e.slowT = Math.max(e.slowT, 2);
    } else if (el === "poison") e.poisonT = Math.max(e.poisonT, 4);
    else if (el === "oil") e.oiledT = Math.max(e.oiledT, 6);
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
    if (this.junctionPending || this.turning) return null;
    if (this.state.phase !== "run") return null;
    if (this.state.arrowCooldown > 0) return null;
    const arrow = this.quiver.fireArrow();
    if (!arrow) return null;
    this.state.arrowsFired++;
    this.waveArrowsFired = (this.waveArrowsFired || 0) + 1;
    this.waveSpentArrows = this.waveSpentArrows || [];
    this.waveSpentArrows.push({ type: arrow.type, level: arrow.level });
    this.state.arrowCooldown = this.state.getArrowCooldown();

    const aim = trajectory && trajectory.vector ? trajectory.vector : { x: 0, y: -1 };
    const spd = (trajectory && trajectory.speed) || CONFIG.ARROW_SPEED * 0.7;
    const vx = aim.x * spd * 0.35;
    const vz = spd * 0.75;

    const dmg = getArrowDamage(arrow.type, arrow.level);
    const proj = createProjectile(
      this.playerWorldX, this.playerWorldZ + 18,
      vx, vz,
      dmg, arrow.type, "player"
    );
    this.projectiles.push(proj);
    this.emit("arrow_fire", { arrow, projectile: proj });
    if (arrow.type === "double") {
      this.projectiles.push(createProjectile(
        this.playerWorldX, this.playerWorldZ + 18,
        vx * 1.08 + 18, vz * 0.96,
        dmg, "wood", "player"
      ));
    }

    if (this.state.consumeBurst()) {
      setTimeout(() => {
        if (this.state.phase !== "run" || this.junctionPending) return;
        const b = this.quiver.fireArrow();
        if (b) {
          this.state.arrowsFired++;
          this.waveArrowsFired = (this.waveArrowsFired || 0) + 1;
          this.waveSpentArrows.push({ type: b.type, level: b.level });
          this.projectiles.push(createProjectile(
            this.playerWorldX, this.playerWorldZ, vx * 1.1, vz * 1.1,
            getArrowDamage(b.type, b.level), b.type, "player"
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
      p.dist = p.worldZ - pz;
      if (p._trail) {
        for (const t of p._trail) t.dist = t.worldZ - pz;
      }
      list.push({ depth: p.dist, type: "projectile", entity: p });
    }
    for (const p of this.enemyProjectiles) {
      p.dist = p.worldZ - pz;
      list.push({ depth: p.dist, type: "enemy_projectile", entity: p });
    }
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }

  pause() { this.running = false; }
  resume() { this.running = true; }
  destroy() { this.running = false; this.enemies = []; this.projectiles = []; this.enemyProjectiles = []; }
}
