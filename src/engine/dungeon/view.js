/**
 * Dungeon facade. main.js still calls resize, setPose, drawHall, drawEnemy,
 * drawProjectile, drawOverlay, project, hitTest, hitTestEnemy.
 */
import { DungeonWorld } from "./world.js";
import { DungeonCamera } from "./camera.js";
import { paintRaycast, rayOccluded } from "./raycast.js";
import { collectProps, paintProps } from "./props.js";
import { drawEnemy, drawProjectile, hitTestEnemy } from "./billboards.js";
import { drawBowOverlay } from "./bow.js";

export class DungeonView {
  constructor() {
    this.world = new DungeonWorld();
    this.camera = new DungeonCamera();
    this.cell = this.world.cell;
    this.cssW = 400;
    this.cssH = 720;
    this.cx = 200;
    this.cy = 300;
    this.camX = 0;
    this.camZ = 0;
    this.yaw = 0;
    this.heading = 0;
    this.along = 0;
    this.ahead = 560;
    this.segmentIndex = 0;
    this.seg0 = 0;
    this.bob = 0;
    this.sway = 0;
    this._walkAmt = 0;
    this._walkPhase = 0;
    this._bowRise = 0;
    this._bowRiseAt = 0;
    this._bowTilt = 0;
    this.junction = null;
    this.frame = null;
    this.hits = [];
    this.lights = [];
    this.ctx = null;
    this.time = 0;
    this.dirX = 0;
    this.dirZ = 1;
    this.planeX = 0.9;
    this.planeZ = 0;
  }

  resize(cssW, cssH) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.camera.resize(cssW, cssH);
    this.camera.cell = this.cell;
    this.cx = this.camera.cx;
    this.cy = this.camera.cy;
  }

  setPose({ x = 0, z = 0, yaw = 0, heading = 0, along = 0, ahead = 560, segmentIndex = 0, seg0 = 0 } = {}) {
    this.camX = x;
    this.camZ = z;
    this.yaw = yaw;
    this.heading = heading;
    this.along = along;
    this.ahead = ahead;
    this.segmentIndex = segmentIndex;
    this.seg0 = seg0;
    this.camera.x = x;
    this.camera.z = z;
    this.camera.cell = this.cell;
    this.camera.setYaw(yaw);
    this.dirX = this.camera.dirX;
    this.dirZ = this.camera.dirZ;
    this.planeX = this.camera.planeX;
    this.planeZ = this.camera.planeZ;
  }

  /** Camera-local (lateral, forward) → screen. Bow and the nock marker use this. */
  project(lat, along, worldY = 18) {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    const wx = this.camX + lat * c + along * s;
    const wz = this.camZ - lat * s + along * c;
    const p = this.camera.projectWorld(wx, wz, worldY);
    if (!p.behind) p.occluded = this.occluded(p.x, p.dist);
    return p;
  }

  occluded(screenX, distWorld) {
    return rayOccluded(this, screenX, distWorld);
  }

  drawHall(ctx, playerZ, time, junction = null, motion = null, dt = 1 / 60) {
    this.ctx = ctx;
    this.time = time || 0;
    const walking = !!(motion && motion.walking);
    const turning = !!(motion && motion.turning);
    const walkTgt = walking ? 1 : turning ? 0.16 : 0.28;
    if (dt > 0) {
      const k = 1 - Math.exp(-10 * dt);
      this._walkAmt += (walkTgt - this._walkAmt) * k;
      this._walkPhase += dt * (1.05 + 7.2 * this._walkAmt);
    }
    const walk = this._walkAmt || 0;
    this.bob = Math.sin(this._walkPhase) * (0.5 + 2.35 * walk) + Math.sin(this._walkPhase * 0.18) * (0.22 + 0.18 * walk);
    this.sway = Math.cos(this._walkPhase * 0.5) * (0.16 + 1.22 * walk)
      + (turning ? Math.sin((motion.turnU || 0) * Math.PI) * 0.8 * (motion.turnSign || 1) : 0);
    this.camera.bob = this.bob;
    this.camera.sway = this.sway;
    this.junction = junction || null;
    this.hits = [];
    this.frame = {
      camX: this.camX,
      camZ: this.camZ,
      lookYaw: this.yaw,
      heading: this.heading,
      playerZ: playerZ || 0,
      seg0: this.seg0,
      along: this.along,
      ahead: this.ahead,
      segmentIndex: this.segmentIndex,
      corner: motion && motion.corner,
      junction: this.junction,
    };
    this.world.sync(this.frame);
    const props = collectProps(this.world, this.camX, this.camZ);
    this.lights = props.torches;
    ctx.save();
    ctx.fillStyle = "#100c08";
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    paintRaycast(this, ctx);
    paintProps(this, ctx, props);
    this._vignette(ctx);
    if (this.junction && this.junction.pending) this._openings();
    ctx.restore();
  }

  drawEnemy(e) { drawEnemy(this, e); }
  drawProjectile(p, enemy = false) { drawProjectile(this, p, enemy); }
  hitTestEnemy(e, cssX, cssY) { return hitTestEnemy(this, e, cssX, cssY); }

  drawOverlay(ctx, input, nockedProj) {
    this._pathOverlay(ctx);
    drawBowOverlay(this, ctx, input, nockedProj);
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

  _openings() {
    const j = this.junction;
    for (const dir of ["left", "right", "forward"]) {
      if (!j[dir]) continue;
      const r = screenPortal(dir, this.cssW, this.cssH);
      const choice = (j.choices || []).find((c) => c.direction === dir);
      this.hits.push({
        dir,
        ...r,
        names: prettyNames(choice),
        families: choice && choice.families ? choice.families.slice(0, 3) : [],
      });
    }
  }

  _pathOverlay(ctx) {
    if (!this.hits.length) return;
    const pending = !!(this.junction && this.junction.pending);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const h of this.hits) {
      const cx = h.x + h.w / 2;
      const cy = h.y + h.h * 0.4;
      drawChevron(ctx, cx, cy - 28, h.dir, pending);
    }
    ctx.restore();
  }

  _vignette(ctx) {
    const g = ctx.createRadialGradient(this.cx, this.cy, this.cssW * 0.18, this.cx, this.cy, this.cssH * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.65, "rgba(8, 5, 3, 0.08)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }
}

function screenPortal(dir, w, h) {
  if (dir === "left") return { x: 0, y: 0, w: w * 0.34, h };
  if (dir === "right") return { x: w * 0.66, y: 0, w: w * 0.34, h };
  return { x: w * 0.34, y: 0, w: w * 0.32, h };
}

function prettyNames(choice) {
  if (!choice || !choice.enemyTypes || !choice.enemyTypes.length) return "";
  return choice.enemyTypes.slice(0, 2).map((t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  ).join(" · ");
}

function drawChevron(ctx, x, y, dir, ready) {
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
