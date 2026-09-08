/**
 * First-person dungeon hall — vector pinhole, full canvas resolution.
 * Warm torchlit stone. No pixel buffer.
 */
import { CONFIG } from "../data/config.js?v=29";

const NEAR = 6;
const FAR = 640;
const OPEN_LEN = 200;
const TORCH_EVERY = 160;
const TILE_Z = CONFIG.CELL_SIZE || 40;

const PAL = {
  fog: "#100c08",
  stone: "#4a3c2e",
  stoneDeep: "#2a2118",
  stoneLite: "#6b5844",
  mortar: "rgba(18, 12, 8, 0.55)",
  moss: "#3d5a32",
  mossLite: "#5a7a42",
  gold: "#c9a227",
  wood: "#6b4424",
  woodDark: "#3a2414",
  rust: "#8a4a28",
  torch: "#ffb45a",
};

export class DungeonView {
  constructor() {
    this.cell = CONFIG.CELL_SIZE;
    this.half = (CONFIG.CORRIDOR_WIDTH * CONFIG.CELL_SIZE) / 2;
    this.eyeH = 30;
    this.ceilH = 78;
    this.playerZ = 0;
    this.time = 0;
    this.yaw = 0;
    this.bob = 0;
    this.sway = 0;
    this.roll = 0;
    this.junction = null;
    this.hits = [];
    this.ctx = null;
    this.cssW = 400;
    this.cssH = 720;
    this._setupProjection();
  }

  resize(cssW, cssH) {
    this.cssW = cssW;
    this.cssH = cssH;
    this._setupProjection();
  }

  _setupProjection() {
    const w = this.cssW;
    const h = this.cssH;
    this.cx = w * 0.5;
    const portrait = w / Math.max(1, h) < 0.85;
    this.cy = h * (portrait ? 0.40 : 0.42);
    const frameDist = 150;
    this.focal = Math.max(90, (w * 0.34) * frameDist / this.half);
  }

  /**
   * CSS-pixel pinhole. Same contract as CorridorCamera.project.
   */
  project(worldX, dist, worldY = 18) {
    const yaw = this.yaw || 0;
    const camX = worldX * Math.cos(yaw) - dist * Math.sin(yaw);
    const camZ = worldX * Math.sin(yaw) + dist * Math.cos(yaw);
    const d = Math.max(NEAR * 0.6, camZ);
    const s = this.focal / d;
    return {
      x: this.cx + this.sway + camX * s,
      y: this.cy + this.bob - (worldY - this.eyeH) * s,
      floorY: this.cy + this.bob + this.eyeH * s,
      ceilY: this.cy + this.bob + (this.eyeH - this.ceilH) * s,
      s,
      dist: d,
      behind: camZ < NEAR * 0.4,
      v: 1 - Math.min(1, d / FAR),
    };
  }

  _fogK(dist) {
    const t = Math.max(0, Math.min(1, (dist - 140) / (FAR - 140)));
    return t * t * 0.82;
  }

  _torchWarm(dist) {
    const z = this.playerZ + dist;
    const n = Math.round(z / TORCH_EVERY) * TORCH_EVERY;
    const d = Math.abs(z - n);
    const flicker = 0.7 + Math.sin(this.time * 6.8 + n * 0.02) * 0.2;
    return Math.max(0, 1 - d / 88) * flicker;
  }

  _hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  _wallPt(near, far, sign, u, t) {
    const nx = sign < 0 ? near.xl : near.xr;
    const fx = sign < 0 ? far.xl : far.xr;
    const yN = near.yc + (near.yf - near.yc) * t;
    const yF = far.yc + (far.yf - far.yc) * t;
    return [nx + (fx - nx) * u, yN + (yF - yN) * u];
  }

  _floorPt(near, far, u, v) {
    const xN = near.xl + (near.xr - near.xl) * u;
    const xF = far.xl + (far.xr - far.xl) * u;
    return [xN + (xF - xN) * v, near.yf + (far.yf - near.yf) * v];
  }

  _frame(dist) {
    const L = this.project(-this.half, dist, 0);
    const R = this.project(this.half, dist, 0);
    const TL = this.project(-this.half, dist, this.ceilH);
    return { xl: L.x, xr: R.x, yf: L.floorY, yc: TL.y, dist, s: L.s };
  }

  /** Near plane whose floor sits on or below the bottom of the screen. */
  _feetDist() {
    const room = Math.max(48, this.cssH - this.cy - 2);
    return Math.max(6.5, (this.eyeH * this.focal) / room * 0.9);
  }

  /**
   * Depth rings: a lens plane that fills the screen, then world-locked
   * tile planes so stone scrolls as the player walks.
   */
  _depthSlices() {
    const feet = this._feetDist();
    const startWz = Math.ceil((this.playerZ + feet + 1) / TILE_Z) * TILE_Z;
    const slices = [feet];
    for (let wz = startWz; wz < this.playerZ + FAR; wz += TILE_Z) {
      const d = wz - this.playerZ;
      if (d > feet + 0.5) slices.push(d);
    }
    return slices;
  }

  drawHall(ctx, playerZ, time, junction = null, motion = null) {
    this.ctx = ctx;
    this.playerZ = playerZ;
    this.time = time;
    const walking = !!(motion && motion.walking);
    const turning = !!(motion && motion.turning);
    const turnU = motion && motion.turnU ? motion.turnU : 0;
    this.bob = Math.sin(playerZ * 0.11) * (walking ? 4.4 : 1.1) + Math.sin(time * 1.35) * 0.55;
    this.sway = Math.sin(playerZ * 0.055) * (walking ? 2.4 : 0.4)
      + (turning ? Math.sin(turnU * Math.PI) * 5.5 * (motion.turnSign || 1) : 0);
    // Bank into the turn, peaking mid-corner, then settle.
    this.roll = turning
      ? Math.sin(turnU * Math.PI) * 0.085 * (motion.turnSign || 1)
      : 0;
    // Pull the fork closer as you walk into it so the opening fills the frame.
    let j = junction && junction.dist < FAR && junction.dist > 8 ? junction : null;
    if (j && turning) {
      const pull = 1 - Math.min(1, turnU * 1.15);
      j = { ...j, dist: Math.max(28, j.dist * pull), pending: false };
    }
    this.junction = j;
    this.hits = [];

    ctx.save();
    if (this.roll) {
      ctx.translate(this.cssW * 0.5, this.cssH * 0.5);
      ctx.rotate(this.roll);
      ctx.translate(-this.cssW * 0.5, -this.cssH * 0.5);
    }

    this._paintBackdrop(ctx);
    this._paintUnderfoot(ctx);
    this._paintSlices(ctx);
    this._paintRibs(ctx);
    this._paintTorchPools(ctx);
    this._paintEndDark(ctx);
    this._paintDecor(ctx);
    this._paintTorches(ctx);
    this._drawScreenCobwebs(ctx);
    this._paintVignette(ctx);
    if (this.junction) this._drawOpenings();

    ctx.restore();
  }

