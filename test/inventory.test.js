import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/data/config.js";
import { CONSUMABLE_DEFS } from "../src/data/consumables.js";
import {
  bagUpgradeCost,
  pouchUpgradeCost,
  getItemSellValue,
  getArrowSellValue,
  canSellStorageArrow,
  nextBagUpgrade,
  nextPouchUpgrade,
  normalizePouchBindings,
} from "../src/game/inventory.js";
import { GameStateManager } from "../src/game/GameStateManager.js";
import { CorridorSim } from "../src/game/CorridorSim.js";

test("legacy pouch arrays are ignored and bag starts at two slots", () => {
  const state = new GameStateManager();
  state.deserialize({
    pouch: ["potion_salve", 42, "potion_tonic"],
    pouchCapacity: 99,
    ownedItems: ["bow_hunting", "potion_salve", "dagger_iron"],
  });

  assert.deepEqual(state.bag, [null, null]);
  assert.equal(state.bagCapacity, 2);
  assert.deepEqual(state.ownedItems, ["bow_hunting", "potion_salve", "dagger_iron"]);
  assert.deepEqual(state.pouchBindings, [null, null]);
  assert.equal(state.pouchCapacity, 2);
  assert.equal(state.serialize().schemaVersion, 3);
});

test("bag and pouch use the same consumable API without changing cooldown", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.applyUpgrades();
  sim.state.playerHp = 4;
  sim.state.arrowCooldown = 0.42;
  sim.state.bag[0] = "potion_salve";
  sim.state.bindPouch(0, 0);
  const cd = sim.state.arrowCooldown;

  const used = sim.usePouch(0);

  assert.equal(used.ok, true);
  assert.equal(used.source, "pouch");
  assert.equal(sim.state.playerHp, 4 + CONFIG.POTION_SALVE_HEAL);
  assert.equal(sim.state.bag[0], null);
  assert.equal(sim.state.pouchBindings[0], null);
  assert.equal(sim.state.arrowCooldown, cd);
});

test("using a bag potion consumes one instance and clears pouch bindings", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.bag[1] = "potion_bandage";
  sim.state.bindPouch(0, 1);

  const used = sim.useConsumable({ source: "bag", index: 1 });

  assert.equal(used.ok, true);
  assert.equal(sim.state.bag[1], null);
  assert.equal(sim.state.pouchBindings[0], null);
});

test("scrolls work through the generic API without unlocking AutoMagic", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  sim.state.bag[0] = "scroll_ward";
  assert.equal(sim.autoMagic.hexes.every((h) => !h.unlocked), true);

  const used = sim.useConsumable({ source: "bag", index: 0 });

  assert.equal(used.ok, true);
  assert.equal(used.applied.type, "shield");
  assert.equal(sim.state.runBonuses.shieldActive, true);
  assert.equal(sim.autoMagic.hexes.every((h) => !h.unlocked), true);
  assert.equal(sim.autoMagic.prayers.every((p) => !p.unlocked), true);
  assert.ok(CONSUMABLE_DEFS.scroll_fortify);
});

test("hub selling rejects bows and equipped gear, and awards half value", () => {
  const sim = new CorridorSim();
  sim.state.enterHub();
  sim.state.ownedItems = ["bow_hunting", "battered_cloth_head"];
  sim.state.equipped = { bow: "bow_hunting" };
  sim.state.coins = 0;

  assert.equal(sim.sellOwnedItem(0).reason, "bow");
  const value = getItemSellValue("battered_cloth_head");
  assert.ok(value >= 1);
  const sold = sim.sellOwnedItem(1);
  assert.equal(sold.ok, true);
  assert.equal(sold.value, value);
  assert.equal(sim.state.coins, value);
  assert.deepEqual(sim.state.ownedItems, ["bow_hunting"]);
});

test("pouch-bound bag items cannot be sold until unbound", () => {
  const sim = new CorridorSim();
  sim.state.enterHub();
  sim.state.bag[0] = "potion_antidote";
  sim.state.bindPouch(0, 0);

  assert.equal(sim.sellBagItem(0).reason, "pouch");
  sim.state.bindPouch(0, null);
  const sold = sim.sellBagItem(0);
  assert.equal(sold.ok, true);
  assert.equal(sold.value, getItemSellValue("potion_antidote"));
  assert.equal(sim.state.bag[0], null);
});

