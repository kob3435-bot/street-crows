// Injected into the page: drives any quest to completion using the real quest logic
// (teleport = fast travel/bus; talk = real interact(); fights = in-page combat bot).
window.__driver = {
  log: [],
  stepSim(sec) { window.__game.debug.step(sec); },
  near(x, z, layer) { const w = window.__game.world; const [fx, fz] = w.freeSpot(x, z, 1.0, layer); w.teleport(fx, fz, layer); },
  targetLayer(s) {
    const w = window.__game.world;
    if (s.kind === 'goto') return window.__places[s.place].layer || 0;
    if (s.kind === 'talk' || s.kind === 'interact') return w.interactables().find(i => i.id === s.target)?.layer || 0;
    if (s.kind === 'defeat' || s.kind === 'boss') return window.__places[window.__encounters[s.enc].place].layer || 0;
    return w.player.layer;
  },
  drive(qid, opts = {}) {
    const G = window.__game, w = G.world, D = G.debug, q = w.quests; const L = this.log; let guard = 0, lastKey = '', same = 0;
    if (opts.god) D.god(true);
    while (guard++ < 600) {
      if (w.dialogue) { D.skipDialogue(); this.stepSim(0.2); continue; }
      const acc = document.querySelector('#modal.on #acc'); if (acc) { acc.click(); this.stepSim(0.2); continue; }
      if (document.querySelector('#modal.on')) G.menu.closeModal();
      if (q.done.has(qid)) { D.bot(false); return { ok: true, iters: guard }; }
      const a = q.active.find(x => x.id === qid);
      if (!a) {
        const def = q.def(qid); if (!def.giver) { this.stepSim(0.5); continue; }
        const it = w.interactables().find(i => i.id === def.giver); if (w.player.layer !== (it.layer || 0)) { const dr = w.interactables().find(i => i.kind === 'door' && (i.layer || 0) === w.player.layer); this.near(dr.pos[0], dr.pos[1], w.player.layer); this.stepSim(0.1); w.interact(); this.stepSim(0.2); continue; }
        this.near(it.pos[0] + 0.7, it.pos[1] + 0.7, it.layer || 0); this.stepSim(0.1); w.interact(); this.stepSim(0.2); continue;
      }
      const s = q.step(a); const key = qid + a.step; if (key === lastKey) same++; else { same = 0; lastKey = key; L.push(`${qid}#${a.step} ${s.kind}`); }
      if (same > 150) return { ok: false, stuck: { step: a.step, kind: s.kind, pl: [w.player.x, w.player.z, w.player.layer], hp: w.player.hp } };
      if ((s.night || (s.enc && window.__encounters[s.enc].night)) && !w.isNight) D.setTime(21);
      const tl = this.targetLayer(s);
      if (tl !== w.player.layer && ['goto', 'talk', 'interact', 'defeat', 'boss'].includes(s.kind) && !(w.encounters.get(s.enc))) {
        const dr = w.interactables().find(i => i.kind === 'door' && (i.layer || 0) === w.player.layer); this.near(dr.pos[0], dr.pos[1], w.player.layer); this.stepSim(0.1); w.interact(); this.stepSim(0.3); continue;
      }
      if (s.kind === 'goto') { const pl = window.__places[s.place]; this.near(pl.pos[0], pl.pos[1], tl); this.stepSim(0.3); continue; }
      if (s.kind === 'talk' || s.kind === 'interact') { const it = w.interactables().find(i => i.id === s.target); this.near(it.pos[0] + 0.7, it.pos[1] + 0.7, tl); this.stepSim(0.1); w.interact(); this.stepSim(0.3); continue; }
      if (s.kind === 'skill') { if (w.progress.skillPoints < 1) w.progress.skillPoints = 1; G.menu.open('skills'); const b = document.querySelector('[data-sk]:not([disabled])'); if (b) b.click(); G.menu.close(); this.stepSim(0.3); continue; }
      if (s.kind === 'defeat' || s.kind === 'boss') {
        const st = w.encounters.get(s.enc);
        if (!st) { const pl = window.__places[window.__encounters[s.enc].place]; this.near(pl.pos[0] + 6, pl.pos[1] + 6, tl); this.stepSim(0.5); continue; }
        D.bot(true, true); this.stepSim(2);
        if (opts.fast && same > 40) D.hurtAll(0.05);
        continue;
      }
      this.stepSim(0.5);
    }
    return { ok: false, reason: 'guard' };
  },
};
