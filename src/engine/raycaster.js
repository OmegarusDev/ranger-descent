/**
 * Wolfenstein-style column renderer for the dungeon hall.
 * Occupancy, textures, and lights are keyed in world cell space so walking
 * does not snap the dungeon around the camera.
 */
const TEX = 64;
const FOG = [16, 12, 8];
const GRID_R = 40;
const FOV = 0.9;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeBrickTex() {
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2a2118";
  ctx.fillRect(0, 0, TEX, TEX);
  const courses = 8;
  const bricks = 4;
  const bh = TEX / courses;
  const bw = TEX / bricks;
  for (let row = 0; row < courses; row++) {
    const stagger = (row % 2) * 0.5;
    for (let col = -1; col < bricks; col++) {
      const x = (col + stagger) * bw;
      const y = row * bh;
      const k = hash(row * 19 + col * 7);
      const r = (92 + k * 38) | 0;
      const g = (68 + k * 22) | 0;
      const b = (42 + k * 10) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      ctx.fillStyle = "rgba(210,180,130,0.16)";
      ctx.fillRect(x + 1, y + 1, bw - 2, 1);
    }
  }
  return ctx.getImageData(0, 0, TEX, TEX).data;
}

function makeMossTex() {
  const data = new Uint8ClampedArray(TEX * TEX * 4);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const n = hash(x * 0.37 + y * 1.9) * 0.55
        + hash(x * 0.11 + y * 0.29) * 0.3
        + hash(x * 2.4 + y * 3.1) * 0.15;
      const clump = Math.max(0, n - 0.42) / 0.58;
      const i = (y * TEX + x) * 4;
      data[i] = 42 + clump * 28;
      data[i + 1] = 68 + clump * 52;
      data[i + 2] = 28 + clump * 18;
      data[i + 3] = (clump * clump * 255) | 0;
    }
  }
  return data;
}

let TEX_DATA = null;
let MOSS_DATA = null;

function sampleTex(u, v, shade) {
  const tx = Math.min(TEX - 1, ((((u % 1) + 1) % 1) * TEX) | 0);
  const ty = Math.min(TEX - 1, ((((v % 1) + 1) % 1) * TEX) | 0);
  const i = (ty * TEX + tx) * 4;
  return [
    TEX_DATA[i] * shade,
    TEX_DATA[i + 1] * shade,
    TEX_DATA[i + 2] * shade,
  ];
}

function sampleMoss(u, v) {
  const tx = Math.min(TEX - 1, ((((u % 1) + 1) % 1) * TEX) | 0);
  const ty = Math.min(TEX - 1, ((((v % 1) + 1) % 1) * TEX) | 0);
  const i = (ty * TEX + tx) * 4;
  return [
    MOSS_DATA[i],
    MOSS_DATA[i + 1],
    MOSS_DATA[i + 2],
    MOSS_DATA[i + 3] / 255,
  ];
}

function fogMix(rgb, dist, far) {
  const t = Math.max(0, Math.min(1, dist / far));
  const f = t * t;
  return [
    rgb[0] * (1 - f) + FOG[0] * f,
    rgb[1] * (1 - f) + FOG[1] * f,
    rgb[2] * (1 - f) + FOG[2] * f,
  ];
}

function blendMoss(rgb, worldGX, worldGZ, texU, texV) {
  const slot = hash(worldGX * 13.7 + worldGZ * 29.1 + 0.02);
  if (slot < 0.58) return rgb;
  const drip = Math.max(0, (texV - 0.38) / 0.62);
  const m = sampleMoss(texU * 1.7 + slot * 4.2, texV * 2.2 + worldGZ * 0.05);
  const amt = m[3] * drip * drip * (0.45 + slot * 0.7);
  if (amt < 0.12) return rgb;
  const k = Math.min(0.82, amt);
  return [
    rgb[0] * (1 - k) + m[0] * k,
    rgb[1] * (1 - k) + m[1] * k,
    rgb[2] * (1 - k) + m[2] * k,
  ];
}

export function updateRayBasis(view) {
  const yaw = view.lookYaw || 0;
  view._dirX = Math.sin(yaw);
  view._dirZ = Math.cos(yaw);
  view._planeX = view._dirZ * FOV;
  view._planeZ = -view._dirX * FOV;
}

function punch(grid, size, gx0, gx1, gz0, gz1) {
  const x0 = Math.max(0, gx0);
  const x1 = Math.min(size - 1, gx1);
  const z0 = Math.max(0, gz0);
  const z1 = Math.min(size - 1, gz1);
  for (let gz = z0; gz <= z1; gz++) {
    const row = gz * size;
    for (let gx = x0; gx <= x1; gx++) grid[row + gx] = 0;
  }
}

