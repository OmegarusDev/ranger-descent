/**
 * hub.js — Hub sheets: training, shop, pack, bestiary, options, elevator picker.
 */
import { CONFIG } from "../data/config.js";
import {
  ARMOUR_ITEMS,
  ARMOUR_MATERIALS,
  ARMOUR_QUALITIES,
  ARMOUR_SLOTS,
  SHOP_QUIVERS,
  findItem,
  generateArmourItem,
  isBowItem,
} from "../data/gear.js";
import { shopConsumables } from "../data/consumables.js";
import {
  canSellBagItem,
  canSellOwnedItem,
  canSellStorageArrow,
  getArrowSellValue,
  isBagSlotPouchBound,
  isConsumable,
  moveBagToOwned,
  moveOwnedToBag,
  assignBagSlotFromOwned,
  nextBagUpgrade,
  nextPouchUpgrade,
  normalizeBag,
  normalizePouchBindings,
  bagCapacityStart,
  pouchCapacityStart,
} from "../game/inventory.js";
import { rollShopArrows, getArrowDef, getArrowStats, isWoodType } from "../game/QuiverDeckManager.js";
import { ENEMY_DEFS } from "../game/CorridorSim.js";
import { STAT_INFO, quiverCapacityFromId } from "../game/GameStateManager.js";

/** @type {null | { sim: any, $: Function, coinLabel: Function, COIN: string, saveGame: Function, SAVE_KEY: string, startDungeonRun?: Function }} */
let deps = null;
let sim = null;
let $ = null;
let coinLabel = null;
let COIN = "₡";
let saveGame = () => {};
let SAVE_KEY = "";

let packSel = null;
let packNote = null;
let _shopArmourCache = null;
let _shopArrowCache = null;
let _shopHubVisit = -1;

const TRAINING_METRIC_INFO = {
  hp: "Maximum health after Vigor and equipped gear.",
  dmg: "Flat Strength added to arrow physical damage. Arrow type and level also affect the final hit.",
  rof: "Arrows fired per second. A higher rate means a shorter time between shots; excess equipment weight can reduce it.",
  crit: "Critical-hit damage multiplier and the chance of landing a critical hit.",
  recovery: "Chance that a fired arrow returns after the hall instead of breaking.",
  weight: "Maximum armour carry weight. Current carry weight is the weight of equipped armour only.",
};

export function initHub(d) {
  deps = d;
  sim = d.sim;
  $ = d.$;
  coinLabel = d.coinLabel;
  COIN = d.COIN;
  saveGame = d.saveGame;
  SAVE_KEY = d.SAVE_KEY;

  $("#btn-hub-train").addEventListener("click", () => openHubSheet("sheet-training"));
  $("#btn-hub-shop").addEventListener("click", () => openHubSheet("sheet-shop"));
  $("#btn-pack-bag").addEventListener("click", () => openHubSheet("sheet-pack"));
  $("#btn-bestiary").addEventListener("click", () => openHubSheet("sheet-bestiary"));
  $("#btn-hub-options").addEventListener("click", () => openHubSheet("sheet-options"));
  $("#btn-shop-chest").addEventListener("click", () => openHubSheet("sheet-pack"));
  document.querySelectorAll("[data-close-sheet]").forEach((btn) => {
    btn.addEventListener("click", () => closeHubSheets());
  });

  (function bindHoldReset() {
    const btn = $("#btn-reset-save");
    const fill = $("#btn-reset-fill");
    if (!btn || !fill) return;
    const HOLD_MS = 1400;
    let timer = null;
    let start = 0;
    let raf = 0;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      cancelAnimationFrame(raf);
      btn.classList.remove("holding");
      fill.style.width = "0%";
    };
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / HOLD_MS);
      fill.style.width = `${p * 100}%`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const begin = (e) => {
      e.preventDefault();
      stop();
      start = performance.now();
      btn.classList.add("holding");
      raf = requestAnimationFrame(tick);
      timer = setTimeout(() => {
        stop();
        try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
        location.reload();
      }, HOLD_MS);
    };
    btn.addEventListener("pointerdown", begin);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("click", (e) => e.preventDefault());
  })();

  if (typeof d.startDungeonRun === "function") {
    $("#btn-start").addEventListener("click", () => {
      // New players skip the elevator popup until E1 (floor 11) is unlocked.
      if (sim.state.getMaxElevatorUnlocked() < 1) {
        d.startDungeonRun();
        return;
      }
      openElevatorModal();
    });
    $("#btn-elev-cancel").addEventListener("click", () => {
      closeElevatorModal();
    });
    $("#btn-elev-go").addEventListener("click", () => {
      d.startDungeonRun();
    });
    $("#elev-modal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeElevatorModal();
    });
  }
}

export function closeHubSheets() {
  document.querySelectorAll(".hub-sheet").forEach((el) => el.classList.remove("open"));
  hidePackOverlays();
}
function openHubSheet(id) {
  closeElevatorModal();
  closeHubSheets();
  const sheet = document.getElementById(id);
  if (sheet) sheet.classList.add("open");
}

