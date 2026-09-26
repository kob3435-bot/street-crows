import { getDev, setDev, type Dev } from '../ui/glyphs';
/**
 * Unified input: keyboard+mouse, Gamepad API, touch (virtual controls call the
 * setVirtual* methods), and an injectable "bot" source used by automated tests.
 * Output is an abstract action state consumed by the simulation each tick.
 */
export type Action = 'punch' | 'heavy' | 'kick' | 'hkick' | 'dodge' | 'grab' | 'special' | 'interact' | 'menu' | 'pause' | 'item1' | 'item2' | 'item3' | 'map' | 'help' | 'auto';
export class Input {
  moveX = 0; moveY = 0; // moveY: +1 forward
  lookX = 0; lookY = 0; // accumulated deltas (radians-ish)
  zoomDelta = 0; // accumulated camera zoom (metres, + = farther)
  sprint = false; block = false;
  private keys = new Set<string>();
  private pressed = new Set<Action>();
  private vMove = { x: 0, y: 0, active: false }; private vSprint = false; private vBlock = false;
  bot: { moveX: number; moveY: number; sprint: boolean; block: boolean } | null = null;
  sensitivity = 1; invertY = false; enabled = true; pointerLocked = false;
  get lastDevice(): Dev { return getDev(); }
  set lastDevice(d: Dev) { if (d === 'kbm' && performance.now() - this.lastTouchT < 1200) return; setDev(d); } // ignore emulated mouse after touch
  private lastTouchT = -1e9;
  private padPrev: boolean[] = [];
  private canvas: HTMLElement;
  private dragging = false; private lastMX = 0; private lastMY = 0;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.lastDevice = 'kbm';
      if (!e.repeat) this.keyAction(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('touchstart', () => { this.lastTouchT = performance.now(); setDev('touch'); }, { capture: true, passive: true });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      this.lastDevice = 'kbm';
      if (!this.enabled) return;
      if (!this.pointerLocked && (window as any).__wantPointerLock !== false && canvas.requestPointerLock) {
        try { const p: any = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {}
      }
      if (e.button === 0) this.press('punch');
      if (e.button === 2) this.press('heavy');
      if (e.button === 1) this.press('grab');
      this.dragging = true; this.lastMX = e.clientX; this.lastMY = e.clientY;
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault(); if (!this.enabled) return; this.lastDevice = 'kbm';
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      this.zoomDelta += Math.max(-3, Math.min(3, px * 0.012));
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === canvas; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.pointerLocked) { this.look(e.movementX, e.movementY, 0.0025); }
      else if (this.dragging) { this.look(e.clientX - this.lastMX, e.clientY - this.lastMY, 0.004); this.lastMX = e.clientX; this.lastMY = e.clientY; }
    });
  }
  private look(dx: number, dy: number, k: number) { this.lookX += dx * k * this.sensitivity; this.lookY += dy * k * this.sensitivity * (this.invertY ? -1 : 1); }
  addTouchLook(dx: number, dy: number) { this.lastDevice = 'touch'; this.look(dx, dy, 0.006); }
  /** Pinch / external zoom (metres, + = farther). */
  addZoom(d: number) { if (this.enabled) this.zoomDelta += d; }
  consumeZoom() { const z = this.zoomDelta; this.zoomDelta = 0; return z; }
  private keyAction(code: string) {
    const map: Record<string, Action> = { KeyF: 'kick', KeyC: 'hkick', Space: 'dodge', KeyG: 'grab', KeyR: 'special', KeyE: 'interact', Tab: 'menu', Escape: 'pause', Digit1: 'item1', Digit2: 'item2', Digit3: 'item3', KeyM: 'map', KeyH: 'help', KeyJ: 'punch', KeyK: 'heavy', KeyT: 'auto' };
    if (code === 'Equal' || code === 'NumpadAdd') this.zoomDelta -= 1.5; if (code === 'Minus' || code === 'NumpadSubtract') this.zoomDelta += 1.5;
    const a = map[code]; if (a) this.press(a);
  }
  press(a: Action) { this.pressed.add(a); }
  setVirtualMove(x: number, y: number, active: boolean) { this.vMove = { x, y, active }; this.vSprint = active && Math.hypot(x, y) > 0.92; if (active) this.lastDevice = 'touch'; }
  setVirtualBlock(b: boolean) { this.vBlock = b; }
  /** Called once per rendered frame before simulation ticks. */
  poll() {
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) my += 1; if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight'); let block = k.has('KeyQ');
    if (this.vMove.active) { mx = this.vMove.x; my = this.vMove.y; sprint = sprint || this.vSprint; }
    block = block || this.vBlock;
    // Gamepad (standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find(p => p && p.connected);
    if (gp) {
      const dz = (v: number) => Math.abs(v) < 0.18 ? 0 : v;
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly) { mx = lx; my = -ly; this.lastDevice = 'pad'; }
      if (rx || ry) { this.lookX += rx * 0.05 * this.sensitivity; this.lookY += ry * 0.04 * this.sensitivity * (this.invertY ? -1 : 1); }
      const b = gp.buttons.map(x => x.pressed);
      const edge = (i: number, a: Action) => { if (b[i] && !this.padPrev[i]) { this.press(a); this.lastDevice = 'pad'; } };
      edge(2, 'punch'); edge(3, 'heavy'); edge(1, 'kick'); edge(7, 'hkick'); edge(0, 'dodge'); edge(5, 'grab'); edge(11, 'special'); edge(10, 'auto'); edge(15, 'interact'); edge(8, 'menu'); edge(9, 'pause'); edge(14, 'item1');
      if (b[4]) block = true; if (b[6]) sprint = true;
      if (b[12]) this.zoomDelta -= 0.22; if (b[13]) this.zoomDelta += 0.22; // D-pad up/down = zoom
      this.padPrev = b;
    }
    if (this.bot) { mx = this.bot.moveX; my = this.bot.moveY; sprint = this.bot.sprint; block = this.bot.block; }
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    this.moveX = this.enabled ? mx : 0; this.moveY = this.enabled ? my : 0; this.sprint = this.enabled && sprint; this.block = this.enabled && block;
  }
  consumePressed(): Set<Action> { const p = this.pressed; this.pressed = new Set(); if (!this.enabled) { const keep = new Set<Action>(); for (const a of p) if (a === 'menu' || a === 'pause' || a === 'interact') keep.add(a); return keep; } return p; }
  consumeLook() { const l = { x: this.lookX, y: this.lookY }; this.lookX = 0; this.lookY = 0; return l; }
  releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
}
