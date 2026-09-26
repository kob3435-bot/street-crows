// Gamepad API: inject a virtual standard-mapping pad and check stick movement, camera and face buttons.
import { launch, open, state, dbg, sleep, check } from './lib.mjs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1');
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => { const w = window.__game.world; w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3']) w.quests.done.add(id); w.eventTimer = 1e9; });
  await sleep(500); await dbg(page, 'skipDialogue');
  await page.evaluate(() => {
    const pad = { id: 'Virtual Pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null];
    window.__sw = 0; window.__game.bus.on('swing', () => window.__sw++);
  });
  const s0 = await state(page); const y0 = await page.evaluate(() => window.__game.world.camYaw);
  await page.evaluate(() => { window.__pad.axes = [0, -1, 0.8, 0]; }); await sleep(1500); await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; }); await sleep(200);
  const s1 = await state(page); const y1 = await page.evaluate(() => window.__game.world.camYaw);
  check(R, 'gamepad: left stick moves, right stick turns camera', Math.hypot(s1.x - s0.x, s1.z - s0.z) > 1.5 && Math.abs(y1 - y0) > 0.2, `moved ${Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(1)} m, dyaw ${(y1 - y0).toFixed(2)}`);
  for (const i of [2, 3, 1]) { await page.evaluate((i) => { window.__pad.buttons[i].pressed = true; }, i); await sleep(150); await page.evaluate((i) => { window.__pad.buttons[i].pressed = false; }, i); await sleep(450); }
  check(R, 'gamepad: X/Y/B trigger punch/heavy/kick', (await page.evaluate(() => window.__sw)) >= 2, `${await page.evaluate(() => window.__sw)} swings`);
  await page.evaluate(() => { window.__pad.buttons[8].pressed = true; }); await sleep(200); await page.evaluate(() => { window.__pad.buttons[8].pressed = false; }); await sleep(300);
  check(R, 'gamepad: Back opens the menu', await page.isVisible('#menu.on'));
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'gamepad: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
