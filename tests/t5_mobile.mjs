// Mobile: Pixel 7 emulation (touch, portrait + landscape): boots, touch controls, joystick moves, buttons attack, drag-look.
import { launch, check, shot, sleep, state, BASE } from './lib.mjs';
import { devices } from 'playwright-core';
async function run(R, b, landscape) {
  const tag = landscape ? 'landscape' : 'portrait';
  const d = devices['Pixel 7']; const vp = landscape ? { width: d.viewport.height, height: d.viewport.width } : d.viewport;
  const ctx = await b.newContext({ ...d, viewport: vp, screen: landscape ? { width: d.screen.height, height: d.screen.width } : d.screen });
  const page = await ctx.newPage(); const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push(e.message));
  await page.goto(BASE + '?test=1', { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 60000 });
  await sleep(800);
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const q = await page.evaluate(() => window.__game.renderer.quality);
  check(R, `mobile ${tag}: coarse pointer detected, low quality auto-selected`, coarse && q === 0, `quality ${q}`);
  if (!landscape) await shot(page, 'm00_title_portrait');
  await page.tap('[data-m="new"]'); await sleep(800);
  for (let i = 0; i < 20 && await page.isVisible('#dialogue'); i++) { await page.tap('#dialogue .txt', { timeout: 1500 }).catch(() => {}); await sleep(100); }
  check(R, `mobile ${tag}: dialogue advanced by tapping`, !(await page.isVisible('#dialogue')));
  check(R, `mobile ${tag}: touch controls visible`, await page.isVisible('#touch .btns') && await page.isVisible('[data-a="punch"]'));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // joystick: press lower-left, push up
  const W = vp.width, H = vp.height; const jx = Math.round(W * 0.18), jy = Math.round(H * 0.78);
  const s0 = await state(page);
  await touch('touchStart', [{ x: jx, y: jy, id: 1 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: jx, y: jy - i * 10, id: 1 }]); await sleep(30); }
  await sleep(1800);
  const mid = await page.evaluate(() => ({ moving: window.__game.input.moveY }));
  await touch('touchEnd', []);
  const s1 = await state(page); const moved = Math.hypot(s1.x - s0.x, s1.z - s0.z);
  check(R, `mobile ${tag}: virtual joystick moves the player`, moved > 2 && mid.moving > 0.5, `moved ${moved.toFixed(1)} m`);
  // drag-look on the right side
  const y0 = await page.evaluate(() => window.__game.world.camYaw);
  const lx = Math.round(W * 0.6), ly = Math.round(H * 0.3);
  await touch('touchStart', [{ x: lx, y: ly, id: 2 }]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: lx + i * 15, y: ly, id: 2 }]); await sleep(20); } await touch('touchEnd', []);
  await sleep(200); const y1 = await page.evaluate(() => window.__game.world.camYaw);
  check(R, `mobile ${tag}: drag on right side rotates camera`, Math.abs(y1 - y0) > 0.2, `dyaw ${(y1 - y0).toFixed(2)}`);
  // buttons
  await page.evaluate(() => { window.__sw = 0; window.__game.bus.on('swing', () => window.__sw++); });
  await page.evaluate(() => { const G = window.__game, w = G.world; const p = w.player; const e = w.makeFighter({ gang: 'kurogane', x: p.x + Math.sin(p.yaw) * 1.4, z: p.z + Math.cos(p.yaw) * 1.4 }); e.aggro = true; e.hostileToPlayer = true; });
  for (const a of ['punch', 'punch', 'heavy', 'kick', 'hkick']) { await page.tap(`[data-a="${a}"]`); await sleep(350); }
  const sw = await page.evaluate(() => window.__sw);
  check(R, `mobile ${tag}: attack buttons trigger moves`, sw >= 3, `${sw} swings`);
  await sleep(600); await shot(page, `m01_gameplay_${tag}`);
  await page.tap('[data-a="menu"]'); await sleep(400);
  check(R, `mobile ${tag}: menu button opens menu`, await page.isVisible('#menu.on'));
  await shot(page, `m02_menu_${tag}`);
  await page.tap('#menu [data-x]'); await sleep(200);
  const fps = await page.evaluate(() => window.__game.renderer.fps);
  check(R, `mobile ${tag}: zero console/runtime errors`, logs.length === 0 && (await page.evaluate(() => window.__game.errors.length)) === 0, logs.slice(0, 3).join(' | ') + ` fps(swiftshader) ${fps.toFixed(1)}`);
  await ctx.close();
}
export default async function (R) { const b = await launch(); await run(R, b, false); await run(R, b, true); await b.close(); }
