import type { AIParams } from '../data/types';
import { Fighter } from './fighter';
import { MOVES } from './moves';
import { angleDiff, clamp } from '../core/rng';
import type { World } from './world';

/** Tracks what the player tends to do so enemies can adapt (exponentially decaying counters). */
export class PlayerHabits {
  punch = 0; heavy = 0; kick = 0; grab = 0; dodge = 0; special = 0; blockTime = 0;
  record(a: string) { if (a in this) (this as any)[a] += 1; }
  update(dt: number, blocking: boolean) {
    const k = Math.exp(-dt / 9);
    this.punch *= k; this.heavy *= k; this.kick *= k; this.grab *= k; this.dodge *= k; this.special *= k;
    this.blockTime = blocking ? this.blockTime + dt : this.blockTime * Math.exp(-dt / 2);
  }
  get punchSpam() { return this.punch > 7 && this.punch > (this.heavy + this.kick + this.grab) * 1.6; }
  get kickSpam() { return this.kick > 6 && this.kick > (this.punch + this.heavy) * 1.4; }
  get heavyHappy() { return this.heavy > 3.5; }
  get turtle() { return this.blockTime > 1.6; }
  get dodgeHappy() { return this.dodge > 3.5; }
  summary() { return { punchSpam: this.punchSpam, kickSpam: this.kickSpam, heavyHappy: this.heavyHappy, turtle: this.turtle, dodgeHappy: this.dodgeHappy }; }
}

/** Limits how many enemies may attack one target at a time (1-2), so groups surround instead of dog-piling. */
export class AttackCoordinator {
  private holders = new Map<number, Set<number>>();
  maxFor(targetId: number, engaged: number) { return engaged >= 4 ? 2 : engaged >= 2 ? (Math.random() < 0.5 ? 1 : 2) : 1; }
  request(f: Fighter, target: Fighter, engaged: number, force = false): boolean {
    let s = this.holders.get(target.id); if (!s) { s = new Set(); this.holders.set(target.id, s); }
    if (s.has(f.id)) return true;
    if (force || s.size < this.maxFor(target.id, engaged)) { s.add(f.id); return true; }
    return false;
  }
  release(f: Fighter) { for (const s of this.holders.values()) s.delete(f.id); }
  count(target: Fighter) { return this.holders.get(target.id)?.size || 0; }
  holds(f: Fighter, target: Fighter) { return !!this.holders.get(target.id)?.has(f.id); }
  clear() { this.holders.clear(); }
}

type Mode = 'loiter' | 'approach' | 'circle' | 'attack' | 'recover' | 'retreat' | 'feint' | 'flee' | 'cheer';
export class AIBrain {
  mode: Mode = 'loiter'; base: AIParams; phaseOv: Partial<AIParams> = {};
  target: Fighter | null = null; decisionT = 0.5; waitT = 0; comboLeft = 0; modeT = 0; circleDir = Math.random() < 0.5 ? 1 : -1;
  reactT = -1; reactedTo = -1; reactKind = ''; blockHold = 0; homeX = 0; homeZ = 0; slot = 0; adaptedMsg = false; lastAttackEnd = 0; fleeing = false;
  constructor(public f: Fighter, params: AIParams) { this.base = params; this.homeX = f.x; this.homeZ = f.z; }

  params(w: World): AIParams {
    const p = { ...this.base, ...this.phaseOv }; const h = w.habits;
    if (this.f.tier !== 'grunt') {
      if (h.punchSpam) { p.blockRate += 0.25; p.counterRate += 0.2; }
      if (h.kickSpam) { p.blockRate += 0.15; p.dodgeRate += 0.1; }
      if (h.heavyHappy) { p.dodgeRate += 0.2; p.counterRate += 0.15; }
      if (h.turtle) { p.grabRate += 0.45; }
      if (h.dodgeHappy) { p.feint += 0.25; p.patience += 0.8; }
    }
    if (w.progress.has('intimidate') && this.f.tier === 'grunt') { p.aggression *= 0.75; p.patience += 1; }
    p.blockRate = clamp(p.blockRate, 0, 0.9); p.dodgeRate = clamp(p.dodgeRate, 0, 0.8); p.counterRate = clamp(p.counterRate, 0, 0.9);
    return p;
  }
  setMode(m: Mode) { this.mode = m; this.modeT = 0; }

