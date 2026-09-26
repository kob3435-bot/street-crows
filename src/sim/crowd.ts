import { mulberry32 } from '../core/rng';
import type { Collision } from './collision';

/** Ambient pedestrian simulation on a sidewalk graph. Pure data; rendered with instancing. */
export interface Walker { x: number; z: number; yaw: number; tx: number; tz: number; node: number; prev: number; speed: number; kind: number; color: number; lane: number; phase: number; state: 0 | 1 | 2; t: number; group: number; active: boolean; bark: number; barkT: number; fleeT: number }
// kind: 0 student(kurogane) 1 student(hakuryu) 2 salaryman 3 shopper 4 elder 5 loiterer 6 student(tetsuwan)
const N: [number, number][] = [
  [-80, -82], [0, -82], [80, -82], [-80, 0], [0, 0], [80, 0], [-80, 100], [0, 100], [80, 100], [117, 100], [117, 142], [0, 142], [-80, 142], [-160, 0], [160, 0], [-160, -82], [160, -82],
  [0, -40], [-130, -82], [140, -82], [136, 4], [-120, 40], [0, 50], [40, 4], [-110, 142], [100, 142], [-160, 100], [160, 100], [-80, 50], [80, 50], [0, 180],
];
const E: [number, number][] = [
  [0, 18], [18, 1], [1, 2], [2, 19], [19, 16], [0, 15], [0, 3], [1, 17], [17, 4], [2, 5], [3, 4], [4, 23], [23, 5], [5, 20], [20, 14], [3, 13], [3, 28], [28, 6], [5, 29], [29, 8],
  [4, 22], [22, 7], [6, 7], [7, 8], [8, 9], [9, 27], [6, 26], [7, 11], [9, 10], [10, 25], [25, 11], [11, 12], [12, 24], [11, 30], [13, 21], [21, 28], [15, 18],
];
export class Crowd {
  walkers: Walker[] = []; nodes = N; adj: number[][] = N.map(() => []); night = 0; hour = 12;
  constructor(count: number, private col: Collision) {
    for (const [a, b] of E) { this.adj[a].push(b); this.adj[b].push(a); }
    const r = mulberry32(99);
    for (let i = 0; i < count; i++) {
      const n = Math.floor(r() * N.length); const kind = i % 9 === 0 ? 5 : [0, 0, 1, 2, 3, 4, 6, 0, 3][i % 9];
      const w: Walker = { x: N[n][0], z: N[n][1], yaw: 0, tx: N[n][0], tz: N[n][1], node: n, prev: -1, speed: 1.1 + r() * 0.7, kind, color: Math.floor(r() * 8), lane: (r() < 0.5 ? -1 : 1) * (2 + r() * 2.5), phase: r() * 10, state: 0, t: 0, group: -1, active: true, bark: -1, barkT: 0, fleeT: 0 };
      if (kind === 5) { w.state = 2; w.group = Math.floor(i / 9); const a = r() * 6.28; const gc = this.groupCenter(w.group, r); w.x = gc[0] + Math.sin(a) * 1.2; w.z = gc[1] + Math.cos(a) * 1.2; w.yaw = Math.atan2(gc[0] - w.x, gc[1] - w.z); }
      else { const m = this.adj[n][Math.floor(r() * this.adj[n].length)]; this.setTarget(w, m); }
      this.walkers.push(w);
    }
  }
  private groupSpots: [number, number][] = [[-120, -95], [-60, -30], [30, 40], [140, -95], [150, 8], [-100, 160], [-40, 104], [10, -60], [60, 170], [-150, -40], [110, 60], [-30, 60]];
  private groupCenter(g: number, r: () => number): [number, number] { const s = this.groupSpots[g % this.groupSpots.length]; return [s[0] + (r() - 0.5) * 3, s[1] + (r() - 0.5) * 3]; }
  private setTarget(w: Walker, n: number) {
    const a = this.nodes[w.node], b = this.nodes[n]; const dx = b[0] - a[0], dz = b[1] - a[1]; const d = Math.hypot(dx, dz) || 1;
    const horiz = Math.abs(dz) < 0.5, vert = Math.abs(dx) < 0.5;
    let mag = 5.5; if (horiz && Math.abs(a[1]) < 1) mag = 9.6; else if (vert && Math.abs(a[0]) < 1 && Math.min(a[1], b[1]) < -5 && Math.max(a[1], b[1]) <= 0) mag = 2.4; else if (!horiz && !vert) mag = 1.2;
    const lane = Math.sign(w.lane) * (mag + (Math.abs(w.lane) - 2) * 0.25);
    const ox = -dz / d * lane, oz = dx / d * lane; // sidewalk offset perpendicular to the edge
    w.prev = w.node; w.node = n; w.tx = b[0] + ox; w.tz = b[1] + oz;
  }
  /** fights: positions of active fights (NPCs flee). */
  update(dt: number, px: number, pz: number, fights: [number, number][], slow: number) {
    dt *= slow; const nightHide = this.night > 0.5;
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      w.active = !(nightHide && w.kind !== 5 && (i % 3 !== 0)) && !(this.hour > 7 && this.hour < 15 && (w.kind === 0 || w.kind === 1 || w.kind === 6) && i % 2 === 0);
      if (!w.active) continue;
      w.barkT = Math.max(0, w.barkT - dt);
      const far = Math.abs(w.x - px) > 120 || Math.abs(w.z - pz) > 120;
      let flee = false;
      for (const [fx, fz] of fights) { const dx = w.x - fx, dz = w.z - fz; if (dx * dx + dz * dz < 100) { flee = true; w.fleeT = 2.5; const d = Math.hypot(dx, dz) || 1; w.yaw = Math.atan2(dx, dz); w.x += dx / d * 4 * dt; w.z += dz / d * 4 * dt; } }
      if (w.fleeT > 0 && !flee) { w.fleeT -= dt; w.x += Math.sin(w.yaw) * 3 * dt; w.z += Math.cos(w.yaw) * 3 * dt; }
      if (flee || w.fleeT > 0) { const [x, z] = this.col.resolve(w.x, w.z, 0.35, 0); w.x = x; w.z = z; w.state = 1; continue; }
      if (w.kind === 5 || w.state === 2) { w.state = 2; continue; } // loiterers stand and chat
      const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
      if (d < 0.6) {
        const opts = this.adj[w.node].filter(n => n !== w.prev); const nn = opts.length ? opts[Math.floor(Math.random() * opts.length)] : w.prev;
        this.setTarget(w, nn); continue;
      }
      const sp = w.speed * (far ? 1.0 : 1); w.x += dx / d * sp * dt; w.z += dz / d * sp * dt; w.yaw = Math.atan2(dx, dz); w.state = 1;
      { const ox = w.x - px, oz = w.z - pz, od = Math.hypot(ox, oz); if (od < 1.0 && od > 1e-3) { w.x = px + ox / od * 1.0; w.z = pz + oz / od * 1.0; } } // step around the player
    }
  }
}
