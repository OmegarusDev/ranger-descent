/**
 * main.js — Entry point. Wires DungeonView, CorridorSim, InputHandler.
 */
import { RenderEngine2D5 } from "./engine/RenderEngine2D5.js";
import { DungeonView } from "./engine/DungeonView.js?v=126";
import { CONFIG } from "./data/config.js";
import { getArrowDef, arrowShort, isWoodType } from "./game/QuiverDeckManager.js";
import { getConsumable, consumableIconSvg } from "./data/consumables.js";
import { CorridorSim } from "./game/CorridorSim.js";
import { InputHandler } from "./game/InputHandler.js";
import { lockMobileAppPortrait } from "./engine/immersive.js";
import {
  initHub,
  populateHub,
  closeHubSheets,
  closeElevatorModal,
  refillQuiverEmptySlots,
  syncArmorRating,
} from "./ui/hub.js";
// Cache-bust only at the HTML entry (main.js?v=N). Nested imports stay unversioned
// so each module has one identity — mixed ?v= was splitting CONFIG across the graph.

/** Player-facing coin mark (colon sign — C with bars). */
const COIN = "₡";
function coinLabel(n) {
  return `${COIN}${Math.max(0, Math.floor(n || 0))}`;
}

// Legacy key name kept so existing browser saves keep loading.
const SAVE_KEY = "ranger-defense-save-v1";
const SAVE_VERSION = 3;

// ─── Bootstrap ────────────────────────────────────────────────
const canvas = document.getElementById("game");
const engine = new RenderEngine2D5(canvas);
const dungeon = new DungeonView();
const sim = new CorridorSim();
const input = new InputHandler(canvas);
lockMobileAppPortrait();
if (typeof location !== "undefined" && location.search.includes("debug=1")) {
  globalThis.sim = sim;
  globalThis.dungeon = dungeon;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      state: sim.state.serialize(),
      quiver: sim.quiver.serialize(),
    }));
  } catch (_) { /* ignore quota / private mode */ }
}

const HALF_CORRIDOR = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;
engine.fxCam = dungeon;
engine.sceneMode = "dungeon";

// ─── UI references ────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const phaseHub = $("#phase-hub");
const phaseRun = $("#phase-run");
const phaseDeath = $("#phase-death");
const coinsEl = $("#coins-display");
const hpFill = $("#hp-fill");
const hpText = $("#hp-text");
const floorEl = $("#floor-display");
const waveEl = $("#wave-display");
const ammoAlert = $("#ammo-alert");
const distEl = $("#distance-display");
const timerEl = $("#timer-display");
const cooldownRing = $("#cooldown-ring");
const cooldownLabel = $("#cooldown-label");
const nockMeter = $("#nock-meter");
const minimapCanvas = $("#minimap");
const deathStats = $("#death-stats");
const debugPanel = $("#debug-panel");
const pathChoice = $("#path-choice");

