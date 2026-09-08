/**
 * main.js — Entry point. Wires DungeonView, CorridorSim, InputHandler.
 */
import { RenderEngine2D5 } from "./engine/RenderEngine2D5.js";
import { DungeonView } from "./engine/DungeonView.js";
import { CONFIG } from "./data/config.js";
import { rollShopArrows, getShopArrowCatalog, getArrowDef, arrowShort, isWoodType } from "./game/QuiverDeckManager.js";
import { CorridorSim } from "./game/CorridorSim.js";
import { InputHandler } from "./game/InputHandler.js";
import { STAT_INFO } from "./game/GameStateManager.js";
// Cache-bust only at the HTML entry (main.js?v=N). Nested imports stay unversioned
// so each module has one identity — mixed ?v= was splitting CONFIG across the graph.

/** Player-facing coin mark (colon sign — C with bars). */
const COIN = "₡";
function coinLabel(n) {
  return `${COIN}${Math.max(0, Math.floor(n || 0))}`;
}

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
  const sig = (sim.junctionChoices || []).map((c) => `${c.direction}:${c.soulBonus || 0}`).join("|");
  if (wasActive && pathChoice.dataset.sig === sig) {
    const escapeSouls = document.getElementById("escape-souls");
    if (escapeSouls) {
      const n = sim.state.runSouls || 0;
      escapeSouls.textContent = n > 0 ? `Bank ${coinLabel(n)} and leave` : "Leave with nothing from this delve";
    }
    return;
  }
  pathChoice.dataset.sig = sig;

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
    const names = prettyPathNames(choice);
    const bonus = choice && choice.soulBonus ? `<span class="path-souls">+${coinLabel(choice.soulBonus)}</span>` : `<span class="path-souls path-souls-quiet">safer</span>`;
    btn.innerHTML = `<span class="path-dir">${labels[dir]}</span><span class="path-icons">${icons}</span>${names ? `<small>${names}</small>` : ""}${bonus}`;
  }
  const escapeSouls = document.getElementById("escape-souls");
  if (escapeSouls) {
    const n = sim.state.runSouls || 0;
    escapeSouls.textContent = n > 0 ? `Bank ${coinLabel(n)} and leave` : "Leave with nothing from this delve";
  }
}

function escapeToSurface() {
  if (sim.state.phase !== "run" || !sim.junctionPending) return;
  sim.junctionPending = false;
  setPathChoice(false);
  input.choiceMode = false;
  sim.commitRunStash();
  sim.state.bankSouls();
  sim.quiver.packForHub();
  sim.running = false;
  sim.state.hubVisits++;
  saveGame();
  sim.state.enterHub();
  const hubSouls = document.getElementById("hub-souls");
  if (hubSouls) hubSouls.textContent = sim.state.souls;
}

function showWaveLoot(report) {
  const panel = document.getElementById("wave-loot");
  const body = document.getElementById("wave-loot-body");
  if (!panel || !body) return;
  const kills = report?.kills || [];
  const broken = report?.broken || [];
  const ground = report?.ground;

  let killHtml = kills.map((k) => {
    const drop = k.drop ? `<span class="gold">${k.drop.label}</span>` : `<span class="muted">—</span>`;
    return `<div class="wave-loot-line"><span>${k.name}</span><span><span class="gold">${coinLabel(k.coins)}</span> · ${drop}</span></div>`;
  }).join("");
  if (!killHtml) killHtml = `<div class="wave-loot-empty">No foes left spoils worth naming.</div>`;

  let groundHtml = ground
    ? `<div class="wave-loot-line"><span>${ground.detail || "On the ground"}</span><span class="gold">${ground.kind === "coins" ? coinLabel(ground.amount) : ground.label}</span></div>`
    : `<div class="wave-loot-empty">Nothing else on the floor.</div>`;

  let brokeHtml = broken.map((b) => {
    const why = b.reason === "no_room" ? "no room" : "broke";
    return `<div class="wave-loot-line"><span class="broke">${b.label}</span><span class="muted">${why}</span></div>`;
  }).join("");
  if (!brokeHtml) brokeHtml = `<div class="wave-loot-empty">All spent shafts came back.</div>`;

  body.innerHTML = `
    <div class="wave-loot-section"><h4>From the fallen</h4>${killHtml}</div>
    <div class="wave-loot-section"><h4>On the ground</h4>${groundHtml}</div>
    <div class="wave-loot-section"><h4>Broken shafts</h4>${brokeHtml}</div>
  `;
  panel.classList.add("active");
  setPathChoice(false);
  closeRunBag();
}

