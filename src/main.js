/**
 * main.js — Entry point. Wires DungeonView, CorridorSim, InputHandler.
 */
import { RenderEngine2D5 } from "./engine/RenderEngine2D5.js?v=28";
import { DungeonView } from "./engine/DungeonView.js?v=33";
import { withAlpha } from "./engine/drawUtil.js";
import { CorridorSim } from "./game/CorridorSim.js?v=38";
import { InputHandler } from "./game/InputHandler.js?v=14";
import { CONFIG } from "./data/config.js?v=26";
import { rollShopArrows, getShopArrowCatalog, getArrowDef, arrowShort } from "./game/QuiverDeckManager.js?v=29";
import { STAT_INFO } from "./game/GameStateManager.js?v=31";

// ─── Bootstrap ────────────────────────────────────────────────
const canvas = document.getElementById("game");
const engine = new RenderEngine2D5(canvas);
const dungeon = new DungeonView();
const sim = new CorridorSim();
const input = new InputHandler(canvas);
const HALF_CORRIDOR = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;
engine.fxCam = dungeon;
engine.sceneMode = "dungeon";

// ─── UI references ────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const phaseHub = $("#phase-hub");
const phaseRun = $("#phase-run");
const phaseDeath = $("#phase-death");
const soulsEl = $("#souls-display");
const quiverEl = $("#quiver-display");
const hpFill = $("#hp-fill");
const hpText = $("#hp-text");
const waveEl = $("#wave-display");
const distEl = $("#distance-display");
const timerEl = $("#timer-display");
const cooldownRing = $("#cooldown-ring");
const cooldownLabel = $("#cooldown-label");
const minimapCanvas = $("#minimap");
const deathStats = $("#death-stats");
const debugPanel = $("#debug-panel");
const pathChoice = $("#path-choice");

function prettyPathNames(choice) {
  if (!choice || !choice.enemyTypes || !choice.enemyTypes.length) return "";
  return choice.enemyTypes.slice(0, 2).map((t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  ).join(" · ");
}

function setPathChoice(on) {
  if (!pathChoice) return;
  pathChoice.classList.toggle("active", !!on);
  if (!on) return;
  const dirs = new Set((sim.junctionChoices || []).map((c) => c.direction));
  const labels = { left: "‹ Left", forward: "Ahead", right: "Right ›" };
  for (const btn of pathChoice.querySelectorAll("[data-dir]")) {
    const dir = btn.dataset.dir;
    const offered = dirs.has(dir);
    btn.hidden = !offered;
    if (!offered) continue;
    const choice = (sim.junctionChoices || []).find((c) => c.direction === dir);
    const names = prettyPathNames(choice);
    btn.innerHTML = names
      ? `${labels[dir]}<small>${names}</small>`
      : labels[dir];
  }
}

// ─── Input ───────────────────────────────────────────────────
function tryChoosePath(x, y) {
  if (sim.state.phase !== "run" || !sim.junctionPending) return false;
  const w = canvas.clientWidth;
  let dir = dungeon.hitTest(x, y);
  if (!dir) {
    if (x < w * 0.34) dir = "left";
    else if (x > w * 0.66) dir = "right";
    else dir = "forward";
  }
  const dirs = new Set((sim.junctionChoices || []).map((c) => c.direction));
  if (!dirs.has(dir)) return false;
  sim.chooseJunction(dir);
  return true;
}

input.onDragEnd = (angle, power, vector) => {
  if (sim.state.phase !== "run") return;
  if (sim.junctionPending) {
    tryChoosePath(input.dragX, input.dragY);
    return;
  }
  const pwr = power || input.power;
  const vec = vector || (input.vector && input.vector.x ? input.vector : { x: 0, y: -1 });
  const spd = CONFIG.ARROW_SPEED * (0.4 + 0.6 * Math.min(1, (pwr || 8) / CONFIG.SLINGSHOT_MAX_POWER));
  sim.fireArrow({ angle: angle || 0, power: pwr, vector: vec, speed: spd });
};

input.onTap = (x, y) => {
  tryChoosePath(x, y);
};

window.addEventListener("keydown", (e) => {
  if (sim.state.phase !== "run" || !sim.junctionPending) return;
  const dir = e.key === "ArrowLeft" || e.key === "a" || e.key === "A" ? "left"
    : e.key === "ArrowRight" || e.key === "d" || e.key === "D" ? "right"
    : e.key === "ArrowUp" || e.key === "w" || e.key === "W" ? "forward"
    : null;
  if (dir) {
    e.preventDefault();
    sim.chooseJunction(dir);
  }
});

// ─── Game events ─────────────────────────────────────────────
sim.state.onPhaseChange = (phase) => {
  phaseHub.style.display = phase === "hub" ? "flex" : "none";
  phaseRun.style.display = phase === "run" ? "flex" : "none";
  phaseDeath.style.display = (phase === "death" || phase === "victory") ? "flex" : "none";

  if (phase === "hub") {
    sim.quiver.packForHub();
    saveGame();
    populateHub();
  }

  if (phase !== "run") setPathChoice(false);

  if (phase === "death" || phase === "victory") {
    const stats = sim.state.getRunStats();
    const earned = sim.state.bankSouls();
    sim.quiver.packForHub();
    saveGame();
    if (deathStats) {
      deathStats.innerHTML = `
        <div style="font-size:1.6em;color:${phase==='victory'?'#5aaf8a':'#c45a4a'}">${phase === "victory" ? "Elevator!" : "Fallen..."}</div>
        <div>Reached: <b>${sim.getProgressLabel()}</b></div>
        <div>Halls cleared: <b>${Math.max(0, sim.waveIndex - (phase === "victory" ? 0 : 1))}</b></div>
        <div>Kills: <b>${stats.enemiesKilled}</b></div>
        <div>Arrows: <b>${stats.arrowsFired}</b></div>
        <div style="font-size:1.4em;margin-top:8px;color:#c9a227">+${earned} Souls</div>
      `;
    }
  }
  updateUI();
};

sim.on("enemy_death", (e) => {
  engine.fx.death(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, "soft");
  engine.punch(1.5);
});

sim.on("arrow_fire", (e) => {
  const ang = e.projectile ? Math.atan2(e.projectile.vdist, -e.projectile.vx) : -Math.PI / 2;
  engine.fx.muzzle(0, 0, ang, e.arrow.type);
});

const FX_TYPE = {
  ice: "frost", wood: "kinetic", flint: "kinetic", iron: "kinetic",
  steel: "kinetic", silver: "kinetic", obsidian: "kinetic", moss: "poison",
  oil: "acid", piercing: "kinetic", double: "kinetic", normal: "kinetic",
};
sim.on("projectile_hit", (e) => {
  const fxType = FX_TYPE[e.projectile.element] || e.projectile.element;
  engine.fx.hit(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, fxType);
  engine.fx.damageNumber(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, Math.round(e.damage));
});

sim.on("player_hit", (e) => {
  engine.punch(e.damage > 8 ? 6 : 3);
});

sim.on("wave_start", () => {
  engine.punch(2);
});

sim.on("junction_show", () => {
  setPathChoice(true);
  input.choiceMode = true;
  input.blockUntil = 0;
  input.isDragging = false;
});

sim.on("junction_chosen", () => {
  setPathChoice(false);
  input.choiceMode = false;
  engine.punch(4);
});

sim.on("run_start", () => {
  setPathChoice(false);
  input.reset();
  input.blockUntil = performance.now() + 280;
});

if (pathChoice) {
  pathChoice.addEventListener("pointerup", (e) => {
    const btn = e.target.closest("[data-dir]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (sim.state.phase === "run" && sim.junctionPending) {
      sim.chooseJunction(btn.dataset.dir);
    }
  });
}

// ─── UI Buttons ───────────────────────────────────────────────
$("#btn-start").addEventListener("click", () => { try { sim.initRun(); } catch(err) { console.error("Init error:", err); } });
$("#btn-retry").addEventListener("click", () => { try { sim.initRun(); } catch(err) { console.error("Init error:", err); } });
$("#btn-hub").addEventListener("click", () => {
  if (sim.state.phase === "death" || sim.state.phase === "victory") {
    sim.state.hubVisits++;
  }
  sim.state.enterHub();
});

// ─── Hub Nav ──────────────────────────────────────────────────
const hubNavBtns = document.querySelectorAll(".hub-nav-btn");
const hubPanels = document.querySelectorAll(".hub-panel");
hubNavBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    hubNavBtns.forEach(b => b.classList.remove("active"));
    hubPanels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById("panel-" + btn.dataset.panel);
    if (panel) panel.classList.add("active");
  });
});

