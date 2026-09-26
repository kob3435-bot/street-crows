// AUTO: walks to the nearest hostile around buildings (grid A*), stops in range facing it, re-targets, never attacks /
// blocks / dodges by itself, manual input overrides, pauses in dialogue, ignores civilians & friendly gangs, T key,
// no-target toast, and the mobile AUTO button (portrait + landscape screenshots).
import { launch, open, state, dbg, sleep, check, shot, BASE } from './lib.mjs';
import { devices } from 'playwright-core';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => {
    const G = window.__game, w = G.world; w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3']) w.quests.done.add(id); w.quests.load(w.quests.serialize()); w.eventTimer = 1e9; w.spawnTimer = 1e9;
    window.__au = { swings: 0, playerHits: 0, noTarget: 0, toggles: 0 };
    G.bus.on('swing', (e) => { if (e.f === w.player) window.__au.swings++; }); G.bus.on('hit', (e) => { if (e.att === w.player) window.__au.playerHits++; });
    G.bus.on('autoNoTarget', () => window.__au.noTarget++); G.bus.on('autoToggle', () => window.__au.toggles++);
    // helper: run the sim with real input polling, recording forbidden player states
    window.__run = (sec, probe) => { const bad = new Set(); let minD = 1e9, solid = 0; for (let i = 0; i < Math.round(sec * 60); i++) { G.input.poll(); w.step(1 / 60, G.input); const p = w.player; if (['attack', 'block', 'dodge', 'grabbing', 'blockstun'].includes(p.state) && p.state !== 'blockstun') bad.add(p.state); if (w.col.solidAt(p.x, p.z, 0.2, p.layer)) solid++; if (probe) minD = Math.min(minD, Math.hypot(probe.x - p.x, probe.z - p.z)); } return { bad: [...bad], minD, solid }; };
    window.__clear = () => { for (const f of w.fighters) if (!f.isPlayer) w.despawn(f); w.step(1 / 60, G.input); };
  });
  // --- A: path around a building to a static hostile, stop in range, face it, never attack
  const A = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__clear();
    let pick = null;
    for (const bd of w.city.buildings) {
      const W = bd.x1 - bd.x0, D = bd.z1 - bd.z0; if (W < 8 || W > 30 || D < 6 || D > 30) continue; const cx = (bd.x0 + bd.x1) / 2;
      const a = [cx, bd.z0 - 2.5], c = [cx, bd.z1 + 2.5];
      if (!w.nav.walkable(a[0], a[1], 0) || !w.nav.walkable(c[0], c[1], 0) || w.col.solidAt(a[0], a[1], 1, 0) || w.col.solidAt(c[0], c[1], 1, 0)) continue;
      const path = w.nav.findPath(a[0], a[1], c[0], c[1], 0); if (!path || path.length < 2) continue;
      let len = 0, px = a[0], pz = a[1]; for (const [x, z] of path) { len += Math.hypot(x - px, z - pz); px = x; pz = z; } if (len > 60) continue;
      pick = { a, c, bd: [bd.x0, bd.z0, bd.x1, bd.z1], len }; break;
    }
    if (!pick) return { ok: false, why: 'no building found' };
    w.teleport(pick.a[0], pick.a[1], 0); p.x = p.px = pick.a[0]; p.z = p.pz = pick.a[1];
    const e = w.makeFighter({ gang: 'nora', x: pick.c[0], z: pick.c[1] }); e.ai = null; e.hostileToPlayer = true; e.name = 'Dummy'; const hp0 = e.hp;
    const blockedStraight = w.col.blocked(p.x, p.z, e.x, e.z, 0);
    window.__au.swings = 0; w.setAuto(true);
    const r = window.__run(30, e); const d = Math.hypot(e.x - p.x, e.z - p.z); const face = Math.abs(((Math.atan2(e.x - p.x, e.z - p.z) - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return { ok: true, blockedStraight, pathLen: pick.len.toFixed(1), d, face, status: w.autoStatus, hp0, hp1: e.hp, swings: window.__au.swings, bad: r.bad, solid: r.solid, target: w.autoTarget === e };
  });
  check(R, 'AUTO: walks around a building to a hostile (A* path, straight line blocked)', A.ok && A.blockedStraight && A.d < 3 && A.solid === 0, JSON.stringify({ path: A.pathLen, d: A.d?.toFixed(2), solidFrames: A.solid, why: A.why }));
  check(R, 'AUTO: stops at attack range facing the target', A.ok && A.status === 'engage' && A.d > 1.2 && A.face < 0.35, `d ${A.d?.toFixed(2)} face err ${A.face?.toFixed(2)} status ${A.status}`);
  check(R, 'AUTO: never attacks on its own (0 swings, enemy HP unchanged, no attack/block/dodge state)', A.ok && A.swings === 0 && A.hp0 === A.hp1 && A.bad.length === 0, `swings ${A.swings}, HP ${A.hp0}->${A.hp1}, states ${A.bad.join(',')}`);
  // --- B: aggressive enemy attacking the player; only AUTO on -> enemy HP never changes
  const B = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__clear(); G.debug.god(true); w.setAuto(true);
    const ids = G.debug.spawn('raijin', 3, 7); const es = w.fighters.filter(f => ids.includes(f.id)); const hp0 = es.map(f => f.hp);
    window.__au.swings = 0; window.__au.playerHits = 0; const r = window.__run(15);
    G.debug.god(false); return { hp0, hp1: es.map(f => f.hp), swings: window.__au.swings, hits: window.__au.playerHits, bad: r.bad, st: w.autoStatus, near: Math.min(...es.map(f => f.distTo(p))) };
  });
  check(R, 'AUTO: under attack by 3 enemies, still never attacks/blocks/dodges (HP of all enemies unchanged)', JSON.stringify(B.hp0) === JSON.stringify(B.hp1) && B.swings === 0 && B.hits === 0 && B.bad.length === 0, JSON.stringify(B));
  // --- C: re-target after the target is defeated
  const C = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__clear(); w.setAuto(true);
    const e1 = w.makeFighter({ gang: 'nora', ...(() => { const [x, z] = w.freeSpot(p.x + 6, p.z, 1); return { x, z }; })() }); e1.ai = null; e1.hostileToPlayer = true;
    const e2 = w.makeFighter({ gang: 'nora', ...(() => { const [x, z] = w.freeSpot(p.x - 14, p.z, 1); return { x, z }; })() }); e2.ai = null; e2.hostileToPlayer = true;
    window.__run(1.5); const first = w.autoTarget === e1;
    e1.hp = 0; e1.setState('ko'); window.__run(8, e2); return { first, second: w.autoTarget === e2, d2: e2.distTo(p), st: w.autoStatus };
  });
  check(R, 'AUTO: targets nearest, re-targets when the target is defeated', C.first && C.second && C.d2 < 3, JSON.stringify(C));
  // --- D: manual input overrides, AUTO resumes after release
  const D = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__clear(); w.setAuto(true);
    const [x, z] = w.freeSpot(p.x + 18, p.z, 1); const e = w.makeFighter({ gang: 'nora', x, z }); e.ai = null; e.hostileToPlayer = true;
    window.__run(0.5); const d0 = e.distTo(p);
    w.camYaw = Math.atan2(-(e.x - p.x), -(e.z - p.z)); // camera behind player looking at enemy
    G.input.bot = { moveX: 0, moveY: -1, sprint: false, block: false }; window.__run(1.2); const dMan = e.distTo(p); const stMan = w.autoStatus;
    G.input.bot = null; window.__run(0.3); const stHold = w.autoStatus; window.__run(3); const dAfter = e.distTo(p);
    return { d0, dMan, stMan, stHold, dAfter, st: w.autoStatus };
  });
  check(R, 'AUTO: player movement input takes over (moves away while held)', D.dMan > D.d0 + 1.5 && D.stMan === 'manual', JSON.stringify(D));
  check(R, 'AUTO: resumes ~0.5 s after input stops', D.dAfter < D.dMan - 4, `dist ${D.dMan.toFixed(1)} -> ${D.dAfter.toFixed(1)}`);
  // --- E: dialogue pauses AUTO
  const E = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__clear(); G.debug.skipDialogue(); w.quests.active = []; w.setAuto(true);
    let x = p.x + 15, z = p.z; for (let k = 0; k < 32; k++) { const a = k * 0.7, r = 12 + (k % 4) * 2; const cx = p.x + Math.cos(a) * r, cz = p.z + Math.sin(a) * r; if (w.nav.clear(p.x, p.z, cx, cz, 0) && !w.col.solidAt(cx, cz, 0.6, 0)) { x = cx; z = cz; break; } }
    const e = w.makeFighter({ gang: 'nora', x, z }); e.ai = null; e.hostileToPlayer = true;
    w.say([{ s: 'kenta', t: { th: 'ทดสอบ', en: 'test' } }, { s: 'haru', t: { th: '...', en: '...' } }]);
    const x0 = p.x, z0 = p.z; window.__run(2); const moved = Math.hypot(p.x - x0, p.z - z0); const st = w.autoStatus;
    let n = 0; while (w.dialogue && n++ < 20) { G.debug.skipDialogue(); window.__run(0.1); } window.__run(2); const moved2 = Math.hypot(p.x - x0, p.z - z0);
    return { moved, st, moved2, d0: Math.hypot(x - x0, z - z0), st2: w.autoStatus, dlg: !!w.dialogue, skips: n, ps: p.state };
  });
  check(R, 'AUTO: pauses during dialogue, resumes after', E.moved < 0.05 && E.st === 'paused' && E.moved2 > 2, JSON.stringify(E));
  // --- F: ignores civilians and friendly gangs; toast when nothing to fight
  const F = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__clear(); w.setAuto(true); window.__au.noTarget = 0;
    const [x, z] = w.freeSpot(p.x + 5, p.z, 1); const fr = w.makeFighter({ gang: 'kurogane', x, z }); fr.hostileToPlayer = w.gangHostile('kurogane');
    const [x2, z2] = w.freeSpot(p.x - 5, p.z, 1); const cv = w.makeFighter({ gang: 'nora', x: x2, z: z2 }); cv.civilian = true; cv.team = 'civilian'; cv.ai = null; cv.hostileToPlayer = false;
    const x0 = p.x, z0 = p.z; window.__run(3);
    return { friendlyHostile: fr.hostileToPlayer, target: w.autoTarget ? w.autoTarget.name : null, moved: Math.hypot(p.x - x0, p.z - z0), toasts: window.__au.noTarget, st: w.autoStatus };
  });
  check(R, 'AUTO: never targets civilians / friendly gang members; shows "no enemies" toast', !F.friendlyHostile && F.target === null && F.moved < 0.5 && F.toasts >= 1 && F.st === 'none', JSON.stringify(F));
  // --- G: T key toggles AUTO
  await page.evaluate(() => window.__game.world.setAuto(false));
  await page.keyboard.press('KeyT'); await sleep(300); const t1 = (await state(page)).auto; await page.keyboard.press('KeyT'); await sleep(300); const t2 = (await state(page)).auto;
  check(R, 'AUTO: T key toggles on/off', t1 === true && t2 === false);
  const errs0 = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'AUTO sim tests: zero runtime errors', errs0.length === 0, errs0.slice(0, 3).join(' | '));
  await b.close();
  // --- H: mobile AUTO button (Pixel 7 portrait + landscape), with the new camera
  const b2 = await launch();
  for (const landscape of [false, true]) {
    const tag = landscape ? 'landscape' : 'portrait'; const d = devices['Pixel 7']; const vp = landscape ? { width: d.viewport.height, height: d.viewport.width } : d.viewport;
    const ctx = await b2.newContext({ ...d, viewport: vp, screen: landscape ? { width: d.screen.height, height: d.screen.width } : d.screen });
    const pg = await ctx.newPage(); const L = []; pg.on('console', m => { if (m.type() === 'error') L.push(m.text()); }); pg.on('pageerror', e => L.push(e.message));
    await pg.goto(BASE + '?test=1&newgame=1', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 60000 });
    await sleep(600); await dbg(pg, 'skipDialogue');
    await pg.evaluate(() => { const w = window.__game.world; w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3']) w.quests.done.add(id); w.quests.load(w.quests.serialize()); w.eventTimer = 1e9; w.spawnTimer = 1e9; w.camYaw = Math.PI * 0.85; });
    await dbg(pg, 'god', true); await dbg(pg, 'tp', 120, 0); await sleep(400);
    const vis = await pg.isVisible('[data-a="auto"]'); const box = await pg.locator('[data-a="auto"]').boundingBox();
    const overlap = await pg.evaluate(() => { const a = document.querySelector('[data-a="auto"]').getBoundingClientRect(); let o = []; document.querySelectorAll('#touch .tb').forEach(e => { if (e.dataset.a === 'auto') return; const r = e.getBoundingClientRect(); if (r.width && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top) o.push(e.dataset.a || e.dataset.hold); }); return o; });
    await pg.tap('[data-a="auto"]'); await sleep(400);
    const on = await pg.evaluate(() => ({ auto: window.__game.world.auto, txt: document.querySelector('[data-a="auto"] .st').textContent, lit: document.querySelector('[data-a="auto"]').classList.contains('lit') }));
    const p0 = await state(pg);
    await pg.evaluate(() => { const G = window.__game, w = G.world, p = w.player; for (let i = 0; i < 6; i++) { const [x, z] = w.freeSpot(p.x + 16 + (i % 3) * 1.5, p.z + (i - 2.5) * 1.6, 1); const f = w.makeFighter({ gang: 'raijin', x, z }); f.hostileToPlayer = true; f.aggro = false; } });
    await sleep(7000);
    const p1 = await state(pg); const cm = await dbg(pg, 'cam');
    const near = await pg.evaluate(() => { const w = window.__game.world, p = w.player; return Math.min(99, ...w.fighters.filter(f => !f.isPlayer && f.alive).map(f => Math.hypot(f.x - p.x, f.z - p.z))); });
    await shot(pg, `m10_mobile_auto_${tag}`);
    await pg.tap('[data-a="auto"]'); await sleep(300);
    const off = await pg.evaluate(() => ({ auto: window.__game.world.auto, txt: document.querySelector('[data-a="auto"] .st').textContent }));
    check(R, `mobile ${tag}: AUTO button visible, no overlap with action buttons`, vis && box && overlap.length === 0, `box ${JSON.stringify(box)} overlap ${overlap.join(',')}`);
    check(R, `mobile ${tag}: tapping AUTO toggles ON/OFF state (label + highlight)`, on.auto && on.txt === 'ON' && on.lit && !off.auto && off.txt === 'OFF', JSON.stringify({ on, off }));
    check(R, `mobile ${tag}: AUTO walks toward the enemy group`, (p1.x - p0.x) > 2.5 && near < 4.2, `moved ${(p1.x - p0.x).toFixed(1)} m toward the group (they also close in), nearest enemy ${near.toFixed(1)} m; cam dist ${cm.dist.toFixed(1)} (zoom ${cm.zoom}, portrait x1.22)`);
    check(R, `mobile ${tag}: zero console errors`, L.length === 0, L.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b2.close();
}