/** Flavor copy for the hub bestiary — stats come from ENEMY_DEFS. */
const BESTIARY_META = {
  slime: { name: "Slime", behavior: "Oozes forward with a slow, wet pulse" },
  slime_large: { name: "Large Slime", behavior: "Tougher slime that splits into 2 smaller slimes on death" },
  slime_huge: { name: "Huge Slime", behavior: "Massive slime that splits into 2 Large Slimes" },
  goblin_runt: { name: "Goblin Runt", behavior: "Walks forward, then dodges side to side in a rhythm" },
  goblin_warrior: { name: "Goblin Warrior", behavior: "Heavier goblin — floor-1 hall boss with escorts" },
  goblin_chieftain: { name: "Goblin Chieftain", behavior: "Powerful goblin leader, slow but devastating" },
  imp: { name: "Imp", behavior: "Notices you, then charges the lane" },
  scamp: { name: "Scamp", behavior: "Faster imp variant, charges quickly" },
  demon: { name: "Demon", behavior: "Slow, heavy, devastating charger" },
  skeleton: { name: "Skeleton", behavior: "Steady advance down the hall" },
  skeleton_archer: { name: "Skeleton Archer", behavior: "Stops at range and fires bone arrows at you" },
  ghoul: { name: "Ghoul", behavior: "Shambling undead" },
  wight: { name: "Wight", behavior: "Tougher ghoul, steady advance" },
  wraith: { name: "Wraith", behavior: "Phases through attacks, zigzags unpredictably" },
  vampire: { name: "Vampire", behavior: "Notices player, charges, drains HP" },
  vampire_lord: { name: "Vampire Lord", behavior: "Faster, stronger vampire" },
  lich: { name: "Lich", behavior: "Ranged magic, summons minions" },
  bat: { name: "Bat", behavior: "Hovers in the hall, might poison" },
  spider: { name: "Spider", behavior: "Creeps forward, might poison" },
  giant_spider: { name: "Giant Spider", behavior: "Larger, tougher spider" },
  orc: { name: "Orc", behavior: "Tough, steady advance" },
  ogre: { name: "Ogre", behavior: "Very tough, slow, heavy" },
  troll: { name: "Troll", behavior: "Regenerates HP while alive" },
};

const ENEMY_DEFS_BESTIARY = Object.keys(BESTIARY_META).map((id) => {
  const d = ENEMY_DEFS[id] || {};
  const m = BESTIARY_META[id];
  const armor = (d.armor || "none");
  return {
    id,
    name: m.name,
    hp: d.hp || 1,
    dmg: d.contactDmg || 1,
    speed: d.speed || 1,
    coins: `${d.coinMin ?? 0}–${d.coinMax ?? 0}₡`,
    armor: armor.charAt(0).toUpperCase() + armor.slice(1),
    color: d.color || "#888",
    behavior: m.behavior,
  };
});

/** Always the next 3 upgrades after the equipped quiver's capacity. */
function getShopQuivers(state) {
  const cur = quiverCapacityFromId(state.equipped?.quiver);
  return SHOP_QUIVERS.filter((q) => q.capacity > cur).slice(0, 3);
}

function getShopKit(state) {
  const items = [];
  const bagNext = nextBagUpgrade(state);
  if (bagNext.ok) {
    items.push({
      id: `bag_slot_${bagNext.next}`,
      name: `Bag Slot ${bagNext.next}`,
      cost: bagNext.cost,
      desc: `Carry ${bagNext.next} items into the dungeon. Cheaper than a pouch slot.`,
      stats: `${state.bagCapacity} → ${bagNext.next} bag slots`,
      icon: "🎒",
      section: "kit",
      kind: "bag_upgrade",
    });
  }
  const pouchNext = nextPouchUpgrade(state);
  if (pouchNext.ok || pouchNext.reason === "bag") {
    const locked = pouchNext.reason === "bag";
    items.push({
      id: `pouch_slot_${pouchNext.next}`,
      name: `Pouch Slot ${pouchNext.next}`,
      cost: pouchNext.cost,
      desc: locked
        ? `Need a ${pouchNext.need}-slot bag before this combat hotkey can be bought.`
        : "Tap this slot in combat without opening the bag.",
      stats: locked
        ? `Requires a ${pouchNext.need}-slot bag`
        : `${state.pouchCapacity} → ${pouchNext.next} pouch slots`,
      icon: "✚",
      section: "kit",
      kind: "pouch_upgrade",
      locked,
    });
  }
  return items;
}

const DOLL_SLOTS = [
  { id: "cape", name: "Cape" },
  { id: "head", name: "Head" },
  { id: "amulet", name: "Amulet" },
  { id: "bow", name: "Bow" },
  { id: "body", name: "Torso" },
  { id: "dagger", name: "Dagger" },
  { id: "arms", name: "Arms" },
  { id: "belt", name: "Belt" },
  { id: "quiver", name: "Quiver" },
  { id: "legs", name: "Legs" },
  { id: "feet", name: "Feet" },
];

const GEAR_PICK_SLOTS = new Set(DOLL_SLOTS.map((s) => s.id));

