/**
 * Persistent dungeon occupancy. Cells are carved when a hall, mouth, or
 * chosen turn exists — never rebuilt from the camera.
 */
import { CONFIG } from "../../data/config.js";

const CELL = CONFIG.CELL_SIZE || 40;
const HALF = ((CONFIG.CORRIDOR_WIDTH || 5) * CELL) / 2;
const HALL = CONFIG.HALL_LENGTH || 560;
const BACK = 120;

function dir(deg) {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), z: Math.cos(r) };
}

function add(a, b, scale) {
  return { x: a.x + b.x * scale, z: a.z + b.z * scale };
}

export function localToWorld(ox, oz, yaw, lat, along) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: ox + lat * c + along * s, z: oz - lat * s + along * c };
}

/** World XZ for a corridor-local body. A corner pins it to the fork, not the camera. */
export function placeBody(frame, body) {
  const lat = body.x || 0;
  const corner = frame && frame.corner;
  if (corner && (corner.chosen === "left" || corner.chosen === "right")) {
    const deg = (corner.oldHeading || 0) + (corner.chosen === "left" ? -90 : 90);
    const worldZ = body.worldZ != null ? body.worldZ : (frame.playerZ || 0) + (body.dist || 0);
    const along = worldZ - (frame.seg0 || 0);
    return localToWorld(corner.forkX, corner.forkZ, (deg * Math.PI) / 180, lat, along);
  }
  const yaw = frame && frame.heading != null ? frame.heading : (frame && frame.lookYaw) || 0;
  const along = body.dist != null ? body.dist : (body.worldZ || 0) - ((frame && frame.playerZ) || 0);
  return localToWorld(frame.camX || 0, frame.camZ || 0, yaw, lat, along);
}

export class DungeonWorld {
  constructor() {
    this.cell = CELL;
    this.half = HALF;
    this.hallLen = HALL;
    this.open = new Set();
    this._done = new Set();
  }

  isOpen(gx, gz) {
    return this.open.has(`${gx},${gz}`);
  }

  isOpenAt(x, z) {
    return this.isOpen(Math.floor(x / this.cell), Math.floor(z / this.cell));
  }

  sync(frame) {
    if (!frame) return;
    if (frame.corner) {
      this._carveCorner(frame.corner);
      return;
    }
    this._carveShaft(frame);
  }

  _span(center) {
    const lo = Math.floor((center - this.half) / this.cell);
    const hi = Math.ceil((center + this.half) / this.cell) - 1;
    return [lo, hi];
  }

  _fill(gx0, gx1, gz0, gz1) {
    const x0 = Math.min(gx0, gx1);
    const x1 = Math.max(gx0, gx1);
    const z0 = Math.min(gz0, gz1);
    const z1 = Math.max(gz0, gz1);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) this.open.add(`${x},${z}`);
    }
  }

  _punch(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    if (Math.hypot(dx, dz) < 8) return;
    if (Math.abs(dx) >= Math.abs(dz)) {
      const [gz0, gz1] = this._span((z0 + z1) * 0.5);
      const gx0 = Math.floor(Math.min(x0, x1) / this.cell);
      const gx1 = Math.floor((Math.max(x0, x1) - 1e-6) / this.cell);
      this._fill(gx0, gx1, gz0, gz1);
    } else {
      const [gx0, gx1] = this._span((x0 + x1) * 0.5);
      const gz0 = Math.floor(Math.min(z0, z1) / this.cell);
      const gz1 = Math.floor((Math.max(z0, z1) - 1e-6) / this.cell);
      this._fill(gx0, gx1, gz0, gz1);
    }
  }

  _carveShaft(frame) {
    const id = `seg:${frame.segmentIndex || 0}`;
    if (this._done.has(id)) return;
    this._done.add(id);
    const yaw = frame.heading || 0;
    const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const cam = { x: frame.camX || 0, z: frame.camZ || 0 };
    const far = Math.max(40, Number.isFinite(frame.ahead) ? frame.ahead : this.hallLen);
    const back = (frame.along || 0) + BACK;
    const a = add(cam, fwd, -back);
    const fork = add(cam, fwd, far);
    this._punch(a.x, a.z, fork.x, fork.z);
    const deg = (yaw * 180) / Math.PI;
    const elevator = !!(frame.junction && frame.junction.elevator);
    this._carveThreeWay(fork, deg, `seg:${frame.segmentIndex || 0}`, elevator);
  }

  /**
   * A corridor always ends in the same 3-way: left, right, and forward.
   * Those arms are full halls, and each of them ends in another 3-way,
   * so the junction is already there before you step into the corridor.
   */
  _carveThreeWay(fork, deg, rootId, elevator = false) {
    const id = `${rootId}:way:${fork.x | 0}:${fork.z | 0}`;
    if (this._done.has(id)) return;
    this._done.add(id);
    const arms = elevator
      ? [{ deg, dir: dir(deg) }]
      : [
          { deg: deg - 90, dir: dir(deg - 90) },
          { deg: deg + 90, dir: dir(deg + 90) },
          { deg, dir: dir(deg) },
        ];
    for (const arm of arms) {
      const tip = add(fork, arm.dir, this.hallLen);
      this._punch(fork.x, fork.z, tip.x, tip.z);
      this._carveWayEnd(tip, arm.deg, `${id}:${arm.deg}`);
    }
  }

  /** Far end of an arm: the same three openings, deep enough that the end is not a brick cap. */
  _carveWayEnd(fork, deg, id) {
    if (this._done.has(id)) return;
    this._done.add(id);
    for (const turn of [deg - 90, deg + 90, deg]) {
      const d = dir(turn);
      const tip = add(fork, d, this.hallLen);
      this._punch(fork.x, fork.z, tip.x, tip.z);
    }
  }

  _carveCorner(corner) {
    const id = `corner:${corner.forkX | 0}:${corner.forkZ | 0}:${corner.chosen || "fwd"}`;
    if (this._done.has(id)) return;
    this._done.add(id);
    const old = corner.oldHeading || 0;
    const fwd = dir(old);
    const fork = { x: corner.forkX, z: corner.forkZ };
    const origin = {
      x: Number.isFinite(corner.originX) ? corner.originX : fork.x - fwd.x * 120,
      z: Number.isFinite(corner.originZ) ? corner.originZ : fork.z - fwd.z * 120,
    };
    const tail = add(origin, fwd, -BACK);
    this._punch(tail.x, tail.z, fork.x, fork.z);
    this._carveThreeWay(fork, old, id, false);
  }
}
