// Rendered screenshots for visual review (desktop 1280x720, quality high): day street, combat impact, boss fight, golden hour, night city, rooftop.
import { launch, open, shot, dbg, sleep, check, state } from './lib.mjs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1&quality=2');
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => { const w = window.__game.world; w.quests.active = []; for (const id of ['tutorial']) w.quests.done.add(id); w.eventTimer = 1e9; w.progress.addExp(900); w.refreshPlayerStats(true); });
  await dbg(page, 'step', 0.5); await dbg(page, 'skipDialogue');
  const set = (x, z, yaw, pitch, h) => page.evaluate(([x, z, yaw, pitch, h]) => { const w = window.__game.world; w.teleport(x, z, 0); w.camYaw = yaw; w.camPitch = pitch; w.setClock(h); }, [x, z, yaw, pitch, h]);
  // 1. day, shopping street
  await set(0, -30, Math.PI, 0.22, 11); await sleep(2500); await shot(page, 'v01_day_shotengai'); await dbg(page, 'skipDialogue');
  // 2. combat with impact effects
  await set(-60, 4, Math.PI * 0.5, 0.25, 15.5); await sleep(800);
  await dbg(page, 'god', true);
  await dbg(page, 'spawn', 'kurogane', 3, 3); await dbg(page, 'bot', true);
  const shots = [];
  await page.evaluate(() => { window.__heavyHit = 0; window.__game.bus.on('hit', e => { if (e.att?.isPlayer && (e.heavy || e.counter)) window.__heavyHit++; }); });
  for (let i = 0; i < 14; i++) { await sleep(450); shots.push(await shot(page, `v02_combat_${i}`)); }
  await dbg(page, 'bot', false); await dbg(page, 'killAll'); await sleep(500);
  // 3. special move / finisher
  await dbg(page, 'spawn', 'hakuryu', 2, 3); await page.evaluate(() => { const w = window.__game.world; w.player.meter = 100; }); await sleep(300);
  await page.evaluate(() => window.__game.input.press('special')); await sleep(350); await shot(page, 'v03_special_a'); await sleep(250); await shot(page, 'v03_special_b');
  await dbg(page, 'killAll'); await sleep(600);
  // 4. boss fight
  await set(140, -84, Math.PI * 0.3, 0.2, 16.5); await sleep(800);
  await dbg(page, 'spawn', 'kirishima', 1, 4); await dbg(page, 'bot', true);
  await sleep(2500); await shot(page, 'v04_boss_a');
  await page.evaluate(() => { const b = window.__game.world.fighters.find(f => f.phases); if (b) b.hp = b.maxHp * 0.3; }); await sleep(1500); await shot(page, 'v04_boss_phase');
  await sleep(2500); await shot(page, 'v04_boss_b');
  await dbg(page, 'bot', false); await dbg(page, 'killAll'); await sleep(800);
  // 5. golden hour at the river bridge
  await set(0, 100, Math.PI, 0.18, 18.2); await sleep(2500); await shot(page, 'v05_golden_river');
  // 6. night city
  await set(0, -40, Math.PI, 0.18, 22); await sleep(2500); await shot(page, 'v06_night_shotengai');
  await set(100, 4, -Math.PI / 2, 0.2, 23); await sleep(2500); await shot(page, 'v07_night_mainroad');
  await set(90, 150, Math.PI * 0.8, 0.2, 23.5); await sleep(2500); await shot(page, 'v08_night_warehouse');
  // 7. rooftop
  await page.evaluate(() => { const w = window.__game.world; w.setClock(17); w.teleport(-130, -172, 0); w.interact(); w.camYaw = 0.3; }); await sleep(2500); await shot(page, 'v09_rooftop');
  // 8. park day
  await set(-130, 40, Math.PI * 0.7, 0.25, 9.5); await sleep(2500); await shot(page, 'v10_park');
  const fps = await page.evaluate(() => window.__game.renderer.fps);
  const heavy = await page.evaluate(() => window.__heavyHit);
  check(R, 'visual: screenshots captured (day/combat/boss/golden/night/rooftop)', true, `heavy/counter hits during combat capture: ${heavy}; fps(swiftshader, high) ${fps.toFixed(1)}`);
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'visual run: zero console/runtime errors (quality high)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