function ensureStarterKit(state) {
  if (!state.ownedItems) state.ownedItems = [];
  if (!state.equipped) state.equipped = {};
  state.bagCapacity = state.bagCapacity || bagCapacityStart();
  state.pouchCapacity = state.pouchCapacity || pouchCapacityStart();
  state.bag = normalizeBag(state.bag, state.bagCapacity);
  state.pouchBindings = normalizePouchBindings(state.pouchBindings, state.pouchCapacity, state.bagCapacity, state.bag);
  const needsStarters = !(state.ownedItems || []).includes("bow_hunting");
  const starters = ["bow_hunting", "dagger_iron", "amulet_greenhorn", "quiver_basic"];
  for (const id of starters) {
    if (!state.ownedItems.includes(id)) state.ownedItems.push(id);
  }
  if (!state.equipped.bow) state.equipped.bow = "bow_hunting";
  if (!state.equipped.dagger) state.equipped.dagger = "dagger_iron";
  if (state.equipped.amulet === undefined) state.equipped.amulet = "amulet_greenhorn";
  if (!state.equipped.quiver) state.equipped.quiver = "quiver_basic";
  const hasSalve = (state.ownedItems || []).includes("potion_salve")
    || (state.bag || []).includes("potion_salve");
  if (needsStarters && !hasSalve) state.ownedItems.push("potion_salve");
}

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
    for (const slot of ARMOUR_SLOTS) {
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


function refreshShopCaches(state) {
  const visit = state.hubVisits || 0;
  if (_shopHubVisit !== visit || !_shopArmourCache || !_shopArrowCache) {
    _shopArmourCache = rollShopArmour(mulberry32(0x9E3779B9 + visit * 0x85ebca6b), state.getStat("luck"));
    _shopArrowCache = rollShopArrows(
      3,
      mulberry32(0xC2B2AE35 + visit * 0x27d4eb2d),
      visit,
      state.getMaxElevatorUnlocked()
    );
    _shopHubVisit = visit;
  }
}

const ARMOUR_LOAD_SLOTS = ["head", "body", "arms", "belt", "legs", "feet", "cape"];

export function syncArmorRating(state) {
  let rating = 0;
  let load = 0;
  for (const slot of ARMOUR_LOAD_SLOTS) {
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


/** Hub / equip / post-death: sync capacity, pack loaded shafts, craft-fill empties only. */
export function refillQuiverEmptySlots(state = sim.state) {
  sim.quiver.capacity = state.getQuiverCapacity();
  sim.quiver.packForHub();
  sim.quiver.fillEmptySlots(state.getCraftFillerType());
}

function equippedIds(state) {
  return new Set(Object.values(state.equipped || {}).filter(Boolean));
}

function inspectItem(item, extra = "") {
  const el = document.getElementById("pack-inspect");
  if (!el) return;
  if (!item) {
    el.textContent = extra || "Tap a slot to change it.";
    return;
  }
  el.innerHTML = `<b>${item.name}</b> — ${item.desc || ""} ${item.stats ? `<span>${item.stats}</span>` : ""}`;
}

function hidePackOverlays() {
  const picker = document.getElementById("pack-picker");
  const tip = document.getElementById("pack-tip");
  if (picker) {
    if (picker._awayHandler) {
      document.removeEventListener("pointerdown", picker._awayHandler, true);
      picker._awayHandler = null;
    }
    picker.hidden = true;
    picker.innerHTML = "";
  }
  if (tip) tip.hidden = true;
}

function placeNear(el, anchorEl, clientX, clientY) {
  const root = document.getElementById("pack-root") || document.getElementById("sheet-pack");
  if (!root || !el) return;
  const rr = root.getBoundingClientRect();
  let x = (clientX != null ? clientX : (anchorEl?.getBoundingClientRect().left || rr.left)) - rr.left;
  let y = (clientY != null ? clientY : (anchorEl?.getBoundingClientRect().bottom || rr.top)) - rr.top + 8;
  el.hidden = false;
  el.style.left = "0px";
  el.style.top = "0px";
  const w = el.offsetWidth || 220;
  const h = el.offsetHeight || 120;
  x = Math.max(6, Math.min(x, rr.width - w - 6));
  y = Math.max(6, Math.min(y, rr.height - h - 6));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function showPackTip(item, anchorEl, clientX, clientY) {
  const tip = document.getElementById("pack-tip");
  if (!tip || !item) return;
  hidePackOverlays();
  tip.innerHTML = `<b>${item.name}</b>${item.desc || ""}${item.stats ? `<span>${item.stats}</span>` : ""}`;
  placeNear(tip, anchorEl, clientX, clientY);
}

function arrowPackLabel(type) {
  const def = getArrowDef(type);
  return (def.name || "Arrow").replace(/ Arrow$/i, "");
}

function openPackPicker(title, options, anchorEl, evt) {
  const picker = document.getElementById("pack-picker");
  if (!picker) return;
  const tip = document.getElementById("pack-tip");
  if (tip) tip.hidden = true;
  if (picker._awayHandler) {
    document.removeEventListener("pointerdown", picker._awayHandler, true);
    picker._awayHandler = null;
  }
  picker.innerHTML = `<div class="pack-picker-title">${title}</div>` + options.map((opt, i) =>
    `<button type="button" class="${opt.current ? "current" : ""}" data-pick="${i}">
      <span>${opt.label}</span>
      ${opt.sub ? `<small>${opt.sub}</small>` : ""}
    </button>`
  ).join("");
  placeNear(picker, anchorEl, evt?.clientX, evt?.clientY);
  picker.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const opt = options[parseInt(btn.dataset.pick, 10)];
      hidePackOverlays();
      if (opt && opt.onPick) opt.onPick();
    });
  });
  // Close when tapping outside (defer so the opening click doesn't dismiss it).
  requestAnimationFrame(() => {
    const onAway = (e) => {
      if (picker.hidden) return;
      if (picker.contains(e.target)) return;
      hidePackOverlays();
    };
    picker._awayHandler = onAway;
    document.addEventListener("pointerdown", onAway, true);
  });
}

