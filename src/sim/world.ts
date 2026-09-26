import { SKILL_BY_ID } from '../data/skills';
import { Fighter } from './fighter';
import { Combat } from './combat';
import { AIBrain, AttackCoordinator, PlayerHabits } from './ai';
import { Progression } from './progression';
import { generateCity, type CityData } from './cityGen';
import { Crowd } from './crowd';
import { QuestSystem } from './questSystem';
import { CHAR_BY_ID, AI_TIER, BASIC_MOVES, MID_MOVES } from '../data/characters';
import { GANG_BY_ID, GANGS } from '../data/gangs';
import { ZONES, PLACES, INTERACTABLES, ROOF, type Interactable } from '../data/city';
import { ENCOUNTERS, type DLine } from '../data/quests';
import { GANG_TAUNTS, FRIENDLY_GREET } from '../data/barks';
import type { Appearance, Tier } from '../data/types';
import type { Input, Action } from '../core/input';
import type { NetworkAdapter, PlayerSnapshot } from '../core/network';
import type { SaveData } from '../core/save';
import { SAVE_VERSION } from '../core/save';
import { bus } from '../core/events';
import { clamp, angleDiff } from '../core/rng';
import { tx } from '../core/i18n';

export const DEFAULT_LOOK: Appearance = { hair: 'spiky', hairColor: '#2a1c14', jacket: '#2b3a67', shirt: '#d6263a', pants: '#1b1c24', shoes: '#f0f0f0', skin: '#e6bb94', accessory: 'none', build: 1.05, height: 1.04, longCoat: true, openJacket: true };
export const ITEMS: Record<string, { name: { th: string; en: string }; price: number; heal: number; stamina?: number; meter?: number }> = {
  onigiri: { name: { th: 'ข้าวปั้น', en: 'Onigiri' }, price: 150, heal: 35 },
  drink: { name: { th: 'เครื่องดื่มชูกำลัง', en: 'Energy Drink' }, price: 220, heal: 15, stamina: 100, meter: 25 },
  bento: { name: { th: 'เบนโตะ', en: 'Bento' }, price: 480, heal: 80 },
};
interface EncState { id: string; quest: string; fighters: Fighter[]; spawned: boolean; done: boolean }
export interface StreetEvent { kind: 'bully' | 'challenge' | 'gangwar' | 'ambush'; x: number; z: number; fighters: Fighter[]; victim?: Fighter; t: number; done: boolean }

/** The whole game state + fixed-step simulation. Rendering reads from it, never writes. */
export class World {
  city: CityData; col; combat: Combat; coord = new AttackCoordinator(); habits = new PlayerHabits(); progress = new Progression(); quests: QuestSystem; crowd: Crowd;
  fighters: Fighter[] = []; player!: Fighter; time = 0; clock = 14.0; playTime = 0; camYaw = Math.PI * 0.85; camPitch = 0.28; slowmoT = 0;
  relations: Record<string, number> = {}; bosses = new Set<string>(); custom: Appearance & { title: string } = { ...DEFAULT_LOOK, title: '' };
  encounters = new Map<string, EncState>(); dialogue: { lines: DLine[]; i: number; onDone?: () => void } | null = null; menuOpen = false; paused = false;
  remotes = new Map<string, PlayerSnapshot & { seen: number }>(); flags = new Set<string>(); friendlyGangs = new Set<string>();
  event: StreetEvent | null = null; eventTimer = 120; spawnTimer = 1; checkpoint: [number, number, number] = [136, 6, 0]; downT = 0;
  stats = { kills: 0, bossKills: 0, perfectDodges: 0, counters: 0, throws: 0, finishers: 0, maxCombo: 0, hitsLanded: 0, hitsTaken: 0 };
  netT = 0; zoneId = ''; godMode = false; lastCombatT = -99; interactTarget: Interactable | null = null; dynInteract: Interactable[] = []; kentaMoved = false;
  constructor(public net: NetworkAdapter | null, crowdCount = 120) {
    this.city = generateCity(); this.col = this.city.col; this.combat = new Combat(this);
    this.crowd = new Crowd(crowdCount, this.col); this.quests = new QuestSystem(this);
    for (const c of Object.values(CHAR_BY_ID)) if (c.relationStart !== undefined) this.relations[c.id] = c.relationStart;
    this.progress.onLevel = (l) => { this.emit('levelUp', { level: l }); this.refreshPlayerStats(true); };
    this.spawnPlayer(136, 6);
    bus.on('hit', (e) => { if (e.att === this.player && e.tgt && !e.tgt.aggro && !e.tgt.isPlayer) this.aggroGroup(e.tgt, false); });
    net?.onMessage((m) => {
      if (m.type === 'snapshot') this.remotes.set(m.snap.id, { ...m.snap, seen: this.time });
      else if (m.type === 'leave') this.remotes.delete(m.id);
      else if (m.type === 'chat') this.emit('chat', m);
    });
  }
  emit(type: string, p?: any) { bus.emit(type, p); }
  spawnPlayer(x: number, z: number) {
    const p = new Fighter(); p.isPlayer = true; p.team = 'player'; p.name = 'Haru'; p.charId = 'haru'; p.tier = 'boss'; p.x = p.px = x; p.z = p.pz = z; p.radius = 0.45; p.hostileToPlayer = false;
    p.appearance = this.custom; this.player = p; this.fighters.push(p); this.refreshPlayerStats(true);
  }
  refreshPlayerStats(heal = false) {
    const p = this.player, g = this.progress; p.mods = g.mods(); p.maxHp = g.maxHp; p.maxStamina = g.maxStamina; p.atk = 10; p.def = 10; p.level = g.level;
    if (heal) { p.hp = p.maxHp; p.stamina = p.maxStamina; } p.hp = Math.min(p.hp, p.maxHp); p.guard = Math.min(p.guard, p.mods.guardMax);
  }
  get isNight() { return this.clock >= 20 || this.clock < 4.5; }
  get nightFactor() { const h = this.clock; if (h >= 19.5 || h < 4.5) return 1; if (h > 17.5) return (h - 17.5) / 2; if (h < 6) return 1 - (h - 4.5) / 1.5; return 0; }
  gangHostile(g: string) { const gd = GANG_BY_ID[g]; return !!gd && gd.hostileToPlayer && !this.friendlyGangs.has(g); }
  zoneAt(x: number, z: number) { let best = ZONES[ZONES.length - 1]; for (const zn of ZONES) if (x >= zn.rect[0] && x <= zn.rect[2] && z >= zn.rect[1] && z <= zn.rect[3]) { best = zn; if (zn.kind !== 'road' && zn.kind !== 'river') return zn; } return best; }

