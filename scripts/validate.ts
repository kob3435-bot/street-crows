import { ENCOUNTERS, QUESTS, QUEST_BY_ID } from '../src/data/quests';
import { PLACES, INTERACTABLES } from '../src/data/city';
import { CHAR_BY_ID } from '../src/data/characters';
import { GANG_BY_ID } from '../src/data/gangs';
import { MOVES } from '../src/sim/moves';
import { VARIANTS } from '../src/data/enemies';
import { generateCity } from '../src/sim/cityGen';
import { Nav } from '../src/sim/nav';
const errs: string[] = [];
const city = generateCity(); const col = city.col; const nav = new Nav(col);
for (const [id, e] of Object.entries(ENCOUNTERS)) {
  if (!PLACES[e.place]) errs.push(`enc ${id}: place ${e.place}`);
  for (const m of e.members) { if (m.char && !CHAR_BY_ID[m.char]) errs.push(`enc ${id}: char ${m.char}`); if (m.char && !CHAR_BY_ID[m.char].fightable) errs.push(`enc ${id}: char ${m.char} not fightable`); if (m.gang && !GANG_BY_ID[m.gang]) errs.push(`enc ${id}: gang ${m.gang}`); if (m.variant && !VARIANTS[m.variant]) errs.push(`enc ${id}: variant`); }
}
const used = new Map<string, string>();
const speakers = new Set(['narrator', 'thug', 'granny', 'haru']);
for (const q of QUESTS) {
  for (const r of q.requires) if (!QUEST_BY_ID[r]) errs.push(`quest ${q.id}: requires ${r}`);
  if (q.giver && !INTERACTABLES.find(i => i.id === q.giver)) errs.push(`quest ${q.id}: giver ${q.giver}`);
  q.steps.forEach((s, k) => {
    const lines = [...((s as any).say || []), ...((s as any).after || [])];
    for (const l of lines) if (!speakers.has(l.s) && !CHAR_BY_ID[l.s]) errs.push(`quest ${q.id}#${k}: speaker ${l.s}`);
    if (s.kind === 'defeat' || s.kind === 'boss') { if (!ENCOUNTERS[s.enc]) errs.push(`quest ${q.id}: enc ${s.enc}`); if (used.has(s.enc)) errs.push(`enc ${s.enc} reused in ${q.id} and ${used.get(s.enc)}`); used.set(s.enc, q.id); }
    if (s.kind === 'goto' && !PLACES[s.place]) errs.push(`quest ${q.id}: place ${s.place}`);
    if ((s.kind === 'talk' || s.kind === 'interact') && !INTERACTABLES.find(i => i.id === s.target)) errs.push(`quest ${q.id}: target ${s.target}`);
  });
}
for (const c of Object.values(CHAR_BY_ID)) {
  if (c.special && !MOVES[c.special]) errs.push(`char ${c.id} special ${c.special}`);
  for (const m of c.moves || []) if (!MOVES[m]) errs.push(`char ${c.id} move ${m}`);
  for (const ph of c.phases || []) { if (ph.special && !MOVES[ph.special]) errs.push(`char ${c.id} phase special ${ph.special}`); for (const m of ph.moves) if (!MOVES[m]) errs.push(`char ${c.id} phase move ${m}`); }
  if (c.fightable && (c.tier === 'boss' || c.tier === 'miniboss') && (!c.phases || c.phases.length !== 3)) errs.push(`char ${c.id} lacks 3 phases`);
}
for (const v of Object.values(VARIANTS)) for (const m of [...v.moves, ...v.midMoves]) if (!MOVES[m]) errs.push(`variant ${v.id} move ${m}`);
// positions
const hub: [number, number] = [0, 0];
for (const [id, p] of Object.entries(PLACES)) {
  const layer = p.layer || 0; if (col.solidAt(p.pos[0], p.pos[1], 0.5, layer)) errs.push(`place ${id} in solid`);
  if (layer === 0) { const path = nav.findPath(hub[0], hub[1], p.pos[0], p.pos[1], 0, 200000); if (!path) errs.push(`place ${id} unreachable`); }
}
for (const it of INTERACTABLES) { const layer = it.layer || 0; if (it.kind === 'npc' && col.solidAt(it.pos[0], it.pos[1], 0.4, layer)) errs.push(`npc ${it.id} in solid`); if (layer === 0 && !nav.findPath(0, 0, it.pos[0], it.pos[1], 0, 200000)) errs.push(`interactable ${it.id} unreachable`); }
const bosses = Object.values(CHAR_BY_ID).filter(c => c.fightable && c.tier === 'boss').map(c => c.id), minis = Object.values(CHAR_BY_ID).filter(c => c.fightable && c.tier === 'miniboss').map(c => c.id);
console.log('quests', QUESTS.length, 'main', QUESTS.filter(q => q.type === 'main').length, 'bosses', bosses.length, bosses.join(','), 'minis', minis.length, minis.join(','));
const t0 = Date.now(); const pth = nav.findPath(-150, -120, 150, 160, 0, 200000); console.log('long path', pth?.length, Date.now() - t0, 'ms');
console.log(errs.length ? errs.join('\n') : 'OK no errors');
