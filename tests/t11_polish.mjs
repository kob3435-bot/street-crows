// Polish: occluder fade (buildings + lamps/poles/props dither out instead of blocking), decluttered enemy labels,
// device-aware prompts (keyboard / gamepad / touch), compact top-centre hint that auto-dismisses or closes on tap.
import { launch, open, dbg, sleep, check, shot, BASE } from './lib.mjs';
import { devices } from 'playwright-core';
const KB_WORDS = /คลิกซ้าย|คลิกขวา|LMB|RMB|Space|WASD|Shift|\bTab\b/;
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1');
  await dbg(page, 'skipDialogue'); await dbg(page, 'god', true);
  await page.evaluate(() => { const w = window.__game.world; w.eventTimer = 1e9; w.spawnTimer = 1e9; });
  // --- A: a street lamp right between camera and player fades (and un-fades when clear)
  const A = await page.evaluate(async () => {
    const G = window.__game, w = G.world, r = G.renderer, city = r.city; const sl = (ms) => new Promise(res => setTimeout(res, ms));
    // pick (synchronously) a lamp + side where the player spot is free and the camera boom behind the lamp is unobstructed
    let pick = null; const P = 0.42;
    for (const [lx, lz] of w.city.lamps) { if (Math.abs(lx) > 160 || Math.abs(lz) > 160) continue;
      for (let k = 0; k < 4 && !pick; k++) { const a = k * Math.PI / 2, px = lx + Math.sin(a) * 7, pz = lz + Math.cos(a) * 7; if (w.col.solidAt(px, pz, 0.8, 0)) continue;
        const yaw = a + Math.PI, dx = Math.sin(yaw) * Math.cos(P), dy = Math.sin(P), dz = Math.cos(yaw) * Math.cos(P);
        if (w.col.ray(px, 1.2, pz, dx, dy, dz, 13, true) >= 12.5 && w.col.ray(px, 1.2, pz, -dx, 0, -dz, 3, true) >= 2.9) pick = { lx, lz, px, pz, yaw, a }; }
      if (pick) break; }
    if (!pick) return { none: true };
    w.teleport(pick.px, pick.pz, 0); const pl = w.player; pl.x = pl.px = pick.px; pl.z = pl.pz = pick.pz; w.camYaw = pick.yaw; w.camPitch = P; // exact spot (teleport may nudge ~2 m)
    // let the chunk stream in and the camera boom settle (it starts at the default distance, then may ease in), then read the fade
    let last = -1, calm = 0; for (let t = 0; t < 60 && calm < 4; t++) { await sl(150); const d = r.camDist; calm = Math.abs(d - last) < 0.05 && t > 6 ? calm + 1 : 0; last = d; } await sl(900);
    const find = () => city.pinfos.filter(q => pick.lx > q.x0 && pick.lx < q.x1 && pick.lz > q.z0 && pick.lz < q.z1 && q.y1 > 4);
    for (let t = 0; t < 40 && !find().length; t++) await sl(150); // chunk streaming can lag on a live host
    let pis = find(); if (!pis.length) return { noInfo: true, pick };
    let faded = 1; for (let t = 0; t < 25 && faded >= 0.5; t++) { pis = find(); faded = Math.min(...pis.map(q => q.cur)); if (faded >= 0.5) await sl(120); }
    const pi = pis.reduce((a, q) => q.cur < a.cur ? q : a, pis[0]); const dist = r.camDist; w.camYaw = pick.a; await sl(1500); const back = pi.cur;
    const cp = r.camera.position; return { lamp: [pick.lx, pick.lz], camDist: +dist.toFixed(1), faded, back, dbg: { pl: [+w.player.x.toFixed(1), +w.player.z.toFixed(1)], want: [pick.px, pick.pz], cam: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)], yaw: +w.camYaw.toFixed(2), pickYaw: +pick.yaw.toFixed(2), st: w.player.state, dlg: !!w.dialogue, menu: w.menuOpen } };
  });
  check(R, 'occluders: street lamp between camera and player fades (screen-door), restores when clear', A && A.faded < 0.5 && A.back > 0.95, JSON.stringify(A));
  // --- B: buildings on the sight line fade (stay full height, see-through) — no stubs
  const B = await page.evaluate(async () => {
    const G = window.__game, w = G.world, r = G.renderer, city = r.city; const sl = (ms) => new Promise(res => setTimeout(res, ms));
    for (const [x, z] of [[0, -50], [-40, -40], [10, -30], [-60, -30]]) { w.teleport(x, z, 0); for (let k = 0; k < 8; k++) { w.camYaw = k * Math.PI / 4; w.camPitch = 0.45; await sl(450); if (city.cutCount > 0) { const f = city.binfos.filter(i => i.cur < 0.5); const im = f[0]; return { x, z, k, faded: f.length, minFade: Math.min(...f.map(i => i.cur)), attr: im.fa.getX(im.i) }; } } }
    return null;
  });
  check(R, 'occluders: buildings between camera and fight become see-through (dither fade, full height)', B && B.faded > 0 && B.minFade <= 0.21 && B.attr <= 0.21, JSON.stringify(B));
  // --- C: group fight with an occluder: labels decluttered, desktop fight hint with keyboard chips at top-centre
  await page.evaluate(() => { const G = window.__game; G.hud.hintsSeen.clear(); G.hud.hideHint(); });
  await dbg(page, 'tp', 0, -50); await page.evaluate(() => { const w = window.__game.world; w.camYaw = 3 * Math.PI / 4; w.camPitch = 0.5; }); await sleep(700);
  await dbg(page, 'spawn', 'raijin', 9, 4); await page.evaluate(() => window.__game.bus.emit('aggro', {})); await sleep(2200);
  const C = await page.evaluate(() => {
    const h = document.querySelector('#hint'); const hr = h.getBoundingClientRect();
    const names = [...document.querySelectorAll('#tags .tag')].filter(e => e.style.display !== 'none' && !e.classList.contains('nn') && !e.classList.contains('friendly')).map(e => e.querySelector('.tn').getBoundingClientRect()).filter(r => r.width);
    let ov = 0; for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = names[i], b = names[j]; const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 4 && iy > 4) ov++; }
    const bars = [...document.querySelectorAll('#tags .tag')].filter(e => e.style.display !== 'none' && !e.classList.contains('friendly')).length;
    const hud = []; for (const s of ['.hud-tl', '#minimap', '#h-quest', '#boss']) { const e = document.querySelector(s); const r = e.getBoundingClientRect(); if (e.offsetParent !== null && r.width && getComputedStyle(e).visibility !== 'hidden' && r.left < hr.right && r.right > hr.left && r.top < hr.bottom && r.bottom > hr.top) hud.push(s); }
    return { vis: h.style.display === 'block', html: h.innerHTML, top: hr.top, cx: (hr.left + hr.right) / 2, W: innerWidth, H: innerHeight, kbm: h.querySelectorAll('kbd.k-kbm').length, names: names.length, ov, bars, tgt: document.querySelectorAll('#tags .tag.tgt').length, hud };
  });
  check(R, 'desktop: fight hint uses keyboard/mouse chips, compact in the top band (no HUD overlap)', C.vis && C.kbm >= 8 && C.top < C.H * 0.3 && Math.abs(C.cx - C.W / 2) < C.W * 0.15 && C.hud.length === 0, `top ${Math.round(C.top)}/${C.H}, cx ${Math.round(C.cx)}/${C.W}, ${C.kbm} chips, overlaps ${C.hud.join(',')}`);
  check(R, 'labels: 9-enemy group keeps HP bars, names decluttered (no overlapping names, target highlighted)', C.bars >= 6 && C.ov === 0 && C.names <= 6 && C.names >= 1, `bars ${C.bars}, names ${C.names}, overlaps ${C.ov}, target tags ${C.tgt}`);
  // screenshot: pick the camera yaw with the most faded occluders in view during the fight
  { let best = { k: 3, n: -1 }; for (let k = 0; k < 8; k++) { await page.evaluate((y) => { window.__game.world.camYaw = y; }, k * Math.PI / 4); await sleep(450); const n = await page.evaluate(() => window.__game.renderer.city.cutCount * 3 + window.__game.renderer.city.propFadeCount); if (n > best.n) best = { k, n }; }
    await page.evaluate((y) => { window.__game.world.camYaw = y; }, best.k * Math.PI / 4); await sleep(900); await dbg(page, 'skipDialogue'); await sleep(300); await shot(page, 'p02_group_fight_occluder'); }
  const occ = await page.evaluate(() => ({ cut: window.__game.renderer.city.cutCount, props: window.__game.renderer.city.propFadeCount }));
  check(R, 'desktop: group-fight screenshot has faded occluders in view', occ.cut + occ.props > 0, JSON.stringify(occ));
  await page.click('#hint'); await sleep(200);
  check(R, 'hint: click/tap closes it', !(await page.isVisible('#hint')));
  const keysKb = await page.evaluate(() => document.querySelector('#keys').textContent);
  // gamepad: glyphs swap on first pad input
  await page.evaluate(() => { const pad = { id: 'Virtual Pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null]; });
  await page.evaluate(() => { window.__pad.axes[0] = 0.8; }); for (let t = 0; t < 20; t++) { await sleep(100); if (t >= 2 && await page.evaluate(() => document.body.classList.contains('dev-pad'))) break; } await page.evaluate(() => { window.__pad.axes[0] = 0; });
  await page.evaluate(() => { const G = window.__game; G.hud.hintsSeen.delete('eblock'); G.hud.hint('eblock', 'x', () => ''); G.hud.hideHint(); G.hud.hintsSeen.delete('parry'); G.bus.emit('parry', { f: G.world.player }); });
  await sleep(200);
  const P = await page.evaluate(() => ({ keys: document.querySelector('#keys').innerHTML, hint: document.querySelector('#hint').innerHTML, dev: document.body.classList.contains('dev-pad') }));
  check(R, 'gamepad: key bar + hints switch to gamepad buttons', P.dev && /k-pad/.test(P.keys) && /L3/.test(P.keys) && /k-pad">LB/.test(P.hint) && !/Tab/.test(P.keys), `kb bar "${keysKb.slice(0, 40)}…" -> pad; hint ${P.hint.replace(/<[^>]+>/g, ' ').slice(0, 80)}`);
  await page.keyboard.press('KeyW'); await sleep(200);
  check(R, 'keyboard: glyphs switch back on key press', await page.evaluate(() => document.body.classList.contains('dev-kbm') && /Tab/.test(document.querySelector('#keys').textContent)));
  check(R, 'desktop polish: zero console errors', logs.length === 0, logs.slice(0, 3).join(' | '));
  await b.close();
  // --- D: touch (Pixel 7 portrait + landscape): touch-button hints, placement, auto-dismiss, no keyboard words anywhere
  const b2 = await launch();
  for (const landscape of [false, true]) {
    const tag = landscape ? 'landscape' : 'portrait'; const d = devices['Pixel 7']; const vp = landscape ? { width: d.viewport.height, height: d.viewport.width } : d.viewport;
    const ctx = await b2.newContext({ ...d, viewport: vp, screen: landscape ? { width: d.screen.height, height: d.screen.width } : d.screen });
    const pg = await ctx.newPage(); const L = []; pg.on('console', m => { if (m.type() === 'error') L.push(m.text()); }); pg.on('pageerror', e => L.push(e.message));
    await pg.goto(BASE + '?test=1&newgame=1', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 60000 });
    await sleep(600);
    const dlgNext = await pg.evaluate(() => document.querySelector('#dialogue .next')?.textContent || '');
    await dbg(pg, 'skipDialogue'); await dbg(pg, 'god', true);
    const obj = await pg.evaluate(() => document.querySelector('#h-quest')?.textContent || '');
    // combat tutorial: the tutorial thugs aggro -> fight hint
    await pg.evaluate(() => { const w = window.__game.world; w.eventTimer = 1e9; w.spawnTimer = 1e9; window.__game.hud.hintsSeen.clear(); });
    await dbg(pg, 'tp', 2, -26); await sleep(300); await dbg(pg, 'spawn', 'onigawara', 3, 5); await pg.evaluate(() => window.__game.bus.emit('aggro', {})); await sleep(1600);
    const H = await pg.evaluate(() => {
      const h = document.querySelector('#hint'); const hr = h.getBoundingClientRect(); const ov = [];
      for (const s of ['#touch .tb', '.hud-tl', '#h-quest', '#minimap', '#boss']) document.querySelectorAll(s).forEach(e => { const r = e.getBoundingClientRect(); if (e.offsetParent === null || !r.width || getComputedStyle(e).visibility === 'hidden') return; if (r.left < hr.right - 1 && r.right > hr.left + 1 && r.top < hr.bottom - 1 && r.bottom > hr.top + 1) ov.push(s + (e.dataset.a ? ':' + e.dataset.a : '')); });
      return { vis: h.style.display === 'block', text: h.textContent, touch: h.querySelectorAll('kbd.k-touch').length, kbm: h.querySelectorAll('kbd.k-kbm').length, top: hr.top, bottom: hr.bottom, H: innerHeight, ov, keysVis: getComputedStyle(document.querySelector('#keys')).display !== 'none' };
    });
    await shot(pg, `p03_mobile_combat_hint_${tag}`);
    check(R, `touch ${tag}: combat hint names the on-screen buttons (no keyboard/mouse keys)`, H.vis && H.touch >= 8 && H.kbm === 0 && !KB_WORDS.test(H.text) && /ต่อย|PUNCH/.test(H.text) && /AUTO/.test(H.text), H.text.slice(0, 90));
    check(R, `touch ${tag}: hint is compact, in the upper area and covers no HUD panel or button`, H.ov.length === 0 && H.top < H.H * 0.45 && H.bottom - H.top < H.H * 0.2, `top ${Math.round(H.top)} bottom ${Math.round(H.bottom)} of ${H.H}; overlaps ${H.ov.join(',')}`);
    check(R, `touch ${tag}: key bar hidden, dialogue/objective texts are touch wording`, !H.keysVis && !KB_WORDS.test(obj) && !dlgNext.includes("E /"), `objective "${obj.slice(0, 60)}", next "${dlgNext}"`);
    await sleep(4600);
    check(R, `touch ${tag}: hint auto-dismisses after a few seconds`, !(await pg.isVisible('#hint')));
    // tap-to-dismiss + interact prompt
    await pg.evaluate(() => { const G = window.__game; G.hud.hintsSeen.delete('special'); G.world.player.meter = 100; }); await sleep(400);
    const spOk = await pg.evaluate(() => { const h = document.querySelector('#hint'); return h.style.display === 'block' && /พิเศษ|SP/.test(h.textContent) && !/\bR\b/.test(h.textContent); });
    await pg.tap('#hint'); await sleep(250); const closed = !(await pg.isVisible('#hint'));
    check(R, `touch ${tag}: special hint references the พิเศษ button, tap closes it`, spOk && closed, JSON.stringify({ spOk, closed }));
    await dbg(pg, 'skipDialogue'); await pg.evaluate(() => { const w = window.__game.world, p = w.player; for (const f of w.fighters) if (!f.isPlayer) w.despawn(f); w.godMode = true; w.downT = 0; p.hp = p.maxHp; p.setState('idle'); const it = w.interactables().find(i => i.kind === 'npc' && (i.layer || 0) === 0); window.__npc = it; w.teleport(it.pos[0] + 0.8, it.pos[1] + 0.8, 0); });
    for (let t = 0; t < 30; t++) { const ok = await pg.evaluate(() => { const G = window.__game, w = G.world, it = window.__npc; if (w.dialogue) G.debug.skipDialogue(); if (Math.hypot(w.player.x - it.pos[0], w.player.z - it.pos[1]) > 2.5) w.teleport(it.pos[0] + 0.8, it.pos[1] + 0.8, 0); return document.querySelector('#prompt').style.display === 'block'; }); if (ok) break; await sleep(200); } // quest lines may pop up; skip them
    const pr = await pg.evaluate(() => { const e = document.querySelector('#prompt'); const w = window.__game.world; return { vis: e.style.display === 'block', html: e.innerHTML || JSON.stringify({ t: w.interactTarget && w.interactTarget.id, dlg: !!w.dialogue, menu: w.menuOpen, p: [w.player.x | 0, w.player.z | 0, w.player.state], n: w.interactables().filter(i => i.kind === 'npc').length, hud: document.querySelector('#hud').className }) }; });
    check(R, `touch ${tag}: interact prompt shows the 💬 button, not "E"`, pr.vis && /💬/.test(pr.html) && !/>E</.test(pr.html), pr.html.slice(0, 80));
    check(R, `touch ${tag}: zero console errors`, L.length === 0, L.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b2.close();
}