  // ---------------- relationships ----------------
  hostile(a: Fighter, b: Fighter) {
    if (a === b || a.team === b.team || a.civilian || b.civilian) return false;
    if (a.isPlayer) return b.hostileToPlayer || b.aggro; if (b.isPlayer) return a.hostileToPlayer || a.aggro;
    return (!!a.feud && a.feud === b.team) || (!!b.feud && b.feud === a.team);
  }
  pickTarget(f: Fighter): Fighter | null {
    const p = this.player;
    if (f.feud) { let best: Fighter | null = null, bd = 30; for (const o of this.fighters) { if (o.alive && o.team === f.feud && o.layer === f.layer) { const d = f.distTo(o); if (d < bd) { bd = d; best = o; } } } if (f.aggro && p.alive && f.distTo(p) < bd) return p; if (best) return best; }
    if (f.aggro && p.alive && p.layer === f.layer && f.distTo(p) < 45 && this.downT <= 0 && !this.dialogue) return p;
    return null;
  }
  engagedCount(t: Fighter) { let n = 0; for (const f of this.fighters) if (f.ai && f.alive && f.ai.target === t) n++; return n; }
  slotAngle(f: Fighter, t: Fighter) {
    const eng = this.fighters.filter(o => o.ai && o.alive && o.ai.target === t).sort((a, b) => a.id - b.id); const i = Math.max(0, eng.indexOf(f)), n = Math.max(1, eng.length);
    const base = this.camYaw + Math.PI; // spread starting in front of camera so fights stay readable
    return base + (i + 0.5) * (Math.PI * 2 / n) + (n === 1 ? -Math.PI * 0.5 : 0);
  }
  lockTarget(f: Fighter, range: number): Fighter | null {
    let best: Fighter | null = null, bs = 1e9;
    for (const o of this.fighters) {
      if (o === f || !o.alive || o.layer !== f.layer || !this.hostile(f, o) || o.state === 'grabbed') continue;
      const d = f.distTo(o); if (d > range) continue; const a = Math.abs(angleDiff(f.yaw, Math.atan2(o.x - f.x, o.z - f.z)));
      const s = d + a * 2.2; if (s < bs) { bs = s; best = o; }
    }
    return best;
  }
  habitsSeen(f: Fighter, move: string) { /* hook for analytics / future netcode */ }
  startSlowmo(dur: number) { this.slowmoT = dur; }
  despawn(f: Fighter) { f.defeated = true; f.hp = 0; f.state = 'ko'; f.koT = 99; f.rewarded = true; }

