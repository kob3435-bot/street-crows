import type { AIParams, Appearance, LText } from './types';
const T = (th: string, en: string): LText => ({ th, en });
/**
 * Enemy variants: every gang member rolls one of these roles. They change AI params, moveset,
 * stats and silhouette so a 6-10 enemy group reads (and plays) like a squad, not clones.
 */
export interface Variant {
  id: string; name: LText; ai: Partial<AIParams>; moves: string[]; midMoves: string[];
  hp: number; atk: number; def: number; look: Partial<Appearance>; leader?: boolean;
}
export const VARIANTS: Record<string, Variant> = {
  brawler: { id: 'brawler', name: T('นักบู๊', 'Brawler'), ai: {}, moves: ['jab', 'jab2', 'kick', 'heavy'], midMoves: ['jab', 'jab2', 'uppercut', 'kick', 'kick2', 'heavy', 'hkick', 'grab'], hp: 1, atk: 1, def: 1, look: {} },
  rusher: { id: 'rusher', name: T('สายบุก', 'Rusher'), ai: { aggression: 0.75, speed: 1.22, patience: 1.4, comboMax: 3, blockRate: 0.06, reaction: 0.4 }, moves: ['jab', 'jab2', 'kick', 'flykick'], midMoves: ['jab', 'jab2', 'jab3', 'kick', 'kick2', 'flykick', 'uppercut'], hp: 0.82, atk: 0.95, def: 0.9, look: { build: 0.88 } },
  defender: { id: 'defender', name: T('สายการ์ด', 'Defender'), ai: { aggression: 0.35, blockRate: 0.55, counterRate: 0.35, guardStance: 0.35, patience: 4.2, speed: 0.85 }, moves: ['jab', 'heavy', 'kick'], midMoves: ['jab', 'jab2', 'heavy', 'kick', 'hkick'], hp: 1.3, atk: 0.95, def: 1.3, look: { build: 1.28, height: 1.04 } },
  grappler: { id: 'grappler', name: T('นักจับทุ่ม', 'Grappler'), ai: { grabRate: 0.5, aggression: 0.55, speed: 0.92 }, moves: ['jab', 'grab', 'heavy'], midMoves: ['jab', 'grab', 'heavy', 'headbutt', 'hkick'], hp: 1.2, atk: 1.05, def: 1.1, look: { build: 1.38, hair: 'buzz' } },
  kicker: { id: 'kicker', name: T('สายเตะ', 'Kicker'), ai: { range: 3.9, dodgeRate: 0.22, feint: 0.2 }, moves: ['kick', 'kick2', 'hkick'], midMoves: ['kick', 'kick2', 'roundhouse', 'hkick', 'flykick'], hp: 0.92, atk: 1.05, def: 0.95, look: { build: 0.92, height: 1.05 } },
  leader: { id: 'leader', name: T('หัวโจก', 'Leader'), ai: { aggression: 0.6, blockRate: 0.3, counterRate: 0.25, comboMax: 3 }, moves: ['jab', 'jab2', 'heavy', 'kick', 'grab'], midMoves: ['jab', 'jab2', 'uppercut', 'kick', 'kick2', 'heavy', 'hkick', 'grab'], hp: 1.6, atk: 1.1, def: 1.15, look: { accessory: 'chain', longCoat: true, build: 1.15 }, leader: true },
};
export const DEFAULT_VARIANT_WEIGHTS: Record<string, number> = { brawler: 4, rusher: 2, defender: 1.5, grappler: 1.5, kicker: 2 };
export function rollVariant(weights: Record<string, number> | undefined, rnd = Math.random): string {
  const w = weights || DEFAULT_VARIANT_WEIGHTS; let tot = 0; for (const k in w) tot += w[k]; let r = rnd() * tot;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'brawler';
}
/** Recommended enemy level per zone (grows with story progress, see World.areaLevel). */
export const ZONE_LEVEL: Record<string, number> = {
  shotengai: 1, mainroad: 2, kurogane: 2, residential_w: 2, alleys: 3, parking: 3, station: 3, riverside: 3, residential_c: 3,
  hakuryu: 4, park: 4, tetsuwan: 5, warehouse: 6, residential_n: 7, office_e: 8,
};
