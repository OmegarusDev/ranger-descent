/**
 * Bag, Quick Pouch, consumable use, and hub selling.
 *
 * Bag holds carried consumable instances. Pouch bindings are bag slot indices,
 * not a second inventory. Selling is hub-only and never touches bows.
 */
import { CONFIG } from "../data/config.js";
import { getConsumable, isConsumable, consumableLabel } from "../data/consumables.js";
import { findItem, isBowItem } from "../data/gear.js";
import { getArrowDef, arrowShopCost, isWoodType } from "./QuiverDeckManager.js";

export function bagCapacityStart() {
  return CONFIG.BAG_CAPACITY_START || 2;
}

export function bagCapacityMax() {
  return CONFIG.BAG_CAPACITY_MAX || 8;
}

export function pouchCapacityStart() {
  return CONFIG.POUCH_CAPACITY_START || 1;
}

export function pouchCapacityMax() {
  return CONFIG.POUCH_CAPACITY_MAX || 5;
}

/** Cost to grow the bag TO `target` slots (3..8). First extra slot is 100, then doubles. */
export function bagUpgradeCost(target) {
  const start = bagCapacityStart();
  if (target <= start) return 0;
  return (CONFIG.BAG_SLOT_BASE_COST || 100) * (2 ** (target - start - 1));
}

/** Cost to grow the pouch TO `target` slots (2..5). First extra slot is 200, then doubles. */
export function pouchUpgradeCost(target) {
  const start = pouchCapacityStart();
  if (target <= start) return 0;
  return (CONFIG.POUCH_SLOT_BASE_COST || 200) * (2 ** (target - start - 1));
}

export function normalizeBag(value, capacity = bagCapacityStart()) {
  const cap = Math.max(1, Math.min(bagCapacityMax(), Math.floor(capacity || bagCapacityStart())));
  const bag = Array.isArray(value)
    ? value.slice(0, cap).map((id) => (typeof id === "string" && id ? id : null))
    : [];
  while (bag.length < cap) bag.push(null);
  return bag;
}

export function normalizePouchBindings(value, capacity = pouchCapacityStart(), bagCap = bagCapacityStart(), bag = null) {
  const cap = Math.max(1, Math.min(pouchCapacityMax(), Math.min(bagCap, Math.floor(capacity || pouchCapacityStart()))));
  const raw = Array.isArray(value) ? value.slice(0, cap) : [];
  const seen = new Set();
  const bindings = raw.map((slot) => {
    if (slot == null || slot === "") return null;
    const n = Number(slot);
    if (!Number.isInteger(n) || n < 0 || n >= bagCap) return null;
    if (Array.isArray(bag) && !bag[n]) return null;
    if (seen.has(n)) return null;
    seen.add(n);
    return n;
  });
  while (bindings.length < cap) bindings.push(null);
  return bindings;
}

export function loadInventory(raw = {}) {
  const bagCap = Math.max(
    bagCapacityStart(),
    Math.min(bagCapacityMax(), Math.floor(Number(raw.bagCapacity) || bagCapacityStart())),
  );
  const pouchCap = Math.max(
    pouchCapacityStart(),
    Math.min(pouchCapacityMax(), Math.min(bagCap, Math.floor(Number(raw.pouchCapacity) || pouchCapacityStart()))),
  );
  const bag = normalizeBag(raw.bag, bagCap);
  const ownedItems = Array.isArray(raw.ownedItems)
    ? raw.ownedItems.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  const pouchBindings = normalizePouchBindings(raw.pouchBindings, pouchCap, bagCap, bag);
  return { bag, bagCapacity: bagCap, ownedItems, pouchBindings, pouchCapacity: pouchCap };
}

export function clearPouchBindingsForBagSlot(state, bagIndex) {
  if (!state.pouchBindings) return;
  state.pouchBindings = state.pouchBindings.map((slot) => (slot === bagIndex ? null : slot));
}

export function autoBindBagSlot(state, bagIndex) {
  if (bagIndex == null || bagIndex < 0) return false;
  if (!state.pouchBindings) {
    state.pouchBindings = normalizePouchBindings(null, state.pouchCapacity, state.bagCapacity);
  }
  if (state.pouchBindings.includes(bagIndex)) return true;
  const empty = state.pouchBindings.findIndex((slot) => slot == null);
  if (empty < 0) return false;
  state.pouchBindings[empty] = bagIndex;
  return true;
}

export function consumeBagSlot(state, bagIndex) {
  if (!state.bag || bagIndex < 0 || bagIndex >= state.bag.length) return null;
  const id = state.bag[bagIndex];
  if (!id) return null;
  state.bag[bagIndex] = null;
  clearPouchBindingsForBagSlot(state, bagIndex);
  return id;
}

export function placeInBag(state, itemId) {
  if (!itemId || !state.bag) return { ok: false, reason: "no_bag" };
  const empty = state.bag.findIndex((slot) => !slot);
  if (empty < 0) return { ok: false, reason: "full" };
  state.bag[empty] = itemId;
  autoBindBagSlot(state, empty);
  return { ok: true, slot: empty };
}

export function moveBagToOwned(state, bagIndex) {
  const id = state.bag?.[bagIndex];
  if (!id) return { ok: false };
  if (!state.ownedItems) state.ownedItems = [];
  state.bag[bagIndex] = null;
  clearPouchBindingsForBagSlot(state, bagIndex);
  state.ownedItems.push(id);
  return { ok: true, itemId: id };
}

