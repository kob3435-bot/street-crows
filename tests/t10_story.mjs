// Full story chapters 1-10 + all side quests + tournament + secret boss, driven by the in-page bot through the real
// quest system (render=0 fast sim, no god mode). Every boss / mini-boss must spawn, hit phase 2 + final phase and be beaten.
import { launch, open, state, dbg, check } from './lib.mjs';
const ORDER = ['tutorial', 'main1', 'side_cat', 'side_ramen', 'side_mikami', 'side_yamikaze', 'side_ryo', 'main2', 'side_rumor', 'main3', 'side_kai',
  'main4', 'side_taisho', 'side_daigo', 'rematch_onoda', 'main5', 'side_scoop', 'side_tools', 'main6', 'side_granny2', 'side_todoroki',
  'main7', 'rematch_kirishima', 'rematch_goda', 'main8', 'main9', 'main10', 'tournament', 'secret_sakaki'];
const BOSSES = ['kirishima', 'goda', 'hayate', 'genzo', 'sakaki', 'akagi', 'todoroki', 'tenjo', 'kurozuki', 'shion'];
const MINIS = ['onoda', 'kuroki', 'tsukiyo', 'kanemura', 'taisho', 'baba', 'inazuma', 'ishigami', 'himuro', 'oboro'];
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
  await page.addScriptTag({ path: new URL('./driver.js', import.meta.url).pathname });
  await page.evaluate(() => { window.__ev = { down: 0, bossStart: [], bossPhase: [], bossDefeated: [], questComplete: [], maxGroup: 0 }; const bus = window.__game.bus;
    bus.on('playerDown', () => window.__ev.down++); bus.on('bossStart', e => window.__ev.bossStart.push(e.f.charId));
    bus.on('bossPhase', e => window.__ev.bossPhase.push(e.f.charId + ':' + e.phase)); bus.on('bossDefeated', e => window.__ev.bossDefeated.push(e.f.charId)); bus.on('questComplete', e => window.__ev.questComplete.push(e.q.id));
    bus.on('bossStart', () => {}); const w = window.__game.world; const orig = w.spawnEncounter.bind(w); w.spawnEncounter = (id, q) => { const st = orig(id, q); window.__ev.maxGroup = Math.max(window.__ev.maxGroup, st.fighters.length); return st; }; });
  await dbg(page, 'skipDialogue');
  const curve = []; const t0 = Date.now(); let downs0 = 0;
  for (const q of ORDER) {
    const r = await page.evaluate((q) => window.__driver.drive(q, {}), q);
    const s = await state(page); const ev = await page.evaluate(() => window.__ev);
    check(R, `story: quest completable by bot: ${q}`, r.ok, r.ok ? `Lv${s.level}, downs ${ev.down - downs0}, iters ${r.iters}` : JSON.stringify(r));
    downs0 = ev.down; if (q.startsWith('main')) curve.push(`${q}:Lv${s.level}`);
    if (!r.ok) { await page.evaluate((q) => window.__driver.drive(q, { fast: true, god: true }), q); await dbg(page, 'god', false); }
  }
  const ev = await page.evaluate(() => window.__ev); const fin = await state(page);
  const miss = (ids, f) => ids.filter(id => !f(id));
  const noStart = miss([...BOSSES, ...MINIS], id => ev.bossStart.includes(id));
  const noPh = miss([...BOSSES, ...MINIS], id => ev.bossPhase.includes(id + ':1') && ev.bossPhase.includes(id + ':2'));
  const noWin = miss([...BOSSES, ...MINIS], id => ev.bossDefeated.includes(id));
  check(R, `bosses: all ${BOSSES.length} bosses + ${MINIS.length} mini-bosses spawn (bossStart)`, noStart.length === 0, noStart.join(','));
  check(R, 'bosses: every boss/mini-boss goes through phase 2 and the final phase', noPh.length === 0, noPh.join(','));
  check(R, 'bosses: every boss/mini-boss is beaten (incl. secret boss Sakakibara)', noWin.length === 0, noWin.join(','));
  check(R, 'story: chapters 1-10 complete (main10 done), post-game tournament + secret done', ['main10', 'tournament', 'secret_sakaki'].every(x => fin.done.includes(x)), `${fin.done.length} quests done`);
  check(R, 'fights: big group encounters (>= 8 fighters) happen', ev.maxGroup >= 8, `largest encounter ${ev.maxGroup}`);
  const lv = curve.map(c => Number(c.split('Lv')[1]));
  check(R, 'balance: level curve rises steadily across the 10 chapters', lv.every((v, i) => i === 0 || v >= lv[i - 1]) && lv[lv.length - 1] >= 14 && lv[lv.length - 1] <= 30, curve.join(' '));
  console.log('    info: level curve', curve.join(' '), '| player downs', ev.down, '| sim run', ((Date.now() - t0) / 1000).toFixed(0) + 's wall');
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'story run: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