function familyIconSvg(family) {
  const icons = {
    slime: `<svg viewBox="0 0 28 28" aria-hidden="true"><ellipse cx="14" cy="17" rx="10" ry="7" fill="#b84a55"/><ellipse cx="14" cy="14" rx="8" ry="8" fill="#c45a65"/><circle cx="11" cy="13" r="1.4" fill="#1a0808"/><circle cx="17" cy="13" r="1.4" fill="#1a0808"/></svg>`,
    goblin: `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M6 12 L10 6 L12 12 Z" fill="#4a7a3a"/><path d="M22 12 L18 6 L16 12 Z" fill="#4a7a3a"/><circle cx="14" cy="16" r="7" fill="#6aaa5a"/><circle cx="11.5" cy="15" r="1.3" fill="#1a0808"/><circle cx="16.5" cy="15" r="1.3" fill="#1a0808"/><path d="M11 19 Q14 22 17 19" fill="none" stroke="#2a3a18" stroke-width="1.2"/></svg>`,
    skeleton: `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="12" r="7" fill="#c8c0b0"/><ellipse cx="14" cy="21" rx="5" ry="3.2" fill="#c8c0b0"/><circle cx="11.5" cy="11" r="1.5" fill="#1a1010"/><circle cx="16.5" cy="11" r="1.5" fill="#1a1010"/><rect x="10" y="19.5" width="1.4" height="3.2" fill="#2a2018"/><rect x="13.3" y="19.5" width="1.4" height="3.2" fill="#2a2018"/><rect x="16.6" y="19.5" width="1.4" height="3.2" fill="#2a2018"/></svg>`,
    undead: `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="13" r="8" fill="#6a5a4a"/><circle cx="11" cy="12" r="1.6" fill="#c45a4a"/><circle cx="17" cy="12" r="1.6" fill="#c45a4a"/><path d="M10 17 Q14 20 18 17" stroke="#2a1810" fill="none" stroke-width="1.4"/></svg>`,
    spider: `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="4.2" fill="#5a4a3a"/><path d="M10 12 L3 7 M10 14 L2 14 M10 16 L3 21 M18 12 L25 7 M18 14 L26 14 M18 16 L25 21" stroke="#5a4a3a" stroke-width="1.6" fill="none"/></svg>`,
    bat: `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 16 Q8 6 14 14 Q20 6 24 16 Q18 12 14 18 Q10 12 4 16" fill="#4a3a5a"/></svg>`,
    demon: `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 12 L9 4 L13 11" fill="#8a2018"/><path d="M21 12 L19 4 L15 11" fill="#8a2018"/><circle cx="14" cy="16" r="7" fill="#c04040"/><circle cx="11.5" cy="15" r="1.3" fill="#f3ead4"/><circle cx="16.5" cy="15" r="1.3" fill="#f3ead4"/></svg>`,
    brute: `<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="7" y="8" width="14" height="14" rx="3" fill="#5a7a4a"/><circle cx="11.5" cy="14" r="1.4" fill="#1a0808"/><circle cx="16.5" cy="14" r="1.4" fill="#1a0808"/><path d="M10 19 H18" stroke="#2a3a18" stroke-width="1.4"/></svg>`,
    beast: `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="15" r="7" fill="#8a7040"/><circle cx="11.5" cy="14" r="1.3" fill="#1a0808"/><circle cx="16.5" cy="14" r="1.3" fill="#1a0808"/></svg>`,
  };
  return icons[family] || icons.beast;
}

function hallSpoilsHtml(report) {
  if (!report) return "";
  const kills = report.kills || [];
  const broken = report.broken || [];
  const discarded = report.discarded || [];
  const ground = report.ground;

  let killHtml = kills.map((k) => {
    const drop = k.drop ? `<span class="gold">${k.drop.label}</span>` : `<span class="muted">—</span>`;
    return `<div class="wave-loot-line"><span>${k.name}</span><span><span class="gold">${coinLabel(k.coins)}</span> · ${drop}</span></div>`;
  }).join("");
  if (!killHtml) killHtml = `<div class="wave-loot-empty">No foes left spoils worth naming.</div>`;

  const groundHtml = ground
    ? `<div class="wave-loot-line"><span>${ground.detail || "On the ground"}</span><span class="gold">${ground.kind === "coins" ? coinLabel(ground.amount) : ground.label}</span></div>`
    : `<div class="wave-loot-empty">Nothing else on the floor.</div>`;

  let brokeHtml = [...broken, ...discarded].map((b) => {
    const why = b.reason === "no_room"
      ? "no room"
      : b.reason === "replaced"
        ? "replaced by a new arrow"
        : "broke";
    return `<div class="wave-loot-line"><span class="broke">${b.label}</span><span class="muted">${why}</span></div>`;
  }).join("");
  if (!brokeHtml) brokeHtml = `<div class="wave-loot-empty">Nothing was discarded.</div>`;

  return `
    <div class="wave-loot-section"><h4>From the fallen</h4>${killHtml}</div>
    <div class="wave-loot-section"><h4>On the ground</h4>${groundHtml}</div>
    <div class="wave-loot-section"><h4>Discarded shafts</h4>${brokeHtml}</div>
  `;
}

function fillPathSpoils() {
  const spoils = document.getElementById("path-spoils");
  if (!spoils) return;
  const html = hallSpoilsHtml(sim.pendingWaveReport);
  spoils.innerHTML = html;
  spoils.hidden = !html;
}

