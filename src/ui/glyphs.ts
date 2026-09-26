import { tx, getLang } from '../core/i18n';
/**
 * Device-aware control glyphs: every in-game prompt/hint names the control for the device the player is actually
 * using (keyboard+mouse, gamepad, or the on-screen touch buttons). Text tokens like {dodge} or {how_fight} in quest
 * objectives and dialogue are expanded with keysIn().
 */
export type Dev = 'kbm' | 'pad' | 'touch';
let dev: Dev = 'kbm'; const listeners: ((d: Dev) => void)[] = [];
export function getDev(): Dev { return dev; }
export function setDev(d: Dev) { if (d === dev) return; dev = d; for (const f of listeners) f(d); }
export function onDev(f: (d: Dev) => void) { listeners.push(f); }
type L = [string, string];
const KB: Record<string, L> = {
  punch: ['คลิกซ้าย', 'LMB'], heavy: ['คลิกขวา', 'RMB'], kick: ['F', 'F'], hkick: ['C', 'C'], dodge: ['Space', 'Space'], block: ['Q', 'Q'], grab: ['G', 'G'], special: ['R', 'R'],
  interact: ['E', 'E'], menu: ['Tab', 'Tab'], map: ['M', 'M'], auto: ['T', 'T'], move: ['WASD', 'WASD'], sprint: ['Shift', 'Shift'], zoom: ['ล้อเมาส์', 'Wheel'], help: ['H', 'H'], item: ['1·2·3', '1·2·3'], look: ['เมาส์', 'Mouse'], next: ['E / คลิก', 'E / click'],
};
const PAD: Record<string, L> = {
  punch: ['X', 'X'], heavy: ['Y', 'Y'], kick: ['B', 'B'], hkick: ['RT', 'RT'], dodge: ['A', 'A'], block: ['LB', 'LB'], grab: ['RB', 'RB'], special: ['R3', 'R3'],
  interact: ['D-pad →', 'D-pad →'], menu: ['View', 'View'], map: ['View', 'View'], auto: ['L3', 'L3'], move: ['สติ๊กซ้าย', 'L-stick'], sprint: ['LT', 'LT'], zoom: ['D-pad ↑↓', 'D-pad ↑↓'], help: ['View', 'View'], item: ['D-pad ←', 'D-pad ←'], look: ['สติ๊กขวา', 'R-stick'], next: ['A', 'A'],
};
const TOUCH: Record<string, L> = {
  punch: ['ต่อย', 'PUNCH'], heavy: ['หนัก', 'HVY'], kick: ['เตะ', 'KICK'], hkick: ['เตะหนัก', 'H.KICK'], dodge: ['หลบ', 'DODGE'], block: ['การ์ด', 'BLOCK'], grab: ['จับ', 'GRAB'], special: ['พิเศษ', 'SP'],
  interact: ['💬 คุย', '💬 TALK'], menu: ['☰', '☰'], map: ['☰', '☰'], auto: ['AUTO', 'AUTO'], move: ['จอยซ้าย', 'left stick'], sprint: ['ดันจอยสุด', 'push stick fully'], zoom: ['สองนิ้วถ่าง/หุบ', 'pinch'], help: ['☰', '☰'], item: ['🍙', '🍙'], look: ['ลากจอด้านขวา', 'drag right side'], next: ['แตะ', 'tap'],
};
const pick = (l: L) => getLang() === 'en' ? l[1] : l[0];
/** Plain label of the control for an action on the current device. */
export function K(a: string): string { const t = dev === 'pad' ? PAD : dev === 'touch' ? TOUCH : KB; return pick(t[a] || KB[a] || [a, a]); }
/** Styled key chip (keyboard key / gamepad button / on-screen button look). */
export function kbd(a: string): string { return `<kbd class="k-${dev}">${K(a)}</kbd>`; }
/** Whole-phrase instructions that read naturally per device. */
const PHRASES: Record<string, Record<Dev, L>> = {
  how_move: { kbm: ['WASD เดิน, Shift วิ่ง', 'WASD move, Shift sprint'], pad: ['สติ๊กซ้ายเดิน, LT วิ่ง', 'L-stick move, LT sprint'], touch: ['จอยซ้ายเดิน, ดันสุดเพื่อวิ่ง', 'left stick to move, push fully to sprint'] },
  how_fight: { kbm: ['คลิกซ้าย ต่อย / F เตะ', 'LMB punch / F kick'], pad: ['X ต่อย / B เตะ', 'X punch / B kick'], touch: ['ปุ่ม ต่อย / เตะ มุมขวาล่าง', 'PUNCH / KICK buttons, bottom right'] },
  how_skills: { kbm: ['กด Tab → สกิล', 'Press Tab → Skills'], pad: ['กด View → สกิล', 'Press View → Skills'], touch: ['แตะ ☰ → สกิล', 'Tap ☰ → Skills'] },
  how_interact: { kbm: ['กด E', 'press E'], pad: ['กด D-pad →', 'press D-pad →'], touch: ['แตะปุ่ม 💬 คุย', 'tap 💬 TALK'] },
};
/** Expand {action} (-> " (key)" on kb/pad, nothing on touch where the button carries the same word) and {how_*} phrases. */
export function keysIn(s: string): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (PHRASES[k]) return pick(PHRASES[k][dev]);
    if (KB[k]) return dev === 'touch' ? '' : ` (${K(k)})`;
    return m;
  });
}
export const T2 = (th: string, en: string) => tx({ th, en });
