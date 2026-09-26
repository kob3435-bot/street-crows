import type { LText } from './types';
const T = (th: string, en: string): LText => ({ th, en });
// Ambient NPC reactions indexed by reputation tier (0 Unknown .. 6 Legend)
export const CROWD_BARKS: LText[][] = [
  [T('วันนี้ร้อนจัง', 'Hot today...'), T('รถไฟจะมากี่โมงนะ', 'When is the next train?'), T('ราเมงร้านนั้นอร่อยนะ', 'That ramen place is good')],
  [T('นั่นเด็กย้ายมาใหม่ไม่ใช่เหรอ?', 'Isn\'t that the new transfer kid?'), T('ได้ยินว่าล้มโอนิงาวาระได้', 'Heard he beat some Onigawara guys')],
  [T('นั่นฮารุ! นักสู้ข้างถนน!', 'That\'s Haru! The street fighter!'), T('อย่าไปมองตาเขานะ', 'Don\'t look him in the eye'), T('เขาดูใจดีนะ...', 'He looks kinda nice...')],
  [T('เอซแห่งคุโรงาเนะ!', 'The Ace of Kurogane!'), T('ขอลายเซ็นได้ไหม!?', 'Can I get an autograph!?'), T('ว้าว ตัวจริง!', 'Whoa, the real deal!')],
  [T('คนที่ล้มฮาคุริวทั้งโรงเรียน...', 'The guy who beat all of Hakuryu...'), T('หลีกทางให้เขาเร็ว!', 'Make way for him!')],
  [T('ยอดฝีมือแห่งเมืองมาแล้ว', 'The city\'s elite is here'), T('ฮารุซัง! สวัสดีครับ!', 'Haru-san! Good day!')],
  [T('ตำนาน... เดินผ่านไปแล้ว', 'The legend... just walked by'), T('ฉันจะเล่าให้หลานฟัง', 'I\'m telling my grandkids about this')],
];
export const CHAT_BARKS: LText[] = [T('เมื่อวานดูไลฟ์ไหม?', 'Watch the stream last night?'), T('การบ้านเลขยากมาก', 'Math homework is brutal'), T('ไปคาราโอเกะกันป่ะ', 'Karaoke later?'), T('ได้ยินเรื่องหน้ากากที่โรงงานไหม', 'Heard about the mask at the factory?'), T('เบื่อจัง', 'So bored...')];
export const GANG_TAUNTS: LText[] = [T('เฮ้ย! มองอะไร!?', 'Hey! What are you looking at!?'), T('นี่ถิ่นพวกเรา!', 'This is our turf!'), T('จัดมัน!', 'Get him!'), T('หน้าใหม่ใจกล้านี่หว่า', 'Brave new face, huh')];
export const FRIENDLY_GREET: LText[] = [T('โบยะซัง! สวัสดีครับ!', 'Boya-san! Hello!'), T('พี่ฮารุ! มีอะไรให้ช่วยไหม', 'Haru-aniki! Need anything?'), T('ครับผม!', 'Yes sir!')];
export const NPC_CHATTER: Record<string, LText[]> = {
  kenta: [T('สมุดฉันมีข้อมูลทุกแก๊งเลยนะ ลองดูในเมนู "แฟ้มนักสู้"', 'My notebook has every gang. Check "Fighter Files" in the menu.'), T('ถ้าเหนื่อยก็ไปกินราเมงนะ ฟื้นพลังเต็ม!', 'Tired? Ramen fully heals you!'), T('ข่าวลือว่ามีคนแข็งแกร่งไปโผล่ตามถนนตลอด ระวังด้วยนะ', 'Strong fighters keep popping up on the streets. Be careful.')],
  saeko: [T('จะกินอีกแล้วเหรอ? ...นั่งสิ', 'Eating again? ...Sit down.'), T('ถ้าพวกโอนิงาวาระมาอีก ฉันจะฟาดด้วยทัพพี!', 'If Onigawara shows up again, I\'ll use the ladle!')],
  genzo: [T('ปลาไม่กินเบ็ดวันนี้... เหมือนนายที่ไม่กินตำแหน่ง', 'Fish aren\'t biting today... like you and that throne.'), T('ความแข็งแกร่งจริงๆ คือตอนที่มีคนอยากเดินตามโดยไม่ต้องสั่ง', 'Real strength is when people follow without being told.'), T('ลองฝึกหลบให้จังหวะพอดีดูสิ โลกจะช้าลง', 'Time your dodges right, and the world slows down.')],
  mikami: [T('มาซ้อมกันอีกไหม!', 'Another round?'), T('ฟุตเวิร์คคือทุกอย่าง', 'Footwork is everything.')],
  nakagawa: [T('ฉันจัดอันดับนายไว้สูงมากเลยนะ!', 'I ranked you really high!'), T('ขอถ่ายรูปหน่อย!', 'One photo please!')],
  minoru: [T('พี่ชายผมดีขึ้นแล้ว ขอบคุณครับ', 'My brother is doing better. Thank you.')],
  daigo: [T('...ลมดีนะวันนี้', '...Good wind today.'), T('ถ้ามีใครรังแกเด็ก บอกฉัน', 'If anyone bullies kids, tell me.')],
  granny: [T('ขอบใจนะหนู โมจิสบายดี', 'Thank you dear, Mochi is doing well.'), T('หนุ่มสมัยนี้ตัวโตจริงๆ', 'Young men are so big these days.')],
};