/** Inclusive world-cell span covering [center - half, center + half]. */
function spanCells(center, half, cell) {
  const lo = Math.floor((center - half) / cell);
  const hi = Math.ceil((center + half) / cell) - 1;
  return [lo, hi];
}

export function buildRayGrid(view) {
  const cell = view.cell;
  const half = view.half;
  const size = GRID_R * 2 + 1;
  const ogx = Math.floor(view.camX / cell) - GRID_R;
  const ogz = Math.floor(view.camZ / cell) - GRID_R;
  view._ogx = ogx;
  view._ogz = ogz;
  view._gSize = size;
  const grid = view._grid && view._grid.length === size * size
    ? view._grid
    : new Uint8Array(size * size);
  grid.fill(1);
  const lights = [];

  for (const hall of view._worldHalls || []) {
    if (hall.axis === "z") {
      const [wx0, wx1] = spanCells(hall.c, half, cell);
      const wz0 = Math.floor(hall.a / cell);
      const wz1 = Math.floor((hall.b - 1e-6) / cell);
      punch(grid, size, wx0 - ogx, wx1 - ogx, wz0 - ogz, wz1 - ogz);
      for (let s = hall.a + 80; s < hall.b - 20; s += 160) {
        const z = s / cell;
        lights.push({ x: wx0 + 0.22, z });
        lights.push({ x: wx1 + 0.78, z });
      }
    } else {
      const [wz0, wz1] = spanCells(hall.c, half, cell);
      const wx0 = Math.floor(hall.a / cell);
      const wx1 = Math.floor((hall.b - 1e-6) / cell);
      punch(grid, size, wx0 - ogx, wx1 - ogx, wz0 - ogz, wz1 - ogz);
      for (let s = hall.a + 80; s < hall.b - 20; s += 160) {
        const x = s / cell;
        lights.push({ x, z: wz0 + 0.22 });
        lights.push({ x, z: wz1 + 0.78 });
      }
    }
  }

  const camGX = Math.floor(view.camX / cell);
  const camGZ = Math.floor(view.camZ / cell);
  const lx = camGX - ogx;
  const lz = camGZ - ogz;
  if (lx >= 0 && lz >= 0 && lx < size && lz < size && grid[lz * size + lx]) {
    grid[lz * size + lx] = 0;
  }
  view._grid = grid;

  const light = view._light && view._light.length === size * size
    ? view._light
    : new Float32Array(size * size);
  light.fill(0.2);
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i];
    const ix = (L.x - ogx) | 0;
    const iz = (L.z - ogz) | 0;
    for (let dz = -4; dz <= 4; dz++) {
      const gz = iz + dz;
      if (gz < 0 || gz >= size) continue;
      const row = gz * size;
      for (let dx = -4; dx <= 4; dx++) {
        const gx = ix + dx;
        if (gx < 0 || gx >= size) continue;
        const d = Math.hypot(dx, dz);
        if (d > 3.6) continue;
        light[row + gx] += (1 - d / 3.6) * 0.52;
      }
    }
  }
  view._light = light;
  view._lights = lights;
}

function cellAtWorld(view, wx, wz) {
  const gx = wx - view._ogx;
  const gz = wz - view._ogz;
  const size = view._gSize;
  if (gx < 0 || gz < 0 || gx >= size || gz >= size) return 1;
  return view._grid[gz * size + gx];
}

function lightAtWorld(view, x, z) {
  const gx = (x - view._ogx) | 0;
  const gz = (z - view._ogz) | 0;
  const size = view._gSize;
  if (gx < 0 || gz < 0 || gx >= size || gz >= size) return 0.18;
  return Math.min(1.18, view._light[gz * size + gx]);
}

function ensureBuffer(view) {
  const maxW = 280;
  const scale = Math.min(1, maxW / Math.max(1, view.cssW));
  const w = Math.max(160, (view.cssW * scale) | 0);
  const h = Math.max(200, (view.cssH * scale) | 0);
  if (view._rayW === w && view._rayH === h && view._rayImg) return;
  view._rayW = w;
  view._rayH = h;
  if (!view._rayCanvas) view._rayCanvas = document.createElement("canvas");
  view._rayCanvas.width = w;
  view._rayCanvas.height = h;
  view._rayCtx = view._rayCanvas.getContext("2d", { alpha: false });
  view._rayImg = view._rayCtx.createImageData(w, h);
  view._zbuf = new Float32Array(w);
}

