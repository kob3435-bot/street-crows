import { Fighter } from './fighter';
import { MOVES, type MoveDef, moveTotal } from './moves';
import { angleDiff, clamp, damp } from '../core/rng';
import type { World } from './world';

const WALK = 5.0, SPRINT = 9.2, BLOCK_WALK = 1.6, GRAV = 30;
/** Fighter physics/state machine + melee hit resolution. Pure simulation (no rendering). */
export class Combat {
  constructor(private w: World) {}

  update(f: Fighter, rawDt: number) {
    const dt = rawDt * f.slowmo;
    if (f.freeze > 0) { f.freeze -= dt; return; }
    f.stateT += dt; f.animT += dt;
    f.invuln = Math.max(0, f.invuln - dt); f.counterWin = Math.max(0, f.counterWin - dt); f.hurtFlash = Math.max(0, f.hurtFlash - dt);
    f.telegraph = Math.max(0, f.telegraph - dt); f.bubbleT = Math.max(0, f.bubbleT - dt);
    if (f.comboTimer > 0) { f.comboTimer -= dt; if (f.comboTimer <= 0) f.comboCount = 0; }
    const sprinting = f.wantSprint && (f.state === 'move') && Math.hypot(f.intentX, f.intentZ) > 0.3 && f.stamina > 1;
    if (f.state !== 'attack' && f.state !== 'dodge' && !sprinting) f.stamina = Math.min(f.maxStamina, f.stamina + (f.isPlayer ? 24 : 18) * dt);
    if (f.state !== 'block' && f.state !== 'blockstun') f.guard = Math.min(f.mods.guardMax, f.guard + 18 * dt);
    if (this.w.time - f.lastHitTime > 1.5) f.stun = Math.max(0, f.stun - 10 * dt);
    if (f.mods.lastStand && f.alive && f.hp < f.maxHp * 0.3) f.hp = Math.min(f.maxHp, f.hp + 1.2 * dt);
    let fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    switch (f.state) {
      case 'idle': case 'move': case 'block': {
        const blocking = f.wantBlock;
        if (blocking && f.state !== 'block') { f.setState('block'); f.blockT = 0; }
        else if (!blocking && f.state === 'block') f.setState('idle');
        if (f.state === 'block') f.blockT += dt;
        const il = Math.hypot(f.intentX, f.intentZ);
        let spd = WALK * f.speed * f.mods.speed;
        if (f.state === 'block') spd = BLOCK_WALK; else if (sprinting) { spd = SPRINT * f.speed * f.mods.speed; f.stamina = Math.max(0, f.stamina - f.mods.sprintCost * dt); }
        f.vx = damp(f.vx, f.intentX * spd, 14, dt); f.vz = damp(f.vz, f.intentZ * spd, 14, dt);
        const target = f.faceYaw !== null ? f.faceYaw : il > 0.1 ? Math.atan2(f.intentX, f.intentZ) : null;
        if (target !== null) f.yaw += clamp(angleDiff(f.yaw, target), -14 * dt, 14 * dt);
        if (f.state !== 'block') f.state = il > 0.1 ? 'move' : 'idle';
        break;
      }
      case 'attack': {
        const m = f.move!; f.moveT += dt * f.mods.atkSpeed;
        const ph = f.movePhase();
        const lockT = this.w.lockTarget(f, 4.5);
        if (m.homing && lockT && ph !== 'recovery') { const want = Math.atan2(lockT.x - f.x, lockT.z - f.z); f.yaw += clamp(angleDiff(f.yaw, want), -10 * dt, 10 * dt); fx = Math.sin(f.yaw); fz = Math.cos(f.yaw); }
        else if (ph === 'startup' && lockT && m.kind !== 'stance') { const want = Math.atan2(lockT.x - f.x, lockT.z - f.z); f.yaw += clamp(angleDiff(f.yaw, want), -9 * dt, 9 * dt); fx = Math.sin(f.yaw); fz = Math.cos(f.yaw); }
        if ((ph === 'startup' || ph === 'active') && m.lunge > 0 && m.kind !== 'stance') {
          let l = m.lunge * (ph === 'startup' ? (m.startup > 0.4 ? 0.1 : 0.6) : 1) * (m.id === 'flykick' ? f.mods.fly : 1);
          if (lockT && !m.rush) { const d = f.distTo(lockT); if (d < m.range * 0.75 + lockT.radius) l = 0; }
          f.vx = fx * l; f.vz = fz * l;
        } else { const k = Math.exp(-12 * dt); f.vx *= k; f.vz *= k; }
        if (m.id === 'flykick') f.y = ph === 'recovery' ? Math.max(0, f.y - dt * 6) : Math.sin(Math.min(1, f.moveT / (m.startup + m.active)) * Math.PI) * 0.9;
        if (f.moveT >= moveTotal(m)) { f.y = 0; f.setState('idle'); if (f.isPlayer) this.w.tryBuffered(); }
        break;
      }
      case 'hitstun': case 'blockstun': { const k = Math.exp(-7 * dt); f.vx *= k; f.vz *= k; if (f.stateT >= f.stateDur) f.setState('idle'); break; }
      case 'knockdown': {
        if (f.y > 0 || f.vy > 0) { f.vy -= GRAV * dt; f.y += f.vy * dt; if (f.y <= 0) { f.y = 0; f.vy = 0; this.w.emit('land', { f }); } }
        if (f.y === 0) { const k = Math.exp(-5 * dt); f.vx *= k; f.vz *= k; }
        if (f.stateT >= f.stateDur && f.y === 0) {
          if (f.hp <= 0) { f.setState('ko'); }
          else { f.setState('getup', 0.55 * f.mods.getup); f.invuln = 0.55 * f.mods.getup + 0.25; }
        }
        break;
      }
      case 'getup': f.vx = f.vz = 0; if (f.stateT >= f.stateDur) f.setState('idle'); break;
      case 'dodge': {
        const dur = 0.34; const s = 12.5 * f.mods.dodgeDist * Math.max(0, 1 - f.stateT / dur);
        f.vx = f.dodgeDirX * s; f.vz = f.dodgeDirZ * s;
        if (f.stateT >= dur) f.setState('idle');
        break;
      }
      case 'grabbing': {
        f.vx = f.vz = 0; const g = f.grabbed;
        if (!g || g.grabbedBy !== f) { f.grabbed = null; f.setState('idle'); break; }
        if (f.stateT > 1.2) { this.throwStart(f); }
        break;
      }
      case 'grabbed': {
        const g = f.grabbedBy;
        if (!g || (g.state !== 'grabbing' && !(g.state === 'attack' && g.move?.id === 'throw'))) { f.grabbedBy = null; f.setState('hitstun', 0.25); break; }
        f.x = g.x + Math.sin(g.yaw) * 1.0; f.z = g.z + Math.cos(g.yaw) * 1.0; f.yaw = g.yaw + Math.PI; f.vx = f.vz = 0;
        if (f.stateT > 3) { f.grabbedBy = null; f.setState('idle'); }
        return;
      }
      case 'thrown': {
        f.vy -= GRAV * dt; f.y += f.vy * dt;
        if (f.throwHits) for (const o of this.w.fighters) {
          if (o === f || !o.alive || o.layer !== f.layer || o.state === 'knockdown' || !this.w.hostile(f.throwHits, o) || o === f.throwHits) continue;
          if (Math.hypot(o.x - f.x, o.z - f.z) < 1.3) { this.knockdown(o, f.vx * 0.5, f.vz * 0.5, 5); o.hp -= 10; o.lastAttacker = f.throwHits; o.lastHitTime = this.w.time; this.w.emit('hit', { att: f.throwHits, tgt: o, dmg: 10, m: MOVES.throw, heavy: true, x: o.x, z: o.z }); if (o.hp <= 0) { o.hp = 0; this.w.emit('ko', { f: o, by: f.throwHits }); } }
        }
        if (f.y <= 0) { f.y = 0; f.vy = 0; f.throwHits = null; f.setState('knockdown', 0.9); this.w.emit('land', { f, hard: true }); }
        break;
      }
      case 'dizzy': { f.vx *= 0.8; f.vz *= 0.8; if (f.stateT >= f.stateDur) { f.stun = 0; f.setState('idle'); } break; }
      case 'ko': { f.koT += dt; if (f.y > 0 || f.vy > 0) { f.vy -= GRAV * dt; f.y = Math.max(0, f.y + f.vy * dt); } const k = Math.exp(-5 * dt); f.vx *= k; f.vz *= k; break; }
      case 'taunt': { f.vx = f.vz = 0; f.invuln = Math.max(f.invuln, 0.1); if (f.stateT >= f.stateDur) f.setState('idle'); break; }
    }
    f.x += f.vx * dt; f.z += f.vz * dt;
    const [nx, nz] = this.w.col.resolve(f.x, f.z, f.radius, f.layer); f.x = nx; f.z = nz;
    f.speedNow = Math.hypot(f.vx, f.vz);
  }

