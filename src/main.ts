import './ui/style.css';
import { World } from './sim/world';
import { GameRenderer } from './render/renderer';
import { Input } from './core/input';
import { HUD } from './ui/hud';
import { Menu, loadSettings, saveSettings } from './ui/menu';
import { TouchControls } from './ui/touch';
import { LocalSimulatedNetwork } from './core/network';
import { LocalStorageSaveProvider } from './core/save';
import { bus } from './core/events';
import { audio } from './core/audio';
import { setLang, tx } from './core/i18n';
import { PLACES, ROOF } from './data/city';
import { CHAR_BY_ID } from './data/characters';
import { GANG_BY_ID } from './data/gangs';
import { ENCOUNTERS } from './data/quests';
import type { Fighter } from './sim/fighter';

const qs = new URLSearchParams(location.search);
const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e)));
window.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String((e as any).reason)));
if (qs.get('lang') === 'en' || qs.get('lang') === 'th') setLang(qs.get('lang') as any);
const TEST = qs.has('test');
if (TEST) (window as any).__wantPointerLock = false;

const settings = loadSettings();
const coarse = matchMedia('(pointer: coarse)').matches;
const quality = (qs.has('quality') ? Math.max(0, Math.min(2, Number(qs.get('quality')))) : settings.quality) as 0 | 1 | 2;
const speed = Number(qs.get('speed') || 1);
const renderOn = qs.get('render') !== '0';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;
const net = new LocalSimulatedNetwork([[126, 12], [60, 12], [2, 12], [2, -40], [-60, 12], [-90, 22], [-10, 60], [0, 100], [40, 14]], 3);
net.connect();
const world = new World(net, [50, 110, 170][quality]);
const input = new Input(canvas);
const saves = new LocalStorageSaveProvider();
let renderer: GameRenderer | null = null;
try { if (renderOn) renderer = new GameRenderer(canvas, world, quality, ui); }
catch (e) { errors.push('webgl: ' + e); const b = document.getElementById('boot'); if (b) b.innerHTML = '<div class="boot-logo">WebGL unavailable</div><div class="boot-sub">Please use a browser with WebGL enabled</div>'; throw e; }
const hud = renderer ? new HUD(ui, world, renderer) : null;
const menu = new Menu(ui, world, saves, settings);
const touch = new TouchControls(ui, input, world);
const touchOn = coarse || qs.get('touch') === '1';
touch.setActive(false);
if (hud) (hud as any).touchMode = touchOn;
const applySettings = () => { input.sensitivity = settings.sens; input.invertY = settings.invertY; audio.setVolume(settings.volume, settings.music); if (hud) (hud as any).showFps = settings.fps; };
applySettings(); menu.onSettings = applySettings;
menu.onQuality = async () => { if (started) await saves.save('auto', world.serialize()); const u = new URL(location.href); u.searchParams.delete('quality'); if (started) u.searchParams.set('continue', '1'); location.href = u.toString(); };

let started = false;
async function start(mode: string) {
  if (mode === 'continue') { const d = await saves.load('auto') || await saves.load('1') || await saves.load('2') || await saves.load('3'); let ok = false; if (d) { try { world.load(d); ok = true; } catch (e) { console.warn('load failed', e); } } if (!ok) bus.emit('toast', { text: tx({ th: 'ไฟล์เซฟเสีย เริ่มเกมใหม่', en: 'Save was corrupt, starting new game' }) }); }
  started = true; world.menuOpen = false; touch.setActive(touchOn); audio.init();
  if (mode === 'new') { world.setClock(14.5); world.camYaw = Math.atan2(world.player.x - 60, world.player.z - 4); world.camPitch = 0.3; bus.emit('save', { reason: 'new' }); }
  document.body.classList.add('ingame');
}
menu.onStart = (m) => start(m);

// autosave
let saveQueued = 0;
bus.on('save', () => { saveQueued = 1.5; });
async function doSave() { if (!started) return; try { await saves.save('auto', world.serialize()); } catch (e) { console.warn('save failed', e); } }
setInterval(() => { if (started && !world.dialogue) doSave(); }, 45000);
window.addEventListener('beforeunload', () => { if (started) { try { localStorage.setItem('streetcrows.save.auto', JSON.stringify(world.serialize())); } catch {} } });