const ENEMY_DEFS_BESTIARY = [
  { id: "slime",          name: "Slime",           hp: 10,  dmg: 4,  speed: 9,   souls: 1, armor: "None",   color: "#b84a55", behavior: "Oozes forward with a slow, wet pulse" },
  { id: "slime_large",    name: "Large Slime",     hp: 30,  dmg: 6,  speed: 7,   souls: 2, armor: "None",   color: "#c45a65", behavior: "Tougher slime that splits into 2 smaller slimes on death" },
  { id: "slime_huge",     name: "Huge Slime",      hp: 60,  dmg: 8,  speed: 5,   souls: 4, armor: "None",   color: "#d46a75", behavior: "Massive slime that splits into 2 Large Slimes" },
  { id: "goblin_runt",    name: "Goblin Runt",     hp: 8,   dmg: 3,  speed: 20,  souls: 1, armor: "None",   color: "#6aaa5a", behavior: "Walks forward, then dodges side to side in a rhythm" },
  { id: "goblin_warrior", name: "Goblin Warrior",  hp: 18,  dmg: 5,  speed: 16,  souls: 2, armor: "None",   color: "#5a9a4a", behavior: "Tougher goblin with slower, heavier dodges" },
  { id: "goblin_chieftain",name: "Goblin Chieftain",hp: 40, dmg: 7,  speed: 13,  souls: 4, armor: "None",   color: "#4a8a3a", behavior: "Powerful goblin leader, slow but devastating" },
  { id: "imp",            name: "Imp",             hp: 6,   dmg: 3,  speed: 24,  souls: 1, armor: "None",   color: "#d4892a", behavior: "Walks slowly, then notices player and charges" },
  { id: "scamp",          name: "Scamp",           hp: 12,  dmg: 4,  speed: 22,  souls: 2, armor: "None",   color: "#e0a030", behavior: "Faster imp variant, charges quickly" },
  { id: "demon",          name: "Demon",           hp: 35,  dmg: 7,  speed: 16,  souls: 4, armor: "None",   color: "#c04040", behavior: "Slow, heavy, devastating charger" },
  { id: "skeleton",       name: "Skeleton",        hp: 50,  dmg: 7,  speed: 11,  souls: 3, armor: "None",   color: "#c8c0b0", behavior: "Slow undead warrior with a sharp blade" },
  { id: "skeleton_archer",name: "Skeleton Archer",  hp: 25,  dmg: 4,  speed: 12,  souls: 2, armor: "None",   color: "#b0a898", behavior: "Stops at range and fires bone arrows at you" },
  { id: "ghoul",          name: "Ghoul",           hp: 15,  dmg: 4,  speed: 15,  souls: 1, armor: "None",   color: "#7a6a5a", behavior: "Shambling undead" },
  { id: "wight",          name: "Wight",           hp: 30,  dmg: 6,  speed: 13,  souls: 2, armor: "None",   color: "#6a5a4a", behavior: "Tougher ghoul, steady advance" },
  { id: "wraith",         name: "Wraith",          hp: 18,  dmg: 5,  speed: 18,  souls: 2, armor: "Energy", color: "#8a7ab8", behavior: "Phases through attacks, zigzags unpredictably" },
  { id: "vampire",        name: "Vampire",         hp: 35,  dmg: 6,  speed: 17,  souls: 3, armor: "None",   color: "#a02020", behavior: "Notices player, charges, drains HP" },
  { id: "vampire_lord",   name: "Vampire Lord",    hp: 60,  dmg: 8,  speed: 19,  souls: 5, armor: "None",   color: "#801010", behavior: "Faster, stronger vampire" },
  { id: "lich",           name: "Lich",            hp: 50,  dmg: 5,  speed: 10,  souls: 4, armor: "None",   color: "#6040a0", behavior: "Ranged magic, summons minions" },
  { id: "bat",            name: "Bat",             hp: 6,   dmg: 2,  speed: 28,  souls: 1, armor: "None",   color: "#4a3a5a", behavior: "Hovers in the hall, might poison" },
  { id: "spider",         name: "Spider",          hp: 8,   dmg: 3,  speed: 20,  souls: 1, armor: "None",   color: "#5a4a3a", behavior: "Creeps forward, might poison" },
  { id: "giant_spider",   name: "Giant Spider",    hp: 25,  dmg: 5,  speed: 16,  souls: 2, armor: "None",   color: "#4a3a2a", behavior: "Larger, tougher spider" },
  { id: "orc",            name: "Orc",             hp: 35,  dmg: 7,  speed: 14,  souls: 3, armor: "None",   color: "#5a7a4a", behavior: "Tough, steady advance" },
  { id: "ogre",           name: "Ogre",            hp: 70,  dmg: 10, speed: 9,   souls: 5, armor: "Heavy",  color: "#6a8a5a", behavior: "Very tough, slow, heavy" },
  { id: "troll",          name: "Troll",           hp: 50,  dmg: 8,  speed: 12,  souls: 4, armor: "None",   color: "#4a6a3a", behavior: "Regenerates HP while alive" },
];

