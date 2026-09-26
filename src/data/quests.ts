import type { LText } from './types';
const T = (th: string, en: string): LText => ({ th, en });

export interface DLine { s: string; t: LText; choices?: { t: LText; rel?: Record<string, number>; rep?: number; flag?: string }[] }
export interface EncounterMember { char?: string; gang?: string; tier?: 'grunt' | 'mid'; count?: number }
export interface Encounter { place: string; members: EncounterMember[]; radius?: number; night?: boolean }
export type Step =
  | { kind: 'goto'; place: string; radius?: number; obj: LText; say?: DLine[]; night?: boolean }
  | { kind: 'talk'; target: string; obj: LText; say?: DLine[] }
  | { kind: 'defeat'; enc: string; obj: LText; say?: DLine[]; after?: DLine[] }
  | { kind: 'boss'; enc: string; obj: LText; say?: DLine[]; after?: DLine[] }
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
  wh_thugs: { place: 'warehouse', members: [{ gang: 'tekkotsu', count: 3 }, { char: 'kanemura' }] },
};

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
        { s: 'narrator', t: T('คืนนั้น ร้านราเมงเล็กๆ ในย่านการค้า เต็มไปด้วยนักเลงจากห้าโรงเรียน นั่งกินด้วยกันเป็นครั้งแรก — จบบทที่ 3 (โปรดติดตามตอนต่อไป)', 'That night, a tiny ramen shop was packed with delinquents from five schools, eating together for the first time. END OF CHAPTER 3 (to be continued)') },
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
];
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map(q => [q.id, q]));