function setPathChoice(on) {
  if (!pathChoice) return;
  const active = !!on;
  const wasActive = pathChoice.classList.contains("active");
  pathChoice.classList.toggle("active", active);
  if (!active) {
    input.choiceMode = false;
    delete pathChoice.dataset.sig;
    return;
  }
  input.choiceMode = true;
  const report = sim.pendingWaveReport;
  const lootSig = report
    ? `${(report.kills || []).length}:${report.ground?.kind || ""}:${(report.discarded || []).length}`
    : "";
  const sig = `${(sim.junctionChoices || []).map((c) => `${c.direction}:${c.coinBonus || 0}`).join("|")}|${lootSig}`;
  if (wasActive && pathChoice.dataset.sig === sig) {
    const escapeCoins = document.getElementById("escape-coins");
    if (escapeCoins) {
      const n = sim.state.runCoins || 0;
      escapeCoins.textContent = n > 0 ? `Bank ${coinLabel(n)} and leave` : "Leave with nothing from this delve";
    }
    return;
  }
  pathChoice.dataset.sig = sig;
  fillPathSpoils();

  const dirs = new Set((sim.junctionChoices || []).map((c) => c.direction));
  const labels = { left: "‹ Left", forward: "Ahead", right: "Right ›" };
  for (const btn of pathChoice.querySelectorAll("[data-dir]")) {
    const dir = btn.dataset.dir;
    const offered = dirs.has(dir);
    btn.hidden = !offered;
    if (!offered) continue;
    const choice = (sim.junctionChoices || []).find((c) => c.direction === dir);
    const families = choice && choice.families && choice.families.length
      ? choice.families
      : (choice && choice.enemyTypes || []).map((t) => {
        if (t.includes("slime")) return "slime";
        if (t.includes("goblin")) return "goblin";
        if (t.includes("skeleton") || t === "hauler") return "skeleton";
        return "beast";
    });
    const unique = [...new Set(families)].slice(0, 3);
    const icons = unique.map((f) => `<span class="path-icon">${familyIconSvg(f)}</span>`).join("");
    const bonus = choice && choice.coinBonus ? `<span class="path-coins">+${coinLabel(choice.coinBonus)}</span>` : `<span class="path-coins path-coins-quiet">safer</span>`;
    btn.innerHTML = `<span class="path-dir">${labels[dir]}</span><span class="path-icons">${icons}</span>${bonus}`;
  }
  const escapeCoins = document.getElementById("escape-coins");
  if (escapeCoins) {
    const n = sim.state.runCoins || 0;
    escapeCoins.textContent = n > 0 ? `Bank ${coinLabel(n)} and leave` : "Leave with nothing from this delve";
  }
}

function escapeToSurface() {
  if (sim.state.phase !== "run" || !sim.junctionPending) return;
  sim.junctionPending = false;
  setPathChoice(false);
  input.choiceMode = false;
  sim.commitRunStash();
  sim.state.bankCoins();
  sim.quiver.packForHub();
  sim.running = false;
  sim.state.hubVisits++;
  sim.state.enterHub();
  const hubCoins = document.getElementById("hub-coins");
  if (hubCoins) hubCoins.textContent = sim.state.coins;
}

function showWaveLoot() {
  /* Hall spoils now ride with the junction card after the walk-up. */
}

function hideWaveLoot() {
  const panel = document.getElementById("wave-loot");
  if (panel) panel.classList.remove("active");
}

let ammoAlertTimer = null;
let lastEmptyAlertAt = 0;

function showAmmoAlert(text, kind = "last") {
  if (!ammoAlert) return;
  ammoAlert.textContent = text;
  ammoAlert.className = `active ${kind}`;
  if (ammoAlertTimer) clearTimeout(ammoAlertTimer);
  ammoAlertTimer = setTimeout(() => {
    ammoAlert.className = "";
    ammoAlertTimer = null;
  }, kind === "empty" ? 1600 : 1300);
}

let _runBagPending = null;
let _bagOpenedAt = 0;

function closeRunBag() {
  const panel = document.getElementById("run-bag");
  if (panel) {
    panel.classList.remove("active");
    panel.setAttribute("aria-hidden", "true");
  }
  const conf = document.getElementById("run-bag-confirm");
  if (conf) conf.classList.remove("active");
  _runBagPending = null;
}

function closeElevatorCheckpoint() {
  const panel = document.getElementById("run-elevator-checkpoint");
  if (panel) {
    panel.classList.remove("active");
    panel.setAttribute("aria-hidden", "true");
  }
}

