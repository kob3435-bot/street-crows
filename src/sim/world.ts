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
import { ENCOUNTERS, MAIN_CHAIN, type DLine } from '../data/quests';
import { VARIANTS, rollVariant, ZONE_LEVEL } from '../data/enemies';
import { Nav } from './nav';
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
export interface StreetEvent { kind: 'bully' | 'challenge' | 'gangwar' | 'ambush' | 'rumble' | 'robbery'; x: number; z: number; fighters: Fighter[]; victim?: Fighter; t: number; done: boolean }

/** The whole game state + fixed-step simulation. Rendering reads from it, never writes. */
export class World {
  city: CityData; col; combat: Combat; coord = new AttackCoordinator(); habits = new PlayerHabits(); progress = new Progression(); quests: QuestSystem; crowd: Crowd;
  fighters: Fighter[] = []; player!: Fighter; time = 0; clock = 14.0; playTime = 0; camYaw = Math.PI * 0.85; camPitch = 0.5; slowmoT = 0;
  /** Camera zoom distance (m). Default = wide overview; clamped to [CAM_MIN, CAM_MAX]. */
  camZoom = 11; static CAM_MIN = 4.5; static CAM_MAX = 18; static CAM_DEFAULT = 11;
  nav: Nav; bestiary = new Set<string>();
  /** AUTO: walks to the nearest hostile. Never attacks/blocks/dodges. */
  auto = false; autoTarget: Fighter | null = null; autoPath: [number, number][] | null = null; autoRepathT = 0; autoRetargetT = 0; autoHold = 0; autoNoTargetT = 0; autoStatus: 'off' | 'seek' | 'engage' | 'manual' | 'paused' | 'none' = 'off'; autoInRange = false; private autoLastXZ: [number, number, number] = [0, 0, 0];
  relations: Record<string, number> = {}; bosses = new Set<string>(); custom: Appearance & { title: string } = { ...DEFAULT_LOOK, title: '' };
  encounters = new Map<string, EncState>(); dialogue: { lines: DLine[]; i: number; onDone?: () => void } | null = null; menuOpen = false; paused = false;
  remotes = new Map<string, PlayerSnapshot & { seen: number }>(); flags = new Set<string>(); friendlyGangs = new Set<string>();
  event: StreetEvent | null = null; eventTimer = 120; spawnTimer = 1; checkpoint: [number, number, number] = [136, 6, 0]; downT = 0;
  stats = { kills: 0, bossKills: 0, perfectDodges: 0, counters: 0, throws: 0, finishers: 0, maxCombo: 0, hitsLanded: 0, hitsTaken: 0 };
  netT = 0; zoneId = ''; godMode = false; lastCombatT = -99; interactTarget: Interactable | null = null; dynInteract: Interactable[] = []; kentaMoved = false;
  constructor(public net: NetworkAdapter | null, crowdCount = 120) {
    this.city = generateCity(); this.col = this.city.col; this.combat = new Combat(this); this.nav = new Nav(this.col);
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
  /** Story progress (number of main-chain quests done, 0..11). */
  storyStage() { let n = 0; for (const id of MAIN_CHAIN) if (this.quests.done.has(id)) n++; return n; }
  /** Recommended enemy level at a spot: zone base, raised by story progress. */
  areaLevel(x: number, z: number) { const zn = this.zoneAt(x, z); return Math.max(ZONE_LEVEL[zn.id] ?? 2, Math.round(this.storyStage() * 1.7)); }
  makeFighter(opts: { char?: string; gang?: string; tier?: Tier; x: number; z: number; layer?: number; level?: number; variant?: string }): Fighter {
    const f = new Fighter(); f.x = f.px = opts.x; f.z = f.pz = opts.z; f.layer = opts.layer || 0; const plv = this.progress.level;
    if (opts.char) {
      const c = CHAR_BY_ID[opts.char]; f.charId = c.id; f.name = tx(c.name); f.displayTitle = tx(c.nickname); f.tier = c.tier; f.team = c.gang; f.appearance = c.look;
      const dl = opts.level ?? c.lvl ?? (c.tier === 'boss' ? 5 : 3); const over = Math.max(0, plv - dl);
      const scale = 1 + over * 0.04 + (opts.level && c.lvl && opts.level > c.lvl ? (opts.level - c.lvl) * 0.05 : 0);
      f.maxHp = f.hp = Math.round(c.hp * scale); f.atk = c.atk * (1 + over * 0.03 + (opts.level && c.lvl && opts.level > c.lvl ? (opts.level - c.lvl) * 0.03 : 0)); f.def = c.def; f.speed = c.ai.speed; f.moveset = c.moves.length ? c.moves : BASIC_MOVES; f.special = c.special || '';
      f.ai = new AIBrain(f, { ...c.ai }); f.phases = c.phases || null; if (f.phases) { f.moveset = f.phases[0].moves; f.ai.phaseOv = f.phases[0].ai; }
      f.expValue = c.tier === 'boss' ? 420 : c.tier === 'miniboss' ? 200 : 70; f.moneyValue = c.tier === 'boss' ? 1500 : c.tier === 'miniboss' ? 800 : 300;
      f.radius = 0.45 * Math.max(0.9, c.look.build * 0.95); f.level = Math.max(plv, dl);
      if (c.tier === 'boss' || c.tier === 'miniboss') { f.expValue = Math.round(f.expValue * (1 + dl * 0.12)); f.moneyValue = Math.round(f.moneyValue * (1 + dl * 0.08)); }
    } else {
      const g = GANG_BY_ID[opts.gang || 'kurogane']; const tier = opts.tier || 'grunt'; f.tier = tier; f.team = g.id;
      const area = this.areaLevel(opts.x, opts.z);
      const early = this.storyStage() === 0; // prologue: gentle, never above the player's level
      const lvl = Math.max(1, opts.level ?? Math.min(plv + (early ? 0 : 3), Math.round(area * 0.55 + plv * 0.45) + Math.floor(Math.random() * 3) - 1)); f.level = lvl;
      let vid = opts.variant ?? rollVariant(g.variants); if (early && !opts.variant) vid = 'brawler'; if (vid === 'leader' && tier !== 'mid' && !opts.variant) vid = 'brawler'; const V = VARIANTS[vid] || VARIANTS.brawler; f.variant = V.id;
      f.name = g.gruntNames[Math.floor(Math.random() * g.gruntNames.length)]; f.displayTitle = tx(g.name);
      const hairs = ['pompadour', 'spiky', 'buzz', 'slick', 'mohawk', 'messy', 'long'] as const; const hc = ['#1a1a1a', '#3a2412', '#c8a040', '#8a3a1a', '#d0d0d0', '#2a2a2a'];
      f.appearance = { hair: hairs[Math.floor(Math.random() * hairs.length)], hairColor: hc[Math.floor(Math.random() * hc.length)], jacket: g.color, shirt: '#e8e8e8', pants: '#1c1c22', shoes: '#151515', skin: ['#e9c29f', '#d8ad84', '#c89a74', '#f0d0b0'][Math.floor(Math.random() * 4)], accessory: Math.random() < 0.2 ? 'bandage' : 'none', build: 0.9 + Math.random() * 0.35, height: 0.94 + Math.random() * 0.12, ...g.uniform } as Appearance;
      const mid = tier === 'mid';
      f.maxHp = f.hp = Math.round(((mid ? 120 : 52) + lvl * (mid ? 14 : 7)) * V.hp); f.atk = ((mid ? 8 : 5.6) + lvl * 0.3) * V.atk; f.def = (8 + lvl * 0.3) * V.def; f.speed = 0.95 + Math.random() * 0.1;
      if (early) f.atk *= 0.78; // prologue fights are forgiving
      f.moveset = mid ? (V.midMoves.length ? V.midMoves : MID_MOVES) : (V.moves.length ? V.moves : BASIC_MOVES);
      const baseAi = { ...AI_TIER[tier], ...V.ai }; f.ai = new AIBrain(f, { ...baseAi, aggression: baseAi.aggression + (Math.random() - 0.5) * 0.2 });
      f.appearance = { ...f.appearance, ...V.look, build: (V.look.build ?? 1) * (0.92 + Math.random() * 0.16) } as Appearance;
      if (V.id !== 'brawler') f.displayTitle = tx(g.name) + ' · ' + tx(V.name);
      f.expValue = Math.round(((mid ? 60 : 20) + lvl * (mid ? 6 : 3)) * (V.leader ? 1.6 : 1)); f.moneyValue = (mid ? 160 : 45) + Math.floor(Math.random() * 40);
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
      const ring = k < 7 ? 4 : 6.5; const a = baseA + (k++ - 1) * (k <= 7 ? 0.7 : 0.9); const [x, z] = this.freeSpot(pl.pos[0] + Math.sin(a) * ring, pl.pos[1] + Math.cos(a) * ring, 2.5, layer);
      const f = this.makeFighter({ char: m.char, gang: m.gang, tier: m.tier, x, z, layer, variant: m.variant, level: m.lvl });
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
    if (this.dialogue || this.quests.isActive('tutorial')) return;
    const stage = this.storyStage();
    // who spawns here: territory gang; friendly/empty turf gets Stray Dogs; at night after ch7 the Gekko roam
    let gangId = zn.gang || '';
    const density = zn.gang ? zn.spawnDensity : 0.35;
    if (gangId === 'yamikaze' && !this.isNight && Math.random() < 0.5) gangId = 'onigawara';
    if ((!gangId || !this.gangHostile(gangId)) && stage >= 2 && Math.random() < 0.45) gangId = 'nora';
    if (this.isNight && stage >= 8 && !this.quests.done.has('main10') && Math.random() < 0.35) gangId = 'gekko';
    if (!gangId || density <= 0) return;
    const cap = Math.round(3 + density * 6 + (this.isNight ? 2 : 0) + Math.min(3, stage * 0.4));
    if (nearby.length >= cap) return;
    const activeEnc = [...this.encounters.values()].some(e => !e.done && e.fighters.some(f => f.alive));
    if (activeEnc) return;
    const [x0, z0, x1, z1] = zn.rect;
    for (let tries = 0; tries < 12; tries++) {
      const x = x0 + 4 + Math.random() * (x1 - x0 - 8), z = z0 + 4 + Math.random() * (z1 - z0 - 8); const d = Math.hypot(x - p.x, z - p.z);
      if (d < 28 || d > 60 || this.col.solidAt(x, z, 1.2, 0)) continue;
      const hostile = this.gangHostile(gangId);
      const big = hostile && Math.random() < 0.25 + stage * 0.03;
      const n = Math.min(cap - nearby.length + 1, big ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * (density > 0.7 ? 3 : 2)));
      const plv = this.progress.level; const gid = 'amb' + this.time.toFixed(2) + x.toFixed(1);
      const patrol = hostile && Math.random() < 0.45; let leader: Fighter | null = null;
      for (let i = 0; i < Math.max(2, n); i++) {
        const [fx, fz] = this.freeSpot(x, z, 2.5 + n * 0.3);
        const mid = (plv >= 3 || stage >= 1) && i === 0 && Math.random() < (big ? 0.8 : 0.35);
        const f = this.makeFighter({ gang: gangId, tier: mid ? 'mid' : 'grunt', x: fx, z: fz, variant: mid && Math.random() < 0.55 ? 'leader' : undefined });
        f.hostileToPlayer = hostile; f.loiter = true; f.faceTo(x, z); f.group = gid;
        if (patrol) { if (!leader) { leader = f; f.patrol = { leader: null, tx: fx, tz: fz, zone: zn.id, ox: 0, oz: 0 }; } else f.patrol = { leader, tx: 0, tz: 0, zone: zn.id, ox: fx - leader.x, oz: fz - leader.z }; }
      }
      break;
    }
  }
  /** Leader aura + patrol walking for non-aggro gang squads. */
  private updateSquads(dt: number) {
    this.squadT -= dt;
    if (this.squadT <= 0) {
      this.squadT = 0.5;
      const leaders = this.fighters.filter(f => f.alive && f.variant === 'leader' && (f.aggro || f.encounter));
      for (const f of this.fighters) {
        if (f.isPlayer || !f.alive || f.civilian) { f.buffed = false; continue; }
        f.buffed = f.variant !== 'leader' && leaders.some(l => l.team === f.team && l.layer === f.layer && l.distTo(f) < 8);
      }
    }
    for (const f of this.fighters) {
      const pt = f.patrol; if (!pt || !f.alive || f.aggro || !f.ai || f.civilian || !f.canAct) continue;
      if (pt.leader && !pt.leader.alive) { f.patrol = null; continue; }
      let gx: number, gz: number;
      if (pt.leader) { gx = pt.leader.x + pt.ox; gz = pt.leader.z + pt.oz; }
      else {
        if (Math.hypot(pt.tx - f.x, pt.tz - f.z) < 1.5 || Math.random() < dt * 0.05) {
          const zn = ZONES.find(z => z.id === pt.zone); const [x0, z0, x1, z1] = zn ? zn.rect : [f.x - 20, f.z - 20, f.x + 20, f.z + 20];
          for (let k = 0; k < 8; k++) { const c = this.nav.randomOpen(f.x, f.z, 22, f.layer, Math.random); if (c && c[0] > x0 && c[0] < x1 && c[1] > z0 && c[1] < z1 && this.nav.clear(f.x, f.z, c[0], c[1], f.layer)) { pt.tx = c[0]; pt.tz = c[1]; break; } }
        }
        gx = pt.tx; gz = pt.tz;
      }
      const dx = gx - f.x, dz = gz - f.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { const sp = Math.min(1, d / 2) * 0.42; f.intentX = dx / d * sp; f.intentZ = dz / d * sp; }
      if (f.ai) { f.ai.homeX = f.x; f.ai.homeZ = f.z; }
    }
  }
  private squadT = 0;
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
    const g = f.group;
    for (const o of this.fighters) if (o.alive && !o.isPlayer && (o === f || (g !== undefined && g !== null && o.group === g) || (o.team === f.team && o.distTo(f) < 7 && !o.aggro && o.hostileToPlayer))) { o.aggro = true; o.loiter = false; if (o.ai) o.ai.mode = 'approach'; }
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
        e.done = true; const rep = e.kind === 'challenge' ? 50 : e.kind === 'gangwar' || e.kind === 'rumble' ? 70 : 40; const money = e.kind === 'challenge' ? 600 : e.kind === 'rumble' ? 800 : e.kind === 'robbery' ? 500 : 300;
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
    const kinds: StreetEvent['kind'][] = ['bully', 'challenge', 'gangwar', 'robbery']; if (this.progress.rep >= 350) kinds.push('ambush'); if (this.storyStage() >= 3) kinds.push('rumble', 'rumble');
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const fwd = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    let pos: [number, number] | null = null;
    for (let i = 0; i < 20 && !pos; i++) { const a = fwd + (Math.random() - 0.5) * 2, d = 16 + Math.random() * 10; const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d; if (!this.col.insideSolid(x, z, 0) && !this.col.blocked(p.x, p.z, x, z, 0)) pos = [x, z]; }
    if (!pos) { this.eventTimer = 20; return; }
    const hostileGangs = GANGS.filter(g => this.gangHostile(g.id) && g.id !== 'gekko').map(g => g.id); if (hostileGangs.length < 2) hostileGangs.push('nora', 'tekkotsu');
    const g1 = hostileGangs[Math.floor(Math.random() * hostileGangs.length)];
    const ev: StreetEvent = { kind, x: pos[0], z: pos[1], fighters: [], t: 0, done: false };
    if (kind === 'bully') {
      const [vx, vz] = this.freeSpot(pos[0], pos[1], 1); const v = this.makeFighter({ gang: 'kurogane', x: vx, z: vz }); v.civilian = true; v.team = 'civilian'; v.ai = null; v.hostileToPlayer = false; v.appearance = { ...v.appearance, jacket: '#3a4a6a', hair: 'messy', build: 0.8 }; v.name = tx({ th: 'นักเรียน', en: 'Student' }); v.state = 'dizzy'; v.stateDur = 999; v.bubble = tx({ th: 'ช่วยด้วย!', en: 'Help!' }); v.bubbleT = 4; ev.victim = v;
      for (let i = 0; i < 2; i++) { const [x, z] = this.freeSpot(pos[0], pos[1], 2.5); const f = this.makeFighter({ gang: g1, x, z }); f.hostileToPlayer = true; f.loiter = false; f.faceTo(vx, vz); f.group = 'ev' + this.time; ev.fighters.push(f); }
    } else if (kind === 'challenge') {
      const st = this.storyStage(); const pool = ['ryo', 'kai', 'ishida', 'fuwa', 'bunta', 'mogami', 'daigo', ...(st >= 6 ? ['baba', 'kuroki'] : []), ...(st >= 8 ? ['inazuma', 'ishigami'] : [])].filter(id => !this.encounterActiveFor(id));
      const cid = pool[Math.floor(Math.random() * pool.length)]; const [x, z] = this.freeSpot(pos[0], pos[1], 1.5);
      const f = this.makeFighter({ char: cid, x, z }); f.hostileToPlayer = true; f.aggro = true; f.faceTo(p.x, p.z); f.bubble = tx({ th: 'เฮ้ย ฮารุ โบยะ! ดวลกับฉัน!', en: 'Oi, Haru Boya! Fight me!' }); f.bubbleT = 3; ev.fighters.push(f);
      f.expValue = 90; f.moneyValue = 400;
    } else if (kind === 'gangwar') {
      const g2 = hostileGangs.filter(g => g !== g1)[Math.floor(Math.random() * (hostileGangs.length - 1))];
      for (const [g, other, off] of [[g1, g2, -2.5], [g2, g1, 2.5]] as [string, string, number][]) for (let i = 0; i < 3; i++) {
        const [x, z] = this.freeSpot(pos[0] + off, pos[1] + (i - 1) * 1.5, 1.5); const f = this.makeFighter({ gang: g, x, z }); f.feud = other; f.hostileToPlayer = true; f.loiter = false; f.group = 'gw' + g + this.time; ev.fighters.push(f);
      }
    } else if (kind === 'robbery') {
      const [vx, vz] = this.freeSpot(pos[0], pos[1], 1); const v = this.makeFighter({ gang: 'kurogane', x: vx, z: vz }); v.civilian = true; v.team = 'civilian'; v.ai = null; v.hostileToPlayer = false; v.appearance = { ...v.appearance, jacket: '#8a8070', hair: 'slick', hairColor: '#9a9a9a', longCoat: true, build: 0.95 }; v.name = tx({ th: 'เจ้าของร้าน', en: 'Shopkeeper' }); v.state = 'dizzy'; v.stateDur = 999; v.bubble = tx({ th: 'โจร! ช่วยด้วย!', en: 'Thieves! Help!' }); v.bubbleT = 4; ev.victim = v;
      const gid = 'rb' + this.time; for (let i = 0; i < 3; i++) { const [x, z] = this.freeSpot(pos[0], pos[1], 2.5); const f = this.makeFighter({ gang: 'nora', tier: i === 0 ? 'mid' : 'grunt', x, z, variant: i === 0 ? 'leader' : undefined }); f.hostileToPlayer = true; f.loiter = false; f.faceTo(vx, vz); f.group = gid; ev.fighters.push(f); }
    } else if (kind === 'rumble') {
      const n = 6 + Math.floor(Math.random() * 3); const gid = 'rm' + this.time;
      for (let i = 0; i < n; i++) { const [x, z] = this.freeSpot(pos[0], pos[1], 3.5); const f = this.makeFighter({ gang: g1, tier: i === 0 ? 'mid' : 'grunt', x, z, variant: i === 0 ? 'leader' : undefined }); f.hostileToPlayer = true; f.aggro = true; f.group = gid; ev.fighters.push(f); }
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
    this.camYaw -= look.x; this.camPitch = clamp(this.camPitch + look.y, 0.05, 1.2);
    const zd = input.consumeZoom(); if (zd) { const nz = clamp(this.camZoom + zd, World.CAM_MIN, World.CAM_MAX); if (nz !== this.camZoom) { this.camZoom = nz; this.emit('zoom', { d: nz }); } }
    const pressed = input.consumePressed();
    if (pressed.has('menu') || pressed.has('pause')) this.emit('menuKey', { key: pressed.has('menu') ? 'menu' : 'pause' });
    if (pressed.has('map')) this.emit('menuKey', { key: 'map' }); if (pressed.has('help')) this.emit('menuKey', { key: 'help' });
    if (pressed.has('auto') && !this.menuOpen) this.setAuto(!this.auto);
    p.faceYaw = null;
    if (this.dialogue) { p.intentX = p.intentZ = 0; p.wantBlock = false; if (this.auto) this.autoStatus = 'paused'; if (pressed.has('interact') || pressed.has('punch') || pressed.has('dodge')) this.advanceDialogue(-1); return; }
    if (this.menuOpen || this.downT > 0) { p.intentX = p.intentZ = 0; p.wantBlock = false; p.wantSprint = false; if (this.auto) this.autoStatus = 'paused'; return; }
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    p.intentX = rx * input.moveX + fx * input.moveY; p.intentZ = rz * input.moveX + fz * input.moveY;
    p.wantSprint = input.sprint; p.wantBlock = input.block;
    // AUTO walk: manual movement always wins; AUTO resumes 0.5 s after the stick/keys are released
    const manual = Math.hypot(input.moveX, input.moveY) > 0.12;
    if (manual) this.autoHold = 0.5; else if (this.autoHold > 0) this.autoHold -= dt;
    if (this.auto) { if (manual || this.autoHold > 0) { this.autoStatus = 'manual'; this.autoInRange = false; } else this.autoStep(dt, input); }
    for (const a of pressed) {
      if (a === 'interact') { this.interact(); continue; }
      if (a === 'item1') { this.useItem('onigiri'); continue; } if (a === 'item2') { this.useItem('drink'); continue; } if (a === 'item3') { this.useItem('bento'); continue; }
      if (['punch', 'heavy', 'kick', 'hkick', 'dodge', 'grab', 'special'].includes(a)) { if (!this.tryAction(a)) this.buffered = { a, t: 0.28 }; }
    }
    if (this.buffered) { this.buffered.t -= dt; if (this.buffered.t <= 0) this.buffered = null; }
  }
  setAuto(on: boolean, silent = false) {
    this.auto = on; this.autoTarget = null; this.autoPath = null; this.autoRetargetT = 0; this.autoInRange = false; this.autoStatus = on ? 'seek' : 'off'; this.autoNoTargetT = 0;
    if (!on) this.player.faceYaw = null;
    if (!silent) this.emit('autoToggle', { on });
  }
  /** Is this fighter a valid AUTO target (hostile, alive, same layer, never civilians / friendly gangs)? */
  autoValid(f: Fighter) { const p = this.player; return f !== p && f.alive && !f.civilian && f.layer === p.layer && !f.isPlayer && (f.hostileToPlayer || f.aggro) && f.team !== 'civilian' && f.state !== 'ko'; }
  autoPick(): Fighter | null {
    const p = this.player; let best: Fighter | null = null, bs = 1e9;
    for (const f of this.fighters) {
      if (!this.autoValid(f)) continue; const d = f.distTo(p);
      const quest = !!f.encounter; if (d > (quest ? 70 : 45)) continue;
      const s = d - (quest ? 30 : 0) - (f.phases ? 8 : 0) - (f.aggro && f.ai?.target === p ? 10 : 0) - (f === this.autoTarget ? 3 : 0);
      if (s < bs) { bs = s; best = f; }
    }
    return best;
  }
  currentTarget(): Fighter | null { if (this.auto && this.autoTarget?.alive) return this.autoTarget; const p = this.player; return this.lockTarget(p, 9); }
  private autoStep(dt: number, input: Input) {
    const p = this.player; this.autoRetargetT -= dt; this.autoRepathT -= dt;
    if (!this.autoTarget || !this.autoValid(this.autoTarget) || this.autoRetargetT <= 0) {
      const t = this.autoPick(); if (t !== this.autoTarget) { this.autoTarget = t; this.autoPath = null; this.autoRepathT = 0; } this.autoRetargetT = 0.8;
    }
    const t = this.autoTarget;
    if (!t) {
      this.autoStatus = 'none'; this.autoInRange = false; this.autoNoTargetT -= dt;
      if (this.autoNoTargetT <= 0) { this.autoNoTargetT = 6; const o = this.quests.objective(); this.emit('autoNoTarget', { dir: o ? Math.atan2(o.pos[0] - p.x, o.pos[1] - p.z) : null, dist: o ? Math.hypot(o.pos[0] - p.x, o.pos[1] - p.z) : 0, text: o?.text || '' }); }
      return;
    }
    const d = p.distTo(t); const stopD = 1.55 + t.radius + p.radius * 0.3; const resumeD = stopD + 0.9;
    if (this.autoInRange ? d < resumeD : d < stopD) {
      this.autoInRange = true; this.autoStatus = 'engage'; p.intentX = p.intentZ = 0; p.wantSprint = false;
      p.faceYaw = Math.atan2(t.x - p.x, t.z - p.z); this.autoPath = null; return;
    }
    this.autoInRange = false; this.autoStatus = 'seek';
    // path: straight if clear, otherwise grid A* (re-planned when the target moves or every 1.2 s)
    const moved = Math.hypot(t.x - this.autoLastXZ[0], t.z - this.autoLastXZ[1]) > 2.5;
    if (!this.autoPath || this.autoRepathT <= 0 || moved) {
      this.autoRepathT = 1.2; this.autoLastXZ = [t.x, t.z, 0];
      if (this.nav.clear(p.x, p.z, t.x, t.z, p.layer)) this.autoPath = [[t.x, t.z]];
      else { const fp = this.nav.findPath(p.x, p.z, t.x, t.z, p.layer); if (fp) this.autoPath = fp; else { this.autoPath = [[t.x, t.z]]; this.autoRepathT = 2.5; } }
    }
    const path = this.autoPath; while (path.length > 1 && Math.hypot(path[0][0] - p.x, path[0][1] - p.z) < 0.9) path.shift();
    const wx = path.length === 1 ? t.x : path[0][0], wz = path.length === 1 ? t.z : path[0][1];
    const dx = wx - p.x, dz = wz - p.z, dl = Math.hypot(dx, dz) || 1;
    p.intentX = dx / dl; p.intentZ = dz / dl; p.wantSprint = d > 9 && p.stamina > 15;
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
  ramenPrice() { return this.quests.done.has('side_taisho') ? 150 : this.quests.done.has('side_ramen') ? 300 : 600; }
  eatRamen() { const pr = this.ramenPrice(); if (this.progress.money < pr) return false; this.progress.money -= pr; const p = this.player; p.hp = p.maxHp; p.stamina = p.maxStamina; p.meter = Math.min(100, p.meter + 30); this.emit('ramen'); this.emit('save', { reason: 'ramen' }); return true; }

  interactables(): Interactable[] {
    const list = INTERACTABLES.filter(i => (!i.req || this.quests.done.has(i.req)) && !(i.npc && this.fighters.some(f => f.charId === i.npc && !f.isPlayer)))
      .map(i => i.id === 'npc_kenta' && this.quests.done.has('tutorial') ? { ...i, pos: [-3.2, -24] as [number, number] } : i);
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
    if (id === 'door_roof') { p.layer = 1; p.x = p.px = ROOF.roofSpawn[0]; p.z = p.pz = ROOF.roofSpawn[1]; p.yaw = -Math.PI / 2; this.camYaw = Math.PI / 2; }
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
    const p = this.player; this.coord.gentle = !this.quests.done.has('tutorial');
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
    this.updateSquads(dt);
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
          this.stats.kills++; this.bestiary.add(f.charId || (f.team + ':' + (f.variant || 'brawler'))); this.emit('reward', { f, exp, money, rep });
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
      quests: this.quests.serialize(), bosses: [...this.bosses], relations: { ...this.relations }, custom: { ...this.custom }, time: this.clock, stats: { ...this.stats }, auto: this.auto, bestiary: [...this.bestiary] };
  }
  load(d: SaveData) {
    const g = this.progress; g.level = d.prog.level; g.exp = d.prog.exp; g.statPoints = d.prog.statPoints; g.skillPoints = d.prog.skillPoints;
    for (const k of Object.keys(g.stats)) if (typeof d.prog.stats[k] === 'number') (g.stats as any)[k] = d.prog.stats[k];
    g.skills = new Set(d.prog.skills.filter(id => SKILL_BY_ID[id])); g.rep = d.prog.rep; g.money = d.prog.money; g.inventory = { onigiri: 0, drink: 0, bento: 0, ...d.prog.inventory };
    this.bosses = new Set(d.bosses); this.relations = { ...this.relations, ...d.relations }; this.custom = { ...DEFAULT_LOOK, title: '', ...(d.custom || {}) } as any; this.clock = d.time ?? 14;
    if (d.stats) Object.assign(this.stats, d.stats); this.playTime = d.playTime || 0;
    this.bestiary = new Set(d.bestiary || d.bosses || []); this.setAuto(!!d.auto, true);
    for (const f of this.fighters) if (!f.isPlayer) this.despawn(f);
    this.fighters = [this.player]; this.encounters.clear(); this.event = null; this.dialogue = null; this.coord.clear();
    this.quests.load(d.quests);
    const p = this.player; p.layer = d.player.layer || 0; const [x, z] = this.col.resolve(d.player.x, d.player.z, p.radius, p.layer); p.x = p.px = x; p.z = p.pz = z; p.yaw = d.player.yaw || 0;
    this.refreshPlayerStats(false); p.hp = clamp(d.player.hp, 1, p.maxHp); p.stamina = isFinite(d.player.stamina) ? d.player.stamina : p.maxStamina; p.meter = d.player.meter || 0; p.setState('idle'); p.appearance = this.custom;
    this.emit('loaded');
  }
}
