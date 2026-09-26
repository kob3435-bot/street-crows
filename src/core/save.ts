/**
 * Versioned save system behind a SaveProvider interface.
 * LocalStorageSaveProvider is the v1 backend; a CloudSaveProvider can implement the
 * same async interface later (REST/Firebase/etc.) without touching game code.
 */
export const SAVE_VERSION = 2;
export interface SaveData {
  version: number; savedAt: number; playTime: number;
  player: { x: number; z: number; layer: number; yaw: number; hp: number; stamina: number; meter: number };
  prog: { level: number; exp: number; statPoints: number; skillPoints: number; stats: Record<string, number>; skills: string[]; rep: number; money: number; inventory: Record<string, number> };
  quests: { active: { id: string; step: number }[]; done: string[]; flags: string[]; tracked: string | null };
  bosses: string[]; relations: Record<string, number>; custom: Record<string, any>; time: number; stats?: Record<string, number>;
}
export interface SaveMeta { slot: string; savedAt: number; level: number; playTime: number; chapter: string }
export interface SaveProvider {
  readonly name: string;
  save(slot: string, data: SaveData): Promise<void>;
  load(slot: string): Promise<SaveData | null>;   // returns null if missing OR corrupt (never throws)
  list(): Promise<SaveMeta[]>;
  remove(slot: string): Promise<void>;
}

type Migration = (d: any) => any;
// v1 -> v2: v1 stored 'relationships' and had no 'time'; normalise.
const MIGRATIONS: Record<number, Migration> = {
  1: (d) => ({ ...d, version: 2, relations: d.relations || d.relationships || {}, time: d.time ?? 15.5, stats: d.stats || {} }),
};

export function migrate(raw: any): SaveData | null {
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') return null;
  let d = raw; let guard = 0;
  while (d.version < SAVE_VERSION && guard++ < 20) { const m = MIGRATIONS[d.version]; if (!m) return null; d = m(d); }
  if (d.version !== SAVE_VERSION) return null;
  return validate(d) ? d : null;
}
function isNum(v: any) { return typeof v === 'number' && isFinite(v); }
export function validate(d: any): d is SaveData {
  try {
    if (!d.player || !isNum(d.player.x) || !isNum(d.player.z)) return false;
    if (!d.prog || !isNum(d.prog.level) || !isNum(d.prog.exp) || !Array.isArray(d.prog.skills) || typeof d.prog.stats !== 'object') return false;
    if (!d.quests || !Array.isArray(d.quests.active) || !Array.isArray(d.quests.done)) return false;
    if (!Array.isArray(d.bosses) || typeof d.relations !== 'object') return false;
    return true;
  } catch { return false; }
}

const PREFIX = 'streetcrows.save.';
export class LocalStorageSaveProvider implements SaveProvider {
  readonly name = 'localStorage';
  corruptSlots: string[] = [];
  async save(slot: string, data: SaveData) {
    const json = JSON.stringify(data);
    localStorage.setItem(PREFIX + slot, json);
  }
  async load(slot: string): Promise<SaveData | null> {
    let raw: string | null = null;
    try { raw = localStorage.getItem(PREFIX + slot); } catch { return null; }
    if (!raw) return null;
    try {
      const d = migrate(JSON.parse(raw));
      if (!d) throw new Error('invalid save');
      return d;
    } catch (e) {
      // Corrupt save: back it up and report, never crash.
      console.warn('[save] corrupt slot', slot, e);
      try { localStorage.setItem(PREFIX + 'corrupt.' + slot, raw); } catch {}
      if (!this.corruptSlots.includes(slot)) this.corruptSlots.push(slot);
      return null;
    }
  }
  async list(): Promise<SaveMeta[]> {
    const out: SaveMeta[] = [];
    for (const slot of ['auto', '1', '2', '3']) {
      try {
        const raw = localStorage.getItem(PREFIX + slot); if (!raw) continue;
        const d = migrate(JSON.parse(raw)); if (!d) continue;
        const ch = d.quests.done.includes('main3') ? 'END' : d.quests.done.includes('main2') ? 'Ch.3' : d.quests.done.includes('main1') ? 'Ch.2' : d.quests.done.includes('tutorial') ? 'Ch.1' : 'Prologue';
        out.push({ slot, savedAt: d.savedAt, level: d.prog.level, playTime: d.playTime, chapter: ch });
      } catch {}
    }
    return out;
  }
  async remove(slot: string) { localStorage.removeItem(PREFIX + slot); }
}
