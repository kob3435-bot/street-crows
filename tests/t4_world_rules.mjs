// World rules (sim level): map bounds, building/river collision, rooftop edge, no hits through walls, AI won't attack through walls.
import { launch, open, state, dbg, check } from './lib.mjs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => { const w = window.__game.world; w.quests.active = []; for (const id of ['tutorial', 'main1', 'main2', 'main3', 'side_cat', 'side_ramen', 'side_mikami', 'side_yamikaze', 'side_rumor']) w.quests.done.add(id); w.eventTimer = 1e9; });
  await dbg(page, 'step', 1);
  check(R, 'setup: no dialogue freezing the sim', !(await state(page)).dialogue);
  // push against each map edge for 8 s (sprinting)
  const edges = await page.evaluate(() => {
    const G = window.__game, w = G.world, out = [];
    for (const [x, z, yaw] of [[190, 0, -Math.PI / 2], [-190, 0, Math.PI / 2], [0, 190, Math.PI], [60, -190, 0]]) {
      w.teleport(x, z, 0); w.camYaw = yaw; G.input.bot = { moveX: 0, moveY: 1, sprint: true, block: false };
      let maxAbs = 0, minY = 0; for (let i = 0; i < 480; i++) { G.input.poll(); w.step(1 / 60, G.input); maxAbs = Math.max(maxAbs, Math.abs(w.player.x), Math.abs(w.player.z)); minY = Math.min(minY, w.player.y); }
      out.push({ start: [x, z], maxAbs: +maxAbs.toFixed(2), minY, x: +w.player.x.toFixed(1), z: +w.player.z.toFixed(1), nan: isNaN(w.player.x + w.player.z) });
    }
    G.input.bot = null; return out;
  });
  check(R, 'bounds: player cannot leave the map (4 edges, 8 s sprint each)', edges.every(e => e.maxAbs < 198 && !e.nan) && edges.every(e => Math.hypot(e.x - e.start[0], e.z - e.start[1]) < 30), JSON.stringify(edges.map(e => [e.maxAbs, e.x, e.z])));
  check(R, 'bounds: never falls through the ground (y >= 0)', edges.every(e => e.minY >= 0));
  // walk into buildings from many random spots: never end inside a solid
  const solid = await page.evaluate(() => {
    const G = window.__game, w = G.world; let inside = 0, tests = 0;
    for (let k = 0; k < 40; k++) { const [x, z] = w.freeSpot(-180 + Math.random() * 360, -180 + Math.random() * 360, 4); w.teleport(x, z, 0); w.camYaw = Math.random() * 6.28; G.input.bot = { moveX: 0, moveY: 1, sprint: true, block: false };
      for (let i = 0; i < 240; i++) { G.input.poll(); w.step(1 / 60, G.input); if (i % 20 === 0) { tests++; if (w.col.insideSolid(w.player.x, w.player.z, 0)) inside++; } } }
    G.input.bot = null; return { inside, tests };
  });
  check(R, 'collision: player never penetrates buildings/water (40 random sprints)', solid.inside === 0, `${solid.inside}/${solid.tests} samples inside solids`);
  // rooftop: walk off every roof edge -> stays on roof rect
  const roof = await page.evaluate(() => {
    const G = window.__game, w = G.world; w.teleport(-130, -172, 0); w.interact(); let ok = w.player.layer === 1; let out = 0;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { w.teleport(-147, -180, 1); w.camYaw = yaw; G.input.bot = { moveX: 0, moveY: 1, sprint: true, block: false };
      for (let i = 0; i < 600; i++) { G.input.poll(); w.step(1 / 60, G.input); const p = w.player; if (p.layer !== 1 || p.x < -188.01 || p.x > -105.99 || p.z < -190.01 || p.z > -169.99) out++; } }
    G.input.bot = null; return { ok, out };
  });
  check(R, 'rooftop: door takes you up; cannot walk off the roof', roof.ok && roof.out === 0, JSON.stringify(roof));
  // no hits through walls: find a wall, put enemy on the other side within reach, force attacks
  const wall = await page.evaluate(() => {
    const G = window.__game, w = G.world, p = w.player; w.teleport(136, 6, 0); G.debug.killAll(); G.input.bot = null;
    const boxes = w.col.boxes.filter(b => b.layer === 0 && b.h >= 1.2 && (b.x1 - b.x0) > 6 && (b.z1 - b.z0) > 0.1 && (b.z1 - b.z0) < 1.5);
    let res = null;
    for (const bx of boxes) {
      const cx = (bx.x0 + bx.x1) / 2; const zA = bx.z0 - 0.6, zB = bx.z1 + 0.6;
      if (w.col.insideSolid(cx, zA, 0) || w.col.insideSolid(cx, zB, 0)) continue;
      p.layer = 0; p.x = p.px = cx; p.z = p.pz = zA; p.setState('idle'); const rr = w.col.resolve(cx, zA, p.radius, 0); if (Math.abs(rr[1] - zA) > 0.05 || Math.abs(rr[0] - cx) > 0.05) continue; const rr2 = w.col.resolve(cx, zB, 0.5, 0); if (Math.abs(rr2[1] - zB) > 0.05) continue;
      const e = w.makeFighter({ gang: 'kurogane', x: cx, z: zB }); e.aggro = true; e.hostileToPlayer = true; if (Math.abs(e.z - zB) > 0.3) { w.despawn(e); continue; }
      const hp0 = p.hp; let tries = 0, hits = 0; const on = () => hits++; G.bus.on('hit', (ev) => { if (ev.tgt === p && ev.att === e) on(); });
      for (let i = 0; i < 60 * 10; i++) { if (e.state === 'idle' || e.state === 'move') { e.faceTo(p.x, p.z); e.startMove('jab'); tries++; } p.intentX = p.intentZ = 0; w.step(1 / 60, null); p.x = cx; p.z = zA; }
      // player swings at enemy through the wall too
      const ehp0 = e.hp; for (let i = 0; i < 60 * 3; i++) { if (p.state === 'idle' || p.state === 'move') { p.faceTo(e.x, e.z); p.startMove('jab'); } w.step(1 / 60, null); }
      const wallRes = { tries, hits, playerHpLost: +(hp0 - p.hp).toFixed(1), enemyHpLost: +(ehp0 - e.hp).toFixed(1) };
      // control: same enemy, same distance, but on the player's side of the wall -> hits must land
      e.x = e.px = cx + 1.3; e.z = e.pz = zA; e.hp = e.maxHp; e.setState('idle'); let ctrl = 0; G.bus.on('hit', (ev) => { if (ev.tgt === p && ev.att === e) ctrl++; });
      for (let i = 0; i < 60 * 4; i++) { if (e.state === 'idle' || e.state === 'move') { e.faceTo(p.x, p.z); e.startMove('jab'); } w.step(1 / 60, null); p.x = cx; p.z = zA; }
      res = { dist: +(zB - zA).toFixed(2), ...wallRes, controlHitsWithoutWall: ctrl }; break;
    }
    return res;
  });
  check(R, 'combat: no hits through walls (both directions)', wall && wall.tries > 3 && wall.hits === 0 && wall.playerHpLost <= 0 && wall.enemyHpLost === 0 && wall.controlHitsWithoutWall > 0, JSON.stringify(wall));
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'world rules: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
