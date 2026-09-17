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
