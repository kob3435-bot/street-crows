import { launch, open, state, dbg } from './lib.mjs';
const b = await launch();
const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
await page.addScriptTag({ path: new URL('./driver.js', import.meta.url).pathname });
const order = ['tutorial', 'main1', 'side_cat', 'side_ramen', 'side_mikami', 'side_yamikaze', 'main2', 'side_rumor', 'main3'];
const god = process.argv[2] === 'god';
for (const q of order) {
  const t0 = Date.now();
  const r = await page.evaluate(([q, god]) => window.__driver.drive(q, { god }), [q, god]);
  const s = await state(page); const st = await page.evaluate(() => ({ deaths: window.__deaths || 0, ...window.__game.world.stats }));
  console.log(q, JSON.stringify(r), 'lvl', s.level, 'hp', Math.round(s.hp), 'money', s.money, 'rep', s.rep, 'kills', st.kills, 'ms', Date.now() - t0);
}
console.log((await page.evaluate(() => window.__driver.log)).join(' | '));
console.log(await state(page));
console.log(logs.join('\n'), await page.evaluate(() => window.__game.errors));
await b.close();
