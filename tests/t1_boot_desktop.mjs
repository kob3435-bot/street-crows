// Desktop boot: zero errors, title, new game via UI, keyboard movement, mouse attack, menus, fonts.
import { launch, open, shot, state, dbg, sleep, check } from './lib.mjs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1');
  await sleep(1500);
  check(R, 'boot: title screen visible', await page.isVisible('#title .logo'));
  check(R, 'boot: HUD hidden on title', !(await page.isVisible('#hud')));
  check(R, 'boot: Thai font loaded (Kanit)', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Kanit'); }));
  await shot(page, 'd00_title');
  await page.click('[data-m="new"]'); await sleep(1200);
  check(R, 'new game: HUD visible', await page.isVisible('#hud'));
  check(R, 'new game: tutorial active', (await state(page)).active.includes('tutorial:0'));
  check(R, 'new game: intro dialogue shown', await page.isVisible('#dialogue'));
  // advance dialogue by clicking the box (real UI)
  for (let i = 0; i < 20 && await page.isVisible('#dialogue'); i++) { await page.click('#dialogue', { timeout: 1500 }).catch(() => {}); await sleep(120); }
  check(R, 'dialogue: advanced by clicking', !(await page.isVisible('#dialogue')));
  const s0 = await state(page);
  await page.keyboard.down('KeyW'); await sleep(1500); await page.keyboard.down('ShiftLeft'); await sleep(1500); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  const s1 = await state(page); const moved = Math.hypot(s1.x - s0.x, s1.z - s0.z);
  check(R, 'movement: WASD + Shift sprint moves player', moved > 3, `moved ${moved.toFixed(1)} m`);
  await page.keyboard.down('KeyD'); await sleep(700); await page.keyboard.up('KeyD');
  // mouse attack
  const hits = await page.evaluate(() => { window.__sw = 0; window.__game.bus.on('swing', () => window.__sw++); return 0; });
  await page.mouse.click(640, 400); await sleep(250); await page.mouse.click(640, 400, { button: 'right' }); await sleep(400); await page.keyboard.press('KeyF'); await sleep(300);
  const sw = await page.evaluate(() => window.__sw);
  check(R, 'combat input: LMB/RMB/F produce attacks', sw >= 2, `${sw} swings`);
  // camera drag (no pointer lock in test mode)
  const y0 = await page.evaluate(() => window.__game.world.camYaw);
  await page.mouse.move(600, 360); await page.mouse.down({ button: 'left' }); await page.mouse.move(760, 360, { steps: 6 }); await page.mouse.up({ button: 'left' }); await sleep(200);
  const y1 = await page.evaluate(() => window.__game.world.camYaw);
  check(R, 'camera: mouse drag rotates orbit camera', Math.abs(y1 - y0) > 0.2, `dyaw ${(y1 - y0).toFixed(2)}`);
  await shot(page, 'd01_gameplay');
  // menus
  await page.keyboard.press('Tab'); await sleep(400);
  check(R, 'menu: Tab opens menu, sim frozen', await page.isVisible('#menu.on') && (await state(page)).menuOpen);
  for (const tab of ['status', 'skills', 'map', 'style', 'relations', 'roster', 'controls', 'settings', 'save', 'quests']) { await page.click(`[data-t="${tab}"]`); await sleep(120); }
  check(R, 'menu: all 10 tabs render without errors', (await page.evaluate(() => window.__game.errors.length)) === 0);
  await page.click('[data-t="style"]'); await sleep(100); await page.click('[data-cyc="hair"][data-d="1"]'); await sleep(100);
  const hair = await page.evaluate(() => window.__game.world.custom.hair);
  check(R, 'customization: hair style changes', hair !== 'spiky', hair);
  await page.click('[data-t="settings"]'); await page.click('[data-lang="en"]'); await sleep(100);
  check(R, 'i18n: TH→EN toggle updates menu', (await page.textContent('#menu .tabs')).includes('Quests'));
  await page.click('[data-lang="th"]'); await sleep(100);
  await page.keyboard.press('Tab'); await sleep(300);
  check(R, 'menu: Tab closes menu', !(await page.isVisible('#menu.on')));
  await page.keyboard.press('KeyH'); await sleep(300);
  check(R, 'help: H opens controls panel', (await page.textContent('#menu .mbody')).includes('Space'));
  await page.keyboard.press('Tab'); await sleep(200);
  const fps = await page.evaluate(() => window.__game.renderer.fps);
  const calls = await page.evaluate(() => window.__game.renderer.renderer.info.render.calls);
  check(R, 'render: frames rendering', fps > 0, `fps ${fps.toFixed(1)} (software GL), draw calls ${calls}`);
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'boot: zero console/runtime errors (desktop)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