function showElevatorCheckpoint(e) {
  const panel = document.getElementById("run-elevator-checkpoint");
  const text = document.getElementById("run-elevator-checkpoint-text");
  const continueBtn = document.getElementById("btn-run-elevator-continue");
  if (!panel) return;
  if (text) {
    const banked = e?.banked ? ` ${coinLabel(e.banked)} banked.` : " Purse banked.";
    text.textContent = e?.final
      ? `The last elevator opens onto the final descent.${banked}`
      : `Elevator E${e?.to} is now unlocked.${banked}`;
  }
  if (continueBtn) continueBtn.textContent = e?.final ? "Face the final boss" : "Continue descent";
  panel.classList.add("active");
  panel.setAttribute("aria-hidden", "false");
}

function openRunBag() {
  if (sim.state.phase !== "run") return;
  if (sim.lootPending || sim._lootDelayT > 0 || sim.elevatorCheckpointPending) return;
  populateRunBag();
  const panel = document.getElementById("run-bag");
  if (panel) {
    panel.classList.add("active");
    panel.setAttribute("aria-hidden", "false");
  }
  _bagOpenedAt = performance.now();
}

function populateRunBag() {
  const qEl = document.getElementById("run-bag-quiver");
  const pEl = document.getElementById("run-bag-slots");
  const sEl = document.getElementById("run-bag-stash");
  if (!qEl || !pEl || !sEl) return;
  const loaded = sim.quiver.peekQuiver();
  qEl.innerHTML = loaded.map((a, i) => {
    const wood = isWoodType(a.type);
    const cell = `<span>${arrowShort(a.type)}</span><small>Lv${a.level || 1}</small>`;
    if (wood) return `<div class="run-bag-cell run-bag-cell-static">${cell}</div>`;
    return `<button type="button" class="run-bag-cell" data-discard-arrow="${i}">${cell}<small>stash</small></button>`;
  }).join("") || `<div class="wave-loot-empty">Quiver empty</div>`;

  const bag = sim.state.bag || [];
  const bagCap = Math.max(bag.length, sim.state.bagCapacity || 2);
  const bagSlots = bag.length ? bag.slice() : Array.from({ length: bagCap }, () => null);
  while (bagSlots.length < bagCap) bagSlots.push(null);
  pEl.innerHTML = bagSlots.map((id, i) => {
    if (!id) return `<div class="run-bag-cell"><small>empty</small></div>`;
    const def = getConsumable(id);
    return `<button type="button" class="run-bag-cell" data-bag-item="${i}">
      <span class="run-bag-icon">${consumableIconSvg(id)}</span>
      <span>${def?.short || def?.name || id}</span>
      <small>use / stash</small>
    </button>`;
  }).join("");

  const stash = sim.runStash || { arrows: [], items: [] };
  const bits = [
    ...(stash.arrows || []).map((a) => {
      const def = getArrowDef(a.type);
      return `<div class="run-bag-cell"><span>${arrowShort(a.type)}</span><small>Lv${a.level || 1}</small></div>`;
    }),
    ...(stash.items || []).map((it) => `<div class="run-bag-cell">${it.itemId ? `<span class="run-bag-icon">${consumableIconSvg(it.itemId)}</span>` : ""}<span>${it.label || it.itemId}</span><small>stashed</small></div>`),
  ];
  sEl.innerHTML = bits.join("") || `<div class="wave-loot-empty">Nothing stashed this delve</div>`;
}

function askRunBagAction(pending, text, { canUse = false } = {}) {
  _runBagPending = pending;
  const conf = document.getElementById("run-bag-confirm");
  const confText = document.getElementById("run-bag-confirm-text");
  const useBtn = document.getElementById("btn-run-bag-use");
  if (confText) confText.textContent = text;
  if (useBtn) useBtn.hidden = !canUse;
  if (conf) conf.classList.add("active");
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
  if (tryChoosePath(x, y)) return;
  if (sim.state.phase === "run" && !sim.junctionPending) {
    sim.tryDaggerAt(x, y, (enemy, cx, cy) => dungeon.hitTestEnemy(enemy, cx, cy));
  }
};

function pouchKeyIndex(e) {
  if (e.key >= "1" && e.key <= "5") return Number(e.key) - 1;
  if (e.code >= "Digit1" && e.code <= "Digit5") return Number(e.code.slice(5)) - 1;
  if (e.code >= "Numpad1" && e.code <= "Numpad5") return Number(e.code.slice(6)) - 1;
  return null;
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (sim.state.phase !== "run") return;
  if (sim.junctionPending) {
    const dir = e.key === "ArrowLeft" || e.key === "a" || e.key === "A" ? "left"
      : e.key === "ArrowRight" || e.key === "d" || e.key === "D" ? "right"
      : e.key === "ArrowUp" || e.key === "w" || e.key === "W" ? "forward"
      : null;
    if (dir) {
      e.preventDefault();
      sim.chooseJunction(dir);
    }
    return;
  }
  const pouchIndex = pouchKeyIndex(e);
  if (pouchIndex == null) return;
  e.preventDefault();
  document.documentElement.classList.add("using-keyboard");
  sim.usePouch(pouchIndex);
  updateUI();
});

