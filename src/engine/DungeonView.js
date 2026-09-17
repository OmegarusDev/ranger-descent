/**
 * First-person dungeon hall — Wolfenstein-style raycaster (2.5D).
 * Combat sprites, bow, and path overlay sit on top of the column renderer.
 */
import { CONFIG } from "../data/config.js";
import { paintRaycast, updateRayBasis, rayOccluded } from "./raycaster.js";
import { SPRITES, blitSprite, blitBow } from "./pixelSprites.js?v=138";

const NEAR = 6;
const FAR = 760;
const OPEN_LEN = 280;
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
    this.lookYaw = 0;
    this.walkYaw = 0;
    this.camX = 0;
    this.camZ = 0;
    this.hallLen = CONFIG.HALL_LENGTH || 560;
    this.bob = 0;
    this.sway = 0;
    this.roll = 0;
    this._walkAmt = 0;
    this._walkPhase = 0;
    this._bowTilt = 0;
    this.combatYaw = null;
    this.junction = null;
    this._worldHalls = [];
    this._forks = [];
    this.hits = [];
    this.ctx = null;
    this.cssW = 400;
    this.cssH = 720;
    this._setupProjection();
    updateRayBasis(this);
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

  setPose({ x = 0, z = 0, lookYaw = 0, walkYaw = 0, along = 0, ahead = 0, segmentIndex = 0 } = {}) {
    this.camX = x;
    this.camZ = z;
    this.lookYaw = lookYaw;
    this.walkYaw = walkYaw;
    this.yaw = lookYaw;
    this.along = along;
    this.ahead = ahead || this.hallLen;
    this.segmentIndex = segmentIndex;
    updateRayBasis(this);
  }

  /**
   * Corridor-local (lateral, forward) → world → pinhole.
   * Combat still speaks this language; turning uses lookYaw separately.
   */
  project(worldX, dist, worldY = 18) {
    const walk = this.combatYaw != null ? this.combatYaw : (this.walkYaw || 0);
    const sin = Math.sin(walk);
    const cos = Math.cos(walk);
    const wx = this.camX + worldX * cos + dist * sin;
    const wz = this.camZ - worldX * sin + dist * cos;
    return this.projectWorld(wx, wz, worldY);
  }

  /** World XZ + height Y, matching the raycaster dir/plane camera. */
  projectWorld(wx, wz, worldY = 18) {
    if (this._dirX == null) updateRayBasis(this);
    const dx = wx - this.camX;
    const dz = wz - this.camZ;
    const dirX = this._dirX;
    const dirZ = this._dirZ;
    const planeX = this._planeX;
    const planeZ = this._planeZ;
    const invDet = 1 / (planeX * dirZ - dirX * planeZ || 1e-8);
    const transformX = invDet * (dirZ * dx - dirX * dz);
    const transformY = invDet * (-planeZ * dx + planeX * dz);
    const behind = transformY < NEAR * 0.4;
    const d = Math.max(NEAR * 0.6, transformY);
    const perp = d / this.cell;
    const wallH = this.cssH / Math.max(0.08, perp);
    const s = wallH / this.ceilH;
    const horizon = this.cy + (this.bob || 0);
    const x = this.cssW * 0.5 * (1 + transformX / d) + (this.sway || 0);
    const floorY = horizon + wallH * 0.5;
    return {
      x,
      y: floorY - worldY * s,
      floorY,
      ceilY: horizon - wallH * 0.5,
      s,
      dist: d,
      behind,
      occluded: !behind && rayOccluded(this, x, d),
      v: 1 - Math.min(1, d / FAR),
    };
  }

  _toCam(wx, wy, wz) {
    const sin = Math.sin(this.lookYaw || 0);
    const cos = Math.cos(this.lookYaw || 0);
    const dx = wx - this.camX;
    const dz = wz - this.camZ;
    return {
      lat: dx * cos - dz * sin,
      fwd: dx * sin + dz * cos,
      y: wy,
    };
  }

  _lerpCam(a, b, t) {
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      fwd: a.fwd + (b.fwd - a.fwd) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  _clipNear(poly, near = NEAR) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ain = a.fwd >= near;
      const bin = b.fwd >= near;
      if (ain && bin) {
        out.push(b);
      } else if (ain && !bin) {
        out.push(this._lerpCam(a, b, (near - a.fwd) / ((b.fwd - a.fwd) || 1e-6)));
      } else if (!ain && bin) {
        out.push(this._lerpCam(a, b, (near - a.fwd) / ((b.fwd - a.fwd) || 1e-6)));
        out.push(b);
      }
    }
    return out;
  }

  _projectCam(pt) {
    const d = Math.max(NEAR, pt.fwd);
    const s = this.focal / d;
    return {
      x: this.cx + this.sway + pt.lat * s,
      y: this.cy + this.bob - (pt.y - this.eyeH) * s,
      s,
      dist: d,
    };
  }

  _fogK(dist) {
    const t = Math.max(0, Math.min(1, (dist - 140) / (FAR - 140)));
    return t * t * 0.82;
  }

  _torchAlong(n) {
    return n * TORCH_EVERY + TORCH_EVERY * 0.5;
  }

  _torchSlots(minDist, maxDist) {
    const offset = TORCH_EVERY * 0.5;
    const n0 = Math.floor((this.playerZ - offset) / TORCH_EVERY) - 1;
    const slots = [];
    for (let n = n0; n <= n0 + 10; n++) {
      const worldZ = this._torchAlong(n);
      const dist = worldZ - this.playerZ;
      if (dist < minDist || dist > maxDist) continue;
      slots.push({ n, worldZ, dist });
    }
    return slots;
  }

  _torchWarm(dist, worldZ = null) {
    const z = worldZ != null ? worldZ : this.playerZ + dist;
    const period = TORCH_EVERY;
    const n0 = Math.floor((z - period * 0.5) / period);
    let acc = 0;
    for (let n = n0 - 1; n <= n0 + 1; n++) {
      const d = Math.abs(z - this._torchAlong(n));
      acc += Math.max(0, 1 - d / 88);
    }
    const flicker = 0.7 + Math.sin(this.time * 6.8 + z * 0.02) * 0.2;
    return Math.min(1, acc) * flicker;
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

  _stripTile(near, far) {
    const z = far && far.worldZ != null
      ? far.worldZ
      : (near.worldZ != null ? near.worldZ : this.playerZ + near.dist);
    return Math.floor(z / TILE_Z);
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

  _dir(deg) {
    const r = (deg * Math.PI) / 180;
    return { x: Math.sin(r), z: Math.cos(r) };
  }

  _makeHall(x0, z0, x1, z1, tags = {}) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    if (Math.abs(dx) >= Math.abs(dz)) {
      return {
        axis: "x",
        c: (z0 + z1) * 0.5,
        a: Math.min(x0, x1),
        b: Math.max(x0, x1),
        ...tags,
      };
    }
    return {
      axis: "z",
      c: (x0 + x1) * 0.5,
      a: Math.min(z0, z1),
      b: Math.max(z0, z1),
      ...tags,
    };
  }

  _pushHall(list, x0, z0, x1, z1, tags) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 12) return;
    list.push(this._makeHall(x0, z0, x1, z1, tags));
  }

  _pushCrossing(corner) {
    if (!corner) return;
    const walkDeg = Number.isFinite(corner.oldHeading)
      ? corner.oldHeading
      : ((this.walkYaw || 0) * 180) / Math.PI;
    const fwd = this._dir(walkDeg);
    const left = this._dir(walkDeg - 90);
    const right = this._dir(walkDeg + 90);
    const forkX = corner.forkX;
    const forkZ = corner.forkZ;
    const backPad = this.cell * 3;
    const ox = Number.isFinite(corner.originX) ? corner.originX : forkX - fwd.x * 120;
    const oz = Number.isFinite(corner.originZ) ? corner.originZ : forkZ - fwd.z * 120;
    const keepLeft = !!corner.left;
    const keepRight = !!corner.right;
    const keepFwd = !!corner.forward;
    const chosen = corner.chosen === "left" || corner.chosen === "right" ? corner.chosen : null;
    const far = keepFwd ? this.hallLen : Math.max(this.half, 80);
    this._pushHall(
      this._worldHalls,
      ox - fwd.x * backPad,
      oz - fwd.z * backPad,
      forkX + fwd.x * far,
      forkZ + fwd.z * far,
      { current: true },
    );
    const weld = Math.max(this.cell, this.half - this.cell);
    const addSide = (dir, on, which) => {
      if (!on) return;
      const start = which === chosen ? this.cell * 0.25 : weld;
      this._pushHall(
        this._worldHalls,
        forkX + dir.x * start,
        forkZ + dir.z * start,
        forkX + dir.x * this.hallLen,
        forkZ + dir.z * this.hallLen,
        { branch: true },
      );
    };
    addSide(left, keepLeft, "left");
    addSide(right, keepRight, "right");
    this._forks.push({
      x: forkX,
      z: forkZ,
      left: keepLeft,
      right: keepRight,
      forward: keepFwd,
      back: false,
    });
  }

  _layoutHalls(j, motion) {
    const hallLen = this.hallLen;
    const turning = !!(motion && motion.turning);
    const corner = motion && motion.corner;
    const walkDeg = ((this.walkYaw || 0) * 180) / Math.PI;
    const fwd = this._dir(walkDeg);
    const left = this._dir(walkDeg - 90);
    const right = this._dir(walkDeg + 90);
    const along0 = Math.max(0, this.along || 0);
    const remaining = (j && Number.isFinite(j.dist)) ? j.dist : (this.ahead || hallLen);
    const halls = [];
    this._forks = [];
    this._worldHalls = halls;

    if (turning && corner) {
      this._pushCrossing(corner);
      this._fork = { x: corner.forkX, z: corner.forkZ, r: this.half + 10 };
      return halls;
    }

    const shaft = !!(j && j.elevator);
    const keepLeft = !shaft && !!(j && j.left);
    const keepRight = !shaft && !!(j && j.right);
    const keepFwd = !shaft && (!j || j.forward);
    const ahead0 = Math.max(0, remaining);
    const forkX = this.camX + fwd.x * ahead0;
    const forkZ = this.camZ + fwd.z * ahead0;
    const farAlong = ahead0 + (keepFwd ? hallLen : Math.max(this.half, 80));
    const backPad = this.cell * 3;
    this._pushHall(
      halls,
      this.camX - fwd.x * (along0 + backPad),
      this.camZ - fwd.z * (along0 + backPad),
      this.camX + fwd.x * farAlong,
      this.camZ + fwd.z * farAlong,
      { current: true },
    );

    const weld = Math.max(this.cell, this.half - this.cell);
    const addSide = (dir, on, len) => {
      if (!on) return;
      const x0 = forkX + dir.x * weld;
      const z0 = forkZ + dir.z * weld;
      const x1 = forkX + dir.x * len;
      const z1 = forkZ + dir.z * len;
      this._pushHall(halls, x0, z0, x1, z1, { branch: true });
    };

    this._forks.push({
      x: forkX,
      z: forkZ,
      left: keepLeft,
      right: keepRight,
      forward: keepFwd,
      back: false,
    });
    addSide(left, keepLeft, hallLen);
    addSide(right, keepRight, hallLen);
    if (corner) this._pushCrossing(corner);

    this._fork = { x: forkX, z: forkZ, r: this.half + 10 };
    return halls;
  }

  _crossSection(hall, s) {
    const h = this.half;
    if (hall.axis === "z") {
      return this._frameWorld(hall.c - h, s, hall.c + h, s, s);
    }
    return this._frameWorld(s, hall.c + h, s, hall.c - h, s);
  }

  _frameWorld(x0, z0, x1, z1, along) {
    const L = this.projectWorld(x0, z0, 0);
    const R = this.projectWorld(x1, z1, 0);
    const TL = this.projectWorld(x0, z0, this.ceilH);
    const dist = (L.dist + R.dist) * 0.5;
    return {
      xl: L.x, xr: R.x, yf: L.floorY, yc: TL.y, dist, s: L.s,
      behind: L.behind || R.behind,
      worldZ: along,
      wx0: x0, wz0: z0, wx1: x1, wz1: z1,
    };
  }

  _pointInHall(hall, x, z) {
    const pad = 2;
    if (hall.axis === "z") {
      return Math.abs(x - hall.c) <= this.half + pad && z >= hall.a - pad && z <= hall.b + pad;
    }
    return Math.abs(z - hall.c) <= this.half + pad && x >= hall.a - pad && x <= hall.b + pad;
  }

  _walkLeftDir() {
    return this._dir(((this.walkYaw || 0) * 180) / Math.PI - 90);
  }

  _wallMatchesDir(hall, wall, dir) {
    if (hall.axis === "z") {
      return wall === "lo" ? dir.x < -0.5 : dir.x > 0.5;
    }
    return wall === "lo" ? dir.z < -0.5 : dir.z > 0.5;
  }

  _sideIsOpen(hall, wall, alongMid) {
    if (!hall.current) return false;
    const mouth = this.half * 0.52;
    const left = this._walkLeftDir();
    const right = { x: -left.x, z: -left.z };
    for (const f of this._forks || []) {
      const alongF = hall.axis === "z" ? f.z : f.x;
      if (Math.abs(alongMid - alongF) > mouth) continue;
      const onHall = hall.axis === "z"
        ? Math.abs(f.x - hall.c) < 12
        : Math.abs(f.z - hall.c) < 12;
      if (!onHall) continue;
      if (f.left && this._wallMatchesDir(hall, wall, left)) return true;
      if (f.right && this._wallMatchesDir(hall, wall, right)) return true;
    }
    return false;
  }

  _emitFace(faces, pts, fill, stroke, clipNear = NEAR) {
    const cam = pts.map((p) => this._toCam(p.x, p.y, p.z));
    let avg = 0;
    let maxFwd = -Infinity;
    for (const c of cam) {
      avg += c.fwd;
      if (c.fwd > maxFwd) maxFwd = c.fwd;
    }
    avg /= cam.length;
    if (maxFwd < clipNear * 0.5) return;
    if (avg > FAR + 60) return;
    faces.push({ cam, avg, fill, stroke, clipNear });
  }

  _drawFaces(ctx, faces) {
    faces.sort((a, b) => b.avg - a.avg);
    for (const face of faces) {
      const clipped = this._clipNear(face.cam, face.clipNear || NEAR);
      if (clipped.length < 3) continue;
      const p0 = this._projectCam(clipped[0]);
      if (!Number.isFinite(p0.x) || !Number.isFinite(p0.y)) continue;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      let ok = true;
      for (let i = 1; i < clipped.length; i++) {
        const p = this._projectCam(clipped[i]);
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          ok = false;
          break;
        }
        ctx.lineTo(p.x, p.y);
      }
      if (!ok) continue;
      ctx.closePath();
      ctx.fillStyle = face.fill;
      ctx.fill();
      if (face.stroke) {
        ctx.strokeStyle = face.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  _faceStyle(avgFwd, along, litMul, floor, warmMul = 0.55) {
    const fog = this._fogK(Math.max(8, avgFwd));
    const warm = this._torchWarm(avgFwd, along);
    const lit = 0.42 + 0.5 * (1 - Math.min(1, avgFwd / FAR)) + warm * 0.18;
    const fill = this._stoneFill(lit * litMul, fog, floor, warm * warmMul);
    const stroke = floor
      ? `rgba(16, 10, 6, ${0.42 * (1 - fog)})`
      : `rgba(18, 12, 8, ${0.38 * (1 - fog)})`;
    return { fill, stroke, fog, warm, lit };
  }

  _emitHallFaces(buckets, hall) {
    const h = this.half;
    const tile = TILE_Z;
    const cols = 5;
    const courses = 7;
    const a0 = Math.floor(hall.a / tile) * tile;
    for (let s = a0; s < hall.b - 0.5; s += tile) {
      const s0 = Math.max(hall.a, s);
      const s1 = Math.min(hall.b, s + tile);
      if (s1 - s0 < 1.5) continue;
      const mid = (s0 + s1) * 0.5;
      const tileId = Math.floor(s / tile);

      for (let c = 0; c < cols; c++) {
        const u0 = (c / cols) * 2 * h - h;
        const u1 = ((c + 1) / cols) * 2 * h - h;
        const pts = hall.axis === "z"
          ? [
            { x: hall.c + u0, y: 0, z: s0 },
            { x: hall.c + u1, y: 0, z: s0 },
            { x: hall.c + u1, y: 0, z: s1 },
            { x: hall.c + u0, y: 0, z: s1 },
          ]
          : [
            { x: s0, y: 0, z: hall.c + u0 },
            { x: s1, y: 0, z: hall.c + u0 },
            { x: s1, y: 0, z: hall.c + u1 },
            { x: s0, y: 0, z: hall.c + u1 },
          ];
        const cam = pts.map((p) => this._toCam(p.x, p.y, p.z));
        const avg = cam.reduce((n, p) => n + p.fwd, 0) / 4;
        const shade = 0.62 + this._hash(c * 11 + tileId * 19) * 0.4;
        const st = this._faceStyle(avg, mid, shade, true, 0.5);
        this._emitFace(buckets.floors, pts, st.fill, st.stroke, NEAR);
      }

      const ceilPts = hall.axis === "z"
        ? [
          { x: hall.c - h, y: this.ceilH, z: s0 },
          { x: hall.c + h, y: this.ceilH, z: s0 },
          { x: hall.c + h, y: this.ceilH, z: s1 },
          { x: hall.c - h, y: this.ceilH, z: s1 },
        ]
        : [
          { x: s0, y: this.ceilH, z: hall.c - h },
          { x: s1, y: this.ceilH, z: hall.c - h },
          { x: s1, y: this.ceilH, z: hall.c + h },
          { x: s0, y: this.ceilH, z: hall.c + h },
        ];
      const ceilCam = ceilPts.map((p) => this._toCam(p.x, p.y, p.z));
      const ceilAvg = ceilCam.reduce((n, p) => n + p.fwd, 0) / 4;
      const ceilSt = this._faceStyle(ceilAvg, mid, 0.48, false, 0.25);
      this._emitFace(buckets.ceils, ceilPts, ceilSt.fill, null, 18);

      for (const wall of ["lo", "hi"]) {
        if (this._sideIsOpen(hall, wall, mid)) continue;
        const sign = wall === "lo" ? -1 : 1;
        for (let course = 0; course < courses; course++) {
          const y0 = (course / courses) * this.ceilH;
          const y1 = ((course + 1) / courses) * this.ceilH;
          let pts;
          if (hall.axis === "z") {
            const x = hall.c + sign * h;
            pts = [
              { x, y: y0, z: s0 },
              { x, y: y1, z: s0 },
              { x, y: y1, z: s1 },
              { x, y: y0, z: s1 },
            ];
          } else {
            const z = hall.c + sign * h;
            pts = [
              { x: s0, y: y0, z },
              { x: s0, y: y1, z },
              { x: s1, y: y1, z },
              { x: s1, y: y0, z },
            ];
          }
          const cam = pts.map((p) => this._toCam(p.x, p.y, p.z));
          const avg = cam.reduce((n, p) => n + p.fwd, 0) / 4;
          const sideLit = sign < 0 ? 0.86 : 1.08;
          const shade = sideLit * (0.74 + this._hash(course * 17 + tileId * 23 + sign) * 0.4);
          const st = this._faceStyle(avg, mid, shade, false, 0.65);
          this._emitFace(buckets.walls, pts, st.fill, st.stroke, 34);
        }
      }
    }
  }

  _paintWorldHalls(ctx) {
    const step = TILE_Z;
    const strips = [];
    for (const hall of this._worldHalls || []) {
      const samples = this._hallSamples(hall);
      const frames = samples.map((s) => this._crossSection(hall, s));
      for (let i = 0; i < frames.length - 1; i++) {
        const near = frames[i];
        const far = frames[i + 1];
        if (near.behind || far.behind) continue;
        if (near.dist >= FAR && far.dist >= FAR) continue;
        if (Math.abs(far.worldZ - near.worldZ) > step * 1.51) continue;
        if (!Number.isFinite(near.xl) || !Number.isFinite(far.xl)) continue;
        strips.push({ hall, near, far });
      }
    }
    strips.sort((a, b) => (b.near.dist + b.far.dist) - (a.near.dist + a.far.dist));

    for (const { hall, near, far } of strips) {
      const fog = this._fogK(near.dist);
      const warm = this._torchWarm(near.dist, far.worldZ);
      const lit = 0.4 + 0.5 * (1 - near.dist / FAR) + warm * 0.18;
      const mid = (near.worldZ + far.worldZ) * 0.5;

      this._fillQuad(ctx, [
        [near.xl, near.yf], [near.xr, near.yf], [far.xr, far.yf], [far.xl, far.yf],
      ], this._stoneFill(lit * 0.82, fog, true, warm * 0.55));
      this._strokeFlagstones(ctx, near, far, fog, warm);

      this._fillQuad(ctx, [
        [near.xl, near.yc], [near.xr, near.yc], [far.xr, far.yc], [far.xl, far.yc],
      ], this._stoneFill(lit * 0.48, fog, false, warm * 0.25));
      this._strokeBeams(ctx, near, far, fog, warm);

      if (!this._sideIsOpen(hall, "lo", mid)) {
        this._paintWall(ctx, near, far, -1, lit, fog, warm);
        this._paintMoss(ctx, near, far, -1, fog);
      }
      if (!this._sideIsOpen(hall, "hi", mid)) {
        this._paintWall(ctx, near, far, 1, lit, fog, warm);
        this._paintMoss(ctx, near, far, 1, fog);
      }
    }
  }

  _hallSamples(hall) {
    const step = TILE_Z;
    const samples = [];
    const push = (s) => {
      const v = Math.max(hall.a, Math.min(hall.b, s));
      const prev = samples[samples.length - 1];
      if (prev == null || Math.abs(prev - v) > 0.8) samples.push(v);
    };
    const cam = hall.axis === "z" ? this.camZ : this.camX;
    const yaw = this.lookYaw || 0;
    const alongFwd = hall.axis === "z" ? Math.cos(yaw) : Math.sin(yaw);
    const dir = alongFwd >= 0 ? 1 : -1;
    const eye = Math.max(hall.a, Math.min(hall.b, cam + dir * Math.max(28, this._feetDist())));
    const farEnd = dir > 0 ? hall.b : hall.a;
    push(eye);
    let s = dir > 0
      ? Math.ceil((eye + 1) / step) * step
      : Math.floor((eye - 1) / step) * step;
    while (dir > 0 ? s < farEnd - 0.8 : s > farEnd + 0.8) {
      push(s);
      s += dir * step;
    }
    push(farEnd);
    return samples;
  }

  drawHall(ctx, playerZ, time, junction = null, motion = null, dt = 1 / 60) {
    this.ctx = ctx;
    this.playerZ = playerZ;
    this.time = time;
    const walking = !!(motion && motion.walking);
    const turning = !!(motion && motion.turning);
    const walkTgt = walking ? 1 : turning ? 0.16 : 0.28;
    if (dt > 0) {
      const k = 1 - Math.exp(-10 * dt);
      this._walkAmt = (this._walkAmt || 0) + (walkTgt - (this._walkAmt || 0)) * k;
      const walk = this._walkAmt;
      this._walkPhase = (this._walkPhase || 0) + dt * (1.05 + 7.2 * walk);
    }
    const walk = this._walkAmt || 0;
    this.bob = Math.sin(this._walkPhase) * (0.5 + 2.35 * walk) + Math.sin(this._walkPhase * 0.18) * (0.22 + 0.18 * walk);
    this.sway = Math.cos(this._walkPhase * 0.5) * (0.16 + 1.22 * walk)
      + (turning ? Math.sin((motion.turnU || 0) * Math.PI) * 0.8 * (motion.turnSign || 1) : 0);
    this.roll = 0;
    let j = junction || null;
    if (j && turning) {
      j = { ...j, pending: false, turnSign: motion.turnSign || 1, turnU: motion.turnU || 0 };
    }
    this.junction = j;
    this.hits = [];
    this._layoutHalls(j, motion);

    ctx.save();
    ctx.fillStyle = "#100c08";
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    paintRaycast(this, ctx);
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

  /** Near-field fill so the lens never shows the backdrop under the bow. */
  _paintUnderfoot(ctx) {
    const saved = this.walkYaw;
    this.walkYaw = this.lookYaw;
    const feet = this._frame(this._feetDist());
    const floorCol = this._stoneFill(1.02, 0, true);
    const floorTop = Math.min(this.cssH * 0.52, Math.max(this.cy + 24, feet.yf));
    ctx.fillStyle = floorCol;
    ctx.fillRect(-20, floorTop, this.cssW + 40, this.cssH);
    this._fillQuad(ctx, [
      [feet.xl, feet.yc], [feet.xl, feet.yf], [-60, this.cssH + 24], [-60, -20],
    ], this._stoneFill(0.92, 0, false));
    this._fillQuad(ctx, [
      [feet.xr, feet.yc], [this.cssW + 60, -20], [this.cssW + 60, this.cssH + 24], [feet.xr, feet.yf],
    ], this._stoneFill(1.08, 0, false));
    this.walkYaw = saved;
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

    const courses = 7;
    const bricks = 2;
    const tile = this._stripTile(near, far);

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

    const tile = this._stripTile(near, far);
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
    const tile = this._stripTile(near, far);
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
    const h = this._hash(this._stripTile(near, far) + sign * 9);
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
    for (const slot of this._torchSlots(24, FAR - 60)) {
      const z = slot.dist;
      const flicker = 0.7 + Math.sin(this.time * 6.2 + slot.n * 1.7) * 0.18;
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
    if (p.behind || p.occluded) return;
    blitSprite(ctx, h > 0.7 ? SPRITES.barrelB : SPRITES.barrelA, p.x, p.floorY, 16 * p.s, {
      alpha: 1 - this._fogK(dist) * 0.7,
      flip: side < 0,
    });
  }

  _drawCrate(ctx, side, dist, h) {
    const p = this.project(side * (this.half - 20), dist, 0);
    if (p.behind || p.occluded) return;
    blitSprite(ctx, h > 0.6 ? SPRITES.crateB : SPRITES.crateA, p.x, p.floorY, 12 * p.s, {
      alpha: 1 - this._fogK(dist) * 0.7,
    });
  }

  _drawUrn(ctx, side, dist) {
    const p = this.project(side * (this.half - 16), dist, 0);
    if (p.behind || p.occluded) return;
    blitSprite(ctx, SPRITES.urn, p.x, p.floorY, 14 * p.s, {
      alpha: 1 - this._fogK(dist) * 0.7,
    });
  }

  _drawScreenCobwebs(ctx) {
    const s = Math.max(48, Math.min(96, this.cssW * 0.16));
    blitSprite(ctx, SPRITES.cobweb, s * 0.5, 0, s, { alpha: 0.55, anchor: "top" });
    blitSprite(ctx, SPRITES.cobweb, this.cssW - s * 0.5, 0, s, { alpha: 0.5, flip: true, anchor: "top" });
  }

  _drawCobweb(ctx, side, dist, h) {
    const corner = this.project(side * this.half, dist, this.ceilH - 2);
    if (corner.behind || corner.occluded) return;
    const size = Math.max(10, 22 * corner.s);
    blitSprite(ctx, SPRITES.cobweb, corner.x, corner.y, size, {
      alpha: 0.5 * (1 - this._fogK(dist)),
      flip: side > 0,
      anchor: "top",
    });
  }

  _drawChains(ctx) {
    for (let k = 0; k < 5; k++) {
      const worldZ = Math.floor(this.playerZ / 200) * 200 + k * 200 + 90;
      const dist = worldZ - this.playerZ;
      if (dist < 50 || dist > 280) continue;
      const side = this._hash(k + 4) > 0.5 ? 1 : -1;
      const top = this.project(side * this.half * 0.35, dist, this.ceilH - 2);
      if (top.behind || top.occluded) continue;
      blitSprite(ctx, SPRITES.chain, top.x, top.y, 22 * top.s, {
        alpha: 0.7 * (1 - this._fogK(dist)),
        anchor: "top",
      });
    }
  }

  _paintTorches(ctx) {
    for (const slot of this._torchSlots(36, FAR - 50)) {
      const z = slot.dist;
      for (const side of [-1, 1]) {
        const p = this.project(side * (this.half - 6), z, 36);
        if (p.behind) continue;
        const frame = Math.sin(this.time * 6.2 + slot.n * 1.7 + side) > 0 ? SPRITES.torch1 : SPRITES.torch0;
        blitSprite(ctx, frame, p.x, p.y + 10 * p.s, 18 * p.s, {
          alpha: 1 - this._fogK(z) * 0.55,
          flip: side > 0,
        });
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

  /** Soft depth into side / ahead forks while approaching or turning. */
  _paintOpeningDepth(ctx) {
    const j = this.junction;
    if (!j || j.dist > 320) return;
    const near = this._frame(Math.max(40, j.dist));
    const fog = this._fogK(near.dist);
    const turnU = j.turnU || 0;
    const turning = turnU > 0.02;
    if (turning) return;
    const glow = 0.22 + (1 - Math.min(1, j.dist / 280)) * 0.35;

    const paintSide = (sign) => {
      const edge = sign < 0 ? near.xl : near.xr;
      const inward = edge + sign * Math.max(28, (near.xr - near.xl) * 0.42);
      const midY = (near.yc + near.yf) * 0.52;
      const g = ctx.createLinearGradient(edge, midY, inward, midY);
      g.addColorStop(0, `rgba(18, 12, 8, ${0.05 * (1 - fog)})`);
      g.addColorStop(0.35, `rgba(48, 34, 22, ${glow * (1 - fog * 0.5)})`);
      g.addColorStop(1, `rgba(8, 5, 3, ${0.72 + glow * 0.15})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      if (sign < 0) {
        ctx.moveTo(near.xl, near.yc);
        ctx.lineTo(inward, near.yc + (near.yf - near.yc) * 0.08);
        ctx.lineTo(inward, near.yf - (near.yf - near.yc) * 0.06);
        ctx.lineTo(near.xl, near.yf);
      } else {
        ctx.moveTo(near.xr, near.yc);
        ctx.lineTo(near.xr, near.yf);
        ctx.lineTo(inward, near.yf - (near.yf - near.yc) * 0.06);
        ctx.lineTo(inward, near.yc + (near.yf - near.yc) * 0.08);
      }
      ctx.closePath();
      ctx.fill();
      // Warm rim on the cut stone edge.
      ctx.strokeStyle = `rgba(232, 197, 106, ${(0.18 + glow * 0.25) * (1 - fog)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(edge, near.yc + 4);
      ctx.lineTo(edge, near.yf - 4);
      ctx.stroke();
    };

    if (j.left && (!turning || (j.turnSign || 0) < 0)) paintSide(-1);
    if (j.right && (!turning || (j.turnSign || 0) > 0)) paintSide(1);

    if (j.forward && !turning) {
      const mx = (near.xl + near.xr) / 2;
      const g = ctx.createRadialGradient(mx, (near.yc + near.yf) * 0.55, 8, mx, (near.yc + near.yf) * 0.55, (near.xr - near.xl) * 0.55);
      g.addColorStop(0, `rgba(40, 28, 16, ${0.2 * glow})`);
      g.addColorStop(1, `rgba(6, 4, 3, ${0.55 + glow * 0.2})`);
      ctx.fillStyle = g;
      ctx.fillRect(near.xl + 6, near.yc + 4, near.xr - near.xl - 12, near.yf - near.yc - 8);
    }
  }

  _prettyNames(choice) {
    if (!choice || !choice.enemyTypes || !choice.enemyTypes.length) return "";
    return choice.enemyTypes.slice(0, 2).map((t) =>
      t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    ).join(" · ");
  }

  _enemyLayout(e) {
    const dist = e.dist;
    if (dist < 4 || dist > FAR) return null;
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
    if (p.behind) return null;
    const squash = e._squash > 0 ? 1 - e._squash * 0.24 : 1;
    const stretch = e._squash > 0 ? 1 + e._squash * 0.2 : 1;
    const h = Math.max(10, worldH * p.s) * squash;
    const slime = type.includes("slime");
    const w = Math.max(8, h * (flying ? 1.15 : slime ? 1.35 : 0.58)) * stretch;
    const x = p.x;
    const foot = flying ? p.y + h * 0.38 : p.floorY;
    const top = foot - h;
    return { x, top, w, h, foot, p, dist, flying };
  }

  hitTestEnemy(e, cssX, cssY) {
    const layout = this._enemyLayout(e);
    if (!layout) return false;
    const { x, top, w, foot } = layout;
    const padX = Math.max(18, w * 0.28);
    const padY = Math.max(18, (foot - top) * 0.2);
    return cssX >= x - w / 2 - padX && cssX <= x + w / 2 + padX
      && cssY >= top - padY && cssY <= foot + padY;
  }

  drawEnemy(e) {
    const layout = this._enemyLayout(e);
    if (!layout || layout.p.occluded) return;
    const { x, top, w, h, foot, p, dist, flying } = layout;
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
      if (sp.behind || sp.occluded) return;
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
    const speed = Math.hypot(p.vx || 0, p.vz || 0) || 1;
    const ux = (p.vx || 0) / speed;
    const uz = (p.vz || 0) / speed;
    const shaft = 16;
    const tip = this.project(p.x, dist, py);
    if (tip.behind || tip.occluded) return;
    const tail = this.project(p.x - ux * shaft, dist - uz * shaft, py);
    const dx = tip.x - tail.x;
    const dy = tip.y - tail.y;
    const slen = Math.hypot(dx, dy) || 1;
    const nx = dx / slen;
    const ny = dy / slen;
    const px = -ny;
    const pyx = nx;
    const head = Math.max(5.5, Math.min(11, 7.2 * Math.max(0.55, tip.s * 0.07)));
    const fletch = Math.max(3.2, head * 0.55);
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
    ctx.moveTo(tip.x + nx * 1.2, tip.y + ny * 1.2);
    ctx.lineTo(tip.x - nx * head + px * (head * 0.42), tip.y - ny * head + pyx * (head * 0.42));
    ctx.lineTo(tip.x - nx * head - px * (head * 0.42), tip.y - ny * head - pyx * (head * 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a4a28";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tail.x + px * fletch, tail.y + pyx * fletch);
    ctx.lineTo(tail.x + nx * 1.4, tail.y + ny * 1.4);
    ctx.lineTo(tail.x - px * fletch, tail.y - pyx * fletch);
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
    const labelSize = Math.max(16, Math.round(this.cssW / 36));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

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
        ctx.font = `600 ${labelSize}px "IM Fell English", serif`;
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
    const pulling = input && input.isDragging && input.power > 2;
    const pull = pulling ? Math.min(1, input.power / 24) : 0;
    const maxAim = CONFIG.AIM_MAX || 1.28;
    const now = performance.now();
    let target = 0;
    if (pulling) {
      target = Math.max(-maxAim, Math.min(maxAim, input.angle || 0));
    } else if (this._bowHoldUntil && now < this._bowHoldUntil) {
      target = this._bowHold || 0;
    }
    if (this._bowTilt == null) this._bowTilt = 0;
    if (pulling) this._bowTilt = target;
    else this._bowTilt += (target - this._bowTilt) * 0.22;
    let tilt = this._bowTilt;
    if (this.bowJoltUntil && now < this.bowJoltUntil && !pulling) {
      tilt += Math.sin(now * 0.064) * 0.02;
    }
    const nocked = this.nockedArrow || null;
    blitBow(ctx, this.cssW, this.cssH, pull, {
      tilt,
      type: nocked && nocked.type,
      color: nocked && nocked.color,
    });
  }
}