const ARMOUR_MATERIALS = [
  { id: "cloth",   name: "Cloth",           color: "#a09080", tier: 1,  head: 1, body: 2, feet: 1 },
  { id: "fur",     name: "Fur",             color: "#8a7060", tier: 2,  head: 2, body: 3, feet: 1 },
  { id: "leather", name: "Leather",         color: "#7a5a3a", tier: 3,  head: 2, body: 4, feet: 2 },
  { id: "hardened_leather", name: "Hardened Leather", color: "#6a4a2a", tier: 4, head: 3, body: 5, feet: 2 },
  { id: "reinforced_leather", name: "Reinforced Leather", color: "#5a3a1a", tier: 5, head: 4, body: 6, feet: 3 },
  { id: "bronze",  name: "Bronze",          color: "#b87333", tier: 6,  head: 4, body: 7, feet: 3 },
  { id: "iron",    name: "Iron",            color: "#8a8a8a", tier: 7,  head: 5, body: 8, feet: 4 },
  { id: "steel",   name: "Steel",           color: "#6a6a7a", tier: 8,  head: 6, body: 10, feet: 4 },
  { id: "hardened_steel", name: "Hardened Steel", color: "#4a4a5a", tier: 9, head: 7, body: 12, feet: 5 },
  { id: "tempered", name: "Tempered",       color: "#3a4a5a", tier: 10, head: 8, body: 14, feet: 5 },
  { id: "mithril", name: "Mithril",         color: "#8ab8d0", tier: 11, head: 9, body: 16, feet: 6 },
  { id: "elven",   name: "Elven",           color: "#60a070", tier: 12, head: 10, body: 18, feet: 7 },
  { id: "dragon",  name: "Dragon",          color: "#c03030", tier: 13, head: 12, body: 22, feet: 8 },
];

const ARMOUR_QUALITIES = [
  { id: "battered",   name: "Battered",   mult: 0.6, color: "#8a7a6a" },
  { id: "old",        name: "Old",        mult: 0.8, color: "#7a8a6a" },
  { id: "standard",   name: "",           mult: 1.0, color: "#e8e4dc" },
  { id: "fine",       name: "Fine",       mult: 1.3, color: "#5a9ad0" },
  { id: "masterwork", name: "Masterwork", mult: 1.6, color: "#c9a227" },
  { id: "legendary",  name: "Legendary",  mult: 2.0, color: "#d4783a" },
];

const SLOT_ICONS = { head: "🪖", body: "🛡️", feet: "👢" };
const SLOTS = ["head", "body", "feet"];

