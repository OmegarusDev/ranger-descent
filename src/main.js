/**
 * main.js — Entry point. Wires RenderEngine2D5, CorridorSim, InputHandler.
 * Perspective rendering with optional curved corridor paths.
 */
import { RenderEngine2D5 } from "./engine/RenderEngine2D5.js";
import { CAMERA } from "./engine/corridorCamera.js";
import { withAlpha } from "./engine/drawUtil.js";
import { box25 } from "./engine/prims25.js";
import { CorridorSim } from "./game/CorridorSim.js";
import { InputHandler } from "./game/InputHandler.js";
import { CONFIG } from "./data/config.js";

// ─── Bootstrap ────────────────────────────────────────────────
const canvas = document.getElementById("game");
const engine = new RenderEngine2D5(canvas);
const sim = new CorridorSim();
const input = new InputHandler(canvas);
const cam = engine.cam;
const HALF_CORRIDOR = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;

// ─── UI references ────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const phaseHub = $("#phase-hub");
const phaseRun = $("#phase-run");
const phaseDeath = $("#phase-death");
const soulsEl = $("#souls-display");
const hpFill = $("#hp-fill");
const hpText = $("#hp-text");
const waveEl = $("#wave-display");
const distEl = $("#distance-display");
const timerEl = $("#timer-display");
const queueEl = $("#queue-display");
const hexBar = $("#hex-bar");
const prayerBar = $("#prayer-bar");
const minimapCanvas = $("#minimap");
const deathStats = $("#death-stats");
const debugPanel = $("#debug-panel");
const junctionOverlay = $("#junction-overlay");

// ─── Input ───────────────────────────────────────────────────
input.onDragEnd = (angle, power, vector) => {
  if (sim.state.phase !== "run") return;
  sim.fireArrow(input.getTrajectory());
};

