/**
 * InputHandler — slingshot drag-and-release.
 *
 * Simple: the drag vector in screen space directly becomes the arrow
 * velocity in world space. No camera unprojection needed.
 *   - Drag left/right → lateral aim
 *   - Drag distance → power / forward speed
 *   - Flat XZ shots only (no vertical aim)
 */
import { CONFIG } from "../data/config.js";

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this._pointerId = null;

    this.originX = 0;
    this.originY = 0;
    this.dragX = 0;
    this.dragY = 0;
    this.isDragging = false;

    this.angle = 0;
    this.aimTarget = 0;
    this._aimAt = 0;
    this.power = 0;
    this.vector = { x: 0, y: 0 };

    this.maxPull = 120;

    this.onDragStart = null;
    this.onDragMove = null;
    this.onDragEnd = null;
    this.onTap = null;

    this._ignoreMouseUntil = 0;
    this._suppressClick = false;
    this.blockUntil = 0;
    this.choiceMode = false;
    this.paused = false;
    this._abortedId = null;

    this._bindEvents();
  }

  /** Drop a held draw without firing. The matching pointerup is swallowed. */
  abortDraw() {
    if (this._pointerId != null) this._abortedId = this._pointerId;
    this.isDragging = false;
    this.active = false;
    this.power = 0;
    this.vector = { x: 0, y: 0 };
    this.angle = 0;
    this.aimTarget = 0;
    this._pointerId = null;
  }

  isAbortedPointer(id) {
    return this._abortedId != null && id === this._abortedId;
  }

  /** True if this pointer's release must not fire, tap, or pick a path. */
  takeSwallowedPointer(id) {
    if (!this.isAbortedPointer(id)) return false;
    const token = this._abortedId;
    queueMicrotask(() => {
      if (this._abortedId === token) this._abortedId = null;
    });
    return true;
  }

  reset() {
    this.abortDraw();
    this.active = false;
    this._aimAt = 0;
    this._suppressClick = false;
    this.choiceMode = false;
  }

  _bindEvents() {
    this.canvas.addEventListener("pointerdown", (e) => this._onDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onMove(e));
    this.canvas.addEventListener("pointerup", (e) => this._onUp(e));
    this.canvas.addEventListener("pointercancel", (e) => this._onUp(e, true));
    this.canvas.addEventListener("click", (e) => {
      if (this._suppressClick) {
        this._suppressClick = false;
        return;
      }
      if (this.paused) return;
      if (performance.now() < this.blockUntil) return;
      const { x, y } = this._toCanvas(e);
      if (this.onTap) this.onTap(x, y);
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _toCanvas(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onDown(e) {
    if (this.paused) return;
    if (this.isAbortedPointer(e.pointerId)) return;
    if (e.pointerType === "mouse" && performance.now() < this._ignoreMouseUntil) return;
    if (!this.choiceMode && performance.now() < this.blockUntil) return;
    const { x, y } = this._toCanvas(e);
    this._pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}
    this.originX = x;
    this.originY = y;
    this.dragX = x;
    this.dragY = y;
    this.angle = 0;
    this.aimTarget = 0;
    this._aimAt = performance.now();
    this.isDragging = true;
    this.active = true;
    if (this.onDragStart) this.onDragStart(x, y);
  }

  _onMove(e) {
    if (!this.isDragging || e.pointerId !== this._pointerId) return;
    const { x, y } = this._toCanvas(e);
    this.dragX = x;
    this.dragY = y;
    this._compute();
    if (this.onDragMove) this.onDragMove(this.angle, this.power, this.vector);
  }

  _onUp(e, cancelled = false) {
    if (this.takeSwallowedPointer(e.pointerId)) {
      try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
      this._suppressClick = true;
      if (this._pointerId === e.pointerId) {
        this.isDragging = false;
        this._pointerId = null;
        this.power = 0;
        this.vector = { x: 0, y: 0 };
        this.active = false;
      }
      return;
    }
    if (this._pointerId != null && e.pointerId !== this._pointerId) return;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
    const { x, y } = this._toCanvas(e);
    this.dragX = x;
    this.dragY = y;
    const wasDragging = this.isDragging;
    this.isDragging = false;
    this._pointerId = null;
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      this._ignoreMouseUntil = performance.now() + 550;
    }
    if (cancelled) {
      this._suppressClick = true;
      this.power = 0;
      this.vector = { x: 0, y: 0 };
      this.active = false;
      return;
    }
    if (this.choiceMode && this.onTap) {
      this._suppressClick = true;
      this.onTap(x, y);
      this.power = 0;
      this.vector = { x: 0, y: 0 };
      return;
    }
    this._suppressClick = true;
    if (wasDragging) {
      this._compute();
      const pull = Math.hypot(this.originX - this.dragX, this.originY - this.dragY);
      const isTap = pull < 24 || this.power < CONFIG.SLINGSHOT_MIN_POWER;
      if (performance.now() >= this.blockUntil) {
        if (isTap) {
          if (this.onTap) this.onTap(x, y);
        } else if (this.onDragEnd) {
          this.angle = this.aimTarget;
          this.vector = {
            x: Math.sin(this.angle),
            y: -Math.cos(this.angle),
          };
          this.onDragEnd(this.angle, this.power, { ...this.vector });
        }
      }
      this.power = 0;
      this.vector = { x: 0, y: 0 };
    }
  }

  _compute() {
    const dx = this.originX - this.dragX;
    const dy = this.originY - this.dragY;
    const dist = Math.hypot(dx, dy);

    if (this.choiceMode) {
      this.power = 0;
      this.vector = { x: 0, y: 0 };
      this.angle = 0;
      this.aimTarget = 0;
      return;
    }

    this.power = Math.min(CONFIG.SLINGSHOT_MAX_POWER,
      (dist / this.maxPull) * CONFIG.SLINGSHOT_MAX_POWER);

    if (dist < 4) {
      this.power = 0;
      this.vector = { x: 0, y: 0 };
      return;
    }

    const maxAim = CONFIG.AIM_MAX || 1.28;
    // 0 = hall-forward (up the screen). Floor the vertical so a tiny
    // sideways jitter does not whip the bow, while a real side-pull
    // can still reach the full aim arc.
    const target = Math.max(-maxAim, Math.min(maxAim, Math.atan2(dx, Math.max(-dy, 14))));
    this.aimTarget = target;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - (this._aimAt || now)) / 1000));
    this._aimAt = now;
    const k = dt <= 0 ? 1 : 1 - Math.exp(-13 * dt);
    this.angle += (target - this.angle) * k;

    this.vector = {
      x: Math.sin(this.angle),
      y: -Math.cos(this.angle),
    };
  }

  /** Get the fire trajectory. */
  getTrajectory() {
    if (this.power < CONFIG.SLINGSHOT_MIN_POWER) return null;
    return {
      angle: this.angle,
      power: this.power,
      vector: { ...this.vector },
      speed: CONFIG.ARROW_SPEED * (0.4 + 0.6 * (this.power / CONFIG.SLINGSHOT_MAX_POWER)),
    };
  }

  /** Draw the slingshot aim line on screen. */
  drawAimLine(ctx) {
    if (this.choiceMode || !this.isDragging || this.power < CONFIG.SLINGSHOT_MIN_POWER) return;

    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const ax = w * 0.5;
    const ay = h;
    const fireLen = 36 + this.power * 2.2;
    const tx = Math.sin(this.angle);
    const ty = -Math.cos(this.angle);

    ctx.strokeStyle = "rgba(232, 197, 106, 0.14)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(this.originX, this.originY);
    ctx.lineTo(this.dragX, this.dragY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(232, 197, 106, 0.78)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + tx * fireLen, ay + ty * fireLen);
    ctx.stroke();

    const dots = Math.floor(this.power / CONFIG.SLINGSHOT_MAX_POWER * 5) + 1;
    for (let i = 0; i < dots; i++) {
      const t = (i + 1) / (dots + 1);
      ctx.fillStyle = "rgba(232, 197, 106, 0.85)";
      ctx.beginPath();
      ctx.arc(ax + tx * fireLen * t, ay + ty * fireLen * t, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
