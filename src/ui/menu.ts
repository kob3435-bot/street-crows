import type { World } from '../sim/world';
import { ITEMS } from '../sim/world';
import { tx, t, getLang, setLang } from '../core/i18n';
import { bus } from '../core/events';
import { QUESTS, QUEST_BY_ID } from '../data/quests';
import { SKILLS, BRANCH_NAMES, type Branch } from '../data/skills';
import { STAT_KEYS, STAT_NAMES, REP_TIERS, REL_LABELS, expToNext } from '../sim/progression';
import { GANGS, GANG_BY_ID } from '../data/gangs';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { ZONES, MAP_HALF, PLACES, BUS_STOPS } from '../data/city';
import { NPC_CHATTER } from '../data/barks';
import { renderMapImage } from './hud';
import type { SaveProvider } from '../core/save';
import { audio } from '../core/audio';

export interface Settings { quality: number; volume: number; music: number; sens: number; invertY: boolean; fps: boolean; zoom: number }
export function loadSettings(): Settings {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const def: Settings = { quality: coarse ? 0 : 1, volume: 0.8, music: 0.5, sens: 1, invertY: false, fps: false, zoom: 11 };
  try { return { ...def, ...JSON.parse(localStorage.getItem('sc_settings') || '{}') }; } catch { return def; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem('sc_settings', JSON.stringify(s)); } catch {} }
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const TABS = ['quests', 'status', 'skills', 'map', 'style', 'relations', 'roster', 'controls', 'settings', 'save'] as const;
type Tab = typeof TABS[number];
const HAIRS = ['spiky', 'pompadour', 'messy', 'slick', 'buzz', 'long', 'mohawk', 'topknot'];
const COLORS = ['#2b3a67', '#1e1f2a', '#2a2a33', '#e8e8ee', '#6b1f24', '#24365e', '#4b2a6b', '#1f4a3a', '#b02a2a', '#8a4a1c', '#d8b040'];
const SHIRTS = ['#d6263a', '#f2f2f2', '#101010', '#2a6fd6', '#f0a020', '#60c060', '#e070b0'];
const HAIRC = ['#2a1c14', '#101010', '#8a3a1a', '#d8b040', '#d0d0d0', '#8a1a8a', '#2a5ad0', '#d06a20'];
const ACCS = ['none', 'headband', 'shades', 'bandage', 'chain', 'cap'];
const TITLES = [{ th: '', en: '' }, { th: 'หนุ่มย้ายมาใหม่', en: 'The Transfer' }, { th: 'จอมขี้เกียจ', en: 'Lazy Genius' }, { th: 'ราชาราเมง', en: 'Ramen King' }, { th: 'ผู้ไม่ขอเป็นหัวหน้า', en: 'The Un-Boss' }, { th: 'อีกาแห่งอาเคโบโนะ', en: 'Crow of Akebono' }];

