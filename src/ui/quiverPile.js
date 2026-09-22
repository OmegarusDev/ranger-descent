/**
 * Overlapping next-arrow pile. Ready shaft sits at the bottom (nearest the bow).
 * Nock flies that card onto the string; remaining cards drop into its place.
 */
import { getArrowLook } from "../game/arrowLook.js";
import { getArrowDef } from "../game/QuiverDeckManager.js";
import { arrowIconSvg } from "./itemIcons.js";

const STACK = 32;
const CARD_H = 56;
const FLY_MS = 420;
const SETTLE_MS = 320;

function reducedMotion() {
  return typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function slotY(i) {
  return -i * STACK;
}

function makeCard(arrow) {
  const lv = arrow.level || 1;
  const look = getArrowLook(arrow.type, lv);
  const def = getArrowDef(arrow.type, lv);
  const el = document.createElement("div");
  el.className = `run-quiver-card ink-frame rq-${look.quality}`;
  if (look.element !== "none" && look.glow) {
    el.classList.add("rq-el");
    el.style.setProperty("--el", look.glow);
  }
  if (look.shafts > 1) el.classList.add("rq-multi");
  el.dataset.arrowId = String(arrow.id);
  el.style.setProperty("--shaft", look.fill);
  el.title = def.name;
  const lvMark = lv > 1 ? `<div class="rq-lv">Lv${lv}</div>` : "";
  el.innerHTML = `${arrowIconSvg(arrow.type, look.fill, lv)}${lvMark}`;
  return el;
}

function flyCard(cardEl, flyRoot, target, reduce) {
  if (!cardEl || !flyRoot) return;
  const r = cardEl.getBoundingClientRect();
  const clone = cardEl.cloneNode(true);
  clone.classList.add("run-quiver-card-fly");
  clone.style.position = "fixed";
  clone.style.left = `${r.left}px`;
  clone.style.top = `${r.top}px`;
  clone.style.width = `${r.width}px`;
  clone.style.height = `${r.height}px`;
  clone.style.margin = "0";
  clone.style.zIndex = "80";
  clone.style.pointerEvents = "none";
  flyRoot.appendChild(clone);
  cardEl.remove();
  if (reduce) {
    clone.remove();
    return clone;
  }
  const dx = target.x - (r.left + r.width / 2);
  const dy = target.y - (r.top + r.height / 2);
  clone.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.22, 0.72, 0.18, 1), opacity ${FLY_MS}ms ease`;
  requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.32) rotate(-18deg)`;
    clone.style.opacity = "0";
  });
  const done = () => { clone.remove(); };
  clone.addEventListener("transitionend", done, { once: true });
  setTimeout(done, FLY_MS + 80);
  return clone;
}

function layoutCards(root, arrows, { enterIds, reduce }) {
  const trans = reduce ? "none" : `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.7, 0.2, 1), opacity ${SETTLE_MS}ms ease`;
  arrows.forEach((a, i) => {
    const el = root.querySelector(`[data-arrow-id="${a.id}"]`);
    if (!el) return;
    el.classList.toggle("ready", i === 0);
    el.style.zIndex = String(20 - i);
    const y = slotY(i);
    if (enterIds.has(String(a.id)) && !reduce) {
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = `translateY(${y - 40}px)`;
      requestAnimationFrame(() => {
        el.style.transition = trans;
        el.style.opacity = "1";
        el.style.transform = `translateY(${y}px)`;
      });
    } else {
      el.style.transition = trans;
      el.style.opacity = "1";
      el.style.transform = `translateY(${y}px)`;
    }
  });
}

/**
 * Keep DOM cards keyed by arrow.id. `arrows` is the visible pile (nocked shaft omitted).
 * `nock` is the ready arrow currently on the bow, or null.
 */
export function syncQuiverPile(root, flyRoot, { arrows = [], nock = null, flyTo = null } = {}) {
  if (!root) return;
  const state = root._pile || (root._pile = { nockId: null, flyEl: null });
  const reduce = reducedMotion();
  const nextIds = arrows.map((a) => String(a.id));
  const nextSet = new Set(nextIds);
  const sig = `${nextIds.join(",")}|${nock ? nock.id : ""}`;

  if (state.nockId && (!nock || String(nock.id) !== state.nockId)) {
    const restored = nextSet.has(state.nockId);
    if (state.flyEl && state.flyEl.parentNode) state.flyEl.remove();
    state.flyEl = null;
    if (restored) state.restoreId = state.nockId;
    else {
      const leftover = root.querySelector(`[data-arrow-id="${state.nockId}"]`);
      if (leftover) leftover.remove();
    }
    state.nockId = null;
  }

  if (nock && String(nock.id) !== state.nockId) {
    const el = root.querySelector(`[data-arrow-id="${nock.id}"]`);
    const target = flyTo || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.78 };
    if (el) state.flyEl = flyCard(el, flyRoot, target, reduce) || null;
    state.nockId = String(nock.id);
  }

  if (state.sig === sig) return;
  state.sig = sig;

  const enterIds = new Set();
  for (const a of arrows) {
    if (!root.querySelector(`[data-arrow-id="${a.id}"]`)) {
      root.appendChild(makeCard(a));
      if (state.restoreId !== String(a.id)) enterIds.add(String(a.id));
    }
  }
  state.restoreId = null;
  for (const el of [...root.querySelectorAll(".run-quiver-card[data-arrow-id]")]) {
    if (!nextSet.has(el.dataset.arrowId)) el.remove();
  }

  const count = Math.max(arrows.length, 1);
  root.style.height = `${CARD_H + Math.max(0, count - 1) * STACK}px`;
  layoutCards(root, arrows, { enterIds, reduce });

  const empty = root.querySelector(".run-quiver-empty");
  if (!arrows.length) {
    if (!empty) {
      const hole = document.createElement("div");
      hole.className = "run-quiver-card run-quiver-empty ink-frame";
      hole.innerHTML = `<div class="rq-lv">Empty</div>`;
      root.appendChild(hole);
    }
  } else if (empty) {
    empty.remove();
  }
}

export function clearQuiverPile(root, flyRoot) {
  if (root) {
    root.innerHTML = "";
    root._pile = { nockId: null, flyEl: null, sig: "" };
    root.style.height = "";
  }
  if (flyRoot) flyRoot.innerHTML = "";
}
