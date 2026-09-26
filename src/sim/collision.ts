import { MAP_HALF, ROOF } from '../data/city';
export interface Box { x0: number; z0: number; x1: number; z1: number; h: number; layer: number; y0?: number; /** building the renderer can cut away (camera ignores it) */ cut?: boolean }
export interface Circle { x: number; z: number; r: number; layer: number }
const CELL = 20, N = Math.ceil((MAP_HALF * 2 + 8) / CELL), OFF = MAP_HALF + 4;
/** Static world collision: AABB buildings/props + circles, spatial-hashed. Shared by sim and camera. */
export class Collision {
  boxes: Box[] = []; circles: Circle[] = [];
  private grid: number[][] = Array.from({ length: N * N }, () => []);
  private cgrid: number[][] = Array.from({ length: N * N }, () => []);
  private stamp = 0; private marks: number[] = [];
  addBox(b: Box) {
    const i = this.boxes.push(b) - 1; this.marks.push(0);
    for (let cx = this.ci(b.x0); cx <= this.ci(b.x1); cx++) for (let cz = this.ci(b.z0); cz <= this.ci(b.z1); cz++) this.grid[cz * N + cx].push(i);
  }
  addCircle(c: Circle) {
    const i = this.circles.push(c) - 1;
    for (let cx = this.ci(c.x - c.r); cx <= this.ci(c.x + c.r); cx++) for (let cz = this.ci(c.z - c.r); cz <= this.ci(c.z + c.r); cz++) this.cgrid[cz * N + cx].push(i);
  }
  private ci(v: number) { return Math.max(0, Math.min(N - 1, Math.floor((v + OFF) / CELL))); }
  private query(x0: number, z0: number, x1: number, z1: number, out: number[]) {
    out.length = 0; this.stamp++;
    for (let cx = this.ci(Math.min(x0, x1)); cx <= this.ci(Math.max(x0, x1)); cx++) for (let cz = this.ci(Math.min(z0, z1)); cz <= this.ci(Math.max(z0, z1)); cz++)
      for (const i of this.grid[cz * N + cx]) if (this.marks[i] !== this.stamp) { this.marks[i] = this.stamp; out.push(i); }
    return out;
  }
  private tmp: number[] = [];
  /** Push a circle out of all colliders and keep it in the map. Returns corrected [x,z]. */
  resolve(x: number, z: number, r: number, layer: number): [number, number] {
    for (let pass = 0; pass < 2; pass++) {
      const ids = this.query(x - r, z - r, x + r, z + r, this.tmp);
      for (const i of ids) {
        const b = this.boxes[i]; if (b.layer !== layer) continue;
        const px = Math.max(b.x0, Math.min(x, b.x1)), pz = Math.max(b.z0, Math.min(z, b.z1));
        let dx = x - px, dz = z - pz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); x = px + dx / d * r; z = pz + dz / d * r; }
        else { // centre inside: push along smallest penetration
          const l = x - b.x0, rr = b.x1 - x, t = z - b.z0, bb = b.z1 - z; const m = Math.min(l, rr, t, bb);
          if (m === l) x = b.x0 - r; else if (m === rr) x = b.x1 + r; else if (m === t) z = b.z0 - r; else z = b.z1 + r;
        }
      }
      const cx = this.ci(x), cz = this.ci(z);
      for (const i of this.cgrid[cz * N + cx]) {
        const c = this.circles[i]; if (c.layer !== layer) continue;
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m) { if (d < 1e-6) { x = c.x + m; } else { x = c.x + dx / d * m; z = c.z + dz / d * m; } }
      }
    }
    if (layer === 1) { const [a, b, c, d] = ROOF.rect; x = Math.max(a + r, Math.min(c - r, x)); z = Math.max(b + r, Math.min(d - r, z)); }
    const H = MAP_HALF - r; x = Math.max(-H, Math.min(H, x)); z = Math.max(-H, Math.min(H, z));
    return [x, z];
  }
  /** True if a wall blocks the straight segment (used for melee LOS and AI sight). */
  blocked(x0: number, z0: number, x1: number, z1: number, layer: number): boolean {
    const ids = this.query(x0, z0, x1, z1, this.tmp);
    const dx = x1 - x0, dz = z1 - z0;
    for (const i of ids) {
      const b = this.boxes[i]; if (b.layer !== layer || b.h < 1.2) continue;
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-9) { if (x0 < b.x0 || x0 > b.x1) continue; } else { let t1 = (b.x0 - x0) / dx, t2 = (b.x1 - x0) / dx; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
      if (Math.abs(dz) < 1e-9) { if (z0 < b.z0 || z0 > b.z1) continue; } else { let t1 = (b.z0 - z0) / dz, t2 = (b.z1 - z0) / dz; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
      return true;
    }
    return false;
  }
  /** 3D ray vs extruded boxes (camera collision). Returns hit distance or maxD. */
  ray(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxD: number, skipCut = false): number {
    const ex = ox + dx * maxD, ez = oz + dz * maxD; const ids = this.query(ox, oz, ex, ez, this.tmp); let best = maxD;
    for (const i of ids) {
      const b = this.boxes[i]; if (b.h < 1.5 || (skipCut && b.cut)) continue; const y0 = b.y0 ?? (b.layer === 1 ? ROOF.y : 0);
      let tmin = 0, tmax = best; let ok = true;
      const axes: [number, number, number, number][] = [[ox, dx, b.x0, b.x1], [oy, dy, y0, b.h + y0], [oz, dz, b.z0, b.z1]];
      for (const [o, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }
  /** Fast walkability test: does a circle of radius r at (x,z) overlap any collider on this layer? */
  solidAt(x: number, z: number, r: number, layer: number): boolean {
    const ids = this.query(x - r, z - r, x + r, z + r, this.tmp);
    for (const i of ids) {
      const b = this.boxes[i]; if (b.layer !== layer) continue;
      const px = Math.max(b.x0, Math.min(x, b.x1)), pz = Math.max(b.z0, Math.min(z, b.z1));
      if ((x - px) ** 2 + (z - pz) ** 2 < r * r) return true;
    }
    const seen = new Set<number>();
    for (let cx = this.ci(x - r); cx <= this.ci(x + r); cx++) for (let cz = this.ci(z - r); cz <= this.ci(z + r); cz++) for (const i of this.cgrid[cz * N + cx]) {
      if (seen.has(i)) continue; seen.add(i); const c = this.circles[i];
      if (c.layer === layer && Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    }
    if (layer === 1) { const [a, b, c, d] = ROOF.rect; if (x < a + r || x > c - r || z < b + r || z > d - r) return true; }
    const H = MAP_HALF - r; return x < -H || x > H || z < -H || z > H;
  }
  /** Camera helper: is the point inside a (non-cut) solid volume? */
  pointInSolid(x: number, y: number, z: number, skipCut = true): boolean {
    const ids = this.query(x, z, x, z, this.tmp);
    for (const i of ids) { const b = this.boxes[i]; if (b.h < 1.5 || (skipCut && b.cut)) continue; const y0 = b.y0 ?? (b.layer === 1 ? ROOF.y : 0); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > y0 && y < y0 + b.h) return true; }
    return false;
  }
  insideSolid(x: number, z: number, layer: number): boolean {
    const ids = this.query(x, z, x, z, this.tmp);
    for (const i of ids) { const b = this.boxes[i]; if (b.layer === layer && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true; }
    for (const c of this.circles) if (c.layer === layer && Math.hypot(x - c.x, z - c.z) < c.r) return true;
    return false;
  }
}
