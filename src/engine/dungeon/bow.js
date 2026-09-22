/**
 * Held bow. Limb math is the previous overlay, projected in camera space
 * so the stave stays on the string in front of the player.
 */
import { CONFIG } from "../../data/config.js";

export function drawBowOverlay(view, ctx, input, nockedProj) {
  if (view.junction && view.junction.pending) {
    view._bowRise = 0;
    return;
  }
  const pulling = !!(input && input.isDragging && input.power > 2);
  const pull = pulling ? Math.min(1, input.power / 24) : 0;
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - (view._bowRiseAt || now)) / 1000));
  view._bowRiseAt = now;
  let target = 0;
  let yaw = view._bowTilt || 0;
  if (pulling) {
    target = 1;
    yaw = input.angle || 0;
    view._bowTilt = yaw;
    view._bowHoldUntil = 0;
  } else if (view._bowHoldUntil && now < view._bowHoldUntil) {
    target = Math.min(1, view._bowHoldRise || 1);
    yaw = view._bowHold || 0;
  }
  const k = 1 - Math.exp(-(pulling ? 18 : 6.5) * dt);
  view._bowRise += (target - view._bowRise) * k;
  if (view._bowRise < 0.03 && !pulling) return;
  let posePull = 0;
  if (pulling) posePull = pull;
  else if (view._bowHoldUntil && now < view._bowHoldUntil) posePull = 0.9;
  const rise = view._bowRise;
  const holdY = CONFIG.PLAYER_ARROW_Y || 26;
  const tipAlong = CONFIG.PLAYER_ARROW_ALONG || 18;
  const behind = 7;
  let nockX = 0;
  let nockDist = tipAlong - behind;
  let nockY = holdY - (1 - rise) * 26;
  let ux = 0;
  let uz = 1;
  if (nockedProj && nockedProj.dist != null) {
    const spd = Math.hypot(nockedProj.vx || 0, nockedProj.vz || 0) || 1;
    ux = (nockedProj.vx || 0) / spd;
    uz = (nockedProj.vz || 0) / spd;
    nockX = (nockedProj.x || 0) - ux * behind;
    nockDist = nockedProj.dist - uz * behind;
    nockY = nockedProj.worldY != null ? nockedProj.worldY : nockY;
    if (nockDist < 9) {
      const push = 9 - nockDist;
      nockX += ux * push;
      nockDist = 9;
    }
  }
  drawBow3D(view, ctx, nockX, nockDist, nockY, posePull, ux, uz);
}

function bowWorld(view, nockX, nockDist, nockY, out, up, fwd, ux, uz) {
  return view.project(
    nockX - out + ux * fwd,
    nockDist + uz * fwd,
    nockY + up
  );
}

function bowLimbLocal(s, pull) {
  const t = Math.abs(s);
  const sign = s >= 0 ? 1 : -1;
  const len = s >= 0 ? 14.2 : 7.6;
  const out = 1.9;
  const gripFwd = 1.1 + pull * 4.2;
  const belly = 3.05 * Math.sin(Math.PI * t);
  const tipFwd = 0.18 + (1 - pull) * 1.95;
  const fwd = gripFwd * (1 - t) + tipFwd * t + belly * (0.35 + 0.65 * pull);
  return { out, up: sign * len * t, fwd };
}

function drawBow3D(view, ctx, nockX, nockDist, nockY, pull, ux = 0, uz = 1) {
  const pts = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * 2 - 1;
    const loc = bowLimbLocal(s, pull);
    const p = bowWorld(view, nockX, nockDist, nockY, loc.out, loc.up, loc.fwd, ux, uz);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    pts.push({ p, s, loc });
  }
  if (pts.length < 3) return;
  const grip = [];
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const nxt = pts[Math.min(pts.length - 1, i + 1)];
    const dx = nxt.p.x - cur.p.x;
    const dy = nxt.p.y - cur.p.y;
    const sl = Math.hypot(dx, dy) || 1;
    const thick = (Math.abs(cur.s) < 0.12 ? 7.6 : 5.0 - Math.abs(cur.s) * 1.6) * Math.max(0.08, cur.p.s * 0.055);
    const nx = (-dy / sl) * thick;
    const ny = (dx / sl) * thick;
    if (i === 0) ctx.moveTo(cur.p.x + nx, cur.p.y + ny);
    else ctx.lineTo(cur.p.x + nx, cur.p.y + ny);
    if (Math.abs(cur.s) < 0.18) grip.push({ x: cur.p.x, y: cur.p.y, nx, ny, s: cur.p.s });
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const cur = pts[i];
    const nxt = pts[Math.min(pts.length - 1, i + 1)];
    const dx = nxt.p.x - cur.p.x;
    const dy = nxt.p.y - cur.p.y;
    const sl = Math.hypot(dx, dy) || 1;
    const thick = (Math.abs(cur.s) < 0.12 ? 7.6 : 5.0 - Math.abs(cur.s) * 1.6) * Math.max(0.08, cur.p.s * 0.055);
    const nx = (-dy / sl) * thick;
    const ny = (dx / sl) * thick;
    ctx.lineTo(cur.p.x - nx, cur.p.y - ny);
  }
  ctx.closePath();
  ctx.fillStyle = "#6b4424";
  ctx.strokeStyle = "#1a1008";
  ctx.lineWidth = 1.4;
  ctx.fill();
  ctx.stroke();

  if (grip.length > 1) {
    ctx.beginPath();
    ctx.moveTo(grip[0].x + grip[0].nx * 1.15, grip[0].y + grip[0].ny * 1.15);
    for (let i = 1; i < grip.length; i++) {
      const g = grip[i];
      ctx.lineTo(g.x + g.nx * 1.15, g.y + g.ny * 1.15);
    }
    for (let i = grip.length - 1; i >= 0; i--) {
      const g = grip[i];
      ctx.lineTo(g.x - g.nx * 1.15, g.y - g.ny * 1.15);
    }
    ctx.closePath();
    ctx.fillStyle = "#6b3418";
    ctx.fill();
    ctx.strokeStyle = "#2a1408";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const tipU = bowLimbLocal(1, pull);
  const tipL = bowLimbLocal(-1, pull);
  const pU = bowWorld(view, nockX, nockDist, nockY, tipU.out, tipU.up, tipU.fwd, ux, uz);
  const pL = bowWorld(view, nockX, nockDist, nockY, tipL.out, tipL.up, tipL.fwd, ux, uz);
  const pN = bowWorld(view, nockX, nockDist, nockY, 0, 0, 0, ux, uz);
  ctx.strokeStyle = "rgba(200, 184, 140, 0.88)";
  ctx.lineWidth = Math.max(1.8, pN.s * 0.055);
  ctx.beginPath();
  ctx.moveTo(pU.x, pU.y);
  ctx.lineTo(pN.x, pN.y);
  ctx.lineTo(pL.x, pL.y);
  ctx.stroke();
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(pU.x - 1.5, pU.y - 1.5, 3, 3);
  ctx.fillRect(pL.x - 1.5, pL.y - 1.5, 3, 3);
  ctx.fillRect(pN.x - 2, pN.y - 2, 4, 4);
  ctx.restore();
}
