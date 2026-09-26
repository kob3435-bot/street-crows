import { QUESTS, QUEST_BY_ID, ENCOUNTERS, FRIENDLY_AFTER, type QuestDef, type Step } from '../data/quests';
import { PLACES, ROOF } from '../data/city';
import { tx } from '../core/i18n';
import type { World } from './world';

interface Active { id: string; step: number; begun: boolean; seen: boolean }
/** Data-driven quest runner. Every step type has an explicit completion condition. */
export class QuestSystem {
  active: Active[] = []; done = new Set<string>(); tracked: string | null = null;
  constructor(private w: World) {}
  def(id: string) { return QUEST_BY_ID[id]; }
  reqMet(q: QuestDef) { return q.requires.every(r => this.done.has(r)) && (!q.minLevel || this.w.progress.level >= q.minLevel); }
  available(): QuestDef[] { return QUESTS.filter(q => !q.auto && !this.done.has(q.id) && !this.isActive(q.id) && this.reqMet(q)); }
  isActive(id: string) { return this.active.some(a => a.id === id); }
  start(id: string) {
    if (this.isActive(id) || this.done.has(id)) return; const q = this.def(id); if (!q) return;
    this.active.push({ id, step: 0, begun: false, seen: false }); if (!this.tracked || q.type === 'main' || q.type === 'tutorial') this.tracked = id;
    this.w.emit('questStart', { q }); this.w.emit('save', { reason: 'quest' });
  }
  step(a: Active): Step { return this.def(a.id).steps[a.step]; }
  update(dt: number) {
    const w = this.w; const p = w.player;
    for (const q of QUESTS) if (q.auto && !this.done.has(q.id) && !this.isActive(q.id) && this.reqMet(q) && !w.dialogue) this.start(q.id);
    for (const a of [...this.active]) {
      const s = this.step(a); if (!s) continue;
      if (!a.begun) {
        if (w.dialogue && s.kind !== 'defeat' && s.kind !== 'boss') continue;
        a.begun = true;
        if (s.kind === 'say') { w.say(s.say, () => this.completeStep(a)); continue; }
        if (s.kind !== 'defeat' && s.kind !== 'boss' && s.kind !== 'talk' && s.say && !a.seen) { a.seen = true; w.say(s.say); } // talk lines play when you actually talk to the NPC
        this.updateCheckpoint(a);
      }
      if (w.dialogue && s.kind !== 'defeat' && s.kind !== 'boss') continue;
      switch (s.kind) {
        case 'goto': {
          const pl = PLACES[s.place]; const r = s.radius || 8;
          if ((pl.layer || 0) === p.layer && Math.hypot(pl.pos[0] - p.x, pl.pos[1] - p.z) < r && (!s.night || w.isNight) && p.alive) this.completeStep(a);
          break;
        }
        case 'skill': if (w.progress.skills.size > 0) this.completeStep(a); break;
        case 'defeat': case 'boss': {
          const e = ENCOUNTERS[s.enc]; const st = w.encounters.get(s.enc); const pl = PLACES[e.place];
          if (!st) {
            const near = (pl.layer || 0) === p.layer && Math.hypot(pl.pos[0] - p.x, pl.pos[1] - p.z) < 32;
            if (near && (!e.night || w.isNight) && p.alive && w.downT <= 0 && !w.dialogue) { w.spawnEncounter(s.enc, a.id); if (s.heal) { p.hp = p.maxHp; w.emit('toast', { text: tx({ th: 'ฟื้นพลังเต็ม', en: 'HP fully restored' }) }); } if (s.say && !a.seen) { a.seen = true; w.say(s.say); } }
          } else if (!st.done && st.fighters.every(f => !f.alive)) {
            st.done = true; w.emit('encounterDone', { id: s.enc });
            if (s.after) w.say(s.after, () => this.completeStep(a)); else this.completeStep(a);
          }
          break;
        }
      }
    }
  }
  /** Returns true if the interaction was consumed by a quest (talk/interact step or quest offer). */
  onInteract(id: string): boolean {
    const w = this.w;
    for (const a of this.active) {
      const s = this.step(a); if (!s || !a.begun) continue;
      if ((s.kind === 'talk' || s.kind === 'interact') && s.target === id) {
        if (s.kind === 'talk' && s.say && a.seen === false) { a.seen = true; }
        const lines = s.kind === 'talk' ? s.say : undefined;
        if (id.startsWith('door_')) { this.completeStep(a); return false; }
        if (lines) w.say(lines, () => this.completeStep(a)); else this.completeStep(a);
        if (id === 'item_cat') w.emit('toast', { text: tx({ th: 'จับโมจิได้แล้ว! 🐱', en: 'Caught Mochi! 🐱' }) });
        return true;
      }
    }
    const offer = this.available().find(q => q.giver === id);
    if (offer) { w.emit('questOffer', { q: offer }); return true; }
    return false;
  }
  completeStep(a: Active) {
    if (!this.active.includes(a)) return;
    a.step++; a.begun = false; a.seen = false; const q = this.def(a.id);
    this.w.emit('questStep', { q, step: a.step });
    if (a.step >= q.steps.length) this.finish(a); else this.w.emit('save', { reason: 'step' });
  }
  private finish(a: Active) {
    const w = this.w; const q = this.def(a.id); this.active = this.active.filter(x => x !== a); this.done.add(q.id);
    const exp = w.progress.addExp(q.reward.exp); const money = w.progress.addMoney(q.reward.money); const rep = w.progress.addRep(q.reward.rep);
    if (q.reward.sp) w.progress.skillPoints += q.reward.sp;
    if (q.reward.rel) for (const [k, v] of Object.entries(q.reward.rel)) w.addRel(k, v);
    for (const g of FRIENDLY_AFTER[q.id] || []) w.friendlyGangs.add(g);
    if (this.tracked === q.id) this.tracked = this.active.find(x => this.def(x.id).type === 'main')?.id || this.active[0]?.id || null;
    w.emit('questComplete', { q, exp, money, rep }); w.emit('save', { reason: 'questComplete' });
  }
  private updateCheckpoint(a: Active) {
    const o = this.objectiveFor(a); if (o && o.layer === 0) { this.w.checkpoint = [o.pos[0] + 6, o.pos[1] + 6, 0]; }
  }
  onRespawn() { for (const a of this.active) { const s = this.step(a); if (s && (s.kind === 'defeat' || s.kind === 'boss')) a.seen = true; } }
  objectiveFor(a: Active): { text: string; pos: [number, number]; layer: number; quest: QuestDef } | null {
    const s = this.step(a); if (!s) return null; const q = this.def(a.id); const p = this.w.player;
    let pos: [number, number] = [p.x, p.z], layer = 0;
    if (s.kind === 'goto') { const pl = PLACES[s.place]; pos = pl.pos; layer = pl.layer || 0; }
    else if (s.kind === 'defeat' || s.kind === 'boss') { const pl = PLACES[ENCOUNTERS[s.enc].place]; pos = pl.pos; layer = pl.layer || 0; }
    else if (s.kind === 'talk' || s.kind === 'interact') { const it = this.w.interactables().find(i => i.id === s.target); if (it) { pos = it.pos; layer = it.layer || 0; } }
    else if (s.kind === 'skill') { pos = [p.x, p.z]; layer = p.layer; }
    if (layer === 1 && p.layer === 0) { pos = [ROOF.door[0], ROOF.door[1]]; layer = 0; }
    if (layer === 0 && p.layer === 1) { pos = [ROOF.door[0], -174.6]; layer = 1; }
    return { text: tx(s.obj), pos, layer, quest: q };
  }
  objective() { const a = this.active.find(x => x.id === this.tracked) || this.active[0]; return a ? this.objectiveFor(a) : null; }
  serialize() { return { active: this.active.map(a => ({ id: a.id, step: a.step })), done: [...this.done], flags: [...this.w.flags], tracked: this.tracked }; }
  load(d: { active: { id: string; step: number }[]; done: string[]; flags: string[]; tracked: string | null }) {
    this.done = new Set(d.done.filter(id => QUEST_BY_ID[id])); this.active = d.active.filter(a => QUEST_BY_ID[a.id] && a.step < QUEST_BY_ID[a.id].steps.length).map(a => ({ id: a.id, step: a.step, begun: false, seen: false }));
    this.w.flags = new Set(d.flags || []); this.tracked = d.tracked && this.isActive(d.tracked) ? d.tracked : this.active[0]?.id || null;
    this.w.friendlyGangs.clear(); for (const id of this.done) for (const g of FRIENDLY_AFTER[id] || []) this.w.friendlyGangs.add(g);
  }
}
