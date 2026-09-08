import { CONFIG } from "../data/config.js";
import {
  getArrowDef,
  lootProgressScore, arrowLevelCapForProgress, rollArrowLevel,
} from "./QuiverDeckManager.js";

export const ENEMY_DEFS = {
  // coinMin/Max = purse drop on kill (₡).
  slime:          { hp: 5,   speed: 9,   size: 0.85, color: "#b84a55", coinMin: 1, coinMax: 3, armor: "none", contactDmg: 4 },
  slime_large:    { hp: 14,  speed: 7,   size: 1.3, color: "#c45a65", coinMin: 2, coinMax: 5, armor: "none", contactDmg: 6, splitTo: "slime", splitCount: 2 },
  slime_huge:     { hp: 28,  speed: 5,   size: 1.75, color: "#d46a75", coinMin: 4, coinMax: 8, armor: "none", contactDmg: 8, splitTo: "slime_large", splitCount: 2 },
  goblin_runt:    { hp: 7,   speed: 20,  size: 1.2, color: "#6aaa5a", coinMin: 1, coinMax: 7, armor: "none", contactDmg: 3 },
  goblin_warrior: { hp: 14,  speed: 16,  size: 1.5, color: "#5a9a4a", coinMin: 3, coinMax: 8, armor: "none", contactDmg: 5 },
  goblin_chieftain:{ hp: 22, speed: 13,  size: 2.0, color: "#4a8a3a", coinMin: 5, coinMax: 12, armor: "none", contactDmg: 7 },
  imp:            { hp: 8,   speed: 24,  size: 1.1, color: "#d4892a", coinMin: 1, coinMax: 4, armor: "none", contactDmg: 3 },
  scamp:          { hp: 12,  speed: 22,  size: 1.2, color: "#e0a030", coinMin: 2, coinMax: 6, armor: "none", contactDmg: 4 },
  demon:          { hp: 20,  speed: 16,  size: 1.8, color: "#c04040", coinMin: 4, coinMax: 10, armor: "none", contactDmg: 7 },
  skeleton:       { hp: 18,  speed: 11,  size: 2.1, color: "#c8c0b0", coinMin: 2, coinMax: 8, armor: "none", contactDmg: 7 },
  skeleton_archer:{ hp: 12,  speed: 12,  size: 1.8, color: "#b0a898", coinMin: 2, coinMax: 7, armor: "none", contactDmg: 4 },
  hauler:         { hp: 32,  speed: 8,   size: 2.4, color: "#8a96a0", coinMin: 5, coinMax: 12, armor: "heavy", contactDmg: 10 },
  ghoul:          { hp: 10,  speed: 15,  size: 1.4, color: "#7a6a5a", coinMin: 1, coinMax: 5, armor: "none", contactDmg: 4 },
  wight:          { hp: 16,  speed: 13,  size: 1.7, color: "#6a5a4a", coinMin: 2, coinMax: 7, armor: "none", contactDmg: 6 },
  wraith:         { hp: 12,  speed: 18,  size: 1.3, color: "#8a7ab8", coinMin: 2, coinMax: 8, armor: "energy", contactDmg: 5 },
  vampire:        { hp: 18,  speed: 17,  size: 1.5, color: "#a02020", coinMin: 3, coinMax: 9, armor: "none", contactDmg: 6, lifeSteal: true },
  vampire_lord:   { hp: 28,  speed: 19,  size: 2.0, color: "#801010", coinMin: 5, coinMax: 14, armor: "none", contactDmg: 8, lifeSteal: true },
  lich:           { hp: 22,  speed: 10,  size: 1.8, color: "#6040a0", coinMin: 4, coinMax: 11, armor: "none", summonRate: 5, contactDmg: 5 },
  bat:            { hp: 4,   speed: 28,  size: 0.6, color: "#4a3a5a", coinMin: 1, coinMax: 2, armor: "none", flying: true, contactDmg: 2, poison: 2 },
  spider:         { hp: 6,   speed: 20,  size: 0.9, color: "#5a4a3a", coinMin: 1, coinMax: 4, armor: "none", contactDmg: 3, poison: 1 },
  giant_spider:   { hp: 16,  speed: 16,  size: 1.5, color: "#4a3a2a", coinMin: 2, coinMax: 7, armor: "none", contactDmg: 5, poison: 3 },
  orc:            { hp: 18,  speed: 14,  size: 1.7, color: "#5a7a4a", coinMin: 3, coinMax: 9, armor: "none", contactDmg: 7 },
  ogre:           { hp: 28,  speed: 9,   size: 2.3, color: "#6a8a5a", coinMin: 5, coinMax: 12, armor: "heavy", contactDmg: 10 },
  troll:          { hp: 22,  speed: 12,  size: 2.0, color: "#4a6a3a", coinMin: 4, coinMax: 10, armor: "none", contactDmg: 8, regen: 2 },
  boss_grunt:     { hp: 200, speed: 10,  size: 3.3, color: "#c4305a", coinMin: 18, coinMax: 28, armor: "heavy", contactDmg: 12 },
  boss_warden:    { hp: 250, speed: 8,   size: 3.3, color: "#3d9a8e", coinMin: 22, coinMax: 34, armor: "insulated", shieldHp: 60, contactDmg: 10 },
  boss_wraith:    { hp: 180, speed: 14,  size: 3.0, color: "#c9a227", coinMin: 24, coinMax: 36, armor: "energy", contactDmg: 15 },
  boss_death_knight: { hp: 250, speed: 11, size: 3.6, color: "#2a2a3a", coinMin: 26, coinMax: 40, armor: "heavy", contactDmg: 15 },
  boss_lich_king: { hp: 300, speed: 8,  size: 3.3, color: "#4a2a6a", coinMin: 30, coinMax: 48, armor: "none", summonRate: 3, contactDmg: 10 },
  boss_spider_queen: { hp: 200, speed: 14, size: 3.0, color: "#3a2a1a", coinMin: 20, coinMax: 32, armor: "none", contactDmg: 12, poison: 5 },
};

