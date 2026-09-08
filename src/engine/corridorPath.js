/**
 * CorridorPath — 2D center-line path for corridor turns and junctions.
 */

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
