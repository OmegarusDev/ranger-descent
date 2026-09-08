/**
 * GameStateManager — controls state transitions between Hub Phase,
 * Run Phase, and Death/Victory Phase. Manages coin currency and
 * upgrade trees. No rendering dependencies.
 */

export const PHASES = {
  HUB: "hub",
  RUN: "run",
  DEATH: "death",
  VICTORY: "victory",
};

export const STAT_INFO = [
  { id: "vigor", name: "Vigor", desc: "Raises maximum HP." },
  { id: "endurance", name: "Endurance", desc: "Lowers arrow cooldown and raises max equip load." },
  { id: "strength", name: "Strength", desc: "Raises arrow damage." },
  { id: "dexterity", name: "Dexterity", desc: "Raises crit damage. Slightly lowers arrow cooldown." },
  { id: "luck", name: "Luck", desc: "Raises crit chance, coin drops, shop finds, and arrow return." },
];

const STAT_MAX = {
  vigor: 20, endurance: 20, strength: 20, dexterity: 20, luck: 20,
};

function migrateStats(raw) {
  const u = raw || {};
  const clamp = (n) => Math.max(1, Math.min(20, Math.floor(Number(n) || 1)));
  if (u.vigor || u.endurance || u.strength || u.dexterity || u.luck) {
    return {
      vigor: clamp(u.vigor || 1),
      endurance: clamp(u.endurance || 1),
      strength: clamp(u.strength || 1),
      dexterity: clamp(u.dexterity || 1),
      luck: clamp(u.luck || 1),
      hexUnlock: [...(u.hexUnlock || [])],
      prayerUnlock: [...(u.prayerUnlock || [])],
    };
  }
  return {
    vigor: clamp(1 + (u.maxHp || 0)),
    endurance: clamp(1 + (u.attackSpeed || 0)),
    strength: clamp(1 + (u.arrowDamage || 0)),
    dexterity: 1,
    luck: clamp(1 + Math.max(u.critChance || 0, u.lootChance || 0)),
    hexUnlock: [...(u.hexUnlock || [])],
    prayerUnlock: [...(u.prayerUnlock || [])],
  };
}

  /** Resolve quiver capacity from an equipped item id (shared with shop UI). */
export function quiverCapacityFromId(id) {
  if (!id) return 10;
  if (id === "quiver_basic" || id === "quiver_8") return 10;
  if (id === "quiver_small") return 12;
  if (id === "quiver_medium") return 16;
  if (id === "quiver_large") return 20;
  const m = /^quiver_(\d+)$/.exec(id);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return Math.max(10, Math.min(30, n === 8 ? 10 : n));
  }
  return 10;
}

export class GameStateManager {
  constructor() {
    this.phase = PHASES.HUB;
    this.souls = 0;
    this.totalSoulsEarned = 0;
    this.runDistance = 0;
    this.enemiesKilled = 0;
    this.arrowsFired = 0;
    this.runSouls = 0;

    // Persistent stats (between runs). All start at 1.
    this.upgrades = {
      vigor: 1,
      endurance: 1,
      strength: 1,
      dexterity: 1,
      luck: 1,
      hexUnlock: [],
      prayerUnlock: [],
    };

    // Equipment
    this.equipped = {};
    this.ownedItems = [];
    this.pouch = [null, null];
    this.pouchCapacity = 2;
    this.hubVisits = 0;
    /** Highest start elevator unlocked (0 = Gate only; 1–9 = E1–E9 after riding to floor 11+). */
    this.maxElevatorUnlocked = 0;
    /** Selected hub start elevator index (0 = Gate). */
    this.selectedStartElevator = 0;
    /**
     * Arrow-craft notebooks found (elevator indices). Rank = count:
     * 0 → wood filler, 1 → flint, 2 → iron, …
     */
    this.notebookElevators = [];

    // Active run bonuses
    this.runBonuses = {
      soulMultiplier: 1,
      damageMultiplier: 1,
      damageBoostT: 0,
      soulBoostT: 0,
      shieldActive: false,
      shieldHp: 0,
      instantBurst: 0,
    };

    // Current run state
    this.runActive = false;
    this.playerZ = 0;
    this.playerX = 0;
    this.runSpeed = 0;
    this.playerHp = 10;
    this.playerMaxHp = 10;
    this.arrowCooldown = 0;
    this.daggerCooldown = 0;
    this.armorRating = 0;
    this.equipLoad = 0;

    // Callbacks
    this.onPhaseChange = null;
    this.onSoulsChange = null;
    this.onDeath = null;
    this.onVictory = null;
  }