export function assignBagSlotFromOwned(state, bagIndex, ownedIndex) {
  if (!state.bag || bagIndex < 0 || bagIndex >= state.bag.length) return { ok: false, reason: "bad_slot" };
  if (!state.ownedItems || ownedIndex < 0 || ownedIndex >= state.ownedItems.length) {
    return { ok: false, reason: "missing" };
  }
  const incoming = state.ownedItems[ownedIndex];
  if (!isConsumable(incoming)) return { ok: false, reason: "not_consumable" };
  state.ownedItems.splice(ownedIndex, 1);
  const displaced = state.bag[bagIndex];
  if (displaced) {
    clearPouchBindingsForBagSlot(state, bagIndex);
    state.ownedItems.push(displaced);
  }
  state.bag[bagIndex] = incoming;
  autoBindBagSlot(state, bagIndex);
  return { ok: true, itemId: incoming, slot: bagIndex };
}

export function moveOwnedToBag(state, ownedIndex) {
  if (!state.ownedItems || ownedIndex < 0 || ownedIndex >= state.ownedItems.length) {
    return { ok: false, reason: "missing" };
  }
  const id = state.ownedItems[ownedIndex];
  if (!isConsumable(id)) return { ok: false, reason: "not_consumable" };
  const placed = placeInBag(state, id);
  if (!placed.ok) return placed;
  state.ownedItems.splice(ownedIndex, 1);
  return { ok: true, slot: placed.slot, itemId: id };
}

export function applyConsumableEffect(state, def) {
  const effect = def?.effect || {};
  const result = { type: effect.type || "none", healed: 0, cured: false, shielded: 0 };
  if (effect.type === "heal") {
    const before = state.playerHp;
    state.healPlayer(effect.amount || 0);
    result.healed = Math.max(0, state.playerHp - before);
  } else if (effect.type === "curePoison") {
    const had = (state.playerPoisonT || 0) > 0;
    state.playerPoisonT = 0;
    state.playerPoisonDps = 0;
    result.cured = had;
  } else if (effect.type === "shield") {
    state.activateShield(effect.amount || 0);
    result.shielded = effect.amount || 0;
  } else if (effect.type === "damage_boost") {
    state.activateDamageBoost(effect.multiplier || 1.5, effect.duration || 5);
  } else if (effect.type === "coin_multiplier") {
    state.activateCoinMultiplier(effect.multiplier || 2, effect.duration || 6);
  }
  return result;
}

export function sellValueFromCost(cost) {
  const n = Number(cost);
  const ratio = CONFIG.SELL_VALUE_RATIO ?? 0.5;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.floor(n * ratio));
}

export function getArrowSellValue(type, level = 1) {
  if (isWoodType(type)) return 0;
  const def = getArrowDef(type, level);
  return sellValueFromCost(arrowShopCost(def.cost, level));
}

export function getItemSellValue(id) {
  const consumable = getConsumable(id);
  if (consumable) return sellValueFromCost(consumable.cost);
  const item = findItem(id);
  if (!item || isBowItem(item)) return 0;
  return sellValueFromCost(item.cost);
}

export function isEquippedId(state, id) {
  if (!id || !state?.equipped) return false;
  return Object.values(state.equipped).includes(id);
}

export function isBagSlotPouchBound(state, bagIndex) {
  return (state.pouchBindings || []).includes(bagIndex);
}

export function canSellOwnedItem(state, ownedIndex) {
  const id = state.ownedItems?.[ownedIndex];
  if (!id) return { ok: false, reason: "missing" };
  if (isBowItem(id)) return { ok: false, reason: "bow" };
  if (isEquippedId(state, id)) return { ok: false, reason: "equipped" };
  return { ok: true, id, value: getItemSellValue(id) };
}

export function canSellBagItem(state, bagIndex) {
  const id = state.bag?.[bagIndex];
  if (!id) return { ok: false, reason: "missing" };
  if (isBowItem(id)) return { ok: false, reason: "bow" };
  if (isBagSlotPouchBound(state, bagIndex)) return { ok: false, reason: "pouch" };
  return { ok: true, id, value: getItemSellValue(id) };
}

export function canSellStorageArrow(type) {
  if (!CONFIG.SELL_STORAGE_ARROWS) return { ok: false, reason: "disabled" };
  if (isWoodType(type)) return { ok: false, reason: "wood" };
  return { ok: true };
}

export function nextBagUpgrade(state) {
  const current = state.bagCapacity || bagCapacityStart();
  const next = current + 1;
  if (next > bagCapacityMax()) return { ok: false, reason: "maxed" };
  return { ok: true, next, cost: bagUpgradeCost(next) };
}

export function nextPouchUpgrade(state) {
  const current = state.pouchCapacity || pouchCapacityStart();
  const next = current + 1;
  const bagCap = state.bagCapacity || bagCapacityStart();
  if (next > pouchCapacityMax()) return { ok: false, reason: "maxed" };
  if (next > bagCap) return { ok: false, reason: "bag", next, need: next, cost: pouchUpgradeCost(next) };
  return { ok: true, next, cost: pouchUpgradeCost(next) };
}

export { getConsumable, isConsumable, consumableLabel };