/** Tab menu + modals (shop, travel, rest, quest offer) + title screen. */
export class Menu {
  root: HTMLElement; body!: HTMLElement; tab: Tab = 'quests'; modal: HTMLElement; title: HTMLElement | null = null;
  onQuality: (q: number) => void = () => {}; onStart: (mode: 'new' | 'continue' | string) => void = () => {}; onSettings: () => void = () => {};
  constructor(parent: HTMLElement, private w: World, private saves: SaveProvider, public settings: Settings) {
    this.root = document.createElement('div'); this.root.className = 'modal'; this.root.id = 'menu'; parent.appendChild(this.root);
    this.modal = document.createElement('div'); this.modal.className = 'modal'; this.modal.id = 'modal'; parent.appendChild(this.modal);
    bus.on('menuKey', (e) => {
      if (this.title) return;
      if (this.modal.classList.contains('on')) { this.closeModal(); return; }
      if (e.key === 'map') { this.open('map'); return; } if (e.key === 'help') { this.open('controls'); return; }
      if (this.isOpen) this.close(); else this.open(e.key === 'pause' ? 'status' : this.tab);
    });
    bus.on('openShop', (e) => this.shop(e.id)); bus.on('openTravel', () => this.travel()); bus.on('openRest', () => this.rest());
    bus.on('questOffer', (e) => this.offer(e.q)); bus.on('npcTalk', (e) => this.npcTalk(e.npc));
  }
  get isOpen() { return this.root.classList.contains('on'); }
  open(tab: Tab = this.tab) { this.tab = tab; this.root.classList.add('on'); this.w.menuOpen = true; document.exitPointerLock?.(); this.render(); audio.play('ui'); }
  close() { this.root.classList.remove('on'); this.w.menuOpen = this.modal.classList.contains('on'); }
  render() {
    const L = getLang();
    this.root.innerHTML = `<div class="menu"><div class="tabs">${TABS.map(k => `<button data-t="${k}" class="${k === this.tab ? 'on' : ''}">${t(k)}</button>`).join('')}<button class="x" data-x>✕ ${t('close')}</button></div><div class="mbody"></div></div>`;
    this.body = this.root.querySelector('.mbody')!;
    this.root.querySelectorAll('[data-t]').forEach(b => (b as HTMLElement).onclick = () => { this.tab = (b as HTMLElement).dataset.t as Tab; this.render(); audio.play('ui'); });
    (this.root.querySelector('[data-x]') as HTMLElement).onclick = () => this.close();
    (this as any)['r_' + this.tab]();
  }
  private r_quests() {
    const q = this.w.quests; const T = (th: string, en: string) => tx({ th, en });
    const act = q.active.map(a => { const d = QUEST_BY_ID[a.id]; const steps = d.steps.map((s, i) => `<p style="${i < a.step ? 'text-decoration:line-through;opacity:.5' : i === a.step ? 'font-weight:700' : 'opacity:.45'}">${i < a.step ? '✓' : i === a.step ? '▶' : '·'} ${esc(tx(s.obj))}</p>`).join('');
      return `<div class="card active ${q.tracked === a.id ? 'track' : ''}"><span class="tagline">${d.type.toUpperCase()}</span><h4>${esc(tx(d.title))}</h4><p><i>${esc(tx(d.desc))}</i></p>${steps}<button class="btn" data-track="${a.id}">${q.tracked === a.id ? '★ ' + T('กำลังติดตาม', 'Tracking') : T('ติดตาม', 'Track')}</button></div>`; }).join('') || `<p>${T('ไม่มีภารกิจ', 'No active quests')}</p>`;
    const giverName = (g?: string) => { if (!g) return ''; const it = this.w.interactables().find(i => i.id === g); return it ? tx(it.label) : g; };
    const avail = q.available().map(d => `<div class="card"><span class="tagline">${d.type.toUpperCase()}</span><h4>${esc(tx(d.title))}</h4><p>${esc(tx(d.desc))}</p><p>📍 ${esc(giverName(d.giver))}</p></div>`).join('') || `<p style="opacity:.6">-</p>`;
    const locked = QUESTS.filter(d => !q.done.has(d.id) && !q.isActive(d.id) && !q.available().includes(d) && !d.auto).map(d => `<div class="card done"><h4>🔒 ${esc(tx(d.title))}</h4><p>${d.minLevel ? 'Lv' + d.minLevel + ' · ' : ''}${d.requires.map(r => tx(QUEST_BY_ID[r].title)).join(', ')}</p></div>`).join('');
    const done = [...q.done].map(id => `<div class="card done"><h4>✓ ${esc(tx(QUEST_BY_ID[id].title))}</h4></div>`).join('');
    this.body.innerHTML = `<div class="grid2"><div><h3>${t('active')}</h3>${act}</div><div><h3>${t('available')}</h3>${avail}${locked}<h3>${t('completed')}</h3>${done || '<p style="opacity:.6">-</p>'}</div></div>`;
    this.body.querySelectorAll('[data-track]').forEach(b => (b as HTMLElement).onclick = () => { q.tracked = (b as HTMLElement).dataset.track!; this.render(); });
  }
  private r_status() {
    const g = this.w.progress, p = this.w.player, s = this.w.stats; const T = (th: string, en: string) => tx({ th, en });
    const stats = STAT_KEYS.map(k => `<div class="stat"><label>${tx(STAT_NAMES[k])}</label><span class="v">${g.stats[k]}</span><div class="pbar"><i style="width:${g.stats[k] / 30 * 100}%"></i></div><button class="btn" data-stat="${k}" ${g.statPoints ? '' : 'disabled'}>+</button></div>`).join('');
    const inv = Object.entries(ITEMS).map(([id, it]) => `<div class="row"><span>${tx(it.name)} ×${g.inventory[id] || 0} <small>(+${it.heal} HP)</small></span><button class="btn" data-use="${id}" ${g.inventory[id] ? '' : 'disabled'}>${T('ใช้', 'Use')} [${id === 'onigiri' ? 1 : id === 'drink' ? 2 : 3}]</button></div>`).join('');
    this.body.innerHTML = `<div class="grid2"><div><h3>${t('status')}</h3>
      <div class="card"><h4>ฮารุ โบยะ (ハル・ボーヤ) ${this.w.custom.title ? '— ' + esc(this.w.custom.title) : ''}</h4><p>${t('level')} ${g.level} · EXP ${g.exp}/${expToNext(g.level)}</p><p>HP ${Math.ceil(p.hp)}/${p.maxHp} · Stamina ${p.maxStamina}</p><p>${t('rep')}: <b>${tx(REP_TIERS[g.repTier].name)}</b> (${g.rep}) ${REP_TIERS[g.repTier + 1] ? '→ ' + REP_TIERS[g.repTier + 1].min : ''}</p><p>${t('money')}: ¥${g.money}</p></div>
      <p><b>${t('statPoints')}: ${g.statPoints}</b></p>${stats}
      <p style="font-size:12px;opacity:.75">${T('พลัง=ดาเมจ · ความเร็ว=เดิน/ความเร็วท่า · ป้องกัน=ลดดาเมจ · เทคนิค=ทำให้มึน/ทุบการ์ด · สวนกลับ=ดาเมจ+ช่วงสวน · เสน่ห์=ชื่อเสียง/เงิน/ความสัมพันธ์', 'Power=damage · Speed=move/attack speed · Defense=damage taken · Technique=stun & guard damage · Counter=counter dmg & window · Charisma=rep/money/relationships')}</p></div>
      <div><h3>${T('ไอเทม', 'Items')}</h3>${inv}<h3>${T('สถิติ', 'Record')}</h3><div class="card"><p>KO: ${s.kills} · ${T('บอส', 'Bosses')}: ${s.bossKills} · Max combo: ${s.maxCombo}</p><p>${T('สวนกลับ', 'Counters')}: ${s.counters} · ${T('ทุ่ม', 'Throws')}: ${s.throws} · ${T('ปิดฉาก', 'Finishers')}: ${s.finishers} · ${T('หลบเพอร์เฟกต์', 'Perfect dodges')}: ${s.perfectDodges}</p><p>${T('บอสที่ล้มแล้ว', 'Bosses defeated')}: ${[...this.w.bosses].map(b => tx(CHAR_BY_ID[b].name)).join(', ') || '-'}</p><p>${T('เวลาเล่น', 'Play time')}: ${Math.floor(this.w.playTime / 60)} min</p></div></div></div>`;
    this.body.querySelectorAll('[data-stat]').forEach(b => (b as HTMLElement).onclick = () => { g.raise((b as HTMLElement).dataset.stat as any); this.w.refreshPlayerStats(); audio.play('ui'); this.render(); });
    this.body.querySelectorAll('[data-use]').forEach(b => (b as HTMLElement).onclick = () => { this.w.useItem((b as HTMLElement).dataset.use!); this.render(); });
  }
  private r_skills() {
    const g = this.w.progress; const branches = Object.keys(BRANCH_NAMES) as Branch[];
    const col = (br: Branch) => `<div class="branch"><h4>${tx(BRANCH_NAMES[br])}</h4>${SKILLS.filter(s => s.branch === br).map(s => { const c = g.canLearn(s.id); const learned = g.has(s.id);
      const why = c.why === 'level' ? `Lv${s.minLevel}` : c.why === 'requires' ? '🔒' : c.why === 'points' ? `${s.cost} SP` : '';
      return `<div class="skill ${learned ? 'learned' : c.ok ? '' : 'locked'}"><h5>${learned ? '★ ' : ''}${esc(tx(s.name))}</h5><p>${esc(tx(s.desc))}</p>${learned ? `<b>${t('learned')}</b>` : `<button class="btn" data-sk="${s.id}" ${c.ok ? '' : 'disabled'}>${t('learn')} (${s.cost} SP) ${why}</button>`}</div>`; }).join('')}</div>`;
    this.body.innerHTML = `<h3>${t('skills')}</h3> <b style="margin-left:10px">${t('skillPoints')}: ${g.skillPoints}</b><div class="grid5">${branches.map(col).join('')}</div>`;
    this.body.querySelectorAll('[data-sk]').forEach(b => (b as HTMLElement).onclick = () => { if (g.learn((b as HTMLElement).dataset.sk!)) { this.w.refreshPlayerStats(); audio.play('levelup'); bus.emit('skillLearned', {}); bus.emit('save', { reason: 'skill' }); } this.render(); });
  }
  private r_map() {
    const img = renderMapImage(this.w, 2); const cv = document.createElement('canvas'); cv.id = 'mapcv'; cv.width = cv.height = 800; const c = cv.getContext('2d')!; c.drawImage(img, 0, 0);
    const k = 800 / (MAP_HALF * 2), X = (v: number) => (v + MAP_HALF) * k; c.textAlign = 'center';
    for (const z of ZONES) { const g = z.gang ? GANG_BY_ID[z.gang] : null; c.font = '700 15px Kanit, sans-serif'; c.lineWidth = 4; c.strokeStyle = '#000'; c.fillStyle = '#fff'; const cx = X((z.rect[0] + z.rect[2]) / 2), cz = X((z.rect[1] + z.rect[3]) / 2); c.strokeText(tx(z.name), cx, cz); c.fillText(tx(z.name), cx, cz); if (g) { c.font = '12px Kanit, sans-serif'; c.fillStyle = this.w.friendlyGangs.has(g.id) ? '#8f8' : '#ffd23a'; c.strokeText(tx(g.name), cx, cz + 15); c.fillText(tx(g.name), cx, cz + 15); } }
    for (const b of BUS_STOPS) { c.fillStyle = '#3a8ae8'; c.fillRect(X(b.pos[0]) - 5, X(b.pos[1]) - 5, 10, 10); }
    const p = this.w.player; c.fillStyle = '#d6263a'; c.beginPath(); c.arc(X(p.x), X(p.z), 8, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
    const o = this.w.quests.objective(); if (o) { c.fillStyle = '#ffd23a'; c.save(); c.translate(X(o.pos[0]), X(o.pos[1])); c.rotate(Math.PI / 4); c.fillRect(-8, -8, 16, 16); c.strokeStyle = '#000'; c.strokeRect(-8, -8, 16, 16); c.restore(); }
    const legend = GANGS.filter(g => g.territory.length).map(g => `<div class="row" style="justify-content:flex-start"><span class="swatch" style="background:${g.color}"></span>${esc(tx(g.name))} ${this.w.friendlyGangs.has(g.id) ? '✓' : g.hostileToPlayer ? '⚔' : ''}</div>`).join('');
    this.body.innerHTML = `<h3>${t('territory')}</h3><div class="grid2"><div id="mapwrap"></div><div>${legend}<p style="font-size:12px">🟥 ${tx({ th: 'คุณ', en: 'You' })} · 🔶 ${tx({ th: 'เป้าหมาย', en: 'Objective' })} · 🟦 ${tx({ th: 'ป้ายรถเมล์', en: 'Bus stop' })} · ✓ ${tx({ th: 'เป็นมิตร', en: 'Friendly' })} · ⚔ ${tx({ th: 'ศัตรู', en: 'Hostile' })}</p></div></div>`;
    this.body.querySelector('#mapwrap')!.appendChild(cv);
  }
  private r_style() {
    const c = this.w.custom; const T = (th: string, en: string) => tx({ th, en });
    const sw = (key: string, list: string[]) => list.map(v => `<span class="swatch ${(c as any)[key] === v ? 'on' : ''}" style="background:${v}" data-k="${key}" data-v="${v}"></span>`).join('');
    const cyc = (key: string, list: string[]) => `<button class="btn" data-cyc="${key}" data-d="-1">◀</button><span class="val">${(c as any)[key]}</span><button class="btn" data-cyc="${key}" data-d="1">▶</button>`;
    this.body.innerHTML = `<h3>${t('style')}</h3><p style="font-size:12px">${T('หน้าตาและนิสัยของฮารุคงที่ แต่การแต่งตัวเปลี่ยนได้', 'Haru\'s face and personality are fixed; his look is yours.')}</p>
      <div class="opt"><label>${t('hair')}</label>${cyc('hair', HAIRS)}</div><div class="opt"><label>${t('hairColor')}</label>${sw('hairColor', HAIRC)}</div>
      <div class="opt"><label>${t('jacket')}</label>${sw('jacket', COLORS)}</div><div class="opt"><label>${t('shirt')}</label>${sw('shirt', SHIRTS)}</div>
      <div class="opt"><label>${t('pants')}</label>${sw('pants', ['#1b1c24', '#2a2a33', '#3a3e48', '#24365e', '#d8d8e0', '#4a3a2a'])}</div><div class="opt"><label>${t('shoes')}</label>${sw('shoes', ['#f0f0f0', '#111111', '#c83030', '#e0c040', '#3a70c0'])}</div>
      <div class="opt"><label>${t('accessory')}</label>${cyc('accessory', ACCS)}</div>
      <div class="opt"><label>${T('ทรงเสื้อ', 'Coat')}</label><button class="btn" data-tog="longCoat">${c.longCoat ? T('เสื้อยาว (โชรัน)', 'Long coat') : T('เสื้อสั้น', 'Short jacket')}</button><button class="btn" data-tog="openJacket">${c.openJacket ? T('เปิดอก', 'Open') : T('ติดกระดุม', 'Buttoned')}</button></div>
      <div class="opt"><label>${t('title')}</label><select id="titlesel" class="btn">${TITLES.map(ti => `<option value="${esc(tx(ti))}" ${c.title === tx(ti) ? 'selected' : ''}>${esc(tx(ti)) || '—'}</option>`).join('')}</select></div>`;
    const apply = () => { this.w.custom = { ...c }; this.w.player.appearance = this.w.custom; bus.emit('appearance'); this.render(); };
    this.body.querySelectorAll('[data-k]').forEach(b => (b as HTMLElement).onclick = () => { (c as any)[(b as HTMLElement).dataset.k!] = (b as HTMLElement).dataset.v; apply(); });
    this.body.querySelectorAll('[data-cyc]').forEach(b => (b as HTMLElement).onclick = () => { const k = (b as HTMLElement).dataset.cyc!; const list = k === 'hair' ? HAIRS : ACCS; const i = list.indexOf((c as any)[k]); (c as any)[k] = list[(i + Number((b as HTMLElement).dataset.d) + list.length) % list.length]; apply(); });
    this.body.querySelectorAll('[data-tog]').forEach(b => (b as HTMLElement).onclick = () => { const k = (b as HTMLElement).dataset.tog!; (c as any)[k] = !(c as any)[k]; apply(); });
    (this.body.querySelector('#titlesel') as HTMLSelectElement).onchange = (e) => { c.title = (e.target as HTMLSelectElement).value; apply(); };
  }
  private r_relations() {
    const ids = Object.keys(this.w.relations);
    const lab = (v: number) => { let n = REL_LABELS[0].name; for (const r of REL_LABELS) if (v >= r.min) n = r.name; return tx(n); };
    this.body.innerHTML = `<h3>${t('relations')}</h3>` + ids.map(id => { const c = CHAR_BY_ID[id]; const v = this.w.relations[id]; return `<div class="relrow"><span class="n">${esc(tx(c.name))} <small>"${esc(tx(c.nickname))}"</small></span><div class="rb"><i style="left:${(v + 100) / 2}%"></i></div><span class="lab">${lab(v)} (${v})</span></div>`; }).join('');
  }
  private r_roster() {
    const T = (th: string, en: string) => tx({ th, en });
    const gangs = GANGS.map(g => `<div class="card"><span class="swatch" style="background:${g.color};vertical-align:middle"></span> <b>${esc(tx(g.name))}</b> <small>${g.jp}</small><p>${esc(tx(g.style))}</p><p style="font-size:12px">${esc(tx(g.history))}</p><p style="font-size:12px">${T('หัวหน้า', 'Leader')}: ${esc(tx(CHAR_BY_ID[g.leader]?.name || { th: '-', en: '-' }))} · ${T('สมาชิก', 'Members')}: ${g.members}</p></div>`).join('');
    const chars = CHARACTERS.filter(c => c.id !== 'haru').map(c => `<div class="card"><h4>${esc(tx(c.name))} <small>${c.jp} · "${esc(tx(c.nickname))}"</small> ${this.w.bosses.has(c.id) ? '✓' : ''}</h4><p><span class="tagline">${c.tier.toUpperCase()}</span>${esc(tx(GANG_BY_ID[c.gang]?.name || { th: 'ไม่สังกัด', en: 'Unaffiliated' }))} · ${c.age ? c.age + T(' ปี', 'y') : '??'} · ${T('พลัง', 'Power')} ${c.power}</p><p>${esc(tx(c.role))} — ${esc(tx(c.personality))}</p><p style="font-size:12px">${esc(tx(c.backstory))}</p><p style="font-size:12px">${T('สไตล์', 'Style')}: ${esc(tx(c.style))} · ${T('ท่าไม้ตาย', 'Signature')}: ${esc(tx(c.signature))}<br>${T('จุดแข็ง', 'Strengths')}: ${esc(tx(c.strengths))} · ${T('จุดอ่อน', 'Weaknesses')}: ${esc(tx(c.weaknesses))}</p></div>`).join('');
    this.body.innerHTML = `<div class="grid2"><div><h3>${T('แก๊ง/โรงเรียน', 'Gangs & Schools')}</h3>${gangs}</div><div><h3>${T('นักสู้', 'Fighters')} (${CHARACTERS.length})</h3>${chars}</div></div>`;
  }
  private r_controls() { this.body.innerHTML = controlsHTML(); }
  private r_settings() {
    const s = this.settings;
    this.body.innerHTML = `<h3>${t('settings')}</h3>
      <div class="opt"><label>${t('language')}</label><button class="btn" data-lang="th">ไทย</button><button class="btn" data-lang="en">English</button></div>
      <div class="opt"><label>${t('quality')}</label>${[0, 1, 2].map(q => `<button class="btn ${s.quality === q ? 'red' : ''}" data-q="${q}">${t(['low', 'med', 'high'][q])}</button>`).join('')}</div>
      <div class="opt"><label>${t('volume')}</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-s="volume"></div>
      <div class="opt"><label>${t('music')}</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-s="music"></div>
      <div class="opt"><label>${t('sens')}</label><input type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}" data-s="sens"></div>
      <div class="opt"><label>${tx({ th: 'ระยะกล้อง (ซูม)', en: 'Camera distance (zoom)' })}</label><input type="range" min="4.5" max="18" step="0.5" value="${s.zoom}" data-s="zoom"></div>
      <div class="opt"><label>${t('invertY')}</label><input type="checkbox" ${s.invertY ? 'checked' : ''} data-c="invertY"></div>
      <div class="opt"><label>FPS</label><input type="checkbox" ${s.fps ? 'checked' : ''} data-c="fps"></div>
      <p style="font-size:12px">${tx({ th: 'เปลี่ยนคุณภาพกราฟิกจะโหลดหน้าใหม่ (บันทึกเกมอัตโนมัติก่อน)', en: 'Changing quality reloads the page (autosaves first).' })}</p>`;
    this.body.querySelectorAll('[data-lang]').forEach(b => (b as HTMLElement).onclick = () => { setLang((b as HTMLElement).dataset.lang as any); this.render(); bus.emit('langChanged'); });
    this.body.querySelectorAll('[data-q]').forEach(b => (b as HTMLElement).onclick = () => { s.quality = Number((b as HTMLElement).dataset.q); saveSettings(s); this.onQuality(s.quality); });
    this.body.querySelectorAll('[data-s]').forEach(i => (i as HTMLInputElement).oninput = () => { (s as any)[(i as HTMLElement).dataset.s!] = Number((i as HTMLInputElement).value); saveSettings(s); this.onSettings(); });
    this.body.querySelectorAll('[data-c]').forEach(i => (i as HTMLInputElement).onchange = () => { (s as any)[(i as HTMLElement).dataset.c!] = (i as HTMLInputElement).checked; saveSettings(s); this.onSettings(); });
  }
  private async r_save() {
    const metas = await this.saves.list(); const T = (th: string, en: string) => tx({ th, en });
    const row = (slot: string) => { const m = metas.find(x => x.slot === slot); return `<div class="card"><div class="row"><b>${slot === 'auto' ? t('auto') : t('saveSlot') + ' ' + slot}</b><span>${m ? `Lv${m.level} · ${m.chapter} · ${new Date(m.savedAt).toLocaleString()}` : t('empty')}</span></div><div class="row" style="justify-content:flex-end">${slot !== 'auto' ? `<button class="btn" data-save="${slot}">${t('doSave')}</button>` : ''}<button class="btn" data-load="${slot}" ${m ? '' : 'disabled'}>${t('doLoad')}</button></div></div>`; };
    this.body.innerHTML = `<h3>${t('save')}</h3>${['auto', '1', '2', '3'].map(row).join('')}<p style="font-size:12px">${T('บันทึกอัตโนมัติทุก 45 วินาที และเมื่อเกิดเหตุการณ์สำคัญ (ภารกิจ/สกิล/ราเมง)', 'Autosaves every 45s and on key events (quests, skills, ramen).')}</p>`;
    this.body.querySelectorAll('[data-save]').forEach(b => (b as HTMLElement).onclick = async () => { await this.saves.save((b as HTMLElement).dataset.save!, this.w.serialize()); bus.emit('toast', { text: t('saved') }); this.render(); });
    this.body.querySelectorAll('[data-load]').forEach(b => (b as HTMLElement).onclick = async () => { const d = await this.saves.load((b as HTMLElement).dataset.load!); let ok = false; if (d) { try { this.w.load(d); ok = true; } catch (e) { console.warn(e); } } if (ok) { bus.emit('toast', { text: t('loaded') }); this.close(); } else bus.emit('toast', { text: tx({ th: 'ไฟล์เสีย โหลดไม่ได้', en: 'Save is corrupt' }) }); });
  }
  // ---------------- modals ----------------
  showModal(html: string) { this.modal.innerHTML = `<div class="panel small-modal">${html}</div>`; this.modal.classList.add('on'); this.w.menuOpen = true; document.exitPointerLock?.(); }
  closeModal() { this.modal.classList.remove('on'); this.w.menuOpen = this.isOpen; }
  private shop(id: string) {
    const T = (th: string, en: string) => tx({ th, en }); const g = this.w.progress;
    if (id === 'shop_ramen') {
      this.showModal(`<h3>🍜 ${T('ราเมงมารุอิจิ', 'Maruichi Ramen')}</h3><p>${T('ราเมงชามใหญ่ ฟื้น HP/สตามิน่าเต็ม + เกจพิเศษ 30', 'Mega bowl: full HP/stamina + 30 special meter')}</p><div class="row"><span>¥${this.w.ramenPrice()} · ${T('มีเงิน', 'You have')} ¥${g.money}</span><button class="btn red" id="eat">${T('กิน!', 'Eat!')}</button></div><div class="row"><span></span><button class="btn" id="cls">${t('close')}</button></div>`);
      (this.modal.querySelector('#eat') as HTMLElement).onclick = () => { if (this.w.eatRamen()) { audio.play('coin'); bus.emit('toast', { text: T('อร่อย! พลังเต็ม!', 'Delicious! Fully restored!') }); this.closeModal(); } else bus.emit('toast', { text: T('เงินไม่พอ', 'Not enough money') }); };
    } else {
      const rows = Object.entries(ITEMS).map(([k, it]) => `<div class="row"><span>${tx(it.name)} <small>+${it.heal}HP${it.stamina ? ' +ST' : ''}${it.meter ? ' +SP' : ''}</small> ×${g.inventory[k] || 0}</span><button class="btn" data-buy="${k}">¥${it.price}</button></div>`).join('');
      this.showModal(`<h3>🏪 ${T('แฮปปี้มาร์ท', 'Happy Mart')}</h3><p>${T('เงิน', 'Money')}: ¥<b id="mny">${g.money}</b></p>${rows}<div class="row"><span></span><button class="btn" id="cls">${t('close')}</button></div>`);
      this.modal.querySelectorAll('[data-buy]').forEach(b => (b as HTMLElement).onclick = () => { if (this.w.buy((b as HTMLElement).dataset.buy!)) { audio.play('coin'); this.shop(id); } else bus.emit('toast', { text: T('เงินไม่พอ', 'Not enough money') }); });
    }
    (this.modal.querySelector('#cls') as HTMLElement).onclick = () => this.closeModal();
  }
  private travel() {
    const T = (th: string, en: string) => tx({ th, en }); const dest: [string, [number, number]][] = [
      ['station', PLACES.station.pos], ['shotengai', [0, -12]], ['kurogane_yard', [-130, -84]], ['hakuryu_yard', [140, -84]], ['park', [-90, 22]], ['parking', [40, 10]], ['underbridge', [-10, 102]], ['tetsuwan_yard', [-10, 152]], ['warehouse', [90, 152]]];
    this.showModal(`<h3>🚌 ${t('travel')}</h3><p>${T('ค่ารถ ¥100', 'Fare ¥100')}</p>${dest.map(([k]) => `<div class="row"><span>${tx(PLACES[k].name)}</span><button class="btn" data-go="${k}">${T('ไป', 'Go')}</button></div>`).join('')}<div class="row"><span></span><button class="btn" id="cls">${t('cancel')}</button></div>`);
    this.modal.querySelectorAll('[data-go]').forEach(b => (b as HTMLElement).onclick = () => { if (this.w.progress.money < 100) { bus.emit('toast', { text: T('เงินไม่พอ', 'Not enough money') }); return; } this.w.progress.money -= 100; const d = dest.find(x => x[0] === (b as HTMLElement).dataset.go)!; this.w.teleport(d[1][0], d[1][1]); this.closeModal(); });
    (this.modal.querySelector('#cls') as HTMLElement).onclick = () => this.closeModal();
  }
  private rest() {
    const opts: [string, number][] = [['morning', 8], ['noon', 13], ['evening', 17.6], ['night', 21]];
    this.showModal(`<h3>🌙 ${t('rest')}</h3>${opts.map(([k, h]) => `<div class="row"><span>${t(k)} (${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '36' : '00'})</span><button class="btn" data-h="${h}">OK</button></div>`).join('')}<div class="row"><span></span><button class="btn" id="cls">${t('cancel')}</button></div>`);
    this.modal.querySelectorAll('[data-h]').forEach(b => (b as HTMLElement).onclick = () => { this.w.setClock(Number((b as HTMLElement).dataset.h)); const p = this.w.player; p.hp = p.maxHp; this.closeModal(); bus.emit('toast', { text: tx({ th: 'พักผ่อนเต็มที่', en: 'Well rested' }) }); });
    (this.modal.querySelector('#cls') as HTMLElement).onclick = () => this.closeModal();
  }
  private offer(q: any) {
    this.showModal(`<h3>📜 ${esc(tx(q.title))}</h3><p><span class="tagline" style="background:#111;color:#fff;padding:0 6px">${q.type.toUpperCase()}</span></p><p>${esc(tx(q.desc))}</p><p>${tx({ th: 'รางวัล', en: 'Reward' })}: ${q.reward.exp} EXP · ¥${q.reward.money} · +${q.reward.rep} ${t('rep')}</p><div class="row"><button class="btn" id="dec">${t('decline')}</button><button class="btn red" id="acc">${t('accept')}</button></div>`);
    (this.modal.querySelector('#acc') as HTMLElement).onclick = () => { this.closeModal(); this.w.quests.start(q.id); audio.play('quest'); };
    (this.modal.querySelector('#dec') as HTMLElement).onclick = () => this.closeModal();
  }
  private npcTalk(npc: string) {
    const lines = NPC_CHATTER[npc] || [{ th: '...', en: '...' }]; const line = lines[Math.floor(Math.random() * lines.length)];
    this.w.say([{ s: npc, t: line }]); if (this.w.relations[npc] !== undefined && Math.random() < 0.3) this.w.addRel(npc, 1);
  }
  // ---------------- title ----------------
  async showTitle(hasSave: boolean) {
    const T = (th: string, en: string) => tx({ th, en });
    this.title?.remove(); this.title = document.createElement('div'); this.title.id = 'title';
    this.title.innerHTML = `<div class="halftone-bg"></div><div class="logo">STREET<br>CROWS</div><div class="logo2">CITY OF RIVALS</div><div class="jp">ストリート・クロウズ ／ ${T('เมืองแห่งคู่ปรับ', 'city of rivals')}</div>
      <div class="tbtns">${hasSave ? `<button class="btn red" data-m="continue">▶ ${t('cont')}</button>` : ''}<button class="btn ${hasSave ? '' : 'red'}" data-m="new">★ ${t('newGame')}</button><button class="btn" data-m="controls">🎮 ${t('controls')}</button><button class="btn" data-m="lang">🌐 ${getLang() === 'th' ? 'English' : 'ภาษาไทย'}</button></div>
      <div class="foot">${T('เกมต้นฉบับ ตัวละคร/แก๊ง/เรื่องราวทั้งหมดแต่งขึ้นใหม่ · เสียงและเพลงสร้างแบบโพรซีเจอรัล · v0.1 Vertical Slice', 'Original game: all characters, gangs and story are fictional · procedural audio · v0.1 vertical slice')}</div>`;
    this.root.parentElement!.appendChild(this.title);
    this.title.querySelectorAll('[data-m]').forEach(b => (b as HTMLElement).onclick = () => {
      const m = (b as HTMLElement).dataset.m!; audio.init(); audio.play('ui');
      if (m === 'lang') { setLang(getLang() === 'th' ? 'en' : 'th'); this.showTitle(hasSave); bus.emit('langChanged'); return; }
      if (m === 'controls') { this.showModal(controlsHTML() + `<div class="row"><span></span><button class="btn" id="cls">${t('close')}</button></div>`); (this.modal.querySelector('.small-modal') as HTMLElement).style.width = 'min(640px,94vw)'; (this.modal.querySelector('#cls') as HTMLElement).onclick = () => { this.closeModal(); this.w.menuOpen = false; }; return; }
      this.title?.remove(); this.title = null; this.onStart(m as any);
    });
  }
}
export function controlsHTML() {
  const T = (th: string, en: string) => tx({ th, en });
  const rows: [string, string][] = [
    [T('เดิน / วิ่ง', 'Move / Sprint'), 'WASD · Shift'], [T('กล้อง', 'Camera'), T('เมาส์ (คลิกเพื่อล็อกเมาส์) · ล้อเมาส์ / + - = ซูม', 'Mouse (click to lock pointer) · Wheel / + - = zoom')],
    ['AUTO', T('T = เปิด/ปิด เดินหาศัตรูอัตโนมัติ (ไม่โจมตีให้ ต้องต่อยเอง) · ขยับเองเพื่อควบคุมชั่วคราว', 'T = toggle auto-walk to enemies (never attacks for you) · move to take over temporarily')],
    [T('ต่อย', 'Punch'), T('คลิกซ้าย / J', 'LMB / J')], [T('หมัดหนัก', 'Heavy'), T('คลิกขวา / K', 'RMB / K')], [T('เตะ', 'Kick'), 'F'], [T('เตะหนัก (ทำลายการ์ด)', 'Heavy kick (guard break)'), 'C'],
    [T('หลบ (หลบเพอร์เฟกต์ = สโลว์)', 'Dodge (perfect = slow-mo)'), 'Space'], [T('การ์ด (กดจังหวะพอดี = ปัด)', 'Block (tap on time = parry)'), 'Q'], [T('จับ / ทุ่ม', 'Grab / Throw'), T('G (กดอีกครั้งเพื่อทุ่ม) / คลิกกลาง', 'G (press again to throw) / MMB')],
    [T('ท่าพิเศษ (เกจเต็ม)', 'Special (full meter)'), 'R'], [T('ท่าปิดฉาก', 'Finisher'), T('หมัดหนักใส่ศัตรูที่มึน', 'Heavy on a dizzy enemy')], [T('สวนกลับ', 'Counter'), T('โจมตีทันทีหลังหลบ/การ์ดสำเร็จ', 'Attack right after a successful dodge/block')],
    [T('คอมโบ', 'Combos'), 'P-P-Heavy · P-K-K · Dodge→Attack · Block→Attack · G→G · Sprint+Kick (flying kick) · P-P-P (skill)'],
    [T('คุย / ใช้', 'Interact'), 'E'], [T('เมนู', 'Menu'), 'Tab / Esc'], [T('แผนที่', 'Map'), 'M'], [T('ไอเทม', 'Items'), '1 · 2 · 3'], [T('ช่วยเหลือ', 'Help'), 'H'],
    ['Gamepad', 'LS move · RS camera · X punch · Y heavy · B kick · RT heavy kick · A dodge · LB block · RB grab · LT sprint · R3 special · L3 AUTO · D-pad↑↓ zoom · D-pad→ interact · Back menu'],
    [T('มือถือ', 'Mobile'), T('จอยซ้าย · ปุ่มขวา · ลากจอขวาเพื่อหมุนกล้อง · จีบนิ้วสองนิ้วเพื่อซูม · ดันจอยสุด = วิ่ง · ปุ่ม AUTO', 'Left stick · right buttons · drag right side to look · pinch to zoom · push stick fully = sprint · AUTO button')],
  ];
  return `<h3>${t('controls')}</h3><table class="controls-tbl">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
}