function armourWeight(material, quality, slot) {
  const slotW = slot === "body" ? 1 : slot === "head" ? 0.55 : 0.4;
  const q = 0.7 + quality.mult * 0.3;
  return Math.max(1, Math.round((1 + material.tier * 0.7) * slotW * q));
}

function generateArmourItem(material, quality, slot) {
  const baseArmor = slot === "body" ? material.body : slot === "head" ? material.head : material.feet;
  const armor = Math.max(1, Math.floor(baseArmor * quality.mult));
  const weight = armourWeight(material, quality, slot);
  const cost = Math.floor(10 + material.tier * 8 + (ARMOUR_QUALITIES.indexOf(quality)) * 15);
  const prefix = quality.name ? quality.name + " " : "";
  const name = `${prefix}${material.name} ${slot.charAt(0).toUpperCase() + slot.slice(1)}`;
  return {
    id: `${quality.id}_${material.id}_${slot}`,
    name,
    slot,
    cost,
    desc: `${material.name} ${slot} armor`,
    stats: `Armor ${armor} · Wt ${weight}`,
    icon: SLOT_ICONS[slot],
    section: "armour",
    armor,
    weight,
    material: material.id,
    quality: quality.id,
    tier: material.tier,
  };
}

const ARMOUR_ITEMS = [];
for (const mat of ARMOUR_MATERIALS) {
  for (const qual of ARMOUR_QUALITIES) {
    for (const slot of SLOTS) {
      ARMOUR_ITEMS.push(generateArmourItem(mat, qual, slot));
    }
  }
}

const SHOP_ARROWS_ALL = getShopArrowCatalog();

const SHOP_QUIVERS = [
  { id: "quiver_small",  name: "Small Quiver",  slot: "misc", cost: 40,  desc: "Holds 12 arrows",  stats: "12 Capacity", icon: "🏹", section: "quivers" },
  { id: "quiver_medium", name: "Medium Quiver", slot: "misc", cost: 80,  desc: "Holds 16 arrows",  stats: "16 Capacity", icon: "🏹", section: "quivers" },
  { id: "quiver_large",  name: "Large Quiver",  slot: "misc", cost: 150, desc: "Holds 20 arrows",  stats: "20 Capacity", icon: "🏹", section: "quivers" },
];

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pickArmourQuality(rand, luck = 1) {
  const n = ARMOUR_QUALITIES.length;
  const power = 1 + Math.max(0, luck - 1) * 0.08;
  const skewed = 1 - Math.pow(1 - rand(), power);
  return ARMOUR_QUALITIES[Math.min(n - 1, Math.floor(skewed * n))];
}

function rollShopArmour(rand = Math.random, luck = 1) {
  const pool = [];
  for (const mat of ARMOUR_MATERIALS) {
    for (const slot of SLOTS) {
      pool.push(generateArmourItem(mat, pickArmourQuality(rand, luck), slot));
    }
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, 3);
}

let _shopArmourCache = null;
let _shopArrowCache = null;
let _shopHubVisit = -1;

function refreshShopCaches(state) {
  const visit = state.hubVisits || 0;
  if (_shopHubVisit !== visit || !_shopArmourCache || !_shopArrowCache) {
    _shopArmourCache = rollShopArmour(mulberry32(0x9E3779B9 + visit * 0x85ebca6b), state.getStat("luck"));
    _shopArrowCache = rollShopArrows(3, mulberry32(0xC2B2AE35 + visit * 0x27d4eb2d));
    _shopHubVisit = visit;
  }
}

function syncArmorRating(state) {
  let rating = 0;
  let load = 0;
  for (const slot of SLOTS) {
    const id = state.equipped?.[slot];
    if (!id) continue;
    const item = ARMOUR_ITEMS.find((i) => i.id === id);
    if (item) {
      rating += item.armor;
      load += item.weight || 0;
    }
  }
  state.armorRating = rating;
  state.equipLoad = load;
}

function getShopArmour(state) {
  refreshShopCaches(state);
  return _shopArmourCache;
}

function getShopArrows(state) {
  refreshShopCaches(state);
  return _shopArrowCache;
}

const EQUIP_SLOTS = [
  { id: "head", name: "Head",   icon: "🪖" },
  { id: "body", name: "Body",   icon: "🛡️" },
  { id: "feet", name: "Feet",   icon: "👢" },
  { id: "arrows", name: "Arrows", icon: "🏹" },
  { id: "misc", name: "Misc",   icon: "💍" },
];