// audio mapping
bus.on('hit', (e) => { const near = e.att?.isPlayer || e.tgt?.isPlayer; audio.play(e.throw ? 'throw' : e.finisher || e.heavy ? 'heavy' : 'hit', near ? 1 : 0.5); if (e.counter) audio.play('counter'); });
bus.on('block', () => audio.play('block')); bus.on('parry', () => audio.play('counter')); bus.on('guardBreak', () => audio.play('guardbreak'));
bus.on('perfectDodge', () => audio.play('perfect')); bus.on('ko', () => audio.play('ko')); bus.on('playerSpecial', () => audio.play('special')); bus.on('enemySpecial', () => audio.play('special', 0.7));
bus.on('levelUp', () => audio.play('levelup')); bus.on('questComplete', () => audio.play('quest')); bus.on('questStart', () => audio.play('ui'));
bus.on('bossPhase', () => audio.play('phase')); bus.on('bossStart', () => audio.play('phase')); bus.on('grab', () => audio.play('grab')); bus.on('slam', () => audio.play('throw'));
bus.on('swing', () => audio.play('whoosh', 0.6)); bus.on('dodge', (e) => { if (e.f?.isPlayer) audio.play('dodge'); }); bus.on('reward', () => audio.play('coin', 0.6)); bus.on('counter', () => audio.play('counter'));
setInterval(() => {
  if (!started) { audio.setTrack('city'); return; }
  const boss = world.fighters.some(f => f.phases && f.alive && f.aggro); const fight = world.time - world.lastCombatT < 4;
  audio.night = world.nightFactor; audio.setTrack(boss ? 'boss' : fight ? 'battle' : world.isNight ? 'night' : 'city');
}, 1000);

// ---------------- debug / test hooks ----------------
const hostileAlive = () => world.fighters.filter(f => !f.isPlayer && f.alive && !f.civilian && (f.aggro || f.hostileToPlayer) && f.layer === world.player.layer);
let botOn = false; let botT = 0; let botSeq = 0; let botBlock = 0; let botSmart = true;
function botSpend() {
  const g = world.progress; let changed = false;
  while (g.statPoints > 0) { const k = (['power', 'defense', 'power', 'speed', 'technique', 'counter'] as const)[g.statPoints % 6]; if (!g.raise(k as any)) break; changed = true; }
  for (const id of ['iron_fist', 'thick_skin', 'combo_flow', 'quick_feet', 'danger_sense', 'iron_guard', 'guard_crusher', 'counter_art', 'second_wind', 'grab_master', 'rebound', 'crowd_reader', 'haymaker', 'last_stand', 'earthshaker', 'shadow_step', 'meter_boost', 'intimidate', 'meteor_kick', 'aura']) if (g.canLearn(id).ok) { g.learn(id); changed = true; }
  if (changed) world.refreshPlayerStats();
}
function botTick(dt: number) {
  const p = world.player; if (!botOn) return;
  if (world.dialogue) { world.advanceDialogue(0); return; }
  if (botSmart) botSpend();
  const foes = hostileAlive().filter(f => f.aggro && Math.hypot(f.x - p.x, f.z - p.z) < 40).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const t = foes.find(f => f.phases) && Math.hypot(foes.find(f => f.phases)!.x - p.x, foes.find(f => f.phases)!.z - p.z) < 5 ? foes.find(f => f.phases)! : foes[0];
  if (botBlock > 0) botBlock -= dt;
  input.bot = { moveX: 0, moveY: 0, sprint: false, block: botBlock > 0 };
  if (!t) return;
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
  world.camYaw = Math.atan2(-dx, -dz);
  if (botSmart && p.hp < p.maxHp * 0.35) { const g = world.progress; const it = g.inventory.bento ? 'item3' : g.inventory.onigiri ? 'item1' : g.inventory.drink ? 'item2' : null; if (it && botT <= 0) { input.press(it as any); botT = 0.5; } }
  const threat = foes.find(f => f.state === 'attack' && f.move && f.move.kind !== 'stance' && f.moveT < f.move.startup && Math.hypot(f.x - p.x, f.z - p.z) < 3.4);
  if (botSmart && threat && botBlock <= 0 && Math.random() < 0.65) { if (threat.move!.unblockable || threat.move!.guard > 30 || Math.random() < 0.45) { input.press('dodge'); } else { botBlock = 0.45; input.bot.block = true; } return; }
  if (d > 2.0) { input.bot.moveY = 1; input.bot.sprint = d > 6; return; }
  botT -= dt; if (botT > 0) return; botT = 0.12;
  if (botBlock > 0) { if (p.counterWin > 0 || Math.random() < 0.3) { botBlock = 0; input.press('punch'); } return; }
  if (t.state === 'dizzy') { input.press('heavy'); return; }
  if (p.meter >= 100) { input.press('special'); return; }
  if (t.state === 'attack' && t.move?.kind === 'stance') { input.press('grab'); return; }
  const seq = ['punch', 'punch', 'heavy', 'punch', 'kick', 'kick', 'hkick', 'grab', 'grab'] as const;
  if (p.state === 'idle' || p.state === 'move' || p.state === 'attack') input.press(seq[botSeq++ % seq.length] as any);
}
const debug = {
  places: Object.keys(PLACES),
  teleport(place: string) { const pl = PLACES[place]; if (!pl) return false; world.teleport(pl.pos[0], pl.pos[1], pl.layer || 0); return true; },
  tp(x: number, z: number, layer = 0) { world.teleport(x, z, layer); },
  spawn(id: string, n = 1, dist = 5) {
    const p = world.player; const out: Fighter[] = [];
    for (let i = 0; i < n; i++) { const a = world.camYaw + Math.PI + (i - (n - 1) / 2) * 0.6; const [x, z] = world.freeSpot(p.x + Math.sin(a) * dist, p.z + Math.cos(a) * dist, 1.5, p.layer);
      const f = CHAR_BY_ID[id] ? world.makeFighter({ char: id, x, z, layer: p.layer }) : world.makeFighter({ gang: GANG_BY_ID[id] ? id : 'kurogane', tier: id === 'mid' ? 'mid' : 'grunt', x, z, layer: p.layer });
      f.aggro = true; f.hostileToPlayer = true; f.loiter = false; if (f.ai) f.ai.mode = 'approach'; if (f.phases) bus.emit('bossStart', { f }); out.push(f); }
    return out.map(f => f.id);
  },
  setTime(h: number) { world.setClock(h); },
  giveExp(n: number) { world.progress.addExp(n); },
  giveMoney(n: number) { world.progress.money += n; },
  killAll() { for (const f of hostileAlive()) { f.lastAttacker = world.player; f.hp = 0; f.setState('ko'); } },
  hurtAll(frac = 0.1) { for (const f of hostileAlive()) f.hp = Math.max(1, Math.round(f.maxHp * frac)); },
  god(on = true) { world.godMode = on; },
  completeStep() { const a = world.quests.active.find(x => x.id === world.quests.tracked) || world.quests.active[0]; if (a) world.quests.completeStep(a); },
  skipDialogue() { let n = 0; while (world.dialogue && n++ < 200) world.advanceDialogue(0); },
  startQuest(id: string) { world.quests.start(id); },
  bot(on = true, smart = true) { botOn = on; botSmart = smart; if (!on) input.bot = null; },
  state() { const p = world.player, g = world.progress; return { x: p.x, z: p.z, layer: p.layer, hp: p.hp, maxHp: p.maxHp, level: g.level, exp: g.exp, sp: g.skillPoints, skills: [...g.skills], money: g.money, rep: g.rep, active: world.quests.active.map(a => a.id + ':' + a.step), done: [...world.quests.done], bosses: [...world.bosses], clock: world.clock, fighters: world.fighters.filter(f => !f.isPlayer && f.alive).length, dialogue: !!world.dialogue, menuOpen: world.menuOpen, state: p.state }; },
  async save(slot = 'auto') { await saves.save(slot, world.serialize()); },
  start,
  step(sec: number) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { botTick(1 / 60); input.poll(); world.step(1 / 60, input); } },
};
(window as any).__places = PLACES; (window as any).__roofDoor = ROOF.door; (window as any).__encounters = ENCOUNTERS;
(window as any).__game = { world, renderer, input, hud, menu, touch, save: saves, ready: false, errors, debug, bus };