// ─── Game events ─────────────────────────────────────────────
sim.state.onPhaseChange = (phase) => {
  phaseHub.style.display = phase === "hub" ? "flex" : "none";
  phaseRun.style.display = phase === "run" ? "flex" : "none";
  phaseDeath.style.display = (phase === "death" || phase === "victory") ? "flex" : "none";

  if (phase === "hub") {
    sim.state.hubVisits++;
    populateHub();
  }

  if (phase === "death" || phase === "victory") {
    if (junctionOverlay) junctionOverlay.style.display = "none";
    const stats = sim.state.getRunStats();
    const earned = sim.state.bankSouls();
    if (deathStats) {
      deathStats.innerHTML = `
        <div style="font-size:1.6em;color:${phase==='victory'?'#5aaf8a':'#c45a4a'}">${phase === "victory" ? "Victory!" : "Fallen..."}</div>
        <div>Distance: <b>${stats.distance}m</b></div>
        <div>Waves Cleared: <b>${sim.waveIndex}</b></div>
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

sim.on("projectile_hit", (e) => {
  engine.fx.hit(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, e.projectile.element);
  engine.fx.damageNumber(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, Math.round(e.damage));
});

sim.on("player_hit", (e) => {
  engine.punch(e.damage > 8 ? 6 : 3);
});

sim.on("wave_start", () => {
  engine.punch(2);
});

sim.on("junction_show", (e) => {
  showJunctionOverlay(e.choices);
});

sim.on("run_start", () => {
  if (junctionOverlay) junctionOverlay.style.display = "none";
});

// ─── UI Buttons ───────────────────────────────────────────────
$("#btn-start").addEventListener("click", () => { try { sim.initRun(); } catch(err) { console.error("Init error:", err); } });
$("#btn-retry").addEventListener("click", () => { try { sim.initRun(); } catch(err) { console.error("Init error:", err); } });
$("#btn-hub").addEventListener("click", () => sim.state.enterHub());

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
  { id: "slime",          name: "Slime",           hp: 10,  dmg: 4,  speed: 35,  souls: 1, armor: "None",   color: "#b84a55", behavior: "Advances steadily, pauses to lurch forward in bursts" },
  { id: "slime_large",    name: "Large Slime",     hp: 30,  dmg: 6,  speed: 25,  souls: 2, armor: "None",   color: "#c45a65", behavior: "Tougher slime that splits into 2 smaller slimes on death" },
  { id: "slime_huge",     name: "Huge Slime",      hp: 60,  dmg: 8,  speed: 18,  souls: 4, armor: "None",   color: "#d46a75", behavior: "Massive slime that splits into 2 Large Slimes" },
  { id: "goblin_runt",    name: "Goblin Runt",     hp: 8,   dmg: 3,  speed: 55,  souls: 1, armor: "None",   color: "#6aaa5a", behavior: "Walks forward, then dodges side to side in a rhythm" },
  { id: "goblin_warrior", name: "Goblin Warrior",  hp: 18,  dmg: 5,  speed: 42,  souls: 2, armor: "None",   color: "#5a9a4a", behavior: "Tougher goblin with slower, heavier dodges" },
  { id: "goblin_chieftain",name: "Goblin Chieftain",hp: 40, dmg: 7,  speed: 35,  souls: 4, armor: "None",   color: "#4a8a3a", behavior: "Powerful goblin leader, slow but devastating" },
  { id: "imp",            name: "Imp",             hp: 6,   dmg: 3,  speed: 70,  souls: 1, armor: "None",   color: "#d4892a", behavior: "Walks slowly, then notices player and charges" },
  { id: "scamp",          name: "Scamp",           hp: 12,  dmg: 4,  speed: 60,  souls: 2, armor: "None",   color: "#e0a030", behavior: "Faster imp variant, charges quickly" },
  { id: "demon",          name: "Demon",           hp: 35,  dmg: 7,  speed: 45,  souls: 4, armor: "None",   color: "#c04040", behavior: "Slow, heavy, devastating charger" },
  { id: "skeleton",       name: "Skeleton",        hp: 50,  dmg: 7,  speed: 22,  souls: 3, armor: "None",   color: "#c8c0b0", behavior: "Slow undead warrior with a sharp blade" },
  { id: "skeleton_archer",name: "Skeleton Archer",  hp: 25,  dmg: 4,  speed: 28,  souls: 2, armor: "None",   color: "#b0a898", behavior: "Stops at range and fires bone arrows at you" },
  { id: "ghoul",          name: "Ghoul",           hp: 15,  dmg: 4,  speed: 40,  souls: 1, armor: "None",   color: "#7a6a5a", behavior: "Fast, shambling undead" },
  { id: "wight",          name: "Wight",           hp: 30,  dmg: 6,  speed: 35,  souls: 2, armor: "None",   color: "#6a5a4a", behavior: "Tougher ghoul, steady advance" },
  { id: "wraith",         name: "Wraith",          hp: 18,  dmg: 5,  speed: 55,  souls: 2, armor: "Energy", color: "#8a7ab8", behavior: "Phases through attacks, zigzags unpredictably" },
  { id: "vampire",        name: "Vampire",         hp: 35,  dmg: 6,  speed: 45,  souls: 3, armor: "None",   color: "#a02020", behavior: "Notices player, charges, drains HP" },
  { id: "vampire_lord",   name: "Vampire Lord",    hp: 60,  dmg: 8,  speed: 50,  souls: 5, armor: "None",   color: "#801010", behavior: "Faster, stronger vampire" },
  { id: "lich",           name: "Lich",            hp: 50,  dmg: 5,  speed: 30,  souls: 4, armor: "None",   color: "#6040a0", behavior: "Ranged magic, summons minions" },
  { id: "bat",            name: "Bat",             hp: 6,   dmg: 2,  speed: 90,  souls: 1, armor: "None",   color: "#4a3a5a", behavior: "Very fast, tiny, might poison" },
  { id: "spider",         name: "Spider",          hp: 8,   dmg: 3,  speed: 60,  souls: 1, armor: "None",   color: "#5a4a3a", behavior: "Fast, small, might poison" },
  { id: "giant_spider",   name: "Giant Spider",    hp: 25,  dmg: 5,  speed: 50,  souls: 2, armor: "None",   color: "#4a3a2a", behavior: "Larger, tougher spider" },
  { id: "orc",            name: "Orc",             hp: 35,  dmg: 7,  speed: 40,  souls: 3, armor: "None",   color: "#5a7a4a", behavior: "Tough, steady advance" },
  { id: "ogre",           name: "Ogre",            hp: 70,  dmg: 10, speed: 25,  souls: 5, armor: "Heavy",  color: "#6a8a5a", behavior: "Very tough, slow, heavy" },
  { id: "troll",          name: "Troll",           hp: 50,  dmg: 8,  speed: 35,  souls: 4, armor: "None",   color: "#4a6a3a", behavior: "Regenerates HP while alive" },
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

function generateArmourItem(material, quality, slot) {
  const baseArmor = slot === "body" ? material.body : slot === "head" ? material.head : material.feet;
  const armor = Math.max(1, Math.floor(baseArmor * quality.mult));
  const cost = Math.floor(10 + material.tier * 8 + (ARMOUR_QUALITIES.indexOf(quality)) * 15);
  const prefix = quality.name ? quality.name + " " : "";
  const name = `${prefix}${material.name} ${slot.charAt(0).toUpperCase() + slot.slice(1)}`;
  return {
    id: `${quality.id}_${material.id}_${slot}`,
    name,
    slot,
    cost,
    desc: `${material.name} ${slot} armor`,
    stats: `Armor ${armor}`,
    icon: SLOT_ICONS[slot],
    section: "armour",
    armor,
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

const SHOP_CONSUMABLES = [
  { id: "health_potion", name: "Health Potion", slot: "item", cost: 25, desc: "Restore 5 HP", stats: "Heal 5 HP", icon: "🧪", section: "items" },
  { id: "damage_scroll", name: "Damage Scroll", slot: "item", cost: 40, desc: "+50% damage for 10s", stats: "Buff", icon: "📜", section: "items" },
  { id: "speed_charm",   name: "Speed Charm",   slot: "item", cost: 30, desc: "Move faster for 15s", stats: "Buff", icon: "✨", section: "items" },
];

const SHOP_ARROWS = [
  { id: "fire_arrows",   name: "Fire Arrow",    slot: "ammo", cost: 30, desc: "1 fire arrow", stats: "Burn DOT", icon: "🔥", section: "arrows", element: "fire" },
  { id: "ice_arrows",    name: "Ice Arrow",     slot: "ammo", cost: 30, desc: "1 ice arrow",  stats: "Slow",     icon: "❄️", section: "arrows", element: "ice" },
  { id: "poison_arrows", name: "Poison Arrow",  slot: "ammo", cost: 30, desc: "1 poison arrow", stats: "Poison", icon: "☠️", section: "arrows", element: "poison" },
];

const SHOP_QUIVERS = [
  { id: "quiver_small",  name: "Small Quiver",  slot: "misc", cost: 40,  desc: "Holds 12 arrows",  stats: "12 Capacity", icon: "🏹", section: "quivers" },
  { id: "quiver_medium", name: "Medium Quiver", slot: "misc", cost: 80,  desc: "Holds 16 arrows",  stats: "16 Capacity", icon: "🏹", section: "quivers" },
  { id: "quiver_large",  name: "Large Quiver",  slot: "misc", cost: 150, desc: "Holds 20 arrows",  stats: "20 Capacity", icon: "🏹", section: "quivers" },
];

function rollShopArmour() {
  const pool = [];
  for (const mat of ARMOUR_MATERIALS) {
    for (const slot of SLOTS) {
      const qual = ARMOUR_QUALITIES[Math.floor(Math.random() * ARMOUR_QUALITIES.length)];
      pool.push(generateArmourItem(mat, qual, slot));
    }
  }
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

let _shopArmourCache = null;
let _shopHubVisit = -1;

function getShopArmour(state) {
  const visit = state.hubVisits || 0;
  if (_shopHubVisit !== visit || !_shopArmourCache) {
    _shopArmourCache = rollShopArmour();
    _shopHubVisit = visit;
  }
  return _shopArmourCache;
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
  const soulsEl = document.getElementById("hub-souls");
  if (soulsEl) soulsEl.textContent = state.souls;

  // Training
  const trainingList = document.getElementById("training-list");
  if (trainingList) {
    const upgrades = [
      { id: "arrowDamage", name: "Arrow Damage", desc: "Increases base arrow damage", max: 5, base: 15 },
      { id: "attackSpeed", name: "Attack Speed", desc: "Reduces arrow cooldown", max: 5, base: 20 },
      { id: "maxHp",       name: "Max Health",   desc: "+2 max HP per level", max: 5, base: 20 },
      { id: "critChance",  name: "Crit Chance",  desc: "5% crit chance per level", max: 5, base: 30 },
      { id: "lootChance",  name: "Loot Find",    desc: "+5% arrow recovery per level", max: 5, base: 25 },
    ];
    trainingList.innerHTML = upgrades.map(u => {
      const lvl = state.upgrades[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = Math.floor(u.base * (1.5 + lvl * 0.3));
      const afford = state.souls >= cost;
      return `<div class="train-row">
        <div class="train-info">
          <div class="train-name">${u.name}</div>
          <div class="train-desc">${u.desc}</div>
        </div>
        <div class="train-right">
          <span class="train-level">Lv ${lvl} / ${u.max}</span>
          <span class="train-cost">${maxed ? "MAX" : cost + " souls"}</span>
          <button class="train-buy ${maxed ? 'maxed' : ''}" ${maxed || !afford ? 'disabled' : ''} data-upgrade="${u.id}">${maxed ? "MAX" : "Train"}</button>
        </div>
      </div>`;
    }).join("");
    trainingList.querySelectorAll(".train-buy").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.upgrade;
        state.buyUpgrade(id);
        populateHub();
      });
    });
  }

  // Shop
  const shopList = document.getElementById("shop-list");
  if (shopList) {
    const owned = state.ownedItems || [];
    const armourItems = getShopArmour(state);
    const allItems = [
      ...SHOP_CONSUMABLES,
      ...SHOP_ARROWS,
      ...SHOP_QUIVERS,
      ...armourItems,
    ];
    const sections = [
      { id: "items",   label: "Items",   items: SHOP_CONSUMABLES },
      { id: "arrows",  label: "Arrows",  items: SHOP_ARROWS },
      { id: "quivers", label: "Quivers", items: SHOP_QUIVERS },
      { id: "armour",  label: "Armour",  items: armourItems },
    ];
    shopList.innerHTML = sections.map(section => {
      return `<div class="shop-section">
        <div class="shop-section-title" data-toggle="${section.id}">${section.label} ▾</div>
        <div class="shop-section-items" id="shop-section-${section.id}">
          ${section.items.map(item => {
            const isOwned = owned.includes(item.id);
            const afford = state.souls >= item.cost;
            const qual = ARMOUR_QUALITIES.find(q => q.id === item.quality);
            const qualColor = qual ? qual.color : "#e8e4dc";
            return `<div class="shop-item">
              <div class="shop-icon">${item.icon}</div>
              <div class="shop-name" style="color:${qualColor}">${item.name}</div>
              <div class="shop-desc">${item.desc}<br><span style="color:#9aa8b8">${item.stats}</span></div>
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
        state.ownedItems.push(id);
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
      return SHOP_CONSUMABLES.find(i => i.id === id)
        || SHOP_ARROWS.find(i => i.id === id)
        || SHOP_QUIVERS.find(i => i.id === id)
        || ARMOUR_ITEMS.find(i => i.id === id)
        || null;
    }

    equipSlotsEl.innerHTML = EQUIP_SLOTS.map(slot => {
      const itemId = equipped[slot.id];
      const item = itemId ? findItem(itemId) : null;
      let extra = "";
      if (slot.id === "arrows") {
        extra = ` (${quiverCount}/${quiverData?.capacity || 8} + ${storageCount} spares)`;
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
                  <h3 style="margin:0">Storage (${sArr.length})</h3>
                  <div style="color:#6a7a8a;font-size:0.75em">Click to move to quiver</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;overflow-y:auto;flex:1">
                    ${sArr.length === 0 ? '<div style="color:#4a5a6a;font-size:0.8em">Empty</div>' : ''}
                    ${sArr.map((a, i) => `<div class="arrow-card ${a.type}" data-storage="${i}" style="cursor:pointer" title="Move to quiver">${a.type.slice(0,3).toUpperCase()} L${a.level}</div>`).join("")}
                  </div>
                </div>
                <div style="width:1px;background:rgba(255,255,255,0.1)"></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                  <h3 style="margin:0">Quiver (${qArr.length}/${quiver.capacity})</h3>
                  <div style="color:#6a7a8a;font-size:0.75em">Click to move to storage</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;overflow-y:auto;flex:1">
                    ${qArr.map((a, i) => `<div class="arrow-card ${a.type}" data-quiver="${i}" style="cursor:pointer" title="Move to storage">${a.type.slice(0,3).toUpperCase()} L${a.level}</div>`).join("")}
                  </div>
                </div>
              </div>`;
            equipDetail.querySelectorAll("[data-storage]").forEach(el => {
              el.addEventListener("click", () => {
                quiver.moveArrowToQuiver(parseInt(el.dataset.storage));
                populateHub();
                equipSlotsEl.querySelector('[data-slot="arrows"]').click();
              });
            });
            equipDetail.querySelectorAll("[data-quiver]").forEach(el => {
              el.addEventListener("click", () => {
                quiver.moveArrowToStorage(parseInt(el.dataset.quiver));
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
                populateHub();
              });
            });
          }
        } else {
          const allEquipItems = [
            ...ARMOUR_ITEMS.filter(i => i.slot === slotId),
            ...SHOP_CONSUMABLES.filter(i => i.slot === slotId),
          ];
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

// ─── Junction handlers ────────────────────────────────────────
function showJunctionOverlay(choices) {
  if (!junctionOverlay) return;
  junctionOverlay.style.display = "flex";
  junctionOverlay.innerHTML = "";

  const label = document.createElement("div");
  label.className = "junction-title";
  label.textContent = "Choose Path";
  junctionOverlay.appendChild(label);

  choices.forEach((choice) => {
    const btn = document.createElement("div");
    btn.className = "junction-choice-btn";

    const arrowSvg = choice.direction === "left"
      ? '<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="#e8e4dc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
      : choice.direction === "right"
      ? '<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="#e8e4dc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
      : '<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="#e8e4dc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

    const typeLabel = document.createElement("div");
    typeLabel.className = "enemy-label";
    typeLabel.textContent = choice.enemyTypes.slice(0, 3).join(", ");

    btn.innerHTML = arrowSvg;
    btn.appendChild(typeLabel);

    btn.addEventListener("click", () => {
      junctionOverlay.style.display = "none";
      sim.chooseJunction(choice.direction);
    });

    junctionOverlay.appendChild(btn);
  });
}

// ─── UI Update ────────────────────────────────────────────────
function updateUI() {
  if (soulsEl) soulsEl.textContent = sim.state.souls;
  if (hpFill) hpFill.style.width = `${(sim.state.playerHp / sim.state.playerMaxHp) * 100}%`;
  if (hpText) hpText.textContent = `${Math.ceil(sim.state.playerHp)} / ${sim.state.playerMaxHp}`;
  if (waveEl) waveEl.textContent = `Wave ${sim.waveIndex}`;
  if (distEl) distEl.textContent = `${sim.enemies.length} enemies`;

  if (timerEl) {
    const t = Math.floor(sim.runTime || 0);
    const m = Math.floor(t / 60);
    const s = t % 60;
    timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }

  if (queueEl) {
    const queue = sim.quiver.peekQuiver();
    queueEl.innerHTML = queue.map(a =>
      `<span class="arrow-card ${a.type}">${a.type.slice(0, 3).toUpperCase()} L${a.level}</span>`
    ).join("");
  }

  if (hexBar) {
    const hexes = sim.autoMagic.hexes.filter(h => h.unlocked);
    hexBar.innerHTML = hexes.map(h => {
      const pct = Math.floor(h.cooldownProgress * 100);
      const ready = h.isReady;
      return `<div class="magic-icon ${ready ? 'ready' : ''}" title="${h.def.name}">
        <svg viewBox="0 0 32 32" width="32" height="32">
          <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
          <circle cx="16" cy="16" r="14" fill="none" stroke="${h.def.color}" stroke-width="2"
            stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="25"
            style="transform:rotate(-90deg);transform-origin:center"/>
        </svg>
        <span class="magic-label">${h.def.name.split(' ').pop().slice(0,4)}</span>
      </div>`;
    }).join("");
  }

  if (prayerBar) {
    const prayers = sim.autoMagic.prayers.filter(p => p.unlocked);
    prayerBar.innerHTML = prayers.map(p => {
      const pct = Math.floor(p.cooldownProgress * 100);
      const ready = p.isReady;
      return `<div class="magic-icon ${ready ? 'ready' : ''}" title="${p.def.name}">
        <svg viewBox="0 0 32 32" width="32" height="32">
          <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
          <circle cx="16" cy="16" r="14" fill="none" stroke="${p.def.color}" stroke-width="2"
            stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="25"
            style="transform:rotate(-90deg);transform-origin:center"/>
        </svg>
        <span class="magic-label">${p.def.name.split(' ').pop().slice(0,4)}</span>
      </div>`;
    }).join("");
  }

  drawMinimap();

  if (debugPanel) {
    debugPanel.textContent = `wave=${sim.waveIndex} en=${sim.enemies.length} projs=${sim.projectiles.length}`;
  }
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
  mctx.lineWidth = 1;
  mctx.stroke();
}

// ─── Rendering ────────────────────────────────────────────────
function drawCorridor(ctx, cam, eng) {
  const cell = CONFIG.CELL_SIZE;
  const corridorW = CONFIG.CORRIDOR_WIDTH;
  const maxDist = cam.K * 4;

  drawCorridorStraight(ctx, cam, maxDist, cell, corridorW);

  const entities = sim.getAllEntities();
  for (const ent of entities) {
    if (ent.type === "player") drawPlayer(ctx, cam);
    else if (ent.type === "enemy") drawEnemy(ctx, cam, ent.entity);
    else if (ent.type === "projectile") drawProjectile(ctx, cam, ent.entity);
    else if (ent.type === "enemy_projectile") drawEnemyProjectile(ctx, cam, ent.entity);
  }

  input.drawAimLine(ctx);
}

function drawCorridorStraight(ctx, cam, maxDist, cell, corridorW) {
  const canvasH = canvas.clientHeight;
  const canvasW = canvas.clientWidth;
  const scrollOffset = sim.playerWorldZ % cell;

  const backDist = 200;
  const px = cam.project(0, 0);
  const backLeft = cam.project(-HALF_CORRIDOR, 0);
  const backRight = cam.project(HALF_CORRIDOR, 0);
  const backFarL = cam.project(-HALF_CORRIDOR, -backDist);
  const backFarR = cam.project(HALF_CORRIDOR, -backDist);

  ctx.fillStyle = "#0e1218";
  ctx.beginPath();
  ctx.moveTo(backFarL.x, backFarL.y);
  ctx.lineTo(backFarR.x, backFarR.y);
  ctx.lineTo(backRight.x, backRight.y);
  ctx.lineTo(backLeft.x, backLeft.y);
  ctx.closePath();
  ctx.fill();

  const nearLeft = cam.project(-HALF_CORRIDOR, 0);
  const nearRight = cam.project(HALF_CORRIDOR, 0);
  const farLeft = cam.project(-HALF_CORRIDOR, maxDist);
  const farRight = cam.project(HALF_CORRIDOR, maxDist);

  ctx.fillStyle = "#1a2030";
  ctx.beginPath();
  ctx.moveTo(nearLeft.x, nearLeft.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.lineTo(farRight.x, farRight.y);
  ctx.lineTo(farLeft.x, farLeft.y);
  ctx.closePath();
  ctx.fill();

  const endRow = Math.ceil(maxDist / cell) + 1;
  for (let gy = 0; gy < endRow; gy++) {
    const rowDist = gy * cell - scrollOffset;
    if (rowDist > maxDist) break;
    const rowBot = rowDist + cell;
    if (rowBot > maxDist) break;

    const yNear = cam.project(0, rowDist).y;
    const yFar = cam.project(0, rowBot).y;
    if (yFar < -20 || yNear > canvasH + 20) continue;

    if (gy % 2 === 0) {
      const leftNear = cam.project(-HALF_CORRIDOR, rowDist);
      const rightNear = cam.project(HALF_CORRIDOR, rowDist);
      const leftFar = cam.project(-HALF_CORRIDOR, rowBot);
      const rightFar = cam.project(HALF_CORRIDOR, rowBot);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(leftNear.x, yNear);
      ctx.lineTo(rightNear.x, yNear);
      ctx.lineTo(rightFar.x, yFar);
      ctx.lineTo(leftFar.x, yFar);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(80, 95, 120, 0.25)";
  ctx.lineWidth = 0.5;
  for (let gy = 0; gy <= endRow; gy++) {
    const rowDist = gy * cell - scrollOffset;
    if (rowDist > maxDist) break;
    const pL = cam.project(-HALF_CORRIDOR, rowDist);
    const pR = cam.project(HALF_CORRIDOR, rowDist);
    if (pL.y < -20 && pR.y < -20) continue;
    ctx.beginPath();
    ctx.moveTo(pL.x, pL.y);
    ctx.lineTo(pR.x, pR.y);
    ctx.stroke();
  }

  for (let gx = 0; gx <= corridorW; gx++) {
    const worldX = (gx - corridorW / 2) * cell;
    const pNear = cam.project(worldX, 0);
    const pFar = cam.project(worldX, maxDist);
    ctx.strokeStyle = "rgba(80, 95, 120, 0.2)";
    ctx.beginPath();
    ctx.moveTo(pNear.x, pNear.y);
    ctx.lineTo(pFar.x, pFar.y);
    ctx.stroke();
  }

  const wallW = 16;
  const wTop = cam.project(-HALF_CORRIDOR, maxDist);
  const wBot = cam.project(-HALF_CORRIDOR, 0);
  const wTopR = cam.project(HALF_CORRIDOR, maxDist);
  const wBotR = cam.project(HALF_CORRIDOR, 0);

  ctx.fillStyle = "#0c1018";
  ctx.beginPath();
  ctx.moveTo(wTop.x - wallW * 2, wTop.y);
  ctx.lineTo(wTop.x, wTop.y);
  ctx.lineTo(wBot.x, wBot.y);
  ctx.lineTo(wBot.x - wallW * 2, wBot.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(wTopR.x, wTopR.y);
  ctx.lineTo(wTopR.x + wallW * 2, wTopR.y);
  ctx.lineTo(wBotR.x + wallW * 2, wBotR.y);
  ctx.lineTo(wBotR.x, wBotR.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(100, 115, 140, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wTop.x, wTop.y);
  ctx.lineTo(wBot.x, wBot.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wTopR.x, wTopR.y);
  ctx.lineTo(wBotR.x, wBotR.y);
  ctx.stroke();

  for (let i = 1; i <= 8; i++) {
    const td = i * 280 - scrollOffset;
    if (td > maxDist || td < 20) continue;
    const torchL = cam.project(-HALF_CORRIDOR, td);
    const torchR = cam.project(HALF_CORRIDOR, td);
    const torchS = Math.max(12, 120 * torchL.s);

    const flicker = 0.6 + Math.sin(sim.runTime * 4 + i * 2.1) * 0.2;

    const gL = ctx.createRadialGradient(
      torchL.x - wallW * 0.8, torchL.y, 0,
      torchL.x - wallW * 0.8, torchL.y, torchS
    );
    gL.addColorStop(0, `rgba(255, 190, 70, ${0.7 * flicker})`);
    gL.addColorStop(0.15, `rgba(255, 150, 50, ${0.45 * flicker})`);
    gL.addColorStop(0.4, `rgba(200, 90, 25, ${0.15 * flicker})`);
    gL.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gL;
    ctx.beginPath();
    ctx.arc(torchL.x - wallW * 0.8, torchL.y, torchS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 230, 120, ${0.9 * flicker})`;
    ctx.beginPath();
    ctx.arc(torchL.x - wallW * 0.8, torchL.y, Math.max(3, torchS * 0.05), 0, Math.PI * 2);
    ctx.fill();

    const gR = ctx.createRadialGradient(
      torchR.x + wallW * 0.8, torchR.y, 0,
      torchR.x + wallW * 0.8, torchR.y, torchS
    );
    gR.addColorStop(0, `rgba(255, 190, 70, ${0.7 * flicker})`);
    gR.addColorStop(0.15, `rgba(255, 150, 50, ${0.45 * flicker})`);
    gR.addColorStop(0.4, `rgba(200, 90, 25, ${0.15 * flicker})`);
    gR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gR;
    ctx.beginPath();
    ctx.arc(torchR.x + wallW * 0.8, torchR.y, torchS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 230, 120, ${0.9 * flicker})`;
    ctx.beginPath();
    ctx.arc(torchR.x + wallW * 0.8, torchR.y, Math.max(3, torchS * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }

  const gateDist = maxDist * 0.85;
  const gateL = cam.project(-HALF_CORRIDOR, gateDist);
  const gateR = cam.project(HALF_CORRIDOR, gateDist);
  const gateH = Math.max(12, 140 * gateL.s);
  const gateW = Math.max(3, 12 * gateL.s);

  ctx.fillStyle = "#2a3040";
  ctx.fillRect(gateL.x - gateW, gateL.y - gateH, gateW * 2, gateH);
  ctx.fillRect(gateR.x - gateW, gateR.y - gateH, gateW * 2, gateH);

  ctx.fillStyle = "#3a3530";
  ctx.fillRect(gateL.x - gateW * 3, gateL.y - gateH * 0.12, gateW * 6, gateH * 0.12);
  ctx.fillRect(gateR.x - gateW * 3, gateR.y - gateH * 0.12, gateW * 6, gateH * 0.12);

  ctx.strokeStyle = "rgba(120, 130, 150, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gateL.x - gateW * 3, gateL.y - gateH);
  ctx.lineTo(gateR.x + gateW * 3, gateR.y - gateH);
  ctx.stroke();

  if (sim.junctionPending || sim.junctionChoices) {
    const choices = sim.junctionChoices || [];
    const branchLen = 600;
    const branchW = HALF_CORRIDOR;
    const jDist = gateDist;

    for (const choice of choices) {
      if (choice.direction === "left" || choice.direction === "right") {
        const sign = choice.direction === "left" ? -1 : 1;
        const jL = cam.project(sign * branchW * 0.3, jDist);
        const jR = cam.project(sign * branchW * 1.8, jDist);
        const jLF = cam.project(sign * branchW * 0.3 - sign * branchW, jDist + branchLen);
        const jRF = cam.project(sign * branchW * 1.8 - sign * branchW, jDist + branchLen);

        ctx.fillStyle = "#1a2030";
        ctx.beginPath();
        ctx.moveTo(jL.x, jL.y);
        ctx.lineTo(jR.x, jR.y);
        ctx.lineTo(jRF.x, jRF.y);
        ctx.lineTo(jLF.x, jLF.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(100, 115, 140, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(jL.x, jL.y);
        ctx.lineTo(jLF.x, jLF.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(jR.x, jR.y);
        ctx.lineTo(jRF.x, jRF.y);
        ctx.stroke();
      }
    }
  }

  drawDepthFog(ctx, cam, wTop.y, wBot.y);
}

function drawDepthFog(ctx, cam, topY, botY) {
  const fogStr = CAMERA.depthFog;
  if (fogStr > 0.05) {
    const grad = ctx.createLinearGradient(0, topY, 0, botY);
    grad.addColorStop(0, `rgba(6, 8, 10, ${0.3 * fogStr})`);
    grad.addColorStop(0.5, `rgba(8, 10, 12, ${0.08 * fogStr})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, topY - 10, canvas.clientWidth, botY - topY + 20);
  }
}

// ─── Player ──────────────────────────────────────────────────
function drawPlayer(ctx, cam) {
  const px = cam.project(0, 0);
  const s = cam.cell * 0.9 * px.s;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(px.x + 1, px.y + s * 0.22, s * 0.3, deckRy(s * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();

  const m = matsFrom("#4f7eb0");
  box25(ctx, px.x, px.y - s * 0.35, s * 0.5, s * 0.35, s * 0.6, m);

  const hpRatio = sim.state.playerHp / sim.state.playerMaxHp;
  ctx.strokeStyle = hpRatio > 0.5 ? "rgba(100, 200, 100, 0.5)" : "rgba(200, 80, 80, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px.x, px.y + s * 0.15, s * 0.4, deckRy(s * 0.4), 0, 0, Math.PI * 2);
  ctx.stroke();

  if (sim.state.runBonuses.shieldActive && sim.state.runBonuses.shieldHp > 0) {
    ctx.strokeStyle = "rgba(158, 200, 232, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(px.x, px.y + s * 0.15, s * 0.5, deckRy(s * 0.5), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ─── Enemy ───────────────────────────────────────────────────
function drawEnemy(ctx, cam, e) {
  const p = cam.project(e.x, e.dist);
  if (p.y < -50 || p.y > canvas.clientHeight + 50) return;

  const s = cam.cell * e.size * 0.8 * p.s;
  const flash = e._hitFlash > 0 ? 1 + e._hitFlash * 0.3 : 1;

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(p.x + 1, p.y + s * 0.2, s * 0.28, deckRy(s * 0.28), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = e.color;
  ctx.beginPath();
  if (e.behavior === "hover" || e.flying) {
    ctx.moveTo(p.x, p.y - s * 0.4 * flash);
    ctx.lineTo(p.x + s * 0.35 * flash, p.y);
    ctx.lineTo(p.x, p.y + s * 0.15);
    ctx.lineTo(p.x - s * 0.35 * flash, p.y);
    ctx.closePath();
  } else if (e.armor === "heavy") {
    ctx.ellipse(p.x, p.y - s * 0.1, s * 0.42 * flash, deckRy(s * 0.3) * flash, 0, 0, Math.PI * 2);
  } else if (e.armor === "energy") {
    const r = s * 0.35 * flash;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const cr = i % 2 === 0 ? r : r * 0.6;
      const cx = p.x + Math.cos(a) * cr;
      const cy = p.y - s * 0.15 + Math.sin(a) * deckRy(cr);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.closePath();
  } else {
    ctx.ellipse(p.x, p.y - s * 0.15, s * 0.35 * flash, deckRy(s * 0.35) * flash, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  if (e.armor === "insulated") {
    ctx.strokeStyle = "rgba(126, 184, 201, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.12, s * 0.38, deckRy(s * 0.38), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.armor === "energy") {
    ctx.strokeStyle = "rgba(230, 200, 74, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.12, s * 0.38, deckRy(s * 0.38), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (e.shieldHp > 0) {
    const shieldRatio = e.shieldHp / e.maxShieldHp;
    ctx.strokeStyle = `rgba(158, 200, 232, ${0.3 + shieldRatio * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.1, s * 0.4, deckRy(s * 0.4), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const rings = [];
  if (e.burnT > 0) rings.push("rgba(224, 122, 58, 0.7)");
  if (e.slowT > 0) rings.push("rgba(126, 184, 201, 0.7)");
  if (e.poisonT > 0) rings.push("rgba(154, 107, 184, 0.7)");
  if (e.shredT > 0) rings.push("rgba(122, 173, 92, 0.7)");
  for (const col of rings) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.1, s * 0.34, deckRy(s * 0.34), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const ratio = Math.max(0, e.hp / e.maxHp);
  const barW = s * 0.72;
  ctx.fillStyle = "rgba(20,16,12,0.85)";
  ctx.fillRect(p.x - barW / 2 - 1, p.y - s * 0.52 - 1, barW + 2, 5);
  ctx.fillStyle = "rgba(60,55,45,0.9)";
  ctx.fillRect(p.x - barW / 2, p.y - s * 0.52, barW, 3);
  ctx.fillStyle = ratio > 0.35 ? "#8fbf6a" : "#c45a4a";
  ctx.fillRect(p.x - barW / 2, p.y - s * 0.52, barW * ratio, 3);
}

// ─── Projectile ───────────────────────────────────────────────
function drawProjectile(ctx, cam, p) {
  const colors = {
    normal: "#d8d2c4", fire: "#e07a3a", oil: "#8a7040",
    moss: "#6a9a5a", poison: "#9a6bb8", ice: "#7eb8c9",
    piercing: "#e8d5a0", acid: "#7aad5c", shock: "#e6c84a",
    kinetic: "#d8d2c4",
  };
  const col = colors[p.element] || colors.normal;

  const sp = cam.project(p.x, p.dist);
  if (sp.y < -20 || sp.y > canvas.clientHeight + 20) return;
  const r = Math.max(1.5, 3 * sp.s);

  const trail = p._trail || [];
  for (let i = 0; i < trail.length; i++) {
    const a = (i + 1) / trail.length;
    const t0 = cam.project(trail[i].x, trail[i].dist);
    ctx.globalAlpha = a * 0.3;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(t0.x, t0.y, r * 0.4 * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 2.5);
  glow.addColorStop(0, withAlpha(col, 0.4));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyProjectile(ctx, cam, p) {
  const sp = cam.project(p.x, p.dist);
  if (sp.y < -20 || sp.y > canvas.clientHeight + 20) return;
  const r = Math.max(2, 4 * sp.s);
  const col = "#e05a5a";

  const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 2);
  glow.addColorStop(0, withAlpha(col, 0.5));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Arrow Queue ─────────────────────────────────────────────
function drawArrowQueue(ctx) {
  const allArrows = sim.quiver.peekQuiver();
  const queue = allArrows.slice(0, 4);
  const startX = 20;
  const y = canvas.clientHeight - 60;
  const spacing = 52;

  ctx.font = '600 11px "Chakra Petch", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const colorMap = {
    normal: "#d8d2c4", fire: "#e07a3a", oil: "#8a7040",
    moss: "#6a9a5a", poison: "#9a6bb8", ice: "#7eb8c9",
    piercing: "#e8d5a0", acid: "#7aad5c",
    explosive: "#e07a3a", corrosive: "#7aad5c",
    wildfire: "#d4783a", toxic_canopy: "#9a6bb8",
    thermal_shock: "#e6c84a", cryogenic: "#7eb8c9",
    inferno_pierce: "#e8d5a0", shatter: "#7eb8c9",
    sticky_explosive: "#8a7040",
  };

  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    const x = startX + i * spacing + 20;
    const col = colorMap[a.type] || "#d8d2c4";

    ctx.fillStyle = "rgba(20, 16, 12, 0.8)";
    ctx.fillRect(x - 22, y - 20, 44, 40);
    ctx.strokeStyle = withAlpha(col, 0.6);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 22, y - 20, 44, 40);

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 10);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = withAlpha("#ebe6d8", 0.8);
    ctx.fillText(`L${a.level}`, x, y + 26);
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

  if (sim.running) {
    cam.updatePose(sim.state.playerZ);
  }

  engine.draw(dt, (ctx, cam, eng) => {
    try { drawCorridor(ctx, cam, eng); }
    catch(err) { console.error("Draw error:", err); }
  });
  drawArrowQueue(engine.ctx);
  updateUI();
  requestAnimationFrame(gameLoop);
}

// ─── Start ────────────────────────────────────────────────────
sim.state.enterHub();
engine.fit(true);
requestAnimationFrame((now) => {
  lastTime = now;
  gameLoop(now);
});
