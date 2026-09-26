import * as THREE from 'three';
import { canvasTexture } from './toon';
interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; g: number; color: THREE.Color }
/** Pooled particles, manga impact bursts and shockwave rings. */
export class FX {
  group = new THREE.Group(); private ps: P[] = []; private mesh: THREE.InstancedMesh; private max = 260;
  private bursts: { s: THREE.Sprite; life: number; max: number; size: number }[] = []; private rings: { m: THREE.Mesh; life: number; max: number; r: number }[] = [];
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sc = new THREE.Vector3(); private c = new THREE.Color();
  constructor() {
    const star = canvasTexture(64, 64, (c) => { c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 31; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } c.fill(); });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: star, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false }), this.max);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.group.add(this.mesh);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    const burst = canvasTexture(256, 256, (c) => {
      c.translate(128, 128); c.beginPath(); const n = 18; for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = i % 2 ? 50 + Math.random() * 20 : 105 + Math.random() * 20; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath();
      c.fillStyle = '#fffbe8'; c.fill(); c.lineWidth = 8; c.strokeStyle = '#111'; c.stroke();
      c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n + 0.1, r = i % 2 ? 22 : 55; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fillStyle = '#ffd23a'; c.fill();
    });
    for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: burst, transparent: true, depthTest: false })); s.visible = false; s.renderOrder = 20; this.group.add(s); this.bursts.push({ s, life: 0, max: 1, size: 1 }); }
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; this.group.add(m); this.rings.push({ m, life: 0, max: 1, r: 1 }); }
  }
  spark(x: number, y: number, z: number, n: number, color: string, speed = 6, size = 0.25, g = -6) {
    const col = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.ps.length >= this.max) this.ps.shift();
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.4, s = speed * (0.4 + Math.random() * 0.8);
      this.ps.push({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 1, vz: Math.sin(a) * Math.cos(e) * s, life: 0, max: 0.25 + Math.random() * 0.25, size: size * (0.6 + Math.random() * 0.8), grow: -0.5, g, color: col });
    }
  }
  dust(x: number, y: number, z: number, n: number) {
    const col = new THREE.Color('#b8b0a0');
    for (let i = 0; i < n; i++) { if (this.ps.length >= this.max) this.ps.shift(); const a = Math.random() * 6.28; this.ps.push({ x: x + Math.cos(a) * 0.3, y: y + 0.1, z: z + Math.sin(a) * 0.3, vx: Math.cos(a) * 2, vy: 0.6 + Math.random(), vz: Math.sin(a) * 2, life: 0, max: 0.6 + Math.random() * 0.3, size: 0.5, grow: 1.6, g: 0, color: col }); }
  }
  burst(x: number, y: number, z: number, size: number) {
    const b = this.bursts.find(b => b.life >= b.max || !b.s.visible) || this.bursts[0];
    b.s.position.set(x, y, z); b.life = 0; b.max = 0.16; b.size = size; b.s.visible = true; b.s.material.rotation = Math.random() * 6.28;
  }
  ring(x: number, y: number, z: number, r: number, color = '#ffffff') {
    const g = this.rings.find(g => !g.m.visible) || this.rings[0]; g.m.position.set(x, y + 0.1, z); g.life = 0; g.max = 0.45; g.r = r; g.m.visible = true; (g.m.material as THREE.MeshBasicMaterial).color.set(color);
  }
  update(dt: number, cam: THREE.Camera) {
    let n = 0;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]; p.life += dt; if (p.life >= p.max) { this.ps.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt; p.vx *= 0.94; p.vz *= 0.94;
    }
    for (const p of this.ps) {
      const k = p.life / p.max; const s = Math.max(0.01, p.size * (1 + p.grow * k));
      this.v.set(p.x, p.y, p.z); this.sc.set(s, s, s); this.m4.compose(this.v, cam.quaternion, this.sc); this.mesh.setMatrixAt(n, this.m4);
      this.c.copy(p.color).multiplyScalar(1 - k * 0.8); this.mesh.setColorAt(n, this.c); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const b of this.bursts) if (b.s.visible) { b.life += dt; const k = b.life / b.max; if (k >= 1) { b.s.visible = false; continue; } const s = b.size * (0.6 + k * 0.8); b.s.scale.set(s, s, 1); b.s.material.opacity = 1 - k * k; }
    for (const g of this.rings) if (g.m.visible) { g.life += dt; const k = g.life / g.max; if (k >= 1) { g.m.visible = false; continue; } const s = g.r * (0.2 + k); g.m.scale.set(s, 1, s); (g.m.material as THREE.MeshBasicMaterial).opacity = 1 - k; }
  }
}