  update(dt: number, w: World) {
    const f = this.f; const dts = dt * f.slowmo; this.modeT += dts; this.decisionT -= dts;
    f.intentX = 0; f.intentZ = 0; f.wantSprint = false; f.faceYaw = null;
    if (!f.alive) { w.coord.release(f); return; }
    if (this.blockHold > 0) { this.blockHold -= dts; f.wantBlock = this.blockHold > 0; } else f.wantBlock = false;
    const p = this.params(w);
    // --- target selection ---
    const t = w.pickTarget(f);
    if (!t) { this.target = null; w.coord.release(f); if (this.mode !== 'loiter') this.setMode('loiter'); this.loiter(dts, w); return; }
    if (this.target !== t) { w.coord.release(f); this.target = t; if (this.mode === 'loiter') this.setMode('approach'); }
    const dx = t.x - f.x, dz = t.z - f.z, dist = Math.hypot(dx, dz); const toT = Math.atan2(dx, dz);
    // --- reactions to incoming attacks ---
    this.react(dts, t, dist, p, w);
    if (f.state === 'grabbing') { if (f.stateT > 0.35 + Math.random() * 0.4) w.combat.throwStart(f); return; }
    // --- combo continuation (cancel into next move) ---
    if (f.state === 'attack' && this.mode === 'attack' && f.canCancel() && this.comboLeft > 0 && dist < 3) {
      const next = this.nextInChain(f.move!.id, f); if (next) { this.comboLeft--; f.faceTo(t.x, t.z); f.startMove(next); w.habitsSeen(f, next); return; }
    }
    if (!f.canAct) return;
    // counter after a successful block / evade
    if (f.counterWin > 0 && dist < 2.8 && Math.random() < p.counterRate * dts * 12) { f.faceTo(t.x, t.z); f.startMove('counter'); w.emit('aiCounter', { f }); this.setMode('recover'); return; }
    const hpFrac = f.hp / f.maxHp;
    if (p.retreatHp > 0 && hpFrac < p.retreatHp && this.mode !== 'retreat' && this.mode !== 'flee' && !this.fleeing) {
      w.coord.release(f); this.fleeing = true;
      if (f.tier === 'grunt' && w.progress.has('intimidate') && w.progress.rep > 350 && Math.random() < 0.5) { this.setMode('flee'); f.bubble = 'flee'; f.bubbleT = 2; }
      else this.setMode('retreat');
    }
    const engaged = w.engagedCount(t);
    switch (this.mode) {
      case 'loiter': case 'approach': {
        this.moveToward(t.x, t.z, dist > 12, dts, w);
        if (dist < p.range + 1.2) { this.setMode('circle'); this.decisionT = 0.2 + Math.random() * 0.5; }
        break;
      }
      case 'circle': {
        this.waitT += dts; f.faceYaw = toT;
        const ang = w.slotAngle(f, t) + Math.sin(w.time * 0.6 + f.id) * 0.25 * this.circleDir;
        const r = p.range + (engaged > 2 && !w.coord.holds(f, t) ? 1.0 : 0);
        const gx = t.x + Math.sin(ang) * r, gz = t.z + Math.cos(ang) * r;
        this.moveToward(gx, gz, false, dts, w, 0.75);
        if (f.charId === 'kirishima' || (this.base.blockRate > 0.5 && Math.random() < 0.02)) { f.wantBlock = dist < 3.5; }
        const vulnerable = this.vulnerable(t);
        if (vulnerable && dist < 4.2 && w.coord.request(f, t, engaged, f.tier !== 'grunt')) { this.beginAttack(p, t, w, 1 + Math.floor(Math.random() * 2)); break; }
        if (this.decisionT <= 0) {
          this.decisionT = 0.35 + Math.random() * 0.55;
          const eager = p.aggression * clamp(this.waitT / p.patience, 0.25, 1.4);
          if (f.meter >= 100 && f.special && Math.random() < p.specialRate && dist < 7) { if (w.coord.request(f, t, engaged, f.tier === 'boss' || f.tier === 'miniboss')) { this.doSpecial(t, w); break; } }
          const r2 = Math.random();
          if (r2 < p.feint && dist < 5) { this.setMode('feint'); break; }
          if (Math.random() < eager) {
            if (w.coord.request(f, t, engaged, f.tier === 'boss' && engaged <= 1)) { this.beginAttack(p, t, w); break; }
          }
          if (Math.random() < 0.3) this.circleDir *= -1;
        }
        break;
      }
      case 'attack': {
        const first = this.chooseOpener(p, t, w); const m = MOVES[first];
        const reach = (m.aoe || m.range) + t.radius + (m.lunge > 5 ? 3 : 0.1);
        if (dist > reach) { this.moveToward(t.x, t.z, dist > 5, dts, w); if (this.modeT > 3) { w.coord.release(f); this.setMode('circle'); } break; }
        if (!this.comboStarted) {
          this.comboStarted = true; f.faceTo(t.x, t.z);
          if (w.progress.has('crowd_reader') && t.isPlayer) f.telegraph = 0.45;
          if (first === 'grab' || f.startMove(first)) { if (first === 'grab') f.startMove('grab'); w.habitsSeen(f, first); }
        } else { // combo finished
          w.coord.release(f); this.lastAttackEnd = w.time; this.setMode('recover'); this.waitT = 0;
        }
        break;
      }
      case 'recover': {
        f.faceYaw = toT; const back = (f.charId === 'hayate' ? 6.5 : p.range + 1.2);
        if (dist < back) { f.intentX = -dx / dist * 0.8; f.intentZ = -dz / dist * 0.8; f.wantSprint = f.charId === 'hayate'; }
        else { f.intentX = Math.cos(toT) * 0.5 * this.circleDir; f.intentZ = -Math.sin(toT) * 0.5 * this.circleDir; }
        if (this.modeT > 0.6 + Math.random() * 0.5) this.setMode('circle');
        break;
      }
      case 'feint': {
        f.faceYaw = toT;
        if (this.modeT < 0.28) { f.intentX = dx / dist; f.intentZ = dz / dist; f.wantSprint = true; }
        else if (this.modeT < 0.7) { f.intentX = -dx / dist; f.intentZ = -dz / dist; }
        else this.setMode('circle');
        break;
      }
      case 'retreat': {
        f.faceYaw = toT; f.wantBlock = dist < 3;
        if (dist < 8) { this.moveAway(t, dts, w); }
        if (this.vulnerable(t) && dist < 4 && w.coord.request(f, t, engaged)) { this.beginAttack(p, t, w, 1); break; }
        if (this.modeT > 4.5) { this.fleeing = false; this.setMode('circle'); this.base = { ...this.base, retreatHp: 0 }; }
        break;
      }
      case 'flee': { this.moveAway(t, dts, w); f.wantSprint = true; if (this.modeT > 3.5) w.despawn(f); break; }
    }
  }
  private comboStarted = false;
  private beginAttack(p: AIParams, t: Fighter, w: World, forceCombo?: number) {
    this.comboLeft = forceCombo ?? Math.floor(Math.random() * p.comboMax); this.comboStarted = false; this.opener = ''; this.setMode('attack');
  }
  private opener = '';
  private chooseOpener(p: AIParams, t: Fighter, w: World): string {
    if (this.opener) return this.opener;
    const set = this.f.moveset; const has = (m: string) => set.includes(m);
    let pickM = has('jab') ? 'jab' : set[0];
    const r = Math.random(); const dist = this.f.distTo(t);
    if ((t.state === 'block' || w.habits.turtle) && has('grab') && r < 0.35 + p.grabRate) pickM = 'grab';
    else if ((t.state === 'block' || w.habits.turtle) && (has('hkick') || has('heavy')) && r < 0.7) pickM = has('hkick') ? 'hkick' : 'heavy';
    else if (has('flykick') && dist > 4 && r < 0.5) pickM = 'flykick';
    else if (has('grab') && r < p.grabRate) pickM = 'grab';
    else if (has('headbutt') && r < 0.3) pickM = 'headbutt';
    else if (has('heavy') && r < 0.2) pickM = 'heavy';
    else if (has('hkick') && r < 0.28) pickM = 'hkick';
    else if (has('kick') && r < 0.55) pickM = 'kick';
    else if (has('roundhouse') && r < 0.65) pickM = 'roundhouse';
    this.opener = pickM; return pickM;
  }
  private nextInChain(cur: string, f: Fighter): string | null {
    const m = MOVES[cur]; if (!m.cancels) return null; const opts = Object.values(m.cancels).filter(x => x && (f.moveset.includes(x) || (x === 'kick_c' && f.moveset.includes('kick')) || (x === 'jab3' && f.tier !== 'grunt'))) as string[];
    if (!opts.length) return null; return opts[Math.floor(Math.random() * opts.length)];
  }
  private doSpecial(t: Fighter, w: World) {
    const f = this.f; f.faceTo(t.x, t.z); f.meter = 0; f.telegraph = MOVES[f.special].startup + 0.2; f.startMove(f.special); this.comboStarted = true; this.opener = f.special; this.comboLeft = 0; this.setMode('attack');
    w.emit('enemySpecial', { f });
  }
  private vulnerable(t: Fighter) {
    if (t.state === 'dizzy' || (t.state === 'getup' && t.stateT > t.stateDur - 0.15)) return true;
    if (t.state === 'attack' && t.move && t.movePhase() === 'recovery' && (t.move.heavy || t.move.recovery > 0.35)) return true;
    if (t.state === 'blockstun' && t.stateT > t.stateDur - 0.05) return true;
    return false;
  }
  private react(dt: number, t: Fighter, dist: number, p: AIParams, w: World) {
    const f = this.f;
    if (t.state === 'attack' && t.move && t.movePhase() === 'startup' && this.reactedTo !== t.moveInstance) {
      const m = t.move; const reach = (m.aoe || m.range) + f.radius + (m.lunge > 5 ? 3 : 0.8);
      const aimed = m.aoe || Math.abs(angleDiff(t.yaw, Math.atan2(f.x - t.x, f.z - t.z))) < 1.1;
      if (dist < reach && aimed) { this.reactedTo = t.moveInstance; this.reactT = p.reaction * (0.8 + Math.random() * 0.4); }
    }
    if (this.reactT >= 0) {
      this.reactT -= dt;
      if (this.reactT < 0) {
        const m = t.move; if (!m || t.state !== 'attack' || t.movePhase() === 'recovery') return;
        if (!(f.canAct || (f.state === 'attack' && f.movePhase() === 'recovery' && f.tier !== 'grunt'))) return;
        const r = Math.random(); const unblock = m.unblockable || m.kind === 'grab';
        if (r < p.dodgeRate + (unblock ? p.blockRate * 0.6 : 0)) {
          const side = Math.random() < 0.5 ? 1 : -1; const ang = Math.atan2(f.x - t.x, f.z - t.z) + side * 1.3;
          w.combat.dodge(f, Math.sin(ang), Math.cos(ang));
        } else if (!unblock && r < p.dodgeRate + p.blockRate) {
          f.faceTo(t.x, t.z); this.blockHold = (m.startup + m.active - t.moveT) + 0.25 + (m.hits ? m.active : 0); f.wantBlock = true;
          if (f.state === 'attack') f.setState('idle');
          f.setState('block'); f.blockT = f.tier === 'boss' && Math.random() < p.counterRate * 0.5 ? 0 : 0.2;
        }
      }
    }
  }
  private moveToward(x: number, z: number, sprint: boolean, dt: number, w: World, speed = 1) {
    const f = this.f; let dx = x - f.x, dz = z - f.z; const d = Math.hypot(dx, dz); if (d < 0.3) return;
    dx /= d; dz /= d;
    // simple wall avoidance: probe ahead, rotate if blocked
    if (w.col.blocked(f.x, f.z, f.x + dx * 2, f.z + dz * 2, f.layer)) {
      for (const a of [0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) { const c = Math.cos(a), s = Math.sin(a); const rx = dx * c - dz * s, rz = dx * s + dz * c; if (!w.col.blocked(f.x, f.z, f.x + rx * 2, f.z + rz * 2, f.layer)) { dx = rx; dz = rz; break; } }
    }
    const sp = Math.min(1, d / 1.5) * speed * this.params(w).speed; f.intentX = dx * sp; f.intentZ = dz * sp; f.wantSprint = sprint;
  }
  private moveAway(t: Fighter, dt: number, w: World) { const f = this.f; const dx = f.x - t.x, dz = f.z - t.z, d = Math.hypot(dx, dz) || 1; this.moveToward(f.x + dx / d * 4, f.z + dz / d * 4, false, dt, w); }
  private loiter(dt: number, w: World) {
    const f = this.f; const d = Math.hypot(this.homeX - f.x, this.homeZ - f.z);
    if (d > 4) this.moveToward(this.homeX, this.homeZ, false, dt, w, 0.4);
  }
}