function hideWaveLoot() {
  const panel = document.getElementById("wave-loot");
  if (panel) panel.classList.remove("active");
}

let _runBagPending = null;

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

function openRunBag() {
  if (sim.state.phase !== "run") return;
  if (sim.lootPending || sim._lootDelayT > 0) return;
  populateRunBag();
  const panel = document.getElementById("run-bag");
  if (panel) {
    panel.classList.add("active");
    panel.setAttribute("aria-hidden", "false");
  }
}

function populateRunBag() {
  const qEl = document.getElementById("run-bag-quiver");
  const pEl = document.getElementById("run-bag-pouch");
  const sEl = document.getElementById("run-bag-stash");
  if (!qEl || !pEl || !sEl) return;
  const loaded = sim.quiver.peekQuiver();
  qEl.innerHTML = loaded.map((a, i) => {
    const def = getArrowDef(a.type);
    return `<button type="button" class="run-bag-cell" data-discard-arrow="${i}">
      <span>${arrowShort(a.type)}</span>
      <small>Lv${a.level || 1}</small>
      <small>${isWoodType(a.type) ? "snap" : "stash"}</small>
    </button>`;
  }).join("") || `<div class="wave-loot-empty">Quiver empty</div>`;

  const pouch = sim.state.pouch || [];
  pEl.innerHTML = [0, 1].map((i) => {
    const id = pouch[i];
    if (!id) return `<div class="run-bag-cell"><small>empty</small></div>`;
    const names = { potion_salve: "Remedy", potion_bandage: "Bandage", potion_tonic: "Tonic" };
    return `<button type="button" class="run-bag-cell" data-discard-pouch="${i}">
      <span>${names[id] || id}</span>
      <small>stash</small>
    </button>`;
  }).join("");

  const stash = sim.runStash || { arrows: [], items: [] };
  const bits = [
    ...(stash.arrows || []).map((a) => {
      const def = getArrowDef(a.type);
      return `<div class="run-bag-cell"><span>${arrowShort(a.type)}</span><small>Lv${a.level || 1}</small></div>`;
    }),
    ...(stash.items || []).map((it) => `<div class="run-bag-cell"><span>${it.label || it.itemId}</span><small>stashed</small></div>`),
  ];
  sEl.innerHTML = bits.join("") || `<div class="wave-loot-empty">Nothing stashed this delve</div>`;
}

