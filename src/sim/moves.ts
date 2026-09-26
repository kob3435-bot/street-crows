export type Knock = 'light' | 'heavy' | 'launch' | 'down';
export interface MoveDef {
  id: string; anim: string; startup: number; active: number; recovery: number; dmg: number; range: number; arc: number; knock: Knock;
  guard: number; stun: number; lunge: number; stamina: number; meter: number; hitstop: number; shake: number;
  cancels?: Partial<Record<'P' | 'H' | 'K' | 'C', string>>; unblockable?: boolean; aoe?: number; hits?: number; armor?: boolean; invuln?: number;
  kind?: 'strike' | 'grab' | 'throw' | 'stance'; heavy?: boolean; homing?: boolean; rush?: boolean; slam?: boolean; impact?: boolean; push?: number; family: 'punch' | 'kick' | 'heavy' | 'grab' | 'special' | 'counter';
}
const M = (o: Partial<MoveDef> & { id: string }): MoveDef => ({ anim: o.id, startup: 0.1, active: 0.08, recovery: 0.2, dmg: 6, range: 1.5, arc: 0.9, knock: 'light', guard: 8, stun: 6, lunge: 2, stamina: 3, meter: 4, hitstop: 0.045, shake: 0.08, family: 'punch', kind: 'strike', ...o });
export const MOVES: Record<string, MoveDef> = {
  jab: M({ id: 'jab', cancels: { P: 'jab2', K: 'kick_c', C: 'hkick', H: 'heavy' } }),
  jab2: M({ id: 'jab2', anim: 'cross', startup: 0.08, recovery: 0.22, dmg: 7, cancels: { P: 'jab3', H: 'uppercut', K: 'kick_c', C: 'hkick' } }),
  jab3: M({ id: 'jab3', anim: 'hook', startup: 0.1, active: 0.08, recovery: 0.26, dmg: 9, knock: 'heavy', push: 3, stun: 9, cancels: { H: 'uppercut', K: 'kick_c' } }),
  uppercut: M({ id: 'uppercut', startup: 0.14, active: 0.1, recovery: 0.42, dmg: 16, range: 1.6, knock: 'launch', guard: 25, stun: 22, lunge: 3, stamina: 6, meter: 8, hitstop: 0.09, shake: 0.35, heavy: true, family: 'heavy' }),
  heavy: M({ id: 'heavy', startup: 0.3, active: 0.1, recovery: 0.42, dmg: 17, range: 1.7, knock: 'heavy', push: 7, guard: 38, stun: 20, lunge: 4, stamina: 8, meter: 8, hitstop: 0.085, shake: 0.3, heavy: true, family: 'heavy' }),
  kick: M({ id: 'kick', startup: 0.13, active: 0.08, recovery: 0.24, dmg: 8, range: 1.95, arc: 0.8, stamina: 4, cancels: { K: 'kick2', P: 'jab' }, family: 'kick' }),
  kick_c: M({ id: 'kick_c', anim: 'kick', startup: 0.12, active: 0.08, recovery: 0.24, dmg: 8, range: 1.95, arc: 0.8, stamina: 4, cancels: { K: 'roundhouse' }, family: 'kick' }),
  kick2: M({ id: 'kick2', startup: 0.12, active: 0.08, recovery: 0.3, dmg: 9, range: 1.95, knock: 'heavy', push: 3, stamina: 4, family: 'kick' }),
  roundhouse: M({ id: 'roundhouse', startup: 0.16, active: 0.1, recovery: 0.42, dmg: 16, range: 2.2, arc: 1.4, knock: 'heavy', push: 11, guard: 30, stun: 18, stamina: 7, meter: 8, hitstop: 0.09, shake: 0.3, heavy: true, family: 'kick' }),
  hkick: M({ id: 'hkick', startup: 0.3, active: 0.12, recovery: 0.45, dmg: 19, range: 2.3, arc: 1.7, knock: 'down', guard: 48, stun: 24, lunge: 2, stamina: 10, meter: 9, hitstop: 0.09, shake: 0.35, heavy: true, family: 'kick' }),
  flykick: M({ id: 'flykick', rush: true, startup: 0.12, active: 0.3, recovery: 0.38, dmg: 18, range: 1.7, arc: 1.0, knock: 'down', guard: 40, stun: 20, lunge: 13, stamina: 10, meter: 10, hitstop: 0.1, shake: 0.4, heavy: true, family: 'kick' }),
  headbutt: M({ id: 'headbutt', startup: 0.26, active: 0.1, recovery: 0.4, dmg: 16, range: 1.5, knock: 'heavy', push: 6, guard: 35, stun: 30, lunge: 4, hitstop: 0.09, shake: 0.3, heavy: true, family: 'heavy' }),
  grab: M({ id: 'grab', startup: 0.1, active: 0.12, recovery: 0.38, dmg: 0, range: 1.35, arc: 0.8, kind: 'grab', stamina: 5, lunge: 3, family: 'grab' }),
  throw: M({ id: 'throw', startup: 0.18, active: 0.08, recovery: 0.35, dmg: 20, range: 2, kind: 'throw', knock: 'down', hitstop: 0.08, shake: 0.4, meter: 10, stamina: 0, family: 'grab', heavy: true }),
  counter: M({ id: 'counter', startup: 0.05, active: 0.08, recovery: 0.3, dmg: 18, range: 2.1, arc: 1.2, knock: 'heavy', push: 8, guard: 40, stun: 30, lunge: 7, stamina: 0, meter: 12, hitstop: 0.11, shake: 0.35, heavy: true, family: 'counter' }),
  finisher: M({ id: 'finisher', startup: 0.24, active: 0.1, recovery: 0.55, dmg: 45, range: 2.3, arc: 1.3, knock: 'down', unblockable: true, guard: 0, stun: 0, lunge: 6, stamina: 0, meter: 0, hitstop: 0.18, shake: 0.6, heavy: true, impact: true, family: 'heavy' }),
  // ---- specials (meter) ----
  sp_typhoon: M({ id: 'sp_typhoon', anim: 'spin', startup: 0.25, active: 0.9, recovery: 0.4, dmg: 9, range: 3.0, arc: Math.PI, aoe: 3.0, hits: 5, knock: 'heavy', push: 4, guard: 30, stun: 15, lunge: 2, stamina: 0, meter: 0, hitstop: 0.06, shake: 0.3, armor: true, invuln: 0.35, impact: true, family: 'special', heavy: true }),
  sp_hammer: M({ id: 'sp_hammer', anim: 'charge', rush: true, startup: 0.65, active: 0.45, recovery: 0.55, dmg: 24, range: 1.7, knock: 'down', guard: 80, stun: 30, lunge: 11, armor: true, hitstop: 0.12, shake: 0.5, impact: true, family: 'special', heavy: true }),
  sp_mirror: M({ id: 'sp_mirror', anim: 'stance', startup: 0.05, active: 1.3, recovery: 0.35, dmg: 0, range: 0, kind: 'stance', family: 'special' }),
  sp_crane: M({ id: 'sp_crane', anim: 'slam', slam: true, startup: 0.85, active: 0.12, recovery: 0.7, dmg: 26, range: 4.2, arc: Math.PI, aoe: 4.2, knock: 'down', unblockable: true, armor: true, lunge: 3, hitstop: 0.14, shake: 0.7, impact: true, family: 'special', heavy: true }),
  sp_kamaitachi: M({ id: 'sp_kamaitachi', anim: 'dash', homing: true, rush: true, startup: 0.3, active: 1.0, recovery: 0.45, dmg: 10, range: 1.8, arc: 1.2, hits: 3, knock: 'heavy', push: 5, lunge: 15, guard: 30, hitstop: 0.06, shake: 0.25, family: 'special', heavy: true }),
  sp_nitro: M({ id: 'sp_nitro', anim: 'charge', rush: true, startup: 0.5, active: 0.8, recovery: 0.5, dmg: 22, range: 1.8, knock: 'down', guard: 60, lunge: 12, armor: true, hitstop: 0.12, shake: 0.5, impact: true, family: 'special', heavy: true }),
  sp_moon: M({ id: 'sp_moon', anim: 'spin', startup: 0.3, active: 0.8, recovery: 0.45, dmg: 8, range: 2.8, arc: Math.PI, aoe: 2.8, hits: 4, knock: 'heavy', push: 4, guard: 25, hitstop: 0.06, shake: 0.25, family: 'special', heavy: true }),
  sp_southpaw: M({ id: 'sp_southpaw', anim: 'rush', startup: 0.15, active: 0.9, recovery: 0.4, dmg: 6, range: 1.7, hits: 5, knock: 'light', guard: 14, lunge: 3, hitstop: 0.05, shake: 0.12, family: 'special' }),
  // ---- chapter 4-10 boss / mini-boss signatures ----
  sp_redoni: M({ id: 'sp_redoni', anim: 'charge', rush: true, startup: 0.5, active: 0.7, recovery: 0.55, dmg: 15, range: 1.7, hits: 2, knock: 'down', guard: 70, stun: 30, lunge: 9, armor: true, hitstop: 0.12, shake: 0.5, impact: true, family: 'special', heavy: true }),
  sp_wall: M({ id: 'sp_wall', anim: 'stance', startup: 0.05, active: 1.5, recovery: 0.4, dmg: 0, range: 0, kind: 'stance', family: 'special' }),
  sp_rebar: M({ id: 'sp_rebar', anim: 'slam', slam: true, startup: 0.7, active: 0.14, recovery: 0.65, dmg: 22, range: 3.4, arc: Math.PI, aoe: 3.4, knock: 'down', guard: 90, armor: true, lunge: 2, hitstop: 0.13, shake: 0.6, impact: true, family: 'special', heavy: true }),
  sp_flash: M({ id: 'sp_flash', anim: 'dash', homing: true, rush: true, startup: 0.22, active: 0.8, recovery: 0.45, dmg: 9, range: 1.8, arc: 1.2, hits: 3, knock: 'heavy', push: 5, lunge: 16, guard: 28, hitstop: 0.06, shake: 0.25, invuln: 0.2, family: 'special', heavy: true }),
  sp_bulldozer: M({ id: 'sp_bulldozer', anim: 'charge', rush: true, startup: 0.55, active: 0.9, recovery: 0.6, dmg: 25, range: 1.9, knock: 'down', guard: 90, lunge: 14, armor: true, hitstop: 0.13, shake: 0.6, impact: true, family: 'special', heavy: true }),
  sp_thunder: M({ id: 'sp_thunder', anim: 'slam', slam: true, startup: 0.8, active: 0.14, recovery: 0.7, dmg: 27, range: 5.2, arc: Math.PI, aoe: 5.2, knock: 'down', unblockable: true, armor: true, lunge: 2, hitstop: 0.15, shake: 0.8, impact: true, family: 'special', heavy: true }),
  sp_icicle: M({ id: 'sp_icicle', anim: 'spin', startup: 0.24, active: 0.7, recovery: 0.4, dmg: 8, range: 2.6, arc: Math.PI, aoe: 2.6, hits: 4, knock: 'heavy', push: 3, guard: 25, hitstop: 0.05, shake: 0.2, invuln: 0.3, family: 'special', heavy: true }),
  sp_takeover: M({ id: 'sp_takeover', anim: 'dash', homing: true, rush: true, startup: 0.3, active: 1.0, recovery: 0.5, dmg: 9, range: 1.9, arc: 1.3, hits: 4, knock: 'heavy', push: 5, lunge: 14, guard: 32, hitstop: 0.06, shake: 0.3, family: 'special', heavy: true }),
  sp_riverbed: M({ id: 'sp_riverbed', anim: 'slam', slam: true, startup: 0.55, active: 0.12, recovery: 0.6, dmg: 24, range: 3.8, arc: Math.PI, aoe: 3.8, knock: 'down', unblockable: true, armor: true, lunge: 2, hitstop: 0.14, shake: 0.65, impact: true, family: 'special', heavy: true }),
  sp_haze: M({ id: 'sp_haze', anim: 'dash', homing: true, rush: true, startup: 0.2, active: 0.7, recovery: 0.4, dmg: 11, range: 1.8, arc: 1.2, hits: 2, knock: 'heavy', push: 6, lunge: 17, guard: 30, invuln: 0.45, hitstop: 0.07, shake: 0.25, family: 'special', heavy: true }),
  sp_blackmoon: M({ id: 'sp_blackmoon', anim: 'charge', rush: true, startup: 0.6, active: 0.8, recovery: 0.65, dmg: 30, range: 1.9, knock: 'down', guard: 100, lunge: 12, armor: true, hitstop: 0.15, shake: 0.7, impact: true, family: 'special', heavy: true }),
  sp_eclipse: M({ id: 'sp_eclipse', anim: 'spin', startup: 0.3, active: 1.1, recovery: 0.45, dmg: 9, range: 3.4, arc: Math.PI, aoe: 3.4, hits: 6, knock: 'heavy', push: 5, guard: 35, armor: true, invuln: 0.4, hitstop: 0.06, shake: 0.35, impact: true, family: 'special', heavy: true }),
  sp_buddha: M({ id: 'sp_buddha', anim: 'charge', rush: true, startup: 0.45, active: 0.8, recovery: 0.5, dmg: 14, range: 1.9, hits: 3, knock: 'down', guard: 80, lunge: 8, armor: true, hitstop: 0.12, shake: 0.55, impact: true, family: 'special', heavy: true }),
  sp_megabowl: M({ id: 'sp_megabowl', anim: 'slam', slam: true, startup: 0.75, active: 0.12, recovery: 0.7, dmg: 24, range: 3.6, arc: Math.PI, aoe: 3.6, knock: 'down', unblockable: true, armor: true, lunge: 2, hitstop: 0.14, shake: 0.7, impact: true, family: 'special', heavy: true }),
  mirror_counter: M({ id: 'mirror_counter', anim: 'counter', startup: 0.03, active: 0.08, recovery: 0.35, dmg: 16, range: 2.4, arc: 1.4, knock: 'down', guard: 60, stun: 30, lunge: 6, hitstop: 0.14, shake: 0.45, impact: true, unblockable: true, family: 'counter', heavy: true }),
};
export const moveTotal = (m: MoveDef) => m.startup + m.active + m.recovery;
