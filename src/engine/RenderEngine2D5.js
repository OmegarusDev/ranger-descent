/**
 * RenderEngine2D5 — Standalone 2.5D rendering engine for corridor games.
 *
 * ZERO game logic. Handles:
 * - Viewport projection (pitch-shifted 3/4 perspective)
 * - Camera pan/zoom with damped glide
 * - Unified depth-sorting across all entity arrays
 * - Canvas setup and DPR handling
 * - Rendering pipeline orchestration
 *
 * Adapted from Tower Defense BoardView (boardView.js) and stripped of
 * all sim, game state, and gameplay dependencies.
 */
import { CorridorCamera, CAMERA, setCameraPitch } from "./corridorCamera.js";
import { FxSystem } from "./fx.js";

/** Entity render descriptors — what the engine receives for depth sorting. */
export function renderDescriptor(entity, renderFn) {
  return { entity, render: renderFn, depth: 0 };
}

export class RenderEngine2D5 {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = new CorridorCamera();
    this.fx = new FxSystem();

    this.origin = { x: 0, y: 0 };
    this.cell = 40;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this._zoomT = 1;
    this._panXT = 0;
    this._panYT = 0;
    this._direct = false;
    this._dprCache = null;
    this._fitKey = "";

    // Camera shake
    this._shakeT = 0;
    this._shakeMag = 0;

    // Static layer cache
    this._staticDirty = true;
    this._staticLayer = null;

    // Atmosphere
    this.atmosphereId = "default";
    this._motes = Array.from({ length: 14 }, () => ({
      u: Math.random(),
      v: Math.random(),
      r: 0.5 + Math.random() * 1.4,
      sp: 0.012 + Math.random() * 0.03,
      ph: Math.random() * Math.PI * 2,
      warm: Math.random() > 0.4,
    }));

