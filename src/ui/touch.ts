import type { Input, Action } from '../core/input';
import type { World } from '../sim/world';
import { audio } from '../core/audio';

/** Mobile touch layer: floating joystick (left), drag-look (right), action buttons. */
export class TouchControls {
  root: HTMLElement; active = false; private sp!: HTMLElement;
  constructor(parent: HTMLElement, private input: Input, private w: World) {
    const r = document.createElement('div'); r.id = 'touch'; this.root = r; parent.appendChild(r);
    r.innerHTML = `<div class="look"></div><div class="joy"><div class="jbase"><div class="jknob"></div></div></div>
      <div class="btns">
        <div class="tb big" data-a="punch" style="right:6px;bottom:6px">ต่อย<br><small>PUNCH</small></div>
        <div class="tb" data-a="heavy" style="right:96px;bottom:4px">หนัก<br><small>HVY</small></div>
        <div class="tb" data-a="kick" style="right:14px;bottom:96px">เตะ<br><small>KICK</small></div>
        <div class="tb" data-a="hkick" style="right:84px;bottom:74px;width:54px;height:54px;font-size:12px">เตะหนัก<br><small>H.K</small></div>
        <div class="tb" data-a="dodge" style="right:166px;bottom:10px">หลบ<br><small>DODGE</small></div>
        <div class="tb" data-hold="block" style="right:156px;bottom:84px">การ์ด<br><small>BLOCK</small></div>
        <div class="tb" data-a="grab" style="right:98px;bottom:142px;width:54px;height:54px;font-size:12px">จับ<br><small>GRAB</small></div>
        <div class="tb sp" data-a="special" style="right:20px;bottom:172px">พิเศษ<br><small>SP</small></div>
      </div>
      <div class="top"><div class="tb" data-a="interact">E<br><small>คุย</small></div><div class="tb" data-a="item1">🍙</div><div class="tb" data-a="menu">☰</div></div>`;
    this.sp = r.querySelector('.tb.sp')!;
    r.querySelectorAll<HTMLElement>('[data-a]').forEach(b => {
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); audio.init(); this.input.press(b.dataset.a as Action); b.classList.add('on'); }, { passive: false });
      const up = (e: Event) => { e.preventDefault(); b.classList.remove('on'); };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
      b.addEventListener('mousedown', (e) => { e.stopPropagation(); this.input.press(b.dataset.a as Action); });
    });
    const blk = r.querySelector<HTMLElement>('[data-hold]')!;
    blk.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.input.setVirtualBlock(true); blk.classList.add('on'); }, { passive: false });
    const bu = (e: Event) => { e.preventDefault(); this.input.setVirtualBlock(false); blk.classList.remove('on'); };
    blk.addEventListener('touchend', bu, { passive: false }); blk.addEventListener('touchcancel', bu, { passive: false });
    // joystick (floating: appears where the thumb lands)
    const joy = r.querySelector<HTMLElement>('.joy')!, base = r.querySelector<HTMLElement>('.jbase')!, knob = r.querySelector<HTMLElement>('.jknob')!;
    let jid: number | null = null, cx = 0, cy = 0; const R = 52;
    joy.addEventListener('touchstart', (e) => { e.preventDefault(); audio.init(); const t = e.changedTouches[0]; jid = t.identifier; const rc = joy.getBoundingClientRect(); cx = t.clientX; cy = t.clientY; base.style.display = 'block'; base.style.left = (cx - rc.left) + 'px'; base.style.top = (cy - rc.top) + 'px'; knob.style.transform = 'translate(-50%,-50%)'; this.input.setVirtualMove(0, 0, true); }, { passive: false });
    joy.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of Array.from(e.changedTouches)) if (t.identifier === jid) { let dx = t.clientX - cx, dy = t.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; this.input.setVirtualMove(dx / R, -dy / R, true); } }, { passive: false });
    const jend = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) if (t.identifier === jid) { jid = null; base.style.display = 'none'; this.input.setVirtualMove(0, 0, false); } };
    joy.addEventListener('touchend', jend); joy.addEventListener('touchcancel', jend);
    // look
    const look = r.querySelector<HTMLElement>('.look')!; let lid: number | null = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', (e) => { e.preventDefault(); audio.init(); const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; }, { passive: false });
    look.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of Array.from(e.changedTouches)) if (t.identifier === lid) { this.input.addTouchLook(t.clientX - lx, t.clientY - ly); lx = t.clientX; ly = t.clientY; } }, { passive: false });
    const lend = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) if (t.identifier === lid) lid = null; };
    look.addEventListener('touchend', lend); look.addEventListener('touchcancel', lend);
  }
  setActive(on: boolean) { this.active = on; this.root.classList.toggle('on', on); document.body.classList.toggle('touchmode', on); }
  update() { if (!this.active) return; this.sp.classList.toggle('ready', this.w.player.meter >= 100); this.root.style.visibility = this.w.menuOpen ? 'hidden' : 'visible'; }
}