function populatePack(state) {
  const quiverSlots = document.getElementById("pack-quiver-slots");
  const quiverCount = document.getElementById("pack-quiver-count");
  const dollEl = document.getElementById("pack-doll");
  const bagEl = document.getElementById("pack-bag-slots");
  const pouchEl = document.getElementById("pack-pouch-slots");
  const chestEl = document.getElementById("pack-chest-grid");
  if (!quiverSlots || !dollEl || !bagEl || !chestEl) return;

  hidePackOverlays();
  const q = sim.quiver;
  const loaded = q.peekQuiver();
  const cap = q.capacity;
  const stored = q.peekStorage();
  const worn = equippedIds(state);
  const bag = state.bag || [null, null];
  const pouchBindings = state.pouchBindings || [null];
  const pouchCap = state.pouchCapacity || 1;

  const bagCountEl = document.getElementById("pack-bag-count");
  const pouchCountEl = document.getElementById("pack-pouch-count");
  if (bagCountEl) bagCountEl.textContent = String(state.bagCapacity || bag.length);
  if (pouchCountEl) pouchCountEl.textContent = String(pouchCap);

  if (quiverCount) quiverCount.textContent = `${loaded.length} / ${cap}`;

  const cells = [];
  for (let i = 0; i < cap; i++) {
    const a = loaded[i];
    if (a) {
      const def = getArrowDef(a.type);
      cells.push(`<button type="button" class="pack-cell pack-cell-arrow" data-q="${i}" style="border-color:${def.color}" title="${def.name}">
        <span class="pack-cell-mark">${arrowPackLabel(a.type)}</span>
        <span class="pack-cell-sub">Lv${a.level}</span>
      </button>`);
    } else {
      cells.push(`<button type="button" class="pack-cell pack-cell-empty" data-q-empty="${i}" aria-label="Empty quiver slot"></button>`);
    }
  }
  quiverSlots.innerHTML = cells.join("");
  const cols = Math.max(2, Math.floor(cap / 2));
  quiverSlots.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  dollEl.innerHTML = DOLL_SLOTS.map((slot) => {
    const item = findItem(state.equipped?.[slot.id]);
    const rare = slot.id === "cape" || slot.id === "amulet";
    return `<button type="button" class="pack-slot pack-slot-${slot.id}${item ? " filled" : ""}${rare && !item ? " rare" : ""}" data-slot="${slot.id}">
      <span class="pack-slot-lab">${slot.name}</span>
      <span class="pack-slot-name">${item ? item.name : rare ? "—" : "Empty"}</span>
    </button>`;
  }).join("");

  bagEl.style.gridTemplateColumns = `repeat(${Math.min(2, Math.max(1, bag.length))}, minmax(0, 1fr))`;
  bagEl.innerHTML = bag.map((id, i) => {
    const item = findItem(id);
    const bound = isBagSlotPouchBound(state, i);
    return `<button type="button" class="pack-cell ${item ? "filled" : "pack-cell-empty"}" data-bag="${i}">
      ${item ? `<span class="pack-cell-mark">${item.icon || "✚"}</span><span class="pack-cell-sub">${item.short || item.name}</span>${bound ? `<span class="pack-cell-sub">pouch</span>` : ""}` : `<span class="pack-cell-sub">empty</span>`}
    </button>`;
  }).join("");

  if (pouchEl) {
    pouchEl.innerHTML = Array.from({ length: pouchCap }, (_, i) => {
      const bagIndex = pouchBindings[i];
      const item = bagIndex != null ? findItem(bag[bagIndex]) : null;
      return `<button type="button" class="pack-cell ${item ? "filled" : "pack-cell-empty"}" data-pouch="${i}">
        <span class="pack-pouch-num">${i + 1}</span>
        ${item ? `<span class="pack-cell-mark">${item.icon || "✚"}</span><span class="pack-cell-sub">${item.short || item.name}</span>` : `<span class="pack-cell-sub">empty</span>`}
      </button>`;
    }).join("");
  }

  const chestItems = [];
  stored.forEach((a, i) => chestItems.push({ kind: "arrow", i, arrow: a }));
  (state.ownedItems || []).forEach((id, ownedIndex) => {
    if (worn.has(id)) return;
    const item = findItem(id);
    if (item) chestItems.push({ kind: "gear", ownedIndex, id, item });
  });

  chestEl.innerHTML = chestItems.length
    ? chestItems.map((c) => {
      if (c.kind === "arrow") {
        const def = getArrowDef(c.arrow.type);
        return `<button type="button" class="pack-cell pack-cell-arrow" data-chest-a="${c.i}" style="border-color:${def.color}">
          <span class="pack-cell-mark">${arrowPackLabel(c.arrow.type)}</span>
          <span class="pack-cell-sub">Lv${c.arrow.level}</span>
        </button>`;
      }
      return `<button type="button" class="pack-cell filled" data-chest-g="${c.ownedIndex}">
        <span class="pack-cell-mark">${c.item.icon || "•"}</span>
        <span class="pack-cell-sub">${c.item.name}</span>
      </button>`;
    }).join("")
    : `<div class="pack-chest-empty">Chest is empty. Buy shafts in the shop.</div>`;

  const load = state.equipLoad || 0;
  const maxLoad = state.getMaxEquipLoad();
  const loadEl = document.getElementById("pack-load");
  if (loadEl) {
    loadEl.textContent = `Weight ${load} / ${maxLoad}`;
    loadEl.classList.toggle("overencumbered", load > maxLoad);
  }

  if (packNote) {
    inspectItem(null, packNote);
    packNote = null;
  } else if (!packSel) {
    inspectItem(null, "Tap a slot to change it.");
  }

  const sellNote = (reason) => {
    if (reason === "bow") return "Bows cannot be sold.";
    if (reason === "equipped") return "Unequip this before selling.";
    if (reason === "pouch") return "Unbind this from the pouch before selling.";
    if (reason === "wood") return "Wood never reaches storage.";
    if (reason === "disabled") return "Arrow selling is turned off.";
    return "Cannot sell this.";
  };

  const afterSell = (result, item) => {
    if (!result.ok) {
      inspectItem(item || null, sellNote(result.reason));
      return;
    }
    packNote = `Sold for ${coinLabel(result.value)}.`;
    saveGame();
    populateHub();
  };

  const openQuiverPicker = (slotIndex, el, evt) => {
    const current = loaded[slotIndex];
    const options = [];
    if (current) {
      const def = getArrowDef(current.type);
      options.push({
        label: def.name,
        sub: `Equipped · Lv${current.level}`,
        current: true,
        onPick: () => {},
      });
      if (!isWoodType(current.type)) {
        options.push({
          label: "Store in chest",
          sub: "Clear this slot",
          onPick: () => {
            q.setQuiverSlot(slotIndex, null);
            saveGame();
            populateHub();
          },
        });
      }
    } else {
      options.push({ label: "Empty", sub: "No arrow here", current: true, onPick: () => {} });
    }
    stored.forEach((a, si) => {
      const def = getArrowDef(a.type);
      options.push({
        label: def.name,
        sub: `Chest · Lv${a.level}`,
        onPick: () => {
          q.setQuiverSlot(current ? slotIndex : loaded.length, si);
          saveGame();
          populateHub();
        },
      });
    });
    if (stored.length === 0 && !current) {
      options.push({ label: "No spare arrows", sub: "Buy arrows in the shop", onPick: () => {} });
    }
    openPackPicker(current ? "Change arrow" : "Load arrow", options, el, evt);
  };

  quiverSlots.querySelectorAll("[data-q], [data-q-empty]").forEach((el) => {
    el.addEventListener("click", (evt) => {
      const i = parseInt(el.dataset.q != null ? el.dataset.q : el.dataset.qEmpty, 10);
      openQuiverPicker(i, el, evt);
    });
  });

  chestEl.querySelectorAll("[data-chest-a]").forEach((el) => {
    const i = parseInt(el.dataset.chestA, 10);
    const arrow = stored[i];
    const def = getArrowDef(arrow.type);
    const tipItem = { name: def.name, desc: def.desc, stats: getArrowStats(arrow.type, arrow.level) };
    el.addEventListener("pointerenter", (evt) => showPackTip(tipItem, el, evt.clientX, evt.clientY));
    el.addEventListener("pointerleave", () => {
      const tip = document.getElementById("pack-tip");
      if (tip) tip.hidden = true;
    });
    el.addEventListener("click", (evt) => {
      const sellCheck = canSellStorageArrow(arrow.type);
      const options = [
        { label: def.name, sub: `Chest · Lv${arrow.level}`, current: true, onPick: () => inspectItem(tipItem) },
        {
          label: "Load into quiver",
          sub: "Fill an empty slot",
          onPick: () => {
            if (q.setQuiverSlot(loaded.length, i)) {
              packNote = "Loaded into the quiver.";
              saveGame();
              populateHub();
            } else {
              inspectItem(def, "Quiver is full. Tap a quiver slot to swap.");
            }
          },
        },
      ];
      if (sellCheck.ok) {
        const value = getArrowSellValue(arrow.type, arrow.level);
        options.push({
          label: `Sell for ${coinLabel(value)}`,
          sub: "Remove this shaft",
          onPick: () => afterSell(sim.sellStorageArrow(i), tipItem),
        });
      } else {
        options.push({ label: "Cannot sell", sub: sellNote(sellCheck.reason), onPick: () => inspectItem(tipItem, sellNote(sellCheck.reason)) });
      }
      openPackPicker(def.name, options, el, evt);
    });
  });

  chestEl.querySelectorAll("[data-chest-g]").forEach((el) => {
    const ownedIndex = parseInt(el.dataset.chestG, 10);
    const id = state.ownedItems[ownedIndex];
    const item = findItem(id);
    if (!item) return;
    el.addEventListener("pointerenter", (evt) => showPackTip(item, el, evt.clientX, evt.clientY));
    el.addEventListener("pointerleave", () => {
      const tip = document.getElementById("pack-tip");
      if (tip) tip.hidden = true;
    });
    el.addEventListener("click", (evt) => {
      const options = [
        { label: item.name, sub: item.stats || "In chest", current: true, onPick: () => inspectItem(item) },
      ];
      if (isConsumable(id)) {
        options.push({
          label: "Put in bag",
          sub: "Carry this into the dungeon",
          onPick: () => {
            const moved = moveOwnedToBag(state, ownedIndex);
            if (!moved.ok) inspectItem(item, "Bag is full. Tap a bag slot to swap.");
            else {
              saveGame();
              populateHub();
            }
          },
        });
      } else if (item.slot && GEAR_PICK_SLOTS.has(item.slot) && !isBowItem(item)) {
        options.push({
          label: "Equip",
          sub: item.stats || "",
          onPick: () => {
            state.equipped[item.slot] = item.id;
            if (item.slot === "quiver") refillQuiverEmptySlots(state);
            saveGame();
            populateHub();
          },
        });
      }
      const sellCheck = canSellOwnedItem(state, ownedIndex);
      if (sellCheck.ok) {
        options.push({
          label: `Sell for ${coinLabel(sellCheck.value)}`,
          sub: "Remove this item",
          onPick: () => afterSell(sim.sellOwnedItem(ownedIndex), item),
        });
      } else {
        options.push({
          label: "Cannot sell",
          sub: sellNote(sellCheck.reason),
          onPick: () => inspectItem(item, sellNote(sellCheck.reason)),
        });
      }
      openPackPicker(item.name, options, el, evt);
    });
  });

  dollEl.querySelectorAll("[data-slot]").forEach((el) => {
    el.addEventListener("click", (evt) => {
      const slot = el.dataset.slot;
      const current = findItem(state.equipped?.[slot]);
      const options = [];
      if (current) {
        options.push({
          label: current.name,
          sub: current.stats || "Equipped",
          current: true,
          onPick: () => inspectItem(current),
        });
        if (slot !== "bow") {
          options.push({
            label: slot === "dagger" || slot === "quiver" ? "Revert to starter" : "Unequip",
            sub: "Clear this slot",
            onPick: () => {
              if (slot === "dagger") state.equipped.dagger = "dagger_iron";
              else if (slot === "quiver") {
                state.equipped.quiver = "quiver_basic";
                refillQuiverEmptySlots(state);
              } else state.equipped[slot] = null;
              saveGame();
              populateHub();
            },
          });
        }
      } else {
        options.push({ label: "Empty", sub: "Nothing equipped", current: true, onPick: () => {} });
      }
      const candidates = (state.ownedItems || [])
        .map(findItem)
        .filter((it) => it && it.slot === slot && it.id !== state.equipped?.[slot]);
      for (const it of candidates) {
        options.push({
          label: it.name,
          sub: it.stats || it.desc || "",
          onPick: () => {
            state.equipped[slot] = it.id;
            if (slot === "quiver") refillQuiverEmptySlots(state);
            saveGame();
            populateHub();
          },
        });
      }
      if (candidates.length === 0 && !current) {
        options.push({ label: "Nothing in chest", sub: "Buy gear in the shop", onPick: () => {} });
      }
      openPackPicker(slot, options, el, evt);
    });
  });

  bagEl.querySelectorAll("[data-bag]").forEach((el) => {
    el.addEventListener("click", (evt) => {
      const i = parseInt(el.dataset.bag, 10);
      const current = findItem(bag[i]);
      const options = [];
      if (current) {
        options.push({
          label: current.name,
          sub: current.stats || "In bag",
          current: true,
          onPick: () => inspectItem(current),
        });
        const bound = isBagSlotPouchBound(state, i);
        if (bound) {
          options.push({
            label: "Unbind from pouch",
            sub: "Keep the item in the bag",
            onPick: () => {
              state.clearPouchForBagSlot(i);
              saveGame();
              populateHub();
            },
          });
        } else {
          const emptyPouch = (state.pouchBindings || []).findIndex((slot) => slot == null);
          if (emptyPouch >= 0) {
            options.push({
              label: "Bind to pouch",
              sub: "Quick-use during a run",
              onPick: () => {
                state.bindPouch(emptyPouch, i);
                saveGame();
                populateHub();
              },
            });
          }
        }
        options.push({
          label: "Put back in chest",
          sub: "Clear this cell",
          onPick: () => {
            moveBagToOwned(state, i);
            saveGame();
            populateHub();
          },
        });
        const sellCheck = canSellBagItem(state, i);
        if (sellCheck.ok) {
          options.push({
            label: `Sell for ${coinLabel(sellCheck.value)}`,
            sub: "Remove this item",
            onPick: () => afterSell(sim.sellBagItem(i), current),
          });
        }
      } else {
        options.push({ label: "Empty", sub: "No vial here", current: true, onPick: () => {} });
      }
      (state.ownedItems || []).forEach((id, ownedIndex) => {
        if (!isConsumable(id)) return;
        const it = findItem(id);
        if (!it) return;
        options.push({
          label: it.name,
          sub: "From chest",
          onPick: () => {
            assignBagSlotFromOwned(state, i, ownedIndex);
            saveGame();
            populateHub();
          },
        });
      });
      if (!current && !(state.ownedItems || []).some(isConsumable)) {
        options.push({ label: "No potions", sub: "Buy one in the shop", onPick: () => {} });
      }
      openPackPicker("Bag", options, el, evt);
    });
  });

  pouchEl?.querySelectorAll("[data-pouch]").forEach((el) => {
    el.addEventListener("click", (evt) => {
      const pouchIndex = parseInt(el.dataset.pouch, 10);
      const bound = pouchBindings[pouchIndex];
      const current = bound != null ? findItem(bag[bound]) : null;
      const options = [];
      if (current) {
        options.push({
          label: current.name,
          sub: `Bag slot ${bound + 1}`,
          current: true,
          onPick: () => inspectItem(current),
        });
        options.push({
          label: "Unbind",
          sub: "Keep the item in the bag",
          onPick: () => {
            state.bindPouch(pouchIndex, null);
            saveGame();
            populateHub();
          },
        });
      } else {
        options.push({ label: "Empty", sub: "No quick-use bound", current: true, onPick: () => {} });
      }
      bag.forEach((id, bagIndex) => {
        if (!id) return;
        const it = findItem(id);
        if (!it) return;
        options.push({
          label: it.name,
          sub: `Bind bag slot ${bagIndex + 1}`,
          onPick: () => {
            state.bindPouch(pouchIndex, bagIndex);
            saveGame();
            populateHub();
          },
        });
      });
      if (!current && !bag.some(Boolean)) {
        options.push({ label: "Bag is empty", sub: "Move a potion into the bag first", onPick: () => {} });
      }
      openPackPicker("Quick Pouch", options, el, evt);
    });
  });
}

