import { MAP_HALF } from '../data/city';
import type { Collision } from './collision';

const CELL = 1, OFF = MAP_HALF, W = Math.ceil((MAP_HALF * 2) / CELL);
/** Lazy grid A* over the static collision (used by AUTO walk and patrol planning). */
export class Nav {
  private walk: Int8Array[] = [new Int8Array(W * W), new Int8Array(W * W)]; // 0 unknown, 1 open, 2 blocked
  private g = new Float32Array(W * W); private from = new Int32Array(W * W); private seen = new Uint32Array(W * W); private closed = new Uint32Array(W * W); private stamp = 0;
  private heap: number[] = []; private hf: number[] = [];
  constructor(private col: Collision, private r = 0.42) {}
  private idx(x: number, z: number) { const cx = Math.floor((x + OFF) / CELL), cz = Math.floor((z + OFF) / CELL); return cx < 0 || cz < 0 || cx >= W || cz >= W ? -1 : cz * W + cx; }
  private cx(i: number) { return (i % W) * CELL - OFF + CELL / 2; }
  private cz(i: number) { return Math.floor(i / W) * CELL - OFF + CELL / 2; }
  open(i: number, layer: number): boolean {
    if (i < 0) return false; const a = this.walk[layer]; let v = a[i];
    if (!v) { v = this.col.solidAt(this.cx(i), this.cz(i), this.r, layer) ? 2 : 1; a[i] = v; }
    return v === 1;
  }
  walkable(x: number, z: number, layer: number) { return this.open(this.idx(x, z), layer); }
  /** Straight segment is walkable (sampled every 0.5 m). */
  clear(x0: number, z0: number, x1: number, z1: number, layer: number) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.5));
    for (let k = 1; k <= n; k++) { const t = k / n; if (this.col.solidAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, this.r, layer)) return false; }
    return true;
  }
  private nearestOpen(i: number, layer: number, rad = 4): number {
    if (this.open(i, layer)) return i; if (i < 0) return -1;
    const x = i % W, z = Math.floor(i / W);
    for (let r = 1; r <= rad; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
      const j = nz * W + nx; if (this.open(j, layer)) return j;
    }
    return -1;
  }
  private push(i: number, f: number) { const h = this.heap, hf = this.hf; h.push(i); hf.push(f); let k = h.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [h[p], h[k]] = [h[k], h[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; } }
  private pop(): number { const h = this.heap, hf = this.hf; const top = h[0]; const li = h.pop()!, lf = hf.pop()!; if (h.length) { h[0] = li; hf[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < h.length && hf[l] < hf[m]) m = l; if (r < h.length && hf[r] < hf[m]) m = r; if (m === k) break; [h[m], h[k]] = [h[k], h[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return top; }
  /** Returns smoothed waypoint list (excluding start) or null if unreachable within the node budget. */
  findPath(x0: number, z0: number, x1: number, z1: number, layer: number, maxNodes = 60000): [number, number][] | null {
    if (this.clear(x0, z0, x1, z1, layer)) return [[x1, z1]];
    const s = this.nearestOpen(this.idx(x0, z0), layer), t = this.nearestOpen(this.idx(x1, z1), layer);
    if (s < 0 || t < 0) return null;
    const st = ++this.stamp; this.heap.length = 0; this.hf.length = 0;
    const tx = t % W, tz = Math.floor(t / W); const hfn = (i: number) => { const dx = Math.abs(i % W - tx), dz = Math.abs(Math.floor(i / W) - tz); return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * CELL; };
    this.g[s] = 0; this.from[s] = -1; this.seen[s] = st; this.push(s, hfn(s)); let n = 0; let found = false;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (this.heap.length && n < maxNodes) {
      const c = this.pop(); if (this.closed[c] === st) continue; this.closed[c] = st; n++;
      if (c === t) { found = true; break; }
      const x = c % W, z = Math.floor(c / W);
      for (const [dx, dz, cost] of D) {
        const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue; const j = nz * W + nx;
        if (this.closed[j] === st || !this.open(j, layer)) continue;
        if (dx && dz && (!this.open(z * W + nx, layer) || !this.open(nz * W + x, layer))) continue; // no corner cutting
        const ng = this.g[c] + cost * CELL;
        if (this.seen[j] !== st || ng < this.g[j]) { this.seen[j] = st; this.g[j] = ng; this.from[j] = c; this.push(j, ng + hfn(j)); }
      }
    }
    if (!found) return null;
    const raw: [number, number][] = []; for (let c = t; c !== -1; c = this.from[c]) raw.push([this.cx(c), this.cz(c)]); raw.reverse(); raw[raw.length - 1] = [x1, z1];
    // string pulling
    const out: [number, number][] = []; let ax = x0, az = z0, k = 0;
    while (k < raw.length) {
      let far = k; while (far + 1 < raw.length && far - k < 60 && this.clear(ax, az, raw[far + 1][0], raw[far + 1][1], layer)) far++;
      out.push(raw[far]); ax = raw[far][0]; az = raw[far][1]; k = far + 1;
    }
    return out;
  }
  /** Random reachable-ish open point near (x,z) within rad (for patrols). */
  randomOpen(x: number, z: number, rad: number, layer: number, rnd: () => number): [number, number] | null {
    for (let k = 0; k < 12; k++) { const a = rnd() * Math.PI * 2, d = rad * (0.3 + 0.7 * rnd()); const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (this.walkable(px, pz, layer)) return [px, pz]; }
    return null;
  }
}