function populateHub() {
  const state = sim.state;
  sim.quiver.capacity = state.getQuiverCapacity();
  syncArmorRating(state);
  state.applyUpgrades();
  const soulsEl = document.getElementById("hub-souls");
  if (soulsEl) soulsEl.textContent = state.souls;

  // Training
  const trainingList = document.getElementById("training-list");
  if (trainingList) {
    const cd = state.getArrowCooldown();
    const ret = Math.round(state.getArrowReturnChance() * 100);
    const crit = Math.round(state.getCritChance() * 100);
    const critX = state.getCritMultiplier().toFixed(1);
    const over = state.isOverEncumbered();
    const cost = state.getUpgradeCost();
    const charLevel = state.getCharacterLevel();
    trainingList.innerHTML = `
      <div class="train-summary">
        <span>Level ${charLevel}</span>
        <span>Next ${cost} souls</span>
        <span>HP ${state.playerMaxHp}</span>
        <span>CD ${cd.toFixed(2)}s</span>
        <span>Dmg +${state.getStrengthBonus()}</span>
        <span>Crit ${crit}% ×${critX}</span>
        <span>Return ${ret}%</span>
        <span class="${over ? "overencumbered" : ""}">Load ${state.equipLoad || 0}/${state.getMaxEquipLoad()}</span>
      </div>
    ` + STAT_INFO.map((u) => {
      const lvl = state.getStat(u.id);
      const maxed = state.isUpgradeMaxed(u.id);
      const afford = state.souls >= cost;
      return `<div class="train-row">
        <div class="train-info">
          <div class="train-name">${u.name}</div>
          <div class="train-desc">${u.desc}</div>
        </div>
        <div class="train-right">
          <span class="train-level">${lvl} / 20</span>
          <span class="train-cost">${maxed ? "MAX" : cost + " souls"}</span>
          <button class="train-buy ${maxed ? "maxed" : ""}" ${maxed || !afford ? "disabled" : ""} data-upgrade="${u.id}">${maxed ? "MAX" : "Train"}</button>
        </div>
      </div>`;
    }).join("");
    trainingList.querySelectorAll(".train-buy").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.upgrade;
        state.buyUpgrade(id);
        saveGame();
        populateHub();
      });
    });
  }

  // Shop
  const shopList = document.getElementById("shop-list");
  if (shopList) {
    const owned = state.ownedItems || [];
    const armourItems = getShopArmour(state);
    const arrowItems = getShopArrows(state);
    const allItems = [
      ...SHOP_ARROWS_ALL,
      ...SHOP_QUIVERS,
      ...armourItems,
    ];
    const sections = [
      { id: "arrows",  label: "Arrows",  items: arrowItems },
      { id: "quivers", label: "Quivers", items: SHOP_QUIVERS },
      { id: "armour",  label: "Armour",  items: armourItems },
    ];
    shopList.innerHTML = sections.map(section => {
      return `<div class="shop-section">
        <div class="shop-section-title" data-toggle="${section.id}">${section.label} ▾</div>
        <div class="shop-section-items" id="shop-section-${section.id}">
          ${section.items.map(item => {
            const repeatable = item.section === "arrows";
            const isOwned = !repeatable && owned.includes(item.id);
            const afford = state.souls >= item.cost;
            const qual = ARMOUR_QUALITIES.find(q => q.id === item.quality);
            const qualColor = qual ? qual.color : "#e8e4dc";
            return `<div class="shop-item">
              <div class="shop-icon">${item.icon}</div>
              <div class="shop-name" style="color:${qualColor}">${item.name}</div>
              <div class="shop-desc">${item.desc}<br><span style="color:#8a7348">${item.stats}</span></div>
              <div class="shop-bottom">
                <span class="shop-cost">${isOwned ? "Owned" : item.cost + " souls"}</span>
                <button class="shop-buy ${isOwned ? 'owned' : ''}" ${isOwned || !afford ? 'disabled' : ''} data-item="${item.id}">${isOwned ? "Owned" : "Buy"}</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");

    shopList.querySelectorAll(".shop-section-title[data-toggle]").forEach(el => {
      el.addEventListener("click", () => {
        const sectionId = el.dataset.toggle;
        const itemsEl = document.getElementById(`shop-section-${sectionId}`);
        if (itemsEl) {
          itemsEl.style.display = itemsEl.style.display === "none" ? "" : "none";
          el.textContent = el.textContent.includes("▾") ? el.textContent.replace("▾", "▸") : el.textContent.replace("▸", "▾");
        }
      });
    });

    shopList.querySelectorAll(".shop-buy").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.item;
        const item = allItems.find(i => i.id === id);
        if (!item || !state.spendSouls(item.cost)) return;
        if (!state.ownedItems) state.ownedItems = [];
        if (item.section === "arrows") {
          const arrow = { type: item.element || "normal", level: 1 };
          if (!sim.quiver.addToQuiver(arrow)) sim.quiver.addToStorage(arrow);
        } else {
          state.ownedItems.push(id);
          if (item.section === "quivers") {
            if (!state.equipped) state.equipped = {};
            state.equipped.quiver = id;
            sim.quiver.capacity = state.getQuiverCapacity();
          }
        }
        saveGame();
        populateHub();
      });
    });
  }

  // Equip
  const equipSlotsEl = document.getElementById("equip-slots");
  const equipDetail = document.getElementById("equip-detail");
  if (equipSlotsEl) {
    const equipped = state.equipped || {};
    const quiverData = sim.quiver;
    const quiverCount = quiverData ? quiverData.quiverCount : 0;
    const storageCount = quiverData ? quiverData.storageCount : 0;

    function findItem(id) {
      return SHOP_ARROWS_ALL.find(i => i.id === id)
        || SHOP_QUIVERS.find(i => i.id === id)
        || ARMOUR_ITEMS.find(i => i.id === id)
        || null;
    }

    const maxLoad = state.getMaxEquipLoad();
    const load = state.equipLoad || 0;
    const over = load > maxLoad;
    equipSlotsEl.innerHTML = `<div class="equip-load ${over ? "overencumbered" : ""}">Equip load ${load} / ${maxLoad}${over ? " — overencumbered, slower shots" : ""}</div>` + EQUIP_SLOTS.map(slot => {
      const itemId = equipped[slot.id];
      const item = itemId ? findItem(itemId) : null;
      let extra = "";
      if (slot.id === "arrows") {
        extra = ` (${quiverCount}/${quiverData?.capacity || 6} + ${storageCount} stored)`;
      }
      return `<div class="equip-slot" data-slot="${slot.id}">
        <div class="equip-slot-icon">${item ? item.icon : slot.icon}</div>
        <div class="equip-slot-info">
          <div class="equip-slot-name">${slot.name}</div>
          <div class="equip-slot-item">${item ? item.name + extra : "Empty" + extra}</div>
        </div>
      </div>`;
    }).join("");

    equipSlotsEl.innerHTML += `
      <div class="equip-slot" data-slot="quiver_item">
        <div class="equip-slot-icon">📦</div>
        <div class="equip-slot-info">
          <div class="equip-slot-name">Quiver Type</div>
          <div class="equip-slot-item">${equipped.quiver ? findItem(equipped.quiver)?.name || "Equipped" : "Basic Quiver"}</div>
        </div>
      </div>
    `;

    equipSlotsEl.querySelectorAll(".equip-slot").forEach(el => {
      el.addEventListener("click", () => {
        const slotId = el.dataset.slot;
        const owned = state.ownedItems || [];

        if (slotId === "arrows") {
          const quiver = sim.quiver;
          if (!quiver) {
            equipDetail.innerHTML = `<div class="equip-detail-empty">No quiver available.</div>`;
          } else {
            const qArr = quiver.peekQuiver();
            const sArr = quiver.peekStorage();
            equipDetail.innerHTML = `
              <div style="display:flex;gap:16px;height:100%">
                <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                  <h3 style="margin:0">Collection (${sArr.length})</h3>
                  <div style="color:#6a7a8a;font-size:0.9em">Tap to load into the run deck</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;overflow-y:auto;flex:1">
                    ${sArr.length === 0 ? '<div style="color:#4a5a6a;font-size:0.8em">Empty</div>' : ''}
                    ${sArr.map((a, i) => `<div class="arrow-card ${a.type}" data-storage="${i}" style="cursor:pointer;border-color:${getArrowDef(a.type).color}" title="Move to quiver">${arrowShort(a.type)} L${a.level}</div>`).join("")}
                  </div>
                </div>
                <div style="width:1px;background:rgba(255,255,255,0.1)"></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                  <h3 style="margin:0">Run Deck (${qArr.length}/${quiver.capacity})</h3>
                  <div style="color:#6a7a8a;font-size:0.9em">Tap to move to collection</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;overflow-y:auto;flex:1">
                    ${qArr.map((a, i) => `<div class="arrow-card ${a.type}" data-quiver="${i}" style="cursor:pointer;border-color:${getArrowDef(a.type).color}" title="Move to storage">${arrowShort(a.type)} L${a.level}</div>`).join("")}
                  </div>
                </div>
              </div>`;
            equipDetail.querySelectorAll("[data-storage]").forEach(el => {
              el.addEventListener("click", () => {
                quiver.moveArrowToQuiver(parseInt(el.dataset.storage));
                saveGame();
                populateHub();
                equipSlotsEl.querySelector('[data-slot="arrows"]').click();
              });
            });
            equipDetail.querySelectorAll("[data-quiver]").forEach(el => {
              el.addEventListener("click", () => {
                quiver.moveArrowToStorage(parseInt(el.dataset.quiver));
                saveGame();
                populateHub();
                equipSlotsEl.querySelector('[data-slot="arrows"]').click();
              });
            });
          }
        } else if (slotId === "quiver_item") {
          const quiverItems = SHOP_QUIVERS;
          const ownedQuivers = quiverItems.filter(i => owned.includes(i.id));
          if (ownedQuivers.length === 0) {
            equipDetail.innerHTML = `<div class="equip-detail-empty">No quivers owned.<br>Visit the Shop to buy one.</div>`;
          } else {
            equipDetail.innerHTML = `<h3>Quiver Type</h3>` +
              ownedQuivers.map(item => {
                const isEquipped = equipped.quiver === item.id;
                return `<div class="equip-detail">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="color:#e8e4dc;font-weight:600">${item.icon} ${item.name}</span>
                    <button class="train-buy ${isEquipped ? 'maxed' : ''}" data-equip="${item.id}" data-slot="quiver">${isEquipped ? "Equipped" : "Equip"}</button>
                  </div>
                  <div class="stat">${item.desc}</div>
                  <div class="stat"><b>${item.stats}</b></div>
                </div>`;
              }).join("");
            equipDetail.querySelectorAll("[data-equip]").forEach(btn => {
              btn.addEventListener("click", () => {
                if (!state.equipped) state.equipped = {};
                state.equipped[btn.dataset.slot] = btn.dataset.equip;
                saveGame();
                populateHub();
              });
            });
          }
        } else {
          const allEquipItems = ARMOUR_ITEMS.filter(i => i.slot === slotId);
          const ownedInSlot = allEquipItems.filter(i => owned.includes(i.id));
          const currentlyEquipped = equipped[slotId];

          if (ownedInSlot.length === 0) {
            equipDetail.innerHTML = `<div class="equip-detail-empty">No ${EQUIP_SLOTS.find(s => s.id === slotId)?.name || slotId} items owned.<br>Visit the Shop to buy some.</div>`;
          } else {
            equipDetail.innerHTML = `<h3>${EQUIP_SLOTS.find(s => s.id === slotId)?.name || slotId} Items</h3>` +
              ownedInSlot.map(item => {
                const isEquipped = currentlyEquipped === item.id;
                const qual = ARMOUR_QUALITIES.find(q => q.id === item.quality);
                const qualColor = qual ? qual.color : "#e8e4dc";
                return `<div class="equip-detail">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="color:${qualColor};font-weight:600">${item.icon} ${item.name}</span>
                    <button class="train-buy ${isEquipped ? 'maxed' : ''}" data-equip="${item.id}" data-slot="${slotId}">${isEquipped ? "Equipped" : "Equip"}</button>
                  </div>
                  <div class="stat">${item.desc}</div>
                  <div class="stat"><b>${item.stats}</b></div>
                </div>`;
              }).join("");
            equipDetail.querySelectorAll("[data-equip]").forEach(btn => {
              btn.addEventListener("click", () => {
                if (!state.equipped) state.equipped = {};
                state.equipped[btn.dataset.slot] = btn.dataset.equip;
                saveGame();
                populateHub();
                equipSlotsEl.querySelector(`[data-slot="${btn.dataset.slot}"]`).click();
              });
            });
          }
        }
      });
    });
  }

  // Bestiary
  const bestiaryList = document.getElementById("bestiary-list");
  if (bestiaryList) {
    bestiaryList.innerHTML = ENEMY_DEFS_BESTIARY.map(e => {
      return `<div class="bestiary-entry">
        <div class="bestiary-icon">
          <div class="bestiary-icon-ring" style="border-color:${e.color}"></div>
          <div class="bestiary-icon-inner" style="background:${e.color}"></div>
        </div>
        <div class="bestiary-info">
          <div class="bestiary-name">${e.name}</div>
          <div class="bestiary-behavior">${e.behavior}</div>
        </div>
        <div class="bestiary-stats">
          <div class="bestiary-stat"><span class="bestiary-stat-val">${e.hp}</span><span class="bestiary-stat-label">HP</span></div>
          <div class="bestiary-stat"><span class="bestiary-stat-val">${e.dmg}</span><span class="bestiary-stat-label">DMG</span></div>
          <div class="bestiary-stat"><span class="bestiary-stat-val">${e.speed}</span><span class="bestiary-stat-label">SPD</span></div>
          <div class="bestiary-stat"><span class="bestiary-stat-val">${e.souls}</span><span class="bestiary-stat-label">Souls</span></div>
        </div>
      </div>`;
    }).join("");
  }
}

