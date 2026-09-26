import type { LText } from './types';
const T = (th: string, en: string): LText => ({ th, en });

export interface DLine { s: string; t: LText; choices?: { t: LText; rel?: Record<string, number>; rep?: number; flag?: string }[] }
export interface EncounterMember { char?: string; gang?: string; tier?: 'grunt' | 'mid'; count?: number; variant?: string; lvl?: number }
export interface Encounter { place: string; members: EncounterMember[]; radius?: number; night?: boolean }
export type Step =
  | { kind: 'goto'; place: string; radius?: number; obj: LText; say?: DLine[]; night?: boolean }
  | { kind: 'talk'; target: string; obj: LText; say?: DLine[] }
  | { kind: 'defeat'; enc: string; obj: LText; say?: DLine[]; after?: DLine[]; heal?: boolean }
  | { kind: 'boss'; enc: string; obj: LText; say?: DLine[]; after?: DLine[]; heal?: boolean }
  | { kind: 'interact'; target: string; obj: LText; say?: DLine[] }
  | { kind: 'skill'; obj: LText; say?: DLine[] }
  | { kind: 'say'; obj: LText; say: DLine[] };
export interface QuestDef {
  id: string; type: 'tutorial' | 'main' | 'gang' | 'duel' | 'help' | 'rumor'; chapter?: number;
  title: LText; desc: LText; requires: string[]; minLevel?: number; auto: boolean; giver?: string; steps: Step[];
  reward: { exp: number; money: number; rep: number; rel?: Record<string, number>; sp?: number };
}

export const ENCOUNTERS: Record<string, Encounter> = {
  tut_thugs: { place: 'shotengai', members: [{ gang: 'onigawara', count: 2, tier: 'grunt' }] },
  kuro_wave1: { place: 'kurogane_yard', members: [{ gang: 'kurogane', count: 3 }, { char: 'ryo' }] },
  kuro_boss: { place: 'kurogane_yard', members: [{ char: 'onoda' }] },
  haku_squad: { place: 'park', members: [{ gang: 'hakuryu', count: 3 }, { char: 'fuwa' }] },
  haku_boss: { place: 'hakuryu_yard', members: [{ char: 'kirishima' }] },
  tetsu_guard: { place: 'tetsuwan_yard', members: [{ gang: 'tetsuwan', count: 3 }, { char: 'bunta' }] },
  tetsu_boss: { place: 'tetsuwan_yard', members: [{ char: 'goda' }] },
  roof_kai: { place: 'kurogane_roof', members: [{ char: 'kai' }, { gang: 'kagero', count: 2 }] },
  roof_boss: { place: 'kurogane_roof', members: [{ char: 'hayate' }] },
  yami_gang: { place: 'parking', members: [{ gang: 'yamikaze', count: 4 }] },
  yami_boss: { place: 'parking', members: [{ char: 'kuroki' }] },
  duel_mikami: { place: 'station_gym', members: [{ char: 'mikami' }] },
  oni_racket: { place: 'shotengai', members: [{ char: 'ishida' }, { gang: 'onigawara', count: 2 }] },
  rumor_moon: { place: 'warehouse', members: [{ char: 'tsukiyo' }], night: true },
  wh_thugs: { place: 'warehouse', members: [{ gang: 'tekkotsu', count: 3 }, { gang: 'tekkotsu', tier: 'mid', variant: 'leader' }] },
  // ---- chapter 4-10 ----
  ch4_arcade: { place: 'shotengai', members: [{ gang: 'onigawara', count: 5 }, { gang: 'onigawara', tier: 'mid', variant: 'leader' }] },
  ch4_riders: { place: 'parking', members: [{ gang: 'yamikaze', count: 6, variant: 'rusher' }, { char: 'kuroki', lvl: 8 }] },
  ch4_baba: { place: 'alleys', members: [{ char: 'baba' }, { gang: 'onigawara', count: 2, variant: 'grappler' }] },
  ch4_akagi: { place: 'shotengai', members: [{ char: 'akagi' }] },
  ch5_yard: { place: 'warehouse', members: [{ gang: 'tekkotsu', count: 5 }, { gang: 'tekkotsu', tier: 'mid', variant: 'leader' }] },
  ch5_kanemura: { place: 'warehouse', members: [{ char: 'kanemura' }] },
  ch5_raijin: { place: 'north_res', members: [{ gang: 'raijin', count: 6 }, { gang: 'raijin', tier: 'mid', variant: 'leader' }] },
  ch5_inazuma: { place: 'north_res', members: [{ char: 'inazuma' }] },
  ch6_park: { place: 'park', members: [{ gang: 'raijin', count: 7 }, { gang: 'raijin', tier: 'mid', variant: 'leader' }, { gang: 'raijin', tier: 'mid', variant: 'grappler' }] },
  ch6_ishigami: { place: 'park', members: [{ char: 'ishigami' }] },
  ch6_todoroki: { place: 'north_res', members: [{ char: 'todoroki' }] },
  ch7_office: { place: 'office_plaza', members: [{ gang: 'shinsei', count: 7 }, { gang: 'shinsei', tier: 'mid', variant: 'leader' }] },
  ch7_himuro: { place: 'station_plaza', members: [{ char: 'himuro' }] },
  ch7_tenjo: { place: 'office_plaza', members: [{ char: 'tenjo' }, { gang: 'shinsei', count: 2, variant: 'defender' }] },
  ch8_masks: { place: 'underbridge', night: true, members: [{ gang: 'gekko', count: 6 }, { gang: 'gekko', tier: 'mid', variant: 'leader' }] },
  ch8_tsukiyo: { place: 'bridge', night: true, members: [{ char: 'tsukiyo', lvl: 13 }] },
  ch8_genzo: { place: 'underbridge', members: [{ char: 'genzo' }] },
  ch9_kuro: { place: 'kurogane_yard', night: true, members: [{ gang: 'gekko', count: 7 }, { gang: 'gekko', tier: 'mid', variant: 'leader' }] },
  ch9_oboro: { place: 'kurogane_yard', night: true, members: [{ char: 'oboro' }] },
  ch9_tetsu: { place: 'tetsuwan_yard', night: true, members: [{ gang: 'gekko', count: 5 }, { gang: 'gekko', tier: 'mid', variant: 'grappler' }] },
  ch9_kurozuki: { place: 'station_plaza', night: true, members: [{ char: 'kurozuki' }] },
  ch10_gate: { place: 'factory_yard', members: [{ gang: 'gekko', count: 8 }, { gang: 'gekko', tier: 'mid', variant: 'leader', count: 2 }] },
  ch10_inner: { place: 'factory_yard', members: [{ char: 'oboro', lvl: 19 }, { gang: 'gekko', count: 4, variant: 'defender' }] },
  ch10_shion: { place: 'factory_yard', members: [{ char: 'shion' }] },
  // ---- side content ----
  sq_ryo: { place: 'park', members: [{ gang: 'nora', count: 5 }, { gang: 'nora', tier: 'mid', variant: 'leader' }] },
  sq_kai: { place: 'alleys', members: [{ char: 'kai', lvl: 8 }] },
  sq_taisho: { place: 'ramen', members: [{ char: 'taisho' }] },
  sq_daigo: { place: 'kurogane_roof', members: [{ char: 'daigo', lvl: 9 }] },
  sq_scoop: { place: 'res_c', members: [{ gang: 'nora', count: 7 }, { gang: 'nora', tier: 'mid', variant: 'leader' }] },
  sq_tools: { place: 'south_bank', members: [{ gang: 'nora', count: 4, variant: 'grappler' }, { gang: 'nora', tier: 'mid', variant: 'leader' }] },
  sq_granny: { place: 'station_plaza', members: [{ gang: 'nora', count: 4, variant: 'rusher' }, { gang: 'nora', tier: 'mid' }] },
  sq_rogue: { place: 'kita_dori', members: [{ gang: 'raijin', count: 6 }, { gang: 'raijin', tier: 'mid', variant: 'leader' }] },
  rm_onoda: { place: 'kurogane_yard', members: [{ char: 'onoda', lvl: 10 }] },
  rm_kirishima: { place: 'hakuryu_yard', members: [{ char: 'kirishima', lvl: 15 }] },
  rm_goda: { place: 'tetsuwan_yard', members: [{ char: 'goda', lvl: 15 }] },
  tour_1: { place: 'arena', night: true, members: [{ char: 'kai', lvl: 19 }, { char: 'ishida', lvl: 19 }] },
  tour_2: { place: 'arena', night: true, members: [{ char: 'mikami', lvl: 20 }] },
  tour_3: { place: 'arena', night: true, members: [{ char: 'himuro', lvl: 20 }] },
  tour_4: { place: 'arena', night: true, members: [{ char: 'hayate', lvl: 20 }] },
  tour_5: { place: 'arena', night: true, members: [{ char: 'akagi', lvl: 21 }] },
  sc_sakaki: { place: 'kuro_night', night: true, members: [{ char: 'sakaki' }] },
};

/** Gangs that stop being hostile once a quest is finished (story reconciliation). */
export const FRIENDLY_AFTER: Record<string, string[]> = { main1: ['kurogane'], main2: ['hakuryu'], main3: ['tetsuwan', 'kagero'], side_yamikaze: ['yamikaze'], side_ramen: ['onigawara'], main4: ['onigawara', 'yamikaze'], main5: ['tekkotsu'], main6: ['raijin'], main7: ['shinsei'] };
export const MAIN_CHAIN = ['tutorial', 'main1', 'main2', 'main3', 'main4', 'main5', 'main6', 'main7', 'main8', 'main9', 'main10'];