export function closeElevatorModal() {
  const modal = document.getElementById("elev-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

export function openElevatorModal() {
  renderElevatorPicker();
  const modal = document.getElementById("elev-modal");
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function renderElevatorPicker() {
  const root = document.getElementById("elev-pick");
  const goBtn = document.getElementById("btn-elev-go");
  if (!root) return;
  const state = sim.state;
  const startElevs = CONFIG.START_ELEVATORS || 9;
  const max = state.getMaxElevatorUnlocked();
  const sel = state.getStartElevator();
  const chips = [];
  chips.push(
    `<button type="button" class="elev-chip ${sel === 0 ? "selected" : ""}" data-elev="0" aria-label="Gate">Gate</button>`
  );
  for (let i = 1; i <= startElevs; i++) {
    const locked = i > max;
    const selected = i === sel;
    chips.push(
      `<button type="button" class="elev-chip ${selected ? "selected" : ""}" data-elev="${i}" ${locked ? "disabled" : ""} aria-label="Elevator ${i}">E${i}</button>`
    );
  }
  root.innerHTML = chips.join("");
  root.querySelectorAll("[data-elev]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.setStartElevator(Number(btn.dataset.elev));
      saveGame();
      renderElevatorPicker();
    });
  });
  if (goBtn) {
    goBtn.textContent = sel === 0 ? "Descend" : `Descend E${sel}`;
  }
}

