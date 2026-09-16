/**
 * Persistent gear catalog — starter kit, quivers, generated armour, and
 * consumable shop rows. Hub UI presents these; sell values live in inventory.
 */
import { shopConsumables } from "./consumables.js";

export const ARMOUR_MATERIALS = [
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

export const ARMOUR_QUALITIES = [
  { id: "battered",   name: "Battered",   mult: 0.6, color: "#8a7a6a" },
  { id: "old",        name: "Old",        mult: 0.8, color: "#7a8a6a" },
  { id: "standard",   name: "Standard",   mult: 1.0, color: "#e8e4dc" },
  { id: "fine",       name: "Fine",       mult: 1.3, color: "#5a9ad0" },
  { id: "masterwork", name: "Masterwork", mult: 1.6, color: "#c9a227" },
  { id: "legendary",  name: "Legendary",  mult: 2.0, color: "#d4783a" },
];

const SLOT_ICONS = { head: "🪖", body: "🛡️", feet: "👢" };
export const ARMOUR_SLOTS = ["head", "body", "feet"];

function armourWeight(material, quality, slot) {
  const slotW = slot === "body" ? 1 : slot === "head" ? 0.55 : 0.4;
  const q = 0.7 + quality.mult * 0.3;
  return Math.max(1, Math.round((1 + material.tier * 0.7) * slotW * q));
}

export function generateArmourItem(material, quality, slot) {
  const baseArmor = slot === "body" ? material.body : slot === "head" ? material.head : material.feet;
  const armor = Math.max(1, Math.floor(baseArmor * quality.mult));
  const weight = armourWeight(material, quality, slot);
  const cost = Math.floor(10 + material.tier * 8 + (ARMOUR_QUALITIES.indexOf(quality)) * 15);
  const prefix = quality.name && quality.id !== "standard" ? quality.name + " " : "";
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

export const ARMOUR_ITEMS = [];
for (const mat of ARMOUR_MATERIALS) {
  for (const qual of ARMOUR_QUALITIES) {
    for (const slot of ARMOUR_SLOTS) {
      ARMOUR_ITEMS.push(generateArmourItem(mat, qual, slot));
    }
  }
}

export const SHOP_QUIVERS = (() => {
  const names = {
    10: "Hide Quiver",
    12: "Small Quiver",
    14: "Field Quiver",
    16: "Hunter Quiver",
    18: "Ranger Quiver",
    20: "Deep Quiver",
    22: "War Quiver",
    24: "Ashwood Quiver",
    26: "Great Quiver",
    28: "Vault Quiver",
    30: "Enduring Quiver",
  };
  const list = [];
  let cost = 40;
  for (let cap = 10; cap <= 30; cap += 2) {
    const step = (cap - 10) / 2;
    list.push({
      id: cap === 10 ? "quiver_basic" : `quiver_${cap}`,
      name: names[cap] || `${cap}-Shaft Quiver`,
      slot: "quiver",
      cost: step === 0 ? 0 : cost,
      capacity: cap,
      desc: cap === 10 ? "A stitched hide tube. Ten shafts." : `Holds ${cap} arrows.`,
      stats: `${cap} Capacity`,
      icon: "🏹",
      section: "quivers",
    });
    if (step >= 1) cost = Math.round(cost * 1.5);
  }
  return list;
})();

export const STARTER_GEAR = [
  { id: "bow_hunting", name: "Hunting Bow", slot: "bow", cost: 0, desc: "Your constant. Always strung.", stats: "Starter bow", icon: "🏹", section: "weapons" },
  { id: "dagger_iron", name: "Iron Dagger", slot: "dagger", cost: 8, desc: "When they reach you, you trade blows.", stats: "Close work", icon: "🗡", section: "weapons" },
  { id: "amulet_greenhorn", name: "Greenhorn Charm", slot: "amulet", cost: 6, desc: "A luck-stone for the unblooded.", stats: "+2 HP while worn", icon: "◆", section: "jewels" },
  ...shopConsumables(),
  { id: "trinket_lucky_tooth", name: "Lucky Tooth", slot: "amulet", cost: 18, desc: "A goblin charm. More superstition than steel.", stats: "Trinket", icon: "◆", section: "jewels" },
];

export function allGearItems() {
  return [...STARTER_GEAR, ...SHOP_QUIVERS, ...ARMOUR_ITEMS];
}

export function findItem(id) {
  if (!id) return null;
  return allGearItems().find((item) => item.id === id) || null;
}

export function isBowItem(itemOrId) {
  if (!itemOrId) return false;
  if (typeof itemOrId === "string") {
    const item = findItem(itemOrId);
    return !!(item && item.slot === "bow") || itemOrId.startsWith("bow_");
  }
  return itemOrId.slot === "bow" || (typeof itemOrId.id === "string" && itemOrId.id.startsWith("bow_"));
}