export function rayOccluded(view, screenX, distWorld) {
  if (!view._zbuf || !view._rayW) return false;
  const col = Math.max(0, Math.min(view._rayW - 1, ((screenX / Math.max(1, view.cssW)) * view._rayW) | 0));
  return distWorld / view.cell > view._zbuf[col] * 1.08;
}

export function paintRaycast(view, ctx) {
  if (!TEX_DATA) TEX_DATA = makeBrickTex();
  if (!MOSS_DATA) MOSS_DATA = makeMossTex();
  updateRayBasis(view);
  buildRayGrid(view);
  ensureBuffer(view);

  const w = view._rayW;
  const h = view._rayH;
  const data = view._rayImg.data;
  const zbuf = view._zbuf;
  const posX = view.camX / view.cell;
  const posZ = view.camZ / view.cell;
  const dirX = view._dirX;
  const dirZ = view._dirZ;
  const planeX = view._planeX;
  const planeZ = view._planeZ;
  const bob = (view.bob || 0) * h / Math.max(1, view.cssH);
  const horizon = (view.cy / Math.max(1, view.cssH)) * h + bob;
  const flicker = 0.9 + Math.sin((view.time || 0) * 6.4) * 0.08;

  for (let col = 0; col < w; col++) {
    const cameraX = 2 * col / w - 1;
    const rayX = dirX + planeX * cameraX;
    const rayZ = dirZ + planeZ * cameraX;
    let mapX = Math.floor(posX);
    let mapZ = Math.floor(posZ);
    const deltaX = Math.abs(1 / (rayX || 1e-8));
    const deltaZ = Math.abs(1 / (rayZ || 1e-8));
    const stepX = rayX < 0 ? -1 : 1;
    const stepZ = rayZ < 0 ? -1 : 1;
    let sideX = rayX < 0 ? (posX - mapX) * deltaX : (mapX + 1 - posX) * deltaX;
    let sideZ = rayZ < 0 ? (posZ - mapZ) * deltaZ : (mapZ + 1 - posZ) * deltaZ;
    let side = 0;
    let hits = 0;
    while (hits++ < 48) {
      if (sideX < sideZ) {
        sideX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideZ += deltaZ;
        mapZ += stepZ;
        side = 1;
      }
      if (cellAtWorld(view, mapX, mapZ)) break;
    }
    const dist = side === 0
      ? (mapX - posX + (1 - stepX) / 2) / rayX
      : (mapZ - posZ + (1 - stepZ) / 2) / rayZ;
    const perp = Math.max(0.08, dist);
    zbuf[col] = perp;
    const lineH = h / perp;
    let drawStart = (horizon - lineH * 0.5) | 0;
    let drawEnd = (horizon + lineH * 0.5) | 0;
    if (drawStart < 0) drawStart = 0;
    if (drawEnd >= h) drawEnd = h - 1;
    const wallU = side === 0 ? posZ + perp * rayZ : posX + perp * rayX;
    const texU = wallU - Math.floor(wallU);
    const hitX = posX + rayX * perp;
    const hitZ = posZ + rayZ * perp;
    const lit = (side ? 0.78 : 1) * lightAtWorld(view, hitX, hitZ) * flicker;
    const wallTop = horizon - lineH * 0.5;

    for (let y = 0; y < h; y++) {
      const i = (y * w + col) * 4;
      let rgb;
      if (y < drawStart) {
        const p = Math.max(1, horizon - y);
        const rowDist = (h * 0.5) / p;
        const fx = posX + rayX * rowDist;
        const fz = posZ + rayZ * rowDist;
        rgb = sampleTex(fx * 0.55, fz * 0.55, 0.4 * lightAtWorld(view, fx, fz) * flicker);
        rgb = fogMix(rgb, rowDist, 14);
      } else if (y > drawEnd) {
        const p = Math.max(1, y - horizon);
        const rowDist = (h * 0.5) / p;
        const fx = posX + rayX * rowDist;
        const fz = posZ + rayZ * rowDist;
        rgb = sampleTex(fx * 0.7, fz * 0.7, 0.7 * lightAtWorld(view, fx, fz) * flicker);
        rgb = fogMix(rgb, rowDist, 14);
      } else {
        const texV = (y - wallTop) / lineH;
        rgb = sampleTex(texU, texV, lit);
        rgb = blendMoss(rgb, mapX, mapZ, texU, texV);
        rgb = fogMix(rgb, perp, 18);
      }
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }

  view._rayCtx.putImageData(view._rayImg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (ctx.webkitImageSmoothingEnabled != null) ctx.webkitImageSmoothingEnabled = false;
  ctx.drawImage(view._rayCanvas, 0, 0, view.cssW, view.cssH);
}
