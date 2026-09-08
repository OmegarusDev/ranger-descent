/**
 * InputHandler — slingshot drag-and-release.
 *
 * Simple: the drag vector in screen space directly becomes the arrow
 * velocity in world space. No camera unprojection needed.
 *   - Drag left/right → arrow lateral velocity
 *   - Drag down → arrow forward (toward enemies, +dist)
 *   - Drag up → arrow backward (away from enemies)
 *   - Power = drag distance
 */
import { CONFIG } from "../data/config.js?v=29";

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

    this._bindEvents();
  }

  reset() {
    this.isDragging = false;
    this.active = false;
    this._pointerId = null;
    this.power = 0;
    this.vector = { x: 0, y: 0 };
    this._suppressClick = false;
    this.choiceMode = false;
  }

  _bindEvents() {
    this.canvas.addEventListener("pointerdown", (e) => this._onDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onMove(e));
    this.canvas.addEventListener("pointerup", (e) => this._onUp(e));
    this.canvas.addEventListener("pointercancel", (e) => this._onUp(e));
    this.canvas.addEventListener("click", (e) => {
      if (this._suppressClick) {
        this._suppressClick = false;
        return;
      }
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
    if (e.pointerType === "mouse" && performance.now() < this._ignoreMouseUntil) return;
    if (!this.choiceMode && performance.now() < this.blockUntil) return;
    const { x, y } = this._toCanvas(e);
    this._pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}
    this.originX = x;
    this.originY = y;
    this.dragX = x;
    this.dragY = y;
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

  _onUp(e) {
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
      if (performance.now() >= this.blockUntil) {
        if (this.power >= 1 && this.onDragEnd) {
          this.onDragEnd(this.angle, this.power, { ...this.vector });
        } else if (this.onTap) {
          this.onTap(this.originX, this.originY);
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
      return;
    }

    this.power = Math.min(CONFIG.SLINGSHOT_MAX_POWER,
      (dist / this.maxPull) * CONFIG.SLINGSHOT_MAX_POWER);

    if (dist < 4) {
      this.power = 0;
      this.vector = { x: 0, y: 0 };
      this.angle = 0;
      return;
    }

    this.angle = Math.atan2(dy, dx);

    this.vector = {
      x: dx / dist,
      y: dy / dist,
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

    const fireAngle = Math.atan2(
      this.originY - this.dragY,
      this.originX - this.dragX
    );
    const fireLen = 30 + this.power * 2.5;

    // Dashed pull line
    ctx.strokeStyle = "rgba(232, 197, 106, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.originX, this.originY);
    ctx.lineTo(this.dragX, this.dragY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fire direction line
    ctx.strokeStyle = "rgba(232, 197, 106, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.originX, this.originY);
    ctx.lineTo(
      this.originX + Math.cos(fireAngle) * fireLen,
      this.originY + Math.sin(fireAngle) * fireLen
    );
    ctx.stroke();

    // Power dots
    const dots = Math.floor(this.power / CONFIG.SLINGSHOT_MAX_POWER * 5) + 1;
    for (let i = 0; i < dots; i++) {
      const t = (i + 1) / (dots + 1);
      ctx.fillStyle = "rgba(232, 197, 106, 0.8)";
      ctx.beginPath();
      ctx.arc(
        this.originX + Math.cos(fireAngle) * fireLen * t,
        this.originY + Math.sin(fireAngle) * fireLen * t,
        2.5, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}
