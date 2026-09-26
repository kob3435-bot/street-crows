// Round 12: AUTO long-range search (city-wide gang-site registry, cross-zone A*, re-targeting, unreachable / stuck /
// timeout handling, forced spawn, quest preference, HUD indicator) + higher enemy density with an active-fighter cap,
// attack-token limit and a perf sanity check against tests/perf_baseline.json (recorded on the pre-change build).
import { launch, open, dbg, check, shot, sleep } from './lib.mjs';
import { measurePerf } from './perf_probe.mjs';
import fs from 'fs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => {
    const G = window.__game, w = G.world;
    w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3']) w.quests.done.add(id); w.quests.load(w.quests.serialize());
    for (let k = 0; k < 80; k++) { if (w.dialogue) G.debug.skipDialogue(); for (let i = 0; i < 6; i++) w.step(1 / 60, G.input); }
    w.quests.active = []; w.quests.tracked = null; w.eventTimer = 1e9; w.spawnTimer = 1e7; // sites ON, random ambient spawns OFF (deterministic)
    window.__ev = { swings: 0, hits: 0, stuck: 0, giveUp: [], forced: 0, travel: [] };
    G.bus.on('swing', (e) => { if (e.f === w.player) window.__ev.swings++; }); G.bus.on('hit', (e) => { if (e.att === w.player) window.__ev.hits++; });
    G.bus.on('autoStuck', () => window.__ev.stuck++); G.bus.on('autoGiveUp', (e) => window.__ev.giveUp.push(e)); G.bus.on('autoForced', () => window.__ev.forced++); G.bus.on('autoTravel', (e) => window.__ev.travel.push(e));
    window.__reset = (except = []) => { for (const f of w.fighters) if (!f.isPlayer) { w.despawn(f); f.siteId = -1; } for (const s of w.sites) { s.members = []; s.spawned = false; s.respawnAt = except.includes(s) ? 0 : 1e12; s.gang = 'nora'; s.gangKey = w.friendlyGangs.size; } w.step(1 / 60, G.input); w.fighters = w.fighters.filter(f => f.isPlayer || f.alive); w.autoBan.clear(); window.__ev = { ...window.__ev, swings: 0, hits: 0, stuck: 0, giveUp: [], forced: 0, travel: [] }; };
    window.__run = (sec, stop) => { const r = { bad: new Set(), solid: 0, oob: 0, st: new Set(), zones: new Set(), maxFar: 0, t: 0 }; const p = w.player;
      for (let i = 0; i < Math.round(sec * 60); i++) { G.input.poll(); w.step(1 / 60, G.input); r.t += 1 / 60;
        if (['attack', 'block', 'dodge', 'grabbing'].includes(p.state)) r.bad.add(p.state); if (w.col.solidAt(p.x, p.z, 0.15, p.layer)) r.solid++; if (Math.abs(p.x) > 198 || Math.abs(p.z) > 198) r.oob++;
        r.st.add(w.autoStatus); r.zones.add(w.zoneAt(p.x, p.z).id); if (w.autoStatus === 'travel') r.maxFar = Math.max(r.maxFar, w.autoFarDist); if (stop && stop()) break; }
      return { ...r, bad: [...r.bad], st: [...r.st], zones: [...r.zones] }; };
  });

  // --- density: registry per territory, visible groups, cap, respawn
  const D = await page.evaluate(() => {
    const G = window.__game, w = G.world; const zones = {}; const out = { perZone: {}, roam: {}, minGroups: 99, minHostile: 99, maxActive: 0, cap: w.maxActive, sites: w.sites.length };
    for (const s of w.sites) { if (s.route) out.roam[s.zone] = (out.roam[s.zone] || 0) + 1; else zones[s.zone] = (zones[s.zone] || 0) + 1; }
    const terr = ['kurogane', 'hakuryu', 'residential_n', 'residential_w', 'alleys', 'shotengai', 'office_e', 'park', 'residential_c', 'parking', 'station', 'riverside', 'tetsuwan', 'warehouse'];
    for (const z of terr) {
      window.__reset(); for (const s of w.sites) { s.respawnAt = 0; s.gang = ''; s.gangKey = -1; }
      const s0 = w.sites.find(s => s.zone === z && !s.route); const [x, zz] = w.freeSpot(s0.x, s0.z, 2); w.teleport(x, zz, 0); G.debug.god(true);
      window.__run(5); const p = w.player;
      const near = w.fighters.filter(f => !f.isPlayer && f.alive && !f.civilian && Math.hypot(f.x - p.x, f.z - p.z) < 80);
      const groups = new Set(near.map(f => f.group)); const hostile = new Set(near.filter(f => f.hostileToPlayer).map(f => f.group));
      out.perZone[z] = { sites: zones[z] || 0, groups: groups.size, hostileGroups: hostile.size, fighters: near.length };
      out.minGroups = Math.min(out.minGroups, groups.size); out.minHostile = Math.min(out.minHostile, hostile.size);
    }
    // cap: stand in the densest spot for 20 s
    window.__reset(); for (const s of w.sites) s.respawnAt = 0; const s1 = w.sites.find(s => s.zone === 'residential_n'); w.teleport(s1.x, s1.z, 0);
    for (let k = 0; k < 20; k++) { window.__run(1); out.maxActive = Math.max(out.maxActive, w.activeCount()); }
    // respawn: wipe one group, check its timer, then that it comes back while the player is around
    const live = w.sites.find(s => s.spawned && s.members.some(f => f.alive)); let resp = null;
    if (live) { for (const s of w.sites) if (s !== live) { for (const f of s.members) { w.despawn(f); f.siteId = -1; } s.members = []; s.spawned = false; s.respawnAt = 1e12; } for (const f of live.members) { f.hp = 0; f.setState('ko'); } window.__run(1); const dt = live.respawnAt - w.time; const [fx, fz] = w.freeSpot(live.x + 30, live.z, 3); w.teleport(fx, fz, 0); window.__run(dt + 2); resp = { dt: +dt.toFixed(1), back: live.spawned }; }
    out.resp = resp; G.debug.god(false); return out;
  });
  const terrOk = Object.values(D.perZone).every(z => z.sites >= 3);
  check(R, 'density: every gang territory has ≥3 persistent group sites + roaming groups (main road ≥3, alleys/shotengai)', terrOk && (D.roam.mainroad || 0) >= 3 && (D.roam.alleys || 0) >= 1 && (D.roam.shotengai || 0) >= 1, `${D.sites} sites; ` + Object.entries(D.perZone).map(([k, v]) => `${k}:${v.sites}`).join(' ') + ` roam ${JSON.stringify(D.roam)}`);
  check(R, 'density: standing in any territory shows ≥3 groups (≥2 hostile) within 80 m', D.minGroups >= 3 && D.minHostile >= 2, Object.entries(D.perZone).map(([k, v]) => `${k}:${v.groups}g/${v.hostileGroups}h/${v.fighters}f`).join(' '));
  check(R, 'density: simultaneous street fighters stay within the active cap', D.maxActive <= D.cap && D.maxActive >= 12, `max ${D.maxActive} / cap ${D.cap}`);
  check(R, 'density: cleared group respawns fast (28–50 s) and comes back', D.resp && D.resp.dt >= 27 && D.resp.dt <= 51 && D.resp.back, JSON.stringify(D.resp));

  // --- attack-token limit still holds with lots of enemies
  const TK = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); w.spawnTimer = 1e9; G.debug.god(true);
    const ids = G.debug.spawn('nora', 12, 5); const es = w.fighters.filter(f => ids.includes(f.id)); for (const f of es) { f.tier = 'grunt'; w.aggroGroup(f, false); }
    let max = 0, engagedMax = 0; for (let i = 0; i < 600; i++) { G.input.poll(); w.step(1 / 60, G.input); max = Math.max(max, w.coord.count(p)); engagedMax = Math.max(engagedMax, w.engagedCount(p)); }
    G.debug.god(false); w.spawnTimer = 1e7; return { max, engagedMax };
  });
  check(R, 'fights: attack-token limit holds with 12 attackers (≤2 simultaneous)', TK.max <= 2 && TK.engagedMax >= 6, JSON.stringify(TK));

  // --- A: AUTO long-range: no enemy nearby -> walks to a group >150 m away in another zone, arrives in range, never attacks
  const A = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); G.debug.god(true);
    const [sx, sz] = w.freeSpot(-40, 50, 3); w.teleport(sx, sz, 0); const z0 = w.zoneAt(p.x, p.z).id;
    const T = w.sites.filter(s => !s.route && s.zone !== z0 && s.zone !== 'riverside').map(s => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) })).filter(o => o.d > 170 && o.d < 240).sort((a, b) => a.d - b.d)[0]?.s;
    if (!T) return { ok: false, why: 'no target site' };
    window.__reset([T]); const d0 = Math.hypot(T.x - p.x, T.z - p.z);
    const localHostile = w.fighters.some(f => w.autoValid(f) && f.distTo(p) < 70);
    w.setAuto(true); const r = window.__run(240, () => w.autoStatus === 'engage' && w.autoTarget && w.autoTarget.siteId === T.id);
    const tgt = w.autoTarget; const dEnd = tgt ? tgt.distTo(p) : 99; const firstFar = window.__ev.travel[0];
    const out = { ok: true, z0, zT: T.zone, d0: +d0.toFixed(0), firstFar, localHostile, arrived: w.autoStatus === 'engage' && tgt?.siteId === T.id, dEnd: +dEnd.toFixed(2), t: +r.t.toFixed(1), swings: window.__ev.swings, hits: window.__ev.hits, bad: r.bad, solid: r.solid, oob: r.oob, st: r.st, zones: r.zones, maxFar: +r.maxFar.toFixed(0), giveUp: window.__ev.giveUp };
    w.setAuto(false, true); G.debug.god(false); return out;
  });
  check(R, 'AUTO long-range: no enemy within radius -> travels to a group >150 m away in a different zone (status "travel")', A.ok && !A.localHostile && A.d0 > 150 && A.z0 !== A.zT && A.st.includes('travel') && A.maxFar > 150 && A.zones.length >= 2, JSON.stringify({ z0: A.z0, zT: A.zT, d0: A.d0, maxFar: A.maxFar, zones: A.zones, why: A.why }));
  check(R, 'AUTO long-range: arrives in attack range of that group (engage) via cross-zone A*, never in walls/water/off-map', A.ok && A.arrived && A.dEnd < 3.2 && A.solid === 0 && A.oob === 0, JSON.stringify({ arrived: A.arrived, dEnd: A.dEnd, t: A.t, solid: A.solid, oob: A.oob, giveUp: A.giveUp }));
  check(R, 'AUTO long-range: never attacked/blocked/dodged on the way or on arrival', A.ok && A.swings === 0 && A.hits === 0 && A.bad.length === 0, JSON.stringify({ swings: A.swings, hits: A.hits, bad: A.bad }));

  // --- B: switches to a closer group when one appears
  const B = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); G.debug.god(true);
    const [sx, sz] = w.freeSpot(-40, 50, 3); w.teleport(sx, sz, 0);
    const far = w.sites.filter(s => !s.route && Math.hypot(s.x - p.x, s.z - p.z) > 200).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    window.__reset([far]); w.setAuto(true); window.__run(3); const k1 = w.autoFar?.key;
    const near = w.sites.filter(s => !s.route && s !== far).map(s => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) })).filter(o => o.d > 85 && o.d < 130).sort((a, b) => a.d - b.d)[0]?.s;
    near.respawnAt = 0; window.__run(4); const k2 = w.autoFar?.key || (w.autoTarget ? 's:' + w.autoTarget.siteId : null);
    w.setAuto(false, true); G.debug.god(false); return { k1, farKey: 's:' + far.id, k2, nearKey: 's:' + near.id };
  });
  check(R, 'AUTO long-range: re-evaluates and switches to a closer group that appears', B.k1 === B.farKey && B.k2 === B.nearKey, JSON.stringify(B));

  // --- C: unreachable goal (inside a solid block) -> gives up, bans it, moves on
  const C = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); G.debug.god(true);
    const bd = w.city.buildings.find(b => b.x1 - b.x0 > 18 && b.z1 - b.z0 > 18 && w.col.insideSolid((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0));
    const fx = (bd.x0 + bd.x1) / 2, fz = (bd.z0 + bd.z1) / 2;
    const start = w.sites.filter(s => !s.route).map(s => ({ s, d: Math.hypot(s.x - fx, s.z - fz) })).filter(o => o.d > 95 && o.d < 150)[0].s; w.teleport(...w.freeSpot(start.x, start.z, 2), 0);
    const fake = { id: w.sites.length, zone: 'test', x: fx, z: fz, route: null, ri: 0, gang: 'nora', gangKey: w.friendlyGangs.size, respawnAt: 0, members: [], spawned: false, lastT: w.time }; w.sites.push(fake);
    const backup = w.sites.filter(s => s !== fake && s !== start).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).find(s => Math.hypot(s.x - p.x, s.z - p.z) > Math.hypot(fx - p.x, fz - p.z) + 5);
    w.setAuto(true); const k0 = (() => { window.__run(0.2); return w.autoFar?.key || null; })();
    window.__run(1); backup.respawnAt = 0; window.__run(4);
    const gu = window.__ev.giveUp.find(e => e.key === 's:' + fake.id); const banned = (w.autoBan.get('s:' + fake.id) || 0) > w.time; const k1 = w.autoFar?.key || (w.autoTarget ? 's:' + w.autoTarget.siteId : null); const st = w.autoStatus;
    w.setAuto(false, true); w.sites.pop(); G.debug.god(false);
    return { k0, fakeKey: 's:' + fake.id, why: gu?.why, banned, k1, st, backupKey: 's:' + backup.id };
  });
  check(R, 'AUTO long-range: unreachable goal -> gives up ("unreachable"), bans it and picks another group', C.why === 'unreachable' && C.banned && C.k1 && C.k1 !== C.fakeKey && ['travel', 'seek', 'engage'].includes(C.st), JSON.stringify(C));

  // --- D: stuck on geometry -> repath, then give up after 3 strikes; E: travel timeout
  const S = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); G.debug.god(true);
    const [sx, sz] = w.freeSpot(-40, 50, 3); w.teleport(sx, sz, 0);
    const T = w.sites.filter(s => !s.route).map(s => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) })).filter(o => o.d > 110).sort((a, b) => a.d - b.d)[0].s; window.__reset([T]);
    w.setAuto(true); window.__run(1.5); const key = w.autoFar?.key; const sp = p.speed; p.speed = 0; // pinned in place, like being wedged on a prop
    window.__run(6); const stuck = window.__ev.stuck; const gu = window.__ev.giveUp.find(e => e.why === 'stuck'); const banned = (w.autoBan.get(key) || 0) > w.time; p.speed = sp;
    // timeout
    window.__reset([T]); w.setAuto(true); window.__run(1); const key2 = w.autoFar?.key; if (w.autoFar) w.autoFar.t0 = w.time - 1e4; window.__run(0.2); const gu2 = window.__ev.giveUp.find(e => e.why === 'timeout');
    w.setAuto(false, true); G.debug.god(false); return { key, stuck, stuckGiveUp: gu?.key, banned, key2, timeout: gu2?.key };
  });
  check(R, 'AUTO stuck detection: no progress -> re-plans (autoStuck), 3 strikes -> gives up and bans that goal', S.key && S.stuck >= 2 && S.stuckGiveUp === S.key && S.banned, JSON.stringify(S));
  check(R, 'AUTO travel timeout: a goal that takes far too long is abandoned', S.key2 && S.timeout === S.key2, JSON.stringify(S));

  // --- F: nothing hostile anywhere -> wakes the nearest gang site so there is always something to find
  const F = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); w.setAuto(true); window.__run(2);
    const key = w.autoFar?.key || (w.autoTarget && w.autoTarget.siteId >= 0 ? 's:' + w.autoTarget.siteId : null); const s = key && w.sites[+key.slice(2)];
    const out = { forced: window.__ev.forced, st: w.autoStatus, key, ready: !!s && s.respawnAt <= w.time, hostile: !!s && w.gangHostile(s.gang), spawned: !!s && s.spawned }; w.setAuto(false, true); return out;
  });
  check(R, 'AUTO: when no hostiles exist at all, a nearby group is spawned and AUTO heads to it', F.forced >= 1 && ['travel', 'seek', 'engage'].includes(F.st) && F.ready && F.hostile, JSON.stringify(F));

  // --- G: quest fight is preferred over a closer random group
  const Q = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; window.__reset(); let pick = null;
    for (const id of ['main4', 'main5', 'main6', 'main7', 'main8', 'main9']) { const d = w.quests.def(id); const i = d.steps.findIndex(s => s.kind === 'defeat' || s.kind === 'boss'); if (i >= 0) { pick = { id, i }; break; } }
    w.quests.active = [{ id: pick.id, step: pick.i, begun: true, seen: true }]; w.quests.tracked = pick.id;
    const o = w.quests.objective(); const [x, z] = w.freeSpot(o.pos[0] + (o.pos[0] > 0 ? -120 : 120), o.pos[1], 4); w.teleport(x, z, 0);
    const closer = w.sites.filter(s => !s.route).map(s => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) })).filter(o2 => o2.d > 46 && o2.d < Math.hypot(o.pos[0] - p.x, o.pos[1] - p.z) - 15).sort((a, b) => a.d - b.d)[0]?.s; if (closer) closer.respawnAt = 0;
    const cs = w.autoFarCandidates(); w.quests.active = []; w.quests.tracked = null;
    return { quest: pick.id, first: cs[0]?.key, questDist: +Math.hypot(o.pos[0] - p.x, o.pos[1] - p.z).toFixed(0), closerSite: closer ? +Math.hypot(closer.x - p.x, closer.z - p.z).toFixed(0) : null };
  });
  check(R, 'AUTO long-range: prefers the tracked quest fight over a closer random group', Q.first && Q.first.startsWith('q:') && Q.closerSite !== null, JSON.stringify(Q));
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'density/AUTO sim tests: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();

  // --- HUD indicator (rendered, desktop + phone portrait) and screenshot
  const b2 = await launch();
  for (const mobile of [false, true]) {
    const { ctx, page: pg, logs: L } = await open(b2, 'test=1&newgame=1', { mobile });
    await dbg(pg, 'skipDialogue');
    await pg.evaluate(() => { const G = window.__game, w = G.world; w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3']) w.quests.done.add(id); w.quests.load(w.quests.serialize()); w.eventTimer = 1e9; w.clock = 15; w.godMode = true; });
    for (let k = 0; k < 10; k++) { await dbg(pg, 'skipDialogue'); await sleep(150); }
    await pg.evaluate(() => { const w = window.__game.world; w.quests.active = []; w.quests.tracked = null; w.spawnTimer = 1e7; const p = w.player; w.teleport(...w.freeSpot(-40, 50, 3), 0);
      for (const f of w.fighters) if (!f.isPlayer) { w.despawn(f); f.siteId = -1; } for (const s of w.sites) { s.members = []; s.spawned = false; s.respawnAt = 1e12; }
      const T = w.sites.filter(s => !s.route && Math.hypot(s.x - p.x, s.z - p.z) > 200)[0]; T.respawnAt = 0; T.gang = 'nora'; T.gangKey = w.friendlyGangs.size; w.setAuto(true, true); });
    await sleep(3500);
    const h = await pg.evaluate(() => { const e = document.querySelector('#h-auto'); const r = e.getBoundingClientRect(); return { txt: e.textContent, far: e.classList.contains('far'), vis: getComputedStyle(e).display !== 'none', fits: e.scrollWidth <= e.clientWidth + 1, r: [Math.round(r.left), Math.round(r.top), Math.round(r.width)], vw: innerWidth, st: window.__game.world.autoStatus }; });
    const name = mobile ? 'p05_auto_longrange_mobile' : 'p04_auto_longrange_indicator'; await shot(pg, name);
    check(R, `AUTO indicator (${mobile ? 'phone' : 'desktop'}): "AUTO: กำลังเดินหาศัตรู · NNNm ↗" with direction arrow, fully visible`, h.vis && h.far && /AUTO: (กำลังเดินหาศัตรู|searching for enemies) · \d+m [↑↗→↘↓↙←↖]/.test(h.txt) && h.fits && h.r[0] >= 0 && h.r[0] + h.r[2] <= h.vw, JSON.stringify(h) + ` screenshots/${name}.png`);
    check(R, `AUTO indicator (${mobile ? 'phone' : 'desktop'}) page: zero console errors`, L.length === 0, L.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b2.close();

  // --- perf sanity vs the stored pre-change baseline (same probe, same machine)
  const base = JSON.parse(fs.readFileSync(new URL('./perf_baseline.json', import.meta.url)));
  const b3 = await launch();
  for (const q of [1, 0]) {
    const now = await measurePerf(b3, { quality: q }); const was = base.runs.find(r => r.quality === q);
    const okF = now.frameMed <= was.frameMed * 1.35 + 4 && now.frameP90 <= was.frameP90 * 1.5 + 8; const okS = now.simMs <= was.simMs * 6 + 0.35;
    check(R, `perf quality=${q}: frame time not dramatically worse with ~${now.fighters} vs ${was.fighters} fighters nearby`, okF && okS && now.fighters > was.fighters, `now med ${now.frameMed} ms / p90 ${now.frameP90} ms / sim ${now.simMs} ms/step; before med ${was.frameMed} / p90 ${was.frameP90} / sim ${was.simMs}`);
  }
  await b3.close();
}
