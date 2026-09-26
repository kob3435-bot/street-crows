import { launch, open, shot, dbg, sleep } from './lib.mjs';
const b = await launch();
const { page } = await open(b, 'test=1&newgame=1&quality=2');
await dbg(page, 'skipDialogue');
await page.evaluate(() => { const w = window.__game.world; w.quests.active = []; w.quests.done.add('tutorial'); w.quests.done.add('main1'); w.eventTimer = 1e9; w.progress.addExp(900); w.refreshPlayerStats(true); });
await dbg(page, 'step', 0.3); await dbg(page, 'skipDialogue');
await page.evaluate(() => { const w = window.__game.world; w.setClock(12.5); w.teleport(-130, -165, 0); w.interact(); w.camPitch = 0.3; }); await sleep(2500); await shot(page, 'x01_rooftop_a');
await page.evaluate(() => { const w = window.__game.world; w.setClock(17.4); w.camYaw = Math.PI * 0.75; }); await sleep(1500); await shot(page, 'x01_rooftop_b');
// close combat
await page.evaluate(() => { const w = window.__game.world; w.setClock(16); w.teleport(-40, 3, 0); w.camYaw = Math.PI / 2; w.camPitch = 0.2; window.__game.renderer.camDist = 4.2; }); await sleep(800);
await dbg(page, 'god', true);
await page.evaluate(() => { const G = window.__game, w = G.world, p = w.player; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.7; const f = w.makeFighter({ gang: 'kurogane', x: p.x + Math.sin(a) * 2, z: p.z + Math.cos(a) * 2 }); f.aggro = true; f.hostileToPlayer = true; } window.__big = 0; G.bus.on('hit', e => { if (e.att?.isPlayer && e.heavy) { window.__big++; } }); });
await dbg(page, 'bot', true);
for (let i = 0; i < 16; i++) { await sleep(300); await shot(page, `x02_close_${i}`); }
await b.close();
