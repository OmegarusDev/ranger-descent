/**
 * CorridorPath — 2D center-line path for corridor turns and junctions.
 * Supports Chaikin smoothing and distance-based sampling.
 */

export function chaikin(pts, iterations = 2) {
  let out = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      next.push(
        { x: a.x + (b.x - a.x) * 0.25, y: a.y + (b.y - a.y) * 0.25 },
        { x: a.x + (b.x - a.x) * 0.75, y: a.y + (b.y - a.y) * 0.75 },
      );
    }
    next.push({ ...out[out.length - 1] });
    out = next;
  }
  return out;
}

export function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

export function walkPath(pts, d) {
  let remaining = d;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const segLen = Math.hypot(dx, dy);
    if (remaining <= segLen || i === pts.length - 1) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 0;
      return {
        x: pts[i - 1].x + dx * t,
        y: pts[i - 1].y + dy * t,
        tx: segLen > 0 ? dx / segLen : 0,
        ty: segLen > 0 ? dy / segLen : 1,
      };
    }
    remaining -= segLen;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, tx: 0, ty: 1 };
}

export function perpRight(tx, ty) {
  return { x: ty, y: -tx };
}
