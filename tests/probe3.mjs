import { launch, open, state, dbg } from './lib.mjs';
const b = await launch();
const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
await dbg(page, 'skipDialogue');
const [who, exp] = (process.argv[2] || 'onoda:600').split(':');
await dbg(page, 'giveExp', Number(exp));
await page.evaluate(() => { const w = window.__game.world; w.player.hp = w.player.maxHp; w.quests.active = []; });
await dbg(page, 'spawn', who, 1, 6); await dbg(page, 'bot', true);
let t = 0; const phases = [];
for (; t < 240; t += 2) { await dbg(page, 'step', 2); const i = await page.evaluate(() => { const w = window.__game.world; const b = w.fighters.find(f => f.phases); return { hp: w.player.hp, bhp: b ? Math.round(b.hp) : 0, ph: b?.phase, dead: !w.player.alive || w.downT > 0 }; }); phases.push(`${Math.round(i.hp)}/${i.bhp}p${i.ph}`); if (!i.bhp || i.dead) break; }
const s = await state(page); console.log(who, 'lvl', s.level, 'maxHp', s.maxHp, 't', t, phases.join(' '), 'bosses', s.bosses);
await b.close();
