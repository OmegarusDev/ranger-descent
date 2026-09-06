/**
 * 2.5D rendering primitives — pitch-linked canvas geometry for corridor
 * game entities. All functions take (ctx, cam, ...) and draw through the
 * shared CorridorCamera. No game logic.
 *
 * Adapted from Tower Defense prims25.js.
 */
import { CAMERA, deckRy } from "./corridorCamera.js";
import { shade, withAlpha, fillPoly } from "./drawUtil.js";

/** Pitch-linked vertical measure — footprint radii stay unscaled. */
export function vz(s, k) {
  return s * k * CAMERA.vExag;
}

/**
 * Draw a 2.5D cylinder (base pad + side + top cap).
 * @param {CanvasRenderingContext2D} ctx
 * @param {CorridorCamera} cam
 * @param {number} cx - screen X center
 * @param {number} topY - screen Y of top face
 * @param {number} rx - horizontal radius
 * @param {number} rise - vertical extrusion (screen px, pre-vExag)
 * @param {string} topCol
 * @param {string} sideCol
 * @param {string} bottomCol
 */
export function cyl25(ctx, cx, topY, rx, rise, topCol, sideCol, bottomCol, opts = {}) {
  const ry = deckRy(rx);
  const bottomY = topY + rise;
  const rimCol = bottomCol || shade(sideCol, -0.15);

  ctx.fillStyle = sideCol;
  ctx.fillRect(cx - rx, topY, rx * 2, Math.max(1, rise));

  ctx.beginPath();
  ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rimCol;
  ctx.beginPath();
  ctx.ellipse(cx, bottomY, rx, ry, 0, 0.15, Math.PI - 0.15);
  ctx.fill();

  if (opts.roundedBottom) {
    ctx.fillStyle = sideCol;
    ctx.beginPath();
    ctx.ellipse(cx, bottomY, rx, ry, 0, Math.PI, 0, true);
    ctx.fill();
  }

  ctx.fillStyle = topCol;
  ctx.beginPath();
  ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#fff8e0", 0.18);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.ellipse(
    cx - rx * 0.12, topY - ry * 0.08,
    rx * 0.72, ry * 0.55,
    -0.35, Math.PI * 1.15, Math.PI * 1.85
  );
  ctx.stroke();
}

/**
 * Draw a 2.5D box (extruded rectangular prism).
 * w = width, d = depth (into corridor), h = vertical height.
 */
export function box25(ctx, cx, topY, w, d, h, m) {
  const hw = w / 2;
  const hd = d / 2;
  const skew = d * CAMERA.boxSkew;
  const tl = { x: cx - hw + skew * 0.2, y: topY - hd * 0.35 };
  const tr = { x: cx + hw + skew * 0.2, y: topY - hd * 0.35 };
  const br = { x: cx + hw - skew * 0.15, y: topY + hd * 0.55 };
  const bl = { x: cx - hw - skew * 0.15, y: topY + hd * 0.55 };

  // Right face
  ctx.fillStyle = m.sideDark;
  fillPoly(ctx, [tr, br, { x: br.x, y: br.y + h }, { x: tr.x, y: tr.y + h }]);

  // Front face
  ctx.fillStyle = m.side;
  fillPoly(ctx, [bl, br, { x: br.x, y: br.y + h }, { x: bl.x, y: bl.y + h }]);

  // Top face
  ctx.fillStyle = m.top;
  fillPoly(ctx, [tl, tr, br, bl]);

  // Top edge light
  ctx.strokeStyle = withAlpha("#ffffff", 0.16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.stroke();
}

/**
 * Draw a 2.5D frustum (tapered cylinder, wider at base).
 */
export function frustum25(ctx, cx, topY, rxBot, rxTop, rise, m) {
  const ryBot = deckRy(rxBot);
  const ryTop = deckRy(rxTop);

  ctx.fillStyle = m.side;
  ctx.beginPath();
  ctx.moveTo(cx - rxTop, topY);
  ctx.lineTo(cx - rxBot, topY + rise);
  ctx.lineTo(cx + rxBot, topY + rise);
  ctx.lineTo(cx + rxTop, topY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = m.sideDark;
  ctx.beginPath();
  ctx.ellipse(cx, topY + rise, rxBot, ryBot, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = m.top;
  ctx.beginPath();
  ctx.ellipse(cx, topY, rxTop, ryTop, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#fff8e0", 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(
    cx - rxTop * 0.1, topY - ryTop * 0.08,
    rxTop * 0.65, ryTop * 0.5,
    -0.3, Math.PI * 1.15, Math.PI * 1.85
  );
  ctx.stroke();
}

/**
 * Draw a diamond prism (rotated box).
 */
export function diamondPrism25(ctx, cx, topY, rx, rise, m) {
  const ry = deckRy(rx);
  const top = [
    { x: cx, y: topY - ry },
    { x: cx + rx, y: topY },
    { x: cx, y: topY + ry },
    { x: cx - rx, y: topY },
  ];
  const bot = top.map((p) => ({ x: p.x, y: p.y + rise }));

  ctx.fillStyle = m.sideDark;
  fillPoly(ctx, [top[1], top[2], bot[2], bot[1]]);
  ctx.fillStyle = m.side;
  fillPoly(ctx, [top[2], top[3], bot[3], bot[2]]);
  ctx.fillStyle = m.top;
  fillPoly(ctx, top);

  ctx.strokeStyle = withAlpha("#fff8e0", 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(top[3].x, top[3].y);
  ctx.lineTo(top[0].x, top[0].y);
  ctx.lineTo(top[1].x, top[1].y);
  ctx.stroke();
}

/**
 * Draw a 2D ring on the ground plane (ellipse).
 */
export function ring25(ctx, cx, y, rx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, deckRy(rx), 0, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw rivets around an ellipse.
 */
export function rivetRing(ctx, cx, y, rx, count, color) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const px = cx + Math.cos(a) * rx;
    const py = y + Math.sin(a) * deckRy(rx);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.9, rx * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Projected ellipse — computes rx, ry, rotation for a circle of radius r
 * lying across the ground-to-vertical plane (for barrel end-caps).
 */
export function capEllipse(basis, r) {
  const a = basis.px * basis.px;
  const c = basis.px * basis.py * basis.D;
  const b = basis.py * basis.py * basis.D * basis.D + basis.V * basis.V;
  const tr = a + b;
  const disc = Math.sqrt(Math.max(0, (a - b) * (a - b) + 4 * c * c));
  const l1 = (tr + disc) / 2;
  const l2 = Math.max(1e-6, (tr - disc) / 2);
  return {
    rx: r * Math.sqrt(l1),
    ry: r * Math.sqrt(l2),
    rot: 0.5 * Math.atan2(2 * c, a - b),
  };
}
