import { CONFIG } from "../data/config.js";
import {
  QuiverDeckManager, getArrowDef, getArrowDamage, getArrowFireDamage, getArrowIceDamage,
  lootProgressScore, arrowLevelCapForProgress, rollArrowLevel,
} from "./QuiverDeckManager.js";
import { AutoMagicSystem } from "./AutoMagicSystem.js";
import { GameStateManager } from "./GameStateManager.js";
import {
  ENEMY_DEFS,
  BEHAVIOR_MAP,
  scaleEnemyHp,
  enemyHitWidth,
  enemyFamily,
  rollEnemyCoins,
  rollEnemyItemDrop,
  rollGroundFind,
  hallHpBudget,
  composeWaveForHp,
  enemyThreat,
  enemyDisplayName,
  POTION_LABELS,
} from "./enemyData.js";

export { ENEMY_DEFS };

let _nextId = 1;

function createEnemy(type, worldX, worldZ, floorIndex = 0, elevatorIndex = 0) {
  const d = ENEMY_DEFS[type] || ENEMY_DEFS.slime;
  const hp = scaleEnemyHp(d.hp || 10, floorIndex, elevatorIndex);
  return {
    id: _nextId++, type, x: worldX, worldZ,
    behavior: BEHAVIOR_MAP[type] || "advance",
    hp, maxHp: hp, speed: d.speed, size: d.size,
    color: d.color, armor: d.armor,
    flying: d.flying || false,
    contactPoison: d.poison || 0,
    shieldHp: d.shieldHp || 0, maxShieldHp: d.shieldHp || 0,
    shieldRegen: d.shieldHp ? 2 : 0,
    burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, slowT: 0, slowFactor: 0.4,
    shredT: 0, oiledT: 0, bleedT: 0, bleedDps: 0,
    _lateralTarget: worldX, _lateralTimer: 0,
    _laneX: worldX,
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

function createProjectile(worldX, worldZ, vx, vz, damage, element, ownerId, level = 1) {
  const def = getArrowDef(element);
  const pierceRanks = def.pierce != null ? def.pierce : 0;
  return {
    id: _nextId++, x: worldX, worldZ, vx, vz,
    damage, fireDamage: getArrowFireDamage(element, level), iceDamage: getArrowIceDamage(element, level),
    element: element || "normal", ownerId, level: level || 1,
    life: 4,
    pierceLeft: 1 + pierceRanks,
    punchArmour: pierceRanks > 0,
    _hitIds: [],
    _trail: [],
  };
}

const CONTACT_DIST = 30;
const HALF_CORRIDOR = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;
const FIGHT_LANE = HALF_CORRIDOR * 0.22;
const SEGMENT_LENGTH = 800;
const JUNCTION_STOP = 180;
const PACK_NEAR = 420;

export class CorridorSim {
  constructor() {
    this.state = new GameStateManager();
    this.quiver = new QuiverDeckManager();
    this.autoMagic = new AutoMagicSystem();
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.waveIndex = 0;
    this.waveActive = false;
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
    this.waveLootLog = [];
    this.pendingWaveReport = null;
    this.lootPending = false;
    this._lootDelayT = -1;
    this._afterLootAction = null;
    this.runStash = { arrows: [], items: [] };
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
    this.turnDur = 0.92;
    this.turnU = 0;
    this.turning = false;
    this._forwardCommit = false;
    this._forwardCommitT = 0;
    this._approachingJunction = false;
    this._approachingElevator = false;
    this.elevatorCheckpointPending = false;
    this._pendingElevatorTarget = null;
    this._finalBoss = false;
    this._pendingBurst = null;
    this.heading = 0;
    this.mapX = 0;
    this.mapZ = 0;
    this.pathPts = [{ x: 0, y: 0 }];
    this.waveQueue = [];
    this.waveGroups = [];
    this.groupGap = 0;
    this._pendingEncounter = null;
    this._waveCoinBonus = 0;
    this.waveLootLog = [];
    this.pendingWaveReport = null;
    this.lootPending = false;
    this._lootDelayT = -1;
    this._afterLootAction = null;
    this.runStash = { arrows: [], items: [] };
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
    this._waveCoinBonus = 0;
    this.turnAngle = 0;
    this.turnTarget = 0;
    this.turnFrom = 0;
    this.turnT = 0;
    this.turnU = 0;
    this.turning = false;
    this._forwardCommit = false;
    this._forwardCommitT = 0;
    this._approachingJunction = false;
    this._approachingElevator = false;
    this.elevatorCheckpointPending = false;
    this._pendingElevatorTarget = null;
    this._finalBoss = false;
    this._pendingBurst = null;
    this.heading = 0;
    this.mapX = 0;
    this.mapZ = 0;
    this.pathPts = [{ x: 0, y: 0 }];
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
    this.waveLootLog = [];
    this.pendingWaveReport = null;
    this.lootPending = false;
    this._lootDelayT = -1;
    this._afterLootAction = null;
    this.runStash = { arrows: [], items: [] };
    this.waveGroups = [];
    this.groupGap = 0;
    this.floorIndex = 0;
    this.sectionIndex = 0;
    this.elevatorIndex = this.state.getStartElevator();
    this.hitStop = 0;
    this.quiver.capacity = this.state.getQuiverCapacity();
    this.quiver.prepareForRun(this.state.getCraftFillerType());
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
    if (this.elevatorCheckpointPending) return;
    this.tickIndex = (this.tickIndex || 0) + 1;
    this.dt = 1 / 60;
    this.runTime += this.dt;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - this.dt);
      return;
    }

    if (this.lootPending || this._lootDelayT > 0) {
      if (this._lootDelayT > 0) {
        this._lootDelayT -= this.dt;
        if (this._lootDelayT <= 0) {
          this._lootDelayT = -1;
          this.lootPending = true;
          this.emit("wave_loot", { report: this.pendingWaveReport });
        }
      }
      // Hold still while the hall report is up.
      this._tickSpawning();
      return;
    }

    if (this.turning) {
      this.turnT += this.dt;
      this.turnU = Math.min(1, this.turnT / this.turnDur);
      // Ease-in-out with a slightly heavier settle into the new hall.
      const u = this.turnU;
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.turnAngle = this.turnFrom + (this.turnTarget - this.turnFrom) * e;
      // Walk into the corner while yawing — not a standing spin.
      const step = CONFIG.PLAYER_SPEED * (1.05 + Math.sin(u * Math.PI) * 0.85);
      this.playerWorldZ += step;
      const rad = ((this.heading + this.turnAngle) * Math.PI) / 180;
      this.mapX += Math.sin(rad) * step;
      this.mapZ += Math.cos(rad) * step;
      this.state.playerZ = this.playerWorldZ;
      this.state.runDistance = this.playerWorldZ;
      if (this.turnU >= 1) {
        this.turnAngle = this.turnTarget;
        this.turning = false;
        this.turnComplete();
      }
    } else if (this._forwardCommit) {
      this._forwardCommitT += this.dt;
      const u = Math.min(1, this._forwardCommitT / 0.38);
      const step = CONFIG.PLAYER_SPEED * (1.4 + (1 - u) * 0.8);
      this.playerWorldZ += step;
      const rad = (this.heading * Math.PI) / 180;
      this.mapX += Math.sin(rad) * step;
      this.mapZ += Math.cos(rad) * step;
      this.state.playerZ = this.playerWorldZ;
      this.state.runDistance = this.playerWorldZ;
      if (u >= 1) {
        this._forwardCommit = false;
        this._forwardCommitT = 0;
        this._advanceSegment();
      }
    } else if (this._approachingJunction || this._approachingElevator) {
      // Sprint to the fork / elevator shaft after a clear — never choose from mid-hall.
      const stopAt = this.segmentEndZ - JUNCTION_STOP;
      const step = CONFIG.PLAYER_SPEED * 8.5;
      const nextZ = Math.min(stopAt, this.playerWorldZ + step);
      const moved = nextZ - this.playerWorldZ;
      this.playerWorldZ = nextZ;
      const rad = (this.heading * Math.PI) / 180;
      this.mapX += Math.sin(rad) * moved;
      this.mapZ += Math.cos(rad) * moved;
      this.state.playerZ = this.playerWorldZ;
      this.state.runDistance = this.playerWorldZ;
      if (this.playerWorldZ >= stopAt - 0.01) {
        this.playerWorldZ = stopAt;
        this.movingForward = false;
        if (this._approachingElevator) {
          this._approachingElevator = false;
          this._rideElevator();
        } else {
          this._approachingJunction = false;
          this._showJunction();
        }
      }
    }

    if (this.movingForward && !this.junctionPending && !this.turning && !this._forwardCommit && !this._approachingJunction && !this._approachingElevator) {
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
    if (this.state.phase !== "run") {
      this.running = false;
      return;
    }
    this._tickPendingBurst();
    this._tickProjectiles();
    if (this.state.phase !== "run") {
      this.running = false;
      return;
    }
    this._tickEnemyProjectiles();
    if (this.state.phase !== "run") {
      this.running = false;
      return;
    }
    this._tickAutoMagic();
    if (this.state.phase !== "run") {
      this.running = false;
      return;
    }
    const shuffleEvt = this.quiver.tick(this.dt);
    if (shuffleEvt) this.emit("quiver_shuffle");

    if (this.state.arrowCooldown > 0) {
      this.state.arrowCooldown = Math.max(0, this.state.arrowCooldown - this.dt);
    }
    if (this.state.daggerCooldown > 0) {
      this.state.daggerCooldown = Math.max(0, this.state.daggerCooldown - this.dt);
    }
  }

  _tickPendingBurst() {
    const b = this._pendingBurst;
    if (!b) return;
    b.t -= this.dt;
    if (b.t > 0) return;
    this._pendingBurst = null;
    if (this.state.phase !== "run" || this.lootPending || this._lootDelayT > 0 || this.junctionPending || this.turning || this._approachingJunction || this._approachingElevator) return;
    const arrow = this.quiver.fireArrow();
    if (!arrow) return;
    this.state.arrowsFired++;
    this.waveArrowsFired = (this.waveArrowsFired || 0) + 1;
    this.waveSpentArrows = this.waveSpentArrows || [];
    this.waveSpentArrows.push({ type: arrow.type, level: arrow.level });
    this.projectiles.push(createProjectile(
      this.playerWorldX, this.playerWorldZ + 18,
      b.vx, b.vz,
      getArrowDamage(arrow.type, arrow.level), arrow.type, "player",
      b.level || arrow.level
    ));
  }

  _waveCleared() {
    return !this.waveActive
      && (!this.waveQueue || this.waveQueue.length === 0)
      && this.enemies.length === 0;
  }

  // ─── Segment / Junction ──────────────────────────────────

  _rollJunction() {
    const next = this._peekNextDepth();
    if (next.elevatorGate) {
      this.junctionChoices = null;
      this.junctionPending = false;
      return;
    }
    const roster = this._rosterForFloorAt(next.floorIndex, next.elevatorIndex, next.sectionIndex);
    const mid = hallHpBudget(next.floorIndex, next.sectionIndex, next.elevatorIndex);
    const plans = [
      this._planEncounter(roster, Math.round(mid * 0.78), next, 0),
      this._planEncounter(roster, mid, next, 1),
      this._planEncounter(roster, Math.round(mid * 1.38), next, 2),
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
    const elevatorIndex = this.elevatorIndex;
    if (sectionIndex >= halls) {
      sectionIndex = 0;
      floorIndex++;
      if (floorIndex >= floors) {
        // Past floor 10 is the elevator shaft — not a fork destination.
        return {
          sectionIndex: halls - 1,
          floorIndex: floors - 1,
          elevatorIndex,
          elevatorGate: true,
        };
      }
    }
    return { sectionIndex, floorIndex, elevatorIndex };
  }

  _planEncounter(roster, target, depth, coinBonus) {
    const built = composeWaveForHp(roster, target, depth.floorIndex, depth.elevatorIndex);
    const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
    const floors = CONFIG.FLOORS_PER_ELEVATOR || 10;
    // Elevator guardian: last hall of floor 10 in each elevator block.
    if (depth.floorIndex === floors - 1 && depth.sectionIndex === halls - 1) {
      const bosses = ["boss_grunt", "boss_warden", "boss_wraith", "boss_death_knight", "boss_spider_queen", "boss_lich_king"];
      built.groups.push([bosses[depth.elevatorIndex % bosses.length]]);
    }
    const allTypes = built.groups.flat();
    const families = [...new Set(allTypes.map(enemyFamily))];
    return {
      groups: built.groups,
      threat: allTypes.reduce((sum, type) => sum + enemyThreat(type, depth.floorIndex, depth.elevatorIndex), 0),
      enemyTypes: [...new Set(allTypes)],
      families,
      coinBonus,
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
      this._forwardCommit = false;
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
      this._forwardCommit = true;
      this._forwardCommitT = 0;
      this.movingForward = false;
    }
  }

  turnComplete() {
    if (this._pendingTurnDir === "left") this.heading -= 90;
    else if (this._pendingTurnDir === "right") this.heading += 90;
    this.heading = ((this.heading % 360) + 360) % 360;
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
      // Elevator bumps only via _rideElevator — never skip the shaft by forking.
      if (this.floorIndex >= floors) {
        this.floorIndex = floors - 1;
        this.sectionIndex = halls - 1;
      }
    }
    this.segmentIndex++;
    this.segmentStartZ = this.playerWorldZ;
    this.segmentEndZ = this.playerWorldZ + SEGMENT_LENGTH;
    this.movingForward = true;
    this._checkNotebookDiscovery();
    this._startWave();
  }

  /** Floor 9 of each elevator block: find a craft notebook (once per block). */
  _checkNotebookDiscovery() {
    // floorIndex 8 = Floor 9
    if (this.floorIndex !== 8) return;
    const found = this.state.discoverNotebook(this.elevatorIndex);
    if (!found) return;
    this.emit("notebook_found", found);
  }

  // ─── Spawning ────────────────────────────────────────────

  _startWave() {
    this._checkNotebookDiscovery();
    this.waveIndex++;
    this.waveActive = true;
    this.waveQueue = [];
    if (this._pendingEncounter) {
      this.waveGroups = this._pendingEncounter.groups;
      this._waveCoinBonus = this._pendingEncounter.coinBonus || 0;
      this._pendingEncounter = null;
    } else {
      this.waveGroups = this._openingWave();
      this._waveCoinBonus = 0;
    }
    this.groupGap = 0.2;
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
    this.waveLootLog = [];
    this.quiver.shuffleForWave();
    this._rollJunction();
    this.emit("wave_start", {
      wave: this.waveIndex,
      floor: this.floorIndex + 1,
      section: this.sectionIndex + 1,
    });
  }

  _rosterForFloor() {
    return this._rosterForFloorAt(this.floorIndex, this.elevatorIndex, this.sectionIndex);
  }

  _rosterForFloorAt(f, e, sectionIndex = 0) {
    // Floor 1: slime + goblin. Hall 10 unlocks warrior for the miniboss spike.
    const r = ["slime", "goblin_runt"];
    if (f >= 1 || e > 0) r.push("imp");
    if (f >= 2 || e > 0) r.push("slime_large", "goblin_warrior", "bat");
    else if (sectionIndex >= 9) r.push("goblin_warrior");
    if (f >= 3) r.push("skeleton", "skeleton_archer", "ghoul");
    if (f >= 4) r.push("spider", "wight", "giant_spider");
    if (f >= 5) r.push("orc", "scamp");
    if (f >= 6) r.push("slime_huge", "troll", "ogre");
    if (f >= 7) r.push("goblin_chieftain", "wraith");
    if (f >= 8) r.push("vampire", "hauler", "vampire_lord");
    if (f >= 9 || e > 0) r.push("demon", "lich");
    return r;
  }

  _waveForDepth(floorIndex, sectionIndex, elevatorIndex) {
    return composeWaveForHp(
      this._rosterForFloorAt(floorIndex, elevatorIndex, sectionIndex),
      hallHpBudget(floorIndex, sectionIndex, elevatorIndex),
      floorIndex,
      elevatorIndex
    );
  }

  _openingWave() {
    return this._waveForDepth(this.floorIndex, this.sectionIndex, this.elevatorIndex).groups;
  }

  getFloorNumber() {
    const floors = CONFIG.FLOORS_PER_ELEVATOR || 10;
    if (this._finalBoss) return (CONFIG.ELEVATORS_PER_RUN || 10) * floors;
    return Math.max(1, this.elevatorIndex * floors + this.floorIndex + 1);
  }

  getWaveNumber() {
    return Math.max(1, this.sectionIndex + 1);
  }

  getProgressLabel() {
    if (this._finalBoss) return "Final Boss";
    const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
    const startElevs = CONFIG.START_ELEVATORS || 9;
    const fl = this.floorIndex + 1;
    const hall = this.sectionIndex + 1;
    if (this.elevatorIndex <= 0) return `Gate  Fl. ${fl}  ${hall}/${halls}`;
    return `E${this.elevatorIndex}/${startElevs}  Fl. ${fl}  ${hall}/${halls}`;
  }

  /** Last hall of floor 10 — elevator shaft, not a fork you can walk past. */
  _isElevatorGate() {
    const halls = CONFIG.SECTIONS_PER_FLOOR || 10;
    const floors = CONFIG.FLOORS_PER_ELEVATOR || 10;
    return this.floorIndex >= floors - 1 && this.sectionIndex >= halls - 1 && !this._finalBoss;
  }

  _groupGapSeconds() {
    return Math.max(0.4, 1.7 - this.floorIndex * 0.12 - this.elevatorIndex * 0.25);
  }

  _pickSpawnLanes(n) {
    if (n <= 1) {
      const side = Math.random() < 0.5 ? -1 : 1;
      return [side * FIGHT_LANE * (0.4 + Math.random() * 0.5)];
    }
    const lanes = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      lanes.push((t - 0.5) * 2 * FIGHT_LANE * 0.92);
    }
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = lanes[i];
      lanes[i] = lanes[j];
      lanes[j] = tmp;
    }
    return lanes.map((x) => x + (Math.random() - 0.5) * FIGHT_LANE * 0.12);
  }

  _spawnGroup(types) {
    const z = this.playerWorldZ + PACK_NEAR;
    const n = types.length;
    const lanes = this._pickSpawnLanes(n);
    for (let i = 0; i < n; i++) {
      const ex = lanes[i];
      // Stagger depth so packs aren't a single-file column.
      const ez = z + i * 52 + Math.random() * 24;
      const enemy = createEnemy(types[i], ex, ez, this.floorIndex, this.elevatorIndex);
      enemy._laneX = ex;
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
      if (this._finalBoss) {
        this._beginWaveLootSequence("victory");
        return;
      }
      if (this._isElevatorGate()) {
        this._beginWaveLootSequence("elevator");
        return;
      }
      this._beginWaveLootSequence("junction");
    }
  }

  /** After the fight, run to the real fork — never choose from mid-corridor. */
  _beginApproachToJunction() {
    const stopAt = this.segmentEndZ - JUNCTION_STOP;
    if (this.playerWorldZ >= stopAt - 1) {
      this.playerWorldZ = stopAt;
      this.movingForward = false;
      this._approachingJunction = false;
      this._approachingElevator = false;
      this._showJunction();
      return;
    }
    this._approachingElevator = false;
    this._approachingJunction = true;
    this.movingForward = true;
    this.junctionPending = false;
  }

  /** After floor 10, sprint to the shaft — no left/right/ahead choice. */
  _beginApproachToElevator() {
    this.junctionChoices = null;
    this.junctionPending = false;
    this._approachingJunction = false;
    const stopAt = this.segmentEndZ - JUNCTION_STOP;
    if (this.playerWorldZ >= stopAt - 1) {
      this.playerWorldZ = stopAt;
      this.movingForward = false;
      this._approachingElevator = false;
      this._rideElevator();
      return;
    }
    this._approachingElevator = true;
    this.movingForward = true;
  }

  /**
   * Ride the elevator after floor 10 of a block.
   * Arriving at blocks 1–9 unlocks start shafts E1–E9. Clearing block 9 → final boss (no E10).
   */
  _rideElevator() {
    if (this.elevatorCheckpointPending) return;
    this._approachingElevator = false;
    this._approachingJunction = false;
    this.junctionPending = false;
    this.junctionChoices = null;
    this._pendingEncounter = null;
    const elevs = CONFIG.ELEVATORS_PER_RUN || 10;
    const from = this.elevatorIndex;
    const final = from >= elevs - 1;
    const to = final ? "final" : from + 1;
    if (!final) this.state.unlockElevator(to);

    const banked = this.state.bankCoins();
    this.commitRunStash();
    this.elevatorCheckpointPending = true;
    this._pendingElevatorTarget = { from, to, final, banked };
    this.movingForward = false;
    this.emit("elevator_checkpoint", { from, to, final, banked });
  }

  /** Continue from a banked elevator checkpoint. */
  continueAtElevator() {
    if (!this.elevatorCheckpointPending || !this._pendingElevatorTarget) return false;
    const target = this._pendingElevatorTarget;
    this.elevatorCheckpointPending = false;
    this._pendingElevatorTarget = null;

    if (target.final) {
      this.emit("elevator_ride", { from: target.from, to: "final", banked: target.banked });
      this._enterFinalBoss();
      return true;
    }

    this.elevatorIndex = target.to;
    this.floorIndex = 0;
    this.sectionIndex = 0;
    this.segmentIndex++;
    this.segmentStartZ = this.playerWorldZ;
    this.segmentEndZ = this.playerWorldZ + SEGMENT_LENGTH;
    this.movingForward = true;
    this.turnAngle = 0;
    this.turning = false;
    this._forwardCommit = false;
    this.emit("elevator_ride", {
      from: target.from,
      to: this.elevatorIndex,
      unlocked: this.elevatorIndex,
      banked: target.banked,
    });
    this._startWave();
    return true;
  }

  /** Leave from a banked elevator checkpoint and return to the hub. */
  leaveAtElevator() {
    if (!this.elevatorCheckpointPending) return false;
    this.elevatorCheckpointPending = false;
    this._pendingElevatorTarget = null;
    this.quiver.packForHub();
    this.running = false;
    this.state.hubVisits++;
    this.state.enterHub();
    return true;
  }

  _enterFinalBoss() {
    this._finalBoss = true;
    this.floorIndex = 0;
    this.sectionIndex = 0;
    this.segmentIndex++;
    this.segmentStartZ = this.playerWorldZ;
    this.segmentEndZ = this.playerWorldZ + SEGMENT_LENGTH;
    this.movingForward = true;
    this.junctionChoices = null;
    this.junctionPending = false;
    this._pendingEncounter = null;
    this.waveIndex++;
    this.waveActive = true;
    this.waveQueue = [];
    this.waveGroups = [["boss_lich_king"], ["boss_death_knight", "wraith"]];
    this._waveCoinBonus = 25;
    this.groupGap = 0.35;
    this.waveArrowsFired = 0;
    this.waveSpentArrows = [];
    this.quiver.shuffleForWave();
    this.emit("wave_start", { wave: this.waveIndex, floor: 0, section: 0, finalBoss: true });
  }

  // ─── Enemies ─────────────────────────────────────────────

  _tickEnemies() {
    const dt = this.dt;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.state.phase !== "run") return;
      const e = this.enemies[i];
      const relDist = e.worldZ - this.playerWorldZ;
      e.dist = relDist;
      const spd = e.speed * dt * (e.slowT > 0 ? (e.slowFactor || 0.4) : 1);
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
            const target = e._laneX != null ? e._laneX : e.x;
            const dxLane = target - e.x;
            e.x += Math.sign(dxLane) * Math.min(Math.abs(dxLane), spd * 0.5);
          }
          break;
        case "swarm": {
          // Low-level goblins: full-strength sidestep, but much less often.
          e._swarmTimer = (e._swarmTimer || 0) + dt;
          e._swarmDodgeSeq = e._swarmDodgeSeq || [-1, 1, 1, -1];
          e._swarmDodgeIdx = e._swarmDodgeIdx || 0;
          const walkDur = 3.1;
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
            const target = e._laneX != null ? e._laneX : e.x;
            const dxLane = target - e.x;
            e.x += Math.sign(dxLane) * Math.min(Math.abs(dxLane), spd * 0.35);
          }
          break;
        case "zigzag":
          e.worldZ -= spd * 0.8;
          e._zigzagPhase += dt * 5;
          e.x = (e._laneX || 0) + Math.sin(e._zigzagPhase) * FIGHT_LANE * 0.45;
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

      if (e._hitStun <= 0) this._clampToFightLane(e, relDist, dt);

      const dist = e.worldZ - this.playerWorldZ;
      e.dist = dist;

      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= (e.burnDps || 3) * dt;
      }
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        e.hp -= (e.poisonDps || 2.5) * dt;
      }
      if (e.bleedT > 0) {
        e.bleedT -= dt;
        e.hp -= (e.bleedDps || 2) * dt;
      }
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
        const poison = e.contactPoison || def?.poison || 0;
        if (this.state.phase === "run" && poison > 0) this.state.applyPlayerPoison(poison);
        this.emit("player_hit", { damage: dmg, enemy: e });
        if (this.state.phase !== "run") return;
        e._contactCd = 0.95;
        e._hitStun = 0.32;
        e._squash = 1;
        e.worldZ += e.flying ? 36 : 52;
        e.x += Math.sign(e.x || (Math.random() - 0.5)) * 6;
        this.hitStop = Math.max(this.hitStop, 0.07);
        continue;
      }
    }
    this._separateEnemies();
  }

  _killEnemy(e, index, def, relDist) {
    this.state.enemiesKilled++;
    const baseCoins = rollEnemyCoins(e.type);
    const coins = this.state.awardKillCoins(baseCoins);
    const drop = rollEnemyItemDrop(e.type);
    if (drop && drop.kind === "arrow") {
      const score = lootProgressScore(this.floorIndex, this.elevatorIndex);
      const cap = arrowLevelCapForProgress(score, { shop: false });
      drop.level = rollArrowLevel(Math.random, Math.max(1, cap - 1), { favorHigh: false });
      const adef = getArrowDef(drop.type);
      drop.label = drop.level > 1 ? `${adef.name} Lv${drop.level}` : adef.name;
    }
    this.waveLootLog = this.waveLootLog || [];
    this.waveLootLog.push({
      name: enemyDisplayName(e.type),
      coins,
      baseCoins,
      drop,
    });
    this.emit("enemy_death", { enemy: e, x: e.x, dist: relDist, coins, baseCoins, drop });
    if (def?.splitTo && !e._splitDone) {
      for (let s = 0; s < (def.splitCount || 2); s++) {
        const side = s ? 1 : -1;
        const child = createEnemy(
          def.splitTo,
          e.x + side * (18 + Math.random() * 10),
          e.worldZ + 10 + s * 8,
          this.floorIndex,
          this.elevatorIndex
        );
        child._splitDone = true;
        child._laneX = child.x;
        this.enemies.push(child);
      }
    }
    this.enemies.splice(index, 1);
  }

  /** Spent arrows may return; wood never overflows to storage. */
  _recoverArrows() {
    const spent = this.waveSpentArrows || [];
    this.waveSpentArrows = [];
    this.waveArrowsFired = 0;
    const chance = this.state.getArrowReturnChance();
    const returned = [];
    const broken = [];
    for (const a of spent) {
      if (Math.random() >= chance) {
        broken.push({ type: a.type, level: a.level || 1 });
        continue;
      }
      if (this.quiver.addToQuiver(a)) {
        returned.push({ type: a.type, level: a.level || 1, where: "quiver" });
      } else if (!this.quiver.isWoodType(a.type)) {
        this.addToRunStashArrow(a);
        returned.push({ type: a.type, level: a.level || 1, where: "stash" });
      } else {
        // Wood with a full quiver — shaft left behind.
        broken.push({ type: a.type, level: a.level || 1, reason: "no_room" });
      }
    }
    return { returned, broken };
  }

  addToRunStashArrow(arrow) {
    if (!this.runStash) this.runStash = { arrows: [], items: [] };
    if (this.quiver.isWoodType(arrow?.type)) return false;
    this.runStash.arrows.push({ type: arrow.type, level: arrow.level || 1 });
    return true;
  }

  addToRunStashItem(item) {
    if (!this.runStash) this.runStash = { arrows: [], items: [] };
    this.runStash.items.push(item);
    return true;
  }

  /** Permanent keep: escape / victory. */
  commitRunStash() {
    const stash = this.runStash || { arrows: [], items: [] };
    for (const a of stash.arrows || []) {
      if (!this.quiver.isWoodType(a.type)) this.quiver.addToStorage(a);
    }
    if (!this.state.ownedItems) this.state.ownedItems = [];
    for (const it of stash.items || []) {
      if (it.kind === "potion" && it.itemId) {
        // Potions are consumable instances, so duplicate IDs are meaningful.
        this.state.ownedItems.push(it.itemId);
        const pouch = this.state.pouch || [];
        const empty = pouch.findIndex((s) => !s);
        if (empty >= 0) this.state.pouch[empty] = it.itemId;
      } else if (it.itemId) {
        if (!this.state.ownedItems.includes(it.itemId)) this.state.ownedItems.push(it.itemId);
      }
    }
    this.runStash = { arrows: [], items: [] };
  }

  /** Death: run stash is lost in the dark. */
  discardRunStash() {
    this.runStash = { arrows: [], items: [] };
  }

  /** Try quiver / pouch; overflow goes to run stash (not wood). */
  _collectLootPiece(piece) {
    if (!piece) return { status: "none" };
    if (piece.kind === "coins") {
      this.state.awardKillCoins(piece.amount || 0);
      return { status: "taken", label: piece.label };
    }
    if (piece.kind === "arrow") {
      const arrow = { type: piece.type || piece.arrow, level: piece.level || 1 };
      if (this.quiver.addToQuiver(arrow)) return { status: "quiver", label: piece.label };
      if (this.addToRunStashArrow(arrow)) return { status: "stash", label: piece.label };
      return { status: "lost", label: piece.label };
    }
    if (piece.kind === "potion") {
      const pouch = this.state.pouch || [];
      const empty = pouch.findIndex((s) => !s);
      if (empty >= 0) {
        if (!this.state.ownedItems) this.state.ownedItems = [];
        if (!this.state.ownedItems.includes(piece.itemId)) this.state.ownedItems.push(piece.itemId);
        this.state.pouch[empty] = piece.itemId;
        return { status: "pouch", label: piece.label };
      }
      this.addToRunStashItem({ kind: "potion", itemId: piece.itemId, label: piece.label });
      return { status: "stash", label: piece.label };
    }
    if (piece.kind === "trinket" || piece.kind === "gear") {
      this.addToRunStashItem({ kind: piece.kind, itemId: piece.itemId, label: piece.label });
      return { status: "stash", label: piece.label };
    }
    return { status: "none" };
  }

  _buildWaveReport(recovery) {
    const kills = [...(this.waveLootLog || [])];
    this.waveLootLog = [];
    const ground = rollGroundFind(this.floorIndex, this.elevatorIndex);
    const broken = (recovery?.broken || []).map((a) => {
      const def = getArrowDef(a.type);
      return {
        type: a.type,
        level: a.level || 1,
        label: (a.level || 1) > 1 ? `${def.name} Lv${a.level}` : def.name,
        reason: a.reason || "broke",
      };
    });
    return {
      kills,
      ground,
      broken,
      returned: recovery?.returned || [],
    };
  }

  _beginWaveLootSequence(nextAction) {
    const recovery = this._recoverArrows();
    if (this._waveCoinBonus) {
      this.state.awardKillCoins(this._waveCoinBonus);
      this._waveCoinBonus = 0;
    }
    this.pendingWaveReport = this._buildWaveReport(recovery);
    this._afterLootAction = nextAction;
    this._lootDelayT = 0.5;
    this.lootPending = false;
    this.movingForward = false;
    this.emit("wave_end", { wave: this.waveIndex });
  }

  /** Player closed the hall spoils panel — collect picks and resume approach. */
  acknowledgeWaveLoot() {
    if (!this.lootPending && this._lootDelayT < 0) return;
    this.lootPending = false;
    this._lootDelayT = -1;
    const report = this.pendingWaveReport;
    this.pendingWaveReport = null;
    if (report) {
      for (const k of report.kills || []) {
        if (k.drop) this._collectLootPiece(k.drop);
      }
      if (report.ground) this._collectLootPiece(report.ground);
    }
    this.emit("wave_loot_done", { report });
    const next = this._afterLootAction;
    this._afterLootAction = null;
    if (next === "elevator") this._beginApproachToElevator();
    else if (next === "victory") this.state.victory();
    else this._beginApproachToJunction();
  }

  /**
   * Discard a loaded quiver shaft into the run stash (confirm in UI).
   * Wood is destroyed — never stashed.
   */
  discardQuiverArrowToStash(quiverIndex) {
    const loaded = this.quiver.peekQuiver();
    if (quiverIndex < 0 || quiverIndex >= loaded.length) return { ok: false };
    const arrow = loaded[quiverIndex];
    if (this.quiver.isWoodType(arrow.type)) {
      // Snap wood shafts — they are never stored.
      if (quiverIndex < this.quiver.queue.length) this.quiver.queue.splice(quiverIndex, 1);
      else this.quiver.deck.splice(quiverIndex - this.quiver.queue.length, 1);
      return { ok: true, destroyed: true, arrow };
    }
    if (quiverIndex < this.quiver.queue.length) this.quiver.queue.splice(quiverIndex, 1);
    else this.quiver.deck.splice(quiverIndex - this.quiver.queue.length, 1);
    this.addToRunStashArrow(arrow);
    return { ok: true, destroyed: false, arrow };
  }

  discardPouchToStash(slotIndex) {
    const pouch = this.state.pouch || [];
    const id = pouch[slotIndex];
    if (!id) return { ok: false };
    this.state.pouch[slotIndex] = null;
    const label = POTION_LABELS[id] || id;
    this.addToRunStashItem({ kind: "potion", itemId: id, label });
    return { ok: true, itemId: id };
  }

  /**
   * Keep foes in the fight band without collapsing them into a center column.
   * Off-axis bodies still cannot walk past the player.
   */
  _clampToFightLane(e, relDist, dt) {
    const px = this.playerWorldX;
    const close = Math.max(0, Math.min(1, 1 - (relDist - 28) / 280));
    const maxOff = FIGHT_LANE * (1.15 - close * 0.35) + 4;
    const dx = e.x - px;
    if (Math.abs(dx) > maxOff) {
      const pull = Math.abs(dx) - maxOff;
      e.x -= Math.sign(dx) * Math.min(pull, (10 + close * 40) * dt);
    }
    e.x = Math.max(-FIGHT_LANE * 1.15, Math.min(FIGHT_LANE * 1.15, e.x));

    if (e.flying) return;

    const off = Math.abs(e.x - px);
    const floor = off > 24 ? 40 : 16;
    if (e.worldZ < this.playerWorldZ + floor) {
      e.worldZ = this.playerWorldZ + floor;
    }
  }

  /** Nudge overlapping foes apart so packs don't stack into one column. */
  _separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(a.worldZ - b.worldZ) > 80) continue;
        const dx = a.x - b.x;
        const minSep = Math.max(14, (enemyHitWidth(a) + enemyHitWidth(b)) * 0.28);
        if (Math.abs(dx) >= minSep) continue;
        const push = (minSep - Math.abs(dx)) * 0.5 + 0.8;
        const dir = dx === 0 ? (a.id > b.id ? 1 : -1) : Math.sign(dx);
        a.x += dir * push * 0.5;
        b.x -= dir * push * 0.5;
        if (a._laneX != null) a._laneX = a.x;
        if (b._laneX != null) b._laneX = b.x;
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
        if (p._hitIds && p._hitIds.includes(e.id)) continue;
        const halfW = enemyHitWidth(e) * 0.58;
        const halfD = Math.max(8, halfW * 0.72);
        const dx = p.x - e.x;
        const ddist = relDist - e.dist;
        if (Math.abs(dx) > halfW || Math.abs(ddist) > halfD) continue;
        {
          if (!p._hitIds) p._hitIds = [];
          p._hitIds.push(e.id);
          const armored = e.armor === "heavy" || e.armor === "insulated";
          const raw = this._calcDamage(p, e, { punchArmour: !!(p.punchArmour && armored) });
          if (this.state.phase !== "run") {
            this.projectiles.splice(i, 1);
            return;
          }
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
          // Piercing: through unarmoured (continue) OR punch armour and stop.
          if (p.punchArmour && armored) {
            p.pierceLeft = 0;
          } else {
            p.pierceLeft = (p.pierceLeft || 1) - 1;
          }
          if (p.pierceLeft <= 0) this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  _calcDamage(proj, enemy, opts = {}) {
    let phys = proj.damage;
    let fire = proj.fireDamage || 0;
    let frost = proj.iceDamage || 0;
    const el = proj.element;
    const def = getArrowDef(el);
    if (def.vsUndead && /skeleton|ghoul|wight|wraith|lich|vampire/.test(enemy.type || "")) {
      phys *= def.vsUndead;
      fire *= def.vsUndead;
      frost *= def.vsUndead;
    }
    if (def.vsEnergy && enemy.armor === "energy") {
      phys *= def.vsEnergy;
    }
    const soft = !def.hardTip && (el === "wood" || el === "flint" || el === "normal" || el === "kinetic"
      || el === "fire" || el === "ice" || el === "poison" || el === "oil" || el === "stun"
      || el === "double" || el === "barbed");
    // Soft shafts half vs heavy — unless this is a pierce armour-punch.
    if (enemy.armor === "heavy" && soft && !opts.punchArmour) phys *= 0.5;
    else if (enemy.armor === "heavy" && el === "iron" && !opts.punchArmour) phys *= 0.85;
    if (enemy.armor === "insulated") {
      fire *= 0.45;
      if (el === "shock") phys *= 0.55;
    }
    if (enemy.armor === "energy" && !def.vsEnergy) {
      phys *= 0.7;
      if (proj.ownerId === "player") this.state.damagePlayer(Math.floor(proj.damage * 0.25));
    }
    if (enemy.shredT > 0) phys = Math.max(phys, proj.damage);
    if (proj.ownerId === "player") {
      const str = this.state.getStrengthBonus();
      phys += str;
      fire = fire > 0 ? fire + str * 0.35 : 0;
      frost = frost > 0 ? frost + str * 0.25 : 0;
      const mult = this.state.runBonuses.damageMultiplier || 1;
      phys *= mult;
      fire *= mult;
      frost *= mult;
      if (Math.random() < this.state.getCritChance()) {
        const crit = this.state.getCritMultiplier();
        phys *= crit;
        fire *= crit;
        frost *= crit;
      }
    }
    return Math.max(1, Math.floor(phys + fire + frost));
  }

  _applyStatus(proj, e) {
    const el = proj.element;
    const def = getArrowDef(el);
    if (el === "fire") {
      if (e.slowT > 0) { e.slowT = 0; e.slowFactor = 0.4; }
      const oiled = e.oiledT > 0;
      if (oiled) {
        e.oiledT = 0;
        e.burnT = Math.max(e.burnT, (def.burn || 3) + 2.5);
        e.burnDps = Math.max(e.burnDps || 0, (def.burnDps || 3) + 2);
        e.hp -= 5; // flash ignition
      } else {
        e.burnT = Math.max(e.burnT, def.burn || 3.5);
        e.burnDps = Math.max(e.burnDps || 0, def.burnDps || 3);
      }
    } else if (el === "ice" || el === "frost") {
      if (e.burnT > 0) { e.burnT = 0; e.burnDps = 0; }
      e.slowT = Math.max(e.slowT, def.slow || 3.2);
      e.slowFactor = Math.min(e.slowFactor || 1, def.slowFactor || 0.32);
    } else if (el === "poison") {
      e.poisonT = Math.max(e.poisonT, def.poison || 4);
      e.poisonDps = Math.max(e.poisonDps || 0, def.poisonDps || 2.4);
    } else if (el === "oil") {
      e.oiledT = Math.max(e.oiledT, 6.5);
    } else if (el === "acid") {
      e.shredT = Math.max(e.shredT, 3);
    } else if (el === "barbed") {
      e.bleedT = Math.max(e.bleedT, def.bleed || 4);
      e.bleedDps = Math.max(e.bleedDps || 0, def.bleedDps || 2);
    } else if (el === "stun" || el === "shock") {
      e._hitStun = Math.max(e._hitStun || 0, def.stun || 0.7);
      e._charging = false;
    }
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
        if (this.state.phase !== "run") return;
      }
    }
  }

  // ─── Auto-Magic ──────────────────────────────────────────

  _tickAutoMagic() {
    // Hexes/prayers stay dormant until unlock() — skip the scan when nothing is live.
    if (!this.autoMagic?.hexes?.some((h) => h.unlocked) && !this.autoMagic?.prayers?.some((p) => p.unlocked)) {
      return;
    }
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
      case "coin_multiplier": this.state.activateCoinMultiplier(2, def.duration); break;
      case "damage_boost":    this.state.activateDamageBoost(1.5, def.duration); break;
      case "instant_burst":   this.state.activateInstantBurst(3); break;
    }
  }

  // ─── Arrow Firing ────────────────────────────────────────

  /**
   * Tap a foe that is already in your face (and preferably off to the side)
   * to stab with the equipped dagger. Very short range only.
   * @param {number} cssX
   * @param {number} cssY
   * @param {(worldX:number, dist:number) => {x:number,y:number,s?:number}} projectFn
   */
  tryDaggerAt(cssX, cssY, projectFn) {
    if (this.lootPending || this._lootDelayT > 0) return false;
    if (this.junctionPending || this.turning || this._forwardCommit || this._approachingJunction || this._approachingElevator) return false;
    if (this.state.phase !== "run") return false;
    if (!this.state.equipped?.dagger) return false;
    if ((this.state.daggerCooldown || 0) > 0) return false;
    if (typeof projectFn !== "function") return false;

    const MELEE_DIST = 44;
    const MELEE_LAT = 58;
    let best = null;
    let bestScore = Infinity;

    for (const e of this.enemies) {
      const dist = e.worldZ - this.playerWorldZ;
      if (dist < 6 || dist > MELEE_DIST) continue;
      const dx = Math.abs(e.x - this.playerWorldX);
      if (dx > MELEE_LAT) continue;
      // Prefer side targets; dead-center only if extremely close.
      if (dx < 10 && dist > 28) continue;

      const p = projectFn(e.x, dist);
      if (!p) continue;
      const sd = Math.hypot((p.x || 0) - cssX, (p.y || 0) - cssY);
      const hitR = Math.max(36, 26 * (p.s || 1));
      if (sd > hitR) continue;
      if (sd < bestScore) {
        bestScore = sd;
        best = e;
      }
    }
    if (!best) return false;

    const raw = this.state.getDaggerDamage();
    let dmg = raw;
    if (best.shieldHp > 0) {
      const absorbed = Math.min(best.shieldHp, dmg);
      best.shieldHp -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) best.hp -= dmg;
    best._hitFlash = 1;
    best._hitStun = Math.max(best._hitStun || 0, 0.18);
    best._squash = 1;
    best.worldZ += 10;
    best.x += Math.sign(best.x - this.playerWorldX || 1) * 5;
    this.hitStop = Math.max(this.hitStop, 0.055);
    this.state.daggerCooldown = this.state.getDaggerCooldown();
    const relDist = best.worldZ - this.playerWorldZ;
    this.emit("dagger_hit", { enemy: best, x: best.x, dist: relDist, damage: raw });
    if (best.hp <= 0) {
      const idx = this.enemies.indexOf(best);
      if (idx >= 0) this._killEnemy(best, idx, ENEMY_DEFS[best.type], relDist);
    }
    return true;
  }

  fireArrow(trajectory) {
    if (this.lootPending || this._lootDelayT > 0) return null;
    if (this.junctionPending || this.turning || this._forwardCommit || this._approachingJunction || this._approachingElevator) return null;
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
      dmg, arrow.type, "player",
      arrow.level
    );
    this.projectiles.push(proj);
    this.emit("arrow_fire", { arrow, projectile: proj });
    if (arrow.type === "double") {
      this.projectiles.push(createProjectile(
        this.playerWorldX, this.playerWorldZ + 18,
        vx * 1.08 + 18, vz * 0.96,
        Math.max(1, Math.floor(dmg * 0.9)), "wood", "player",
        arrow.level
      ));
    }

    if (this.state.consumeBurst()) {
      this._pendingBurst = { t: 0.08, vx: vx * 1.1, vz: vz * 1.1, level: arrow.level };
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
  destroy() {
    this.running = false;
    this.elevatorCheckpointPending = false;
    this._pendingElevatorTarget = null;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
  }
}
