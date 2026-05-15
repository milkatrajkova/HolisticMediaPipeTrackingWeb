import { contours } from 'd3-contour';

type Point = [number, number];

function ringArea(ring: Point[]): number {
  let a = 0;
  const n = ring.length;
  if (n < 3) return 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % n]!;
    a += x1 * y2 - x2 * y1;
  }
  return a * 0.5;
}

function perpendicularDist(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const nx = ax + t * dx;
  const ny = ay + t * dy;
  return Math.hypot(px - nx, py - ny);
}

function douglasPeuckerOpen(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice();
  let idx = 0;
  let dmax = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDist(pts[i]!, pts[0]!, pts[end]!);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const left = douglasPeuckerOpen(pts.slice(0, idx + 1), eps);
    const right = douglasPeuckerOpen(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0]!, pts[end]!];
}

function simplifyClosedRing(ring: Point[], epsPx: number): Point[] {
  if (ring.length < 4) return ring.slice();
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1];
  const open = closed ? ring.slice(0, -1) : ring.slice();
  if (open.length < 3) return ring.slice();
  const line: Point[] = [...open, open[0]!];
  const simp = douglasPeuckerOpen(line, epsPx);
  if (simp.length > 1) {
    const L = simp[simp.length - 1]!;
    const F = simp[0]!;
    if (L[0] === F[0] && L[1] === F[1]) simp.pop();
  }
  return simp;
}

function pickLargestOuterRing(multi: { coordinates: Point[][][] }): Point[] | null {
  let best: Point[] | null = null;
  let bestArea = 0;
  for (const poly of multi.coordinates) {
    const outer = poly[0];
    if (!outer?.length) continue;
    const a = Math.abs(ringArea(outer));
    if (a > bestArea) {
      bestArea = a;
      best = outer;
    }
  }
  return best;
}

export function getCanvasImageSourceSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth || source.width, h: source.videoHeight || source.height };
  }
  return { w: (source as { width: number }).width, h: (source as { height: number }).height };
}

/**
 * Thresholds mask luminance, runs marching squares (d3-contour), simplifies, returns [x,y] in 0..1.
 */
export function segmentationMaskToNormalizedPolygon(
  mask: CanvasImageSource,
  workCanvas: HTMLCanvasElement,
  options?: { threshold?: number; epsilonPx?: number }
): Point[] | undefined {
  const { w, h } = getCanvasImageSourceSize(mask);
  if (w < 2 || h < 2) return undefined;

  const threshold = options?.threshold ?? 0.5;
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;

  ctx.drawImage(mask, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  const values = new Float64Array(w * h);
  for (let j = 0, p = 0; j < h; j++) {
    for (let i = 0; i < w; i++, p++) {
      const o = p * 4;
      const lum = (data[o]! + data[o + 1]! + data[o + 2]!) / (3 * 255);
      values[i + j * w] = lum;
    }
  }

  const cgen = contours().size([w, h]).smooth(true);
  let multi: ReturnType<typeof cgen.contour>;
  try {
    multi = cgen.contour(Array.from(values), threshold);
  } catch {
    return undefined;
  }

  const ring = pickLargestOuterRing(multi as unknown as { coordinates: Point[][][] });
  if (!ring || ring.length < 3) return undefined;

  const epsilonPx =
    options?.epsilonPx ?? Math.max(1.25, Math.min(w, h) / 200);
  const simplified = simplifyClosedRing(ring as Point[], epsilonPx);
  if (simplified.length < 3) return undefined;

  return simplified.map(([x, y]) => [x / w, y / h] as Point);
}
