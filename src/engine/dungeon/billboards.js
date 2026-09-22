/**
 * Enemies and arrows as billboards on the shared camera.
 * Bodies sit on the hall axis (fork while turning), then project with look yaw.
 */
import { getArrowLook } from "../../game/arrowLook.js";
import { placeBody } from "./world.js";

const FAR = 760;

function fogK(dist) {
  const t = Math.max(0, Math.min(1, dist / FAR));
  return t * t;
}

function projectBody(view, body, worldY) {
  const w = placeBody(view.frame, body);
  const p = view.camera.projectWorld(w.x, w.z, worldY);
  if (!p.behind) p.occluded = view.occluded(p.x, p.dist);
  return p;
}

export function drawEnemy(view, e) {
  const layout = enemyLayout(view, e);
  if (!layout || layout.p.occluded) return;
  const { x, top, w, h, foot, p, dist, flying } = layout;
  const ctx = view.ctx;
  ctx.save();
  ctx.globalAlpha = 1 - fogK(dist) * 0.72;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(x, p.floorY - 1, w * (flying ? 0.22 : 0.42), Math.max(1.4, h * 0.07), 0, 0, Math.PI * 2);
  ctx.fill();
  if (e._hitFlash > 0) {
    ctx.shadowColor = "rgba(255, 230, 190, 0.85)";
    ctx.shadowBlur = 10;
  }
  paintFigure(ctx, view, e, x, top, w, h, foot, flying);
  ctx.shadowBlur = 0;
  if (e.hp < e.maxHp) {
    const barW = Math.max(12, w * 0.9);
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(10,8,6,0.82)";
    ctx.fillRect(x - barW / 2, top - 8, barW, 3);
    ctx.fillStyle = ratio > 0.35 ? "#6a8a4a" : "#8a3030";
    ctx.fillRect(x - barW / 2, top - 8, barW * ratio, 3);
  }
  ctx.restore();
}

export function enemyLayout(view, e) {
  const dist = e.dist;
  if (dist < 4 || dist > FAR) return null;
  const flying = !!(e.flying || e.behavior === "hover");
  const type = e.type || "";
  const sz = e.size || 1;
  let worldH;
  let worldY = 0;
  if (flying) {
    worldH = 11 + sz * 5;
    worldY = 20 + Math.sin(view.time * 5.4 + (e.id || 0)) * 2.4;
  } else if (type.includes("slime")) worldH = 11 + sz * 8;
  else if (type.includes("spider")) worldH = 9 + sz * 6;
  else if (type.includes("boss")) worldH = 34 + sz * 5;
  else worldH = 20 + sz * 8;
  const p = projectBody(view, e, flying ? worldY : 0);
  if (p.behind) return null;
  const squash = e._squash > 0 ? 1 - e._squash * 0.24 : 1;
  const stretch = e._squash > 0 ? 1 + e._squash * 0.2 : 1;
  const h = Math.max(10, worldH * p.s) * squash;
  const slime = type.includes("slime");
  const w = Math.max(8, h * (flying ? 1.15 : slime ? 1.35 : 0.58)) * stretch;
  const foot = flying ? p.y + h * 0.38 : p.floorY;
  return { x: p.x, top: foot - h, w, h, foot, p, dist, flying };
}

export function hitTestEnemy(view, e, cssX, cssY) {
  const layout = enemyLayout(view, e);
  if (!layout) return false;
  const { x, top, w, foot } = layout;
  const padX = Math.max(18, w * 0.28);
  const padY = Math.max(18, (foot - top) * 0.2);
  return cssX >= x - w / 2 - padX && cssX <= x + w / 2 + padX
    && cssY >= top - padY && cssY <= foot + padY;
}

function tint(col, flash) {
  if (!flash) return col;
  const m = /^#?([0-9a-f]{6})$/i.exec(col || "");
  if (!m) return "#d8c8b0";
  const n = parseInt(m[1], 16);
  const r = Math.min(255, ((n >> 16) & 255) + 90);
  const g = Math.min(255, ((n >> 8) & 255) + 80);
  const b = Math.min(255, (n & 255) + 70);
  return `rgb(${r},${g},${b})`;
}

