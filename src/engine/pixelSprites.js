/**
 * Low-res gameplay sprites for the raycaster hall.
 * Nearest-neighbour blit — same language as the brick columns, not vector overlays.
 */

const C = {
  out: "#1a1008",
  woodD: "#3a2414",
  wood: "#6b4424",
  woodL: "#8a5a30",
  band: "#2a1810",
  gold: "#c9a227",
  goldD: "#8a6818",
  string: "#e8d8b0",
  shaft: "#d4c4a0",
  grip: "#4a2a12",
  wrap: "#6b3418",
  rust: "#8a4a28",
  flame: "#ffb45a",
  flameL: "#ffe8b0",
  flameD: "#e07030",
  web: "#c8c0b0",
  webD: "#8a8278",
  iron: "#3a3228",
  ironL: "#5a5248",
  urn: "#4a3a30",
  urnL: "#6a5a48",
  crate: "#7a5330",
  crateL: "#8a5a32",
};

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function px(ctx, x, y, w, h, col) {
  if (!col) return;
  ctx.fillStyle = col;
  ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
}

function fromRows(rows, pal) {
  const h = rows.length;
  const w = rows[0].length;
  const { c, ctx } = canvas(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const col = pal[row[x]];
      if (col) px(ctx, x, y, 1, 1, col);
    }
  }
  return c;
}

const BARREL_A = fromRows([
  "..oooooooooo..",
  ".oWWwwwwwwWWo.",
  ".oWWWWWWWWWWo.",
  ".obbbbbbbbbbo.",
  ".oWWwwwwwwWWo.",
  ".oWWWWWWWWWWo.",
  ".owwwWWWWWWwo.",
  ".obbbbbbbbbbo.",
  ".owwwwwwwwwwo.",
  ".oWWWWWWWWWWo.",
  ".oWWwwwwwwWWo.",
  ".obbbbbbbbbbo.",
  ".odwwwwwwwddo.",
  ".oddddddddddo.",
  "..oooooooooo..",
  "...ssssssss...",
], {
  ".": null,
  o: C.out,
  W: C.woodL,
  w: C.wood,
  d: C.woodD,
  b: C.band,
  s: "#000000",
});

const BARREL_B = fromRows([
  "..oooooooooo..",
  ".odwwwwwwwwdo.",
  ".odWWWWWWWWdo.",
  ".obbbbbbbbbbo.",
  ".odwwwwwwwwdo.",
  ".oWWWWWWWWWWo.",
  ".owwwwwwwwwwo.",
  ".obbbbbbbbbbo.",
  ".owwWWWWWWwwo.",
  ".odWWWWWWWWdo.",
  ".odwwwwwwwwdo.",
  ".obbbbbbbbbbo.",
  ".oddddddddddo.",
  ".oddddddddddo.",
  "..oooooooooo..",
  "...ssssssss...",
], {
  ".": null,
  o: C.out,
  W: C.woodL,
  w: C.wood,
  d: C.woodD,
  b: C.band,
  s: "#000000",
});

const CRATE_A = fromRows([
  "oooooooooooooo",
  "oCCCcccCCCCCCo",
  "oC/......c..Co",
  "oCc......C./Co",
  "oC...cc...C.Co",
  "oC../CC...c.Co",
  "oCc.C..c....Co",
  "oC.C....C...Co",
  "oC......cC..Co",
  "oC....../CC.Co",
  "oCcccccccCCCCo",
  "oooooooooooooo",
  "..ssssssssss..",
], {
  ".": C.crate,
  o: C.out,
  C: C.crateL,
  c: C.woodD,
  "/": C.wood,
  s: "#000000",
});

const CRATE_B = fromRows([
  "oooooooooooooo",
  "occccccCCCCCCo",
  "oc........C.Co",
  "oC...//...c.Co",
  "oC../CC...C.Co",
  "oc.C....c...Co",
  "oC......C...Co",
  "oC....c..C..Co",
  "oCc....../C.Co",
  "oCCCCCCCCCCCCo",
  "oooooooooooooo",
  "..ssssssssss..",
], {
  ".": C.crate,
  o: C.out,
  C: C.crateL,
  c: C.woodD,
  "/": C.wood,
  s: "#000000",
});

const URN = fromRows([
  "...oooooo...",
  "..oLLLLLLo..",
  "..oLuuuuLo..",
  "...ouuuuo...",
  "..oUUUUUUo..",
  ".oUUuuuuUUo.",
  ".oUuuuuuuUo.",
  ".oUuuuUUuUo.",
  ".oUUuuuuUUo.",
  "..oUUUUUUo..",
  "...oddddo...",
  "....ssss....",
], {
  ".": null,
  o: C.out,
  L: C.urnL,
  u: C.urn,
  U: "#5a4a3c",
  d: C.woodD,
  s: "#000000",
});