// ---------------- main loop ----------------
let last = performance.now(), acc = 0; const DT = 1 / 60; let titleT = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!started) {
    titleT += dt; world.camYaw += dt * 0.08; world.camPitch = 0.18; world.crowd.night = world.nightFactor; world.crowd.hour = world.clock; world.crowd.update(dt, world.player.x, world.player.z, [], 1);
    renderer?.render(dt, 1); return;
  }
  input.poll();
  acc += dt * speed; let n = 0;
  while (acc >= DT && n < 5 * Math.max(1, speed)) { botTick(DT); world.step(DT, input); acc -= DT; n++; }
  if (n >= 5 * Math.max(1, speed)) acc = 0;
  if (saveQueued > 0) { saveQueued -= dt; if (saveQueued <= 0) doSave(); }
  if (renderer) renderer.render(dt, acc / DT);
  hud?.update(dt); touch.update();
  if (touchOn) touch.root.style.visibility = world.menuOpen || world.dialogue ? 'hidden' : 'visible';
}
(async () => {
  const metas = await saves.list();
  const hasSave = metas.length > 0;
  // title scene: golden hour near the station
  world.setClock(17.9); world.menuOpen = true;
  document.getElementById('boot')?.remove();
  (window as any).__game.ready = true;
  if (qs.has('newgame')) { await start('new'); }
  else if (qs.has('continue') && hasSave) { await start('continue'); }
  else { await menu.showTitle(hasSave); }
  requestAnimationFrame(frame);
})();
