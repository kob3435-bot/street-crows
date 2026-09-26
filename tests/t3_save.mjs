// Save/load: manual slot save via menu UI, reload page, Continue restores state; corrupt save doesn't crash; v1 migration.
import { launch, open, state, dbg, sleep, check, shot, BASE } from './lib.mjs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1');
  await page.addScriptTag({ path: new URL('./driver.js', import.meta.url).pathname });
  await dbg(page, 'skipDialogue');
  await page.evaluate(() => window.__driver.drive('tutorial', {}));
  await page.evaluate(() => { const G = window.__game, w = G.world; w.progress.addExp(300); w.progress.learn('iron_fist') || (w.progress.skillPoints++, w.progress.learn('iron_fist')); w.addRel('kenta', 7); w.custom = { ...w.custom, hair: 'mohawk', title: 'TEST' }; w.player.appearance = w.custom; w.quests.start('side_cat'); w.setClock(19.25); });
  await dbg(page, 'teleport', 'park'); await dbg(page, 'step', 0.5);
  const want = await page.evaluate(() => { const w = window.__game.world; return { level: w.progress.level, exp: w.progress.exp, skills: [...w.progress.skills].sort(), done: [...w.quests.done].sort(), active: w.quests.active.map(a => a.id).sort(), rel: w.relations.kenta, hair: w.custom.hair, money: w.progress.money, x: Math.round(w.player.x), z: Math.round(w.player.z), clock: Math.round(w.clock) }; });
  await page.keyboard.press('Tab'); await sleep(200); await page.click('[data-t="save"]'); await sleep(300);
  await page.click('[data-save="1"]'); await sleep(400);
  const raw = await page.evaluate(() => localStorage.getItem('streetcrows.save.1'));
  check(R, 'save: manual save to slot 1 via menu', !!raw && JSON.parse(raw).version === 2);
  await page.evaluate(() => localStorage.removeItem('streetcrows.save.auto'));
  // reload fresh and continue from the title screen
  await page.goto(BASE + '?test=1'); await page.waitForFunction(() => window.__game && window.__game.ready);
  await sleep(500);
  check(R, 'load: Continue offered on title after reload', await page.isVisible('[data-m="continue"]'));
  await page.click('[data-m="continue"]'); await sleep(800);
  const got = await page.evaluate(() => { const w = window.__game.world; return { level: w.progress.level, exp: w.progress.exp, skills: [...w.progress.skills].sort(), done: [...w.quests.done].sort(), active: w.quests.active.map(a => a.id).sort(), rel: w.relations.kenta, hair: w.custom.hair, money: w.progress.money, x: Math.round(w.player.x), z: Math.round(w.player.z), clock: Math.round(w.clock) }; });
  const same = JSON.stringify(want) === JSON.stringify(got);
  check(R, 'load: level/EXP/skills/quests/relations/customization/position restored', same, same ? JSON.stringify(got) : `want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
  // autosave on key event
  await page.evaluate(() => { localStorage.removeItem('streetcrows.save.auto'); window.__game.bus.emit('save', { reason: 'test' }); });
  await sleep(2500);
  check(R, 'autosave: written after key event (debounced)', !!(await page.evaluate(() => localStorage.getItem('streetcrows.save.auto'))));
  // corrupt saves
  await page.goto(BASE + '?test=1'); await page.waitForFunction(() => window.__game && window.__game.ready); // title page (not started: no unload-autosave)
  await page.evaluate(() => { localStorage.setItem('streetcrows.save.auto', '{"version":2,"player":{"x":"NaN"'); localStorage.setItem('streetcrows.save.1', 'garbage%%%'); localStorage.setItem('streetcrows.save.2', JSON.stringify({ version: 99 })); });
  const errBefore = logs.filter(l => l.startsWith('pageerror')).length;
  await page.goto(BASE + '?test=1'); await page.waitForFunction(() => window.__game && window.__game.ready); await sleep(500);
  const title = await page.isVisible('#title');
  const r = await page.evaluate(async () => { const s = window.__game.save; return [await s.load('auto'), await s.load('1'), await s.load('2')]; });
  check(R, 'corrupt save: game boots, loads return null, no crash', title && r.every(x => x === null) && logs.filter(l => l.startsWith('pageerror')).length === errBefore);
  check(R, 'corrupt save: raw data backed up', await page.evaluate(() => !!localStorage.getItem('streetcrows.save.corrupt.1')));
  await page.click('[data-m="new"]'); await sleep(500);
  check(R, 'corrupt save: new game still playable', (await state(page)).active.includes('tutorial:0'));
  // v1 -> v2 migration
  const mig = await page.evaluate(async () => { const v1 = JSON.parse(JSON.stringify(window.__game.world.serialize())); v1.version = 1; v1.relationships = { kenta: 42 }; delete v1.relations; delete v1.time; localStorage.setItem('streetcrows.save.3', JSON.stringify(v1)); const d = await window.__game.save.load('3'); return d && d.version === 2 && d.relations.kenta === 42 && typeof d.time === 'number'; });
  check(R, 'save schema: v1 save migrates to v2', mig);
  const errs = [...logs.filter(l => !l.includes('corrupt')), ...(await page.evaluate(() => window.__game.errors))].filter(l => !l.startsWith('console: [save]'));
  check(R, 'save tests: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