function makeCobweb() {
  const { c, ctx } = canvas(32, 32);
  const plot = (x, y, col) => {
    if (x < 0 || y < 0 || x > 31 || y > 31) return;
    px(ctx, x, y, 1, 1, col);
  };
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 0.5;
    const x1 = Math.cos(a) * 30;
    const y1 = Math.sin(a) * 30;
    const steps = 30;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (((s + i) & 3) === 0) continue;
      plot((x1 * t + 0.4) | 0, (y1 * t + 0.4) | 0, s % 5 === 0 ? C.web : C.webD);
    }
  }
  for (let r = 6; r <= 26; r += 5) {
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 0.5;
      plot((Math.cos(a) * r + 0.4) | 0, (Math.sin(a) * r + 0.4) | 0, C.web);
    }
  }
  plot(1, 1, C.web);
  plot(2, 1, C.webD);
  plot(1, 2, C.webD);
  return c;
}

const COBWEB = makeCobweb();

const CHAIN = fromRows([
  ".ii.",
  "iIIi",
  "i..i",
  "iIIi",
  ".ii.",
  ".ii.",
  "iIIi",
  "i..i",
  "iIIi",
  ".ii.",
  ".ii.",
  "iIIi",
  "i..i",
  "iIIi",
  ".ii.",
  ".dd.",
], {
  ".": null,
  i: C.iron,
  I: C.ironL,
  d: C.out,
});

function makeTorch(frame) {
  const rows = frame
    ? [
      "...yy...",
      "..yYFy..",
      "..YFFy..",
      ".yFFRy..",
      "..FRR...",
      "...oo...",
      "...gg...",
      "...oo...",
      "...gg...",
      "...oo...",
      "...dd...",
    ]
    : [
      "....y...",
      "...yYy..",
      "..yYFFy.",
      "..YFFry.",
      "...FRr..",
      "...oo...",
      "...gg...",
      "...oo...",
      "...gg...",
      "...oo...",
      "...dd...",
    ];
  return fromRows(rows, {
    ".": null,
    y: C.flameL,
    Y: C.flame,
    F: C.flameD,
    R: C.rust,
    r: "#c04020",
    o: C.out,
    g: C.gold,
    d: C.woodD,
  });
}

const TORCH_0 = makeTorch(0);
const TORCH_1 = makeTorch(1);

let bowBuf = null;
let bowCtx = null;
const BOW_W = 128;
const BOW_H = 102;
const BOW_CX = 64;
/** Riser / arrow rest — blit pins this row to the hands. */
const GRIP_Y = 44;
const REST_SPAN = 48;
const DRAW_IN = 12;
const REST_CURVE = 8;
const DRAW_CURVE = 9;
const TIP_KICK = 3;
const GRIP_H = 9;
const ARROW_LEN = 40;
const REST_NOCK = GRIP_Y + REST_CURVE - TIP_KICK + 3;

function ensureBow() {
  if (bowBuf && bowBuf.width === BOW_W && bowBuf.height === BOW_H) return;
  const b = canvas(BOW_W, BOW_H);
  bowBuf = b.c;
  bowCtx = b.ctx;
}