/** Pretty name for loot lines. */
function enemyDisplayName(type) {
  return String(type || "foe").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Per-enemy drop tables. Chance is independent; most kills drop nothing but coins.
 * kind: arrow | potion | trinket
 */
const ENEMY_LOOT = {
  slime: [{ kind: "arrow", type: "flint", chance: 0.05 }],
  slime_large: [{ kind: "arrow", type: "flint", chance: 0.08 }, { kind: "potion", id: "potion_salve", chance: 0.04 }],
  slime_huge: [{ kind: "arrow", type: "iron", chance: 0.1 }, { kind: "potion", id: "potion_salve", chance: 0.08 }],
  goblin_runt: [{ kind: "arrow", type: "flint", chance: 0.1 }, { kind: "arrow", type: "poison", chance: 0.03 }],
  goblin_warrior: [
    { kind: "arrow", type: "iron", chance: 0.09 },
    { kind: "potion", id: "potion_bandage", chance: 0.06 },
    { kind: "trinket", id: "trinket_lucky_tooth", chance: 0.02 },
  ],
  goblin_chieftain: [
    { kind: "arrow", type: "steel", chance: 0.08 },
    { kind: "arrow", type: "piercing", chance: 0.07 },
    { kind: "potion", id: "potion_tonic", chance: 0.08 },
  ],
  imp: [{ kind: "arrow", type: "fire", chance: 0.1 }, { kind: "arrow", type: "oil", chance: 0.05 }],
  scamp: [{ kind: "arrow", type: "fire", chance: 0.08 }, { kind: "potion", id: "potion_salve", chance: 0.05 }],
  demon: [{ kind: "arrow", type: "fire", chance: 0.12 }, { kind: "arrow", type: "shock", chance: 0.05 }],
  skeleton: [{ kind: "arrow", type: "piercing", chance: 0.08 }, { kind: "arrow", type: "silver", chance: 0.04 }],
  skeleton_archer: [{ kind: "arrow", type: "piercing", chance: 0.14 }, { kind: "arrow", type: "double", chance: 0.06 }],
  hauler: [{ kind: "arrow", type: "steel", chance: 0.1 }, { kind: "potion", id: "potion_bandage", chance: 0.07 }],
  ghoul: [{ kind: "arrow", type: "barbed", chance: 0.07 }, { kind: "potion", id: "potion_tonic", chance: 0.05 }],
  wight: [{ kind: "arrow", type: "ice", chance: 0.08 }, { kind: "arrow", type: "silver", chance: 0.05 }],
  wraith: [{ kind: "arrow", type: "shock", chance: 0.09 }, { kind: "arrow", type: "silver", chance: 0.06 }],
  vampire: [{ kind: "arrow", type: "silver", chance: 0.1 }, { kind: "potion", id: "potion_salve", chance: 0.05 }],
  vampire_lord: [{ kind: "arrow", type: "silver", chance: 0.14 }, { kind: "trinket", id: "trinket_lucky_tooth", chance: 0.06 }],
  lich: [{ kind: "arrow", type: "ice", chance: 0.1 }, { kind: "arrow", type: "poison", chance: 0.08 }],
  bat: [{ kind: "arrow", type: "poison", chance: 0.04 }],
  spider: [{ kind: "arrow", type: "poison", chance: 0.08 }],
  giant_spider: [{ kind: "arrow", type: "poison", chance: 0.12 }, { kind: "potion", id: "potion_tonic", chance: 0.07 }],
  orc: [{ kind: "arrow", type: "iron", chance: 0.1 }, { kind: "arrow", type: "barbed", chance: 0.05 }],
  ogre: [{ kind: "arrow", type: "steel", chance: 0.1 }, { kind: "potion", id: "potion_bandage", chance: 0.08 }],
  troll: [{ kind: "arrow", type: "iron", chance: 0.09 }, { kind: "potion", id: "potion_salve", chance: 0.09 }],
  boss_grunt: [{ kind: "arrow", type: "steel", chance: 0.45 }, { kind: "potion", id: "potion_bandage", chance: 0.35 }],
  boss_warden: [{ kind: "arrow", type: "shock", chance: 0.4 }, { kind: "potion", id: "potion_tonic", chance: 0.3 }],
  boss_wraith: [{ kind: "arrow", type: "silver", chance: 0.45 }, { kind: "arrow", type: "ice", chance: 0.3 }],
  boss_death_knight: [{ kind: "arrow", type: "steel", chance: 0.4 }, { kind: "arrow", type: "piercing", chance: 0.35 }],
  boss_lich_king: [{ kind: "arrow", type: "ice", chance: 0.5 }, { kind: "trinket", id: "trinket_lucky_tooth", chance: 0.4 }],
  boss_spider_queen: [{ kind: "arrow", type: "poison", chance: 0.5 }, { kind: "potion", id: "potion_tonic", chance: 0.35 }],
};

export const POTION_LABELS = {
  potion_salve: "Herbal Remedy",
  potion_bandage: "Field Bandage",
  potion_tonic: "Clearing Tonic",
};

const TRINKET_LABELS = {
  trinket_lucky_tooth: "Lucky Tooth",
};

function rollEnemyItemDrop(type) {
  const table = ENEMY_LOOT[type];
  if (!table || !table.length) return null;
  for (const entry of table) {
    if (Math.random() >= (entry.chance || 0)) continue;
    if (entry.kind === "arrow") {
      return { kind: "arrow", type: entry.type, level: 1, label: getArrowDef(entry.type).name || entry.type };
    }
    if (entry.kind === "potion") {
      return { kind: "potion", itemId: entry.id, label: POTION_LABELS[entry.id] || entry.id };
    }
    if (entry.kind === "trinket") {
      return { kind: "trinket", itemId: entry.id, label: TRINKET_LABELS[entry.id] || entry.id };
    }
  }
  return null;
}

/** ~25% chance of a hall floor find after a clear. */
function rollGroundFind(floorIndex, elevatorIndex) {
  if (Math.random() >= 0.25) return null;
  const r = Math.random();
  if (r < 0.45) {
    const amount = 2 + Math.floor(Math.random() * 4) + Math.floor(floorIndex / 2) + elevatorIndex;
    return { kind: "coins", amount, label: `${amount} coin`, detail: "Loose purse on the stones." };
  }
  if (r < 0.8) {
    const arrows = ["flint", "fire", "ice", "poison", "piercing", "iron", "double"];
    const type = arrows[Math.floor(Math.random() * arrows.length)];
    const score = lootProgressScore(floorIndex, elevatorIndex);
    const cap = arrowLevelCapForProgress(score, { shop: false });
    const level = rollArrowLevel(Math.random, cap, { favorHigh: false });
    const def = getArrowDef(type);
    return {
      kind: "arrow",
      type,
      level,
      label: level > 1 ? `${def.name} Lv${level}` : def.name,
      detail: "A shaft kicked under a flagstone.",
    };
  }
  const pots = ["potion_salve", "potion_bandage", "potion_tonic"];
  const id = pots[Math.floor(Math.random() * pots.length)];
  return { kind: "potion", itemId: id, label: POTION_LABELS[id] || id, detail: "A vial half-buried in grit." };
}

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



/** Flat XZ hit size from silhouette width (no height / headshots). */
function enemyHitWidth(e) {
  const sz = e.size || 1;
  const type = e.type || "";
  const flying = !!(e.flying || e.behavior === "hover");
  let h;
  if (flying) h = 11 + sz * 5;
  else if (type.includes("slime")) h = 11 + sz * 8;
  else if (type.includes("spider")) h = 9 + sz * 6;
  else if (type.includes("boss")) h = 34 + sz * 5;
  else h = 20 + sz * 8;
  const aspect = flying ? 1.15 : type.includes("slime") ? 1.35 : 0.58;
  return h * aspect * 1.1;
}


function enemyFamily(type = "") {
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

function rollEnemyCoins(type) {
  const d = ENEMY_DEFS[type] || ENEMY_DEFS.slime;
  const lo = d.coinMin != null ? d.coinMin : 1;
  const hi = d.coinMax != null ? d.coinMax : lo;
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/**
 * Target total HP for a hall.
 * Gate curve: 5, 7, 10, 12, 14, 17, 19, 22, 24, then hall-10 spike (~28).
 * Higher floors / elevators add flat HP; F10 / last elevator spike further.
 */
function hallHpBudget(floorIndex, sectionIndex, elevatorIndex) {
  const elevs = CONFIG.ELEVATORS_PER_RUN || 10;
  const hallBase = [5, 7, 10, 12, 14, 17, 19, 22, 24, 28];
  const i = Math.max(0, Math.min(9, sectionIndex | 0));
  let hp = hallBase[i] + floorIndex * 9 + elevatorIndex * 14;
  if (sectionIndex >= 9) hp = Math.round(hp * 1.2);
  if (floorIndex >= 9) hp = Math.round(hp * 1.28);
  if (elevatorIndex >= elevs - 1) hp = Math.round(hp * 1.32);
  return Math.max(5, hp);
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

/**
 * Build a wave whose scaled HP is as close as possible to target.
 * DP over cheap units always finds a valid pack (never empty / never stuck).
 */
function composeWaveForHp(roster, targetHp, floorIndex, elevatorIndex, maxCount = 5) {
  const units = [];
  for (const t of roster) {
    const hp = enemyThreat(t, floorIndex, elevatorIndex);
    if (hp > 0) units.push({ t, hp });
  }
  units.sort((a, b) => a.hp - b.hp || a.t.localeCompare(b.t));
  const cheapest = units[0] || { t: "slime", hp: enemyThreat("slime", floorIndex, elevatorIndex) };
  const want = Math.max(cheapest.hp, targetHp | 0);
  const maxSum = want + cheapest.hp * 2;

  // dp[s] = shortest type list that sums to s
  const dp = new Array(maxSum + 1).fill(null);
  dp[0] = [];
  for (let s = 0; s <= maxSum; s++) {
    const cur = dp[s];
    if (!cur || cur.length >= maxCount) continue;
    for (const u of units) {
      const ns = s + u.hp;
      if (ns > maxSum) continue;
      const next = cur.length + 1;
      if (!dp[ns] || dp[ns].length > next) dp[ns] = cur.concat(u.t);
    }
  }

  let bestS = -1;
  let bestScore = Infinity;
  for (let s = cheapest.hp; s <= maxSum; s++) {
    if (!dp[s]) continue;
    const diff = Math.abs(s - want);
    // Prefer exact, then slight overshoot, then undershoot; fewer foes on ties.
    const score = diff * 10 + (s < want ? 3 : 0) + dp[s].length * 0.01;
    if (score < bestScore) {
      bestScore = score;
      bestS = s;
    }
  }

  const types = bestS > 0 ? dp[bestS] : [cheapest.t];
  const threat = types.reduce((sum, t) => sum + enemyThreat(t, floorIndex, elevatorIndex), 0);
  return { groups: packIntoGroups(types), threat, enemyTypes: [...new Set(types)], hp: threat };
}

export {
  BEHAVIOR_MAP,
  scaleEnemyHp,
  enemyHitWidth,
  enemyFamily,
  enemyThreat,
  rollEnemyCoins,
  rollEnemyItemDrop,
  rollGroundFind,
  hallHpBudget,
  packIntoGroups,
  composeWaveForHp,
  enemyDisplayName,
};

