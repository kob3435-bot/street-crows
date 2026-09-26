import * as THREE from 'three';
interface Txt { text: string; p: THREE.Vector3; life: number; max: number; color: string; size: number; rot: number; vy: number; stroke: string }
/** 2D manga overlay: speed lines, impact frames, onomatopoeia and damage numbers. */
export class Overlay {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D; speed = 0; speedColor = '#ffffff'; tint = 0; tintColor = '80,160,255'; texts: Txt[] = []; impact = 0; private v = new THREE.Vector3();
  constructor(parent: HTMLElement, private glCanvas: HTMLCanvasElement) {
    this.cv = document.createElement('canvas'); this.cv.id = 'overlay'; parent.appendChild(this.cv); this.c = this.cv.getContext('2d')!;
    const rs = () => { this.cv.width = Math.min(window.innerWidth, 1600); this.cv.height = Math.round(this.cv.width * window.innerHeight / window.innerWidth); }; rs(); window.addEventListener('resize', rs);
  }
  speedLines(v: number, color = '#ffffff') { this.speed = Math.max(this.speed, v); this.speedColor = color; }
  impactFrame(dur = 0.08) { this.impact = dur; }
  slowTint(v: number, color = '80,160,255') { this.tint = Math.max(this.tint, v); this.tintColor = color; }
  sfx(text: string, p: THREE.Vector3, color = '#fff', size = 34, stroke = '#111') { this.texts.push({ text, p: p.clone(), life: 0, max: 0.7, color, size, rot: (Math.random() - 0.5) * 0.5, vy: 0.8, stroke }); if (this.texts.length > 24) this.texts.shift(); }
  update(dt: number, cam: THREE.Camera) {
    const c = this.c, W = this.cv.width, H = this.cv.height; c.clearRect(0, 0, W, H);
    if (this.tint > 0) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9); g.addColorStop(0, `rgba(${this.tintColor},0)`); g.addColorStop(1, `rgba(${this.tintColor},${Math.min(0.45, this.tint)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); this.tint = Math.max(0, this.tint - dt * 0.8); }
    if (this.speed > 0.02) {
      c.save(); c.translate(W / 2, H / 2); c.fillStyle = this.speedColor; c.globalAlpha = Math.min(0.85, this.speed);
      const n = 70; const R = Math.hypot(W, H) * 0.6; const inner = H * (0.42 - this.speed * 0.12);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.08; const r0 = inner + Math.random() * H * 0.15; const wdt = 0.006 + Math.random() * 0.01;
        c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a - wdt) * R, Math.sin(a - wdt) * R); c.lineTo(Math.cos(a + wdt) * R, Math.sin(a + wdt) * R); c.closePath(); c.fill(); }
      c.restore(); this.speed = Math.max(0, this.speed - dt * 2.2);
    }
    if (this.impact > 0) { this.impact -= dt; this.glCanvas.style.filter = 'grayscale(1) contrast(2.2) brightness(1.1)'; if (this.impact <= 0) this.glCanvas.style.filter = ''; }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life += dt; if (t.life >= t.max) { this.texts.splice(i, 1); continue; }
      t.p.y += t.vy * dt; this.v.copy(t.p).project(cam); if (this.v.z > 1) continue;
      const x = (this.v.x * 0.5 + 0.5) * W, y = (-this.v.y * 0.5 + 0.5) * H; const k = t.life / t.max; const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - (k - 0.15) * 0.25;
      c.save(); c.translate(x, y); c.rotate(t.rot); c.scale(pop, pop); c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.font = `${t.size}px Bangers, "Kanit", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = Math.max(4, t.size * 0.16); c.strokeStyle = t.stroke; c.lineJoin = 'round';
      c.strokeText(t.text, 0, 0); c.fillStyle = t.color; c.fillText(t.text, 0, 0); c.restore();
    }
  }
}
