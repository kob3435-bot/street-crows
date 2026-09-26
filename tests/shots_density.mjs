// Screenshot helper: street density + distance LOD (not part of run-all).
import { launch, open, dbg, sleep, shot } from './lib.mjs';
const b = await launch(); const { page } = await open(b, 'test=1&newgame=1');
await dbg(page, 'skipDialogue');
await page.evaluate(() => { const G = window.__game, w = G.world; w.quests.active = []; w.quests.done.add('tutorial'); w.quests.load(w.quests.serialize()); w.eventTimer = 1e9; w.clock = 15; w.godMode = true; });
for (let k = 0; k < 10; k++) { await dbg(page, 'skipDialogue'); await sleep(150); }
await page.evaluate(() => { const w = window.__game.world; w.teleport(...w.freeSpot(40, 40, 3), 0); w.camZoom = 18; w.camYaw = Math.PI * 1.0; });
await sleep(7000);
const n = await page.evaluate(() => { const w = window.__game.world, p = w.player; return w.fighters.filter(f => !f.isPlayer && f.alive && !f.civilian && Math.hypot(f.x - p.x, f.z - p.z) < 80).length; });
console.log('fighters within 80 m:', n); await shot(page, 'p06_density_street'); await b.close();