    // Depth-sorted render list (rebuilt each frame)
    this._renderList = [];

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0018);
        this._zoomT = Math.max(0.5, Math.min(2.5, this._zoomT * factor));
      }
    }, { passive: false });
  }

  _resolveDpr() {
    if (this._dprCache == null) {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      this._dprCache = Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1);
    }
    return this._dprCache;
  }

  /** Fit canvas to container. Call after corridor dimensions change. */
  fit(force = false) {
    const cssW = this.canvas.clientWidth || 360;
    const cssH = this.canvas.clientHeight || 640;
    const dpr = this._resolveDpr();
    const key = [
      cssW | 0, cssH | 0, dpr.toFixed(2),
      this.zoom.toFixed(3),
      this.panX.toFixed(2), this.panY.toFixed(2),
      this.cam.corridorW, this.cam.corridorL,
      CAMERA.pitchDeg | 0,
    ].join("|");

    if (!force && key === this._fitKey && this.canvas.width === Math.floor(cssW * dpr)) {
      return false;
    }

    const nextW = Math.floor(cssW * dpr);
    const nextH = Math.floor(cssH * dpr);
    const resized = this.canvas.width !== nextW || this.canvas.height !== nextH;
    this._fitKey = key;

    if (resized) {
      this.canvas.width = nextW;
      this.canvas.height = nextH;
      this._staticDirty = true;
    } else if (force) {
      this._staticDirty = true;
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sy = CAMERA.yScale;
    const topPad = 40;
    const bottomPad = 80;
    const viewH = Math.max(120, cssH - topPad - bottomPad);
    const leftPad = 40;
    const rightPad = 16;

    const baseCell = Math.max(20, Math.min(50, (cssW - leftPad - rightPad) / this.cam.corridorW));
    this.cell = baseCell * this.zoom;
    const boardW = this.cell * this.cam.corridorW;
    // Use viewport size (not full corridor) for height calculation
    const boardH = this.cell * 20 * sy;

    this.panX = leftPad + (cssW - leftPad - rightPad - boardW) / 2;
    this.panMinX = this.panX;
    this.panMaxX = this.panX;

    if (boardH <= viewH) {
      this.panMin = this.panMax = (viewH - boardH) / 2;
      this.panY = this.panMin;
    } else {
      this.panMax = 0;
      this.panMin = viewH - boardH;
      this.panY = Math.max(this.panMin, Math.min(this.panMax, this.panY));
    }

    this.origin = { x: this.panX, y: topPad + this.panY };
    this.cam.cell = this.cell;
    this.cam.configure(this.origin.x, this.origin.y, cssW, cssH);
    return true;
  }

  /** Set corridor dimensions in grid cells. */
  setCorridor(corridorW, corridorL) {
    this.cam.corridorW = corridorW;
    this.cam.corridorL = corridorL;
    this.cam.W = corridorW * this.cell;
    this.cam.H = corridorL * this.cell;
    this._staticDirty = true;
  }

  /** Camera shake effect. */
  punch(mag = 3) {
    this._shakeT = 0.18;
    this._shakeMag = Math.max(this._shakeMag, mag);
  }

  invalidateStatic() {
    this._staticDirty = true;
  }

  /**
   * Main draw call. Call once per frame.
   * @param {number} dt - delta time in seconds
   * @param {Function} drawCallback - called with (ctx, cam) for each draw layer
   *   The callback receives the engine context and should call
   *   engine.addRenderable() before the sort, then engine.drawSorted().
   */
  draw(dt, drawCallback) {
    this._stepCamera(dt);
    this.fit(false);

    if (this._shakeT > 0) {
      this._shakeT = Math.max(0, this._shakeT - dt);
      if (this._shakeT <= 0) this._shakeMag = 0;
    }

    const ctx = this.ctx;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const dpr = this._resolveDpr();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Background
    ctx.fillStyle = "#0a0c10";
    ctx.fillRect(0, 0, cssW, cssH);

    // Apply camera shake
    const shake = this._shakeT > 0
      ? {
          x: (Math.random() - 0.5) * this._shakeMag * (this._shakeT / 0.18),
          y: (Math.random() - 0.5) * this._shakeMag * (this._shakeT / 0.18),
        }
      : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Let the game callback draw the scene
    if (drawCallback) {
      drawCallback(ctx, this.cam, this);
    }

    // Draw FX on top
    this.fx.drawProjected(ctx, this.cam, (type) => this._colorForType(type));

    ctx.restore();

    // Atmosphere overlay
    this._drawAtmosphere(cssW, cssH);
  }

  /** Add a renderable to the depth-sorted list. Call before drawSorted(). */
  addRenderable(depth, renderFn) {
    this._renderList.push({ depth, render: renderFn });
  }

  /** Clear the render list (call at start of frame). */
  clearRenderList() {
    this._renderList.length = 0;
  }

  /** Sort and draw all renderables. */
  drawSorted(ctx) {
    this._renderList.sort((a, b) => a.depth - b.depth);
    for (const r of this._renderList) {
      ctx.save();
      r.render(ctx, this.cam);
      ctx.restore();
    }
  }

  _stepCamera(dt) {
    if (this._direct) {
      this.panX = this._panXT;
      this.panY = this._panYT;
      this.zoom = this._zoomT;
      return;
    }
    const pk = 1 - Math.exp(-16 * dt);
    const zk = 1 - Math.exp(-9 * dt);
    this.panX += (this._panXT - this.panX) * pk;
    this.panY += (this._panYT - this.panY) * pk;
    this.zoom += (this._zoomT - this.zoom) * zk;
  }

  _colorForType(type) {
    const colors = {
      kinetic: "#d8d2c4",
      fire: "#e07a3a",
      shock: "#e6c84a",
      frost: "#7eb8c9",
      poison: "#9a6bb8",
      acid: "#7aad5c",
    };
    return colors[type] || colors.kinetic;
  }

  _drawAtmosphere(cssW, cssH) {
    const t = performance.now() * 0.001;
    const vg = this.ctx.createRadialGradient(
      cssW * 0.5, cssH * 0.38, cssH * 0.18,
      cssW * 0.5, cssH * 0.5, cssH * (0.74 + 0.08 * CAMERA.depthFog)
    );
    vg.addColorStop(0, "transparent");
    vg.addColorStop(1, "rgba(8, 10, 14, 0.58)");
    this.ctx.fillStyle = vg;
    this.ctx.fillRect(0, 0, cssW, cssH);

    const bloom = this.ctx.createLinearGradient(0, 0, 0, cssH * 0.28);
    bloom.addColorStop(0, `rgba(4, 6, 8, ${0.35 + 0.25 * CAMERA.depthFog})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = bloom;
    this.ctx.fillRect(0, 0, cssW, cssH * 0.3);

    // Floating motes
    const plate = this.cam.corridorCorners();
    if (plate) {
      const left = Math.min(plate[0].x, plate[3].x);
      const right = Math.max(plate[1].x, plate[2].x);
      const top = Math.min(plate[0].y, plate[1].y);
      const bot = Math.max(plate[2].y, plate[3].y);
      for (const m of this._motes) {
        m.v -= m.sp * 0.016;
        if (m.v < -0.05) { m.v = 1.05; m.u = Math.random(); }
        const x = left + (right - left) * m.u + Math.sin(t * 0.7 + m.ph) * 6;
        const y = top + (bot - top) * m.v;
        const a = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2 + m.ph));
        this.ctx.fillStyle = m.warm
          ? `rgba(212, 120, 58, ${a})`
          : `rgba(158, 176, 192, ${a * 0.85})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, m.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Scanline texture
    this.ctx.fillStyle = "rgba(255,245,220,0.018)";
    for (let i = 0; i < 28; i++) {
      const x = ((i * 97 + t * 55) | 0) % cssW;
      const y = ((i * 53 + t * 23) | 0) % cssH;
      this.ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
}
