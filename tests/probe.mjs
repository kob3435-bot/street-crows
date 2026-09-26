import { launch, open, state, dbg } from './lib.mjs';
const b = await launch();
const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
await dbg(page, 'skipDialogue');
const trials = process.argv[2] || 'kurogane:3';
for (const spec of trials.split(',')) {
  const [id, n] = spec.split(':');
  await page.evaluate(() => { const w = window.__game.world; w.player.hp = w.player.maxHp; });
  await dbg(page, 'spawn', id, Number(n || 1), 6); await dbg(page, 'bot', true);
  let t = 0; for (; t < 240; t += 5) { await dbg(page, 'step', 5); const s = await state(page); if (s.fighters === 0 || s.hp <= 0 || s.state === 'ko') break; }
  const s = await state(page); const st = await page.evaluate(() => window.__game.world.stats);
  console.log(spec, 't=', t, 'hp', Math.round(s.hp), 'lvl', s.level, 'exp', s.exp, 'left', s.fighters, JSON.stringify(st));
  await dbg(page, 'bot', false); await dbg(page, 'step', 4);
}
console.log(logs.join('\n'), await page.evaluate(() => window.__game.errors));
await b.close();