function paintFigure(ctx, view, e, x, top, w, h, foot, flying) {
  const mid = top + h * 0.4;
  const col = tint(e.color || "#8a4a4a", e._hitFlash > 0);
  const type = e.type || "";
  ctx.fillStyle = col;
  if (flying || e.behavior === "hover") {
    const flap = Math.sin(view.time * 14 + (e.id || 0)) * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, top + h * 0.42);
    ctx.quadraticCurveTo(x - w * 0.7, top + h * (0.2 + flap), x - w * 0.15, top + h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, top + h * 0.42);
    ctx.quadraticCurveTo(x + w * 0.7, top + h * (0.2 - flap), x + w * 0.15, top + h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, top + h * 0.5, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (type.includes("slime")) {
    const rx = w * 0.5;
    const ry = h * 0.34;
    ctx.beginPath();
    ctx.moveTo(x - rx, foot);
    ctx.quadraticCurveTo(x - rx * 1.12, foot - ry * 1.35, x, foot - ry * 2.05);
    ctx.quadraticCurveTo(x + rx * 1.12, foot - ry * 1.35, x + rx, foot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a1010";
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.22, foot - ry * 1.15, 2.4, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.2, foot - ry * 1.15, 2.4, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (type.includes("spider")) {
    ctx.beginPath();
    ctx.ellipse(x, foot - h * 0.28, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1.2, w * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.18, foot - h * 0.32);
      ctx.quadraticCurveTo(x - w * 0.5, foot - h * 0.5, x - w * 0.6, foot);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, foot - h * 0.32);
      ctx.quadraticCurveTo(x + w * 0.5, foot - h * 0.5, x + w * 0.6, foot);
      ctx.stroke();
    }
    return;
  }
  ctx.fillRect(x - w * 0.2, mid, w * 0.4, h * 0.38);
  ctx.fillRect(x - w * 0.16, top + h * 0.72, w * 0.13, h * 0.28);
  ctx.fillRect(x + w * 0.03, top + h * 0.72, w * 0.13, h * 0.28);
  ctx.beginPath();
  ctx.ellipse(x, top + h * 0.2, w * 0.22, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawProjectile(view, p, enemy = false) {
  const dist = p.dist;
  if (dist == null || dist < -6 || dist > FAR) return;
  const ctx = view.ctx;
  const py = p.worldY != null ? p.worldY : 12;
  if (enemy) {
    const sp = projectBody(view, p, py);
    if (sp.behind || sp.occluded) return;
    const r = Math.max(2.2, 3.2 * sp.s);
    ctx.fillStyle = "#c45a4a";
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const speed = Math.hypot(p.vx || 0, p.vz || 0) || 1;
  const ux = (p.vx || 0) / speed;
  const uz = (p.vz || 0) / speed;
  const look = p.look || getArrowLook(p.element, p.level || 1);
  const shafts = (p.nocked && look.shafts > 1) ? 2 : 1;
  const spread = look.spread || 0;
  const yaw = Math.atan2(ux, uz);
  for (let i = 0; i < shafts; i++) {
    const a = yaw + (i === 0 ? 0 : spread);
    drawShaft(view, p, look, Math.sin(a), Math.cos(a), py, i === 0, ux, uz);
  }
}

function shifted(p, ux, uz, len) {
  return {
    x: (p.x || 0) - ux * len,
    dist: (p.dist || 0) - uz * len,
    worldZ: p.worldZ != null ? p.worldZ - uz * len : undefined,
  };
}

function drawShaft(view, p, look, ux, uz, py, primary, nockUx, nockUz) {
  const ctx = view.ctx;
  const shaft = p.shaftLen != null ? p.shaftLen : 16;
  const tip = projectBody(view, primary ? p : shifted(shifted(p, nockUx, nockUz, shaft), -ux, -uz, shaft), py);
  if (tip.behind) return;
  if (tip.occluded && !p.nocked) return;
  const tailBody = shifted(p, nockUx, nockUz, shaft);
  const tail = projectBody(view, primary ? tailBody : shifted(tailBody, -ux, -uz, 0), py);
  const dx = tip.x - tail.x;
  const dy = tip.y - tail.y;
  const slen = Math.hypot(dx, dy) || 1;
  const nx = dx / slen;
  const ny = dy / slen;
  const px = -ny;
  const pyx = nx;
  const head = p.nocked
    ? Math.max(8, Math.min(18, 5.4 + tip.s * 0.14))
    : Math.max(5.5, Math.min(11, 7.2 * Math.max(0.55, tip.s * 0.07)));
  const fletch = p.nocked ? Math.max(6, Math.min(18, 3.2 + tail.s * 0.1)) : Math.max(3.2, head * 0.55);
  ctx.save();
  if (look.glow && (p.nocked || primary)) {
    const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, head * 2.4);
    g.addColorStop(0, look.glow);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, head * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = p.shaftColor || look.shaftColor || "#e8d8b0";
  ctx.lineWidth = p.nocked ? Math.max(3.2, 0.22 * (tail.s + tip.s)) : Math.max(1.6, 2.4 * tip.s * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  drawArrowHead(ctx, look, tip.x, tip.y, nx, ny, px, pyx, head, p.headColor || look.headColor);
  ctx.strokeStyle = p.fletchColor || look.fletchColor || "#8a4a28";
  ctx.lineWidth = p.nocked ? Math.max(1.6, tail.s * 0.06) : 1.2;
  ctx.beginPath();
  ctx.moveTo(tail.x + px * fletch, tail.y + pyx * fletch);
  ctx.lineTo(tail.x + nx * 1.4, tail.y + ny * 1.4);
  ctx.lineTo(tail.x - px * fletch, tail.y - pyx * fletch);
  ctx.stroke();
  if (primary && p.nocked && p.sightLen > 0) {
    const lookBody = {
      x: (p.x || 0) + ux * p.sightLen,
      dist: (p.dist || 0) + uz * p.sightLen,
      worldZ: p.worldZ != null ? p.worldZ + uz * p.sightLen : undefined,
    };
    const lookPt = projectBody(view, lookBody, py);
    if (!lookPt.behind) {
      ctx.strokeStyle = "rgba(232, 197, 106, 0.42)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(lookPt.x, lookPt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function drawArrowHead(ctx, look, tx, ty, nx, ny, px, pyx, head, color) {
  ctx.fillStyle = color || "#c9a227";
  const shape = look.head || "point";
  if (shape === "blunt") {
    ctx.beginPath();
    ctx.arc(tx - nx * head * 0.2, ty - ny * head * 0.2, head * 0.48, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const long = shape === "bodkin" || shape === "ice" ? 1.28 : 1;
  const wide = shape === "bodkin" ? 0.22 : shape === "flint" ? 0.5 : 0.42;
  ctx.beginPath();
  ctx.moveTo(tx + nx * 1.2, ty + ny * 1.2);
  ctx.lineTo(tx - nx * head * long + px * (head * wide), ty - ny * head * long + pyx * (head * wide));
  ctx.lineTo(tx - nx * head * long - px * (head * wide), ty - ny * head * long - pyx * (head * wide));
  ctx.closePath();
  ctx.fill();
}