// ─── UI Update ────────────────────────────────────────────────
function updateUI() {
  if (soulsEl) soulsEl.textContent = sim.state.phase === "run" ? (sim.state.runSouls || 0) : sim.state.souls;
  if (quiverEl) {
    const q = sim.quiver;
    quiverEl.textContent = sim.state.phase === "run"
      ? `Queue ${q.queueCount} · Deck ${q.deckCount}`
      : `Deck ${q.quiverCount}/${q.capacity}`;
  }
  if (hpFill) hpFill.style.width = `${(sim.state.playerHp / sim.state.playerMaxHp) * 100}%`;
  if (hpText) hpText.textContent = `${Math.ceil(sim.state.playerHp)} / ${sim.state.playerMaxHp}`;
  if (waveEl) waveEl.textContent = sim.getProgressLabel ? sim.getProgressLabel() : `Fl. 1`;
  if (distEl) distEl.textContent = `${sim.enemies.length} ahead`;

  if (timerEl) {
    const t = Math.floor(sim.runTime || 0);
    const m = Math.floor(t / 60);
    const s = t % 60;
    timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }

  if (cooldownRing && cooldownLabel) {
    const cd = sim.state.arrowCooldown || 0;
    const maxCd = sim.state.getArrowCooldown();
    const pct = maxCd > 0 ? (1 - cd / maxCd) : 1;
    const circ = 2 * Math.PI * 17;
    cooldownRing.setAttribute("stroke-dasharray", `${pct * circ} ${circ}`);
    cooldownLabel.style.opacity = pct >= 1 ? "1" : "0.4";
  }

  drawMinimap();

  if (debugPanel) {
    debugPanel.textContent = `wave=${sim.waveIndex} en=${sim.enemies.length} projs=${sim.projectiles.length}`;
  }

  setPathChoice(sim.state.phase === "run" && !!sim.junctionPending);
}