  // ---------------- spawning ----------------
  makeFighter(opts: { char?: string; gang?: string; tier?: Tier; x: number; z: number; layer?: number; level?: number }): Fighter {
    const f = new Fighter(); f.x = f.px = opts.x; f.z = f.pz = opts.z; f.layer = opts.layer || 0; const plv = this.progress.level;
    if (opts.char) {
      const c = CHAR_BY_ID[opts.char]; f.charId = c.id; f.name = tx(c.name); f.displayTitle = tx(c.nickname); f.tier = c.tier; f.team = c.gang; f.appearance = c.look;
      const scale = c.tier === 'boss' ? 1 + Math.max(0, plv - 5) * 0.04 : 1 + Math.max(0, plv - 3) * 0.04;
      f.maxHp = f.hp = Math.round(c.hp * scale); f.atk = c.atk; f.def = c.def; f.speed = c.ai.speed; f.moveset = c.moves.length ? c.moves : BASIC_MOVES; f.special = c.special || '';
      f.ai = new AIBrain(f, { ...c.ai }); f.phases = c.phases || null; if (f.phases) { f.moveset = f.phases[0].moves; f.ai.phaseOv = f.phases[0].ai; }
      f.expValue = c.tier === 'boss' ? 420 : c.tier === 'miniboss' ? 200 : 70; f.moneyValue = c.tier === 'boss' ? 1500 : c.tier === 'miniboss' ? 800 : 300;
      f.radius = 0.45 * Math.max(0.9, c.look.build * 0.95); f.level = Math.max(plv, c.tier === 'boss' ? 8 : 4);
    } else {
      const g = GANG_BY_ID[opts.gang || 'kurogane']; const tier = opts.tier || 'grunt'; f.tier = tier; f.team = g.id;
      const lvl = Math.max(1, opts.level ?? plv + Math.floor(Math.random() * 3) - 1); f.level = lvl;
      f.name = g.gruntNames[Math.floor(Math.random() * g.gruntNames.length)]; f.displayTitle = tx(g.name);
      const hairs = ['pompadour', 'spiky', 'buzz', 'slick', 'mohawk', 'messy', 'long'] as const; const hc = ['#1a1a1a', '#3a2412', '#c8a040', '#8a3a1a', '#d0d0d0', '#2a2a2a'];
      f.appearance = { hair: hairs[Math.floor(Math.random() * hairs.length)], hairColor: hc[Math.floor(Math.random() * hc.length)], jacket: g.color, shirt: '#e8e8e8', pants: '#1c1c22', shoes: '#151515', skin: ['#e9c29f', '#d8ad84', '#c89a74', '#f0d0b0'][Math.floor(Math.random() * 4)], accessory: Math.random() < 0.2 ? 'bandage' : 'none', build: 0.9 + Math.random() * 0.35, height: 0.94 + Math.random() * 0.12, ...g.uniform } as Appearance;
      const mid = tier === 'mid';
      f.maxHp = f.hp = Math.round((mid ? 120 : 52) + lvl * (mid ? 14 : 7)); f.atk = (mid ? 8 : 5.6) + lvl * 0.3; f.def = 8 + lvl * 0.3; f.speed = 0.95 + Math.random() * 0.1;
      f.moveset = mid ? MID_MOVES : (Math.random() < 0.3 ? [...BASIC_MOVES, 'grab'] : BASIC_MOVES);
      f.ai = new AIBrain(f, { ...AI_TIER[tier], aggression: AI_TIER[tier].aggression + (Math.random() - 0.5) * 0.2 });
      f.expValue = Math.round((mid ? 60 : 20) + lvl * (mid ? 6 : 3)); f.moneyValue = (mid ? 160 : 45) + Math.floor(Math.random() * 40);
    }
    f.hostileToPlayer = this.gangHostile(f.team) || !!opts.char; f.stamina = f.maxStamina = 100; f.guard = f.mods.guardMax;
    f.mods = { ...f.mods, def: 1 }; f.yaw = Math.random() * 6.28;
    this.fighters.push(f); return f;
  }
  freeSpot(cx: number, cz: number, r: number, layer = 0): [number, number] {
    for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, d = Math.random() * r; const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d; if (!this.col.insideSolid(x, z, layer) && !this.col.insideSolid(x + 0.6, z, layer) && !this.col.insideSolid(x - 0.6, z, layer) && !this.col.insideSolid(x, z + 0.6, layer) && !this.col.insideSolid(x, z - 0.6, layer)) return this.col.resolve(x, z, 0.5, layer); }
    return this.col.resolve(cx, cz, 0.5, layer);
  }
  spawnEncounter(id: string, quest: string): EncState {
    const e = ENCOUNTERS[id]; const pl = PLACES[e.place]; const layer = pl.layer || 0; const fs: Fighter[] = [];
    // clear ambient enemies nearby so quest fights are readable
    for (const f of this.fighters) if (!f.isPlayer && !f.encounter && f.alive && Math.hypot(f.x - pl.pos[0], f.z - pl.pos[1]) < 30 && !this.event?.fighters.includes(f)) this.despawn(f);
    const p = this.player; const baseA = Math.atan2(pl.pos[0] - p.x, pl.pos[1] - p.z);
    let k = 0;
    for (const m of e.members) for (let i = 0; i < (m.count || 1); i++) {
      const a = baseA + (k++ - 1) * 0.7; const [x, z] = this.freeSpot(pl.pos[0] + Math.sin(a) * 4, pl.pos[1] + Math.cos(a) * 4, 3, layer);
      const f = this.makeFighter({ char: m.char, gang: m.gang, tier: m.tier, x, z, layer });
      f.encounter = id; f.aggro = true; f.hostileToPlayer = true; f.loiter = false; f.faceTo(p.x, p.z); if (f.ai) f.ai.mode = 'approach'; fs.push(f);
    }
    const st: EncState = { id, quest, fighters: fs, spawned: true, done: false }; this.encounters.set(id, st);
    const boss = fs.find(f => f.phases); if (boss) this.emit('bossStart', { f: boss });
    this.lastCombatT = this.time; return st;
  }
  resetEncounter(id: string) { const e = this.encounters.get(id); if (!e) return; for (const f of e.fighters) this.despawn(f); this.encounters.delete(id); }

  private ambientSpawn() {
    const p = this.player; if (p.layer !== 0) return;
    const zn = this.zoneAt(p.x, p.z); this.zoneId = zn.id;
    const nearby = this.fighters.filter(f => !f.isPlayer && f.alive && !f.encounter && !f.civilian && Math.hypot(f.x - p.x, f.z - p.z) < 90);
    // despawn far ambient enemies
    for (const f of this.fighters) if (!f.isPlayer && !f.encounter && f.alive && !f.aggro && Math.hypot(f.x - p.x, f.z - p.z) > 95 && !this.event?.fighters.includes(f)) this.despawn(f);
    if (!zn.gang || zn.spawnDensity <= 0 || this.dialogue || this.quests.isActive('tutorial')) return;
    const cap = Math.round(2 + zn.spawnDensity * 5 + (this.isNight ? 2 : 0));
    if (nearby.length >= cap) return;
    const activeEnc = [...this.encounters.values()].some(e => !e.done && e.fighters.some(f => f.alive));
    if (activeEnc) return;
    const [x0, z0, x1, z1] = zn.rect;
    for (let tries = 0; tries < 12; tries++) {
      const x = x0 + 4 + Math.random() * (x1 - x0 - 8), z = z0 + 4 + Math.random() * (z1 - z0 - 8); const d = Math.hypot(x - p.x, z - p.z);
      if (d < 28 || d > 60 || this.col.insideSolid(x, z, 0)) continue;
      const gangId = zn.gang === 'yamikaze' && !this.isNight && Math.random() < 0.5 ? 'onigawara' : zn.gang;
      const n = 2 + Math.floor(Math.random() * (zn.spawnDensity > 0.7 ? 3 : 2)); const hostile = this.gangHostile(gangId);
      const plv = this.progress.level;
      for (let i = 0; i < n; i++) {
        const [fx, fz] = this.freeSpot(x, z, 2.5);
        const tier: Tier = plv >= 3 && i === 0 && Math.random() < 0.35 ? 'mid' : 'grunt';
        const f = this.makeFighter({ gang: gangId, tier, x: fx, z: fz }); f.hostileToPlayer = hostile; f.loiter = true; f.faceTo(x, z);
        (f as any).group = this.time + x;
      }
      break;
    }
  }
  private updateAggro() {
    const p = this.player; if (!p.alive) return;
    for (const f of this.fighters) {
      if (f.isPlayer || !f.alive || f.aggro || f.civilian || f.layer !== p.layer) continue;
      const d = f.distTo(p);
      if (!f.hostileToPlayer) { if (d < 4 && f.bubbleT <= 0 && Math.random() < 0.02) { f.bubble = tx(FRIENDLY_GREET[Math.floor(Math.random() * FRIENDLY_GREET.length)]); f.bubbleT = 2.5; f.faceTo(p.x, p.z); } continue; }
      if (d < (this.isNight ? 11 : 8.5) && !this.col.blocked(f.x, f.z, p.x, p.z, f.layer) && !this.dialogue) this.aggroGroup(f, true);
    }
  }
  aggroGroup(f: Fighter, shout: boolean) {
    const g = (f as any).group;
    for (const o of this.fighters) if (o.alive && !o.isPlayer && (o === f || (g !== undefined && (o as any).group === g) || (o.team === f.team && o.distTo(f) < 7 && !o.aggro && o.hostileToPlayer))) { o.aggro = true; o.loiter = false; if (o.ai) o.ai.mode = 'approach'; }
    if (shout) { f.bubble = tx(GANG_TAUNTS[Math.floor(Math.random() * GANG_TAUNTS.length)]); f.bubbleT = 2.2; this.emit('aggro', { f }); }
    this.lastCombatT = this.time;
  }

  // ---------------- street events (every few minutes) ----------------
  private updateStreetEvent(dt: number) {
    const p = this.player;
    if (this.event) {
      const e = this.event; e.t += dt;
      const foesLeft = e.fighters.filter(f => f.alive && !f.civilian);
      if (!e.done && foesLeft.length === 0) {
        e.done = true; const rep = e.kind === 'challenge' ? 50 : e.kind === 'gangwar' ? 70 : 40; const money = e.kind === 'challenge' ? 600 : 300;
        const gr = this.progress.addRep(rep); const gm = this.progress.addMoney(money);
        this.emit('eventDone', { kind: e.kind, rep: gr, money: gm });
        if (e.victim) { e.victim.bubble = tx({ th: 'ขอบคุณครับ! ช่วยชีวิตผมไว้!', en: 'Thank you! You saved me!' }); e.victim.bubbleT = 3; }
      }
      if ((e.done && e.t > 0) || Math.hypot(e.x - p.x, e.z - p.z) > 110 || e.t > 240) {
        if (!e.done || e.t > 6 || Math.hypot(e.x - p.x, e.z - p.z) > 110) { if (e.victim) this.despawn(e.victim); if (!e.done) for (const f of e.fighters) if (!f.aggro) this.despawn(f); this.event = null; }
      }
      return;
    }
    this.eventTimer -= dt;
    if (this.eventTimer > 0 || this.dialogue || p.layer !== 0 || this.time - this.lastCombatT < 15) return;
    if ([...this.encounters.values()].some(e => !e.done)) { this.eventTimer = 20; return; }
    this.eventTimer = 140 + Math.random() * 100;
    const kinds: StreetEvent['kind'][] = ['bully', 'challenge', 'gangwar']; if (this.progress.rep >= 350) kinds.push('ambush');
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const fwd = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    let pos: [number, number] | null = null;
    for (let i = 0; i < 20 && !pos; i++) { const a = fwd + (Math.random() - 0.5) * 2, d = 16 + Math.random() * 10; const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d; if (!this.col.insideSolid(x, z, 0) && !this.col.blocked(p.x, p.z, x, z, 0)) pos = [x, z]; }
    if (!pos) { this.eventTimer = 20; return; }
    const hostileGangs = GANGS.filter(g => g.hostileToPlayer && g.id !== 'gekko').map(g => g.id);
    const g1 = hostileGangs[Math.floor(Math.random() * hostileGangs.length)];
    const ev: StreetEvent = { kind, x: pos[0], z: pos[1], fighters: [], t: 0, done: false };
    if (kind === 'bully') {
      const [vx, vz] = this.freeSpot(pos[0], pos[1], 1); const v = this.makeFighter({ gang: 'kurogane', x: vx, z: vz }); v.civilian = true; v.team = 'civilian'; v.ai = null; v.hostileToPlayer = false; v.appearance = { ...v.appearance, jacket: '#3a4a6a', hair: 'messy', build: 0.8 }; v.name = tx({ th: 'นักเรียน', en: 'Student' }); v.state = 'dizzy'; v.stateDur = 999; v.bubble = tx({ th: 'ช่วยด้วย!', en: 'Help!' }); v.bubbleT = 4; ev.victim = v;
      for (let i = 0; i < 2; i++) { const [x, z] = this.freeSpot(pos[0], pos[1], 2.5); const f = this.makeFighter({ gang: g1, x, z }); f.hostileToPlayer = true; f.loiter = false; f.faceTo(vx, vz); (f as any).group = 'ev' + this.time; ev.fighters.push(f); }
    } else if (kind === 'challenge') {
      const pool = ['ryo', 'kai', 'ishida', 'kanemura', 'fuwa', 'bunta', 'mogami', 'daigo'].filter(id => !this.encounterActiveFor(id));
      const cid = pool[Math.floor(Math.random() * pool.length)]; const [x, z] = this.freeSpot(pos[0], pos[1], 1.5);
      const f = this.makeFighter({ char: cid, x, z }); f.hostileToPlayer = true; f.aggro = true; f.faceTo(p.x, p.z); f.bubble = tx({ th: 'เฮ้ย ฮารุ โบยะ! ดวลกับฉัน!', en: 'Oi, Haru Boya! Fight me!' }); f.bubbleT = 3; ev.fighters.push(f);
      f.expValue = 90; f.moneyValue = 400;
    } else if (kind === 'gangwar') {
      const g2 = hostileGangs.filter(g => g !== g1)[Math.floor(Math.random() * (hostileGangs.length - 1))];
      for (const [g, other, off] of [[g1, g2, -2.5], [g2, g1, 2.5]] as [string, string, number][]) for (let i = 0; i < 3; i++) {
        const [x, z] = this.freeSpot(pos[0] + off, pos[1] + (i - 1) * 1.5, 1.5); const f = this.makeFighter({ gang: g, x, z }); f.feud = other; f.hostileToPlayer = true; f.loiter = false; (f as any).group = 'gw' + g + this.time; ev.fighters.push(f);
      }
    } else {
      for (let i = 0; i < 4; i++) { const [x, z] = this.freeSpot(pos[0], pos[1], 3); const f = this.makeFighter({ gang: g1, tier: i === 0 ? 'mid' : 'grunt', x, z }); f.hostileToPlayer = true; f.aggro = true; ev.fighters.push(f); }
    }
    this.event = ev; this.emit('streetEvent', { kind, x: pos[0], z: pos[1] });
  }
  encounterActiveFor(charId: string) { return this.fighters.some(f => f.charId === charId && f.alive); }

  // ---------------- player control ----------------
  private buffered: { a: Action; t: number } | null = null;
  playerInput(input: Input, dt: number) {
    const p = this.player; const look = input.consumeLook();
    this.camYaw -= look.x; this.camPitch = clamp(this.camPitch + look.y, -0.35, 1.15);
    const pressed = input.consumePressed();
    if (pressed.has('menu') || pressed.has('pause')) this.emit('menuKey', { key: pressed.has('menu') ? 'menu' : 'pause' });
    if (pressed.has('map')) this.emit('menuKey', { key: 'map' }); if (pressed.has('help')) this.emit('menuKey', { key: 'help' });
    if (this.dialogue) { p.intentX = p.intentZ = 0; p.wantBlock = false; if (pressed.has('interact') || pressed.has('punch') || pressed.has('dodge')) this.advanceDialogue(-1); return; }
    if (this.menuOpen || this.downT > 0) { p.intentX = p.intentZ = 0; p.wantBlock = false; p.wantSprint = false; return; }
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    p.intentX = rx * input.moveX + fx * input.moveY; p.intentZ = rz * input.moveX + fz * input.moveY;
    p.wantSprint = input.sprint; p.wantBlock = input.block; if (input.block) this.habits.blockTime += 0;
    for (const a of pressed) {
      if (a === 'interact') { this.interact(); continue; }
      if (a === 'item1') { this.useItem('onigiri'); continue; } if (a === 'item2') { this.useItem('drink'); continue; } if (a === 'item3') { this.useItem('bento'); continue; }
      if (['punch', 'heavy', 'kick', 'hkick', 'dodge', 'grab', 'special'].includes(a)) { if (!this.tryAction(a)) this.buffered = { a, t: 0.28 }; }
    }
    if (this.buffered) { this.buffered.t -= dt; if (this.buffered.t <= 0) this.buffered = null; }
  }
  tryBuffered() { if (this.buffered) { const b = this.buffered; this.buffered = null; if (!this.tryAction(b.a)) this.buffered = b; } }
  tryAction(a: Action): boolean {
    const p = this.player; if (!p.alive) return false;
    const key = a === 'punch' ? 'P' : a === 'heavy' ? 'H' : a === 'kick' ? 'K' : a === 'hkick' ? 'C' : '';
    if (p.state === 'grabbing' && ['grab', 'punch', 'heavy', 'kick', 'hkick'].includes(a)) { this.combat.throwStart(p); this.stats.throws++; this.habits.record('grab'); return true; }
    if (a === 'dodge') { const ok = this.combat.dodge(p, p.intentX, p.intentZ); if (ok) this.habits.record('dodge'); return ok; }
    const lock = this.lockTarget(p, 4.5);
    const face = () => { if (lock) p.faceTo(lock.x, lock.z); else if (Math.hypot(p.intentX, p.intentZ) > 0.2) p.yaw = Math.atan2(p.intentX, p.intentZ); };
    if (key && p.canCancel() && p.move) {
      let next = p.move.cancels?.[key as 'P'];
      if (next === 'jab3' && !p.mods.combo3) next = undefined;
      if (next === 'roundhouse' && !p.chainFromPunch) next = 'kick2';
      if (next === 'kick2' && p.move.id === 'kick_c' && p.chainFromPunch) next = 'roundhouse';
      if (next) { const cp = p.chainFromPunch; face(); if (p.startMove(next)) { if (next === 'roundhouse') p.chainFromPunch = cp; this.recordMove(a, next); return true; } }
    }
    if (!p.canAct) return false;
    if (a === 'special') { if (p.meter < 100) { this.emit('noMeter'); return true; } p.meter = 0; face(); p.startMove('sp_typhoon'); this.habits.record('special'); this.emit('playerSpecial', { f: p }); return true; }
    if (p.counterWin > 0 && ['punch', 'heavy', 'kick', 'hkick'].includes(a)) { face(); p.startMove('counter'); this.stats.counters++; this.emit('counter', { f: p, kind: p.counterKind }); p.counterWin = 0; return true; }
    if (a === 'heavy' && lock && lock.state === 'dizzy' && p.distTo(lock) < 3) { face(); p.startMove('finisher'); this.stats.finishers++; this.emit('finisherStart', { f: p, t: lock }); return true; }
    if (p.speedNow > 7.5 && ['punch', 'kick', 'hkick'].includes(a) && p.stamina > 5) { face(); p.startMove('flykick'); this.recordMove(a, 'flykick'); return true; }
    const map: Record<string, string> = { punch: 'jab', heavy: 'heavy', kick: 'kick', hkick: 'hkick', grab: 'grab' };
    const id = map[a]; if (!id) return false; face();
    if (p.startMove(id)) { this.recordMove(a, id); return true; }
    return false;
  }
  private recordMove(a: string, id: string) { this.habits.record(a === 'punch' ? 'punch' : a === 'heavy' ? 'heavy' : a === 'grab' ? 'grab' : 'kick'); this.emit('swing', { f: this.player, id }); }
  useItem(id: string) {
    const inv = this.progress.inventory; if (!inv[id]) { this.emit('toast', { text: tx({ th: 'ไม่มีไอเทมนี้', en: 'You have none' }) }); return; }
    const it = ITEMS[id]; const p = this.player; inv[id]--; p.hp = Math.min(p.maxHp, p.hp + it.heal); if (it.stamina) p.stamina = p.maxStamina; if (it.meter) p.meter = Math.min(100, p.meter + it.meter);
    this.emit('itemUsed', { id });
  }
  buy(id: string) { const it = ITEMS[id]; if (this.progress.money < it.price) return false; this.progress.money -= it.price; this.progress.inventory[id] = (this.progress.inventory[id] || 0) + 1; this.emit('bought', { id }); return true; }
  ramenPrice() { return this.quests.done.has('side_ramen') ? 300 : 600; }
  eatRamen() { const pr = this.ramenPrice(); if (this.progress.money < pr) return false; this.progress.money -= pr; const p = this.player; p.hp = p.maxHp; p.stamina = p.maxStamina; p.meter = Math.min(100, p.meter + 30); this.emit('ramen'); this.emit('save', { reason: 'ramen' }); return true; }

  interactables(): Interactable[] {
    const list = INTERACTABLES.map(i => i.id === 'npc_kenta' && this.quests.done.has('tutorial') ? { ...i, pos: [-3.2, -24] as [number, number] } : i);
    return list.concat(this.dynInteract);
  }
  private findInteract(): Interactable | null {
    const p = this.player; let best: Interactable | null = null, bd = 2.6;
    for (const it of this.interactables()) { if ((it.layer || 0) !== p.layer) continue; const d = Math.hypot(it.pos[0] - p.x, it.pos[1] - p.z); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  interact() {
    const it = this.findInteract(); if (!it) return;
    if (this.quests.onInteract(it.id)) return;
    switch (it.kind) {
      case 'door': this.useDoor(it.id); break;
      case 'shop': this.emit('openShop', { id: it.id }); break;
      case 'bench': this.emit('openRest', {}); break;
      case 'bus': this.emit('openTravel', {}); break;
      case 'npc': this.emit('npcTalk', { id: it.id, npc: it.npc }); break;
      case 'item': this.emit('toast', { text: tx({ th: 'แมวมองคุณอย่างไม่สนใจ', en: 'The cat ignores you' }) }); break;
    }
  }
  useDoor(id: string) {
    const p = this.player;
    if (id === 'door_roof') { p.layer = 1; p.x = p.px = ROOF.roofSpawn[0]; p.z = p.pz = ROOF.roofSpawn[1]; p.yaw = Math.PI; this.camYaw = 0; }
    else { p.layer = 0; p.x = p.px = ROOF.door[0]; p.z = p.pz = ROOF.door[1] + 1.5; this.camYaw = Math.PI; }
    p.vx = p.vz = 0; this.emit('teleport', { layer: p.layer });
  }
  teleport(x: number, z: number, layer = 0) {
    const p = this.player; const [nx, nz] = this.freeSpot(x, z, 2, layer); p.x = p.px = nx; p.z = p.pz = nz; p.layer = layer; p.vx = p.vz = 0; p.setState('idle');
    for (const f of this.fighters) if (!f.isPlayer && f.aggro && !f.encounter && f.alive) this.despawn(f);
    this.emit('teleport', { layer });
  }
  setClock(h: number) { this.clock = ((h % 24) + 24) % 24; this.emit('clock', { h: this.clock }); }

  // ---------------- dialogue ----------------
  say(lines: DLine[], onDone?: () => void) {
    if (!lines || !lines.length) { onDone?.(); return; }
    if (this.dialogue) { const prev = this.dialogue; const prevDone = prev.onDone; prev.lines = prev.lines.concat(lines); prev.onDone = () => { prevDone?.(); onDone?.(); }; return; }
    this.dialogue = { lines, i: 0, onDone }; this.emit('dialogue', this.dialogue);
  }
  advanceDialogue(choice: number) {
    const d = this.dialogue; if (!d) return; const line = d.lines[d.i];
    if (line.choices && line.choices.length) {
      if (choice < 0) return; const c = line.choices[choice]; if (!c) return;
      if (c.rel) for (const [k, v] of Object.entries(c.rel)) this.addRel(k, v); if (c.rep) this.progress.addRep(c.rep); if (c.flag) this.flags.add(c.flag);
      this.emit('choice', { c });
    }
    d.i++;
    if (d.i >= d.lines.length) { this.dialogue = null; this.emit('dialogueEnd'); d.onDone?.(); }
    else this.emit('dialogue', d);
  }
  addRel(id: string, v: number) { const cm = this.progress.stats.charisma; const g = v > 0 ? v * (1 + (cm - 5) * 0.03) : v; this.relations[id] = clamp((this.relations[id] || 0) + Math.round(g), -100, 100); this.emit('relation', { id, value: this.relations[id] }); }

  // ---------------- main tick ----------------
  step(dt: number, input: Input | null) {
    if (this.paused) return;
    this.time += dt; this.playTime += dt;
    const p = this.player;
    for (const f of this.fighters) { f.px = f.x; f.pz = f.z; }
    if (input) this.playerInput(input, dt);
    const frozen = !!this.dialogue || this.menuOpen;
    // time of day (night hours pass faster)
    if (!frozen) { const rate = this.isNight ? 1 / 28 : 1 / 50; this.clock += dt * rate; if (this.clock >= 24) this.clock -= 24; }
    if (frozen) { this.quests.update(dt); return; }
    if (this.slowmoT > 0) this.slowmoT -= dt;
    const slow = this.slowmoT > 0 ? 0.3 : 1;
    this.habits.update(dt, p.state === 'block');
    for (const f of this.fighters) {
      f.slowmo = f.isPlayer ? 1 : slow;
      if (f.ai && !f.civilian) { if (f.aggro || f.feud) f.ai.update(dt, this); else { f.intentX = f.intentZ = 0; f.wantBlock = false; f.faceYaw = null; } }
    }
    for (const f of this.fighters) this.combat.update(f, dt);
    this.combat.resolve();
    this.separate();
    // boss phases
    for (const f of this.fighters) if (f.phases && f.alive && f.state !== 'taunt') {
      const frac = f.hp / f.maxHp; const ph = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
      if (ph > f.phase) {
        f.phase = ph; const P = f.phases[ph]; f.moveset = P.moves; if (f.ai) f.ai.phaseOv = P.ai; f.special = P.special;
        if (f.state === 'grabbed' && f.grabbedBy) { f.grabbedBy.grabbed = null; f.grabbedBy.setState('idle'); f.grabbedBy = null; }
        f.setState('taunt', 1.5); f.invuln = 1.5; f.meter = Math.max(f.meter, 60 + ph * 20); f.stun = 0; f.guard = f.mods.guardMax;
        f.bubble = tx(P.taunt); f.bubbleT = 2.5;
        const d = f.distTo(p); if (d < 4 && p.alive) { this.combat.knockdown(p, (p.x - f.x) / Math.max(d, 0.1) * 6, (p.z - f.z) / Math.max(d, 0.1) * 6, 3, 0.4); }
        this.emit('bossPhase', { f, phase: ph });
      }
    }
    // KO bookkeeping, rewards, cleanup
    for (const f of this.fighters) {
      if (f.isPlayer || f.rewarded || f.alive) continue;
      f.rewarded = true; f.defeated = true; this.coord.release(f);
      if (f.hostileToPlayer || f.aggro || f.feud) {
        const byPlayer = !f.lastAttacker || f.lastAttacker.isPlayer; if (byPlayer) {
          const exp = this.progress.addExp(f.expValue); const money = this.progress.addMoney(f.moneyValue); const rep = this.progress.addRep(f.tier === 'boss' ? 150 : f.tier === 'miniboss' ? 80 : f.tier === 'mid' ? 20 : 6);
          this.stats.kills++; this.emit('reward', { f, exp, money, rep });
        }
        if (f.phases) { this.bosses.add(f.charId); this.stats.bossKills++; this.emit('bossDefeated', { f }); }
      }
    }
    this.fighters = this.fighters.filter(f => f.isPlayer || f.state !== 'ko' || f.koT < 6);
    if (p.comboCount > this.stats.maxCombo) this.stats.maxCombo = p.comboCount;
    // player down
    if (!p.alive && this.godMode) { p.hp = p.maxHp; p.setState('idle'); }
    if (!p.alive) { if (this.downT <= 0) { this.downT = 3; this.emit('playerDown'); } }
    if (this.downT > 0) { this.downT -= dt; if (this.downT <= 0) this.respawn(); }
    // world systems
    this.spawnTimer -= dt; if (this.spawnTimer <= 0) { this.spawnTimer = 2; this.ambientSpawn(); }
    this.updateAggro(); this.updateStreetEvent(dt); this.quests.update(dt);
    const fights: [number, number][] = []; for (const f of this.fighters) if (f.aggro && f.alive && fights.length < 6) fights.push([f.x, f.z]);
    if (fights.length) this.lastCombatT = this.time;
    this.crowd.night = this.nightFactor; this.crowd.hour = this.clock; this.crowd.update(dt, p.x, p.z, fights, slow);
    this.interactTarget = this.downT > 0 ? null : this.findInteract();
    // network
    this.netT -= dt; if (this.net) { this.net.tick(dt); if (this.netT <= 0) { this.netT = 0.1; this.net.send({ type: 'snapshot', snap: { id: this.net.localId, name: 'Haru', x: p.x, z: p.z, yaw: p.yaw, anim: p.state, level: this.progress.level, color: this.custom.jacket, t: this.time } }); } }
    for (const [id, r] of this.remotes) if (this.time - r.seen > 5) this.remotes.delete(id);
  }
  private separate() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j]; if (a.layer !== b.layer || !a.alive || !b.alive || a.state === 'grabbed' || b.state === 'grabbed') continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.radius + b.radius;
      if (d < m && d > 1e-4) { const push = (m - d) * 0.5; const nx = dx / d, nz = dz / d; a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        [a.x, a.z] = this.col.resolve(a.x, a.z, a.radius, a.layer); [b.x, b.z] = this.col.resolve(b.x, b.z, b.radius, b.layer); }
    }
  }
  respawn() {
    const p = this.player; const lost = Math.floor(this.progress.money * 0.1); this.progress.money -= lost;
    for (const e of [...this.encounters.values()]) if (!e.done) this.resetEncounter(e.id);
    for (const f of this.fighters) if (!f.isPlayer && f.aggro) this.despawn(f);
    if (this.event) { for (const f of this.event.fighters) this.despawn(f); if (this.event.victim) this.despawn(this.event.victim); this.event = null; }
    const [x, z, layer] = this.checkpoint; p.layer = layer; const [nx, nz] = this.freeSpot(x, z, 2, layer); p.x = p.px = nx; p.z = p.pz = nz;
    p.hp = p.maxHp; p.stamina = p.maxStamina; p.y = 0; p.vy = 0; p.setState('getup', 0.6); p.invuln = 2; p.stun = 0; p.grabbedBy = null;
    this.coord.clear(); this.quests.onRespawn(); this.emit('respawn', { lost });
  }

  // ---------------- save / load ----------------
  serialize(): SaveData {
    const p = this.player, g = this.progress;
    return { version: SAVE_VERSION, savedAt: Date.now(), playTime: this.playTime,
      player: { x: p.x, z: p.z, layer: p.layer, yaw: p.yaw, hp: p.hp, stamina: p.stamina, meter: p.meter },
      prog: { level: g.level, exp: g.exp, statPoints: g.statPoints, skillPoints: g.skillPoints, stats: { ...g.stats }, skills: [...g.skills], rep: g.rep, money: g.money, inventory: { ...g.inventory } },
      quests: this.quests.serialize(), bosses: [...this.bosses], relations: { ...this.relations }, custom: { ...this.custom }, time: this.clock, stats: { ...this.stats } };
  }
  load(d: SaveData) {
    const g = this.progress; g.level = d.prog.level; g.exp = d.prog.exp; g.statPoints = d.prog.statPoints; g.skillPoints = d.prog.skillPoints;
    for (const k of Object.keys(g.stats)) if (typeof d.prog.stats[k] === 'number') (g.stats as any)[k] = d.prog.stats[k];
    g.skills = new Set(d.prog.skills.filter(id => SKILL_BY_ID[id])); g.rep = d.prog.rep; g.money = d.prog.money; g.inventory = { onigiri: 0, drink: 0, bento: 0, ...d.prog.inventory };
    this.bosses = new Set(d.bosses); this.relations = { ...this.relations, ...d.relations }; this.custom = { ...DEFAULT_LOOK, title: '', ...(d.custom || {}) } as any; this.clock = d.time ?? 14;
    if (d.stats) Object.assign(this.stats, d.stats); this.playTime = d.playTime || 0;
    for (const f of this.fighters) if (!f.isPlayer) this.despawn(f);
    this.fighters = [this.player]; this.encounters.clear(); this.event = null; this.dialogue = null; this.coord.clear();
    this.quests.load(d.quests);
    const p = this.player; p.layer = d.player.layer || 0; const [x, z] = this.col.resolve(d.player.x, d.player.z, p.radius, p.layer); p.x = p.px = x; p.z = p.pz = z; p.yaw = d.player.yaw || 0;
    this.refreshPlayerStats(false); p.hp = clamp(d.player.hp, 1, p.maxHp); p.stamina = isFinite(d.player.stamina) ? d.player.stamina : p.maxStamina; p.meter = d.player.meter || 0; p.setState('idle'); p.appearance = this.custom;
    this.emit('loaded');
  }
}