export function populateHub() {
  const state = sim.state;
  ensureStarterKit(state);
  refillQuiverEmptySlots(state);
  syncArmorRating(state);
  state.applyUpgrades();
  const coinsEl = document.getElementById("hub-coins");
  if (coinsEl) coinsEl.textContent = state.coins;
  renderElevatorPicker();

  // Training
  const trainingList = document.getElementById("training-list");
  if (trainingList) {
    const cd = state.getArrowCooldown();
    const crit = Math.round(state.getCritChance() * 100);
    const critX = state.getCritMultiplier().toFixed(1);
    const cost = state.getUpgradeCost();
    const charLevel = state.getCharacterLevel();
    const rof = 1 / cd;
    const recovery = Math.round(state.getArrowReturnChance() * 100);
    const equipMax = state.getMaxEquipLoad();
    const allMaxed = STAT_INFO.every((u) => state.isUpgradeMaxed(u.id));
    const metrics = [
      { id: "hp", value: state.playerMaxHp, label: "HP" },
      { id: "dmg", value: `+${state.getStrengthBonus()}`, label: "DMG" },
      { id: "rof", value: `${rof.toFixed(2)}/s`, label: "ROF" },
      { id: "crit", value: `${critX}x / ${crit}%`, label: "Crit dmg / %" },
      { id: "recovery", value: `${recovery}%`, label: "Arrow rec." },
      { id: "weight", value: equipMax, label: "Weight max." },
    ];
    trainingList.innerHTML = `
      <div class="train-summary">
        <span>Lvl ${charLevel}</span><span class="train-divider">/</span>
        <span>Coins: ${coinLabel(state.coins)}</span><span class="train-divider">/</span>
        <span class="train-summary-next">Next lvlup: ${allMaxed ? "MAX" : coinLabel(cost)}</span>
      </div>
      <div class="train-stats" aria-label="Current ranger stats">
        ${metrics.map((metric) => `<details class="train-stat train-metric">
          <summary aria-label="${metric.label} information"><strong>${metric.value}</strong><span>${metric.label}</span></summary>
          <div class="train-hint-popover">${TRAINING_METRIC_INFO[metric.id]}</div>
        </details>`).join("")}
      </div>
      <div class="train-upgrades">
    ` + STAT_INFO.map((u) => {
      const lvl = state.getStat(u.id);
      const maxed = state.isUpgradeMaxed(u.id);
      const afford = state.coins >= cost;
      return `<div class="train-row">
        <div class="train-info">
          <div class="train-name-line">
            <div class="train-name">${u.name}</div>
            <details class="train-hint">
              <summary aria-label="${u.name} information">i</summary>
              <div class="train-hint-popover">${u.desc}</div>
            </details>
          </div>
        </div>
        <div class="train-right">
          <span class="train-level">${lvl}</span>
          <button class="train-buy ${maxed ? "maxed" : ""}" ${maxed || !afford ? "disabled" : ""} data-upgrade="${u.id}">${maxed ? "MAX" : "Train"}</button>
        </div>
      </div>`;
    }).join("") + `</div>`;
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
    const quiverItems = getShopQuivers(state);
    const potionItems = shopConsumables();
    const kitItems = getShopKit(state);
    const sections = [
      { id: "arrows",  label: "Arrows",  items: arrowItems },
      { id: "potions", label: "Supplies", items: potionItems },
      { id: "kit",     label: "Pack",    items: kitItems },
      { id: "quivers", label: "Quivers", items: quiverItems },
      { id: "armour",  label: "Armour",  items: armourItems },
    ].filter((section) => section.items.length > 0);
    shopList.innerHTML = sections.map(section => {
      return `<div class="shop-section">
        <div class="shop-section-title" data-toggle="${section.id}">${section.label} ▾</div>
        <div class="shop-section-items" id="shop-section-${section.id}">
          ${section.items.map(item => {
            const repeatable = item.section === "arrows" || item.section === "potions";
            const isOwned = !repeatable && item.section !== "kit" && owned.includes(item.id);
            const locked = !!item.locked;
            const afford = !locked && state.coins >= item.cost;
            const qual = ARMOUR_QUALITIES.find(q => q.id === item.quality);
            const qualColor = qual ? qual.color : "#e8e4dc";
            const costLabel = isOwned ? "Owned" : coinLabel(item.cost);
            const buyLabel = locked ? "Locked" : (isOwned ? "Owned" : "Buy");
            return `<div class="shop-item">
              <div class="shop-icon">${item.icon}</div>
              <div class="shop-name" style="color:${qualColor}">${item.name}</div>
              <div class="shop-desc">${item.desc}<br><span style="color:#8a7348">${item.stats}</span></div>
              <div class="shop-bottom">
                <span class="shop-cost">${costLabel}</span>
                <button class="shop-buy ${isOwned ? 'owned' : ''}${locked ? ' locked' : ''}" ${isOwned || !afford ? 'disabled' : ''} data-item="${item.id}">${buyLabel}</button>
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
        const item = arrowItems.find((i) => i.id === id)
          || potionItems.find((i) => i.id === id)
          || kitItems.find((i) => i.id === id)
          || quiverItems.find((i) => i.id === id)
          || armourItems.find((i) => i.id === id)
          || findItem(id);
        if (!item) return;
        if (item.kind === "bag_upgrade") {
          if (!state.buyBagSlot()) return;
        } else if (item.kind === "pouch_upgrade") {
          if (!state.buyPouchSlot()) return;
        } else {
          if (!state.spendCoins(item.cost)) return;
          if (!state.ownedItems) state.ownedItems = [];
          if (item.section === "arrows") {
            const arrow = {
              type: item.element || item.type || "wood",
              level: item.level || 1,
            };
            sim.quiver.addToStorage(arrow);
          } else if (item.section === "potions") {
            const placed = state.placeInBag(id);
            if (!placed.ok) state.ownedItems.push(id);
          } else {
            if (!state.ownedItems.includes(id)) state.ownedItems.push(id);
            if (item.section === "quivers") {
              if (!state.equipped) state.equipped = {};
              state.equipped.quiver = id;
              refillQuiverEmptySlots(state);
            }
          }
        }
        saveGame();
        populateHub();
      });
    });
  }

  populatePack(state);

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
          <div class="bestiary-stat"><span class="bestiary-stat-val">${e.coins}</span><span class="bestiary-stat-label">${COIN}</span></div>
        </div>
      </div>`;
    }).join("");
  }
}
