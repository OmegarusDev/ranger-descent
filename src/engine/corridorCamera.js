/**
 * CorridorCamera — perspective for an on-rails corridor.
 *
 * Supports two modes:
 *   1. Straight corridor: original formula, path=null
 *   2. Path-based corridor: transforms (worldX, dist) through a curved center-line
 *
 * Everything is relative to the player at origin (0, 0).
 */

import { CONFIG } from "../data/config.js";
import { walkPath, perpRight } from "./corridorPath.js";

export const CAMERA = {
  pitchDeg: CONFIG.PITCH_DEFAULT,
  yScale: 0.79,
  farScale: 0.62,
  nearScale: 1,
  deckRatio: 0.79,
  depthFog: 0.22,
};

export function setCameraPitch(deg) {
  CAMERA.pitchDeg = Math.max(CONFIG.PITCH_MIN, Math.min(CONFIG.PITCH_MAX, deg));
  const p = (CAMERA.pitchDeg * Math.PI) / 180;
  const D = Math.max(0.42, Math.pow(Math.cos(p), 1.5));
  CAMERA.yScale = D;
  CAMERA.deckRatio = D;
}

export function deckRy(rx) {
  return rx * CAMERA.deckRatio;
}

export class CorridorCamera {
  constructor() {
    this.originX = 0;
    this.originY = 0;
    this.cell = CONFIG.CELL_SIZE;
    this.corridorW = CONFIG.CORRIDOR_WIDTH;
    this.corridorL = CONFIG.CORRIDOR_LENGTH;
    this.W = this.corridorW * this.cell;
    this.H = this.corridorL * this.cell;
    this.playerScreenX = 0;
    this.playerScreenY = 0;

    this.K = 800;
    this.VScale = 0.45;

    this.path = null;
    this._camPos = { x: 0, y: 0 };
    this._camFwd = { x: 0, y: 1 };
    this._camRight = { x: 1, y: 0 };
    this._camDist = 0;
  }

  configure(originX, originY, canvasW, canvasH) {
    this.originX = originX;
    this.originY = originY;
    this.W = this.corridorW * this.cell;
    this.H = this.corridorL * this.cell;
    this.playerScreenX = originX + this.W * 0.5;
    this.playerScreenY = originY + canvasH * 0.78;
    this.K = 800;
  }

  setPath(smoothedPath) {
    this.path = smoothedPath;
  }

  clearPath() {
    this.path = null;
    this._camPos = { x: 0, y: 0 };
    this._camFwd = { x: 0, y: 1 };
    this._camRight = { x: 1, y: 0 };
  }

  updatePose(playerDist) {
    this._camDist = playerDist;
    if (!this.path) return;
    const p = walkPath(this.path, playerDist);
    this._camPos = { x: p.x, y: p.y };
    this._camFwd = { x: p.tx, y: p.ty };
    this._camRight = perpRight(p.tx, p.ty);
  }

  project(worldX, dist) {
    if (!this.path) {
      const d = Math.max(-this.K * 0.4, dist);
      const s = this.K / (this.K + d);
      const v = 1 - s;
      return {
        x: this.playerScreenX + worldX * s,
        y: this.playerScreenY - d * s * this.VScale,
        s,
        v,
      };
    }

    const p = walkPath(this.path, dist);
    const wx = p.x + worldX * this._camRight.x;
    const wy = p.y + worldX * this._camRight.y;

    const relX = wx - this._camPos.x;
    const relY = wy - this._camPos.y;

    const fwd = relX * this._camFwd.x + relY * this._camFwd.y;
    const lat = relX * this._camRight.x + relY * this._camRight.y;

    const d = Math.max(0, fwd);
    const s = this.K / (this.K + d);
    const v = 1 - s;

    return {
      x: this.playerScreenX + lat * s,
      y: this.playerScreenY - d * s * this.VScale,
      s,
      v,
    };
  }

  projectWorld(wx, wy) {
    if (!this.path) {
      return this.project(wx, wy);
    }

    const relX = wx - this._camPos.x;
    const relY = wy - this._camPos.y;
    const fwd = relX * this._camFwd.x + relY * this._camFwd.y;
    const lat = relX * this._camRight.x + relY * this._camRight.y;

    const d = Math.max(0, fwd);
    const s = this.K / (this.K + d);
    const v = 1 - s;

    return {
      x: this.playerScreenX + lat * s,
      y: this.playerScreenY - d * s * this.VScale,
      s,
      v,
    };
  }

  unproject(sx, sy) {
    const dx = sx - this.playerScreenX;
    const dy = this.playerScreenY - sy;
    const denom = this.K * this.VScale - dy;
    const fwd = denom > 1 ? (dy * this.K) / denom : 0;
    const s = this.K / (this.K + fwd);
    const lat = s > 0.01 ? dx / s : 0;

    if (!this.path) {
      return { worldX: lat, dist: fwd };
    }

    return { worldX: lat, dist: this._camDist + fwd };
  }

  corridorCorners() {
    const maxDist = this.K * 4;
    return [
      this.project(-this.W / 2, 0),
      this.project(this.W / 2, 0),
      this.project(this.W / 2, maxDist),
      this.project(-this.W / 2, maxDist),
    ];
  }

  screenHeight() {
    return this.H * CAMERA.yScale;
  }
}
