// Core loop in fast sim mode (render=0, real game logic): fight & win vs grunts without god mode,
// EXP/level up, skill unlock through the menu UI, quest accept through the offer modal, all quests
// completed via the real quest system, mini-boss + 3 bosses defeated, boss phases, AI token system.
import { launch, open, state, dbg, check } from './lib.mjs';
export default async function (R) {
  const b = await launch();
  const { page, logs } = await open(b, 'test=1&newgame=1&render=0');
  await page.addScriptTag({ path: new URL('./driver.js', import.meta.url).pathname });
  await page.evaluate(() => { window.__ev = { down: 0, levelUp: 0, bossStart: [], bossPhase: [], bossDefeated: [], questComplete: [] }; const b = window.__game.bus;
    b.on('playerDown', () => window.__ev.down++); b.on('levelUp', () => window.__ev.levelUp++); b.on('bossStart', e => window.__ev.bossStart.push(e.f.charId));
    b.on('bossPhase', e => window.__ev.bossPhase.push(e.f.charId + ':' + e.phase)); b.on('bossDefeated', e => window.__ev.bossDefeated.push(e.f.charId)); b.on('questComplete', e => window.__ev.questComplete.push(e.q.id)); });
  await dbg(page, 'skipDialogue');
  // --- grunt fight, no god mode, "dumb" bot that does not spend points or use items
  const s0 = await state(page);
  await dbg(page, 'spawn', 'kurogane', 3, 6); await dbg(page, 'bot', true, false);
  let t = 0; for (; t < 120; t += 2) { await dbg(page, 'step', 2); const s = await state(page); if (s.fighters === 0 || s.hp <= 0) break; }
  const s1 = await state(page);
  check(R, 'combat: player beats 3 grunts (no god mode, no items)', s1.fighters === 0 && s1.hp > 0, `${t}s sim, HP left ${Math.round(s1.hp)}/${s1.maxHp}`);
  check(R, 'progression: EXP / money / rep gained from fights', (s1.exp > s0.exp || s1.level > s0.level) && s1.money > s0.money && s1.rep > s0.rep, `exp ${s1.exp} lvl ${s1.level} ¥${s1.money} rep ${s1.rep}`);
  await dbg(page, 'bot', false);
  // --- AI attack tokens: 6 grunts, at most 2 attacking at once
  await dbg(page, 'god', true);
  await dbg(page, 'spawn', 'hakuryu', 6, 5);
  const maxAtt = await page.evaluate(() => { const w = window.__game.world; let mx = 0, modes = {}; for (let i = 0; i < 60 * 20; i++) { window.__game.input.poll(); w.step(1 / 60, window.__game.input);
      const att = w.fighters.filter(f => !f.isPlayer && f.alive && f.ai && f.ai.target === w.player && f.state === 'attack' && f.move && f.move.family !== 'special').length; mx = Math.max(mx, att);
      for (const f of w.fighters) if (f.ai && f.alive && !f.isPlayer) modes[f.ai.mode] = (modes[f.ai.mode] || 0) + 1; } return { mx, modes }; });
  check(R, 'AI: attack-token system (<=2 simultaneous attackers of 6)', maxAtt.mx <= 2, `max ${maxAtt.mx}; mode mix ${JSON.stringify(maxAtt.modes)}`);
  check(R, 'AI: uses spacing/circling (not just walk-up-and-spam)', (maxAtt.modes.circle || 0) > 0 && ((maxAtt.modes.circle || 0) + (maxAtt.modes.recover || 0)) > (maxAtt.modes.attack || 0) * 0.3, JSON.stringify(maxAtt.modes));
  // habit tracking: spam punches -> punchSpam rises, AI blocks more
  const habit = await page.evaluate(() => { const G = window.__game, w = G.world; const h0 = w.habits.punch; for (let i = 0; i < 60 * 9; i++) { if (i % 12 === 0) G.input.press('punch'); G.input.poll(); w.step(1 / 60, G.input); } return { h0, h1: w.habits.punch, spam: w.habits.punchSpam }; });
  check(R, 'AI: tracks player habits (punch spam detected)', habit.spam && habit.h1 > habit.h0, `punch habit ${habit.h0.toFixed(1)} -> ${habit.h1.toFixed(1)}, punchSpam=${habit.spam}`);
  await dbg(page, 'killAll'); await dbg(page, 'step', 3); await dbg(page, 'god', false);
  // --- level up + skill unlock through the UI
  const lv0 = (await state(page)).level; await dbg(page, 'giveExp', 400); const lv1 = (await state(page)).level;
  check(R, 'progression: level up grants stat + skill points', lv1 > lv0 && (await state(page)).sp >= 1, `Lv${lv0} -> Lv${lv1}`);
  await page.evaluate(() => window.__game.menu.open('skills'));
  const before = (await state(page)).skills.length; await page.click('[data-sk]:not([disabled])'); const after = (await state(page)).skills.length;
  check(R, 'skills: unlocking a skill in the Skills tab works', after === before + 1, (await state(page)).skills.join(','));
  const modsChanged = await page.evaluate(() => { const m = window.__game.world.player.mods; return JSON.stringify(m) !== JSON.stringify({ ...m, dmg: 1, speed: 1, def: 1, maxHp: 0 }); });
  check(R, 'skills: learned skill changes player combat mods', modsChanged);
  await page.evaluate(() => window.__game.menu.close());
  // --- all quests via the real quest system (teleport = fast travel; fights by bot; NO god mode)
  const order = ['tutorial', 'main1', 'side_cat', 'side_ramen', 'side_mikami', 'side_yamikaze', 'main2', 'side_rumor', 'main3'];
  for (const q of order) {
    const r = await page.evaluate((q) => window.__driver.drive(q, {}), q);
    check(R, `quest completable: ${q}`, r.ok, r.ok ? '' : JSON.stringify(r));
  }
  const ev = await page.evaluate(() => window.__ev); const fin = await state(page);
  check(R, 'quests: offer modal accepted via UI (side quests started)', ev.questComplete.includes('side_cat') && ev.questComplete.includes('side_rumor'));
  check(R, 'bosses: mini-bosses spawned + defeated (Onoda, Kuroki, Tsukiyo)', ['onoda', 'kuroki', 'tsukiyo'].every(x => fin.bosses.includes(x)), fin.bosses.join(','));
  check(R, 'bosses: 3 bosses defeated (Kirishima, Goda, Hayate)', ['kirishima', 'goda', 'hayate'].every(x => fin.bosses.includes(x)));
  check(R, 'bosses: bossStart fired for every boss encounter', ['onoda', 'kirishima', 'goda', 'hayate'].every(x => ev.bossStart.includes(x)));
  check(R, 'bosses: 3-phase transitions happen (phase 2 & final)', ['kirishima', 'goda', 'hayate'].every(x => ev.bossPhase.includes(x + ':1') && ev.bossPhase.includes(x + ':2')), ev.bossPhase.join(','));
  check(R, 'story: chapter 1-3 finished, gangs turned friendly', fin.done.includes('main3') && (await page.evaluate(() => [...window.__game.world.friendlyGangs].length)) >= 4);
  console.log('    info: player downs during full run (bot, no god):', ev.down, '| final level', fin.level, '| rep', fin.rep);
  const errs = [...logs, ...(await page.evaluate(() => window.__game.errors))];
  check(R, 'core loop: zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