function askRunBagDiscard(pending, text) {
  _runBagPending = pending;
  const conf = document.getElementById("run-bag-confirm");
  const confText = document.getElementById("run-bag-confirm-text");
  if (confText) confText.textContent = text;
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
    sim.tryDaggerAt(x, y, (wx, dist) => dungeon.project(wx, dist));
  }
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
    closeHubSheets();
    sim.quiver.packForHub();
    saveGame();
    populateHub();
  }

  if (phase !== "run") setPathChoice(false);

  if (phase === "death" || phase === "victory") {
    const stats = sim.state.getRunStats();
    if (phase === "victory") sim.commitRunStash();
    else sim.discardRunStash();
    const earned = phase === "victory" ? sim.state.bankSouls() : 0;
    const deathCoin = phase === "death" ? sim.state.discardRunSouls() : null;
    sim.quiver.packForHub();
    hideWaveLoot();
    closeRunBag();
    saveGame();
    if (deathStats) {
      const soulLine = phase === "victory"
        ? `<div class="end-coin banked">+${coinLabel(earned)} banked</div>`
        : `<div class="end-coin">Kept ${coinLabel(deathCoin.kept)} · lost ${coinLabel(deathCoin.lost)}<span class="end-safe">Vault coin is safe.</span></div>`;
      deathStats.innerHTML = `
        <div class="end-story ${phase === "victory" ? "victory" : "defeat"}">${phase === "victory" ? "The final boss falls. You ride the last elevator to daylight." : "You fall. Most of the delve's coin scatters into the dark."}</div>
        <div class="end-stat">Reached: <b>${sim.getProgressLabel()}</b></div>
        <div class="end-stat">Halls cleared: <b>${Math.max(0, sim.waveIndex - (phase === "victory" ? 0 : 1))}</b></div>
        <div class="end-stat">Kills: <b>${stats.enemiesKilled}</b></div>
        <div class="end-stat">Arrows: <b>${stats.arrowsFired}</b></div>
        ${soulLine}
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
  steel: "kinetic", silver: "kinetic", stun: "kinetic", piercing: "kinetic",
  double: "kinetic", normal: "kinetic", barbed: "kinetic", oil: "acid",
  poison: "poison", shock: "shock", fire: "fire",
};
sim.on("dagger_hit", (e) => {
  engine.fx.hit(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, "kinetic");
  engine.fx.damageNumber(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, Math.round(e.damage));
  engine.punch(4.2);
});

sim.on("projectile_hit", (e) => {
  const fxType = FX_TYPE[e.projectile.element] || e.projectile.element;
  engine.fx.hit(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, fxType);
  engine.fx.damageNumber(e.x / CONFIG.CELL_SIZE, e.dist / CONFIG.CELL_SIZE, Math.round(e.damage));
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
  saveGame();
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
  saveGame();
});

sim.on("wave_loot", (e) => {
  showWaveLoot(e.report);
});

sim.on("wave_loot_done", () => {
  hideWaveLoot();
  saveGame();
});

sim.on("run_start", () => {
  setPathChoice(false);
  hideWaveLoot();
  closeRunBag();
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

document.getElementById("btn-wave-loot-ok")?.addEventListener("click", () => {
  sim.acknowledgeWaveLoot();
});

document.getElementById("btn-run-bag")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  openRunBag();
});
document.getElementById("btn-run-bag-close")?.addEventListener("click", () => closeRunBag());
document.getElementById("run-bag")?.addEventListener("click", (e) => {
  if (e.target.id === "run-bag") closeRunBag();
  const arrowBtn = e.target.closest("[data-discard-arrow]");
  if (arrowBtn) {
    const i = Number(arrowBtn.dataset.discardArrow);
    const a = sim.quiver.peekQuiver()[i];
    if (!a) return;
    const wood = isWoodType(a.type);
    askRunBagDiscard(
      { kind: "arrow", index: i },
      wood
        ? `Snap this wood shaft? It cannot be stashed.`
        : `Send ${getArrowDef(a.type).name} to the run stash? Recover it only if you escape.`
    );
    return;
  }
  const pouchBtn = e.target.closest("[data-discard-pouch]");
  if (pouchBtn) {
    const i = Number(pouchBtn.dataset.discardPouch);
    askRunBagDiscard(
      { kind: "pouch", index: i },
      "Send this pouch item to the run stash? Recover it only if you escape."
    );
  }
});
document.getElementById("btn-run-bag-cancel")?.addEventListener("click", () => {
  const conf = document.getElementById("run-bag-confirm");
  if (conf) conf.classList.remove("active");
  _runBagPending = null;
});
document.getElementById("btn-run-bag-confirm")?.addEventListener("click", () => {
  if (!_runBagPending) return;
  if (_runBagPending.kind === "arrow") sim.discardQuiverArrowToStash(_runBagPending.index);
  if (_runBagPending.kind === "pouch") sim.discardPouchToStash(_runBagPending.index);
  _runBagPending = null;
  const conf = document.getElementById("run-bag-confirm");
  if (conf) conf.classList.remove("active");
  populateRunBag();
  saveGame();
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

$("#btn-start").addEventListener("click", () => {
  // New players skip the elevator popup until E1 (floor 11) is unlocked.
  if (sim.state.getMaxElevatorUnlocked() < 1) {
    startDungeonRun();
    return;
  }
  openElevatorModal();
});
$("#btn-elev-cancel").addEventListener("click", () => {
  closeElevatorModal();
});
$("#btn-elev-go").addEventListener("click", () => {
  startDungeonRun();
});
$("#elev-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeElevatorModal();
});
$("#btn-hub").addEventListener("click", () => {
  if (sim.state.phase === "death" || sim.state.phase === "victory") {
    sim.state.hubVisits++;
  }
  sim.state.enterHub();
});

// ─── Hub sheets ───────────────────────────────────────────────
function closeHubSheets() {
  document.querySelectorAll(".hub-sheet").forEach((el) => el.classList.remove("open"));
  hidePackOverlays();
}
function openHubSheet(id) {
  closeElevatorModal();
  closeHubSheets();
  const sheet = document.getElementById(id);
  if (sheet) sheet.classList.add("open");
}

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

const ENEMY_DEFS_BESTIARY = [
  { id: "slime",          name: "Slime",           hp: 5,   dmg: 4,  speed: 9,   souls: "1–3₡", armor: "None",   color: "#b84a55", behavior: "Oozes forward with a slow, wet pulse" },
  { id: "slime_large",    name: "Large Slime",     hp: 14,  dmg: 6,  speed: 7,   souls: "2–5₡", armor: "None",   color: "#c45a65", behavior: "Tougher slime that splits into 2 smaller slimes on death" },
  { id: "slime_huge",     name: "Huge Slime",      hp: 28,  dmg: 8,  speed: 5,   souls: "4–8₡", armor: "None",   color: "#d46a75", behavior: "Massive slime that splits into 2 Large Slimes" },
  { id: "goblin_runt",    name: "Goblin Runt",     hp: 7,   dmg: 3,  speed: 20,  souls: "1–7₡", armor: "None",   color: "#6aaa5a", behavior: "Walks forward, then dodges side to side in a rhythm" },
  { id: "goblin_warrior", name: "Goblin Warrior",  hp: 14,  dmg: 5,  speed: 16,  souls: "3–8₡", armor: "None",   color: "#5a9a4a", behavior: "Heavier goblin — floor-1 hall boss with escorts" },
  { id: "goblin_chieftain",name: "Goblin Chieftain",hp: 22, dmg: 7,  speed: 13,  souls: "5–12₡", armor: "None",   color: "#4a8a3a", behavior: "Powerful goblin leader, slow but devastating" },
  { id: "imp",            name: "Imp",             hp: 8,   dmg: 3,  speed: 24,  souls: "1–4₡", armor: "None",   color: "#d4892a", behavior: "Notices you, then charges the lane" },
  { id: "scamp",          name: "Scamp",           hp: 12,  dmg: 4,  speed: 22,  souls: "2–6₡", armor: "None",   color: "#e0a030", behavior: "Faster imp variant, charges quickly" },
  { id: "demon",          name: "Demon",           hp: 20,  dmg: 7,  speed: 16,  souls: "4–10₡", armor: "None",   color: "#c04040", behavior: "Slow, heavy, devastating charger" },
  { id: "skeleton",       name: "Skeleton",        hp: 18,  dmg: 7,  speed: 11,  souls: "2–8₡", armor: "None",   color: "#c8c0b0", behavior: "Steady advance down the hall" },
  { id: "skeleton_archer",name: "Skeleton Archer",  hp: 12,  dmg: 4,  speed: 12,  souls: "2–7₡", armor: "None",   color: "#b0a898", behavior: "Stops at range and fires bone arrows at you" },
  { id: "ghoul",          name: "Ghoul",           hp: 10,  dmg: 4,  speed: 15,  souls: 1, armor: "None",   color: "#7a6a5a", behavior: "Shambling undead" },
  { id: "wight",          name: "Wight",           hp: 16,  dmg: 6,  speed: 13,  souls: 2, armor: "None",   color: "#6a5a4a", behavior: "Tougher ghoul, steady advance" },
  { id: "wraith",         name: "Wraith",          hp: 12,  dmg: 5,  speed: 18,  souls: 2, armor: "Energy", color: "#8a7ab8", behavior: "Phases through attacks, zigzags unpredictably" },
  { id: "vampire",        name: "Vampire",         hp: 18,  dmg: 6,  speed: 17,  souls: 3, armor: "None",   color: "#a02020", behavior: "Notices player, charges, drains HP" },
  { id: "vampire_lord",   name: "Vampire Lord",    hp: 28,  dmg: 8,  speed: 19,  souls: 5, armor: "None",   color: "#801010", behavior: "Faster, stronger vampire" },
  { id: "lich",           name: "Lich",            hp: 22,  dmg: 5,  speed: 10,  souls: 4, armor: "None",   color: "#6040a0", behavior: "Ranged magic, summons minions" },
  { id: "bat",            name: "Bat",             hp: 4,   dmg: 2,  speed: 28,  souls: 1, armor: "None",   color: "#4a3a5a", behavior: "Hovers in the hall, might poison" },
  { id: "spider",         name: "Spider",          hp: 6,   dmg: 3,  speed: 20,  souls: 1, armor: "None",   color: "#5a4a3a", behavior: "Creeps forward, might poison" },
  { id: "giant_spider",   name: "Giant Spider",    hp: 16,  dmg: 5,  speed: 16,  souls: 2, armor: "None",   color: "#4a3a2a", behavior: "Larger, tougher spider" },
  { id: "orc",            name: "Orc",             hp: 18,  dmg: 7,  speed: 14,  souls: 3, armor: "None",   color: "#5a7a4a", behavior: "Tough, steady advance" },
  { id: "ogre",           name: "Ogre",            hp: 28,  dmg: 10, speed: 9,   souls: 5, armor: "Heavy",  color: "#6a8a5a", behavior: "Very tough, slow, heavy" },
  { id: "troll",          name: "Troll",           hp: 22,  dmg: 8,  speed: 12,  souls: 4, armor: "None",   color: "#4a6a3a", behavior: "Regenerates HP while alive" },
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

const SHOP_QUIVERS = (() => {
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
    if (step >= 1) cost = Math.round(cost * 1.15);
  }
  return list;
})();

/** Legacy shop ids → capacity. */
const QUIVER_CAP_BY_ID = {
  quiver_basic: 10,
  quiver_8: 10,
  quiver_small: 12,
  quiver_medium: 16,
  quiver_large: 20,
};
for (const q of SHOP_QUIVERS) QUIVER_CAP_BY_ID[q.id] = q.capacity;

function quiverCapFromId(id) {
  if (!id) return 10;
  if (QUIVER_CAP_BY_ID[id] != null) return QUIVER_CAP_BY_ID[id];
  const m = /^quiver_(\d+)$/.exec(id);
  if (m) {
    const n = parseInt(m[1], 10);
    return Math.max(10, Math.min(30, n === 8 ? 10 : n));
  }
  return 10;
}

/** Always the next 3 upgrades after the equipped quiver's capacity. */
function getShopQuivers(state) {
  const cur = quiverCapFromId(state.equipped?.quiver);
  return SHOP_QUIVERS.filter((q) => q.capacity > cur).slice(0, 3);
}

const STARTER_GEAR = [
  { id: "bow_hunting", name: "Hunting Bow", slot: "bow", desc: "Your constant. Always strung.", stats: "Starter bow", icon: "🏹", section: "weapons" },
  { id: "dagger_iron", name: "Iron Dagger", slot: "dagger", desc: "When they reach you, you trade blows.", stats: "Close work", icon: "🗡", section: "weapons" },
  { id: "amulet_greenhorn", name: "Greenhorn Charm", slot: "amulet", desc: "A luck-stone for the unblooded.", stats: "+2 HP while worn", icon: "◆", section: "jewels" },
  { id: "potion_salve", name: "Herbal Remedy", slot: "potion", cost: 12, desc: "A bitter draught of crushed herbs. Fits the pouch.", stats: "Consumable", icon: "✚", section: "potions" },
  { id: "potion_bandage", name: "Field Bandage", slot: "potion", cost: 10, desc: "Linen and resin. Bind a wound between halls.", stats: "Consumable", icon: "✚", section: "potions" },
  { id: "potion_tonic", name: "Clearing Tonic", slot: "potion", cost: 14, desc: "Burns contact venom out of the blood.", stats: "Consumable", icon: "✚", section: "potions" },
  { id: "trinket_lucky_tooth", name: "Lucky Tooth", slot: "amulet", cost: 18, desc: "A goblin charm. More superstition than steel.", stats: "Trinket", icon: "◆", section: "jewels" },
];

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

function allGearItems() {
  return [...STARTER_GEAR, ...SHOP_QUIVERS, ...ARMOUR_ITEMS];
}

function findItem(id) {
  if (!id) return null;
  return allGearItems().find((i) => i.id === id) || null;
}

function ensureStarterKit(state) {
  if (!state.ownedItems) state.ownedItems = [];
  if (!state.equipped) state.equipped = {};
  if (!state.pouch || !state.pouch.length) state.pouch = [null, null];
  state.pouchCapacity = state.pouchCapacity || 2;
  const starters = ["bow_hunting", "dagger_iron", "amulet_greenhorn", "quiver_basic"];
  for (const id of starters) {
    if (!state.ownedItems.includes(id)) state.ownedItems.push(id);
  }
  if (!state.equipped.bow) state.equipped.bow = "bow_hunting";
  if (!state.equipped.dagger) state.equipped.dagger = "dagger_iron";
  if (state.equipped.amulet === undefined) state.equipped.amulet = "amulet_greenhorn";
  if (!state.equipped.quiver) state.equipped.quiver = "quiver_basic";
  if (!state.ownedItems.includes("potion_salve")) state.ownedItems.push("potion_salve");
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

function syncArmorRating(state) {
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

let packSel = null;
let packNote = null;

/** Hub / equip / post-death: sync capacity, pack loaded shafts, craft-fill empties only. */
function refillQuiverEmptySlots(state = sim.state) {
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
  const pouchEl = document.getElementById("pack-pouch-slots");
  const chestEl = document.getElementById("pack-chest-grid");
  if (!quiverSlots || !dollEl || !pouchEl || !chestEl) return;

  hidePackOverlays();
  const q = sim.quiver;
  const loaded = q.peekQuiver();
  const cap = q.capacity;
  const stored = q.peekStorage();
  const worn = equippedIds(state);
  const pouch = state.pouch || [null, null];

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
  // Even capacities → equal rows (8 → 4+4, 10 → 5+5, …).
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

  pouchEl.innerHTML = [0, 1].map((i) => {
    const item = findItem(pouch[i]);
    return `<button type="button" class="pack-cell ${item ? "filled" : "pack-cell-empty"}" data-pouch="${i}">
      ${item ? `<span class="pack-cell-mark">${item.icon || "✚"}</span><span class="pack-cell-sub">${item.name}</span>` : `<span class="pack-cell-sub">empty</span>`}
    </button>`;
  }).join("");

  const chestItems = [];
  stored.forEach((a, i) => chestItems.push({ kind: "arrow", i, arrow: a }));
  for (const id of state.ownedItems || []) {
    if (worn.has(id) || pouch.includes(id)) continue;
    const item = findItem(id);
    if (item) chestItems.push({ kind: "gear", id, item });
  }

  chestEl.innerHTML = chestItems.length
    ? chestItems.map((c) => {
      if (c.kind === "arrow") {
        const def = getArrowDef(c.arrow.type);
        return `<button type="button" class="pack-cell pack-cell-arrow" data-chest-a="${c.i}" style="border-color:${def.color}">
          <span class="pack-cell-mark">${arrowPackLabel(c.arrow.type)}</span>
          <span class="pack-cell-sub">Lv${c.arrow.level}</span>
        </button>`;
      }
      return `<button type="button" class="pack-cell filled" data-chest-g="${c.id}">
        <span class="pack-cell-mark">${c.item.icon || "•"}</span>
        <span class="pack-cell-sub">${c.item.name}</span>
      </button>`;
    }).join("")
    : `<div class="pack-chest-empty">Chest is empty. Buy shafts in the shop.</div>`;

  const load = state.equipLoad || 0;
  const maxLoad = state.getMaxEquipLoad();
  const loadEl = document.getElementById("pack-load");
  if (loadEl) {
    loadEl.textContent = `Load ${load} / ${maxLoad}`;
    loadEl.classList.toggle("overencumbered", load > maxLoad);
  }

  if (packNote) {
    inspectItem(null, packNote);
    packNote = null;
  } else if (!packSel) {
    inspectItem(null, "Tap a slot to change it.");
  }

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
      options.push({
        label: isWoodType(current.type) ? "Cannot store wood" : "Store in chest",
        sub: isWoodType(current.type) ? "Wood shafts stay crafted, never chested" : "Clear this slot",
        onPick: () => {
          if (isWoodType(current.type)) {
            packNote = "Wood arrows are never sent to storage.";
            populateHub();
            return;
          }
          q.setQuiverSlot(slotIndex, null);
          saveGame();
          populateHub();
        },
      });
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
    const def = getArrowDef(stored[i].type);
    const tipItem = { name: def.name, desc: def.desc, stats: def.stats };
    el.addEventListener("pointerenter", (evt) => showPackTip(tipItem, el, evt.clientX, evt.clientY));
    el.addEventListener("pointerleave", () => {
      const tip = document.getElementById("pack-tip");
      if (tip) tip.hidden = true;
    });
    el.addEventListener("click", () => {
      if (q.moveArrowToQuiver(i)) {
        packNote = "Loaded into the quiver.";
        saveGame();
        populateHub();
      } else {
        inspectItem(def, "Quiver is full. Tap a quiver slot to swap.");
      }
    });
  });

  chestEl.querySelectorAll("[data-chest-g]").forEach((el) => {
    const item = findItem(el.dataset.chestG);
    if (!item) return;
    el.addEventListener("pointerenter", (evt) => showPackTip(item, el, evt.clientX, evt.clientY));
    el.addEventListener("pointerleave", () => {
      const tip = document.getElementById("pack-tip");
      if (tip) tip.hidden = true;
    });
    el.addEventListener("click", () => {
      inspectItem(item);
      if (item.slot === "potion") {
        const empty = pouch.findIndex((x) => !x);
        if (empty >= 0) {
          state.pouch[empty] = item.id;
          saveGame();
          populateHub();
          return;
        }
        inspectItem(item, "Pouch is full. Tap a pouch slot to swap.");
        return;
      }
      if (item.slot && GEAR_PICK_SLOTS.has(item.slot)) {
        state.equipped[item.slot] = item.id;
        if (item.slot === "quiver") refillQuiverEmptySlots(state);
        saveGame();
        populateHub();
      }
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

  pouchEl.querySelectorAll("[data-pouch]").forEach((el) => {
    el.addEventListener("click", (evt) => {
      const i = parseInt(el.dataset.pouch, 10);
      const current = findItem(pouch[i]);
      const options = [];
      if (current) {
        options.push({
          label: current.name,
          sub: current.stats || "In pouch",
          current: true,
          onPick: () => inspectItem(current),
        });
        options.push({
          label: "Put back in chest",
          sub: "Clear this cell",
          onPick: () => {
            state.pouch[i] = null;
            saveGame();
            populateHub();
          },
        });
      } else {
        options.push({ label: "Empty", sub: "No vial here", current: true, onPick: () => {} });
      }
      const potions = (state.ownedItems || [])
        .map(findItem)
        .filter((it) => it && it.slot === "potion" && !pouch.includes(it.id));
      for (const it of potions) {
        options.push({
          label: it.name,
          sub: it.stats || "From chest",
          onPick: () => {
            state.pouch[i] = it.id;
            saveGame();
            populateHub();
          },
        });
      }
      if (!current && potions.length === 0) {
        options.push({ label: "No potions", sub: "Buy one in the shop", onPick: () => {} });
      }
      openPackPicker("Pouch", options, el, evt);
    });
  });
}

function closeElevatorModal() {
  const modal = document.getElementById("elev-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function openElevatorModal() {
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

function populateHub() {
  const state = sim.state;
  ensureStarterKit(state);
  refillQuiverEmptySlots(state);
  syncArmorRating(state);
  state.applyUpgrades();
  const soulsEl = document.getElementById("hub-souls");
  if (soulsEl) soulsEl.textContent = state.souls;
  renderElevatorPicker();

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
        <span>Next ${coinLabel(cost)}</span>
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
          <span class="train-cost">${maxed ? "MAX" : coinLabel(cost)}</span>
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
    const quiverItems = getShopQuivers(state);
    const potionItems = STARTER_GEAR.filter((i) => i.section === "potions" && i.cost);
    const sections = [
      { id: "arrows",  label: "Arrows",  items: arrowItems },
      { id: "potions", label: "Supplies", items: potionItems },
      { id: "quivers", label: "Quivers", items: quiverItems },
      { id: "armour",  label: "Armour",  items: armourItems },
    ];
    shopList.innerHTML = sections.map(section => {
      return `<div class="shop-section">
        <div class="shop-section-title" data-toggle="${section.id}">${section.label} ▾</div>
        <div class="shop-section-items" id="shop-section-${section.id}">
          ${section.items.map(item => {
            const repeatable = item.section === "arrows" || item.section === "potions";
            const isOwned = !repeatable && owned.includes(item.id);
            const afford = state.souls >= item.cost;
            const qual = ARMOUR_QUALITIES.find(q => q.id === item.quality);
            const qualColor = qual ? qual.color : "#e8e4dc";
            return `<div class="shop-item">
              <div class="shop-icon">${item.icon}</div>
              <div class="shop-name" style="color:${qualColor}">${item.name}</div>
              <div class="shop-desc">${item.desc}<br><span style="color:#8a7348">${item.stats}</span></div>
              <div class="shop-bottom">
                <span class="shop-cost">${isOwned ? "Owned" : coinLabel(item.cost)}</span>
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
        const item = arrowItems.find((i) => i.id === id)
          || potionItems.find((i) => i.id === id)
          || quiverItems.find((i) => i.id === id)
          || armourItems.find((i) => i.id === id)
          || findItem(id);
        if (!item || !state.spendSouls(item.cost)) return;
        if (!state.ownedItems) state.ownedItems = [];
        if (item.section === "arrows") {
          const arrow = {
            type: item.element || item.type || "wood",
            level: item.level || 1,
          };
          sim.quiver.addToStorage(arrow);
        } else if (item.section === "potions") {
          state.ownedItems.push(id);
          const pouch = state.pouch || [];
          const empty = pouch.findIndex((s) => !s);
          if (empty >= 0) state.pouch[empty] = id;
        } else {
          if (!state.ownedItems.includes(id)) state.ownedItems.push(id);
          if (item.section === "quivers") {
            if (!state.equipped) state.equipped = {};
            state.equipped.quiver = id;
            refillQuiverEmptySlots(state);
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
          <div class="bestiary-stat"><span class="bestiary-stat-val">${e.souls}</span><span class="bestiary-stat-label">${COIN}</span></div>
        </div>
      </div>`;
    }).join("");
  }
}

// ─── UI Update ────────────────────────────────────────────────
function updateUI() {
  if (soulsEl) soulsEl.textContent = sim.state.phase === "run" ? (sim.state.runSouls || 0) : sim.state.souls;
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

  const runQuiver = document.getElementById("run-quiver");
  if (runQuiver) {
    if (sim.state.phase === "run") {
      const queue = (sim.quiver.peekQueue ? sim.quiver.peekQueue() : sim.quiver.peekQuiver()).slice(0, 4);
      const sig = queue.map((a) => `${a.type}:${a.level || 1}`).join(",") || "empty";
      if (runQuiver.dataset.sig !== sig) {
        runQuiver.dataset.sig = sig;
        runQuiver.innerHTML = queue.map((a, i) => {
          const def = getArrowDef(a.type);
          const lv = a.level || 1;
          return `<div class="run-quiver-card ${i === 0 ? "ready" : ""}" style="border-color:${def.color}">
            <div class="rq-mark">${arrowShort(a.type)}</div>
            <div class="rq-tag">${i === 0 ? "Ready" : "Next"}</div>
            ${lv > 1 ? `<div class="rq-lv">Lv${lv}</div>` : ""}
          </div>`;
        }).join("") || `<div class="run-quiver-card"><div class="rq-mark">—</div><div class="rq-tag">Empty</div></div>`;
      }
    } else if (runQuiver.dataset.sig !== "off") {
      runQuiver.dataset.sig = "off";
      runQuiver.innerHTML = "";
    }
  }

  drawMinimap();

  if (debugPanel && location.search.includes("debug=1")) {
    debugPanel.style.display = "block";
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
  if (sim.state.phase !== "run") return null;
  // Keep fork openings visible while approaching / turning / choosing.
  if (!sim.junctionPending && !sim.turning && !sim._forwardCommit && !sim._approachingJunction && !sim._approachingElevator) return null;
  if (!sim.junctionChoices || !sim.junctionChoices.length) {
    // Choices are rolled at wave start; if missing during approach, still show geometry.
    if (!sim._approachingJunction && !sim._approachingElevator) return null;
  }
  const dirs = new Set((sim.junctionChoices || []).map((c) => c.direction));
  if (sim.turning && sim._pendingTurnDir) {
    return {
      dist: Math.max(70, sim.segmentEndZ - sim.playerWorldZ),
      left: sim._pendingTurnDir === "left",
      right: sim._pendingTurnDir === "right",
      forward: false,
      pending: false,
      choices: sim.junctionChoices,
      turnU: sim.turnU || 0,
      turnSign: sim._pendingTurnDir === "left" ? -1 : 1,
    };
  }
  if (sim._forwardCommit) {
    return {
      dist: Math.max(55, sim.segmentEndZ - sim.playerWorldZ),
      left: false,
      right: false,
      forward: true,
      pending: false,
      choices: sim.junctionChoices,
    };
  }
  if (sim._approachingElevator) {
    return {
      dist: Math.max(80, sim.segmentEndZ - sim.playerWorldZ),
      left: false,
      right: false,
      forward: true,
      pending: false,
      choices: [],
      elevator: true,
    };
  }
  if (sim._approachingJunction) {
    return {
      dist: Math.max(80, sim.segmentEndZ - sim.playerWorldZ),
      left: dirs.has("left"),
      right: dirs.has("right"),
      forward: dirs.has("forward"),
      pending: false,
      choices: sim.junctionChoices || [],
    };
  }
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
    walking: (sim.movingForward || sim.turning || sim._forwardCommit || sim._approachingJunction || sim._approachingElevator) && !sim.junctionPending,
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