// ─── Game events ─────────────────────────────────────────────
sim.state.onPhaseChange = (phase) => {
  phaseHub.style.display = phase === "hub" ? "flex" : "none";
  phaseRun.style.display = phase === "run" ? "flex" : "none";
  phaseDeath.style.display = (phase === "death" || phase === "victory") ? "flex" : "none";

  if (phase === "hub") {
    closeHubSheets();
    sim.quiver.packForHub();
    saveGame();
    populateHub();
  }

  if (phase !== "run") setPathChoice(false);
  if (phase !== "run") closeElevatorCheckpoint();

  if (phase === "death" || phase === "victory") {
    const stats = sim.state.getRunStats();
    if (phase === "victory") sim.commitRunStash();
    else sim.discardRunStash();
    const earned = phase === "victory" ? sim.state.bankCoins() : 0;
    const deathCoin = phase === "death" ? sim.state.discardRunCoins() : null;
    sim.quiver.packForHub();
    hideWaveLoot();
    closeRunBag();
    saveGame();
    if (deathStats) {
      const coinLine = phase === "victory"
        ? `<div class="end-coin banked">+${coinLabel(earned)} banked</div>`
        : `<div class="end-coin">Kept ${coinLabel(deathCoin.kept)} · lost ${coinLabel(deathCoin.lost)}<span class="end-safe">Vault coin is safe.</span></div>`;
      deathStats.innerHTML = `
        <div class="end-story ${phase === "victory" ? "victory" : "defeat"}">${phase === "victory" ? "The final boss falls. You ride the last elevator to daylight." : "You fall.<br>Your coin scatters into the dark, as you scramble back to safety."}</div>
        <div class="end-stat">Reached: <b>${sim.getProgressLabel()}</b></div>
        <div class="end-stat">Halls cleared: <b>${Math.max(0, sim.waveIndex - (phase === "victory" ? 0 : 1))}</b></div>
        <div class="end-stat">Kills: <b>${stats.enemiesKilled}</b></div>
        <div class="end-stat">Arrows: <b>${stats.arrowsFired}</b></div>
        ${coinLine}
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

sim.on("last_arrow", () => {
  showAmmoAlert("Last arrow!", "last");
});

sim.on("quiver_empty", () => {
  const now = performance.now();
  if (now - lastEmptyAlertAt < 800) return;
  lastEmptyAlertAt = now;
  showAmmoAlert("Out of arrows", "empty");
});

let lastNotReadyAt = 0;
sim.on("arrow_not_ready", () => {
  const now = performance.now();
  if (now - lastNotReadyAt < 320) return;
  lastNotReadyAt = now;
  showAmmoAlert("Hold — string recovering", "wait");
  if (nockMeter) {
    nockMeter.classList.remove("blocked");
    void nockMeter.offsetWidth;
    nockMeter.classList.add("blocked");
  }
  dungeon.bowJoltUntil = (sim.runTime || 0) + 0.32;
});

sim.on("consumable_used", (e) => {
  const applied = e.applied || {};
  if (applied.type === "heal") showAmmoAlert(e.label || "Used", "last");
  else if (applied.type === "curePoison") showAmmoAlert("Poison cleared", "last");
  else if (applied.type === "shield") showAmmoAlert("Warding", "last");
  else showAmmoAlert(e.label || "Used", "last");
  updateUI();
});

const FX_TYPE = {
  ice: "frost", wood: "kinetic", flint: "kinetic", iron: "kinetic",
  steel: "kinetic", silver: "kinetic", stun: "kinetic", piercing: "kinetic",
  double: "kinetic", normal: "kinetic", barbed: "kinetic", oil: "acid",
  poison: "poison", shock: "shock", fire: "fire",
};
sim.on("dagger_hit", (e) => {
  engine.fx.hit(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, "kinetic");
  engine.fx.damageNumber(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, Math.round(e.damage), "kinetic", e.crit);
  engine.punch(4.2);
});

sim.on("projectile_hit", (e) => {
  const fxType = FX_TYPE[e.projectile.element] || e.projectile.element;
  engine.fx.hit(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, fxType);
  engine.fx.damageNumber(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, Math.round(e.damage), fxType, e.crit);
  engine.punch(e.damage > 10 ? 5.5 : 3.6);
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

sim.on("elevator_ride", (e) => {
  setPathChoice(false);
  input.choiceMode = false;
  engine.punch(6);
  const tip = document.getElementById("wave-display");
  if (tip && e) {
    tip.textContent = e.to === "final" ? "Final Boss" : `Elevator → E${e.to} unlocked`;
  }
});

sim.on("notebook_found", (e) => {
  const tip = document.getElementById("wave-display");
  const names = { wood: "Wood", flint: "Flint", iron: "Iron", steel: "Steel" };
  const label = names[e.filler] || e.filler;
  if (tip) tip.textContent = `Notebook — craft ${label} shafts`;
  engine.punch(3);
});

sim.on("elevator_checkpoint", (e) => {
  setPathChoice(false);
  input.reset();
  showElevatorCheckpoint(e);
  // The simulator has already banked the purse and reconciled the stash.
  saveGame();
});

sim.on("wave_loot", () => {
  hideWaveLoot();
});

sim.on("wave_loot_done", () => {
  hideWaveLoot();
});

sim.on("run_start", () => {
  setPathChoice(false);
  hideWaveLoot();
  closeElevatorCheckpoint();
  closeRunBag();
  if (ammoAlert) ammoAlert.className = "";
  lastEmptyAlertAt = 0;
  input.reset();
  input.blockUntil = performance.now() + 280;
});

if (pathChoice) {
  pathChoice.addEventListener("pointerup", (e) => {
    if (e.target.closest("#btn-escape")) {
      e.preventDefault();
      e.stopPropagation();
      escapeToSurface();
      return;
    }
    const btn = e.target.closest("[data-dir]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (sim.state.phase === "run" && sim.junctionPending) {
      sim.chooseJunction(btn.dataset.dir);
    }
  });
}

document.getElementById("btn-run-elevator-continue")?.addEventListener("click", () => {
  closeElevatorCheckpoint();
  sim.continueAtElevator();
});

document.getElementById("btn-run-elevator-return")?.addEventListener("click", () => {
  closeElevatorCheckpoint();
  sim.leaveAtElevator();
});

document.querySelectorAll("[data-open-run-bag]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openRunBag();
  });
});
document.getElementById("btn-run-bag-close")?.addEventListener("click", () => closeRunBag());
document.getElementById("run-bag")?.addEventListener("click", (e) => {
  if (e.target.id === "run-bag") {
    if (performance.now() - _bagOpenedAt < 400) return;
    closeRunBag();
    return;
  }
  const arrowBtn = e.target.closest("[data-discard-arrow]");
  if (arrowBtn) {
    const i = Number(arrowBtn.dataset.discardArrow);
    const a = sim.quiver.peekQuiver()[i];
    if (!a) return;
    const wood = isWoodType(a.type);
    if (wood) return;
    askRunBagAction(
      { kind: "arrow", index: i },
      `Send ${getArrowDef(a.type).name} to the run stash? Recover it only if you escape.`
    );
    return;
  }
  const bagBtn = e.target.closest("[data-bag-item]");
  if (bagBtn) {
    const i = Number(bagBtn.dataset.bagItem);
    const id = sim.state.bag?.[i];
    const def = getConsumable(id);
    askRunBagAction(
      { kind: "bag", index: i },
      def
        ? `Use ${def.name} now, or send it to the run stash? Stashed finds return only if you escape.`
        : "Send this bag item to the run stash? Recover it only if you escape.",
      { canUse: !!def }
    );
  }
});
document.getElementById("btn-run-bag-cancel")?.addEventListener("click", () => {
  const conf = document.getElementById("run-bag-confirm");
  if (conf) conf.classList.remove("active");
  _runBagPending = null;
});
document.getElementById("btn-run-bag-use")?.addEventListener("click", () => {
  if (!_runBagPending || _runBagPending.kind !== "bag") return;
  sim.useConsumable({ source: "bag", index: _runBagPending.index });
  _runBagPending = null;
  const conf = document.getElementById("run-bag-confirm");
  if (conf) conf.classList.remove("active");
  populateRunBag();
  updateUI();
});
document.getElementById("btn-run-bag-confirm")?.addEventListener("click", () => {
  if (!_runBagPending) return;
  if (_runBagPending.kind === "arrow") sim.discardQuiverArrowToStash(_runBagPending.index);
  if (_runBagPending.kind === "bag" || _runBagPending.kind === "pouch") {
    sim.discardBagToStash(_runBagPending.index);
  }
  _runBagPending = null;
  const conf = document.getElementById("run-bag-confirm");
  if (conf) conf.classList.remove("active");
  populateRunBag();
});

document.getElementById("run-pouch")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pouch-use]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  if (sim.state.phase !== "run") return;
  sim.usePouch(Number(btn.dataset.pouchUse));
  updateUI();
});

// ─── UI Buttons ───────────────────────────────────────────────
function startDungeonRun() {
  try {
    closeElevatorModal();
    closeHubSheets();
    sim.initRun();
  } catch (err) {
    console.error("Init error:", err);
  }
}

initHub({
  sim,
  $,
  coinLabel,
  COIN,
  saveGame,
  SAVE_KEY,
  startDungeonRun,
});

$("#btn-hub").addEventListener("click", () => {
  if (sim.state.phase === "death" || sim.state.phase === "victory") {
    sim.state.hubVisits++;
  }
  sim.state.enterHub();
});

// ─── UI Update ────────────────────────────────────────────────
function updateUI() {
  if (coinsEl) coinsEl.textContent = sim.state.phase === "run" ? (sim.state.runCoins || 0) : sim.state.coins;
  if (hpFill) hpFill.style.width = `${(sim.state.playerHp / sim.state.playerMaxHp) * 100}%`;
  if (hpText) hpText.textContent = `${Math.ceil(sim.state.playerHp)} / ${sim.state.playerMaxHp}`;
  if (floorEl) floorEl.textContent = sim.state.phase === "run" ? `Floor ${sim.getFloorNumber()}` : "Floor 1";
  if (waveEl) {
    waveEl.textContent = sim.state.phase === "run"
      ? (sim._finalBoss ? "Final Boss" : `Wave ${sim.getWaveNumber()}`)
      : "Wave 1";
  }
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
    const pct = maxCd > 0 ? Math.max(0, Math.min(1, 1 - cd / maxCd)) : 1;
    cooldownRing.setAttribute("stroke-dasharray", `${pct * 100} 100`);
    const ready = pct >= 0.995;
    cooldownLabel.textContent = ready ? "DRAW" : "";
    if (nockMeter) {
      nockMeter.classList.toggle("ready", ready);
      nockMeter.classList.toggle("charging", !ready);
      if (ready) nockMeter.classList.remove("blocked");
      nockMeter.style.visibility = sim.junctionPending ? "hidden" : "visible";
    }
  }

  const runQuiver = document.getElementById("run-quiver");
  const runQuiverCount = document.getElementById("run-quiver-count");
  if (runQuiverCount) {
    runQuiverCount.textContent = sim.state.phase === "run"
      ? `Quiver ${sim.quiver.quiverCount} / ${sim.quiver.capacity}`
      : "Quiver 0 / 0";
  }
  if (runQuiver) {
    if (sim.state.phase === "run") {
      const queue = (sim.quiver.peekQueue ? sim.quiver.peekQueue() : sim.quiver.peekQuiver()).slice(0, 4);
      const sig = queue.map((a) => `${a.type}:${a.level || 1}`).join(",") || "empty";
      if (runQuiver.dataset.sig !== sig) {
        runQuiver.dataset.sig = sig;
        runQuiver.innerHTML = queue.map((a, i) => {
          const def = getArrowDef(a.type);
          const lv = a.level || 1;
          return `<div class="run-quiver-card ${i === 0 ? "ready" : ""}" style="--shaft:${def.color};border-color:${def.color}" title="${def.name} Lv${lv}">
            <svg class="rq-icon" viewBox="0 0 16 22" aria-hidden="true"><polygon points="8,0 15,8 10,8 10,22 6,22 6,8 1,8" fill="currentColor"/></svg>
            <div class="rq-lv">Lv${lv}</div>
          </div>`;
        }).join("") || `<div class="run-quiver-card"><div class="rq-lv">Empty</div></div>`;
      }
    } else if (runQuiver.dataset.sig !== "off") {
      runQuiver.dataset.sig = "off";
      runQuiver.innerHTML = "";
    }
  }

  renderRunPouch();
  drawMinimap();

  if (debugPanel && location.search.includes("debug=1")) {
    debugPanel.style.display = "block";
    debugPanel.textContent = `wave=${sim.waveIndex} en=${sim.enemies.length} projs=${sim.projectiles.length}`;
  }

  setPathChoice(sim.state.phase === "run" && !!sim.junctionPending);
}

function renderRunPouch() {
  const root = document.getElementById("run-pouch");
  if (!root) return;
  const cap = Math.max(1, sim.state.pouchCapacity || 1);
  const bindings = sim.state.pouchBindings || [];
  const bag = sim.state.bag || [];
  let sig = String(cap);
  const slots = [];
  for (let i = 0; i < cap; i++) {
    const bagIndex = bindings[i];
    const id = bagIndex != null ? bag[bagIndex] : null;
    const def = getConsumable(id);
    sig += `|${def?.id || ""}:${bagIndex ?? ""}`;
    slots.push({ i, def });
  }
  if (root.dataset.sig === sig) return;
  root.dataset.sig = sig;
  root.innerHTML = slots.map(({ i, def }) => `<button type="button" class="run-pouch-slot${def ? "" : " empty"}" data-pouch-use="${i}" aria-label="${def ? `Use ${def.name}` : `Pouch slot ${i + 1} empty`}">
      <span class="run-pouch-num">${i + 1}</span>
      <span class="run-pouch-mark">${def ? consumableIconSvg(def.id) : "—"}</span>
      <span class="run-pouch-tag">${def ? "Use" : "Empty"}</span>
    </button>`).join("");
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
  if (sim.state.phase !== "run") return null;
  const dist = Math.max(6, (sim.segmentEndZ || 0) - (sim.playerWorldZ || 0));
  const dirs = new Set((sim.junctionChoices || []).map((c) => c.direction));
  const elevator = !!sim._approachingElevator || !dirs.size;
  return {
    dist,
    left: dirs.has("left"),
    right: dirs.has("right"),
    forward: elevator || dirs.has("forward"),
    pending: !!sim.junctionPending,
    choices: sim.junctionChoices || [],
    elevator,
  };
}

// ─── Rendering ────────────────────────────────────────────────
function drawCorridor(ctx) {
  dungeon.resize(canvas.clientWidth, canvas.clientHeight);
  const t = Number.isFinite(sim.runTime) ? sim.runTime : 0;
  dungeon.setPose({
    x: sim.mapX || 0,
    z: sim.mapZ || 0,
    lookYaw: ((sim.heading + (sim.turnAngle || 0)) * Math.PI) / 180,
    walkYaw: ((sim.heading || 0) * Math.PI) / 180,
    along: (sim.playerWorldZ || 0) - (sim.segmentStartZ || 0),
    ahead: (sim.segmentEndZ || 0) - (sim.playerWorldZ || 0),
    segmentIndex: sim.segmentIndex || 0,
  });
  dungeon.combatYaw = sim.turning
    ? ((sim.heading + (sim.turnTarget || 0)) * Math.PI) / 180
    : null;
  const nocked = sim.quiver?.peekQueue?.()?.[0];
  const nockDef = getArrowDef(nocked ? nocked.type : "wood");
  dungeon.nockedArrow = nocked ? { type: nockDef.type, color: nockDef.color } : null;
  dungeon.drawHall(ctx, sim.playerWorldZ, t, getJunctionView(), {
    walking: (sim.movingForward || sim._forwardCommit || sim._approachingJunction || sim._approachingElevator) && !sim.junctionPending && !sim.turning,
    turning: !!sim.turning,
    turnU: sim.turnU || 0,
    turnSign: Math.sign(sim.turnTarget || 0) || 1,
  });

  ctx.save();
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
        const bagOpen = document.getElementById("run-bag")?.classList.contains("active");
        if (!bagOpen) sim.tick();
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
      if (sim.state.phase === "hub") return;
      try { drawCorridor(ctx); }
      catch(err) {
        console.error("Draw error:", err);
        /* keep the loop alive */
      }
    });
    updateUI();
  } catch (err) {
    console.error("Frame error:", err);
    /* keep the loop alive */
  }
  requestAnimationFrame(gameLoop);
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.state) sim.state.deserialize(data.state);
    if (data.quiver) sim.quiver.deserialize(data.quiver);
    refillQuiverEmptySlots(sim.state);
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
