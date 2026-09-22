/**
 * Column raycast over a persistent DungeonWorld. The grid is not rebuilt
 * from the camera; missing cells are stone.
 */
const TEX = 64;
const FOG = [16, 12, 8];
const FOV_FAR = 18;

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
      ctx.fillStyle = `rgb(${(92 + k * 38) | 0},${(68 + k * 22) | 0},${(42 + k * 10) | 0})`;
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
      const n = hash(x * 0.37 + y * 1.9) * 0.55 + hash(x * 0.11 + y * 0.29) * 0.3 + hash(x * 2.4 + y * 3.1) * 0.15;
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
  return [TEX_DATA[i] * shade, TEX_DATA[i + 1] * shade, TEX_DATA[i + 2] * shade];
}

function sampleMoss(u, v) {
  const tx = Math.min(TEX - 1, ((((u % 1) + 1) % 1) * TEX) | 0);
  const ty = Math.min(TEX - 1, ((((v % 1) + 1) % 1) * TEX) | 0);
  const i = (ty * TEX + tx) * 4;
  return [MOSS_DATA[i], MOSS_DATA[i + 1], MOSS_DATA[i + 2], MOSS_DATA[i + 3] / 255];
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

function lightAt(view, wx, wz) {
  let add = 0;
  const lights = view.lights || [];
  const radius = 280;
  for (let i = 0; i < lights.length; i++) {
    const d = Math.hypot(wx - lights[i].x, wz - lights[i].z);
    if (d >= radius) continue;
    const t = 1 - d / radius;
    add += t * t * 1.65;
  }
  return Math.min(1.55, 0.36 + add);
}

function solid(view, gx, gz) {
  return !(view.world && view.world.isOpen(gx, gz));
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
  ensureBuffer(view);

  const w = view._rayW;
  const h = view._rayH;
  const data = view._rayImg.data;
  const zbuf = view._zbuf;
  const cell = view.cell;
  const posX = view.camX / cell;
  const posZ = view.camZ / cell;
  const dirX = view.dirX;
  const dirZ = view.dirZ;
  const planeX = view.planeX;
  const planeZ = view.planeZ;
  const bob = (view.bob || 0) * h / Math.max(1, view.cssH);
  const horizon = (view.cy / Math.max(1, view.cssH)) * h + bob;
  const flicker = 0.9 + Math.sin((view.time || 0) * 6.4) * 0.08;
  const camGX = Math.floor(posX);
  const camGZ = Math.floor(posZ);

  for (let col = 0; col < w; col++) {
    const cameraX = (2 * col) / w - 1;
    const rayX = dirX + planeX * cameraX;
    const rayZ = dirZ + planeZ * cameraX;
    let mapX = camGX;
    let mapZ = camGZ;
    const deltaX = Math.abs(1 / (rayX || 1e-8));
    const deltaZ = Math.abs(1 / (rayZ || 1e-8));
    const stepX = rayX < 0 ? -1 : 1;
    const stepZ = rayZ < 0 ? -1 : 1;
    let sideX = rayX < 0 ? (posX - mapX) * deltaX : (mapX + 1 - posX) * deltaX;
    let sideZ = rayZ < 0 ? (posZ - mapZ) * deltaZ : (mapZ + 1 - posZ) * deltaZ;
    let side = 0;
    let hits = 0;
    while (hits++ < 64) {
      if (sideX < sideZ) {
        sideX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideZ += deltaZ;
        mapZ += stepZ;
        side = 1;
      }
      if (solid(view, mapX, mapZ)) break;
    }
    const dist = side === 0
      ? (mapX - posX + (1 - stepX) / 2) / (rayX || 1e-8)
      : (mapZ - posZ + (1 - stepZ) / 2) / (rayZ || 1e-8);
    const perp = Math.max(0.08, dist);
    zbuf[col] = perp;
    const lineH = h / perp;
    let drawStart = (horizon - lineH * 0.5) | 0;
    let drawEnd = (horizon + lineH * 0.5) | 0;
    if (drawStart < 0) drawStart = 0;
    if (drawEnd >= h) drawEnd = h - 1;
    const wallU = side === 0 ? posZ + perp * rayZ : posX + perp * rayX;
    const texU = wallU - Math.floor(wallU);
    const hitX = (posX + rayX * perp) * cell;
    const hitZ = (posZ + rayZ * perp) * cell;
    const lit = (side ? 0.78 : 1) * lightAt(view, hitX, hitZ) * flicker;
    const wallTop = horizon - lineH * 0.5;

    for (let y = 0; y < h; y++) {
      const i = (y * w + col) * 4;
      let rgb;
      if (y < drawStart) {
        const p = Math.max(1, horizon - y);
        const rowDist = (h * 0.5) / p;
        const fx = (posX + rayX * rowDist) * cell;
        const fz = (posZ + rayZ * rowDist) * cell;
        rgb = sampleTex(fx * 0.014, fz * 0.014, 0.5 * lightAt(view, fx, fz) * flicker);
        rgb = fogMix(rgb, rowDist, 14);
      } else if (y > drawEnd) {
        const p = Math.max(1, y - horizon);
        const rowDist = (h * 0.5) / p;
        const fx = (posX + rayX * rowDist) * cell;
        const fz = (posZ + rayZ * rowDist) * cell;
        rgb = sampleTex(fx * 0.018, fz * 0.018, 0.85 * lightAt(view, fx, fz) * flicker);
        rgb = fogMix(rgb, rowDist, 14);
      } else {
        const texV = (y - wallTop) / lineH;
        rgb = sampleTex(texU, texV, lit);
        rgb = blendMoss(rgb, mapX, mapZ, texU, texV);
        rgb = fogMix(rgb, perp, FOV_FAR);
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
