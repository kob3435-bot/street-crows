import { SKILL_BY_ID, SKILLS } from '../data/skills';
import { baseMods, type Mods } from './fighter';
import type { LText } from '../data/types';

export const STAT_KEYS = ['power', 'speed', 'defense', 'technique', 'counter', 'charisma'] as const;
export type StatKey = typeof STAT_KEYS[number];
export const STAT_NAMES: Record<StatKey, LText> = {
  power: { th: 'พลัง', en: 'Power' }, speed: { th: 'ความเร็ว', en: 'Speed' }, defense: { th: 'ป้องกัน', en: 'Defense' },
  technique: { th: 'เทคนิค', en: 'Technique' }, counter: { th: 'สวนกลับ', en: 'Counter' }, charisma: { th: 'เสน่ห์', en: 'Charisma' },
};
export const REP_TIERS: { min: number; name: LText }[] = [
  { min: 0, name: { th: 'ไม่มีใครรู้จัก', en: 'Unknown' } }, { min: 100, name: { th: 'หน้าใหม่', en: 'Rookie' } },
  { min: 350, name: { th: 'นักสู้ข้างถนน', en: 'Street Fighter' } }, { min: 800, name: { th: 'เอซประจำโรงเรียน', en: 'School Ace' } },
  { min: 1500, name: { th: 'ผู้พิชิตแก๊ง', en: 'Gang Crusher' } }, { min: 2600, name: { th: 'ยอดฝีมือแห่งเมือง', en: 'City Elite' } },
  { min: 4000, name: { th: 'ตำนาน', en: 'Legend' } },
];
export const REL_LABELS: { min: number; name: LText }[] = [
  { min: -999, name: { th: 'ศัตรูคู่แค้น', en: 'Nemesis' } }, { min: -40, name: { th: 'คู่ปรับ', en: 'Rival' } }, { min: -10, name: { th: 'คนแปลกหน้า', en: 'Stranger' } },
  { min: 15, name: { th: 'คนรู้จัก', en: 'Acquaintance' } }, { min: 40, name: { th: 'เพื่อน', en: 'Friend' } }, { min: 75, name: { th: 'พี่น้อง', en: 'Brother' } },
];
export const expToNext = (lvl: number) => Math.round(90 * Math.pow(lvl, 1.45));

/** Level/EXP/stats/skills/reputation. Produces combat Mods consumed by the Fighter. */
export class Progression {
  level = 1; exp = 0; statPoints = 0; skillPoints = 1; rep = 0; money = 500;
  stats: Record<StatKey, number> = { power: 5, speed: 5, defense: 5, technique: 5, counter: 5, charisma: 5 };
  skills = new Set<string>(); inventory: Record<string, number> = { onigiri: 2, drink: 1 };
  onLevel: ((lvl: number) => void) | null = null;
  has(id: string) { return this.skills.has(id); }
  get repTier() { let i = 0; REP_TIERS.forEach((t, k) => { if (this.rep >= t.min) i = k; }); return i; }
  get maxHp() { return 100 + (this.level - 1) * 12 + this.stats.defense * 2 - 10 + (this.has('thick_skin') ? 25 : 0) + (this.has('unbreakable') ? 40 : 0); }
  get maxStamina() { return 100 + (this.level - 1) * 3; }
  gainMul() { return (1 + (this.stats.charisma - 5) * 0.04) * (this.has('aura') ? 1.3 : 1); }
  addExp(n: number): number {
    const gained = Math.round(n * (this.has('aura') ? 1.3 : 1)); this.exp += gained; let ups = 0;
    while (this.exp >= expToNext(this.level)) { this.exp -= expToNext(this.level); this.level++; this.statPoints += 3; this.skillPoints += 1; ups++; this.onLevel?.(this.level); }
    return gained;
  }
  addRep(n: number) { const g = Math.round(n * this.gainMul()); this.rep += g; return g; }
  addMoney(n: number) { const g = Math.round(n * (1 + (this.stats.charisma - 5) * 0.03)); this.money += g; return g; }
  canLearn(id: string): { ok: boolean; why?: string } {
    const s = SKILL_BY_ID[id]; if (!s) return { ok: false, why: 'unknown' };
    if (this.skills.has(id)) return { ok: false, why: 'learned' };
    if (this.level < s.minLevel) return { ok: false, why: 'level' };
    if (this.skillPoints < s.cost) return { ok: false, why: 'points' };
    if (!s.requires.every(r => this.skills.has(r))) return { ok: false, why: 'requires' };
    return { ok: true };
  }
  learn(id: string) { const c = this.canLearn(id); if (!c.ok) return false; this.skillPoints -= SKILL_BY_ID[id].cost; this.skills.add(id); return true; }
  raise(k: StatKey) { if (this.statPoints <= 0 || this.stats[k] >= 30) return false; this.statPoints--; this.stats[k]++; return true; }
  mods(): Mods {
    const m = baseMods(); const s = this.stats;
    m.dmg = 1 + (s.power - 5) * 0.05; m.speed = 1 + (s.speed - 5) * 0.018; m.atkSpeed = 1 + (s.speed - 5) * 0.012;
    m.def = 1 + (s.defense - 5) * 0.06; m.counter = 1.2 + (s.counter - 5) * 0.08; m.counterWin = 0.45 + (s.counter - 5) * 0.02;
    m.stunMul = 1 + (s.technique - 5) * 0.05; m.guardDmgMul = 1 + (s.technique - 5) * 0.04; m.comboWin = (s.technique - 5) * 0.01;
    if (this.has('iron_fist')) m.punch = 1.2; if (this.has('guard_crusher')) m.guardDmgMul *= 2; m.earthshaker = this.has('earthshaker'); if (this.has('haymaker')) m.finisher = 1.6;
    if (this.has('quick_feet')) m.speed *= 1.12; if (this.has('second_wind')) m.sprintCost = 7;
    if (this.has('shadow_step')) { m.dodgeDist = 1.35; m.dodgeIframe = 0.36; m.dodgeCost = 12; }
    if (this.has('meteor_kick')) { m.fly = 1.4; m.meteor = true; }
    m.combo3 = this.has('combo_flow'); if (m.combo3) m.comboWin += 0.08;
    if (this.has('grab_master')) { m.throwHitsOthers = true; m.throwDmg = 1.4; }
    if (this.has('counter_art')) { m.counterWin += 0.25; m.counter *= 1.5; }
    if (this.has('meter_boost')) m.meter = 1.4;
    if (this.has('iron_guard')) { m.guardTake = 0.07; m.guardMax = 150; }
    if (this.has('rebound')) m.getup = 0.5; m.lastStand = this.has('last_stand');
    if (this.has('danger_sense')) { m.perfectWin = 0.26; m.slowmo = 1.1; }
    if (this.has('demon_fist')) m.dmg *= 1.12; if (this.has('afterimage')) m.afterimage = true;
    if (this.has('flow_state')) { m.atkSpeed *= 1.08; m.comboWin += 0.06; } if (this.has('unbreakable')) m.def *= 1.15; if (this.has('pack_breaker')) m.packBreaker = true;
    return m;
  }
  static allSkills() { return SKILLS; }
}