// ─── Minimap ─────────────────────────────────────────────────
function drawMinimap() {
  if (!minimapCanvas) return;
  const mctx = minimapCanvas.getContext("2d");
  const mw = minimapCanvas.width;
  const mh = minimapCanvas.height;
  mctx.clearRect(0, 0, mw, mh);

  mctx.fillStyle = "rgba(10, 12, 16, 0.8)";
  mctx.fillRect(0, 0, mw, mh);
  mctx.strokeStyle = "rgba(70, 82, 96, 0.4)";
  mctx.lineWidth = 1;
  mctx.strokeRect(2, 2, mw - 4, mh - 4);

  const viewRange = 700;
  const heading = ((sim.heading || 0) * Math.PI) / 180;
  const pts = sim.pathPts || [];
  if (pts.length > 1) {
    mctx.strokeStyle = "rgba(180, 150, 80, 0.45)";
    mctx.lineWidth = 2;
    mctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const px = mw / 2 + (pts[i].x - sim.mapX) * 0.04;
      const py = mh - 8 - (pts[i].y - sim.mapZ) * 0.04;
      if (i === 0) mctx.moveTo(px, py);
      else mctx.lineTo(px, py);
    }
    mctx.lineTo(mw / 2, mh - 8);
    mctx.stroke();
  }

  for (const e of sim.enemies) {
    const ex = (e.x / HALF_CORRIDOR + 1) / 2;
    const ey = 1 - (e.dist / viewRange);
    const mx = 2 + ex * (mw - 4);
    const my = 2 + ey * (mh - 4);
    if (my < 0 || my > mh) continue;
    mctx.fillStyle = e.color;
    mctx.beginPath();
    mctx.arc(mx, my, 2, 0, Math.PI * 2);
    mctx.fill();
  }

  mctx.fillStyle = "#4f7eb0";
  mctx.beginPath();
  mctx.arc(mw / 2, mh - 8, 3, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = "#e8c56a";
  mctx.lineWidth = 1.5;
  mctx.beginPath();
  mctx.moveTo(mw / 2, mh - 8);
  mctx.lineTo(mw / 2 + Math.sin(heading) * 8, mh - 8 - Math.cos(heading) * 8);
  mctx.stroke();
}