  _paintBackdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, "#241810");
    g.addColorStop(0.36, "#140e0a");
    g.addColorStop(0.42, "#1c140e");
    g.addColorStop(1, "#080604");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }

  _paintSlices(ctx) {
    const j = this.junction;
    const jDist = j ? j.dist : Infinity;
    const frames = this._depthSlices().map((d) => this._frame(d));

    for (let i = frames.length - 2; i >= 0; i--) {
      const near = frames[i];
      const far = frames[i + 1];
      const fog = this._fogK(near.dist);
      const warm = this._torchWarm(near.dist);
      const lit = 0.4 + 0.5 * (1 - near.dist / FAR) + warm * 0.18;
      const open = j && near.dist > jDist - 8 && far.dist < jDist + OPEN_LEN;
      near.worldZ = this.playerZ + near.dist;
      far.worldZ = this.playerZ + far.dist;

      this._fillQuad(ctx, [
        [near.xl, near.yf], [near.xr, near.yf], [far.xr, far.yf], [far.xl, far.yf],
      ], this._stoneFill(lit * 0.82, fog, true, warm * 0.55));
      this._strokeFlagstones(ctx, near, far, fog, warm);

      this._fillQuad(ctx, [
        [near.xl, near.yc], [near.xr, near.yc], [far.xr, far.yc], [far.xl, far.yc],
      ], this._stoneFill(lit * 0.48, fog, false, warm * 0.25));
      this._strokeBeams(ctx, near, far, fog, warm);

      if (!(open && j.left)) {
        this._paintWall(ctx, near, far, -1, lit, fog, warm);
        this._paintMoss(ctx, near, far, -1, fog);
      }
      if (!(open && j.right)) {
        this._paintWall(ctx, near, far, 1, lit, fog, warm);
        this._paintMoss(ctx, near, far, 1, fog);
      }
    }
  }

  /** Close the gap between the lens and the first stone ring — kills the void under the bow. */
  _paintUnderfoot(ctx) {
    const feet = this._frame(this._feetDist());
    const floorCol = this._stoneFill(1.02, 0, true);
    const wallL = this._stoneFill(0.92, 0, false);
    const wallR = this._stoneFill(1.08, 0, false);
    const bottom = this.cssH + 28;
    const left = -80;
    const right = this.cssW + 80;

    this._fillQuad(ctx, [
      [feet.xl, feet.yf], [feet.xr, feet.yf], [right, bottom], [left, bottom],
    ], floorCol);

    this._fillQuad(ctx, [
      [feet.xl, feet.yc], [feet.xl, feet.yf], [left, bottom], [left, -24],
    ], wallL);
    this._fillQuad(ctx, [
      [feet.xr, feet.yc], [right, -24], [right, bottom], [feet.xr, feet.yf],
    ], wallR);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(feet.xl, feet.yf);
    ctx.lineTo(feet.xr, feet.yf);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(16, 10, 6, 0.45)";
    ctx.lineWidth = 1.4;
    const lanes = 5;
    for (let k = 1; k < lanes; k++) {
      const t = k / lanes;
      const x0 = feet.xl + (feet.xr - feet.xl) * t;
      const x1 = left + (right - left) * t;
      ctx.beginPath();
      ctx.moveTo(x0, feet.yf);
      ctx.lineTo(x1, bottom);
      ctx.stroke();
    }
    const phase = ((this.playerZ % TILE_Z) + TILE_Z) % TILE_Z;
    for (let n = 0; n < 3; n++) {
      const next = TILE_Z - phase + n * TILE_Z * 0.35;
      if (next > 2 && next < 90) {
        const line = this._frame(Math.max(this._feetDist() + 0.5, next));
        ctx.beginPath();
        ctx.moveTo(line.xl, line.yf);
        ctx.lineTo(line.xr, line.yf);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _stoneFill(lit, fog, floor, warm = 0) {
    const k = 1 - fog;
    const r = (floor ? 108 : 92) * lit * k + 16 * fog + 52 * warm * k;
    const g = (floor ? 78 : 68) * lit * k + 12 * fog + 24 * warm * k;
    const b = (floor ? 48 : 42) * lit * k + 8 * fog + 6 * warm * k;
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  _woodFill(lit, fog) {
    const k = 1 - fog;
    const r = 92 * lit * k + 18 * fog;
    const g = 54 * lit * k + 12 * fog;
    const b = 28 * lit * k + 8 * fog;
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  _fillQuad(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  _paintWall(ctx, near, far, sign, lit, fog, warm = 0) {
    const nx = sign < 0 ? near.xl : near.xr;
    const fx = sign < 0 ? far.xl : far.xr;
    const sideLit = lit * (sign < 0 ? 0.86 : 1.1);
    this._fillQuad(ctx, [
      [nx, near.yc], [nx, near.yf], [fx, far.yf], [fx, far.yc],
    ], this._stoneFill(sideLit * 0.92, fog, false, warm * 0.7));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nx, near.yc);
    ctx.lineTo(nx, near.yf);
    ctx.lineTo(fx, far.yf);
    ctx.lineTo(fx, far.yc);
    ctx.closePath();
    ctx.clip();

    const span = Math.max(8, (far.dist || 0) - (near.dist || 0));
    const courses = 7;
    const bricks = span > TILE_Z * 0.85 ? 3 : 2;
    const tile = ((near.worldZ != null ? near.worldZ : this.playerZ + near.dist) / TILE_Z) | 0;

    for (let c = 0; c < courses; c++) {
      const t0 = c / courses;
      const t1 = (c + 1) / courses;
      const stagger = (c % 2) * 0.5;
      for (let v = -1; v < bricks; v++) {
        const u0 = Math.max(0, (v + stagger) / bricks);
        const u1 = Math.min(1, (v + 1 + stagger) / bricks);
        if (u1 - u0 < 0.04) continue;
        const jitter = (this._hash(c * 17 + v * 9 + tile * 23 + sign) - 0.5) * 0.03;
        const a = this._wallPt(near, far, sign, u0, t0 + jitter);
        const b = this._wallPt(near, far, sign, u1, t0 - jitter * 0.4);
        const d = this._wallPt(near, far, sign, u1, t1);
        const e = this._wallPt(near, far, sign, u0, t1);
        const shade = sideLit * (0.74 + this._hash(c * 17 + v * 9 + tile * 23 + sign) * 0.42);
        this._fillQuad(ctx, [a, b, d, e], this._stoneFill(shade, fog, false, warm * 0.65));

        ctx.strokeStyle = `rgba(210, 180, 130, ${0.14 * shade * (1 - fog)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1] + 1);
        ctx.lineTo(b[0], b[1] + 1);
        ctx.stroke();
        ctx.strokeStyle = `rgba(12, 8, 6, ${0.28 * (1 - fog)})`;
        ctx.beginPath();
        ctx.moveTo(e[0], e[1] - 1);
        ctx.lineTo(d[0], d[1] - 1);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = `rgba(18, 12, 8, ${0.55 * (1 - fog)})`;
    ctx.lineWidth = Math.max(0.9, 1.8 * (1 - fog));
    for (let c = 1; c < courses; c++) {
      const t = c / courses;
      const a = this._wallPt(near, far, sign, 0, t);
      const b = this._wallPt(near, far, sign, 1, t);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(230, 200, 150, ${0.16 * lit})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(nx, near.yc + 2);
    ctx.lineTo(nx, near.yf);
    ctx.stroke();
    ctx.restore();
  }

  _strokeFlagstones(ctx, near, far, fog, warm = 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(near.xl, near.yf);
    ctx.lineTo(near.xr, near.yf);
    ctx.lineTo(far.xr, far.yf);
    ctx.lineTo(far.xl, far.yf);
    ctx.closePath();
    ctx.clip();

    const tile = ((near.worldZ != null ? near.worldZ : this.playerZ + near.dist) / TILE_Z) | 0;
    const cols = 5;
    const stagger = (tile % 2) * (0.5 / cols);
    for (let c = -1; c < cols; c++) {
      const u0 = Math.max(0, c / cols + stagger);
      const u1 = Math.min(1, (c + 1) / cols + stagger);
      if (u1 - u0 < 0.04) continue;
      const a = this._floorPt(near, far, u0, 0);
      const b = this._floorPt(near, far, u1, 0);
      const d = this._floorPt(near, far, u1, 1);
      const e = this._floorPt(near, far, u0, 1);
      const shade = 0.58 + this._hash(c * 11 + tile * 19) * 0.44;
      this._fillQuad(ctx, [a, b, d, e], this._stoneFill(shade, fog, true, warm * 0.5));
      ctx.strokeStyle = `rgba(16, 10, 6, ${0.42 * (1 - fog)})`;
      ctx.lineWidth = Math.max(0.8, 1.4 * (1 - fog));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  _strokeBeams(ctx, near, far, fog, warm = 0) {
    const tile = ((near.worldZ != null ? near.worldZ : this.playerZ + near.dist) / TILE_Z) | 0;
    const dropN = Math.max(2.5, 7 * (near.s || 1) * 0.05);
    const dropF = Math.max(1.6, 5 * (far.s || 1) * 0.05);
    const wood = this._woodFill(0.78 + warm * 0.2, fog);

    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(near.xl, near.yc);
    ctx.lineTo(near.xl + 5 * (near.s || 1) * 0.06, near.yc + dropN);
    ctx.lineTo(far.xl + 4 * (far.s || 1) * 0.05, far.yc + dropF);
    ctx.lineTo(far.xl, far.yc);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(near.xr, near.yc);
    ctx.lineTo(near.xr - 5 * (near.s || 1) * 0.06, near.yc + dropN);
    ctx.lineTo(far.xr - 4 * (far.s || 1) * 0.05, far.yc + dropF);
    ctx.lineTo(far.xr, far.yc);
    ctx.closePath();
    ctx.fill();

    if (tile % 2 === 0) {
      const thickN = Math.max(4, 16 * (near.s || 1) * 0.08);
      const thickF = Math.max(2.5, 10 * (far.s || 1) * 0.07);
      this._fillQuad(ctx, [
        [near.xl, near.yc + dropN * 0.15],
        [near.xr, near.yc + dropN * 0.15],
        [far.xr, far.yc + dropF * 0.15 + thickF],
        [far.xl, far.yc + dropF * 0.15 + thickF],
      ], this._woodFill(0.7, fog));
      ctx.fillStyle = this._woodFill(0.48, fog);
      ctx.fillRect(near.xl, near.yc + dropN * 0.15, near.xr - near.xl, Math.max(1.5, thickN * 0.35));
    }
  }

  _paintMoss(ctx, near, far, sign, fog) {
    const nx = sign < 0 ? near.xl : near.xr;
    const fx = sign < 0 ? far.xl : far.xr;
    const h = this._hash(Math.floor((this.playerZ + near.dist) / 30) + sign * 9);
    if (h < 0.18) return;
    ctx.fillStyle = `rgba(62, 102, 48, ${0.62 * (1 - fog)})`;
    ctx.beginPath();
    const y0 = near.yf - 10 - h * 16;
    const y1 = far.yf - 6;
    ctx.moveTo(nx, near.yf);
    ctx.quadraticCurveTo(nx + sign * 14, y0, fx, y1);
    ctx.lineTo(fx, far.yf);
    ctx.lineTo(nx, near.yf);
    ctx.fill();
    if (h > 0.45) {
      ctx.fillStyle = `rgba(110, 150, 72, ${0.4 * (1 - fog)})`;
      ctx.beginPath();
      ctx.ellipse(nx + sign * 12, near.yf - 10, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintRibs(ctx) {
    const z0 = this.playerZ;
    for (let k = 0; k < 10; k++) {
      const worldZ = Math.floor(z0 / 128) * 128 + k * 128 + 64;
      const dist = worldZ - z0;
      if (dist < 36 || dist > 520) continue;
      const f = this._frame(dist);
      const fog = this._fogK(dist);
      const thick = Math.max(2.2, 11 * f.s * 0.07);
      ctx.strokeStyle = this._stoneFill(0.55, fog, false, 0.08);
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(f.xl, f.yf);
      ctx.lineTo(f.xl, f.yc + (f.yf - f.yc) * 0.38);
      ctx.quadraticCurveTo((f.xl + f.xr) / 2, f.yc - thick, f.xr, f.yc + (f.yf - f.yc) * 0.38);
      ctx.lineTo(f.xr, f.yf);
      ctx.stroke();
      ctx.strokeStyle = `rgba(210, 180, 130, ${0.1 * (1 - fog)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(f.xl + 2, f.yf);
      ctx.lineTo(f.xl + 2, f.yc + (f.yf - f.yc) * 0.38);
      ctx.quadraticCurveTo((f.xl + f.xr) / 2, f.yc - thick + 2, f.xr - 2, f.yc + (f.yf - f.yc) * 0.38);
      ctx.stroke();
    }
  }

  _paintEndDark(ctx) {
    if (this.junction && this.junction.forward) return;
    const d = this.junction ? Math.max(90, this.junction.dist + 10) : FAR * 0.78;
    const left = this.project(-this.half, d, 0);
    const right = this.project(this.half, d, 0);
    const topL = this.project(-this.half, d, this.ceilH);
    const topR = this.project(this.half, d, this.ceilH);
    const fog = this._fogK(d);
    this._fillQuad(ctx, [
      [topL.x, topL.y], [topR.x, topR.y], [right.x, right.floorY], [left.x, left.floorY],
    ], this._stoneFill(0.36, fog, false, 0.05));

    const mx = (left.x + right.x) / 2;
    const w = Math.max(18, right.x - left.x);
    const h = Math.max(16, left.floorY - topL.y);
    const aw = w * 0.52;
    const ah = h * 0.88;
    const baseY = left.floorY;
    const spring = baseY - ah * 0.46;
    const archTop = baseY - ah;

    ctx.fillStyle = `rgba(6, 4, 3, ${0.94 - fog * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(mx - aw / 2, baseY);
    ctx.lineTo(mx - aw / 2, spring);
    ctx.quadraticCurveTo(mx, archTop - 3, mx + aw / 2, spring);
    ctx.lineTo(mx + aw / 2, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = this._stoneFill(0.78, fog, false, 0.16);
    ctx.lineWidth = Math.max(4, w * 0.07);
    ctx.beginPath();
    ctx.moveTo(mx - aw / 2, baseY);
    ctx.lineTo(mx - aw / 2, spring);
    ctx.quadraticCurveTo(mx, archTop - 3, mx + aw / 2, spring);
    ctx.lineTo(mx + aw / 2, baseY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(28, 18, 10, ${0.5 * (1 - fog)})`;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const a = Math.PI + t * Math.PI;
      const x0 = mx + Math.cos(a) * (aw * 0.5);
      const y0 = spring + Math.sin(a) * (ah * 0.5);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(mx + Math.cos(a) * (aw * 0.58), y0 - 5);
      ctx.stroke();
    }
  }

  _paintTorchPools(ctx) {
    ctx.save();
    for (let i = 1; i <= 8; i++) {
      const z = i * TORCH_EVERY - (this.playerZ % TORCH_EVERY);
      if (z < 24 || z > FAR - 60) continue;
      const flicker = 0.7 + Math.sin(this.time * 6.2 + i * 1.7) * 0.18;
      for (const side of [-1, 1]) {
        const p = this.project(side * (this.half * 0.72), z, 0);
        if (p.behind) continue;
        const r = Math.max(10, 46 * p.s);
        const g = ctx.createRadialGradient(p.x, p.floorY, 0, p.x, p.floorY, r);
        g.addColorStop(0, `rgba(255, 150, 50, ${0.2 * flicker})`);
        g.addColorStop(0.45, `rgba(200, 90, 30, ${0.08 * flicker})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.floorY, r, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _paintVignette(ctx) {
    const g = ctx.createRadialGradient(this.cx, this.cy, this.cssW * 0.18, this.cx, this.cy, this.cssH * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.65, "rgba(8, 5, 3, 0.08)");
    g.addColorStop(1, "rgba(6, 4, 2, 0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }

  _paintDecor(ctx) {
    const z0 = this.playerZ;
    for (let k = 0; k < 14; k++) {
      const worldZ = Math.floor(z0 / 58) * 58 + k * 58 + 28;
      const dist = worldZ - z0;
      if (dist < 28 || dist > 400) continue;
      const h = this._hash(Math.floor(worldZ / 11));
      const side = h > 0.5 ? 1 : -1;
      const kind = (h * 11) | 0;
      if (kind % 4 === 0) this._drawBarrel(ctx, side, dist, h);
      else if (kind % 4 === 1) this._drawCrate(ctx, side, dist, h);
      else if (kind % 4 === 2) this._drawUrn(ctx, side, dist);
    }
    for (let k = 0; k < 8; k++) {
      const worldZ = Math.floor(z0 / 140) * 140 + k * 140 + 50;
      const dist = worldZ - z0;
      if (dist < 40 || dist > 320) continue;
      const h = this._hash(Math.floor(worldZ / 19) + 3);
      this._drawCobweb(ctx, h > 0.5 ? 1 : -1, dist, h);
    }
    this._drawChains(ctx);
  }

  _drawBarrel(ctx, side, dist, h) {
    const p = this.project(side * (this.half - 18), dist, 0);
    if (p.behind) return;
    const s = p.s;
    const w = 11 * s;
    const ht = 16 * s;
    const x = p.x;
    const y = p.floorY;
    ctx.save();
    ctx.globalAlpha = 1 - this._fogK(dist) * 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.7, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = h > 0.7 ? "#5a3a1c" : "#6b4424";
    ctx.beginPath();
    ctx.ellipse(x, y - ht, w, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - w, y - ht, w * 2, ht);
    ctx.fillStyle = "#4a2e14";
    ctx.beginPath();
    ctx.ellipse(x, y, w, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = Math.max(1, 1.4 * s * 0.08);
    for (const t of [0.28, 0.68]) {
      ctx.beginPath();
      ctx.ellipse(x, y - ht * t, w, 3.2 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCrate(ctx, side, dist, h) {
    const p = this.project(side * (this.half - 20), dist, 0);
    if (p.behind) return;
    const s = p.s;
    const w = 14 * s;
    const ht = 12 * s;
    const x = p.x - w * 0.5;
    const y = p.floorY - ht;
    ctx.save();
    ctx.globalAlpha = 1 - this._fogK(dist) * 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 2, p.floorY - 2, w, 3);
    ctx.fillStyle = h > 0.6 ? "#7a5330" : "#8a5a32";
    ctx.fillRect(x, y, w, ht);
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = Math.max(1, 1.2 * s * 0.08);
    ctx.strokeRect(x, y, w, ht);
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(x + w - 2, y + ht - 2);
    ctx.moveTo(x + w - 2, y + 2);
    ctx.lineTo(x + 2, y + ht - 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawUrn(ctx, side, dist) {
    const p = this.project(side * (this.half - 16), dist, 0);
    if (p.behind) return;
    const s = p.s;
    ctx.save();
    ctx.globalAlpha = 1 - this._fogK(dist) * 0.7;
    ctx.fillStyle = "#4a3a30";
    ctx.beginPath();
    ctx.ellipse(p.x, p.floorY - 10 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2a20";
    ctx.beginPath();
    ctx.ellipse(p.x, p.floorY - 16 * s, 3.2 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawScreenCobwebs(ctx) {
    this._webCorner(ctx, 4, 6, 1, 70);
    this._webCorner(ctx, this.cssW - 4, 10, -1, 78);
  }

  _webCorner(ctx, ox, oy, side, s) {
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = "#d8d0c0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = (side < 0 ? Math.PI - 0.08 : 0.08) + i * 0.2 * side;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * s, oy + Math.sin(a) * s * 0.9);
      ctx.stroke();
    }
    for (let r = 0.22; r < 1; r += 0.18) {
      ctx.beginPath();
      const a0 = side < 0 ? Math.PI - 0.05 : 0.05;
      ctx.arc(ox, oy, s * r, a0, a0 + 0.85 * side, side > 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCobweb(ctx, side, dist, h) {
    const corner = this.project(side * (this.half - 4), dist, this.ceilH - 4);
    if (corner.behind) return;
    const s = Math.max(8, 28 * corner.s);
    ctx.save();
    ctx.globalAlpha = 0.4 * (1 - this._fogK(dist));
    ctx.strokeStyle = "#d8d0c0";
    ctx.lineWidth = 0.9;
    const ox = corner.x;
    const oy = corner.y;
    for (let i = 0; i < 4; i++) {
      const a = (side < 0 ? 0.15 : Math.PI - 0.15) + i * 0.22 * side;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * s, oy + Math.sin(a) * s * 0.85);
      ctx.stroke();
    }
    for (let r = 0.28; r < 1; r += 0.22) {
      ctx.beginPath();
      const a0 = side < 0 ? 0.12 : Math.PI - 0.12;
      ctx.arc(ox, oy, s * r, a0, a0 + 0.7 * side, side > 0);
      ctx.stroke();
    }
    if (h > 0.8) {
      ctx.fillStyle = "rgba(20,16,12,0.55)";
      ctx.beginPath();
      ctx.arc(ox + side * s * 0.45, oy + s * 0.4, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawChains(ctx) {
    for (let k = 0; k < 5; k++) {
      const worldZ = Math.floor(this.playerZ / 200) * 200 + k * 200 + 90;
      const dist = worldZ - this.playerZ;
      if (dist < 50 || dist > 280) continue;
      const side = this._hash(k + 4) > 0.5 ? 1 : -1;
      const top = this.project(side * this.half * 0.35, dist, this.ceilH - 2);
      const s = top.s;
      ctx.save();
      ctx.globalAlpha = 0.45 * (1 - this._fogK(dist));
      ctx.strokeStyle = "#3a3228";
      ctx.lineWidth = Math.max(1, 1.6 * s * 0.06);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + side * 3, top.y + 38 * s);
      ctx.stroke();
      ctx.restore();
    }
  }

  _paintTorches(ctx) {
    for (let i = 1; i <= 8; i++) {
      const z = i * TORCH_EVERY - (this.playerZ % TORCH_EVERY);
      if (z < 36 || z > FAR - 50) continue;
      for (const side of [-1, 1]) {
        const p = this.project(side * (this.half - 6), z, 36);
        if (p.behind) continue;
        const r = Math.max(6, 22 * p.s);
        const flicker = 0.7 + Math.sin(this.time * 6.2 + i * 1.7 + side) * 0.18;
        ctx.save();
        ctx.fillStyle = "#2a2218";
        ctx.fillRect(p.x - 2 * p.s, p.y + 4 * p.s, 4 * p.s, 10 * p.s);
        ctx.strokeStyle = "#c9a227";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - 2.2 * p.s, p.y + 3.5 * p.s, 4.4 * p.s, 3 * p.s);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
        g.addColorStop(0, `rgba(255, 220, 140, ${0.55 * flicker})`);
        g.addColorStop(0.35, `rgba(230, 120, 40, ${0.22 * flicker})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 236, 180, ${0.92 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 7 * p.s);
        ctx.quadraticCurveTo(p.x + 4 * p.s, p.y, p.x, p.y + 6 * p.s);
        ctx.quadraticCurveTo(p.x - 4 * p.s, p.y, p.x, p.y - 7 * p.s);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  hitTest(cssX, cssY) {
    if (!this.hits.length) return null;
    let best = null;
    let bestArea = Infinity;
    for (const h of this.hits) {
      const pad = 12;
      if (cssX >= h.x - pad && cssX <= h.x + h.w + pad && cssY >= h.y - pad && cssY <= h.y + h.h + pad) {
        const area = h.w * h.h;
        if (area < bestArea) {
          bestArea = area;
          best = h.dir;
        }
      }
    }
    return best;
  }

  _screenPortal(dir) {
    const w = this.cssW;
    const h = this.cssH;
    if (dir === "left") return { x: 0, y: 0, w: w * 0.34, h: h };
    if (dir === "right") return { x: w * 0.66, y: 0, w: w * 0.34, h: h };
    return { x: w * 0.34, y: 0, w: w * 0.32, h: h };
  }

  _drawOpenings() {
    const j = this.junction;
    if (!j.pending) return;
    for (const dir of ["left", "right", "forward"]) {
      if (!j[dir]) continue;
      const r = this._screenPortal(dir);
      const choice = (j.choices || []).find((c) => c.direction === dir);
      this.hits.push({
        dir, ...r,
        names: this._prettyNames(choice),
        families: choice && choice.families ? choice.families.slice(0, 3) : [],
      });
    }
  }

  _prettyNames(choice) {
    if (!choice || !choice.enemyTypes || !choice.enemyTypes.length) return "";
    return choice.enemyTypes.slice(0, 2).map((t) =>
      t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    ).join(" · ");
  }

  drawEnemy(e) {
    const dist = e.dist;
    if (dist < 12 || dist > FAR) return;
    const flying = !!(e.flying || e.behavior === "hover");
    const type = e.type || "";
    const sz = e.size || 1;
    let worldH;
    let worldY = 0;
    if (flying) {
      worldH = 11 + sz * 5;
      worldY = 20 + Math.sin(this.time * 5.4 + e.id) * 2.4;
    } else if (type.includes("slime")) {
      worldH = 11 + sz * 8;
    } else if (type.includes("spider")) {
      worldH = 9 + sz * 6;
    } else if (type.includes("boss")) {
      worldH = 34 + sz * 5;
    } else {
      worldH = 20 + sz * 8;
    }
    const p = this.project(e.x, dist, flying ? worldY : 0);
    if (p.behind) return;
    const squash = e._squash > 0 ? 1 - e._squash * 0.24 : 1;
    const stretch = e._squash > 0 ? 1 + e._squash * 0.2 : 1;
    const h = Math.max(10, worldH * p.s) * squash;
    const slime = type.includes("slime");
    const w = Math.max(8, h * (flying ? 1.15 : slime ? 1.35 : 0.58)) * stretch;
    const x = p.x;
    const foot = flying ? p.y + h * 0.38 : p.floorY;
    const top = foot - h;
    const ctx = this.ctx;
    const fog = this._fogK(dist);

    ctx.save();
    ctx.globalAlpha = 1 - fog * 0.72;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, p.floorY - 1, w * (flying ? 0.22 : 0.42), Math.max(1.4, h * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();
    if (e._hitFlash > 0) {
      ctx.shadowColor = "rgba(255, 230, 190, 0.85)";
      ctx.shadowBlur = 10;
    }
    this._paintFigure(ctx, e, x, top, w, h, foot, flying);
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

  _tint(col, flash) {
    if (!flash) return col;
    const m = /^#?([0-9a-f]{6})$/i.exec(col || "");
    if (!m) return "#d8c8b0";
    const n = parseInt(m[1], 16);
    const r = Math.min(255, ((n >> 16) & 255) + 90);
    const g = Math.min(255, ((n >> 8) & 255) + 80);
    const b = Math.min(255, (n & 255) + 70);
    return `rgb(${r},${g},${b})`;
  }

  _paintFigure(ctx, e, x, top, w, h, foot, flying) {
    const mid = top + h * 0.4;
    const col = this._tint(e.color || "#8a4a4a", e._hitFlash > 0);
    const type = e.type || "";
    ctx.fillStyle = col;

    if (flying || e.behavior === "hover") {
      const flap = Math.sin(this.time * 14 + e.id) * 0.18;
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
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x - 2, top + h * 0.42, 1.6, 2);
      ctx.fillRect(x + 0.6, top + h * 0.42, 1.6, 2);
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
      ctx.fillStyle = "rgba(40, 12, 16, 0.28)";
      ctx.beginPath();
      ctx.ellipse(x, foot - ry * 0.45, rx * 0.72, ry * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.24)";
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.28, foot - ry * 1.35, rx * 0.22, ry * 0.28, -0.4, 0, Math.PI * 2);
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
      ctx.beginPath();
      ctx.ellipse(x, foot - h * 0.48, w * 0.22, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.2, w * 0.08);
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) * 0.22;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.18, foot - h * 0.32);
        ctx.quadraticCurveTo(x - w * 0.55, foot - h * (0.55 + t * 0.2), x - w * 0.62, foot);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w * 0.18, foot - h * 0.32);
        ctx.quadraticCurveTo(x + w * 0.55, foot - h * (0.55 + t * 0.2), x + w * 0.62, foot);
        ctx.stroke();
      }
      return;
    }

    if (type.includes("skeleton")) {
      ctx.fillStyle = "#d4ccc0";
      ctx.fillRect(x - w * 0.1, mid, w * 0.2, h * 0.36);
      ctx.fillRect(x - w * 0.28, mid + 3, w * 0.56, 2.4);
      ctx.fillRect(x - w * 0.28, mid + 8, w * 0.56, 2.4);
      ctx.fillRect(x - w * 0.12, top + h * 0.72, w * 0.1, h * 0.28);
      ctx.fillRect(x + w * 0.02, top + h * 0.72, w * 0.1, h * 0.28);
      ctx.beginPath();
      ctx.ellipse(x, top + h * 0.2, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - w * 0.1, top + h * 0.16, 3, 3.4);
      ctx.fillRect(x + w * 0.02, top + h * 0.16, 3, 3.4);
      return;
    }

    ctx.fillRect(x - w * 0.2, mid, w * 0.4, h * 0.38);
    ctx.fillRect(x - w * 0.16, top + h * 0.72, w * 0.13, h * 0.28);
    ctx.fillRect(x + w * 0.03, top + h * 0.72, w * 0.13, h * 0.28);
    ctx.fillRect(x - w * 0.38, mid + 4, w * 0.18, h * 0.08);
    ctx.fillRect(x + w * 0.2, mid + 4, w * 0.18, h * 0.08);
    const head = h * 0.24;
    ctx.beginPath();
    ctx.ellipse(x, top + head * 0.78, w * 0.22, head * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    if (type.includes("goblin") || type.includes("orc") || type.includes("troll")) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.22, top + head * 0.7);
      ctx.lineTo(x - w * 0.38, top + head * 0.35);
      ctx.lineTo(x - w * 0.16, top + head * 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.22, top + head * 0.7);
      ctx.lineTo(x + w * 0.38, top + head * 0.35);
      ctx.lineTo(x + w * 0.16, top + head * 0.55);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x - w * 0.1, top + head * 0.62, 2.6, 2.6);
    ctx.fillRect(x + w * 0.04, top + head * 0.62, 2.6, 2.6);
    if (e.armor === "heavy") {
      ctx.strokeStyle = "rgba(200,190,160,0.4)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x - w * 0.22, mid, w * 0.44, h * 0.26);
    }
  }

  drawProjectile(p, enemy = false) {
    const dist = p.dist;
    if (dist == null || dist < -6 || dist > FAR) return;
    const ctx = this.ctx;
    const py = 12;
    if (enemy) {
      const sp = this.project(p.x, dist, py);
      const r = Math.max(2.2, 3.2 * sp.s);
      ctx.fillStyle = "#c45a4a";
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 180, 120, 0.55)";
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const tip = this.project(p.x, dist, py);
    const tail = this.project(p.x, dist + 16, py);
    ctx.save();
    ctx.strokeStyle = "#e8d8b0";
    ctx.lineWidth = Math.max(1.6, 2.4 * tip.s * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = "#c9a227";
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x + 3.2, tip.y + 7);
    ctx.lineTo(tip.x - 3.2, tip.y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a4a28";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tail.x - 3, tail.y);
    ctx.lineTo(tail.x, tail.y + 1);
    ctx.lineTo(tail.x + 3, tail.y);
    ctx.stroke();
    const trail = p._trail || [];
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const td = t.dist != null ? t.dist : t.worldZ - this.playerZ;
      if (td < 8) continue;
      const tp = this.project(t.x, td, py);
      ctx.globalAlpha = ((i + 1) / trail.length) * 0.28;
      ctx.fillStyle = "#e8d8b0";
      ctx.fillRect(tp.x, tp.y, 2, 2);
    }
    ctx.restore();
  }

  drawOverlay(ctx, input) {
    this._drawPathOverlay(ctx);
    this._drawBowOverlay(ctx, input);
  }

  _drawPathOverlay(ctx) {
    if (!this.hits.length) return;
    const titleSize = Math.max(22, Math.round(this.cssW / 26));
    const labelSize = Math.max(16, Math.round(this.cssW / 36));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.junction && this.junction.pending) {
      ctx.font = `700 ${titleSize}px "Cinzel", "Chakra Petch", serif`;
      ctx.letterSpacing = "0.16em";
      const titleY = Math.max(64, this.cssH * 0.075);
      this._strokeFill(ctx, "CHOOSE PATH", this.cssW / 2, titleY, "#e8c56a");
    }

    // While HTML path-choice is up, only draw chevrons — icons/names live on the buttons.
    const pending = !!(this.junction && this.junction.pending);
    for (const h of this.hits) {
      const cx = h.x + h.w / 2;
      const cy = h.y + h.h * 0.4;
      this._drawChevron(ctx, cx, cy - 28, h.dir, pending);
      if (pending) continue;
      if (h.families && h.families.length) {
        const n = h.families.length;
        const gap = 34;
        const start = cx - ((n - 1) * gap) / 2;
        h.families.forEach((fam, i) => this._drawFamilyIcon(ctx, fam, start + i * gap, cy + 6, 26));
      }
      if (h.names) {
        ctx.font = `600 ${labelSize}px "Chakra Petch", sans-serif`;
        ctx.letterSpacing = "0.03em";
        const tw = ctx.measureText(h.names).width;
        ctx.fillStyle = "rgba(8, 6, 4, 0.58)";
        ctx.fillRect(cx - tw / 2 - 10, cy + 28, tw + 20, labelSize + 10);
        this._strokeFill(ctx, h.names, cx, cy + 36 + labelSize * 0.15, "rgba(230, 214, 186, 0.88)");
      }
    }
    ctx.restore();
  }

  _strokeFill(ctx, text, x, y, fill) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(8, 6, 4, 0.78)";
    ctx.fillStyle = fill;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  _drawFamilyIcon(ctx, family, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    const s = size / 28;
    ctx.scale(s, s);
    ctx.translate(-14, -14);
    if (family === "slime") {
      ctx.fillStyle = "#b84a55";
      ctx.beginPath(); ctx.ellipse(14, 17, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c45a65";
      ctx.beginPath(); ctx.arc(14, 14, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0808";
      ctx.beginPath(); ctx.arc(11, 13, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(17, 13, 1.4, 0, Math.PI * 2); ctx.fill();
    } else if (family === "goblin") {
      ctx.fillStyle = "#4a7a3a";
      ctx.beginPath(); ctx.moveTo(6, 12); ctx.lineTo(10, 6); ctx.lineTo(12, 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22, 12); ctx.lineTo(18, 6); ctx.lineTo(16, 12); ctx.fill();
      ctx.fillStyle = "#6aaa5a";
      ctx.beginPath(); ctx.arc(14, 16, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0808";
      ctx.beginPath(); ctx.arc(11.5, 15, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16.5, 15, 1.3, 0, Math.PI * 2); ctx.fill();
    } else if (family === "skeleton" || family === "undead") {
      ctx.fillStyle = family === "undead" ? "#6a5a4a" : "#c8c0b0";
      ctx.beginPath(); ctx.arc(14, 13, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a1010";
      ctx.beginPath(); ctx.arc(11.2, 12, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16.8, 12, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (family === "spider") {
      ctx.strokeStyle = "#5a4a3a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(10, 12); ctx.lineTo(3, 7);
      ctx.moveTo(10, 14); ctx.lineTo(2, 14);
      ctx.moveTo(10, 16); ctx.lineTo(3, 21);
      ctx.moveTo(18, 12); ctx.lineTo(25, 7);
      ctx.moveTo(18, 14); ctx.lineTo(26, 14);
      ctx.moveTo(18, 16); ctx.lineTo(25, 21);
      ctx.stroke();
      ctx.fillStyle = "#5a4a3a";
      ctx.beginPath(); ctx.arc(14, 14, 4.2, 0, Math.PI * 2); ctx.fill();
    } else if (family === "bat") {
      ctx.fillStyle = "#4a3a5a";
      ctx.beginPath();
      ctx.moveTo(4, 16); ctx.quadraticCurveTo(8, 6, 14, 14);
      ctx.quadraticCurveTo(20, 6, 24, 16);
      ctx.quadraticCurveTo(18, 12, 14, 18);
      ctx.quadraticCurveTo(10, 12, 4, 16);
      ctx.fill();
    } else if (family === "demon") {
      ctx.fillStyle = "#8a2018";
      ctx.beginPath(); ctx.moveTo(7, 12); ctx.lineTo(9, 4); ctx.lineTo(13, 11); ctx.fill();
      ctx.beginPath(); ctx.moveTo(21, 12); ctx.lineTo(19, 4); ctx.lineTo(15, 11); ctx.fill();
      ctx.fillStyle = "#c04040";
      ctx.beginPath(); ctx.arc(14, 16, 7, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = family === "brute" ? "#5a7a4a" : "#8a7040";
      ctx.beginPath(); ctx.arc(14, 15, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0808";
      ctx.beginPath(); ctx.arc(11.5, 14, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16.5, 14, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawChevron(ctx, x, y, dir, ready) {
    const s = ready ? 12 : 8;
    ctx.beginPath();
    if (dir === "forward") {
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.7, y + s * 0.55);
      ctx.lineTo(x, y + s * 0.18);
      ctx.lineTo(x - s * 0.7, y + s * 0.55);
    } else if (dir === "left") {
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s * 0.45, y - s * 0.7);
      ctx.lineTo(x + s * 0.1, y);
      ctx.lineTo(x + s * 0.45, y + s * 0.7);
    } else {
      ctx.moveTo(x + s, y);
      ctx.lineTo(x - s * 0.45, y - s * 0.7);
      ctx.lineTo(x - s * 0.1, y);
      ctx.lineTo(x - s * 0.45, y + s * 0.7);
    }
    ctx.closePath();
    ctx.fillStyle = ready ? "#e8c56a" : "rgba(200, 170, 100, 0.55)";
    ctx.strokeStyle = "rgba(8, 6, 4, 0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fill();
  }

  _drawBowOverlay(ctx, input) {
    if (this.junction && this.junction.pending) return;
    const w = this.cssW;
    const h = this.cssH;
    const portrait = w / Math.max(1, h) < 0.85;
    const x = w * 0.5;
    const y = h * (portrait ? 0.81 : 0.76);
    const half = w * (portrait ? 0.46 : 0.48);
    const lift = Math.max(64, h * (portrait ? 0.11 : 0.145));
    const thick = Math.max(18, w * 0.028);
    const pulling = input && input.isDragging && input.power > 2;
    const pull = pulling ? Math.min(48, input.power * 1.5) : 0;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.fillStyle = "rgba(8, 6, 4, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + 30, half * 0.55, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const limb = ctx.createLinearGradient(x - half, y, x + half, y);
    limb.addColorStop(0, "#5a3414");
    limb.addColorStop(0.45, "#8a5a28");
    limb.addColorStop(0.5, "#c4a060");
    limb.addColorStop(0.55, "#8a5a28");
    limb.addColorStop(1, "#5a3414");

    ctx.beginPath();
    ctx.moveTo(x - half, y + 26);
    ctx.quadraticCurveTo(x - half * 0.56, y - lift, x, y - lift - 12);
    ctx.quadraticCurveTo(x + half * 0.56, y - lift, x + half, y + 26);
    ctx.lineTo(x + half - 10, y + 34);
    ctx.quadraticCurveTo(x + half * 0.56, y - lift + thick, x, y - lift - 12 + thick);
    ctx.quadraticCurveTo(x - half * 0.56, y - lift + thick, x - half + 10, y + 34);
    ctx.closePath();
    ctx.fillStyle = limb;
    ctx.fill();
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - half + 14, y + 18);
    ctx.quadraticCurveTo(x - half * 0.5, y - lift + 10, x, y - lift);
    ctx.quadraticCurveTo(x + half * 0.5, y - lift + 10, x + half - 14, y + 18);
    ctx.strokeStyle = "#d4a86a";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = "#4a2a12";
    ctx.fillRect(x - 13, y - 18, 26, 50);
    ctx.fillStyle = "#2e1a0c";
    ctx.fillRect(x - 8, y - 6, 16, 28);
    ctx.strokeStyle = "rgba(201, 162, 39, 0.45)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 2 + i * 5);
      ctx.lineTo(x + 8, y - 2 + i * 5);
      ctx.stroke();
    }

    ctx.strokeStyle = "#f2e6c8";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x - half + 8, y + 24);
    ctx.lineTo(x, y + 14 + pull);
    ctx.lineTo(x + half - 8, y + 24);
    ctx.stroke();

    ctx.strokeStyle = "#e8d8b0";
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(x, y - lift - 36);
    ctx.lineTo(x, y + 14 + pull);
    ctx.stroke();
    ctx.fillStyle = "#c9a227";
    ctx.beginPath();
    ctx.moveTo(x, y - lift - 52);
    ctx.lineTo(x + 9, y - lift - 24);
    ctx.lineTo(x - 9, y - lift - 24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
