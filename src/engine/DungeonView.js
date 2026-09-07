/**
 * First-person dungeon hall — vector pinhole, full canvas resolution.
 * Warm torchlit stone. No pixel buffer.
 */
import { CONFIG } from "../data/config.js";

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
    const t = Math.max(0, Math.min(1, (dist - 160) / (FAR - 160)));
    return t * t * 0.78;
  }

  _hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
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
    this.bob = Math.sin(playerZ * 0.11) * (walking ? 4.4 : 1.1) + Math.sin(time * 1.35) * 0.55;
    this.sway = Math.sin(playerZ * 0.055) * (walking ? 2.4 : 0.4);
    this.roll = motion && motion.turning
      ? Math.sin((motion.turnU || 0) * Math.PI) * 0.048 * (motion.turnSign || 1)
      : 0;
    this.junction = junction && junction.dist < FAR && junction.dist > 8 ? junction : null;
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
    this._paintEndDark(ctx);
    this._paintDecor(ctx);
    this._paintTorches(ctx);
    this._drawScreenCobwebs(ctx);
    if (this.junction) this._drawOpenings();

    ctx.restore();
  }

  _paintBackdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, "#1a1410");
    g.addColorStop(0.38, "#120e0a");
    g.addColorStop(0.42, "#1c1610");
    g.addColorStop(1, "#0a0806");
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
      const lit = 0.42 + 0.48 * (1 - near.dist / FAR);
      const open = j && near.dist > jDist - 8 && far.dist < jDist + OPEN_LEN;
      near.worldZ = this.playerZ + near.dist;
      far.worldZ = this.playerZ + far.dist;

      this._fillQuad(ctx, [
        [near.xl, near.yf], [near.xr, near.yf], [far.xr, far.yf], [far.xl, far.yf],
      ], this._stoneFill(lit * 0.78, fog, true));
      this._strokeFlagstones(ctx, near, far, fog);

      this._fillQuad(ctx, [
        [near.xl, near.yc], [near.xr, near.yc], [far.xr, far.yc], [far.xl, far.yc],
      ], this._stoneFill(lit * 0.55, fog, false));
      this._strokeBeams(ctx, near, far, fog);

      if (!(open && j.left)) {
        this._paintWall(ctx, near, far, -1, lit, fog);
        this._paintMoss(ctx, near, far, -1, fog);
      }
      if (!(open && j.right)) {
        this._paintWall(ctx, near, far, 1, lit, fog);
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
    ctx.strokeStyle = "rgba(18, 12, 8, 0.32)";
    ctx.lineWidth = 1.2;
    const lanes = 4;
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
    const next = TILE_Z - phase;
    if (next > 2 && next < 70) {
      const line = this._frame(Math.max(this._feetDist() + 0.5, next));
      ctx.beginPath();
      ctx.moveTo(line.xl, line.yf);
      ctx.lineTo(line.xr, line.yf);
      ctx.stroke();
    }
    ctx.restore();
  }

  _stoneFill(lit, fog, floor) {
    const r = (floor ? 96 : 86) * lit * (1 - fog) + 22 * fog;
    const g = (floor ? 74 : 66) * lit * (1 - fog) + 16 * fog;
    const b = (floor ? 50 : 44) * lit * (1 - fog) + 12 * fog;
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

  _paintWall(ctx, near, far, sign, lit, fog) {
    const nx = sign < 0 ? near.xl : near.xr;
    const fx = sign < 0 ? far.xl : far.xr;
    const sideLit = lit * (sign < 0 ? 0.88 : 1.08);
    this._fillQuad(ctx, [
      [nx, near.yc], [nx, near.yf], [fx, far.yf], [fx, far.yc],
    ], this._stoneFill(sideLit, fog, false));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nx, near.yc);
    ctx.lineTo(nx, near.yf);
    ctx.lineTo(fx, far.yf);
    ctx.lineTo(fx, far.yc);
    ctx.closePath();
    ctx.clip();

    const span = Math.max(8, (far.dist || 0) - (near.dist || 0));
    const courses = 5;
    const verts = span > TILE_Z * 0.7 ? 2 : 1;
    for (let c = 0; c < courses; c++) {
      const t0 = c / courses;
      const t1 = (c + 1) / courses;
      for (let v = 0; v < verts; v++) {
        const u0 = v / verts;
        const u1 = (v + 1) / verts;
        const yN0 = near.yc + (near.yf - near.yc) * t0;
        const yN1 = near.yc + (near.yf - near.yc) * t1;
        const yF0 = far.yc + (far.yf - far.yc) * t0;
        const yF1 = far.yc + (far.yf - far.yc) * t1;
        const x0 = nx + (fx - nx) * u0;
        const x1 = nx + (fx - nx) * u1;
        const y00 = yN0 + (yF0 - yN0) * u0;
        const y10 = yN0 + (yF0 - yN0) * u1;
        const y01 = yN1 + (yF1 - yN1) * u0;
        const y11 = yN1 + (yF1 - yN1) * u1;
        const tile = ((near.worldZ != null ? near.worldZ : this.playerZ + near.dist) / TILE_Z) | 0;
        const shade = sideLit * (0.86 + this._hash(c * 13 + v * 7 + tile * 17) * 0.28);
        this._fillQuad(ctx, [[x0, y00], [x1, y10], [x1, y11], [x0, y01]], this._stoneFill(shade, fog, false));
        if (this._hash(c * 3 + v * 11 + sign) > 0.82) {
          ctx.strokeStyle = `rgba(30, 20, 12, ${0.35 * (1 - fog)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0 + 3, y00 + 4);
          ctx.lineTo(x1 - 3, y11 - 4);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = PAL.mortar;
    ctx.lineWidth = Math.max(0.8, 1.6 * (1 - fog));
    for (let c = 1; c < courses; c++) {
      const t = c / courses;
      ctx.beginPath();
      ctx.moveTo(nx, near.yc + (near.yf - near.yc) * t);
      ctx.lineTo(fx, far.yc + (far.yf - far.yc) * t);
      ctx.stroke();
    }
    for (let v = 1; v < verts; v++) {
      const t = v / verts;
      const x = nx + (fx - nx) * t;
      ctx.beginPath();
      ctx.moveTo(x, near.yc + (far.yc - near.yc) * t);
      ctx.lineTo(x, near.yf + (far.yf - near.yf) * t);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(220, 190, 140, ${0.12 * lit})`;
    ctx.beginPath();
    ctx.moveTo(nx, near.yc + 2);
    ctx.lineTo(nx, near.yf);
    ctx.stroke();
    ctx.restore();
  }

  _strokeFlagstones(ctx, near, far, fog) {
    ctx.strokeStyle = `rgba(18, 12, 8, ${0.28 * (1 - fog)})`;
    ctx.lineWidth = 1;
    const midX0 = (near.xl + near.xr) / 2;
    const midX1 = (far.xl + far.xr) / 2;
    ctx.beginPath();
    ctx.moveTo(midX0, near.yf);
    ctx.lineTo(midX1, far.yf);
    ctx.stroke();
    for (let k = 1; k < 3; k++) {
      const t = k / 3;
      const x0 = near.xl + (near.xr - near.xl) * t;
      const x1 = far.xl + (far.xr - far.xl) * t;
      ctx.beginPath();
      ctx.moveTo(x0, near.yf);
      ctx.lineTo(x1, far.yf);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(near.xl, near.yf);
    ctx.lineTo(near.xr, near.yf);
    ctx.stroke();
  }

  _strokeBeams(ctx, near, far, fog) {
    ctx.strokeStyle = `rgba(40, 28, 16, ${0.35 * (1 - fog)})`;
    ctx.lineWidth = Math.max(1.2, 3.2 * (near.s || 1) * 0.04);
    ctx.beginPath();
    ctx.moveTo(near.xl, near.yc + 4);
    ctx.lineTo(far.xl, far.yc + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(near.xr, near.yc + 4);
    ctx.lineTo(far.xr, far.yc + 3);
    ctx.stroke();
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

  _paintEndDark(ctx) {
    if (this.junction && this.junction.forward) return;
    const d = this.junction ? Math.max(80, this.junction.dist + 8) : FAR * 0.86;
    const left = this.project(-this.half * 0.7, d, 0);
    const right = this.project(this.half * 0.7, d, 0);
    const top = this.project(0, d, this.ceilH * 0.84);
    const mid = this.project(0, d, this.eyeH);
    const w = Math.max(12, right.x - left.x);
    const h = Math.max(10, left.floorY - top.y);
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(left.x, top.y, w, h);
    ctx.fillStyle = "#0c0907";
    const aw = w * 0.46;
    const ah = h * 0.74;
    ctx.beginPath();
    ctx.moveTo(mid.x - aw / 2, left.floorY);
    ctx.lineTo(mid.x - aw / 2, top.y + ah * 0.38);
    ctx.quadraticCurveTo(mid.x, top.y + 4, mid.x + aw / 2, top.y + ah * 0.38);
    ctx.lineTo(mid.x + aw / 2, left.floorY);
    ctx.closePath();
    ctx.fill();
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
      this.hits.push({ dir, ...r, names: this._prettyNames(choice) });
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
    const p = this.project(e.x, dist, 0);
    if (p.behind) return;
    const h = Math.max(10, 58 * e.size * 0.62 * p.s);
    const w = Math.max(6, h * (e.behavior === "hover" ? 0.7 : 0.5));
    const x = p.x;
    const foot = p.floorY;
    const top = foot - h;
    const ctx = this.ctx;
    const fog = this._fogK(dist);
    const col = e.color || "#8a4a4a";

    ctx.save();
    ctx.globalAlpha = 1 - fog * 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(x, foot - 1, w * 0.45, Math.max(1.4, h * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();
    this._paintFigure(ctx, e, x, top, w, h, col);
    if (e.hp < e.maxHp) {
      const barW = Math.max(8, w);
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(10,8,6,0.8)";
      ctx.fillRect(x - barW / 2, top - 6, barW, 3);
      ctx.fillStyle = ratio > 0.35 ? "#6a8a4a" : "#8a3030";
      ctx.fillRect(x - barW / 2, top - 6, barW * ratio, 3);
    }
    ctx.restore();
  }

  _paintFigure(ctx, e, x, top, w, h, col) {
    const mid = top + h * 0.42;
    const flash = e._hitFlash > 0 ? 1 : 0;
    ctx.fillStyle = flash ? "#d8c8b0" : col;

    if (e.behavior === "hover" || e.flying) {
      ctx.beginPath();
      ctx.moveTo(x, top + 1);
      ctx.lineTo(x + w * 0.55, mid);
      ctx.lineTo(x, top + h * 0.85);
      ctx.lineTo(x - w * 0.55, mid);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x - 1.5, mid - 1.5, 3, 3);
      return;
    }

    if (e.type && e.type.includes("slime")) {
      ctx.beginPath();
      ctx.ellipse(x, top + h * 0.72, w * 0.42, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.ellipse(x - w * 0.15, top + h * 0.5, w * 0.12, h * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - w * 0.18, top + h * 0.52, 2, 3);
      ctx.fillRect(x + w * 0.1, top + h * 0.52, 2, 3);
      return;
    }

    if (e.type && e.type.includes("skeleton")) {
      ctx.fillRect(x - w * 0.12, mid, w * 0.24, h * 0.38);
      ctx.fillRect(x - w * 0.32, mid + 2, w * 0.64, 3);
      ctx.fillStyle = "#d8d0c4";
      ctx.fillRect(x - w * 0.2, top + h * 0.08, w * 0.4, h * 0.28);
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - w * 0.1, top + h * 0.16, 3, 3);
      ctx.fillRect(x + w * 0.04, top + h * 0.16, 3, 3);
      return;
    }

    ctx.fillRect(x - w * 0.22, mid, w * 0.44, h * 0.42);
    ctx.fillRect(x - w * 0.16, top + h * 0.72, w * 0.14, h * 0.28);
    ctx.fillRect(x + w * 0.02, top + h * 0.72, w * 0.14, h * 0.28);
    const head = h * 0.22;
    ctx.beginPath();
    ctx.ellipse(x, top + head * 0.85, w * 0.22, head * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - w * 0.1, top + head * 0.7, 2.5, 2.5);
    ctx.fillRect(x + w * 0.04, top + head * 0.7, 2.5, 2.5);
    if (e.armor === "heavy") {
      ctx.strokeStyle = "rgba(200,190,160,0.35)";
      ctx.strokeRect(x - w * 0.24, mid, w * 0.48, h * 0.28);
    }
  }

  drawProjectile(p, enemy = false) {
    const dist = p.dist;
    if (dist == null || dist < -6 || dist > FAR) return;
    const sp = this.project(p.x, dist, 16);
    const ctx = this.ctx;
    const r = Math.max(1.4, (enemy ? 2.4 : 1.8) * sp.s);
    ctx.fillStyle = enemy ? "#c45a4a" : "#e8d8b0";
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    const trail = p._trail || [];
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const td = t.dist != null ? t.dist : t.worldZ - this.playerZ;
      if (td < 8) continue;
      const tp = this.project(t.x, td, 16);
      ctx.globalAlpha = ((i + 1) / trail.length) * 0.35;
      ctx.fillRect(tp.x, tp.y, 2, 2);
    }
    ctx.globalAlpha = 1;
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

    for (const h of this.hits) {
      const cx = h.x + h.w / 2;
      const cy = h.y + h.h * 0.4;
      const ready = !!(this.junction && this.junction.pending);
      this._drawChevron(ctx, cx, cy - 18, h.dir, ready);
      if (h.names) {
        ctx.font = `600 ${labelSize}px "Chakra Petch", sans-serif`;
        ctx.letterSpacing = "0.03em";
        const tw = ctx.measureText(h.names).width;
        ctx.fillStyle = "rgba(8, 6, 4, 0.58)";
        ctx.fillRect(cx - tw / 2 - 10, cy + 8, tw + 20, labelSize + 10);
        this._strokeFill(ctx, h.names, cx, cy + 16 + labelSize * 0.15, ready ? "#f3ead4" : "rgba(230, 214, 186, 0.88)");
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
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y - lift - 28);
    ctx.lineTo(x, y + 14 + pull);
    ctx.stroke();
    ctx.fillStyle = "#c9a227";
    ctx.beginPath();
    ctx.moveTo(x, y - lift - 40);
    ctx.lineTo(x + 7, y - lift - 20);
    ctx.lineTo(x - 7, y - lift - 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
