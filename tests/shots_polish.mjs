// Review screenshots for the occluder fade + label declutter (desktop) — not part of run-all.
import { launch, open, dbg, shot, sleep } from './lib.mjs';
const b = await launch();
const { page, logs } = await open(b, 'test=1&newgame=1');
await dbg(page, 'skipDialogue'); await dbg(page, 'god', true);
await page.evaluate(() => { const w = window.__game.world; w.eventTimer = 1e9; w.spawnTimer = 1e9; });
// 1) group fight at the c01 spot
await dbg(page, 'tp', 136, 0); await page.evaluate(() => { const w = window.__game.world; w.camYaw = Math.PI * 0.85; w.camPitch = 0.5; });
await sleep(800); await dbg(page, 'spawn', 'raijin', 8, 6); await sleep(3500); await dbg(page, 'skipDialogue');
console.log(await shot(page, 'p01_group_fight'), JSON.stringify(await page.evaluate(() => ({ cut: window.__game.renderer.city.cutCount, props: window.__game.renderer.city.propFadeCount }))));
await page.evaluate(() => { const w = window.__game.world; for (const f of w.fighters) if (!f.isPlayer) w.despawn(f); });
// 2) find a spot where a building AND a prop sit between camera and player, then fight there
const spots = [[-40, -40], [0, -50], [-60, -30], [100, -30], [-20, 60], [150, 32], [60, 172], [-120, 170], [10, -30], [-30, -60]];
let best = null;
for (const [x, z] of spots) { await dbg(page, 'tp', x, z); for (let k = 0; k < 8; k++) { await page.evaluate((y) => { const w = window.__game.world; w.camYaw = y; w.camPitch = 0.5; }, k * Math.PI / 4); await sleep(350); const r = await page.evaluate(() => ({ cut: window.__game.renderer.city.cutCount, props: window.__game.renderer.city.propFadeCount })); const sc = r.cut * 2 + r.props; if (r.cut > 0 && (!best || sc > best.sc)) best = { x, z, yaw: k * Math.PI / 4, sc, ...r }; } }
console.log('best', JSON.stringify(best));
if (best) { await dbg(page, 'tp', best.x, best.z); await page.evaluate((y) => { const w = window.__game.world; w.camYaw = y; w.camPitch = 0.5; }, best.yaw); await sleep(600); await dbg(page, 'spawn', 'raijin', 7, 5); await sleep(3000); await dbg(page, 'skipDialogue'); await page.evaluate((y) => { window.__game.world.camYaw = y; }, best.yaw); await sleep(500);
  console.log(await shot(page, 'p02_group_fight_occluder'), JSON.stringify(await page.evaluate(() => ({ cut: window.__game.renderer.city.cutCount, props: window.__game.renderer.city.propFadeCount })))); }
console.log('errors:', logs.length, logs.slice(0, 3));
await b.close();
