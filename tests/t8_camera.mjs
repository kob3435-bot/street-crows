// Camera: wide third-person overview (default ~2x the old 5.4 m), zoom via wheel / keys / D-pad with clamps + persistence,
// no clipping into solids, buildings between camera and fight are cut away, auto-framing widens for groups, lock-on ring.
import { launch, open, state, dbg, sleep, check, shot, BASE } from './lib.mjs';
const cam = (page) => dbg(page, 'cam');
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1');
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => { const w = window.__game.world; w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3']) w.quests.done.add(id); w.eventTimer = 1e9; w.spawnTimer = 1e9; localStorage.removeItem('sc_settings'); });
  await dbg(page, 'tp', 136, 0); await page.evaluate(() => { window.__game.world.camYaw = 0; }); await sleep(2500);
  let c = await cam(page);
  check(R, 'camera: default is the wide overview (zoom 11 m, pitch 0.5, ~2x old 5.4 m)', Math.abs(c.zoom - 11) < 0.01 && Math.abs(c.pitch - 0.5) < 0.01 && c.dist > 10 && c.h > 5, `dist ${c.dist.toFixed(2)} m (old 5.4), cam height ${c.h.toFixed(1)} m, horiz ${c.horiz.toFixed(1)} m`);
  // mouse wheel zoom + clamps
  await page.mouse.move(640, 360);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 400); await sleep(40); }
  await sleep(400); c = await cam(page); const far = c.zoom;
  for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, -400); await sleep(40); }
  await sleep(1200); c = await cam(page); const near = c.zoom;
  check(R, 'camera: mouse wheel zooms, clamped to [4.5, 18] m', far === 18 && near === 4.5 && c.dist < 5.2, `far ${far}, near ${near}, dist now ${c.dist.toFixed(2)}`);
  await page.keyboard.press('Minus'); await page.keyboard.press('Minus'); await sleep(200); c = await cam(page);
  check(R, 'camera: -/+ keys zoom too', c.zoom === 7.5, `zoom ${c.zoom}`);
  // persistence: zoom saved in settings and restored after reload
  await dbg(page, 'zoom', 14); await sleep(900);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sc_settings') || '{}').zoom);
  await dbg(page, 'save', 'auto');
  await page.goto(BASE + '?test=1&continue=1'); await page.waitForFunction(() => window.__game && window.__game.ready); await sleep(1200);
  const zr = await page.evaluate(() => window.__game.world.camZoom);
  check(R, 'camera: zoom persisted in settings across reload', saved === 14 && zr === 14, `saved ${saved}, restored ${zr}`);
  await dbg(page, 'zoom', 11); await dbg(page, 'skipDialogue');
  await page.evaluate(() => { const w = window.__game.world; w.eventTimer = 1e9; w.spawnTimer = 1e9; for (const f of w.fighters) if (!f.isPlayer) w.despawn(f); });
  // no-clip sweep around dense areas (buildings get cut away; other solids pull the camera in)
  const spots = [[-40, -40], [-60, -30], [0, -50], [-150, -160], [-130, -163], [150, 32], [100, -30], [-20, 60], [60, 172], [-120, 170]];
  let bad = [], jit = 0, occl = 0, samples = 0, cutSamples = 0, best = null;
  for (const [x, z] of spots) {
    await dbg(page, 'tp', x, z);
    for (const pitch of [0.12, 0.5, 1.0]) for (let k = 0; k < 8; k++) {
      await page.evaluate(([yaw, pitch]) => { const w = window.__game.world; w.camYaw = yaw; w.camPitch = pitch; }, [k * Math.PI / 4, pitch]);
      await sleep(k === 0 ? 700 : 260);
      const r = await page.evaluate(() => {
        const G = window.__game, r = G.renderer, w = G.world, p = w.player, c = r.camera.position; const d0 = r.camDist;
        // sight line camera -> player chest must not pass through any un-cut building or non-cut solid
        const tx = p.x, ty = p.layer * 15 + 1.1, tz = p.z; const dx = tx - c.x, dy = ty - c.y, dz = tz - c.z, L = Math.hypot(dx, dy, dz);
        const hit = w.col.ray(c.x, c.y, c.z, dx / L, dy / L, dz / L, L, true); let blockedBy = hit < L - 0.6 ? 'solid' : '';
        for (const inf of r.city.binfos) { const b = inf.b; if (inf.cur > 0.6 && !inf.roofTop) { let t0 = 0, t1 = 1, ok = true; for (const [o, d, lo, hi] of [[c.x, dx, b.x0, b.x1], [c.y, dy, 0, b.h], [c.z, dz, b.z0, b.z1]]) { if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; } let a = (lo - o) / d, bb = (hi - o) / d; if (a > bb) [a, bb] = [bb, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, bb); if (t0 > t1) { ok = false; break; } } if (ok && t1 > 0.02 && t0 < 0.97) blockedBy = 'building'; } }
        let what = ''; if (r.camInsideSolid()) { if (w.col.pointInSolid(c.x, c.y, c.z, true)) what = 'solid'; else what = 'building'; }
        return { inside: r.camInsideSolid(), what, cy: c.y.toFixed(1), blockedBy, d0, cut: r.city.cutCount };
      });
      samples++; if (r.inside) bad.push(`${x},${z} yaw${k} p${pitch} ${r.what} y${r.cy}`); if (r.blockedBy) occl++; if (r.cut > 0) { cutSamples++; if (!best || r.cut > best.cut) best = { x, z, yaw: k * Math.PI / 4, pitch, cut: r.cut }; }
    }
  }
  check(R, 'camera: never inside a solid (10 dense spots x 24 angles)', bad.length === 0, `${samples} samples, bad: ${bad.slice(0, 4).join(' | ')}`);
  check(R, 'camera: player not hidden by buildings (cutaway / pull-in)', occl <= samples * 0.03, `${occl}/${samples} samples with an occluder`);
  // wall pull-in without jitter: stand next to the rooftop school building (never cut) and hold still
  await dbg(page, 'tp', -150, -165); await page.evaluate(() => { const w = window.__game.world; w.camYaw = Math.PI; w.camPitch = 0.3; }); await sleep(1500);
  const ds = []; for (let i = 0; i < 12; i++) { ds.push((await cam(page)).dist); await sleep(100); }
  const spread = Math.max(...ds) - Math.min(...ds);
  check(R, 'camera: wall collision pulls in smoothly (no jitter while standing still)', ds[0] < 10.5 && spread < 0.25, `dist ${ds[0].toFixed(2)}, spread ${spread.toFixed(3)}`);
  // cutaway engaged during the sweep (buildings sank instead of blocking); re-create the busiest case for a screenshot
  check(R, 'camera: buildings between camera and player are cut away', cutSamples >= samples * 0.1 && best, `${cutSamples}/${samples} samples had cut buildings; max ${best && best.cut}`);
  if (best) { await dbg(page, 'tp', best.x, best.z); await page.evaluate((b) => { const w = window.__game.world; w.camYaw = b.yaw; w.camPitch = Math.max(0.35, b.pitch); }, best); await sleep(1500); await shot(page, 'c02_cutaway'); }
  // auto-framing + lock-on ring in a group fight
  await dbg(page, 'tp', 136, 0); await page.evaluate(() => { const w = window.__game.world; w.camYaw = Math.PI * 0.85; w.camPitch = 0.5; }); await dbg(page, 'god', true);
  await sleep(800); const want0 = (await cam(page)).want;
  await dbg(page, 'spawn', 'raijin', 8, 6); await sleep(3500);
  c = await cam(page);
  check(R, 'camera: auto-framing widens with several engaged enemies', c.want > want0 * 1.12 && c.want < 11 * 1.35, `want ${want0.toFixed(1)} -> ${c.want.toFixed(1)}`);
  check(R, 'camera: lock-on ring shown under the current target', c.ring);
  await page.keyboard.down('KeyW'); await sleep(300); await page.keyboard.up('KeyW');
  for (let i = 0; i < 6; i++) { await page.mouse.click(640, 360); await sleep(250); }
  await sleep(300); await shot(page, 'c01_wide_group_fight_desktop');
  // gamepad D-pad zoom
  await page.evaluate(() => { const pad = { id: 'Virtual Pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null]; });
  const z0 = (await cam(page)).zoom;
  await page.evaluate(() => { window.__pad.buttons[13].pressed = true; }); await sleep(900); await page.evaluate(() => { window.__pad.buttons[13].pressed = false; });
  const z1 = (await cam(page)).zoom;
  await page.evaluate(() => { window.__pad.buttons[12].pressed = true; }); await sleep(1800); await page.evaluate(() => { window.__pad.buttons[12].pressed = false; });
  const z2 = (await cam(page)).zoom;
  check(R, 'camera: gamepad D-pad down/up zooms out/in', z1 > z0 && z2 < z1, `${z0} -> ${z1.toFixed(1)} -> ${z2.toFixed(1)}`);
  await page.evaluate(() => { window.__pad.buttons[10].pressed = true; }); await sleep(250); await page.evaluate(() => { window.__pad.buttons[10].pressed = false; }); await sleep(250);
  const au = (await state(page)).auto;
  check(R, 'gamepad: L3 toggles AUTO', au === true);
  await dbg(page, 'auto', false); await dbg(page, 'killAll');
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'camera tests: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
