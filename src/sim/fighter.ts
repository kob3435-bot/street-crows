import type { Appearance, Tier, BossPhase } from '../data/types';
import { MOVES, type MoveDef, moveTotal } from './moves';
import type { AIBrain } from './ai';

export type FState = 'idle' | 'move' | 'attack' | 'hitstun' | 'blockstun' | 'knockdown' | 'getup' | 'block' | 'dodge' | 'grabbing' | 'grabbed' | 'thrown' | 'dizzy' | 'ko' | 'taunt';
export interface Mods {
  dmg: number; punch: number; kick: number; def: number; speed: number; atkSpeed: number; guardMax: number; guardTake: number; counter: number; counterWin: number;
  finisher: number; meter: number; perfectWin: number; slowmo: number; dodgeDist: number; dodgeIframe: number; dodgeCost: number; getup: number; fly: number;
  throwDmg: number; throwHitsOthers: boolean; sprintCost: number; earthshaker: boolean; combo3: boolean; comboWin: number; lastStand: boolean; stunMul: number; guardDmgMul: number; meteor: boolean; packBreaker: boolean; afterimage: boolean;
}
export const baseMods = (): Mods => ({ dmg: 1, punch: 1, kick: 1, def: 1, speed: 1, atkSpeed: 1, guardMax: 100, guardTake: 0.15, counter: 1, counterWin: 0.45, finisher: 1, meter: 1, perfectWin: 0.16, slowmo: 0.7, dodgeDist: 1, dodgeIframe: 0.26, dodgeCost: 18, getup: 1, fly: 1, throwDmg: 1, throwHitsOthers: false, sprintCost: 14, earthshaker: false, combo3: false, comboWin: 0, lastStand: false, stunMul: 1, guardDmgMul: 1, meteor: false, packBreaker: false, afterimage: false });

let NEXT_ID = 1;
export class Fighter {
  id = NEXT_ID++; name = ''; charId = ''; team = 'none'; isPlayer = false; tier: Tier = 'grunt'; level = 1; layer = 0;
  x = 0; z = 0; y = 0; px = 0; pz = 0; vx = 0; vz = 0; vy = 0; yaw = 0; radius = 0.45;
  hp = 100; maxHp = 100; stamina = 100; maxStamina = 100; meter = 0; guard = 100; stun = 0;
  atk = 10; def = 10; speed = 1; mods: Mods = baseMods();
  state: FState = 'idle'; stateT = 0; stateDur = 0;
  move: MoveDef | null = null; moveT = 0; hitSet = new Set<number>(); hitIdx = -1; chainFromPunch = false; lastMoveId = '';
  buffer: { a: string; t: number } | null = null;
  invuln = 0; counterWin = 0; counterKind: 'dodge' | 'block' | '' = ''; freeze = 0; blockT = 0; dodgeDirX = 0; dodgeDirZ = 0; evaded = false; perfectDone = false;
  grabbed: Fighter | null = null; grabbedBy: Fighter | null = null;
  intentX = 0; intentZ = 0; wantSprint = false; wantBlock = false; faceYaw: number | null = null;
  appearance!: Appearance; hurtFlash = 0; downT = 0; koT = 0; defeated = false; rewarded = false;
  ai: AIBrain | null = null; phases: BossPhase[] | null = null; phase = 0; special = ''; moveset: string[] = ['jab', 'jab2', 'kick'];
  aggro = false; loiter = true; feud = ''; hostileToPlayer = true; civilian = false; encounter = ''; displayTitle = ''; expValue = 20; moneyValue = 100;
  animT = 0; speedNow = 0; lastHitTime = 0; comboCount = 0; comboTimer = 0; telegraph = 0; stanceHit = false; slowmo = 1; throwHits: Fighter | null = null; moveInstance = 0; lastAttacker: Fighter | null = null; bubble = ''; bubbleT = 0;
  variant = ''; buffed = false; patrol: { leader: Fighter | null; tx: number; tz: number; zone: string; ox: number; oz: number; route?: [number, number][] | null; ri?: number; rt?: number } | null = null; group: any = undefined;
  /** City gang-site this fighter belongs to (-1 = none); AI LOD accumulators. */
  siteId = -1; aiAcc = 0; aiTick = 0;

  get alive() { return this.state !== 'ko' && this.hp > 0; }
  get busy() { return !(this.state === 'idle' || this.state === 'move' || this.state === 'block'); }
  get canAct() { return this.state === 'idle' || this.state === 'move' || this.state === 'block'; }
  movePhase(): 'startup' | 'active' | 'recovery' | null {
    if (this.state !== 'attack' || !this.move) return null; const m = this.move;
    return this.moveT < m.startup ? 'startup' : this.moveT < m.startup + m.active ? 'active' : 'recovery';
  }
  setState(s: FState, dur = 0) { this.state = s; this.stateT = 0; this.stateDur = dur; if (s !== 'attack') { this.move = null; } }
  startMove(id: string): boolean {
    const m = MOVES[id]; if (!m) return false;
    if (this.stamina < m.stamina * 0.5 && !this.ai) return false;
    this.stamina = Math.max(0, this.stamina - m.stamina);
    this.chainFromPunch = (this.move?.family === 'punch') || (this.chainFromPunch && this.move?.family === 'kick' && id === 'kick_c');
    this.lastMoveId = id; this.moveInstance++; this.move = m; this.moveT = 0; this.hitSet.clear(); this.hitIdx = -1; this.state = 'attack'; this.stateT = 0; this.stanceHit = false;
    if (m.invuln) this.invuln = Math.max(this.invuln, m.invuln);
    return true;
  }
  /** Can the current move be cancelled into another now? */
  canCancel(): boolean {
    if (this.state !== 'attack' || !this.move) return false;
    const m = this.move; return this.moveT >= m.startup + m.active * 0.5 && this.moveT <= moveTotal(m) + 0.001;
  }
  faceTo(x: number, z: number) { this.yaw = Math.atan2(x - this.x, z - this.z); }
  distTo(o: Fighter) { return Math.hypot(o.x - this.x, o.z - this.z); }
}
