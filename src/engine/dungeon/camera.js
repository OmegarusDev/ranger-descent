/**
 * One camera. Walls and sprites share this yaw.
 */
const FOV = 0.9;
const NEAR = 6;

export class DungeonCamera {
  constructor() {
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.cssW = 400;
    this.cssH = 720;
    this.cx = 200;
    this.cy = 300;
    this.bob = 0;
    this.sway = 0;
    this.cell = 40;
    this.ceilH = 78;
    this.dirX = 0;
    this.dirZ = 1;
    this.planeX = FOV;
    this.planeZ = 0;
  }

  resize(cssW, cssH) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.cx = cssW * 0.5;
    const portrait = cssW / Math.max(1, cssH) < 0.85;
    this.cy = cssH * (portrait ? 0.4 : 0.42);
  }

  setYaw(yaw) {
    this.yaw = yaw || 0;
    this.dirX = Math.sin(this.yaw);
    this.dirZ = Math.cos(this.yaw);
    this.planeX = this.dirZ * FOV;
    this.planeZ = -this.dirX * FOV;
  }

  /** World XZ + height. `dist` is along the view axis, in world units. */
  projectWorld(wx, wz, worldY = 18, occluded = false) {
    const dx = wx - this.x;
    const dz = wz - this.z;
    const invDet = 1 / (this.planeX * this.dirZ - this.dirX * this.planeZ || 1e-8);
    const transformX = invDet * (this.dirZ * dx - this.dirX * dz);
    const transformY = invDet * (-this.planeZ * dx + this.planeX * dz);
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
      occluded: !!occluded && !behind,
      v: 1 - Math.min(1, d / 760),
    };
  }
}