  // ---------------- actions ----------------
  dodge(f: Fighter, dx: number, dz: number) {
    const cost = f.mods.dodgeCost; if (f.stamina < cost * 0.6) return false;
    if (!(f.canAct || (f.state === 'attack' && f.movePhase() === 'recovery'))) return false;
    const l = Math.hypot(dx, dz); if (l < 0.1) { dx = -Math.sin(f.yaw); dz = -Math.cos(f.yaw); } else { dx /= l; dz /= l; }
    f.stamina -= cost; f.dodgeDirX = dx; f.dodgeDirZ = dz; f.setState('dodge'); f.invuln = f.mods.dodgeIframe; f.evaded = false;
    this.w.emit('dodge', { f }); return true;
  }
  throwStart(f: Fighter) { if (f.grabbed) { f.startMove('throw'); } }

  knockdown(t: Fighter, pvx: number, pvz: number, vy: number, dur = 1.0) {
    if (t.grabbedBy) { t.grabbedBy.grabbed = null; t.grabbedBy = null; }
    if (t.grabbed) { t.grabbed.grabbedBy = null; t.grabbed = null; }
    t.setState('knockdown', dur); t.vx = pvx; t.vz = pvz; t.vy = vy; t.y = Math.max(t.y, 0.01);
  }

  // ---------------- hit resolution ----------------
  resolve() {
    const fs = this.w.fighters;
    for (const f of fs) {
      if (f.state !== 'attack' || !f.move || f.freeze > 0) continue;
      const m = f.move; if (f.movePhase() !== 'active') continue;
      if (m.kind === 'stance') continue;
      const hits = m.hits || 1; const idx = Math.min(hits - 1, Math.floor((f.moveT - m.startup) / (m.active / hits)));
      if (idx !== f.hitIdx) {
        f.hitIdx = idx; f.hitSet.clear();
        if (idx === 0 && f.isPlayer && m.id === 'hkick' && f.mods.earthshaker) this.shockwave(f, 4.2, 8);
        if (idx === 0 && m.slam) this.w.emit('slam', { f });
        if (idx === 0 && m.impact && f.isPlayer) this.w.emit('special', { f, m });
      }
      if (m.kind === 'throw') {
        const t = f.grabbed; if (!t || f.hitSet.has(t.id)) continue; f.hitSet.add(t.id);
        f.grabbed = null; t.grabbedBy = null;
        const dmg = this.damage(f, t, m); t.hp -= dmg; t.lastAttacker = f; t.lastHitTime = this.w.time; t.hurtFlash = 0.2;
        t.setState('thrown'); t.vy = 7.5; t.y = 0.8; t.vx = Math.sin(f.yaw) * 8.5; t.vz = Math.cos(f.yaw) * 8.5; t.throwHits = f.mods.throwHitsOthers ? f : null;
        f.freeze = t.freeze = m.hitstop; f.meter = Math.min(100, f.meter + m.meter * f.mods.meter);
        this.w.emit('hit', { att: f, tgt: t, dmg, m, heavy: true, x: t.x, z: t.z, throw: true });
        if (t.hp <= 0) { t.hp = 0; this.w.emit('ko', { f: t, by: f }); }
        continue;
      }
      for (const t of fs) {
        if (t === f || !t.alive || t.layer !== f.layer || f.hitSet.has(t.id) || !this.w.hostile(f, t)) continue;
        if ((t.state === 'knockdown' && t.y < 0.4) || t.state === 'getup' || t.state === 'thrown' || t.state === 'taunt' || t.grabbedBy === f) continue;
        const dx = t.x - f.x, dz = t.z - f.z, d = Math.hypot(dx, dz);
        const reach = (m.aoe || m.range) + t.radius; if (d > reach) continue;
        if (!m.aoe && d > 0.3 && Math.abs(angleDiff(f.yaw, Math.atan2(dx, dz))) > m.arc) continue;
        if (this.w.col.blocked(f.x, f.z, t.x, t.z, f.layer)) continue; // no hitting through walls
        f.hitSet.add(t.id);
        this.applyHit(f, t, m, idx === hits - 1);
        if (f.freeze > 0 && m.kind === 'grab') break;
      }
    }
  }
  shockwave(f: Fighter, r: number, dmg: number) {
    this.w.emit('shockwave', { f, r });
    for (const t of this.w.fighters) {
      if (t === f || !t.alive || t.layer !== f.layer || !this.w.hostile(f, t) || t.state === 'knockdown') continue;
      const d = Math.hypot(t.x - f.x, t.z - f.z); if (d > r) continue;
      t.hp -= dmg; t.lastAttacker = f; t.lastHitTime = this.w.time; const k = 6 / Math.max(0.5, d);
      this.knockdown(t, (t.x - f.x) * k * 0.4, (t.z - f.z) * k * 0.4, 5, 0.9);
      if (t.hp <= 0) { t.hp = 0; this.w.emit('ko', { f: t, by: f }); }
    }
  }
  damage(att: Fighter, tgt: Fighter, m: MoveDef) {
    let d = m.dmg * (att.atk / 10) * att.mods.dmg;
    if (m.family === 'punch') d *= att.mods.punch; else if (m.family === 'kick') d *= att.mods.kick; else if (m.family === 'counter') d *= att.mods.counter;
    if (m.id === 'finisher') d *= att.mods.finisher; if (m.kind === 'throw') d *= att.mods.throwDmg; if (m.id === 'flykick' && att.mods.meteor) d *= 1.5;
    if (att.mods.lastStand && att.hp < att.maxHp * 0.3) d *= 1.3;
    if (att.buffed) d *= 1.2; // a gang leader nearby fires them up
    if (att.mods.packBreaker && att.isPlayer && this.w.engagedCount(att) >= 3) d *= 1.2;
    d /= Math.max(0.3, (tgt.def / 10) * tgt.mods.def);
    return Math.max(1, d * (0.92 + Math.random() * 0.16));
  }
  applyHit(att: Fighter, tgt: Fighter, m: MoveDef, last: boolean) {
    const w = this.w;
    const toAtt = Math.atan2(att.x - tgt.x, att.z - tgt.z); const facing = Math.abs(angleDiff(tgt.yaw, toAtt)) < 1.75;
    // evasion (dodge i-frames) -> perfect dodge / dodge counter window
    if (tgt.invuln > 0) {
      if (tgt.state === 'dodge' && !tgt.evaded) {
        tgt.evaded = true;
        const perfect = tgt.stateT <= tgt.mods.perfectWin;
        tgt.counterWin = perfect ? 0.95 : tgt.mods.counterWin; tgt.counterKind = 'dodge';
        w.emit(perfect ? 'perfectDodge' : 'evade', { f: tgt, att }); if (perfect && tgt.mods.afterimage) tgt.meter = Math.min(100, tgt.meter + 25);
        if (perfect && tgt.isPlayer) w.startSlowmo(tgt.mods.slowmo);
      }
      return;
    }
    if (m.kind === 'grab') {
      if (['knockdown', 'thrown', 'grabbed', 'taunt', 'dodge'].includes(tgt.state) || (tgt.move?.armor && tgt.state === 'attack')) return;
      if ((tgt.tier === 'boss' || tgt.tier === 'miniboss') && !tgt.isPlayer && tgt.state !== 'dizzy' && Math.random() < (tgt.tier === 'boss' ? 0.3 : 0.2)) {
        att.setState('hitstun', 0.35); att.vx = -Math.sin(att.yaw) * 4; att.vz = -Math.cos(att.yaw) * 4; w.emit('grabBreak', { f: tgt, att }); return;
      }
      if (tgt.isPlayer && tgt.state === 'block' && tgt.blockT < 0.12) { w.emit('grabBreak', { f: tgt, att }); att.setState('hitstun', 0.3); return; }
      att.grabbed = tgt; tgt.grabbedBy = att; att.setState('grabbing'); tgt.setState('grabbed'); tgt.move = null;
      w.emit('grab', { att, tgt }); return;
    }
    // counter stance (Kirishima's "Dragon Mirror")
    if (tgt.state === 'attack' && tgt.move?.kind === 'stance' && facing && !m.unblockable) {
      tgt.startMove('mirror_counter'); tgt.faceTo(att.x, att.z); att.freeze = 0.12; att.setState('hitstun', 0.35);
      w.emit('mirror', { f: tgt, att }); return;
    }
    // blocking
    if (tgt.state === 'block' && facing && !m.unblockable) {
      if (tgt.blockT < (tgt.isPlayer ? 0.16 : 0.1) && !m.armor) { // parry
        tgt.counterWin = 0.85; tgt.counterKind = 'block'; att.setState('blockstun', 0.5); att.vx = -Math.sin(att.yaw) * 3; att.vz = -Math.cos(att.yaw) * 3;
        tgt.meter = Math.min(100, tgt.meter + 8); att.freeze = tgt.freeze = 0.06; w.emit('parry', { f: tgt, att, x: tgt.x, z: tgt.z }); return;
      }
      const gd = m.guard * att.mods.guardDmgMul * (m.heavy ? 1.2 : 1);
      tgt.guard -= gd; const chip = this.damage(att, tgt, m) * tgt.mods.guardTake; tgt.hp = Math.max(1, tgt.hp - chip);
      const px = Math.sin(toAtt + Math.PI), pz = Math.cos(toAtt + Math.PI);
      if (tgt.guard <= 0) { tgt.guard = tgt.mods.guardMax * 0.6; tgt.setState('dizzy', tgt.isPlayer ? 0.9 : 1.4); tgt.stun = 0; w.emit('guardBreak', { f: tgt, att, x: tgt.x, z: tgt.z }); att.freeze = tgt.freeze = 0.1; return; }
      tgt.setState('blockstun', 0.1 + m.guard * 0.004); tgt.vx = px * (m.heavy ? 4.5 : 2.5); tgt.vz = pz * (m.heavy ? 4.5 : 2.5);
      tgt.counterWin = tgt.mods.counterWin * 0.8; tgt.counterKind = 'block';
      att.freeze = tgt.freeze = 0.035; w.emit('block', { f: tgt, att, x: tgt.x, z: tgt.z, heavy: m.heavy }); return;
    }
    // clean hit
    tgt.lastAttacker = att;
    let dmg = this.damage(att, tgt, m); if (tgt.state === 'dizzy' && m.id !== 'finisher') dmg *= 1.2;
    const armored = tgt.state === 'attack' && !!tgt.move?.armor && tgt.movePhase() !== 'recovery';
    tgt.hp -= dmg; tgt.hurtFlash = 0.16; tgt.lastHitTime = w.time;
    tgt.stun += m.stun * att.mods.stunMul * (tgt.isPlayer ? 0.45 : 1);
    att.meter = Math.min(100, att.meter + m.meter * att.mods.meter); tgt.meter = Math.min(100, tgt.meter + dmg * 0.35);
    att.comboCount++; att.comboTimer = 1.3;
    const dirX = Math.sin(toAtt + Math.PI), dirZ = Math.cos(toAtt + Math.PI);
    const counter = m.family === 'counter';
    if (tgt.hp <= 0) {
      tgt.hp = 0; this.knockdown(tgt, dirX * 7, dirZ * 7, 7, 1.2);
      w.emit('hit', { att, tgt, dmg, m, heavy: true, x: tgt.x, z: tgt.z, counter, ko: true }); w.emit('ko', { f: tgt, by: att });
      att.freeze = tgt.freeze = Math.max(m.hitstop, 0.12); return;
    }
    if (!armored) {
      if (tgt.grabbedBy) { tgt.grabbedBy.grabbed = null; tgt.grabbedBy.setState('idle'); tgt.grabbedBy = null; }
      if (tgt.state === 'grabbing' && tgt.grabbed) { tgt.grabbed.grabbedBy = null; tgt.grabbed = null; }
      const lastKnock = (m.hits || 1) > 1 && !last ? 'light' : m.knock;
      if (lastKnock === 'light') { tgt.setState('hitstun', 0.3); tgt.vx = dirX * 1.6; tgt.vz = dirZ * 1.6; }
      else if (lastKnock === 'heavy') { tgt.setState('hitstun', 0.48); const p = m.push || 5; tgt.vx = dirX * p; tgt.vz = dirZ * p; }
      else if (lastKnock === 'launch') this.knockdown(tgt, dirX * 3, dirZ * 3, 8.5, 1.1);
      else this.knockdown(tgt, dirX * (m.push || 7), dirZ * (m.push || 7), 5, 1.0);
      if (tgt.stun >= 100 && tgt.state === 'hitstun') { tgt.stun = 0; tgt.setState('dizzy', tgt.isPlayer ? 1.0 : 2.2); w.emit('dizzy', { f: tgt }); }
      if (tgt.state === 'hitstun' || tgt.state === 'dizzy') tgt.yaw = toAtt;
    }
    const hs = m.hitstop * (counter ? 1.25 : 1); att.freeze = hs; tgt.freeze = hs;
    w.emit('hit', { att, tgt, dmg, m, heavy: !!m.heavy, x: tgt.x, z: tgt.z, counter, armored, finisher: m.id === 'finisher' });
  }
}
