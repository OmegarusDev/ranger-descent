/**
 * Torches and clutter on carved floor near the camera. Positions come from
 * cell hashes, so they stay put while the camera moves.
 */
import { SPRITES, blitSprite } from "../pixelSprites.js?v=140";

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const TORCH_STEP = 4;

/** One torch every 4 cells, staggered across the two walls. */
function torchStation(along, side) {
  const phase = side === 0 ? 1 : 3;
  return ((along % TORCH_STEP) + TORCH_STEP) % TORCH_STEP === phase;
}

export function collectProps(world, camX, camZ) {
  const cell = world.cell;
  const cgx = Math.floor(camX / cell);
  const cgz = Math.floor(camZ / cell);
  const torches = [];
  const clutter = [];
  for (let gz = cgz - 10; gz <= cgz + 10; gz++) {
    for (let gx = cgx - 10; gx <= cgx + 10; gx++) {
      if (!world.isOpen(gx, gz)) continue;
      const wallL = !world.isOpen(gx - 1, gz);
      const wallR = !world.isOpen(gx + 1, gz);
      const wallU = !world.isOpen(gx, gz - 1);
      const wallD = !world.isOpen(gx, gz + 1);
      const walls = (wallL ? 1 : 0) + (wallR ? 1 : 0) + (wallU ? 1 : 0) + (wallD ? 1 : 0);
      if (walls !== 1) continue;
      const h = hash(gx * 13.1 + gz * 7.7);
      const wx = (gx + 0.5) * cell;
      const wz = (gz + 0.5) * cell;
      const along = (wallL || wallR) ? gz : gx;
      const side = (wallL || wallU) ? 0 : 1;
      if (torchStation(along, side)) {
        let x = wx;
        let z = wz;
        if (wallL) x -= cell * 0.28;
        else if (wallR) x += cell * 0.28;
        else if (wallU) z -= cell * 0.28;
        else z += cell * 0.28;
        torches.push({ x, z, n: (gx * 3 + gz) | 0 });
      } else if (clutter.length < 3 && h > 0.86) {
        const side = h > 0.93 ? 1 : -1;
        clutter.push({
          x: wx + (wallU || wallD ? side * 18 : 0),
          z: wz + (wallL || wallR ? side * 18 : 0),
          kind: h > 0.94 ? "barrel" : "crate",
          n: (gx + gz * 5) | 0,
        });
      }
    }
  }
  return { torches, clutter };
}

export function paintProps(view, ctx, props) {
  const cam = view.camera;
  for (const slot of props.clutter) {
    const p = cam.projectWorld(slot.x, slot.z, 0);
    if (p.behind || p.dist < 18 || p.dist > 680) continue;
    if (view.occluded(p.x, p.dist)) continue;
    const spr = slot.kind === "barrel" ? SPRITES.barrelA : SPRITES.crateA;
    blitSprite(ctx, spr, p.x, p.floorY, 22 * p.s, { alpha: 1 - fog(p.dist) * 0.45 });
  }
  for (const slot of props.torches) {
    const p = cam.projectWorld(slot.x, slot.z, 36);
    if (p.behind || p.dist < 22 || p.dist > 700) continue;
    if (view.occluded(p.x, p.dist)) continue;
    if (p.x < -30 || p.x > view.cssW + 30) continue;
    const frame = Math.sin(view.time * 6.2 + slot.n * 1.7) > 0 ? SPRITES.torch1 : SPRITES.torch0;
    blitSprite(ctx, frame, p.x, p.y, 18 * p.s, {
      alpha: 1 - fog(p.dist) * 0.55,
      flip: p.x > view.cx,
    });
    const r = Math.max(10, 46 * p.s);
    const g = ctx.createRadialGradient(p.x, p.floorY, 0, p.x, p.floorY, r);
    const flick = 0.7 + Math.sin(view.time * 6.2 + slot.n) * 0.18;
    g.addColorStop(0, `rgba(255, 150, 50, ${0.2 * flick})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, p.floorY, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function fog(dist) {
  const t = Math.max(0, Math.min(1, dist / 760));
  return t * t;
}
