import type { LText } from './types';
export type Branch = 'power' | 'speed' | 'technique' | 'toughness' | 'instinct';
export interface SkillDef { id: string; branch: Branch; tier: number; cost: number; requires: string[]; minLevel: number; name: LText; desc: LText }
const T = (th: string, en: string) => ({ th, en });
export const BRANCH_NAMES: Record<Branch, LText> = {
  power: T('พลัง', 'Power'), speed: T('ความเร็ว', 'Speed'), technique: T('เทคนิค', 'Technique'), toughness: T('ความอึด', 'Toughness'), instinct: T('สัญชาตญาณข้างถนน', 'Street Instinct'),
};
// Every skill is read by the combat/movement code through Progression.has(id).
export const SKILLS: SkillDef[] = [
  { id: 'iron_fist', branch: 'power', tier: 1, cost: 1, requires: [], minLevel: 1, name: T('หมัดเหล็ก', 'Iron Fist'), desc: T('ดาเมจหมัด +20%', 'Punch damage +20%') },
  { id: 'guard_crusher', branch: 'power', tier: 2, cost: 1, requires: ['iron_fist'], minLevel: 3, name: T('ทุบการ์ด', 'Guard Crusher'), desc: T('ท่าหนักทำลายการ์ด x2', 'Heavy attacks deal 2x guard damage') },
  { id: 'earthshaker', branch: 'power', tier: 3, cost: 2, requires: ['guard_crusher'], minLevel: 6, name: T('ธรณีสะเทือน', 'Earthshaker'), desc: T('เตะหนักสร้างคลื่นกระแทกล้มศัตรูรอบตัว', 'Heavy kick releases a shockwave that knocks down nearby enemies') },
  { id: 'haymaker', branch: 'power', tier: 4, cost: 2, requires: ['earthshaker'], minLevel: 9, name: T('หมัดปิดฉาก', 'Haymaker Finisher'), desc: T('ดาเมจท่าปิดฉาก +60%', 'Finisher damage +60%') },
  { id: 'quick_feet', branch: 'speed', tier: 1, cost: 1, requires: [], minLevel: 1, name: T('เท้าไว', 'Quick Feet'), desc: T('ความเร็วเคลื่อนที่ +12%', 'Move speed +12%') },
  { id: 'second_wind', branch: 'speed', tier: 2, cost: 1, requires: ['quick_feet'], minLevel: 3, name: T('ลมหายใจที่สอง', 'Second Wind'), desc: T('วิ่งเร็วใช้สตามิน่าน้อยลง 50%', 'Sprinting costs 50% less stamina') },
  { id: 'shadow_step', branch: 'speed', tier: 3, cost: 2, requires: ['second_wind'], minLevel: 5, name: T('ก้าวเงา', 'Shadow Step'), desc: T('หลบไกลขึ้น ช่วงอมตะนานขึ้น ใช้สตามิน่าน้อยลง', 'Longer dodge, longer i-frames, cheaper dodges') },
  { id: 'meteor_kick', branch: 'speed', tier: 4, cost: 2, requires: ['shadow_step'], minLevel: 8, name: T('เตะดาวตก', 'Meteor Kick'), desc: T('ลูกเตะลอยพุ่งไกลขึ้น ดาเมจ +50% ทะลุการ์ด', 'Flying kick travels farther, +50% damage, breaks guard') },
  { id: 'combo_flow', branch: 'technique', tier: 1, cost: 1, requires: [], minLevel: 1, name: T('คอมโบไหลลื่น', 'Combo Flow'), desc: T('ปลดล็อกหมัดที่ 3 (P-P-P) และช่วงต่อคอมโบกว้างขึ้น', 'Unlocks 3rd punch (P-P-P) and wider combo windows') },
  { id: 'grab_master', branch: 'technique', tier: 2, cost: 1, requires: ['combo_flow'], minLevel: 3, name: T('เจ้าแห่งการทุ่ม', 'Grab Master'), desc: T('ทุ่มใส่ศัตรูคนอื่นได้ ดาเมจทุ่ม +40%', 'Thrown enemies hit others, throw damage +40%') },
  { id: 'counter_art', branch: 'technique', tier: 3, cost: 2, requires: ['grab_master'], minLevel: 5, name: T('ศิลปะการสวน', 'Counter Art'), desc: T('ช่วงสวนกลับนานขึ้น ดาเมจสวน +50%', 'Longer counter window, counter damage +50%') },
  { id: 'meter_boost', branch: 'technique', tier: 4, cost: 2, requires: ['counter_art'], minLevel: 7, name: T('ใจเดือด', 'Burning Spirit'), desc: T('เกจพิเศษชาร์จเร็วขึ้น 40%', 'Special meter charges 40% faster') },
  { id: 'thick_skin', branch: 'toughness', tier: 1, cost: 1, requires: [], minLevel: 1, name: T('หนังหนา', 'Thick Skin'), desc: T('HP สูงสุด +25', 'Max HP +25') },
  { id: 'iron_guard', branch: 'toughness', tier: 2, cost: 1, requires: ['thick_skin'], minLevel: 3, name: T('การ์ดเหล็ก', 'Iron Guard'), desc: T('การ์ดรับดาเมจน้อยลง เกจการ์ด +50%', 'Blocking takes less damage, guard meter +50%') },
  { id: 'rebound', branch: 'toughness', tier: 3, cost: 2, requires: ['iron_guard'], minLevel: 5, name: T('ลุกไว', 'Rebound'), desc: T('ลุกจากพื้นเร็วขึ้น 50%', 'Get up 50% faster after knockdowns') },
  { id: 'last_stand', branch: 'toughness', tier: 4, cost: 2, requires: ['rebound'], minLevel: 8, name: T('ยืนหยัดสุดท้าย', 'Last Stand'), desc: T('HP ต่ำกว่า 30% ดาเมจ +30% และฟื้น HP ช้าๆ', 'Under 30% HP: +30% damage and slow regen') },
  { id: 'danger_sense', branch: 'instinct', tier: 1, cost: 1, requires: [], minLevel: 1, name: T('สัมผัสอันตราย', 'Danger Sense'), desc: T('ช่วงหลบเพอร์เฟกต์กว้างขึ้น สโลว์โมนานขึ้น', 'Wider perfect-dodge window, longer slow-mo') },
  { id: 'crowd_reader', branch: 'instinct', tier: 2, cost: 1, requires: ['danger_sense'], minLevel: 3, name: T('อ่านฝูงชน', 'Crowd Reader'), desc: T('เห็นสัญญาณเตือน "!" ก่อนศัตรูโจมตี', 'See a "!" warning before enemies attack') },
  { id: 'intimidate', branch: 'instinct', tier: 3, cost: 2, requires: ['crowd_reader'], minLevel: 5, name: T('ข่มขวัญ', 'Intimidation'), desc: T('ลูกกระจ๊อกอาจหนีเมื่อชื่อเสียงสูง ศัตรูลังเลมากขึ้น', 'Grunts may flee at high reputation; enemies hesitate more') },
  { id: 'aura', branch: 'instinct', tier: 4, cost: 2, requires: ['intimidate'], minLevel: 7, name: T('ออร่าผู้นำ(ที่ไม่อยากเป็น)', 'Reluctant Aura'), desc: T('EXP และชื่อเสียง +30%', 'EXP and Reputation +30%') },
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map(s => [s.id, s]));
