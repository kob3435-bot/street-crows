// External deploy verification: real UI only (no ?test flag). Desktop Chrome + Pixel 7.
// Usage: node tests/verify_deploy.mjs <url>
import { chromium, devices } from 'playwright-core';
const URL_ = process.argv[2]; const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function run(kind) {
  const mobile = kind === 'pixel7';
  const ctx = await b.newContext(mobile ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; const reqs = []; const bad = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => bad.push('failed ' + r.url()));
  page.on('response', r => { reqs.push(r.url()); if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 60000 });
  await sleep(1500);
  check(`${kind}: boots to title`, await page.isVisible('#title .logo'));
  check(`${kind}: fonts loaded`, await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Kanit') && document.fonts.check('16px Bangers'); }));
  const tap = s => mobile ? page.tap(s) : page.click(s);
  await tap('[data-m="new"]'); await sleep(1200);
  check(`${kind}: new game started (HUD + tutorial)`, await page.isVisible('#hud') && (await page.evaluate(() => window.__game.world.quests.isActive('tutorial'))));
  for (let i = 0; i < 25 && await page.isVisible('#dialogue'); i++) { await (mobile ? page.tap('#dialogue .txt', { timeout: 1500 }) : page.click('#dialogue', { timeout: 1500 })).catch(() => {}); await sleep(120); }
  check(`${kind}: intro dialogue advanced`, !(await page.isVisible('#dialogue')));
  const pos = () => page.evaluate(() => { const p = window.__game.world.player; return [p.x, p.z]; });
  const p0 = await pos();
  if (mobile) {
    const cdp = await ctx.newCDPSession(page); const vp = page.viewportSize();
    const jx = Math.round(vp.width * 0.18), jy = Math.round(vp.height * 0.78);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - i * 10, id: 1 }] }); await sleep(30); }
    await sleep(2000); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await page.keyboard.down('KeyW'); await sleep(1200); await page.keyboard.down('ShiftLeft'); await sleep(1200); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); }
  const p1 = await pos(); const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  check(`${kind}: player moves (${mobile ? 'virtual joystick' : 'WASD+Shift'})`, moved > 2, `${moved.toFixed(1)} m`);
  // fight: put one hostile grunt right in front, then attack with real inputs
  await page.evaluate(() => { const w = window.__game.world, p = w.player;
    const e = w.makeFighter({ gang: 'kurogane', x: p.x + Math.sin(p.yaw) * 1.3, z: p.z + Math.cos(p.yaw) * 1.3 }); e.aggro = true; e.hostileToPlayer = true; window.__foe = e; window.__foeHp0 = e.hp;
    window.__hits = 0; window.__game.bus.on('hit', h => { if (h.att === p) window.__hits++; }); });
  for (let i = 0; i < 8; i++) {
    if (mobile) await page.tap(`[data-a="${['punch', 'punch', 'kick', 'heavy'][i % 4]}"]`);
    else if (i % 4 === 3) await page.keyboard.press('KeyF'); else await page.mouse.click(640, 420, { button: i % 4 === 2 ? 'right' : 'left' });
    await sleep(mobile ? 380 : 650);
  }
  const f = await page.evaluate(() => ({ hits: window.__hits, hp0: window.__foeHp0, hp: window.__foe.hp }));
  check(`${kind}: fight — attacks land on enemy`, f.hits >= 2 && f.hp < f.hp0, `${f.hits} hits, foe HP ${f.hp0.toFixed(0)}→${f.hp.toFixed(0)}`);
  await sleep(500); await page.screenshot({ path: `${SHOTS}deploy_${kind}.png` });
  const fps = await page.evaluate(() => window.__game.renderer.fps);
  const gameErrs = await page.evaluate(() => window.__game.errors);
  check(`${kind}: zero console/runtime errors`, errs.length === 0 && gameErrs.length === 0, [...errs, ...gameErrs].slice(0, 3).join(' | '));
  check(`${kind}: no 404 / failed requests`, bad.length === 0, bad.length ? bad.slice(0, 4).join(' | ') : `${reqs.length} requests OK, fps(swiftshader) ${fps.toFixed(1)}`);
  await ctx.close();
}
await run('desktop'); await run('pixel7');
await b.close();
const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed @ ${URL_}`);
process.exit(pass === results.length ? 0 : 1);
