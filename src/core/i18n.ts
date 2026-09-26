import type { Lang, LText } from '../data/types';
let lang: Lang = (localStorage.getItem('sc_lang') as Lang) || 'th';
export const getLang = () => lang;
export function setLang(l: Lang) { lang = l; try { localStorage.setItem('sc_lang', l); } catch {} }
export const tx = (t: LText | string | undefined): string => !t ? '' : typeof t === 'string' ? t : (t[lang] || t.en);
const S: Record<string, LText> = {
  newGame: { th: 'เริ่มเกมใหม่', en: 'New Game' }, cont: { th: 'เล่นต่อ', en: 'Continue' }, load: { th: 'โหลดเกม', en: 'Load' },
  menu: { th: 'เมนู', en: 'Menu' }, interactKey: { th: 'คุย/ใช้', en: 'Interact' },
  controls: { th: 'วิธีควบคุม', en: 'Controls' }, settings: { th: 'ตั้งค่า', en: 'Settings' }, back: { th: 'กลับ', en: 'Back' },
  quests: { th: 'ภารกิจ', en: 'Quests' }, status: { th: 'สถานะ', en: 'Status' }, skills: { th: 'สกิล', en: 'Skills' }, map: { th: 'แผนที่', en: 'Map' },
  style: { th: 'แต่งตัว', en: 'Style' }, relations: { th: 'ความสัมพันธ์', en: 'Relations' }, roster: { th: 'แฟ้มนักสู้', en: 'Fighter Files' }, save: { th: 'บันทึก', en: 'Save' },
  resume: { th: 'เล่นต่อ', en: 'Resume' }, level: { th: 'เลเวล', en: 'Lv' }, rep: { th: 'ชื่อเสียง', en: 'Rep' }, money: { th: 'เงิน', en: 'Money' },
  levelUp: { th: 'เลเวลอัป!', en: 'LEVEL UP!' }, questDone: { th: 'ภารกิจสำเร็จ!', en: 'QUEST COMPLETE!' }, newQuest: { th: 'ภารกิจใหม่', en: 'New Quest' },
  counter: { th: 'สวนกลับ!', en: 'COUNTER!' }, perfect: { th: 'หลบเพอร์เฟกต์!', en: 'PERFECT DODGE!' }, guardBreak: { th: 'การ์ดแตก!', en: 'GUARD BREAK!' }, finisher: { th: 'ปิดฉาก!', en: 'FINISHER!' },
  hits: { th: 'ฮิต', en: 'HITS' }, ko: { th: 'น็อก!', en: 'K.O.!' }, youLose: { th: 'แพ้... แต่ยังไม่จบ', en: 'Down... but not out' }, phase: { th: 'เฟส', en: 'Phase' },
  final: { th: 'สุดท้าย', en: 'FINAL' }, saved: { th: 'บันทึกเกมแล้ว', en: 'Game saved' }, loaded: { th: 'โหลดเกมแล้ว', en: 'Game loaded' },
  statPoints: { th: 'แต้มสเตตัส', en: 'Stat points' }, skillPoints: { th: 'แต้มสกิล', en: 'Skill points' }, learn: { th: 'เรียน', en: 'Learn' }, learned: { th: 'เรียนแล้ว', en: 'Learned' },
  locked: { th: 'ล็อก', en: 'Locked' }, active: { th: 'กำลังทำ', en: 'Active' }, available: { th: 'รับได้', en: 'Available' }, completed: { th: 'สำเร็จ', en: 'Completed' },
  quality: { th: 'คุณภาพกราฟิก', en: 'Graphics quality' }, language: { th: 'ภาษา', en: 'Language' }, volume: { th: 'เสียง', en: 'Volume' }, music: { th: 'เพลง', en: 'Music' },
  sens: { th: 'ความไวเมาส์', en: 'Mouse sensitivity' }, invertY: { th: 'กลับแกน Y', en: 'Invert Y' }, low: { th: 'ต่ำ', en: 'Low' }, med: { th: 'กลาง', en: 'Medium' }, high: { th: 'สูง', en: 'High' },
  saveSlot: { th: 'ช่องบันทึก', en: 'Slot' }, empty: { th: 'ว่าง', en: 'Empty' }, doSave: { th: 'บันทึก', en: 'Save' }, doLoad: { th: 'โหลด', en: 'Load' }, auto: { th: 'ออโต้', en: 'Auto' },
  accept: { th: 'รับภารกิจ', en: 'Accept' }, decline: { th: 'ไว้ก่อน', en: 'Later' }, buy: { th: 'ซื้อ', en: 'Buy' }, close: { th: 'ปิด', en: 'Close' },
  tapToStart: { th: 'คลิกเพื่อเริ่ม', en: 'Click to start' }, loading: { th: 'กำลังโหลดเมือง...', en: 'Loading the city...' }, day: { th: 'กลางวัน', en: 'Day' }, evening: { th: 'เย็น', en: 'Evening' }, night: { th: 'กลางคืน', en: 'Night' },
  territory: { th: 'อาณาเขตแก๊ง', en: 'Gang Territory' }, travel: { th: 'เดินทางด่วน', en: 'Fast Travel' }, rest: { th: 'พักจนถึง...', en: 'Rest until...' },
  morning: { th: 'เช้า', en: 'Morning' }, noon: { th: 'บ่าย', en: 'Afternoon' }, cancel: { th: 'ยกเลิก', en: 'Cancel' },
  hair: { th: 'ทรงผม', en: 'Hair' }, hairColor: { th: 'สีผม', en: 'Hair colour' }, jacket: { th: 'เสื้อแจ็กเก็ต', en: 'Jacket' }, shirt: { th: 'เสื้อใน', en: 'Shirt' }, pants: { th: 'กางเกง', en: 'Pants' }, shoes: { th: 'รองเท้า', en: 'Shoes' }, accessory: { th: 'เครื่องประดับ', en: 'Accessory' }, title: { th: 'ฉายา', en: 'Title' },
};
export const t = (k: string) => S[k] ? tx(S[k]) : k;