function getJunctionView() {
  if (sim.state.phase !== "run" || !sim.junctionPending) return null;
  if (!sim.junctionChoices || !sim.junctionChoices.length) return null;
  const dirs = new Set(sim.junctionChoices.map((c) => c.direction));
  return {
    dist: Math.max(80, sim.segmentEndZ - sim.playerWorldZ),
    left: dirs.has("left"),
    right: dirs.has("right"),
    forward: dirs.has("forward"),
    pending: true,
    choices: sim.junctionChoices,
  };
}

// ─── Rendering ────────────────────────────────────────────────
function drawCorridor(ctx) {
  dungeon.resize(canvas.clientWidth, canvas.clientHeight);
  const t = Number.isFinite(sim.runTime) ? sim.runTime : 0;
  dungeon.yaw = (sim.turnAngle || 0) * Math.PI / 180;
  dungeon.drawHall(ctx, sim.playerWorldZ, t, getJunctionView(), {
    walking: sim.movingForward && !sim.turning && !sim.junctionPending,
    turning: !!sim.turning,
    turnU: sim.turnU || 0,
    turnSign: Math.sign(sim.turnTarget || 0) || 1,
  });

  ctx.save();
  if (dungeon.roll) {
    ctx.translate(dungeon.cssW * 0.5, dungeon.cssH * 0.5);
    ctx.rotate(dungeon.roll);
    ctx.translate(-dungeon.cssW * 0.5, -dungeon.cssH * 0.5);
  }
  const entities = sim.getAllEntities();
  for (let i = entities.length - 1; i >= 0; i--) {
    const ent = entities[i];
    if (ent.type === "enemy") dungeon.drawEnemy(ent.entity);
    else if (ent.type === "projectile") dungeon.drawProjectile(ent.entity);
    else if (ent.type === "enemy_projectile") dungeon.drawProjectile(ent.entity, true);
  }
  ctx.restore();

  dungeon.drawOverlay(ctx, input);
  input.drawAimLine(ctx);
}


// ─── Arrow Queue ─────────────────────────────────────────────
function drawArrowQueue(ctx) {
  const queue = sim.quiver.peekQueue ? sim.quiver.peekQueue() : sim.quiver.peekQuiver().slice(0, 4);
  const startX = 16;
  const y = canvas.clientHeight * (canvas.clientWidth / Math.max(1, canvas.clientHeight) < 0.85 ? 0.86 : 0.92);
  const spacing = 64;

  ctx.font = '600 14px "Chakra Petch", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    const x = startX + i * spacing + 20;
    const def = getArrowDef(a.type);
    const col = def.color || "#d8d2c4";

    ctx.fillStyle = "rgba(20, 16, 12, 0.8)";
    ctx.fillRect(x - 26, y - 24, 52, 48);
    ctx.strokeStyle = withAlpha(col, 0.6);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 26, y - 24, 52, 48);

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 10);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = withAlpha("#ebe6d8", 0.85);
    ctx.fillText(def.short, x, y + 30);
  }
}

// ─── Game Loop ────────────────────────────────────────────────
let lastTime = 0;
const TICK_HZ = 60;
let accum = 0;

function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (sim.running) {
    accum += dt;
    const step = 1 / TICK_HZ;
    let guard = 0;
    while (accum >= step && guard++ < 8) {
      accum -= step;
      try {
        sim.tick();
      } catch(err) {
        console.error("Tick error:", err);
        sim.running = false;
        if (debugPanel) debugPanel.textContent = "TICK ERROR: " + err.message;
      }
    }
    if (sim.running) engine.fx.tick(dt);
  }

  try {
    engine.draw(dt, (ctx) => {
      try { drawCorridor(ctx); }
      catch(err) {
        console.error("Draw error:", err);
        /* keep the loop alive */
      }
    });
    drawArrowQueue(engine.ctx);
    updateUI();
  } catch (err) {
    console.error("Frame error:", err);
    /* keep the loop alive */
  }
  requestAnimationFrame(gameLoop);
}

const SAVE_KEY = "ranger-defense-save-v1";

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      state: sim.state.serialize(),
      quiver: sim.quiver.serialize(),
    }));
  } catch (_) { /* ignore quota / private mode */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.state) sim.state.deserialize(data.state);
    if (data.quiver) sim.quiver.deserialize(data.quiver);
    sim.quiver.capacity = sim.state.getQuiverCapacity();
    sim.quiver.packForHub();
    syncArmorRating(sim.state);
  } catch (_) { /* corrupt save */ }
}

// ─── Start ────────────────────────────────────────────────────
loadGame();
sim.state.enterHub();
engine.fit(true);
requestAnimationFrame((now) => {
  lastTime = now;
  gameLoop(now);
});