test("storage arrows sell at half shop value when the toggle is on", () => {
  const sim = new CorridorSim();
  sim.state.enterHub();
  sim.quiver.addToStorage({ type: "iron", level: 2 });
  const expected = getArrowSellValue("iron", 2);

  const sold = sim.sellStorageArrow(0);

  assert.equal(CONFIG.SELL_STORAGE_ARROWS, true);
  assert.equal(sold.ok, true);
  assert.equal(sold.value, expected);
  assert.equal(sim.quiver.peekStorage().length, 0);
});

test("wood cannot be sold and potions collected into empty bag slots", () => {
  const sim = new CorridorSim();
  sim.state.startRun();
  const loot = sim._collectLootPiece({
    kind: "potion",
    itemId: "potion_salve",
    label: "Herbal Remedy",
  });
  assert.equal(loot.status, "bag");
  assert.equal(sim.state.bag[0], "potion_salve");
  assert.equal(sim.state.ownedItems.includes("potion_salve"), false);

  sim.state.enterHub();
  assert.equal(canSellStorageArrow("wood").reason, "wood");
  assert.equal(sim.sellStorageArrow(0).reason, "missing");
});

test("bag and pouch slot upgrades double in cost and pouch cannot outrun the bag", () => {
  assert.equal(bagUpgradeCost(3), 100);
  assert.equal(bagUpgradeCost(4), 200);
  assert.equal(bagUpgradeCost(5), 400);
  assert.equal(bagUpgradeCost(8), 3200);
  assert.equal(pouchUpgradeCost(2), 200);
  assert.equal(pouchUpgradeCost(3), 400);
  assert.equal(pouchUpgradeCost(4), 800);
  assert.equal(pouchUpgradeCost(5), 1600);
  assert.equal(CONSUMABLE_DEFS.potion_salve.cost, 12);
  assert.equal(CONSUMABLE_DEFS.potion_salve.effect.amount, 5);
  assert.equal(CONSUMABLE_DEFS.potion_bandage.cost, 20);
  assert.equal(CONSUMABLE_DEFS.potion_bandage.effect.amount, 10);
  assert.equal(CONSUMABLE_DEFS.potion_antidote.effect.type, "curePoison");

  const state = new GameStateManager();
  state.coins = 10000;
  assert.equal(state.bagCapacity, 2);
  assert.equal(state.pouchCapacity, 1);
  assert.equal(nextPouchUpgrade(state).ok, true);
  assert.equal(nextPouchUpgrade(state).cost, 200);
  assert.equal(state.buyPouchSlot(), true);
  assert.equal(state.pouchCapacity, 2);
  assert.equal(nextPouchUpgrade(state).ok, false);
  assert.equal(nextPouchUpgrade(state).reason, "bag");
  assert.equal(state.buyPouchSlot(), false);
  assert.equal(state.pouchCapacity, 2);

  assert.equal(nextBagUpgrade(state).cost, 100);
  assert.equal(state.buyBagSlot(), true);
  assert.equal(state.bagCapacity, 3);
  assert.equal(state.bag.length, 3);
  assert.equal(nextPouchUpgrade(state).ok, true);
  assert.equal(nextPouchUpgrade(state).cost, 400);
  assert.equal(state.buyPouchSlot(), true);
  assert.equal(state.pouchCapacity, 3);
});

test("pouch capacity cannot exceed bag size on load", () => {
  const state = new GameStateManager();
  state.deserialize({
    bagCapacity: 4,
    pouchCapacity: 5,
    bag: ["potion_salve", "potion_bandage", null, null],
    pouchBindings: [0, 1, 2, 3, 0],
  });
  assert.equal(state.bagCapacity, 4);
  assert.equal(state.pouchCapacity, 4);
  assert.equal(state.pouchBindings.length, 4);
  assert.deepEqual(state.pouchBindings, [0, 1, null, null]);
});

test("empty pouch bindings stay empty and do not collapse to bag slot 0", () => {
  assert.deepEqual(normalizePouchBindings([0, null, null], 3, 3), [0, null, null]);
  const state = new GameStateManager();
  state.deserialize({
    bagCapacity: 3,
    pouchCapacity: 3,
    bag: [null, null, null],
    pouchBindings: [0, null, null],
  });
  assert.deepEqual(state.pouchBindings, [null, null, null]);
  state.placeInBag("potion_salve");
  assert.deepEqual(state.bag, ["potion_salve", null, null]);
  assert.deepEqual(state.pouchBindings, [0, null, null]);
});
