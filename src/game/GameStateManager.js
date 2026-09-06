/**
 * GameStateManager — controls state transitions between Hub Phase,
 * Run Phase, and Death/Victory Phase. Manages Soul currency and
 * upgrade trees. No rendering dependencies.
 */

export const PHASES = {
  HUB: "hub",
  RUN: "run",
  DEATH: "death",
  VICTORY: "victory",
};

export class GameStateManager {
  constructor() {
    this.phase = PHASES.HUB;
    this.souls = 0;
    this.totalSoulsEarned = 0;
    this.runDistance = 0;
    this.enemiesKilled = 0;
    this.arrowsFired = 0;

    // Persistent upgrades (between runs)
    this.upgrades = {
      arrowDamage: 0,
      attackSpeed: 0,
      maxHp: 0,
      critChance: 0,
      lootChance: 0,
      hexUnlock: [],
      prayerUnlock: [],
    };

    // Equipment
    this.equipped = {};
    this.ownedItems = [];
    this.arrowStorage = [];
    this.hubVisits = 0;

    // Active run bonuses
    this.runBonuses = {
      soulMultiplier: 1,
      damageMultiplier: 1,
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
    this.playerZ = 0;
    this.playerX = 0;
    this.runSpeed = 0;
    this.playerHp = this.playerMaxHp;
    this.runBonuses = {
      soulMultiplier: 1,
      damageMultiplier: 1,
      shieldActive: false,
      shieldHp: 0,
      instantBurst: 0,
    };
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Player dies — transition to Death Phase. */
  die() {
    this.phase = PHASES.DEATH;
    this.runActive = false;
    if (this.onDeath) this.onDeath(this.getRunStats());
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Player reaches the end — transition to Victory Phase. */
  victory() {
    this.phase = PHASES.VICTORY;
    this.runActive = false;
    if (this.onVictory) this.onVictory(this.getRunStats());
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  /** Bank earned Souls (called on death/victory). */
  bankSouls() {
    const earned = Math.floor(this.enemiesKilled * this.runBonuses.soulMultiplier);
    this.souls += earned;
    this.totalSoulsEarned += earned;
    if (this.onSoulsChange) this.onSoulsChange(this.souls);
    return earned;
  }

  /** Spend souls on an upgrade. Returns true if successful. */
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
      soulsEarned: Math.floor(this.enemiesKilled * this.runBonuses.soulMultiplier),
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
    this.playerHp = Math.max(0, this.playerHp - amount);
    if (this.playerHp <= 0) this.die();
    return this.playerHp;
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
    // Duration handled by AutoMagicSystem
  }

  /** Activate soul multiplier (from Prayer of Harvest). */
  activateSoulMultiplier(multiplier, duration) {
    this.runBonuses.soulMultiplier = multiplier;
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

  /** Check if a specific upgrade is maxed. */
  isUpgradeMaxed(upgradeId) {
    const maxLevels = {
      arrowDamage: 5,
      attackSpeed: 5,
      maxHp: 5,
      critChance: 5,
      lootChance: 5,
    };
    return (this.upgrades[upgradeId] || 0) >= (maxLevels[upgradeId] || 0);
  }

  /** Get the cost of the next upgrade level. */
  getUpgradeCost(upgradeId) {
    const baseCosts = {
      arrowDamage: 15,
      attackSpeed: 20,
      maxHp: 20,
      critChance: 30,
      lootChance: 25,
    };
    const level = this.upgrades[upgradeId] || 0;
    return Math.floor((baseCosts[upgradeId] || 10) * (1.5 + level * 0.3));
  }

  /** Purchase an upgrade. Returns true if successful. */
  buyUpgrade(upgradeId) {
    if (this.isUpgradeMaxed(upgradeId)) return false;
    const cost = this.getUpgradeCost(upgradeId);
    if (!this.spendSouls(cost)) return false;
    this.upgrades[upgradeId] = (this.upgrades[upgradeId] || 0) + 1;
    return true;
  }

  /** Get arrow cooldown in seconds based on attack speed upgrade. */
  getArrowCooldown() {
    const level = this.upgrades.attackSpeed || 0;
    return Math.max(0.2, 0.8 - level * 0.1);
  }

  /** Get loot chance (arrow recovery) based on loot chance upgrade. */
  getLootChance() {
    const level = this.upgrades.lootChance || 0;
    return Math.min(1, 0.9 + level * 0.05);
  }

  /** Apply persistent upgrades to the current run. */
  applyUpgrades() {
    this.playerMaxHp = 10 + (this.upgrades.maxHp || 0) * 2;
    this.playerHp = this.playerMaxHp;
    this.arrowCooldown = 0;
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
      arrowStorage: [...(this.arrowStorage || [])],
      playerMaxHp: this.playerMaxHp,
      hubVisits: this.hubVisits,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.phase = data.phase || PHASES.HUB;
    this.souls = data.souls || 0;
    this.totalSoulsEarned = data.totalSoulsEarned || 0;
    this.upgrades = { ...this.upgrades, ...(data.upgrades || {}) };
    this.equipped = { ...(data.equipped || {}) };
    this.ownedItems = [...(data.ownedItems || [])];
    this.arrowStorage = [...(data.arrowStorage || [])];
    this.playerMaxHp = data.playerMaxHp || 10;
    this.hubVisits = data.hubVisits || 0;
  }
}
