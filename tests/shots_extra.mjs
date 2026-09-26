// Extra screenshots for review: new bosses in render mode (not part of run-all).
import { launch, open, dbg, shot, sleep } from './lib.mjs';
const b = await launch();
const { page, logs } = await open(b, 'test=1&newgame=1');
await dbg(page, 'skipDialogue'); await dbg(page, 'god', true);
const spots = { akagi: [-60, 150], shion: [0, 122], genzo: [-14, 103], todoroki: [-20, -80] };
for (const id of (process.argv.slice(2).length ? process.argv.slice(2) : ['akagi', 'shion'])) {
  const [x, z] = spots[id] || [136, 0];
  await dbg(page, 'tp', x, z); await sleep(600);
  await dbg(page, 'skipDialogue'); await dbg(page, 'spawn', id, 1, 5);
  await page.evaluate(() => { const w = window.__game.world; w.camPitch = 0.42; });
  for (let i = 0; i < 5; i++) { await sleep(500); await dbg(page, 'skipDialogue'); }
  console.log(await shot(page, `b_${id}`));
  await page.evaluate(() => { const w = window.__game.world; for (const f of w.fighters) if (!f.isPlayer) { f.hp = 0; f.alive = false; } }); await sleep(1500);
}
console.log('errors:', logs.filter(l => /error/i.test(l)).length);
await b.close();
