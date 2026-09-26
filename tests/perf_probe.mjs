// Shared perf probe (same setup for the stored baseline and for t12): a gang territory after the tutorial, daytime,
// god mode, 10 s of warm-up so the street fills up, then rAF frame times (rendered) + world.step cost (render=0).
import { open, dbg, sleep } from './lib.mjs';
const SPOT = [-20, -130]; // residential_n (Raijin turf)
const setup = async (page) => {
  await dbg(page, 'skipDialogue');
  await page.evaluate(([x, z]) => { const G = window.__game, w = G.world; w.quests.active = []; w.quests.done.add('tutorial'); w.quests.load(w.quests.serialize()); for (let k = 0; k < 60; k++) { if (w.dialogue) G.debug.skipDialogue(); for (let i = 0; i < 10; i++) w.step(1 / 60, G.input); } w.eventTimer = 1e9; w.clock = 13; w.godMode = true; const [fx, fz] = w.freeSpot(x, z, 3); w.teleport(fx, fz, 0); }, SPOT);
};
export async function measurePerf(browser, { quality = 1, warm = 10000, sample = 6000 } = {}) {
  const { ctx, page } = await open(browser, `test=1&newgame=1&quality=${quality}`);
  await setup(page); await sleep(warm);
  const fr = await page.evaluate((ms) => new Promise(res => { const d = []; let last = performance.now(); const t0 = last; const f = (t) => { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); }), sample);
  const fighters = await page.evaluate(() => { const w = window.__game.world, p = w.player; return w.fighters.filter(f => !f.isPlayer && f.alive && !f.civilian && Math.hypot(f.x - p.x, f.z - p.z) < 80).length; });
  await ctx.close();
  const s = [...fr].sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)], p90 = s[Math.floor(s.length * 0.9)], mean = fr.reduce((a, b) => a + b, 0) / fr.length;
  // sim-only cost
  const r2 = await open(browser, 'test=1&newgame=1&render=0'); await setup(r2.page);
  const sim = await r2.page.evaluate(() => { const G = window.__game, w = G.world; const dlg = () => { if (w.dialogue) G.debug.skipDialogue(); }; for (let i = 0; i < 600; i++) { dlg(); w.step(1 / 60, G.input); } let dl = 0; const t0 = performance.now(); for (let i = 0; i < 600; i++) { if (w.dialogue) dl++; w.step(1 / 60, G.input); } const ms = (performance.now() - t0) / 600; const p = w.player; return { ms, dl, n: w.fighters.filter(f => !f.isPlayer && f.alive && !f.civilian && Math.hypot(f.x - p.x, f.z - p.z) < 80).length }; });
  await r2.ctx.close();
  return { quality, frameMed: +med.toFixed(2), frameP90: +p90.toFixed(2), frameMean: +mean.toFixed(2), frames: fr.length, fighters, simMs: +sim.ms.toFixed(3), simFighters: sim.n, simDialogueFrames: sim.dl };
}
