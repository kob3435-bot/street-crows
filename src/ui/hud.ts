import type { World } from '../sim/world';
import type { GameRenderer } from '../render/renderer';
import { tx, t, getLang } from '../core/i18n';
import { bus } from '../core/events';
import { REP_TIERS, expToNext } from '../sim/progression';
import { ZONES, MAP_HALF, BUS_STOPS, ROOF } from '../data/city';
import { GANG_BY_ID } from '../data/gangs';
import { CHAR_BY_ID } from '../data/characters';
import { CROWD_BARKS, CHAT_BARKS } from '../data/barks';
import { SKILL_BY_ID } from '../data/skills';

const el = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };
export const SPEAKER: Record<string, { th: string; en: string }> = { narrator: { th: 'บรรยาย', en: 'Narrator' }, thug: { th: 'นักเลง', en: 'Thug' }, granny: { th: 'คุณยาย', en: 'Grandma' } };
export function speakerName(id: string) { if (SPEAKER[id]) return tx(SPEAKER[id]); const c = CHAR_BY_ID[id]; return c ? tx(c.name) : id; }

const T = (th: string, en: string) => tx({ th, en });
/** In-game HUD: bars, minimap, quest tracker, boss bar, tags, dialogue, toasts, hints. */
export class HUD {
  root: HTMLElement; mm: HTMLCanvasElement; mmc: CanvasRenderingContext2D; mapImg: HTMLCanvasElement; tags: HTMLElement; tagPool: HTMLElement[] = []; bubblePool: HTMLElement[] = [];
  private q = (s: string) => this.root.querySelector(s) as HTMLElement; private slowT = 0; hintsSeen = new Set<string>(); hintT = 0; crowdBubbles: { x: number; z: number; text: string; t: number }[] = [];
  constructor(parent: HTMLElement, private w: World, private r: GameRenderer) {
    this.root = el(`<div id="hud">
      <div class="hud-tl">
        <div class="hud-name"><span class="lvl" id="h-lvl">Lv1</span><div><div class="pname">ฮารุ โบยะ <span class="ptitle" id="h-title"></span></div></div></div>
        <div class="bar hp"><b id="h-hpb"></b><i id="h-hp"></i><span id="h-hpt"></span></div>
        <div class="bar st"><i id="h-st"></i></div>
        <div class="bar sp" id="h-spw"><i id="h-sp"></i><span>R</span></div>
        <div class="bar xp"><i id="h-xp"></i></div>
        <div class="hud-meta"><span>${t('rep')}: <b id="h-rep"></b></span><span>¥<b id="h-money"></b></span><span id="h-items"></span></div>
      </div>
      <div class="hud-tr"><canvas id="minimap" width="200" height="200"></canvas><div class="zone" id="h-zone"></div><div class="quest" id="h-quest"></div></div>
      <div id="boss"><div class="bn" id="b-name"></div><div class="bar"><b id="b-hpb"></b><i id="b-hp"></i></div><div class="phases" id="b-ph"></div></div>
      <div id="combo"><b id="c-n">0</b><span>${t('hits')}</span></div>
      <div id="tags"></div><div id="toasts"></div><div id="h-auto"></div>
      <div id="prompt" class="panel"></div>
      <div id="hint" class="panel"></div>
      <div id="chat"></div><div id="fps"></div><div id="keys"><kbd>Tab</kbd>${t('menu')} <kbd>M</kbd>${t('map')} <kbd>H</kbd>${t('controls')} <kbd>E</kbd>${t('interactKey')} <kbd>T</kbd>AUTO <kbd>Wheel</kbd>${T('ซูม', 'Zoom')}</div>
      <div id="fade"><span></span></div>
    </div>`);
    parent.appendChild(this.root);
    this.mm = this.q('#minimap') as HTMLCanvasElement; this.mmc = this.mm.getContext('2d')!; this.tags = this.q('#tags');
    this.mapImg = renderMapImage(w, 1);
    this.bind();
  }
  toast(text: string, cls = '') { const d = el(`<div class="toast ${cls}"></div>`); d.textContent = text; this.q('#toasts').appendChild(d); setTimeout(() => d.remove(), 2300); const all = this.q('#toasts').children; if (all.length > 4) all[0].remove(); }
  hint(key: string, title: string, body: string) {
    if (this.hintsSeen.has(key)) return; this.hintsSeen.add(key); const h = this.q('#hint'); h.innerHTML = `<h5>${title}</h5>${body}`; h.style.display = 'block'; this.hintT = 7;
  }
  private bind() {
    const w = this.w; const T = (th: string, en: string) => tx({ th, en });
    bus.on('levelUp', (e) => this.toast(`${t('levelUp')} Lv${e.level}`, 'gold'));
    bus.on('reward', (e) => { if (e.exp) this.toast(`+${e.exp} EXP  ¥${e.money}`, 'small'); });
    bus.on('questStart', (e) => this.toast(`${t('newQuest')}: ${tx(e.q.title)}`, 'small gold'));
    bus.on('questComplete', (e) => { this.toast(t('questDone'), 'gold'); this.toast(`${tx(e.q.title)}  +${e.exp} EXP  +${e.rep} ${t('rep')}`, 'small'); });
    bus.on('counter', (e) => this.toast(e.kind === 'dodge' ? T('หลบแล้วสวน!', 'DODGE COUNTER!') : T('การ์ดแล้วสวน!', 'BLOCK COUNTER!'), 'blue'));
    bus.on('perfectDodge', (e) => { if (e.f.isPlayer) { this.toast(t('perfect'), 'blue'); this.hint('perfect', T('หลบเพอร์เฟกต์!', 'Perfect dodge!'), T('โจมตีตอนนี้เพื่อ <b>สวนกลับ</b> แรงพิเศษ', 'Attack right now for a powerful <b>counter</b>.')); } });
    bus.on('parry', (e) => { if (e.f.isPlayer) { this.toast(T('ปัดป้อง!', 'PARRY!'), 'blue'); this.hint('parry', T('ปัดป้อง', 'Parry'), T('กด Q ตอนหมัดกำลังมา = ปัด แล้วโจมตีทันทีเพื่อสวนกลับ', 'Press Q just before a hit lands to parry, then attack to counter.')); } });
    bus.on('guardBreak', (e) => { if (!e.f.isPlayer) { this.toast(t('guardBreak'), 'red'); this.hint('dizzy', T('ศัตรูมึน!', 'Enemy dizzy!'), T('กด <kbd>คลิกขวา</kbd> (หมัดหนัก) ใกล้ศัตรูที่มึน = <b>ท่าปิดฉาก</b>', 'Press <kbd>RMB</kbd> (heavy) near a dizzy enemy for a <b>FINISHER</b>.')); } else this.toast(t('guardBreak'), 'red'); });
    bus.on('dizzy', (e) => { if (!e.f.isPlayer) this.hint('dizzy', T('ศัตรูมึน!', 'Enemy dizzy!'), T('กด <kbd>คลิกขวา</kbd> (หมัดหนัก) ใกล้ศัตรูที่มึน = <b>ท่าปิดฉาก</b>', 'Press <kbd>RMB</kbd> (heavy) near a dizzy enemy for a <b>FINISHER</b>.')); });
    bus.on('finisherStart', () => this.toast(t('finisher'), 'red'));
    bus.on('block', (e) => { if (e.att?.isPlayer && !e.f.isPlayer) this.hint('eblock', T('ศัตรูตั้งการ์ด', 'Enemy is blocking'), T('ใช้ <kbd>G</kbd> จับทุ่ม หรือ <kbd>C</kbd> เตะหนักเพื่อทำลายการ์ด', 'Use <kbd>G</kbd> grab or <kbd>C</kbd> heavy kick to break their guard.')); });
    bus.on('aggro', () => this.hint('fight', T('เริ่มต่อสู้!', 'Fight!'), T('<kbd>คลิกซ้าย</kbd> ต่อย · <kbd>คลิกขวา</kbd> หมัดหนัก · <kbd>F</kbd> เตะ · <kbd>C</kbd> เตะหนัก<br><kbd>Space</kbd> หลบ · <kbd>Q</kbd> การ์ด · <kbd>G</kbd> จับทุ่ม · <kbd>R</kbd> ท่าพิเศษ<br>คอมโบ: P-P-หนัก / P-F-F', '<kbd>LMB</kbd> punch · <kbd>RMB</kbd> heavy · <kbd>F</kbd> kick · <kbd>C</kbd> heavy kick<br><kbd>Space</kbd> dodge · <kbd>Q</kbd> block · <kbd>G</kbd> grab · <kbd>R</kbd> special<br>Combos: P-P-Heavy / P-K-K')));
    bus.on('mirror', () => this.toast(T('โดนสวน! ใช้จับทุ่มแทน', 'Countered! Try a grab instead'), 'red'));
    bus.on('noMeter', () => this.toast(T('เกจพิเศษยังไม่เต็ม', 'Special meter not full'), 'small'));
    bus.on('bossPhase', (e) => { const P = e.f.phases[e.phase]; this.toast(`${e.phase === 2 ? t('final') : t('phase') + ' ' + (e.phase + 1)}: ${tx(P.name)}`, 'red'); });
    bus.on('bossDefeated', (e) => this.toast(`${t('ko')} ${e.f.name}`, 'gold'));
    bus.on('playerDown', () => { const f = this.q('#fade'); f.classList.add('on'); (f.firstElementChild as HTMLElement).textContent = t('youLose'); });
    bus.on('respawn', (e) => { this.q('#fade').classList.remove('on'); if (e.lost) this.toast(`-¥${e.lost}`, 'small red'); });
    bus.on('streetEvent', (e) => { const m: Record<string, [string, string]> = { bully: ['มีเด็กโดนรังแก! ไปช่วยกันเถอะ', 'Someone is being bullied! Help out'], challenge: ['มีคนมาท้าดวล!', 'A challenger appears!'], gangwar: ['แก๊งตีกันอยู่ใกล้ๆ!', 'Gang fight nearby!'], ambush: ['โดนซุ่มโจมตี!', 'Ambush!'], rumble: ['ศึกตะลุมบอนกลางถนน!', 'Street rumble!'], robbery: ['มีโจรปล้นร้านค้า!', 'A shop is being robbed!'] }; this.toast('! ' + T(...m[e.kind]), 'gold'); });
    bus.on('eventDone', (e) => this.toast(`${T('เหตุการณ์สำเร็จ', 'Event cleared')}  +${e.rep} ${t('rep')}  ¥${e.money}`, 'small gold'));
    bus.on('itemUsed', (e) => this.toast(T('ใช้ไอเทม', 'Used item') + ' ✓', 'small'));
    bus.on('chat', (m) => { let txt = m.text; try { txt = tx(JSON.parse(m.text)); } catch {} const d = el(`<div><b></b> </div>`); (d.firstChild as HTMLElement).textContent = m.from + ':'; d.append(' ' + txt); this.q('#chat').appendChild(d); setTimeout(() => d.remove(), 9000); });
    bus.on('relation', (e) => { const c = CHAR_BY_ID[e.id]; if (c) this.toast(`${tx(c.name)} ♥ ${e.value}`, 'small'); });
    bus.on('toast', (e) => this.toast(e.text, 'small'));
    bus.on('autoToggle', (e) => { this.toast(e.on ? T('AUTO เปิด: เดินหาศัตรูอัตโนมัติ (ต่อยเองนะ!)', 'AUTO ON: walks to enemies (you still fight!)') : T('AUTO ปิด', 'AUTO OFF'), e.on ? 'small blue' : 'small'); if (e.on) this.hint('auto', 'AUTO', T('AUTO จะเดินไปหาศัตรูที่ใกล้ที่สุดและหยุดในระยะต่อย แต่ <b>ไม่โจมตี/การ์ด/หลบให้</b> ขยับจอยหรือ WASD เพื่อควบคุมเองได้ทันที', 'AUTO walks to the nearest enemy and stops in punching range, but <b>never attacks, blocks or dodges</b>. Move the stick / WASD to take over at any time.')); });
    bus.on('autoNoTarget', (e) => {
      let dir = ''; if (e.dir !== null && e.dist > 8) { const F = Math.atan2(-Math.sin(this.w.camYaw), -Math.cos(this.w.camYaw)); let rel = e.dir - F; while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2; dir = ' ' + ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8] + ' ' + Math.round(e.dist) + 'm'; }
      this.toast(T('AUTO: ไม่มีศัตรูใกล้ๆ', 'AUTO: no enemies nearby') + (dir ? '  ' + T('เป้าหมายเควส', 'quest') + dir : ''), 'small');
    });
    bus.on('teleport', () => { this.r.camTarget.set(0, 0, 0); });
  }
  private autoTxt = '';
  update(dt: number) {
    { const w = this.w; let s = ''; if (w.auto) { const st = w.autoStatus; const tn = w.autoTarget?.alive ? w.autoTarget.name : ''; s = st === 'paused' ? 'AUTO ⏸' : st === 'manual' ? 'AUTO · ' + T('ควบคุมเอง', 'manual') : st === 'none' ? 'AUTO · ' + T('ไม่มีศัตรู', 'no target') : st === 'engage' ? 'AUTO ◉ ' + tn : 'AUTO ▶ ' + tn; }
      if (s !== this.autoTxt) { this.autoTxt = s; const e = this.q('#h-auto'); e.textContent = s; e.style.display = s ? 'block' : 'none'; e.classList.toggle('eng', w.autoStatus === 'engage'); } }
    const w = this.w, p = w.player, g = w.progress, $ = (s: string) => this.q(s);
    this.root.classList.toggle('hidden', w.menuOpen);
    $('#h-hp').style.width = (p.hp / p.maxHp * 100) + '%'; $('#h-hpb').style.width = (p.hp / p.maxHp * 100) + '%'; $('#h-hpt').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    $('#h-st').style.width = (p.stamina / p.maxStamina * 100) + '%'; $('#h-sp').style.width = p.meter + '%'; $('#h-spw').classList.toggle('full', p.meter >= 100);
    if (p.meter >= 100) this.hint('special', tx({ th: 'เกจพิเศษเต็ม!', en: 'Special ready!' }), tx({ th: 'กด <kbd>R</kbd> ใช้ "ไต้ฝุ่นขี้เกียจ" โจมตีรอบตัว', en: 'Press <kbd>R</kbd> for "Lazy Typhoon", a spinning area attack.' }));
    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 0.15;
      $('#h-lvl').textContent = `${t('level')}${g.level}`; $('#h-xp').style.width = (g.exp / expToNext(g.level) * 100) + '%';
      $('#h-rep').textContent = `${tx(REP_TIERS[g.repTier].name)} (${g.rep})`; $('#h-money').textContent = String(g.money);
      $('#h-title').textContent = w.custom.title || ''; $('#h-items').textContent = `🍙${g.inventory.onigiri || 0} 🥤${g.inventory.drink || 0} 🍱${g.inventory.bento || 0}`;
      const zn = w.zoneAt(p.x, p.z); const gang = zn.gang ? GANG_BY_ID[zn.gang] : null; const hh = Math.floor(w.clock), mm = Math.floor((w.clock % 1) * 60);
      const tod = w.nightFactor > 0.7 ? t('night') : w.clock >= 16.5 && w.clock < 20 ? t('evening') : w.clock < 11 ? t('morning') : t('day');
      $('#h-zone').innerHTML = `${p.layer === 1 ? tx({ th: 'ดาดฟ้าคุโรงาเนะ', en: 'Kurogane Rooftop' }) : tx(zn.name)}<small>${gang ? tx(gang.name) + (w.friendlyGangs.has(gang.id) ? ' ✓' : '') + ' · ' : ''}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${tod}</small>`;
      const o = w.quests.objective();
      if (o) { const d = Math.round(Math.hypot(o.pos[0] - p.x, o.pos[1] - p.z)); $('#h-quest').style.display = 'block'; $('#h-quest').innerHTML = `<h4>${tx(o.quest.title)}</h4><p>▶ ${o.text}</p><em>${d > 3 ? d + ' m' : ''}</em>`; }
      else $('#h-quest').style.display = 'none';
      const it = w.interactTarget; const pr = $('#prompt');
      if (it && !w.dialogue && !w.menuOpen) { pr.style.display = 'block'; pr.innerHTML = `<kbd>${this.touchMode ? '💬' : 'E'}</kbd>${tx(it.label)}`; } else pr.style.display = 'none';
      $('#fps').textContent = this.showFps ? `${Math.round(this.r.fps)} fps · ${w.fighters.length} fighters · q${this.r.quality}` : '';
    }
    // boss bar
    const boss = w.fighters.find(f => f.phases && f.alive && f.distTo(p) < 40) || null; const bb = $('#boss');
    if (boss) {
      bb.style.display = 'block'; $('#b-name').innerHTML = `${boss.name}<small>"${boss.displayTitle}"</small>`; $('#b-hp').style.width = (boss.hp / boss.maxHp * 100) + '%'; $('#b-hpb').style.width = (boss.hp / boss.maxHp * 100) + '%';
      $('#b-ph').innerHTML = [0, 1, 2].map(i => `<i class="${i <= boss.phase ? 'on' : ''}"></i>`).join('') + `<span>${boss.phase === 2 ? t('final') : t('phase') + ' ' + (boss.phase + 1)} · ${tx(boss.phases![boss.phase].name)}</span>`;
    } else bb.style.display = 'none';
    const cb = $('#combo'); if (p.comboCount >= 2) { cb.style.display = 'block'; $('#c-n').textContent = String(p.comboCount); } else cb.style.display = 'none';
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) $('#hint').style.display = 'none'; }
    this.drawTags(); this.drawMinimap();
    if (w.dialogue) this.showDialogue(); else document.getElementById('dialogue')?.remove();
  }
  touchMode = false; showFps = false;
  private drawTags() {
    const w = this.w, p = w.player, r = this.r; let ti = 0, bi = 0;
    const tag = () => { let e = this.tagPool[ti]; if (!e) { e = el(`<div class="tag"><div class="tn"></div><div class="th"><i></i></div></div>`); this.tags.appendChild(e); this.tagPool.push(e); } ti++; e.style.display = 'block'; return e; };
    const bub = (x: number, y: number, z: number, text: string) => { const s = r.project(x, y, z); if (!s.vis) return; let e = this.bubblePool[bi]; if (!e) { e = el(`<div class="bubble"></div>`); this.tags.appendChild(e); this.bubblePool.push(e); } bi++; e.style.display = 'block'; e.textContent = text; e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; };
    for (const f of w.fighters) {
      if (f.isPlayer || f.layer !== p.layer) continue; const d = f.distTo(p);
      if (f.alive && (f.aggro || f.feud || d < 10) && d < 22 && !f.phases && !f.civilian) {
        const s = r.project(f.x, f.y + 2.25 * (f.appearance?.height || 1) + f.layer * ROOF.y, f.z); if (!s.vis) continue; const e = tag();
        e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; (e.querySelector('.tn') as HTMLElement).textContent = `${f.name}${f.tier === 'mid' ? ' ★' : f.tier === 'miniboss' ? ' ★★' : ''}`;
        (e.querySelector('.th i') as HTMLElement).style.width = (f.hp / f.maxHp * 100) + '%'; e.classList.toggle('friendly', !f.hostileToPlayer && !f.aggro && !f.feud);
      }
      if (f.bubbleT > 0 && f.bubble && d < 30) bub(f.x, f.y + 2.5 + f.layer * ROOF.y, f.z, f.bubble === 'flee' ? tx({ th: 'หนีเร็ว!!', en: 'RUN!!' }) : f.bubble);
    }
    // simulated online players (NetworkAdapter ghosts)
    if (p.layer === 0) for (const [, rm] of w.remotes) { const d = Math.hypot(rm.x - p.x, rm.z - p.z); if (d > 25) continue; const s = r.project(rm.x, 2.3, rm.z); if (!s.vis) continue; const e = tag();
      e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; (e.querySelector('.tn') as HTMLElement).textContent = `🌐 ${rm.name} Lv${rm.level}`; (e.querySelector('.th i') as HTMLElement).style.width = '100%'; e.classList.add('friendly'); }
    // quest marker
    const o = w.quests.objective();
    if (o && o.layer === p.layer) { const d = Math.hypot(o.pos[0] - p.x, o.pos[1] - p.z); if (d > 6) { const s = r.project(o.pos[0], 3 + o.layer * ROOF.y, o.pos[1]); if (s.vis) { let m = this.tags.querySelector('.marker') as HTMLElement; if (!m) { m = el(`<div class="marker">▼<small></small></div>`); this.tags.appendChild(m); } m.style.display = 'block'; m.style.left = s.x + 'px'; m.style.top = s.y + 'px'; (m.lastChild as HTMLElement).textContent = Math.round(d) + 'm'; } else this.hideMarker(); } else this.hideMarker(); } else this.hideMarker();
    // NPC names
    for (const it of w.interactables()) if (it.kind === 'npc' && (it.layer || 0) === p.layer) { const d = Math.hypot(it.pos[0] - p.x, it.pos[1] - p.z); if (d < 9) { const s = r.project(it.pos[0], 2.2 + (it.layer || 0) * ROOF.y, it.pos[1]); if (s.vis) { const e = tag(); e.style.left = s.x + 'px'; e.style.top = s.y + 'px'; (e.querySelector('.tn') as HTMLElement).textContent = it.npc && CHAR_BY_ID[it.npc] ? tx(CHAR_BY_ID[it.npc].name) : tx({ th: 'คุณยาย', en: 'Grandma' }); (e.querySelector('.th') as HTMLElement).style.display = 'none'; } } }
    // crowd reactions by reputation tier
    const tier = w.progress.repTier;
    if (Math.random() < 0.01 && p.layer === 0) {
      for (const cw of w.crowd.walkers) { if (!cw.active) continue; const d = Math.hypot(cw.x - p.x, cw.z - p.z); if (d < 7 && d > 1.5) { const lines = cw.kind === 5 ? CHAT_BARKS : CROWD_BARKS[Math.min(tier, 6)]; if (tier === 0 && cw.kind !== 5 && Math.random() < 0.6) break; this.crowdBubbles.push({ x: cw.x, z: cw.z, text: tx(lines[Math.floor(Math.random() * lines.length)]), t: 2.6 }); break; } }
    }
    this.crowdBubbles = this.crowdBubbles.filter(b => (b.t -= 1 / 60) > 0); for (const b of this.crowdBubbles) bub(b.x, 2.2, b.z, b.text);
    for (let i = ti; i < this.tagPool.length; i++) { this.tagPool[i].style.display = 'none'; (this.tagPool[i].querySelector('.th') as HTMLElement).style.display = ''; }
    for (let i = bi; i < this.bubblePool.length; i++) this.bubblePool[i].style.display = 'none';
  }
  private hideMarker() { const m = this.tags.querySelector('.marker') as HTMLElement; if (m) m.style.display = 'none'; }
  private drawMinimap() {
    const w = this.w, p = w.player, c = this.mmc, S = this.mm.width; const scale = 1.25; // px per meter
    c.save(); c.clearRect(0, 0, S, S); c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.clip(); c.fillStyle = '#2a2c30'; c.fillRect(0, 0, S, S);
    c.translate(S / 2, S / 2); c.rotate(w.camYaw); c.scale(scale, scale); c.translate(-p.x, -p.z);
    c.drawImage(this.mapImg, -MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
    for (const b of BUS_STOPS) { c.fillStyle = '#3a8ae8'; c.fillRect(b.pos[0] - 2, b.pos[1] - 2, 4, 4); }
    for (const f of w.fighters) { if (f.isPlayer || !f.alive || f.layer !== p.layer) continue; c.fillStyle = f.phases ? '#ff2a2a' : f.aggro || f.feud ? '#ff5a3a' : f.hostileToPlayer ? '#ffa040' : '#70d070'; c.beginPath(); c.arc(f.x, f.z, f.phases ? 3.2 : 2, 0, 7); c.fill(); }
    for (const it of w.interactables()) if (it.kind === 'npc' && (it.layer || 0) === p.layer) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(it.pos[0], it.pos[1], 1.8, 0, 7); c.fill(); }
    if (w.event && !w.event.done) { c.fillStyle = '#ffd23a'; c.font = 'bold 14px sans-serif'; c.fillText('!', w.event.x - 2, w.event.z + 5); }
    c.restore();
    // objective arrow/diamond (clamped to edge)
    const o = w.quests.objective();
    if (o) {
      const dx = o.pos[0] - p.x, dz = o.pos[1] - p.z; const a = w.camYaw; const rx = (dx * Math.cos(a) - dz * Math.sin(a)) * scale, rz = (dx * Math.sin(a) + dz * Math.cos(a)) * scale;
      let mx = rx, mz = rz; const lim = S / 2 - 10; const L = Math.hypot(mx, mz); if (L > lim) { mx = mx / L * lim; mz = mz / L * lim; }
      c.save(); c.translate(S / 2 + mx, S / 2 + mz); c.rotate(Math.PI / 4); c.fillStyle = '#ffd23a'; c.strokeStyle = '#111'; c.lineWidth = 2; c.fillRect(-6, -6, 12, 12); c.strokeRect(-6, -6, 12, 12); c.restore();
    }
    // player arrow (map rotates with camera, so arrow shows facing relative to camera)
    c.save(); c.translate(S / 2, S / 2); c.rotate(-(p.yaw - w.camYaw) + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#d6263a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -9); c.lineTo(6.5, 7); c.lineTo(0, 3); c.lineTo(-6.5, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.fillStyle = '#fff'; c.font = 'bold 13px Bangers, sans-serif'; c.textAlign = 'center'; const na = w.camYaw; c.fillText('N', S / 2 + Math.sin(na) * (S / 2 - 12), S / 2 - Math.cos(na) * (S / 2 - 12) + 4);
  }
  private showDialogue() {
    const d = this.w.dialogue!; const line = d.lines[d.i]; let box = document.getElementById('dialogue');
    const key = d.i + '|' + d.lines.length + '|' + getLang();
    if (box && box.dataset.key === key) return;
    if (!box) { box = el(`<div id="dialogue" class="panel"><div class="who"></div><div class="txt"></div><div class="ch"></div><div class="next"></div></div>`); this.root.parentElement!.appendChild(box); box.style.display = 'block';
      box.addEventListener('click', (e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON' && !this.w.dialogue?.lines[this.w.dialogue.i]?.choices) this.w.advanceDialogue(-1); }); }
    box.dataset.key = key; box.style.display = 'block';
    (box.querySelector('.who') as HTMLElement).textContent = speakerName(line.s);
    (box.querySelector('.txt') as HTMLElement).textContent = tx(line.t);
    const ch = box.querySelector('.ch') as HTMLElement; ch.innerHTML = '';
    if (line.choices) line.choices.forEach((c, i) => { const b = document.createElement('button'); b.textContent = tx(c.t); b.onclick = (e) => { e.stopPropagation(); this.w.advanceDialogue(i); }; ch.appendChild(b); });
    (box.querySelector('.next') as HTMLElement).textContent = line.choices ? '' : (this.touchMode ? tx({ th: 'แตะเพื่อไปต่อ ▶', en: 'Tap to continue ▶' }) : tx({ th: 'E / คลิก ▶', en: 'E / Click ▶' }));
  }
}
/** Pre-rendered top-down map (used by minimap and the territory map). */
export function renderMapImage(w: World, territory: number): HTMLCanvasElement {
  const S = 800, k = S / (MAP_HALF * 2); const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d')!;
  const X = (x: number) => (x + MAP_HALF) * k;
  c.fillStyle = '#5a5a58'; c.fillRect(0, 0, S, S);
  const col: Record<string, string> = { road: '#2a2b30', tile: '#b8a888', grass: '#5a9a44', dirt: '#a8905e', concrete: '#7e7e78', parking: '#3a3c40', deck: '#8a8680', water: '#3a78c8', rail: '#4a3e30', roof: '#5a5a58' };
  for (const p of w.city.patches) { if (p.kind === 'roof') continue; c.fillStyle = col[p.kind] || '#666'; c.fillRect(X(p.x0), X(p.z0), (p.x1 - p.x0) * k, (p.z1 - p.z0) * k); }
  if (territory) for (const z of ZONES) { if (!z.gang) continue; const g = GANG_BY_ID[z.gang]; c.fillStyle = g.color === '#e6e6ee' ? '#9ab8e8' : g.color; c.globalAlpha = territory > 1 ? 0.38 : 0.22; c.fillRect(X(z.rect[0]), X(z.rect[1]), (z.rect[2] - z.rect[0]) * k, (z.rect[3] - z.rect[1]) * k); c.globalAlpha = 1; }
  c.fillStyle = '#d8d4c8'; c.strokeStyle = '#111'; c.lineWidth = 1;
  for (const b of w.city.buildings) { c.fillStyle = b.sign ? '#f0d8a0' : '#cfcac0'; c.fillRect(X(b.x0), X(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k); c.strokeRect(X(b.x0), X(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k); }
  return cv;
}