  /** Transition to Hub Phase. */
  enterHub() {
    this.phase = PHASES.HUB;
    this.runActive = false;
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Start a new run. */
  startRun() {
    this.phase = PHASES.RUN;
    this.runActive = true;
    this.runDistance = 0;
    this.enemiesKilled = 0;
    this.arrowsFired = 0;
    this.runSouls = 0;
    this.playerZ = 0;
    this.playerX = 0;
    this.runSpeed = 0;
    this.playerHp = this.playerMaxHp;
    this.playerPoisonT = 0;
    this.playerPoisonDps = 0;
    this.runBonuses = {
      soulMultiplier: 1,
      damageMultiplier: 1,
      damageBoostT: 0,
      soulBoostT: 0,
      shieldActive: false,
      shieldHp: 0,
      instantBurst: 0,
    };
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Player dies — transition to Death Phase. */
  die() {
    if (this.phase === PHASES.DEATH || this.phase === PHASES.VICTORY) return;
    this.phase = PHASES.DEATH;
    this.runActive = false;
    if (this.onDeath) this.onDeath(this.getRunStats());
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Player reaches the end — transition to Victory Phase. */
  victory() {
    if (this.phase === PHASES.DEATH || this.phase === PHASES.VICTORY) return;
    this.phase = PHASES.VICTORY;
    this.runActive = false;
    if (this.onVictory) this.onVictory(this.getRunStats());
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Award coin for a kill using that enemy's tier value. */
  awardKillSouls(amount) {
    const n = Math.max(0, Math.floor((amount || 0) * (this.runBonuses.soulMultiplier || 1) * this.getLootMultiplier()));
    this.runSouls += n;
    if (this.onSoulsChange) this.onSoulsChange(this.runSouls);
    return n;
  }

  /** Bank this run's purse into permanent coin (escape / elevator). */
  bankSouls() {
    const earned = this.runSouls || 0;
    this.souls += earned;
    this.totalSoulsEarned += earned;
    this.runSouls = 0;
    if (this.onSoulsChange) this.onSoulsChange(this.souls);
    return earned;
  }

  /**
   * Death: keep 20% of the unbanked purse (banked into permanent coin), lose 80%.
   * Already-banked coin is untouched.
   * @returns {{ kept: number, lost: number, purse: number }}
   */
  discardRunSouls() {
    const purse = this.runSouls || 0;
    const kept = Math.floor(purse * 0.2);
    const lost = purse - kept;
    this.runSouls = 0;
    if (kept > 0) {
      this.souls += kept;
      this.totalSoulsEarned += kept;
    }
    if (this.onSoulsChange) this.onSoulsChange(this.souls);
    return { kept, lost, purse };
  }

  /** Spend coin on an upgrade. Returns true if successful. */
  spendSouls(amount) {
    if (this.souls < amount) return false;
    this.souls -= amount;
    if (this.onSoulsChange) this.onSoulsChange(this.souls);
    return true;
  }

  /** Get the current run statistics. */
  getRunStats() {
    return {
      distance: Math.floor(this.runDistance),
      enemiesKilled: this.enemiesKilled,
      arrowsFired: this.arrowsFired,
      soulsEarned: this.runSouls || 0,
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
    };
  }

  /** Apply damage to the player. Returns remaining HP. */
  damagePlayer(amount) {
    if (this.runBonuses.shieldActive && this.runBonuses.shieldHp > 0) {
      const absorbed = Math.min(this.runBonuses.shieldHp, amount);
      this.runBonuses.shieldHp -= absorbed;
      amount -= absorbed;
      if (this.runBonuses.shieldHp <= 0) {
        this.runBonuses.shieldActive = false;
      }
    }
    if (amount > 0 && this.armorRating > 0) {
      amount = Math.max(1, amount - Math.floor(this.armorRating / 4));
    }
    this.playerHp = Math.max(0, this.playerHp - amount);
    if (this.playerHp <= 0) this.die();
    return this.playerHp;
  }

  /** Contact venom — stacks duration, ticks in tickBonuses. */
  applyPlayerPoison(stacks = 1) {
    const n = Math.max(1, Math.floor(stacks || 1));
    this.playerPoisonT = Math.max(this.playerPoisonT || 0, 2.2 + n * 0.8);
    this.playerPoisonDps = Math.max(this.playerPoisonDps || 0, 1.2 + n * 0.6);
  }

  /** Heal the player. */
  healPlayer(amount) {
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + amount);
  }

  /** Activate shield (from Prayer of Sanctuary). */
  activateShield(hp) {
    this.runBonuses.shieldActive = true;
    this.runBonuses.shieldHp = hp;
  }

  /** Activate damage boost (from Prayer of Fortify). */
  activateDamageBoost(multiplier, duration) {
    this.runBonuses.damageMultiplier = multiplier;
    this.runBonuses.damageBoostT = duration || 0;
  }

  /** Activate soul multiplier (from Prayer of Harvest). */
  activateSoulMultiplier(multiplier, duration) {
    this.runBonuses.soulMultiplier = multiplier;
    this.runBonuses.soulBoostT = duration || 0;
  }

  tickBonuses(dt) {
    if (this.runBonuses.damageBoostT > 0) {
      this.runBonuses.damageBoostT -= dt;
      if (this.runBonuses.damageBoostT <= 0) this.runBonuses.damageMultiplier = 1;
    }
    if (this.runBonuses.soulBoostT > 0) {
      this.runBonuses.soulBoostT -= dt;
      if (this.runBonuses.soulBoostT <= 0) this.runBonuses.soulMultiplier = 1;
    }
    if ((this.playerPoisonT || 0) > 0) {
      this.playerPoisonT -= dt;
      // Direct HP — do not go through damagePlayer (armor would floor microticks to 1).
      this.playerHp = Math.max(0, this.playerHp - (this.playerPoisonDps || 1.5) * dt);
      if (this.playerHp <= 0) this.die();
      if (this.playerPoisonT <= 0) {
        this.playerPoisonT = 0;
        this.playerPoisonDps = 0;
      }
    }
  }

  /** Activate instant burst (from Prayer of Quicksilver). */
  activateInstantBurst(count) {
    this.runBonuses.instantBurst = count;
  }

  /** Consume one instant burst charge. Returns true if bursts remain. */
  consumeBurst() {
    if (this.runBonuses.instantBurst > 0) {
      this.runBonuses.instantBurst--;
      return true;
    }
    return false;
  }

  getStat(id) {
    const n = Number(this.upgrades[id]);
    if (!Number.isFinite(n) || n < 1) return 1;
    const max = STAT_MAX[id] || 20;
    return Math.min(max, Math.floor(n));
  }

  isUpgradeMaxed(upgradeId) {
    return this.getStat(upgradeId) >= (STAT_MAX[upgradeId] || 20);
  }

  /** Purchases made since the starter ranger (all stats at 1). */
  getSpentLevels() {
    return STAT_INFO.reduce((sum, s) => sum + this.getStat(s.id), 0) - STAT_INFO.length;
  }

  /** Starter is level 1. Each trained point is a character level. */
  getCharacterLevel() {
    return 1 + Math.max(0, this.getSpentLevels());
  }

  /** First level-up costs 5. Each later one is 30% more, rounded. */
  getUpgradeCost() {
    let cost = 5;
    const spent = Math.max(0, this.getSpentLevels());
    for (let i = 0; i < spent; i++) cost = Math.round(cost * 1.3);
    return Math.max(1, cost);
  }

  buyUpgrade(upgradeId) {
    if (!STAT_MAX[upgradeId]) return false;
    if (this.isUpgradeMaxed(upgradeId)) return false;
    const cost = this.getUpgradeCost();
    if (!this.spendSouls(cost)) return false;
    this.upgrades[upgradeId] = this.getStat(upgradeId) + 1;
    this.applyUpgrades();
    return true;
  }

  /** Strength adds flat damage. Vigor 1 / Strength 1 is the starter ranger. */
  getStrengthBonus() {
    return this.getStat("strength") - 1;
  }

  /** Luck: 5% at 1, about 43% at 20. */
  getCritChance() {
    return Math.min(0.45, 0.03 + this.getStat("luck") * 0.02);
  }

  /** Dexterity: 1.6× at 1, 3.5× at 20. */
  getCritMultiplier() {
    return 1.5 + this.getStat("dexterity") * 0.1;
  }

  getLootMultiplier() {
    return 1 + this.getStat("luck") * 0.02;
  }

  getMaxEquipLoad() {
    return 6 + this.getStat("endurance") * 2;
  }

  isOverEncumbered() {
    return (this.equipLoad || 0) > this.getMaxEquipLoad();
  }

  /** Endurance is the bulk of cooldown; Dexterity shaves a little. Fat load slows shots. */
  getArrowCooldown() {
    const end = this.getStat("endurance");
    const dex = this.getStat("dexterity");
    let cd = 0.82 - end * 0.022 - dex * 0.008;
    const maxLoad = this.getMaxEquipLoad();
    const load = this.equipLoad || 0;
    if (maxLoad > 0 && load > maxLoad) {
      cd *= load >= maxLoad * 1.5 ? 1.8 : 1.35;
    }
    return Math.max(0.2, cd);
  }

  /** Close-work stab — a bit snappier than a full draw. */
  getDaggerCooldown() {
    const dex = this.getStat("dexterity");
    return Math.max(0.35, 0.62 - dex * 0.012);
  }

  getDaggerDamage() {
    return 2 + this.getStrengthBonus();
  }

  /** Base 90% at Luck 1; +0.5% per point, cap 99%. */
  getArrowReturnChance() {
    const luck = this.getStat("luck");
    return Math.min(0.99, 0.90 + (luck - 1) * 0.005);
  }

  getQuiverCapacity() {
    return quiverCapacityFromId(this.equipped?.quiver);
  }

  applyUpgrades() {
    this.playerMaxHp = 8 + this.getStat("vigor") * 2;
    if (this.equipped?.amulet === "amulet_greenhorn") this.playerMaxHp += 2;
    this.playerHp = this.playerMaxHp;
    this.arrowCooldown = 0;
    this.daggerCooldown = 0;
  }

  /** Unlock starting from this elevator index (1–9 = E1–E9). Gate is always available. */
  unlockElevator(index) {
    const maxStart = 9;
    const i = Math.max(0, Math.min(maxStart, Math.floor(index || 0)));
    if (i > this.maxElevatorUnlocked) this.maxElevatorUnlocked = i;
    return this.maxElevatorUnlocked;
  }

  getMaxElevatorUnlocked() {
    return Math.max(0, this.maxElevatorUnlocked || 0);
  }

  setStartElevator(index) {
    const max = this.getMaxElevatorUnlocked();
    const i = Math.max(0, Math.min(max, Math.floor(index || 0)));
    this.selectedStartElevator = i;
    return i;
  }

  getStartElevator() {
    const max = this.getMaxElevatorUnlocked();
    const sel = this.selectedStartElevator || 0;
    return Math.max(0, Math.min(max, sel));
  }

  /** How many craft notebooks you've found (0 = wood only). */
  getArrowCraftRank() {
    return Math.max(0, (this.notebookElevators || []).length);
  }

  /** Filler shaft type for empty quiver slots after a wipe / hub rest. */
  getCraftFillerType() {
    const ladder = ["wood", "flint", "iron", "steel"];
    const rank = Math.min(ladder.length - 1, this.getArrowCraftRank());
    return ladder[rank] || "wood";
  }

  /**
   * Discover a craft notebook on floor 9 of this elevator block (once per block).
   * @returns {{ unlocked: boolean, filler: string, elevatorIndex: number } | null}
   */
  discoverNotebook(elevatorIndex) {
    if (!this.notebookElevators) this.notebookElevators = [];
    const el = Math.max(0, elevatorIndex | 0);
    if (this.notebookElevators.includes(el)) return null;
    this.notebookElevators.push(el);
    return {
      unlocked: true,
      filler: this.getCraftFillerType(),
      elevatorIndex: el,
      rank: this.getArrowCraftRank(),
    };
  }

  /** Serialize for save/load. */
  serialize() {
    return {
      phase: this.phase,
      souls: this.souls,
      totalSoulsEarned: this.totalSoulsEarned,
      upgrades: { ...this.upgrades },
      equipped: { ...this.equipped },
      ownedItems: [...(this.ownedItems || [])],
      pouch: [...(this.pouch || [null, null])],
      pouchCapacity: this.pouchCapacity || 2,
      playerMaxHp: this.playerMaxHp,
      hubVisits: this.hubVisits,
      maxElevatorUnlocked: this.maxElevatorUnlocked || 0,
      selectedStartElevator: this.getStartElevator(),
      notebookElevators: [...(this.notebookElevators || [])],
    };
  }

  deserialize(data) {
    if (!data) return;
    this.phase = PHASES.HUB;
    this.souls = data.souls || 0;
    this.totalSoulsEarned = data.totalSoulsEarned || 0;
    this.upgrades = migrateStats(data.upgrades);
    this.equipped = { ...(data.equipped || {}) };
    this.ownedItems = [...(data.ownedItems || [])];
    // Ignore legacy data.arrowStorage — quiver.storage is the real chest.
    this.pouch = [...(data.pouch || [null, null])];
    while (this.pouch.length < 2) this.pouch.push(null);
    this.pouchCapacity = data.pouchCapacity || 2;
    this.hubVisits = data.hubVisits || 0;
    this.maxElevatorUnlocked = Math.max(0, data.maxElevatorUnlocked || 0);
    this.selectedStartElevator = data.selectedStartElevator || 0;
    this.notebookElevators = Array.isArray(data.notebookElevators)
      ? data.notebookElevators.map((n) => Math.max(0, n | 0))
      : [];
    this.setStartElevator(this.selectedStartElevator);
    this.applyUpgrades();
  }
}