export const QUESTS: QuestDef[] = [
  { id: 'tutorial', type: 'tutorial', title: T('วันแรกที่อาเคโบโนะ', 'First Day in Akebono'), desc: T('มาถึงเมืองใหม่ มีคนมารอรับ... มั้ง', 'New city. Someone is supposed to meet you... probably.'), requires: [], auto: true,
    steps: [
      { kind: 'say', obj: T('มาถึงสถานี', 'Arrive at the station'), say: [
        { s: 'narrator', t: T('เมืองอาเคโบโนะ — เมืองที่มีโรงเรียนนักเลงมากที่สุดในภูมิภาค', 'Akebono City. More delinquent schools per square kilometer than anywhere in the region.') },
        { s: 'kenta', t: T('อ๊ะ! นายคือนักเรียนย้ายมาใหม่ใช่ไหม? ฉันเคนตะ! ครูสั่งให้มารับ... เอ่อ ทำไมตัวนายใหญ่จัง', 'Ah! You\'re the transfer student, right? I\'m Kenta! Sensei told me to pick you up... uh, why are you so big?') },
        { s: 'haru', t: T('ฮารุ. ที่นี่มีร้านราเมงอร่อยๆ ไหม? หิวแล้ว', 'Haru. Is there good ramen around here? I\'m starving.') },
        { s: 'kenta', t: T('ร้านมารุอิจิที่ย่านการค้าฮิโนเดะ! เดี๋ยวพาไป... แต่ระวังพวกโอนิงาวาระนะ', 'Maruichi, in the Hinode shopping street! I\'ll take you... but watch out for the Onigawara guys.') },
      ] },
      { kind: 'goto', place: 'shotengai', obj: T('ไปย่านการค้าฮิโนเดะ (WASD เดิน, Shift วิ่ง)', 'Go to Hinode Shopping Street (WASD move, Shift sprint)') },
      { kind: 'defeat', enc: 'tut_thugs', obj: T('จัดการพวกรีดไถ (คลิกซ้าย ต่อย / F เตะ)', 'Deal with the extortionists (LMB punch / F kick)'), say: [
        { s: 'thug', t: T('เฮ้ย ไอ้หน้าใหม่! ใครเดินผ่านตรงนี้ต้องจ่ายค่าผ่านทาง!', 'Hey, new face! Anyone walking through here pays a toll!') },
        { s: 'haru', t: T('ค่าผ่านทาง? ฉันมีแค่เงินค่าราเมง... งั้นจ่ายเป็นอย่างอื่นละกัน', 'A toll? I only have ramen money... I\'ll pay you in something else.') },
      ], after: [{ s: 'kenta', t: T('ส-สุดยอด!! สองคนในสิบวินาที!', 'A-amazing!! Two guys in ten seconds!') }] },
      { kind: 'skill', obj: T('กด Tab → สกิล แล้วเรียนสกิลแรก', 'Press Tab → Skills and learn your first skill'), say: [{ s: 'kenta', t: T('นายน่าจะฝึกอะไรเพิ่มนะ ลองเปิดเมนู (Tab) ดูสิ', 'You should train a bit. Open the menu (Tab) and check your skills.') }] },
      { kind: 'goto', place: 'ramen', obj: T('ไปร้านราเมงมารุอิจิ', 'Go to Maruichi Ramen'), say: [
        { s: 'saeko', t: T('พวกโอนิงาวาระโดนจัดการแล้ว? ...นายเหรอ? ชามนี้ร้านเลี้ยง!', 'Somebody beat the Onigawara guys? ...You? This bowl\'s on the house!') },
        { s: 'haru', t: T('งั้นขอชามใหญ่พิเศษ สามชาม', 'Then one mega bowl. Make it three.') },
        { s: 'taisho', t: T('...(พยักหน้าช้าๆ อย่างพอใจ)', '...(nods slowly, satisfied)') },
        { s: 'kenta', t: T('พรุ่งนี้นายต้องไปโรงเรียนคุโรงาเนะนะ... ที่นั่นมีก๊กเป็นสิบ ไม่เคยมีใครรวมได้เลย', 'Tomorrow you start at Kurogane High... a dozen factions, and nobody has ever unified it.') },
        { s: 'haru', t: T('รวม? ไม่เอาหรอก เหนื่อย ขอแค่มีคนเก่งๆ ให้สู้ก็พอ', 'Unify? Nah, sounds tiring. I just want strong people to fight.') },
      ] },
    ], reward: { exp: 120, money: 1000, rep: 40, rel: { kenta: 15, saeko: 15 } } },

  { id: 'main1', type: 'main', chapter: 1, title: T('บทที่ 1: หน้าใหม่แห่งคุโรงาเนะ', 'Chapter 1: Kurogane\'s New Face'), desc: T('ทุกก๊กในคุโรงาเนะอยากรู้ว่าเด็กใหม่เก่งแค่ไหน', 'Every faction at Kurogane wants to know how strong the new kid is.'), requires: ['tutorial'], auto: true,
    steps: [
      { kind: 'goto', place: 'kurogane_yard', obj: T('ไปสนามโรงเรียนคุโรงาเนะ', 'Go to the Kurogane schoolyard'), say: [{ s: 'kenta', t: T('ข่าวลือเรื่องนายไปถึงคุโรงาเนะแล้ว... วันแรกก็มีคนรอต้อนรับเพียบ', 'Word about you already reached Kurogane... there\'s a welcome party waiting.') }] },
      { kind: 'defeat', enc: 'kuro_wave1', obj: T('ชนะ "งานต้อนรับ" ของรุ่นพี่', 'Survive the senpai "welcome party"'), say: [
        { s: 'ryo', t: T('ฉันคือทาจิบานะ เรียว! เบอร์หนึ่งของปีสอง! เด็กใหม่ต้องคุกเข่าก่อน!', 'I am Ryo Tachibana! Number one of the 2nd-years! New kids kneel first!') },
        { s: 'haru', t: T('เบอร์หนึ่ง? งั้นวันนี้ฉันเป็นเบอร์ศูนย์ละกัน', 'Number one? Then today I\'ll be number zero.') },
      ], after: [{ s: 'ryo', t: T('ม-เมื่อกี้ฉันแค่ออมมือ!! จำไว้นะ!', 'I-I was holding back!! Remember that!') }] },
      { kind: 'boss', enc: 'kuro_boss', obj: T('ดวลกับโอโนดะ "หัวค้อน"', 'Duel Sabuo "Hammerhead" Onoda'), say: [
        { s: 'onoda', t: T('เด็กใหม่ที่ล้มลูกน้องข้าไปห้าคนในวันแรก... ข้าโอโนดะ คนที่จะรวมคุโรงาเนะ!', 'The new kid who dropped five of my guys on day one... I\'m Onoda, the man who will unify Kurogane!') },
        { s: 'haru', t: T('โอ้ หัวแข็งดีนะ ลองดูกันหน่อย', 'Oh, nice hard head. Let\'s see it.') },
      ], after: [
        { s: 'onoda', t: T('ข้า...แพ้? ...ฮ่าๆ ! เอาเลย ตำแหน่งหัวหน้าคุโรงาเนะเป็นของแกแล้ว!', 'I... lost? ...Hah! Fine! The top of Kurogane is yours!') },
        { s: 'haru', t: T('ไม่เอา', 'Nope.'), choices: [
          { t: T('"ขี้เกียจสั่งคน ไปกินราเมงกันดีกว่า"', '"Too lazy to give orders. Let\'s get ramen instead."'), rel: { onoda: 15 }, rep: 20 },
          { t: T('"หัวนายแข็งดี ไว้มาสู้กันใหม่นะ"', '"Your head\'s solid. Let\'s fight again sometime."'), rel: { onoda: 25 } },
        ] },
        { s: 'onoda', t: T('...ไอ้บ้านี่ ไม่เหมือนใครจริงๆ', '...This idiot is like nobody else.') },
      ] },
      { kind: 'interact', target: 'door_roof', obj: T('ขึ้นไปดาดฟ้า (ประตูหน้าอาคารเรียน กด E)', 'Go up to the rooftop (school door, press E)'), say: [{ s: 'kenta', t: T('ว่าแต่... บนดาดฟ้ามีรุ่นพี่ตัวใหญ่ที่ไม่ยุ่งกับใครอยู่คนนึง', 'By the way... there\'s a huge senpai on the roof who keeps to himself.') }] },
      { kind: 'talk', target: 'npc_daigo', obj: T('คุยกับรุ่นพี่บนดาดฟ้า', 'Talk to the senpai on the rooftop'), say: [
        { s: 'daigo', t: T('...นายคือคนที่ล้มโอโนดะ แล้วยังปฏิเสธตำแหน่งอีก', '...You beat Onoda and turned down the throne.') },
        { s: 'haru', t: T('ตำแหน่งกินไม่ได้นี่ ลมบนนี้เย็นดีนะ', 'Can\'t eat a throne. Nice breeze up here.') },
        { s: 'daigo', t: T('...ฮึ ไดโกะ. ถ้ามีเรื่องให้ช่วยก็บอก', '...Heh. Daigo. If you ever need a hand, say so.') },
      ] },
    ], reward: { exp: 320, money: 2500, rep: 180, rel: { daigo: 25, onoda: 10 }, sp: 1 } },

  { id: 'main2', type: 'main', chapter: 2, title: T('บทที่ 2: มังกรขาวแห่งระเบียบ', 'Chapter 2: The White Dragon'), desc: T('ฮาคุริวจับตาดูเด็กใหม่ของคุโรงาเนะ', 'Hakuryu has its eye on Kurogane\'s new kid.'), requires: ['main1'], auto: true,
    steps: [
      { kind: 'goto', place: 'park', obj: T('ไปช่วยเคนตะที่สวนมิโดริ', 'Help Kenta at Midori Park'), say: [{ s: 'kenta', t: T('(โทรศัพท์) ฮารุ! พวกฮาคุริวแย่งสมุดของฉันไป! อยู่ที่สวนมิโดริ! ช่วยด้วย!', '(phone) Haru! Hakuryu took my notebook! Midori Park! Help!') }] },
      { kind: 'defeat', enc: 'haku_squad', obj: T('ชนะหน่วยฮาคุริว (ระวัง พวกนี้สู้เป็นทีม)', 'Beat the Hakuryu squad (careful: they fight as a team)'), say: [
        { s: 'fuwa', t: T('หน่วยที่สาม ตั้งแถว! เป้าหมายคือโบยะแห่งคุโรงาเนะ', 'Third unit, formation! Target: Boya of Kurogane.') },
        { s: 'haru', t: T('ตั้งแถวด้วย... เหมือนงานกีฬาสีเลย', 'A formation... like sports day.') },
      ], after: [{ s: 'fuwa', t: T('เป็นไปไม่ได้... ระเบียบของเรา... กัปตันรออยู่ที่ฮาคุริว', 'Impossible... our discipline... The captain awaits you at Hakuryu.') }] },
      { kind: 'goto', place: 'hakuryu_yard', obj: T('ไปลานฮาคุริว', 'Go to the Hakuryu courtyard') },
      { kind: 'boss', enc: 'haku_boss', obj: T('ดวลกับคิริชิมะ จิน "กระจกเงา"', 'Duel Jin "The Mirror" Kirishima'), say: [
        { s: 'kirishima', t: T('ข้าคิริชิมะ ขอโทษเรื่องลูกน้อง สมุดคืนให้แล้ว แต่ข้าอยากรู้ ว่าพลังไร้แบบแผนของเจ้าเป็นของจริงหรือเปล่า', 'I am Kirishima. My apologies for my men; the notebook is returned. But I must know if your formless power is real.') },
        { s: 'haru', t: T('พูดเพราะจัง งั้นมาเลย', 'So polite. Come on then.') },
        { s: 'narrator', t: T('เคล็ดลับ: คิริชิมะสวนกลับเก่ง — ลองจับทุ่ม (G) หรือท่าหนักทำลายการ์ด', 'Tip: Kirishima counters strikes. Try grabs (G) or heavy guard-breakers.') },
      ], after: [
        { s: 'kirishima', t: T('...นี่คือความรู้สึกของการแพ้ ข้าไม่เคยรู้ว่ามันทำให้ใจเต้นแรงขนาดนี้', '...So this is losing. I never knew it could make my heart race.') },
        { s: 'haru', t: T('ครั้งหน้าไม่ต้องตั้งแถวมานะ มาคนเดียวก็พอ สนุกกว่า', 'Next time skip the formation. Just come alone. It\'s more fun.'), choices: [
          { t: T('ยื่นมือจับมือ', 'Offer a handshake'), rel: { kirishima: 30 } },
          { t: T('"เลี้ยงราเมงด้วยนะ ฉันชนะ"', '"You\'re buying ramen. I won."'), rel: { kirishima: 15 }, rep: 30 },
        ] },
      ] },
    ], reward: { exp: 600, money: 4000, rep: 350, rel: { kirishima: 20, kenta: 10 }, sp: 1 } },

  { id: 'main3', type: 'main', chapter: 3, title: T('บทที่ 3: ลมกับเหล็ก', 'Chapter 3: Wind and Iron'), desc: T('นักเรียนทุกโรงเรียนถูกยักษ์จากเท็ตสึวันถล่ม มีใครบางคนอยู่เบื้องหลัง', 'Students from every school are being crushed by a giant from Tetsuwan. Someone is pulling strings.'), requires: ['main2'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_genzo', obj: T('ไปถามรุ่นพี่เก็นโซใต้สะพาน', 'Ask Genzo under the bridge'), say: [
        { s: 'kenta', t: T('นักเรียนโดนซัดเละทุกโรงเรียนเลย... ทุกคนบอกว่าเป็นยักษ์จากเท็ตสึวัน ลองถามรุ่นพี่เก็นโซดูไหม เขารู้ทุกเรื่องในเมือง', 'Students from every school got wrecked... all say it was a giant from Tetsuwan. Ask Genzo; he knows everything.') },
        { s: 'genzo', t: T('โกดะน่ะเหรอ? เด็กคนนั้นไม่ใช่คนแบบนั้น... ถ้าหมาดีๆ กัดคน ก็ต้องดูว่าใครถือสายจูง', 'Goda? That kid isn\'t the type... When a good dog bites, look at who holds the leash.') },
        { s: 'haru', t: T('พูดอะไรยากจัง งั้นไปถามเจ้าตัวเลยละกัน', 'That\'s deep. I\'ll just go ask him myself.') },
      ] },
      { kind: 'defeat', enc: 'tetsu_guard', obj: T('บุกลานเท็ตสึวัน (ข้ามสะพานไปฝั่งใต้)', 'Storm the Tetsuwan yard (cross the bridge south)'), say: [{ s: 'bunta', t: T('ไม่ให้ใครเข้าใกล้พี่โกดะทั้งนั้น!', 'Nobody gets near Goda-san!') }] },
      { kind: 'boss', enc: 'tetsu_boss', obj: T('ดวลกับโกดะ "เครนเหล็ก"', 'Duel Tetsuzo "Iron Crane" Goda'), say: [
        { s: 'goda', t: T('...กลับไปซะ ข้าไม่อยากทำร้ายคนเพิ่ม', '...Go home. I don\'t want to hurt anyone else.') },
        { s: 'haru', t: T('หมัดของนายดูเศร้าๆ นะ มาคุยกันด้วยหมัดดีกว่า', 'Your fists look sad. Let\'s talk with them.') },
        { s: 'narrator', t: T('เคล็ดลับ: โกดะช้าแต่หนัก หลบ (Space) แล้วสวนตอนเขาเหวี่ยงพลาด', 'Tip: Goda is slow but brutal. Dodge (Space) and punish his whiffs.') },
      ], after: [
        { s: 'goda', t: T('...พวกคาเงโรหลอกน้องข้าให้เป็นหนี้ ถ้าไม่ทำตามมันจะทำร้ายมิโนรุ', '...The Kagero crew tricked my brother into debt. If I refuse, they hurt Minoru.') },
        { s: 'haru', t: T('งั้นเรื่องง่าย ไปเตะคนถือสายจูงกัน', 'Then it\'s simple. Let\'s go kick the guy holding the leash.') },
      ] },
      { kind: 'talk', target: 'npc_minoru', obj: T('ไปหามิโนรุที่ริมแม่น้ำฝั่งใต้', 'Find Minoru on the south riverbank'), say: [
        { s: 'minoru', t: T('พี่ชายผม... ขอบคุณครับ ฮายาเตะส่งข้อความมา เขารอคุณอยู่บนดาดฟ้าคุโรงาเนะ', 'My brother... thank you. Hayate sent a message: he\'s waiting for you on the Kurogane rooftop.') },
        { s: 'haru', t: T('บ้านฉันเองเลยนะ ใจกล้าดี', 'On my own roof? Bold.') },
      ] },
      { kind: 'goto', place: 'kurogane_roof', obj: T('ขึ้นดาดฟ้าคุโรงาเนะ (ประตูหน้าอาคาร)', 'Go to the Kurogane rooftop (school door)') },
      { kind: 'defeat', enc: 'roof_kai', obj: T('ฝ่าพี่น้องคาเงโร', 'Get past the Kagero brothers'), say: [{ s: 'kai', t: T('พี่ไม่จำเป็นต้องลงมือ ฉันจัดการเอง!', 'My brother doesn\'t need to lift a finger. I\'ll handle this!') }], after: [{ s: 'kai', t: T('พี่... ขอโทษ...', 'Brother... I\'m sorry...') }] },
      { kind: 'boss', enc: 'roof_boss', obj: T('ดวลกับฮายาเตะ เร็น "คามาอิทาจิ"', 'Duel Ren "Kamaitachi" Hayate'), say: [
        { s: 'hayate', t: T('เมืองนี้ต้องมีราชาคนเดียว ฉันแค่เร่งให้มันเกิดเร็วขึ้น นายก็เห็นด้วยใช่ไหม ฮารุ?', 'This city needs one king. I just sped things up. You agree, right, Haru?') },
        { s: 'haru', t: T('ไม่ ราชามันน่าเบื่อ แล้วนายก็ทำให้น้องโกดะร้องไห้', 'No. Kings are boring. And you made Goda\'s little brother cry.') },
        { s: 'narrator', t: T('เคล็ดลับ: ฮายาเตะเร็วมาก ใช้การ์ด (Q) แล้วสวนกลับ หรือจับทุ่มเมื่อเขาเข้าใกล้', 'Tip: Hayate is very fast. Block (Q) then counter, or grab him when he closes in.') },
      ], after: [
        { s: 'hayate', t: T('ทำไม...คนที่ไม่อยากเป็นราชาถึงแข็งแกร่งที่สุด...', 'Why... is the one who doesn\'t want the crown the strongest...') },
        { s: 'narrator', t: T('ประตูดาดฟ้าเปิดออก โอโนดะ ไดโกะ คิริชิมะ และโกดะ ยืนอยู่ตรงนั้น', 'The rooftop door opens. Onoda, Daigo, Kirishima and Goda stand there.') },
        { s: 'onoda', t: T('ทั้งเมืองรู้แล้วว่าใครแข็งแกร่งที่สุด แกจะรวมทุกโรงเรียนก็ยังได้!', 'The whole city knows who\'s strongest. You could unite every school!') },
        { s: 'haru', t: T('ไม่เอา ใครหิวบ้าง? ร้านมารุอิจิ ฉันเลี้ยง... เอ๊ะ ไม่สิ ใครแพ้เลี้ยง', 'Nope. Who\'s hungry? Maruichi, my treat... wait, no. Losers pay.') },
        { s: 'narrator', t: T('คืนนั้น ร้านราเมงเล็กๆ ในย่านการค้า เต็มไปด้วยนักเลงจากห้าโรงเรียน นั่งกินด้วยกันเป็นครั้งแรก — จบบทที่ 3', 'That night, a tiny ramen shop was packed with delinquents from five schools, eating together for the first time. END OF CHAPTER 3') },
        { s: 'narrator', t: T('...ในโรงงานร้างสุดเมือง ใครบางคนในหน้ากากสีขาวขีดฆ่าชื่อห้าชื่อออกจากรายการ แล้วเขียนเพิ่มอีกหนึ่งชื่อ: ฮารุ โบยะ', '...In an empty factory at the edge of town, someone in a white mask crossed five names off a list, and wrote one more: HARU BOYA.') },
      ] },
    ], reward: { exp: 1200, money: 8000, rep: 700, rel: { goda: 30, kirishima: 10, onoda: 10, daigo: 10 }, sp: 2 } },

  { id: 'side_yamikaze', type: 'gang', title: T('ถนนเก็บค่าผ่านทาง', 'Toll Road'), desc: T('ยามิคาเซะเก็บค่าผ่านทางนักเรียนที่ลานจอดรถ', 'Yamikaze are taxing students at the parking lot.'), requires: ['tutorial'], auto: false, giver: 'npc_kenta',
    steps: [
      { kind: 'goto', place: 'parking', obj: T('ไปลานจอดรถ', 'Go to the parking lot') },
      { kind: 'defeat', enc: 'yami_gang', obj: T('ไล่แก๊งยามิคาเซะ', 'Drive off the Yamikaze riders'), say: [{ s: 'thug', t: T('ค่าผ่านทาง 500 เยน! ไม่จ่ายก็นอนตรงนี้!', 'Toll is 500 yen! Don\'t pay, sleep right here!') }] },
      { kind: 'boss', enc: 'yami_boss', obj: T('ล้มคุโรกิ "ไนโตร"', 'Take down Joji "Nitro" Kuroki'), say: [{ s: 'kuroki', t: T('ใครกล้ามาป่วนถนนของไนโตร!', 'Who dares mess with Nitro\'s road!') }], after: [{ s: 'kuroki', t: T('โอเค โอเค! เลิกเก็บค่าผ่านทางก็ได้!', 'Okay, okay! No more tolls!') }] },
    ], reward: { exp: 380, money: 3000, rep: 160 } },
  { id: 'side_mikami', type: 'duel', title: T('คำท้าของซ้ายแซ่บ', 'Southpaw\'s Challenge'), desc: T('นักมวยจากยิมร็อกคาคุท้าดวลตัวต่อตัว', 'A boxer from the Rokkaku gym wants a fair 1v1.'), requires: ['tutorial'], auto: false, giver: 'npc_mikami',
    steps: [
      { kind: 'boss', enc: 'duel_mikami', obj: T('ดวล 1 ต่อ 1 กับมิคามิ', '1v1 duel with Mikami'), say: [{ s: 'mikami', t: T('ได้ยินว่านายแข็งแกร่ง ดวลกันแฟร์ๆ ไม่มีใครยุ่ง!', 'Heard you\'re strong. A fair fight, nobody interferes!') }], after: [{ s: 'mikami', t: T('ฮ่าๆ! หมัดหนักจริง! มาซ้อมที่ยิมได้ทุกเมื่อ', 'Haha! What a punch! Come spar at the gym anytime.') }] },
    ], reward: { exp: 260, money: 1500, rep: 120, rel: { mikami: 35 } } },
  { id: 'side_cat', type: 'help', title: T('แมวของคุณยาย', 'Grandma\'s Cat'), desc: T('คุณยายหน้าร้านสะดวกซื้อทำแมวหาย', 'The grandma by the convenience store lost her cat.'), requires: [], auto: false, giver: 'npc_granny',
    steps: [
      { kind: 'interact', target: 'item_cat', obj: T('หาแมวสามสีในสวนมิโดริ (มุมตะวันตกเฉียงใต้)', 'Find the calico cat in Midori Park (southwest corner)'), say: [{ s: 'granny', t: T('หนูๆ เห็นแมวสามสีของยายไหม ชื่อโมจิ ชอบไปนอนในสวน...', 'Dear, have you seen my calico? Her name is Mochi, she likes napping in the park...') }] },
      { kind: 'talk', target: 'npc_granny', obj: T('พาโมจิกลับไปหาคุณยาย', 'Bring Mochi back to grandma'), say: [{ s: 'granny', t: T('โมจิ! ขอบใจนะหนู เด็กสมัยนี้ใจดีกว่าที่คิดเยอะ', 'Mochi! Thank you, dear. Kids these days are kinder than people say.') }, { s: 'haru', t: T('มันข่วนผมสามทีครับ แต่น่ารักดี', 'She scratched me three times. Cute though.') }] },
    ], reward: { exp: 150, money: 800, rep: 60 } },
  { id: 'side_ramen', type: 'help', title: T('ค่าคุ้มครองร้านราเมง', 'The Ramen Racket'), desc: T('โอนิงาวาระส่งมือปราบมารีดไถร้านมารุอิจิ', 'Onigawara sent an enforcer to squeeze Maruichi Ramen.'), requires: ['tutorial'], auto: false, giver: 'npc_saeko',
    steps: [
      { kind: 'defeat', enc: 'oni_racket', obj: T('ไล่ "หมาบ้า" อิชิดะออกจากย่านการค้า', 'Run "Mad Dog" Ishida out of the arcade'), say: [{ s: 'saeko', t: T('พวกนั้นกลับมาอีกแล้ว! ถ้าไม่จ่ายจะพังร้าน!', 'They\'re back! They say they\'ll wreck the shop if we don\'t pay!') }, { s: 'ishida', t: T('ร้านนี้ต้องจ่ายค่าคุ้มครอง ใครขวางกัดหมด!', 'This shop pays protection. I bite anyone in the way!') }] },
      { kind: 'talk', target: 'npc_saeko', obj: T('กลับไปบอกซาเอโกะ', 'Report back to Saeko'), say: [{ s: 'saeko', t: T('...ขอบใจนะ ไม่ได้ขอให้ช่วยสักหน่อย! แต่ราเมงลดครึ่งราคาตลอดชีพ', '...Thanks. Not that I asked! But half-price ramen for life.') }] },
    ], reward: { exp: 280, money: 1200, rep: 140, rel: { saeko: 30, taisho: 20 } } },
  { id: 'side_rumor', type: 'rumor', title: T('ข่าวลือ: ชายหน้ากากเที่ยงคืน', 'Rumor: The Midnight Mask'), desc: T('มีข่าวลือว่านักสู้สวมหน้ากากปรากฏตัวที่โรงงานร้างตอนกลางคืน', 'They say a masked fighter appears at the old factory at night.'), requires: ['tutorial'], minLevel: 3, auto: false, giver: 'npc_nakagawa',
    steps: [
      { kind: 'goto', place: 'warehouse', night: true, obj: T('ไปโรงงานร้างตอนกลางคืน (20:00-04:00 / นั่งพักที่ม้านั่งเพื่อข้ามเวลา)', 'Go to the old factory at night (20:00-04:00; rest on a bench to skip time)'), say: [{ s: 'nakagawa', t: T('ฉันถ่ายรูปได้แค่เงาเดียว! ถ้านายไปเจอเขาตอนกลางคืน ขอรูปด้วยนะ!', 'I only ever caught a shadow on camera! If you meet him at night, get me a photo!') }] },
      { kind: 'defeat', enc: 'wh_thugs', obj: T('จัดการเท็กคตสึยาร์ดที่เฝ้าโรงงาน', 'Clear the Tekkotsu Yard guards') },
      { kind: 'boss', enc: 'rumor_moon', obj: T('เผชิญหน้าหน้ากากจันทรา', 'Face the Moon Mask'), say: [{ s: 'tsukiyo', t: T('......แกคือคนที่ล้มคิริชิมะ', '......You are the one who beat Kirishima.') }], after: [{ s: 'tsukiyo', t: T('...แกแข็งแกร่ง แต่เรื่องของข้ายังไม่จบ (หายไปในความมืด)', '...You are strong. But my story is not over. (vanishes into the dark)') }] },
    ], reward: { exp: 500, money: 2000, rep: 250 } },
  // ======================= CHAPTER 4 =======================
  { id: 'main4', type: 'main', chapter: 4, title: T('บทที่ 4: ยักษ์แดงแห่งอาร์เคด', 'Chapter 4: Red Oni of the Arcade'), desc: T('โอนิงาวาระกับยามิคาเซะคิดว่าย่านการค้าไร้เจ้าของแล้ว และพวกมันจ้างตำนานมา', 'Onigawara and Yamikaze think the arcade is up for grabs, and they hired a legend.'), requires: ['main3'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_saeko', obj: T('คุยกับซาเอโกะที่ร้านราเมง', 'Talk to Saeko at the ramen shop'), say: [
        { s: 'saeko', t: T('ฮารุ! ตั้งแต่นาย "รวมเมือง" —', 'Haru! Ever since you "unified the city"—') },
        { s: 'haru', t: T('ฉันไม่ได้รวม', 'I didn\'t.') },
        { s: 'saeko', t: T('— โอนิงาวาระกับยามิคาเซะก็คิดว่าอาร์เคดไม่มีเจ้าของ! ค่าคุ้มครองขึ้นสองเท่า!', '—Onigawara and Yamikaze decided the arcade has no owner! They doubled the protection fee!') },
        { s: 'kenta', t: T('แล้วได้ข่าวว่าจ้างคนมาด้วย... "ยักษ์แดง" อาคางิ ตำนานเมื่อสามปีก่อน', 'And they hired someone... "Red Oni" Akagi. A legend from three years ago.') },
        { s: 'haru', t: T('ตำนานกินราเมงไหม', 'Does the legend eat ramen?') }] },
      { kind: 'defeat', enc: 'ch4_arcade', obj: T('ไล่โอนิงาวาระออกจากย่านการค้า', 'Drive Onigawara out of the arcade'), say: [
        { s: 'thug', t: T('อาร์เคดกลับเป็นของโอนิงาวาระแล้วโว้ย!', 'The arcade belongs to Onigawara again!') },
        { s: 'onoda', t: T('โอ้ย ฮารุ! ได้ข่าวว่ามีปาร์ตี้ คุโรงาเนะมา... ดูเฉยๆ', 'Oi, Haru! Heard there\'s a party. Kurogane came to... watch.') }],
        after: [{ s: 'onoda', t: T('แกไม่เหลือให้ฉันซักตัวเลยเหรอ!', 'You didn\'t leave me a single one!') }] },
      { kind: 'goto', place: 'parking', obj: T('ไปลานจอดรถ ยามิคาเซะกำลังรวมพล', 'Go to the parking lot. Yamikaze are gathering'), say: [{ s: 'kenta', t: T('พวกมอเตอร์ไซค์รวมตัวที่ลานจอดรถ! ถ้ายามิคาเซะเข้าร่วม สงครามแน่', 'The riders are gathering at the parking lot! If Yamikaze joins in, it\'s war.') }] },
      { kind: 'defeat', enc: 'ch4_riders', obj: T('ล้มแก๊งยามิคาเซะและไนโตร', 'Beat the Yamikaze riders and Nitro'), say: [{ s: 'kuroki', t: T('ไนโตรไม่แพ้ซ้ำสองนะเว้ย!', 'Nitro doesn\'t lose twice, man!') }], after: [{ s: 'kuroki', t: T('ชิ... ยักษ์แดงจ่ายดีกว่าค่าผ่านทางนี่หว่า', 'Tch... the Red Oni pays better than tolls, man.') }] },
      { kind: 'boss', enc: 'ch4_baba', obj: T('ทะลวง "กำแพง" บาบะ ในซอยหลังย่านการค้า', 'Break through "The Wall" Baba in the back alleys'), say: [
        { s: 'baba', t: T('...ห้ามผ่าน', '...Nobody passes.') }, { s: 'haru', t: T('อ้อมได้ไหม', 'Can I go around?') }, { s: 'baba', t: T('...ไม่ได้', '...No.') },
        { s: 'narrator', t: T('เคล็ดลับ: บาบะป้องกันเก่งมาก ใช้จับทุ่ม (G) หรือเตะหนัก (C) เพื่อทำลายการ์ด', 'Tip: Baba blocks everything. Grab (G) or heavy kick (C) to break his guard.') }],
        after: [{ s: 'baba', t: T('...ร้าวแล้ว อาคางิซังรออยู่ที่ประตูอาร์เคด', '...Cracked. Akagi-san waits at the arcade gate.') }] },
      { kind: 'boss', enc: 'ch4_akagi', obj: T('ล้ม "ยักษ์แดง" อาคางิ', 'Defeat "Red Oni" Akagi'), say: [
        { s: 'akagi', t: T('แกคือเด็กที่ล้มรุ่นน้องฉันเหรอ ฮ่าๆ! อาร์เคดนี่ทำเลทอง ฉันจะเก็บ... พร้อมดอกเบี้ย!', 'So you\'re the kid who beat my juniors? HAHA! This arcade is prime real estate. I\'ll collect it, with interest!') },
        { s: 'mogami', t: T('จ-จัดการมันเลยอาคางิเซมไป! ผมจ่ายล่วงหน้าแล้วนะ!', 'G-get him, Akagi-senpai! I paid you in advance!') },
        { s: 'haru', t: T('ราเมงของซาเอโกะอยู่ที่นี่ ฉันก็เลยอยู่ที่นี่', 'Saeko\'s ramen is here. So I\'m here.') }],
        after: [
          { s: 'akagi', t: T('ฮะ... ฮ่าๆ... ไม่โดนต่อยแบบนี้มาตั้งแต่สมัยยังเป็นนักเรียน', 'Hah... haha... haven\'t been hit like that since I was a student.') },
          { s: 'akagi', t: T('ก็ได้ โอนิงาวาระจะไม่ยุ่งกับอาร์เคดอีก แต่ไอ้หนู... คนที่จ้างโมงามิ "ขยายอาณาเขต" ไม่ใช่คนเมืองนี้', 'Fine. Onigawara leaves the arcade alone. But kid... whoever bankrolled Mogami\'s "expansion" isn\'t from this city.') },
          { s: 'saeko', t: T('วันนี้ราเมงฟรี! ...แค่วันนี้นะ!', 'Ramen\'s free today! ...Just today!') },
          { s: 'narrator', t: T('— จบบทที่ 4 —', '— END OF CHAPTER 4 —') }] },
    ], reward: { exp: 1600, money: 9000, rep: 900, rel: { saeko: 20, onoda: 10 }, sp: 1 } },
  // ======================= CHAPTER 5 =======================
  { id: 'main5', type: 'main', chapter: 5, title: T('บทที่ 5: สนิมกับสายฟ้า', 'Chapter 5: Rust and Lightning'), desc: T('นักเรียนเท็ตสึวันโดนลอบทำร้าย คนร้ายใส่เสื้อเท็กคตสึ แต่มีแพตช์สายฟ้าสีเหลือง', 'Tetsuwan students are being ambushed by guys in Tekkotsu jackets... one wore a yellow lightning patch.'), requires: ['main4'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_minoru', obj: T('คุยกับมิโนรุริมแม่น้ำฝั่งใต้', 'Talk to Minoru by the south bank'), say: [
        { s: 'minoru', t: T('ฮารุซัง! นักเรียนเท็ตสึวันโดนดักตีทุกวัน เขาว่าเป็นพวกคุโรงาเนะ', 'Haru-san! Tetsuwan students get jumped every day. They say it\'s Kurogane guys.') },
        { s: 'haru', t: T('พวกคุโรงาเนะดักตีตู้กดน้ำยังไม่เป็นเลย', 'Kurogane guys can\'t even ambush a vending machine.') },
        { s: 'minoru', t: T('คนร้ายใส่เสื้อเท็กคตสึ... แต่คนนึงติดแพตช์สายฟ้าสีเหลือง', 'The attackers wore Tekkotsu jackets... but one had a yellow lightning patch.') }] },
      { kind: 'goto', place: 'warehouse', obj: T('ไปโรงงานร้าง ฐานของเท็กคตสึยาร์ด', 'Go to the old factory, Tekkotsu Yard\'s base'), say: [{ s: 'kenta', t: T('เท็กคตสึยาร์ดกลับมาที่โรงงานเก่า หัวหน้าคือคาเนมุระ "สนิม" รับจ้างตีให้ใครก็ได้ที่จ่าย', 'Tekkotsu Yard is back at the old factory. Their boss, Kanemura "Rust", fights for whoever pays.') }] },
      { kind: 'defeat', enc: 'ch5_yard', obj: T('ฝ่าลูกน้องเท็กคตสึยาร์ด', 'Fight through the Tekkotsu Yard crew'), say: [{ s: 'thug', t: T('คาเนมุระซังสั่งไม่ให้ใครเข้า!', 'Kanemura-san said no visitors!') }] },
      { kind: 'boss', enc: 'ch5_kanemura', obj: T('ล้มคาเนมุระ "สนิม"', 'Defeat Kanemura "Rust"'), say: [
        { s: 'kanemura', t: T('ไม่มีอะไรส่วนตัวนะโบยะ มีคนจ่ายเยอะมากเพื่อให้เท็ตสึวันกับคุโรงาเนะรบกันอีก', 'Nothing personal, Boya. Someone paid a lot to see Tetsuwan and Kurogane at war again.') },
        { s: 'narrator', t: T('เคล็ดลับ: เหล็กเส้นของคาเนมุระฟาดรอบตัว หลบออกก่อนแล้วค่อยสวน', 'Tip: Kanemura\'s rebar swing hits all around him. Dodge out, then punish.') }],
        after: [{ s: 'kanemura', t: T('...ไรจินอินดัสเทรียล โรงเรียนใหม่ทางเหนือ เงินของพวกมันกลิ่นเหมือนย่านออฟฟิศ', '...Raijin Industrial. New school up north. Their money smells like the office district.') }, { s: 'kanemura', t: T('ฉันรักษาคำพูด เท็กคตสึถอนตัว', 'I keep my word. Tekkotsu is out.') }] },
      { kind: 'goto', place: 'north_res', obj: T('ไปย่านที่พักทิศเหนือ ถิ่นของไรจิน', 'Go to North Residential, Raijin turf'), say: [{ s: 'kenta', t: T('ไรจินย้ายมาเมื่อเดือนก่อน ระวังนะ พวกมันสู้เป็นฝูงใหญ่', 'Raijin moved in last month. Careful, they fight in huge groups.') }] },
      { kind: 'defeat', enc: 'ch5_raijin', obj: T('ล้มหน่วยลาดตระเวนไรจิน', 'Beat the Raijin patrol'), say: [{ s: 'thug', t: T('คนนอกห้ามเข้าเขตไรจิน!', 'Outsiders aren\'t welcome in Raijin\'s district!') }, { s: 'haru', t: T('ฉันมาจากเมืองชายทะเล ทุกคนเป็นคนนอกหมดแหละ', 'I\'m from a seaside town. Everyone\'s an outsider to me.') }] },
      { kind: 'boss', enc: 'ch5_inazuma', obj: T('ล้ม "แฟลช" อินาซึมะ', 'Defeat "Flash" Inazuma'), say: [
        { s: 'inazuma', t: T('โย่ทุกคน! นี่คือฮารุ โบยะตัวจริง! กดไลก์รัวๆ ระหว่างที่ผมกดหน้ามันนะ!', 'Yo chat! It\'s THE Haru Boya! Smash that like button while I smash his face!') },
        { s: 'haru', t: T('ปุ่มไลก์คืออะไร', 'What\'s a like button?') }],
        after: [{ s: 'inazuma', t: T('ไลฟ์... จบ...', 'Stream... ended...') }, { s: 'inazuma', t: T('โทโดโรกิซังไม่ยอมแน่... พรุ่งนี้เขาจะไปสวนมิโดริ พร้อมทุกคน', 'Todoroki-san won\'t let this slide... tomorrow he\'ll be at Midori Park. With everyone.') }, { s: 'narrator', t: T('— จบบทที่ 5 —', '— END OF CHAPTER 5 —') }] },
    ], reward: { exp: 2200, money: 11000, rep: 1100, rel: { minoru: 20, goda: 10 }, sp: 1 } },
  // ======================= CHAPTER 6 =======================
  { id: 'main6', type: 'main', chapter: 6, title: T('บทที่ 6: กลองอัสนี', 'Chapter 6: Thunder Drum'), desc: T('ไรจินท้ารบกลางสวนมิโดริ "มาให้หมดทุกคน"', 'Raijin challenges everyone to Midori Park. "Bring everyone."'), requires: ['main5'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_kenta', obj: T('คุยกับเคนตะ', 'Talk to Kenta'), say: [
        { s: 'kenta', t: T('ไรจินติดป้ายท้าทุกประตูโรงเรียน: "สวนมิโดริ ตอนเย็น มาให้หมดทุกคน"', 'Raijin posted a challenge on every school gate: "Midori Park. Sunset. Bring everyone."') },
        { s: 'haru', t: T('ทุกคน? ฉันมีแค่นาย', 'Everyone? I only have you.') },
        { s: 'kenta', t: T('...ฉันจะเอาสมุดโน้ตไปด้วย', '...I\'ll bring my notebook.') },
        { s: 'goda', t: T('(ข้อความ) เท็ตสึวันติดหนี้นาย เราจะคุมฝั่งใต้ให้', '(text) Tetsuwan owes you. We\'ll hold the south.') },
        { s: 'kirishima', t: T('(ข้อความ) ฮาคุริวจะดูปีกให้ ไปเถอะ', '(text) Hakuryu will watch the flanks. Go.') }] },
      { kind: 'goto', place: 'park', obj: T('ไปสวนมิโดริ', 'Go to Midori Park') },
      { kind: 'defeat', enc: 'ch6_park', obj: T('ล้มกองทัพไรจิน (9 คน)', 'Defeat the Raijin army (9 fighters)'), say: [{ s: 'todoroki', t: T('(ตะโกนจากไกลๆ) แสดงให้ข้าดูสิ อาเคโบโนะ! ว่าพวกแกคู่ควรจะถูกยึดไหม!', '(from afar) Show me, Akebono! Show me you\'re worth taking!') }], after: [{ s: 'kenta', t: T('เก้าคน?! นายล้มเก้าคน?!', 'Nine?! You beat NINE?!') }] },
      { kind: 'boss', enc: 'ch6_ishigami', obj: T('ล้ม "รถไถ" อิชิงามิ', 'Defeat "Bulldozer" Ishigami'), say: [{ s: 'ishigami', t: T('พี่โทโดโรกิบอกว่าถ้าชนะจะพาไปบุฟเฟต์ หิวมากเลย', 'Big bro Todoroki said if I win we get all-you-can-eat. I\'m SO hungry.') }, { s: 'haru', t: T('...เหมือนกันเลย', '...Same, actually.') }],
        after: [{ s: 'ishigami', t: T('แ-แพ้แล้ว... แถมยังหิวอยู่...', 'I-I lost... and I\'m still hungry...') }, { s: 'haru', t: T('มารุอิจิมีชามยักษ์นะ', 'Maruichi does a mega bowl.') }, { s: 'ishigami', t: T('นายเป็นคนดี!', 'You\'re a good guy!') }] },
      { kind: 'boss', enc: 'ch6_todoroki', obj: T('บุกโรงเรียนไรจิน ล้ม "กลองอัสนี" โทโดโรกิ', 'Storm Raijin turf and defeat "Thunder Drum" Todoroki'), say: [
        { s: 'todoroki', t: T('ไรจินมาเพราะเงิน ข้าไม่โกหก แต่เวลาข้าสู้ ข้าสู้จริง!', 'Raijin came here for money. I won\'t lie. But when I fight, I fight for real!') },
        { s: 'narrator', t: T('เคล็ดลับ: กระทืบสายฟ้าของโทโดโรกิกันไม่ได้ พอเขายกขาขึ้น ให้หลบออก', 'Tip: Todoroki\'s Thunderclap stomp can\'t be blocked. When he raises his leg, dodge away.') }],
        after: [
          { s: 'todoroki', t: T('...ฮะ กลองเงียบแล้ว แกชนะ ฮารุ โบยะ', '...Hah. The drum\'s gone quiet. You win, Haru Boya.') },
          { s: 'todoroki', t: T('คนจ่ายเงินพวกเราคือเท็นโจ เรย์จิ ประธานนักเรียนชินเซย์ พ่อมันอยากทุบอาร์เคดสร้างห้าง', 'The one paying us is Reiji Tenjo, president of Shinsei Academy. His father wants the arcade flattened for a mall.') },
          { s: 'haru', t: T('ห้าง? แล้วฉันจะไปกินราเมงที่ไหน', 'A mall? Then where do I eat ramen?') },
          { s: 'todoroki', t: T('ไรจินเลิกรับเงินมันแล้ว ถ้าแกจะไปหามัน... ไรจินไปด้วย', 'Raijin\'s done with his money. If you go after him... Raijin goes with you.') },
          { s: 'narrator', t: T('— จบบทที่ 6 —', '— END OF CHAPTER 6 —') }] },
    ], reward: { exp: 3000, money: 14000, rep: 1400, rel: { todoroki: 30 }, sp: 2 } },
  // ======================= CHAPTER 7 =======================
  { id: 'main7', type: 'main', chapter: 7, title: T('บทที่ 7: ท่านประธาน', 'Chapter 7: The Chairman'), desc: T('ชินเซย์อะคาเดมีจากย่านออฟฟิศอยู่เบื้องหลังทุกอย่าง... หรือเปล่า?', 'Shinsei Academy in the office district is behind everything... or is it?'), requires: ['main6'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_kirishima', obj: T('คุยกับคิริชิมะที่ลานฮาคุริว', 'Talk to Kirishima at the Hakuryu yard'), say: [
        { s: 'kirishima', t: T('ประธานชินเซย์เชิญฉันไป "ต่อรองราคา" ฉันปฏิเสธ แล้วรุ่นน้องก็โดนดักตีตอนกลับบ้าน', 'Shinsei\'s president invited me to "negotiate our price." I declined. Then my juniors were attacked on the way home.') },
        { s: 'kirishima', t: T('ฉันจะไปด้วย เพื่อเกียรติ ...อีกอย่างนายยังติดแมตช์แก้มือฉันอยู่', 'I\'m coming with you. For honor. ...Also, you still owe me a rematch.', ), choices: [
          { t: T('ยินดีต้อนรับ', 'Welcome aboard.'), rel: { kirishima: 10 } },
          { t: T('อย่าเข้าแถวรอตอนสู้ละกัน', 'Just don\'t make everyone line up.'), rel: { kirishima: 5 }, rep: 50 }] }] },
      { kind: 'defeat', enc: 'ch7_office', obj: T('ฝ่านักเรียนชินเซย์ที่ลานออฟฟิศ', 'Fight through Shinsei students at the Office Plaza'), say: [{ s: 'thug', t: T('ที่ส่วนบุคคล! สามัญชนต้องจ่ายค่าเข้าชม!', 'Private property! Commoners pay a visitor fee!') }, { s: 'haru', t: T('ทำไมทุกคนในเมืองนี้อยากเก็บค่าอะไรซักอย่าง', 'Why does everyone in this city want a fee?') }] },
      { kind: 'boss', enc: 'ch7_himuro', obj: T('ล้ม "เข็มน้ำแข็ง" ฮิมุโระ ที่ลานสถานี', 'Defeat "Icicle" Himuro at Station Plaza'), say: [
        { s: 'himuro', t: T('คิริชิมะ จิน นายอ่อนลงนะ', 'Jin Kirishima. You got soft.') }, { s: 'kirishima', t: T('ฮิมุโระ... ฉันมีเพื่อนแล้ว', 'Himuro... I got friends.') }, { s: 'himuro', t: T('ก็อย่างเดียวกันนั่นแหละ', 'Same thing.') },
        { s: 'narrator', t: T('เคล็ดลับ: ลูกเตะฮิมุโระไกลกว่าหมัดนาย เข้าประชิดแล้วจับทุ่ม', 'Tip: Himuro\'s kicks outrange you. Close in and grab.') }],
        after: [{ s: 'himuro', t: T('...หมัดนายซื่อตรง เท็นโจไม่เคยซื่อตรงเลยทั้งชีวิต เขาอยู่ที่ลานออฟฟิศ ...ฉันลาออก', '...Your punches are honest. Tenjo has never been honest in his life. He\'s at the Office Plaza. ...I quit.') }] },
      { kind: 'boss', enc: 'ch7_tenjo', obj: T('ล้ม "ท่านประธาน" เท็นโจ', 'Defeat "The Chairman" Tenjo'), say: [
        { s: 'tenjo', t: T('คุณโบยะ! ยินดีที่ได้พบ มาคุยแบบผู้ใหญ่กัน: หนึ่งล้านเยน แล้วออกไปจากอาเคโบโนะ', 'Mr. Boya! A pleasure. Let\'s be adults: one million yen, and you leave Akebono.') },
        { s: 'haru', t: T('รวมราเมงไหม', 'Does that include ramen?') }, { s: 'tenjo', t: T('...ก็ได้นะ', '...It could.') }, { s: 'haru', t: T('ไม่เอา', 'Pass.') }],
        after: [
          { s: 'tenjo', t: T('นายไม่เข้าใจ... ฉันเป็นแค่คนกลาง! คนวางแผนทั้งหมด... ส่งรายชื่อมาให้ นักสู้ทุกคนในเมือง จุดอ่อนทุกคน ลงชื่อเป็นรูปพระจันทร์', 'You don\'t understand... I was only a middleman! The one who planned it all sent me a list. Every fighter in the city, every weakness. Signed with a moon.') },
          { s: 'kenta', t: T('นั่น... นั่นลายมือในสมุดของฉัน... มีคนลอกไป!', 'That\'s... that\'s from MY notebook... someone copied it!') },
          { s: 'haru', t: T('พระจันทร์เหรอ', 'A moon, huh.') },
          { s: 'narrator', t: T('— จบบทที่ 7 —', '— END OF CHAPTER 7 —') }] },
    ], reward: { exp: 3800, money: 18000, rep: 1700, rel: { kirishima: 25, kenta: 10 }, sp: 2 } },
  // ======================= CHAPTER 8 =======================
  { id: 'main8', type: 'main', chapter: 8, title: T('บทที่ 8: ปลาคาร์พแก่', 'Chapter 8: The Old Carp'), desc: T('เก็นโซรู้จักคนใส่หน้ากากพระจันทร์ และอดีตที่ไม่เคยเล่าให้ใครฟัง', 'Genzo knows the man behind the moon mask, and a past he never told anyone.'), requires: ['main7'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_genzo', obj: T('คุยกับเก็นโซใต้สะพาน', 'Talk to Genzo under the bridge'), say: [
        { s: 'genzo', t: T('หน้ากากพระจันทร์... มันกลับมาแล้วสินะ', 'The moon mask... So he\'s back.') },
        { s: 'genzo', t: T('หกปีก่อน พวกเราสามคนรวมเมืองนี้: ข้า ซาคากิบาระ และสึกิคาเงะ ชิออน ชิออนเห็นเพื่อนพิการเพราะสงครามแก๊ง แล้วตัดสินใจว่าเมืองต้องมีราชาที่ทุกคนกลัว', 'Six years ago, three of us held this city together: me, Sakakibara, and Shion Tsukikage. Shion watched a friend get crippled in a gang war and decided the city needed one king everyone feared.') },
        { s: 'genzo', t: T('เราหยุดเขาไว้ เขาหายไป ตอนนี้เขาสร้างสมาคมเก็กโคในความมืด', 'We stopped him. He vanished. Now he\'s built the Gekko Society in the dark.') },
        { s: 'haru', t: T('งั้นฉันไปเตะเขา', 'So I kick him.') },
        { s: 'genzo', t: T('ยัง คืนนี้พวกหน้ากากจะมาที่ริมน้ำก่อน', 'Not yet. Tonight the masks are coming for the riverside.') }] },
      { kind: 'goto', place: 'underbridge', night: true, obj: T('กลับมาใต้สะพานตอนกลางคืน', 'Return under the bridge at night'), say: [{ s: 'narrator', t: T('นั่งพักที่ม้านั่งเพื่อข้ามเวลาไปกลางคืนได้', 'Rest on a bench to skip to night.') }] },
      { kind: 'defeat', enc: 'ch8_masks', obj: T('ขับไล่สมาคมเก็กโคจากริมน้ำ', 'Drive the Gekko Society off the riverside'), say: [{ s: 'thug', t: T('บ่อของปลาคาร์พแก่เป็นของเราคืนนี้', 'The Old Carp\'s pond is ours tonight.') }] },
      { kind: 'boss', enc: 'ch8_tsukiyo', obj: T('หน้ากากจันทรารออยู่บนสะพาน', 'The Moon Mask waits on the bridge'), say: [{ s: 'tsukiyo', t: T('......ฮารุ โบยะ คืนนี้พระจันทร์เต็มดวง', '......Haru Boya. Tonight the moon is full.') }],
        after: [
          { s: 'narrator', t: T('หน้ากากแตก... ใบหน้าข้างใต้เหมือนใครบางคน', 'The mask cracks... the face beneath looks like someone you know.') },
          { s: 'kirishima', t: T('...พี่?', '...Brother?') },
          { s: 'tsukiyo', t: T('จิน... ขอโทษ ชิออนรับฉันไว้ตอนพ่อไล่ออกจากบ้าน ฉันคิดว่าความกลัวจะทำให้ฉันแข็งแกร่ง', 'Jin... I\'m sorry. Shion took me in when Father threw me out. I thought fear would make me strong.') },
          { s: 'haru', t: T('ตอนนี้มีน้องชายกับร้านราเมงแล้ว แข็งแกร่งกว่าเยอะ', 'Now you\'ve got a brother and a ramen shop. That\'s way stronger.') },
          { s: 'tsukiyo', t: T('...รายชื่อของชิออนมีชื่อเดียวที่ถูกวงไว้ ชื่อนาย', '...Shion\'s list has one name circled. Yours.') }] },
      { kind: 'boss', enc: 'ch8_genzo', obj: T('บททดสอบของปลาคาร์พแก่: ล้มเก็นโซ', 'The Old Carp\'s test: defeat Genzo'), say: [
        { s: 'genzo', t: T('ก่อนเจอชิออน เจอข้าก่อน ถ้าชนะตาแก่ปวดหลังไม่ได้ ก็อย่าหวังชนะคนที่สอนข้าครึ่งหนึ่ง', 'Before you face Shion, face me. If you can\'t beat an old man with a bad back, forget the man who taught me half my tricks.') },
        { s: 'haru', t: T('หลังไหวเหรอ', 'Is your back okay?') }, { s: 'genzo', t: T('หลังจากนี้จะไหว', 'It will be after this.') },
        { s: 'narrator', t: T('เคล็ดลับ: เก็นโซสวนกลับทุกอย่าง ใจเย็น ล่อให้เขาออกท่าแล้วค่อยลงโทษ ท่าทุ่มก้นแม่น้ำกันไม่ได้', 'Tip: Genzo counters everything. Be patient: bait him, then punish. His Riverbed Drop is unblockable.') }],
        after: [{ s: 'genzo', t: T('...เฮะ ดี หมัดของแกมีเพื่อนอยู่ข้างหลัง ของมันไม่เคยมี', '...Heh. Good. Your fists have friends behind them. His never did.') }, { s: 'genzo', t: T('ไปหาซาคากิบาระ เขาจะบอกว่าชิออนอยู่ไหน... เมื่อแกพร้อม', 'Go to Sakakibara. He\'ll tell you where Shion is... when you\'re ready.') }, { s: 'narrator', t: T('— จบบทที่ 8 —', '— END OF CHAPTER 8 —') }] },
    ], reward: { exp: 4600, money: 20000, rep: 2000, rel: { genzo: 30, kirishima: 15 }, sp: 2 } },
  // ======================= CHAPTER 9 =======================
  { id: 'main9', type: 'main', chapter: 9, title: T('บทที่ 9: คืนแห่งหน้ากาก', 'Chapter 9: Night of the Masks'), desc: T('สมาคมเก็กโคจะบุกทุกโรงเรียนในคืนเดียว', 'The Gekko Society will hit every school in a single night.'), requires: ['main8'], auto: true,
    steps: [
      { kind: 'talk', target: 'npc_sakaki', obj: T('คุยกับซาคากิบาระเซนเซที่ประตูโรงเรียน', 'Talk to Sakakibara-sensei at the school gate'), say: [
        { s: 'sakaki', t: T('โบยะคุง การเข้าเรียนของเธอแย่มาก', 'Boya-kun. Your attendance is terrible.') }, { s: 'haru', t: T('ขอโทษครับ', 'Sorry.') },
        { s: 'sakaki', t: T('คืนนี้สมาคมเก็กโคจะบุกทุกโรงเรียนพร้อมกัน ชิออนอยากให้เมืองเชื่อว่าไม่มีใครปกป้องมันได้', 'Tonight the Gekko Society strikes every school at once. Shion wants the city to believe no one can protect it.') },
        { s: 'sakaki', t: T('ครูไม่ต่อยตี ...อย่างเป็นทางการ เธอปกป้องคุโรงาเนะ เพื่อนเธอปกป้องโรงเรียนของพวกเขา', 'Teachers don\'t fight. ...Officially. So you protect Kurogane. Your friends protect theirs.') }] },
      { kind: 'defeat', enc: 'ch9_kuro', obj: T('ปกป้องคุโรงาเนะจากเก็กโค (กลางคืน)', 'Defend Kurogane from the Gekko raid (night)'), say: [{ s: 'onoda', t: T('ฮารุ! พวกมันปีนรั้วมา! คุโรงาเนะไม่หนี!', 'Haru! They came over the fence! Kurogane doesn\'t run!') }], after: [{ s: 'ryo', t: T('ผ-ผมเฝ้าประตูไว้ได้!! ตั้งสี่วินาที!!', 'I-I held the gate!! For four whole seconds!!') }] },
      { kind: 'boss', enc: 'ch9_oboro', obj: T('ล้ม "จันทร์พรางตา" โอโบโระ', 'Defeat "Hazy Moon" Oboro'), say: [{ s: 'oboro', t: T('ฮึๆ... คิดว่ากำลังสู้กับฉันอยู่เหรอ?', 'Hehe... did you think you were fighting ME?') }, { s: 'narrator', t: T('เคล็ดลับ: โอโบโระหายตัวระหว่างพุ่ง อย่าไล่ ป้องกันแล้วสวนตอนเขาโผล่', 'Tip: Oboro vanishes during his dash. Don\'t chase. Block, then counter when he reappears.') }], after: [{ s: 'oboro', t: T('ภาพลวง... ใช้ไม่ได้กับคนที่ไม่ค่อยคิด...', 'Illusions... don\'t work on someone who doesn\'t think...') }, { s: 'haru', t: T('เฮ้', 'Hey.') }] },
      { kind: 'defeat', enc: 'ch9_tetsu', obj: T('ช่วยเท็ตสึวัน (กลางคืน)', 'Help Tetsuwan (night)'), say: [{ s: 'goda', t: T('ฮารุ! พวกมันจะไปเผาโรงช่างของมิโนรุ!', 'Haru! They\'re going for Minoru\'s workshop!') }], after: [{ s: 'goda', t: T('ขอบใจ... สถานี! คุโรซึกิไปที่สถานี ยิมของมิคามิอยู่ที่นั่น!', 'Thanks... the station! Kurozuki is heading for the station, Mikami\'s gym is there!') }] },
      { kind: 'boss', enc: 'ch9_kurozuki', obj: T('ล้ม "จันทร์ดำ" คุโรซึกิ ที่ลานสถานี', 'Defeat "Black Moon" Kurozuki at Station Plaza'), say: [
        { s: 'mikami', t: T('ขอโทษ... ฮารุ... หมอนั่นเป็นปีศาจ...', 'Sorry... Haru... that guy\'s a monster...') },
        { s: 'kurozuki', t: T('......', '......') }, { s: 'haru', t: T('นายไม่ค่อยพูด ฉันก็ด้วย มาเลย', 'You don\'t talk much. Me neither. Let\'s go.') },
        { s: 'narrator', t: T('เคล็ดลับ: ท่าทุ่มของคุโรซึกิแรงมาก อย่ายืนป้องกันติดตัวเขา เคลื่อนที่ไว้', 'Tip: Kurozuki\'s throws hurt. Keep moving; don\'t turtle next to him.') }],
        after: [{ s: 'kurozuki', t: T('...ชิออนซัง ขอโทษ...', '...Shion-san... I\'m sorry...') }, { s: 'kurozuki', t: T('โรงงาน รุ่งสาง เขารออยู่... คนเดียว เขาอยู่คนเดียวเสมอ', 'The factory. Dawn. He\'ll be waiting... alone. He always is.') }, { s: 'narrator', t: T('รุ่งเช้า ทุกโรงเรียนในอาเคโบโนะยืนหยัดได้ เป็นครั้งแรกในประวัติศาสตร์ที่พวกเขายืนหยัดด้วยกัน — จบบทที่ 9 —', 'By morning every school in Akebono had held. For the first time in history, they had held together. — END OF CHAPTER 9 —') }] },
    ], reward: { exp: 5500, money: 24000, rep: 2400, rel: { onoda: 15, goda: 15, mikami: 15 }, sp: 2 } },
  // ======================= CHAPTER 10 =======================
  { id: 'main10', type: 'main', chapter: 10, title: T('บทที่ 10: รุ่งอรุณเหนืออาเคโบโนะ', 'Chapter 10: Dawn over Akebono'), desc: T('ทุกโรงเรียนรวมพลที่ร้านราเมง แล้วบุกฐานเก็กโค', 'Every school gathers at the ramen shop, then storms the Gekko HQ.'), requires: ['main9'], auto: true,
    steps: [
      { kind: 'goto', place: 'ramen', obj: T('ไปร้านมารุอิจิ ทุกคนรออยู่', 'Go to Maruichi Ramen. Everyone is waiting'), say: [
        { s: 'onoda', t: T('คุโรงาเนะเอาด้วย', 'Kurogane\'s in.') }, { s: 'kirishima', t: T('ฮาคุริวด้วย', 'Hakuryu too.') }, { s: 'goda', t: T('เท็ตสึวัน', 'Tetsuwan.') }, { s: 'todoroki', t: T('ไรจินโว้ย!!', 'RAIJIN!!') },
        { s: 'hayate', t: T('...คาเงโรติดหนี้นายหนึ่งครั้ง อย่าทำให้มันแปลก', '...Kagero owes you one. Don\'t make it weird.') },
        { s: 'saeko', t: T('ห้ามใครไปสู้จนกว่าจะกินเสร็จ!', 'Nobody fights until they\'ve eaten!') },
        { s: 'taisho', t: T('(วางชามที่ใหญ่ที่สุดเท่าที่เคยมีมา)', '(sets down the biggest bowl anyone has ever seen)') },
        { s: 'haru', t: T('ฉันไม่อยากเป็นราชาของใคร ฉันแค่อยากกินราเมงกับทุกคน งั้นไปพาชิออนมากินด้วยกัน', 'I don\'t want to be king of anybody. I just want to eat ramen with all of you. So let\'s go get Shion and bring him here.') }] },
      { kind: 'defeat', enc: 'ch10_gate', obj: T('บุกประตูหน้าฐานเก็กโค (10 คน)', 'Storm the Gekko HQ front gate (10 fighters)'), say: [{ s: 'kenta', t: T('ทุกคนคุมประตูข้างอยู่! ประตูหน้าเป็นของนาย ฮารุ!', 'Everyone\'s holding the side gates! The front is all yours, Haru!') }], after: [{ s: 'hayate', t: T('ประตูหน้าโล่งแล้ว ไปก่อนที่ฉันจะเปลี่ยนใจมาสู้กับนายแทน', 'Front gate\'s clear. Go, before I change my mind and fight you instead.') }] },
      { kind: 'defeat', enc: 'ch10_inner', obj: T('โอโบโระขวางทางอีกครั้ง', 'Oboro blocks the way again'), say: [{ s: 'oboro', t: T('ฮึๆ รอบนี้ของจริงนะ', 'Hehe, this time it\'s the real me.') }], heal: true },
      { kind: 'boss', enc: 'ch10_shion', obj: T('ศึกสุดท้าย: สึกิคาเงะ ชิออน', 'Final battle: Shion Tsukikage'), heal: true, say: [
        { s: 'shion', t: T('ฮารุ โบยะ เด็กที่ปฏิเสธทุกมงกุฎ', 'Haru Boya. The boy who refuses every crown.') },
        { s: 'shion', t: T('ฉันจดจุดอ่อนของทุกคนไว้หมด หน้าของนายเป็นหน้าเดียวที่ฉันเขียนไม่ได้', 'I have everyone\'s weakness written down. Yours is the only page I couldn\'t fill.') },
        { s: 'haru', t: T('ของฉันง่ายจะตาย ฉันหิวบ่อย', 'Mine\'s easy. I get hungry.') },
        { s: 'shion', t: T('งั้นจะจบก่อนมื้อเย็น', 'Then I\'ll end this before dinner.') },
        { s: 'narrator', t: T('เคล็ดลับ: ชิออนเปลี่ยนสไตล์ทุกเฟส: ความเร็วแบบคาเงโร การสวนแบบฮาคุริว แล้วทุกอย่างพร้อมกัน ปรับตัวให้ทัน!', 'Tip: Shion changes style every phase: Kagero speed, Hakuryu counters, then everything at once. Adapt!') }],
        after: [
          { s: 'shion', t: T('...ทำไม ฉันแค่อยากให้การต่อสู้หยุด ไม่อยากให้ใครเจ็บอีก', '...Why? I only wanted the fighting to stop. I didn\'t want anyone else to get hurt.') },
          { s: 'haru', t: T('งั้นเลิกสู้คนเดียวสิ มากินข้าวกัน', 'Then stop fighting alone. Come eat.') },
          { s: 'genzo', t: T('ชิออน ราเมงจะเย็นแล้ว', 'Shion. The ramen\'s getting cold.') },
          { s: 'sakaki', t: T('สายไปหกปีนะ สึกิคาเงะคุง ทำโทษกักบริเวณเยอะเลย', 'Six years late, Tsukikage-kun. That\'s a lot of detention.') },
          { s: 'shion', t: T('...ฮะ ฮ่าๆ... พวกบ้า', '...Heh. Haha... you idiots.') },
          { s: 'narrator', t: T('ดวงอาทิตย์ขึ้นเหนืออาเคโบโนะ เป็นครั้งแรกในร้อยปีที่ไม่มีโรงเรียนไหนครองเมือง และทุกโรงเรียนกินข้าวเช้าด้วยกัน — จบ... ของการเริ่มต้น', 'The sun rose over Akebono. For the first time in a hundred years no school ruled the city, and every school ate breakfast together. THE END... of the beginning.') },
          { s: 'narrator', t: T('ปลดล็อกหลังจบเกม: ทัวร์นาเมนต์ใต้ดินที่โรงงานเก่า แมตช์แก้มือทั่วเมือง และ... ข่าวลือถึงครูที่ไม่เคยแพ้ใคร', 'Post-game unlocked: the Underground Tournament at the old factory, rematches around town, and... rumors of a teacher who has never lost.') }] },
    ], reward: { exp: 7000, money: 40000, rep: 3500, rel: { kenta: 20, saeko: 20, onoda: 10, kirishima: 10, goda: 10, hayate: 10, genzo: 10 }, sp: 3 } },
  // ======================= SIDE CONTENT (ch4+) =======================
  { id: 'side_ryo', type: 'help', title: T('ศักดิ์ศรีเสือกระดาษ', 'Paper Tiger\'s Pride'), desc: T('หมาจรจัดรีดไถเด็ก ม.4 ในสวน เรียวต้องการความช่วยเหลือ "นิดเดียว"', 'The Stray Dogs are shaking down first-years in the park. Ryo needs "a tiny bit" of help.'), requires: ['main1'], auto: false, giver: 'npc_ryo',
    steps: [
      { kind: 'defeat', enc: 'sq_ryo', obj: T('ไล่หมาจรจัดออกจากสวนมิโดริ', 'Chase the Stray Dogs out of Midori Park'), say: [{ s: 'ryo', t: T('ผมทำให้พวกมันอ่อนแรงไว้ก่อนแล้วนะ! ...ในใจ', 'I already softened them up! ...Mentally.') }] },
      { kind: 'talk', target: 'npc_ryo', obj: T('กลับไปบอกเรียว', 'Report back to Ryo'), say: [{ s: 'ryo', t: T('รู้อยู่แล้วว่าพวกเราสองคนเอาอยู่! พวกเรา! สองคน!', 'I knew the two of us could handle it! Us! Both of us!') }] },
    ], reward: { exp: 450, money: 1500, rep: 150, rel: { ryo: 20 } } },
  { id: 'side_kai', type: 'duel', title: T('เงาของลม', 'Shadow of the Wind'), desc: T('ไคอยากหาสไตล์ของตัวเอง ไม่ใช่ลอกพี่ชาย', 'Kai wants a style of his own, not a copy of his brother\'s.'), requires: ['main3'], auto: false, giver: 'npc_kai',
    steps: [
      { kind: 'boss', enc: 'sq_kai', obj: T('ประลองกับไคในซอยหลังร้าน', 'Spar with Kai in the back alleys'), say: [{ s: 'kai', t: T('พี่บอกว่าฉันได้แต่ลอกเขา สู้กับฉันที อยากรู้ว่าฉันเป็นใคร', 'My brother says I only copy him. Fight me. I want to know who I am.') }], after: [{ s: 'kai', t: T('...ลองชกมวยดีกว่า มิคามิบอกว่าแขนฉันยาว', '...Maybe I\'ll try boxing. Mikami says I have the reach.') }] },
    ], reward: { exp: 900, money: 2500, rep: 300, rel: { kai: 25, hayate: 10 } } },
  { id: 'side_taisho', type: 'duel', title: T('บททดสอบราเมง', 'The Ramen Trial'), desc: T('ใครอยากรู้สูตรลับของมารุอิจิ ต้องรอดจากไทโชให้ได้', 'Anyone who wants Maruichi\'s secret recipe must survive Taisho.'), requires: ['main4'], auto: false, giver: 'npc_taisho',
    steps: [
      { kind: 'say', obj: T('ฟังซาเอโกะ', 'Listen to Saeko'), say: [{ s: 'saeko', t: T('พ่ออยากทดสอบนาย ใครอยากได้สูตรลับต้องรอดจาก... นั่น', 'Dad wants to test you. Anyone who wants the secret recipe has to survive... THAT.') }, { s: 'taisho', t: T('...(หักนิ้ว)', '...(cracks knuckles)') }] },
      { kind: 'boss', enc: 'sq_taisho', obj: T('รอดจากไทโชให้ได้', 'Survive Taisho'), after: [{ s: 'taisho', t: T('...เส้นเหนียวดี ผ่าน', '...Firm noodles. You pass.') }, { s: 'saeko', t: T('พ่อไม่เคยพูดแบบนี้กับใครเลยนะ!', 'He has NEVER said that to anyone!') }] },
    ], reward: { exp: 1500, money: 5000, rep: 600, rel: { taisho: 40, saeko: 15 }, sp: 1 } },
  { id: 'side_daigo', type: 'duel', title: T('ระฆังวัด', 'The Temple Bell'), desc: T('ไดโกะอยากรู้ว่าเขายังปกป้องใครได้ไหม', 'Daigo wants to know if he can still protect anyone.'), requires: ['main4'], auto: false, giver: 'npc_daigo',
    steps: [
      { kind: 'boss', enc: 'sq_daigo', obj: T('ประลองกับไดโกะบนดาดฟ้า', 'Spar with Daigo on the rooftop'), say: [{ s: 'daigo', t: T('...สู้กับฉันที ฉันอยากรู้ว่ายังปกป้องคนอื่นได้ไหม', '...Spar with me. I want to know if I can still protect people.') }], after: [{ s: 'daigo', t: T('...ขอบใจ ฉันจะตั้งกลุ่มใหม่ กลุ่มที่ปกป้องเด็ก ม.4', '...Thanks. I\'ll start a new faction. One that protects the first-years.') }] },
    ], reward: { exp: 1200, money: 3000, rep: 400, rel: { daigo: 30 } } },
  { id: 'side_scoop', type: 'rumor', title: T('ข่าวหน้าหนึ่ง', 'The Front Page'), desc: T('นากางาวะได้ข่าวว่าหมาจรจัดจะยกพวกตีกันกลางย่านที่พัก', 'Nakagawa heard the Stray Dogs are planning a rumble in Central Residential.'), requires: ['main5'], auto: false, giver: 'npc_nakagawa',
    steps: [
      { kind: 'defeat', enc: 'sq_scoop', obj: T('หยุดศึกหมาจรจัด (8 คน) ที่ย่านที่พักกลางเมือง', 'Stop the Stray Dog rumble (8) in Central Residential'), say: [{ s: 'nakagawa', t: T('ยิ้มหน่อย! ...ไม่ต้องก็ได้ ต่อยต่อเลย!', 'Smile for the camera! ...Never mind, keep punching!') }] },
      { kind: 'talk', target: 'npc_nakagawa', obj: T('ส่งรูปให้นากางาวะ', 'Bring the photos to Nakagawa'), say: [{ s: 'nakagawa', t: T('"นักเรียนใหม่ล้มแปดคนรวด" ขายหมดแน่!', '"Transfer Student Flattens Eight!" This\'ll sell out!') }] },
    ], reward: { exp: 1400, money: 4000, rep: 700, rel: { nakagawa: 25 } } },
  { id: 'side_tools', type: 'help', title: T('เครื่องมือที่หายไป', 'Stolen Tools'), desc: T('มีคนขโมยเครื่องมือช่างของมิโนรุไป', 'Someone stole Minoru\'s workshop tools.'), requires: ['main5'], auto: false, giver: 'npc_minoru',
    steps: [
      { kind: 'defeat', enc: 'sq_tools', obj: T('เอาเครื่องมือคืนจากหมาจรจัดริมแม่น้ำ', 'Get the tools back from the Stray Dogs on the south bank') },
      { kind: 'talk', target: 'npc_minoru', obj: T('คืนเครื่องมือให้มิโนรุ', 'Return the tools to Minoru'), say: [{ s: 'minoru', t: T('ขอบคุณ! ผมจะทำสนับมือให้ ...ล้อเล่น ทำที่วางชามราเมงให้', 'Thank you! I\'ll make you brass knuckles... kidding, a ramen bowl stand.') }] },
    ], reward: { exp: 1300, money: 4500, rep: 500, rel: { minoru: 25, goda: 10 } } },
  { id: 'side_granny2', type: 'help', title: T('ธุระของคุณยาย', 'Grandma\'s Errand'), desc: T('คุณยายโดนกระชากกระเป๋าที่ลานสถานี', 'Grandma\'s bag was snatched at Station Plaza.'), requires: ['main6'], auto: false, giver: 'npc_granny',
    steps: [
      { kind: 'defeat', enc: 'sq_granny', obj: T('ไล่จับโจรกระชากกระเป๋าที่ลานสถานี', 'Catch the purse snatchers at Station Plaza'), say: [{ s: 'granny', t: T('ในกระเป๋ามีขนมให้แมวด้วยนะ!', 'The cat\'s treats were in that bag!') }] },
      { kind: 'talk', target: 'npc_granny', obj: T('คืนกระเป๋าให้คุณยาย', 'Return the bag to Grandma'), say: [{ s: 'granny', t: T('เด็กดี! เอาขนมไปครึ่งนึง ...ของแมวนะ', 'Good boy! Take half the snacks. ...They\'re the cat\'s.') }] },
    ], reward: { exp: 1000, money: 3000, rep: 400 } },
  { id: 'side_todoroki', type: 'gang', title: T('สายฟ้านอกคอก', 'Rogue Lightning'), desc: T('ลูกน้องไรจินบางส่วนไม่ยอมเลิกรับเงินชินเซย์', 'Some Raijin members refuse to give up Shinsei money.'), requires: ['main6'], auto: false, giver: 'npc_todoroki',
    steps: [
      { kind: 'defeat', enc: 'sq_rogue', obj: T('ล้มไรจินนอกคอกที่ถนนคิตะ', 'Beat the rogue Raijin on Kita-dori'), say: [{ s: 'todoroki', t: T('พวกมันไม่ฟังข้า งั้นให้ฟังหมัดแก', 'They won\'t listen to me. Let them listen to your fists.') }] },
      { kind: 'talk', target: 'npc_todoroki', obj: T('รายงานโทโดโรกิ', 'Report to Todoroki'), say: [{ s: 'todoroki', t: T('กลองกลับมาดังเป็นจังหวะเดียวกันแล้ว! คืนนี้ข้าเลี้ยง!', 'The drum beats as one again! Dinner\'s on me tonight!') }] },
    ], reward: { exp: 2000, money: 6000, rep: 800, rel: { todoroki: 20 } } },
  { id: 'rematch_onoda', type: 'duel', title: T('แมตช์แก้มือ: หัวค้อน', 'Rematch: Hammerhead'), desc: T('โอโนดะฝึกหัวมาหนักกว่าเดิม', 'Onoda has been training his forehead.'), requires: ['main4'], auto: false, giver: 'npc_onoda',
    steps: [{ kind: 'boss', enc: 'rm_onoda', obj: T('แมตช์แก้มือกับโอโนดะ', 'Rematch Onoda'), say: [{ s: 'onoda', t: T('ฉันโขกกำแพงวันละร้อยครั้ง! ...กำแพงพังไปสามแผ่น', 'I headbutt a wall a hundred times a day! ...Three walls so far.') }], after: [{ s: 'onoda', t: T('ยังไม่พอ... พรุ่งนี้กำแพงที่สี่!', 'Not enough... tomorrow, wall number four!') }] }],
    reward: { exp: 1600, money: 4000, rep: 500, rel: { onoda: 20 } } },
  { id: 'rematch_kirishima', type: 'duel', title: T('แมตช์แก้มือ: กระจกเงา', 'Rematch: The Mirror'), desc: T('คิริชิมะมาทวงแมตช์แก้มือตามสัญญา', 'Kirishima wants the rematch you promised.'), requires: ['main7'], auto: false, giver: 'npc_kirishima',
    steps: [{ kind: 'boss', enc: 'rm_kirishima', obj: T('แมตช์แก้มือกับคิริชิมะ', 'Rematch Kirishima'), say: [{ s: 'kirishima', t: T('ครั้งนี้ไม่มีแถว ไม่มีกฎ มีแค่เรา', 'No lines this time. No rules. Just us.') }], after: [{ s: 'kirishima', t: T('...ยังเป็นนายอยู่ดี ครั้งหน้าอีก', '...Still you. Next time, then.') }] }],
    reward: { exp: 2600, money: 6000, rep: 800, rel: { kirishima: 20 } } },
  { id: 'rematch_goda', type: 'duel', title: T('แมตช์แก้มือ: เครนเหล็ก', 'Rematch: Iron Crane'), desc: T('โกดะอยากลองแรงกับนายอีกครั้ง แบบเพื่อน', 'Goda wants to test his strength again, as friends.'), requires: ['main7'], auto: false, giver: 'npc_goda',
    steps: [{ kind: 'boss', enc: 'rm_goda', obj: T('ประลองกับโกดะ', 'Spar with Goda'), say: [{ s: 'goda', t: T('คราวนี้ไม่มีใครบงการ แค่เครนเหล็กกับเด็กจากทะเล', 'No puppet strings this time. Just the Iron Crane and the kid from the sea.') }], after: [{ s: 'goda', t: T('ฮ่าๆ! มิโนรุ ถ่ายรูปไว้ยัง?', 'Haha! Minoru, did you get that on camera?') }] }],
    reward: { exp: 2600, money: 6000, rep: 800, rel: { goda: 20 } } },
  { id: 'tournament', type: 'duel', title: T('ทัวร์นาเมนต์ใต้ดิน', 'Underground Tournament'), desc: T('ห้ารอบ ห้าคู่ต่อสู้ แชมป์คนเดียว (จัดตอนกลางคืน)', 'Five rounds, five opponents, one champion. (held at night)'), requires: ['main10'], auto: false, giver: 'board_arena',
    steps: [
      { kind: 'goto', place: 'arena', night: true, obj: T('ไปสังเวียนใต้ดินตอนกลางคืน', 'Go to the Underground Arena at night'), say: [{ s: 'kanemura', t: T('เก็กโคไปแล้ว โรงงานว่าง ฉันเลยจัดทัวร์นาเมนต์ ค่าสมัครฟรี ค่าดูแพง', 'Gekko\'s gone, the factory\'s empty, so I\'m running a tournament. Entry\'s free. Watching isn\'t.') }] },
      { kind: 'defeat', enc: 'tour_1', obj: T('รอบ 1: ไค & อิชิดะ', 'Round 1: Kai & Ishida'), heal: true },
      { kind: 'boss', enc: 'tour_2', obj: T('รอบ 2: มิคามิ', 'Round 2: Mikami'), heal: true, say: [{ s: 'mikami', t: T('ซ้ายของฉันเร็วขึ้นแล้วนะ', 'My left got faster.') }] },
      { kind: 'boss', enc: 'tour_3', obj: T('รอบ 3: ฮิมุโระ', 'Round 3: Himuro'), heal: true },
      { kind: 'boss', enc: 'tour_4', obj: T('รอบรองชนะเลิศ: ฮายาเตะ', 'Semi-final: Hayate'), heal: true, say: [{ s: 'hayate', t: T('บอกแล้วว่าคาเงโรติดหนี้นาย... แต่ไม่ได้บอกว่าจะยอมแพ้', 'I said Kagero owes you... I never said I\'d go easy.') }] },
      { kind: 'boss', enc: 'tour_5', obj: T('ชิงชนะเลิศ: อาคางิ', 'Final: Akagi'), heal: true, say: [{ s: 'akagi', t: T('ฮ่าๆ! ยักษ์แดงกลับมาแล้ว!', 'HAHA! The Red Oni returns!') }], after: [{ s: 'kanemura', t: T('แชมป์คนใหม่ของใต้ดิน: ฮารุ โบยะ!', 'The new champion of the underground: HARU BOYA!') }, { s: 'narrator', t: T('...มีคนเห็นซาคากิบาระเซนเซยืนดูอยู่ท้ายห้อง ยิ้มเล็กน้อย', '...Someone spots Sakakibara-sensei at the back of the crowd, smiling faintly.') }] },
    ], reward: { exp: 9000, money: 50000, rep: 3000, sp: 2 } },
  { id: 'secret_sakaki', type: 'duel', title: T('???: การกักบริเวณ', '???: Detention'), desc: T('ครูที่ไม่เคยแพ้ใครเรียกเธอมาที่สนามโรงเรียนตอนดึก', 'The teacher who has never lost calls you to the school yard, late at night.'), requires: ['tournament'], auto: false, giver: 'npc_sakaki',
    steps: [
      { kind: 'goto', place: 'kuro_night', night: true, obj: T('ไปสนามคุโรงาเนะตอนกลางคืน', 'Go to the Kurogane yard at night'), say: [{ s: 'sakaki', t: T('โบยะคุง เธอขาดเรียนสามสิบสองวัน ครูมีวิธีทำโทษแบบพิเศษ', 'Boya-kun, you have missed thirty-two days of class. I have a special kind of detention.') }] },
      { kind: 'boss', enc: 'sc_sakaki', obj: T('บอสลับ: ซาคากิบาระเซนเซ', 'Secret boss: Sakakibara-sensei'), heal: true, say: [{ s: 'sakaki', t: T('ถอดแว่นแล้วนะ ...ครูมองไม่ค่อยเห็น เพราะฉะนั้นอย่าถือสา', 'I\'ve taken off my glasses. ...I can\'t see very well, so please don\'t take it personally.') }],
        after: [{ s: 'sakaki', t: T('...ยอดเยี่ยม ครูให้ผ่าน แต่พรุ่งนี้ต้องมาเรียนนะ', '...Excellent. You pass. But you are coming to class tomorrow.') }, { s: 'haru', t: T('...ครับ', '...Yes, sir.') }] },
    ], reward: { exp: 12000, money: 30000, rep: 5000, rel: { sakaki: 50 }, sp: 3 } },
];
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map(q => [q.id, q]));