function shadeHex(hex, f) {
  const raw = String(hex || "#c4a574").replace("#", "");
  const n = raw.length === 3
    ? raw.split("").map((ch) => parseInt(ch + ch, 16))
    : [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  if (n.some((v) => Number.isNaN(v))) return "#c4a574";
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n[0])},${c(n[1])},${c(n[2])})`;
}

function arrowPal(type, color) {
  const hex = color || "#c4a574";
  const pal = {
    shaft: hex,
    shaftD: shadeHex(hex, 0.62),
    head: shadeHex(hex, 1.18),
    headD: shadeHex(hex, 0.72),
    fletch: shadeHex(hex, 1.28),
    fletchD: shadeHex(hex, 0.7),
  };
  if (type === "fire") {
    pal.head = C.flameD;
    pal.headD = "#a02810";
    pal.fletch = C.flame;
  } else if (type === "ice") {
    pal.head = "#d8f0ff";
    pal.headD = "#6aa0c8";
    pal.fletch = "#b8e0f0";
  } else if (type === "poison") {
    pal.head = "#c070e0";
    pal.headD = "#5a2080";
  } else if (type === "shock") {
    pal.head = "#f0e878";
    pal.headD = "#7ec8e0";
  } else if (type === "silver" || type === "steel" || type === "iron") {
    pal.head = "#e8eef4";
    pal.headD = "#8a949c";
  }
  return pal;
}

/** Recurve from the archer: belly and string toward you, back toward the hall. */
function limbPoint(s, pull) {
  const p = Math.max(0, Math.min(1, pull || 0));
  const span = REST_SPAN - DRAW_IN * p;
  const curve = REST_CURVE + DRAW_CURVE * p;
  const x = BOW_CX + s * span;
  const y = GRIP_Y + curve * (s * s) - TIP_KICK * Math.pow(Math.abs(s), 4);
  return { x, y, span };
}

function restHalfString() {
  const tip = limbPoint(-1, 0);
  return Math.hypot(REST_SPAN, REST_NOCK - tip.y);
}

function nockYFor(pull) {
  const tip = limbPoint(-1, pull);
  const depth = Math.sqrt(Math.max(0, restHalfString() ** 2 - tip.span * tip.span));
  return tip.y + depth;
}

function bowDot(x, y, col) {
  if (x < 0 || y < 0 || x >= BOW_W || y >= BOW_H) return;
  px(bowCtx, x, y, 1, 1, col);
}

function bowLine(x0, y0, x1, y1, col) {
  let dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    bowDot(x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function paintNockedArrow(ax, nockY, pal, type) {
  const headY = Math.round(nockY - ARROW_LEN);
  const nock = Math.round(nockY);
  for (let y = headY + 5; y <= nock; y++) {
    const t = (y - headY) / Math.max(1, nock - headY);
    bowDot(ax, y, pal.shaft);
    if (t > 0.18) bowDot(ax + 1, y, pal.shaftD);
    if (t > 0.55) bowDot(ax - 1, y, pal.shaft);
  }
  bowDot(ax, headY, pal.head);
  bowDot(ax, headY + 1, pal.head);
  bowDot(ax - 1, headY + 1, pal.head);
  bowDot(ax + 1, headY + 1, pal.head);
  bowDot(ax, headY + 2, pal.head);
  bowDot(ax - 1, headY + 2, pal.head);
  bowDot(ax + 1, headY + 2, pal.head);
  bowDot(ax - 2, headY + 3, pal.headD);
  bowDot(ax + 2, headY + 3, pal.headD);
  bowDot(ax, headY + 3, pal.head);
  bowDot(ax - 1, headY + 3, pal.headD);
  bowDot(ax + 1, headY + 3, pal.headD);
  bowDot(ax, headY + 4, pal.headD);
  if (type === "barbed" || type === "piercing") {
    bowDot(ax - 3, headY + 4, pal.headD);
    bowDot(ax + 3, headY + 4, pal.headD);
  }
  if (type === "flint") {
    bowDot(ax, headY, pal.headD);
    bowDot(ax - 1, headY + 2, pal.headD);
    bowDot(ax + 1, headY + 2, pal.headD);
  }
  bowDot(ax - 3, nock - 3, pal.fletch);
  bowDot(ax - 2, nock - 2, pal.fletch);
  bowDot(ax - 1, nock - 1, pal.fletch);
  bowDot(ax + 3, nock - 3, pal.fletch);
  bowDot(ax + 2, nock - 2, pal.fletch);
  bowDot(ax + 1, nock - 1, pal.fletch);
  bowDot(ax - 3, nock - 1, pal.fletchD);
  bowDot(ax + 3, nock - 1, pal.fletchD);
  bowDot(ax - 2, nock, pal.fletchD);
  bowDot(ax + 2, nock, pal.fletchD);
}

function stampLimb(x, y, radius) {
  const R = Math.max(1, Math.round(radius));
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      let col = C.wood;
      if (dy <= -R + 1) col = C.woodL;
      else if (dy >= R - 1 && Math.abs(dx) <= 1) col = C.out;
      else if ((dx + dy) % 4 === 0) col = C.woodD;
      bowDot(cx + dx, cy + dy, col);
    }
  }
}

function paintStave(pull) {
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps * 2 - 1;
    const pt = limbPoint(s, pull);
    const rad = 2.9 - 1.2 * Math.abs(s);
    stampLimb(pt.x, pt.y, rad);
  }
  const tipL = limbPoint(-1, pull);
  const tipR = limbPoint(1, pull);
  for (const tip of [tipL, tipR]) {
    const tx = Math.round(tip.x);
    const ty = Math.round(tip.y);
    bowDot(tx, ty, C.gold);
    bowDot(tx - 1, ty, C.gold);
    bowDot(tx + 1, ty, C.gold);
    bowDot(tx, ty - 1, C.gold);
    bowDot(tx, ty + 1, C.goldD);
  }
}

function paintGrip() {
  for (let x = BOW_CX - 3; x <= BOW_CX + 3; x++) {
    for (let k = 0; k < GRIP_H; k++) {
      let col = C.wrap;
      if (x === BOW_CX - 3 || x === BOW_CX + 3 || k === 0 || k === GRIP_H - 1) col = C.out;
      else if (k === 1) col = C.woodL;
      else if ((x + k) % 3 === 0) col = C.grip;
      bowDot(x, GRIP_Y + k - 2, col);
    }
  }
}

/** First-person hunting bow aimed down the hall. pull is 0..1. */
export function getBowSprite(pull, type, color) {
  ensureBow();
  bowCtx.clearRect(0, 0, BOW_W, BOW_H);
  const p = Math.max(0, Math.min(1, pull || 0));
  const tipL = limbPoint(-1, p);
  const tipR = limbPoint(1, p);
  const nockY = Math.round(nockYFor(p));

  paintStave(p);
  paintGrip();

  const xL = Math.round(tipL.x);
  const yL = Math.round(tipL.y);
  const xR = Math.round(tipR.x);
  const yR = Math.round(tipR.y);
  bowLine(xL, yL, BOW_CX, nockY, C.string);
  bowLine(xR, yR, BOW_CX, nockY, C.string);
  bowLine(xL, yL + 1, BOW_CX, nockY + 1, C.string);
  bowLine(xR, yR + 1, BOW_CX, nockY + 1, C.string);
  bowDot(BOW_CX, nockY, C.gold);
  bowDot(BOW_CX, nockY + 1, C.goldD);

  if (type) {
    const pal = arrowPal(type, color);
    if (type === "double") {
      paintNockedArrow(BOW_CX - 3, nockY, pal, type);
      paintNockedArrow(BOW_CX + 2, nockY, pal, type);
    } else {
      paintNockedArrow(BOW_CX, nockY, pal, type);
    }
  }

  return bowBuf;
}

export function blitSprite(ctx, img, x, y, destH, { alpha = 1, flip = false, anchor = "foot" } = {}) {
  if (!img || destH < 2) return;
  destH = Math.max(2, Math.round(destH));
  const destW = destH * (img.width / img.height);
  let dx = x;
  let dy = y;
  if (anchor === "foot") {
    dx = x - destW / 2;
    dy = y - destH;
  } else if (anchor === "top") {
    dx = x - destW / 2;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  if (ctx.webkitImageSmoothingEnabled != null) ctx.webkitImageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(dx + destW, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, destW, destH);
  } else {
    ctx.drawImage(img, dx, dy, destW, destH);
  }
  ctx.restore();
}

/** Screen Y of the grip — lower hall, above quiver / DRAW chrome. */
export function bowGripScreenY(cssH, scale = 3) {
  const hudClear = 108;
  const below = (BOW_H - GRIP_Y) * Math.max(1, scale);
  const above = GRIP_Y * Math.max(1, scale);
  let y = cssH * 0.74;
  y = Math.min(y, cssH - hudClear);
  y = Math.min(y, cssH - below - 6);
  return Math.max(above + 8, y);
}

export function blitBow(ctx, cssW, cssH, pull, opts = {}) {
  const img = getBowSprite(pull, opts.type, opts.color);
  let scale = Math.min(cssW * 0.95 / img.width, cssH * 0.46 / img.height);
  scale = Math.max(2, Math.round(scale));
  while (img.width * scale > cssW && scale > 2) scale -= 1;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const tilt = (opts.tilt || 0) + (opts.jolt || 0);
  const gripScreenY = bowGripScreenY(cssH, scale);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (ctx.webkitImageSmoothingEnabled != null) ctx.webkitImageSmoothingEnabled = false;
  ctx.translate(cssW * 0.5, gripScreenY);
  if (tilt) ctx.rotate(tilt);
  ctx.drawImage(img, -dw / 2, -GRIP_Y * scale, dw, dh);
  ctx.restore();
}

export const SPRITES = {
  barrelA: BARREL_A,
  barrelB: BARREL_B,
  crateA: CRATE_A,
  crateB: CRATE_B,
  urn: URN,
  cobweb: COBWEB,
  chain: CHAIN,
  torch0: TORCH_0,
  torch1: TORCH_1,
};
