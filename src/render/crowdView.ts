import * as THREE from 'three';
import type { Crowd } from '../sim/crowd';
import { toon, outlineMat } from './toon';

const KIND_COLORS: string[][] = [
  ['#23232b', '#1c1c22'], ['#e8e8ee', '#d8d8e0'], ['#4a4e58', '#3a3e48'], ['#c06a4a', '#3a4a6a'], ['#a08a6a', '#5a5048'], ['#4b2a6b', '#1e1e1e'], ['#24365e', '#2a2f3e'],
];
const CASUAL = ['#c86a4a', '#5a8ac8', '#e0c070', '#7aa870', '#c85a8a', '#e8e8e8', '#6a5a8a', '#d89a5a'];
const GANG_LOITER = ['#4b2a6b', '#6b1f24', '#1f4a3a', '#8a4a1c'];
const SKIN = ['#e9c29f', '#d8ad84', '#f0d0b0', '#c89a74'];
const HAIR = ['#1a1a1a', '#3a2412', '#5a3a1a', '#c8a040', '#2a2a2a', '#d0d0d0'];
/** Instanced pedestrians (5 parts x N instances = 5 draw calls + outlines). */
export class CrowdView {
  group = new THREE.Group(); parts: { mesh: THREE.InstancedMesh; ol?: THREE.InstancedMesh }[] = []; max: number;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  constructor(private crowd: Crowd, quality: number) {
    this.max = crowd.walkers.length;
    const geos = [new THREE.BoxGeometry(0.4, 0.55, 0.24), new THREE.SphereGeometry(0.14, 10, 8), new THREE.BoxGeometry(0.14, 0.8, 0.14).translate(0, -0.4, 0), new THREE.BoxGeometry(0.14, 0.8, 0.14).translate(0, -0.4, 0), new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)];
    for (let i = 0; i < geos.length; i++) {
      const mesh = new THREE.InstancedMesh(geos[i], toon('#ffffff'), this.max); mesh.castShadow = quality > 1; mesh.frustumCulled = false; this.group.add(mesh);
      let ol: THREE.InstancedMesh | undefined; if (quality > 0 && i < 2) { ol = new THREE.InstancedMesh(geos[i], outlineMat, this.max); ol.frustumCulled = false; this.group.add(ol); }
      this.parts.push({ mesh, ol });
    }
    const c = new THREE.Color();
    crowd.walkers.forEach((w, i) => {
      const kc = KIND_COLORS[w.kind]; const jacket = w.kind === 3 ? CASUAL[w.color] : w.kind === 5 ? GANG_LOITER[w.color % 4] : kc[0]; const pants = w.kind === 3 ? CASUAL[(w.color + 3) % 8] : kc[1];
      this.parts[0].mesh.setColorAt(i, c.set(jacket)); this.parts[1].mesh.setColorAt(i, c.set(SKIN[w.color % 4]));
      this.parts[2].mesh.setColorAt(i, c.set(pants)); this.parts[3].mesh.setColorAt(i, c.set(pants)); this.parts[4].mesh.setColorAt(i, c.set(w.kind === 4 ? '#c8c8c8' : HAIR[w.color % 6]));
    });
    for (const p of this.parts) if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
  }
  update(time: number, cam: THREE.Vector3, range: number, slow: number, layer: number) {
    let n = 0; const m = this.m, q = this.q, e = this.e, v = this.v, s = this.s;
    const olT = 0.03;
    for (let i = 0; i < this.crowd.walkers.length; i++) {
      const w = this.crowd.walkers[i]; if (!w.active || layer !== 0) continue;
      const dx = w.x - cam.x, dz = w.z - cam.z; if (dx * dx + dz * dz > range * range) continue;
      const moving = w.state === 1; const t = time * (w.fleeT > 0 ? 2.2 : 1) * slow + w.phase; const sw = moving ? Math.sin(t * 7) * 0.6 : 0;
      const hunch = w.kind === 4 ? 0.25 : 0; const sc = w.kind === 4 ? 0.92 : 1; const bob = moving ? Math.abs(Math.cos(t * 7)) * 0.04 : Math.sin(t * 2) * 0.01;
      const set = (part: number, x: number, y: number, z: number, rx: number, sx = 1, sy = 1, sz = 1) => {
        e.set(rx, w.yaw, 0, 'YXZ'); q.setFromEuler(e); const c = Math.cos(w.yaw), sn = Math.sin(w.yaw);
        v.set(w.x + x * c + z * sn, y, w.z - x * sn + z * c); s.set(sx * sc, sy * sc, sz * sc); m.compose(v, q, s); this.parts[part].mesh.setMatrixAt(n, m);
        const ol = this.parts[part].ol; if (ol) { s.set((sx + olT / 0.2) * sc, (sy + olT / 0.27) * sc, (sz + olT / 0.12) * sc); m.compose(v, q, s); ol.setMatrixAt(n, m); }
      };
      const hip = 0.82 * sc + bob;
      set(2, 0.1, hip, 0, sw); set(3, -0.1, hip, 0, -sw);
      set(0, 0, hip + 0.3, 0, hunch + (w.state === 2 ? Math.sin(t * 1.3) * 0.05 : 0));
      set(1, 0, hip + 0.72 - hunch * 0.3, 0.05 + hunch * 0.2, 0);
      set(4, 0, hip + 0.76 - hunch * 0.3, 0.04 + hunch * 0.2, -0.2);
      n++;
    }
    for (const p of this.parts) { p.mesh.count = n; p.mesh.instanceMatrix.needsUpdate = true; if (p.ol) { p.ol.count = n; p.ol.instanceMatrix.needsUpdate = true; } }
  }
}
