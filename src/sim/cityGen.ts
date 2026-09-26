import { ZONES, LANDMARKS, TRACKS, POND, ROOF, RIVER, BRIDGES, MAP_HALF, ROADS } from '../data/city';
import { mulberry32 } from '../core/rng';
import { Collision } from './collision';

export interface Building { x0: number; z0: number; x1: number; z1: number; h: number; color: string; kind: string; sign?: string; signColor?: string; signSide?: string }
export interface Prop { t: string; x: number; z: number; rot?: number; w?: number; d?: number; h?: number; color?: string; layer?: number; text?: string }
export interface Patch { x0: number; z0: number; x1: number; z1: number; kind: 'road' | 'grass' | 'dirt' | 'concrete' | 'tile' | 'water' | 'parking' | 'deck' | 'roof' | 'rail' }
export interface CityData { buildings: Building[]; props: Prop[]; patches: Patch[]; lamps: [number, number][]; col: Collision; neon: Prop[] }

const RES_COLS = ['#c9b79c', '#b8a48a', '#d8cbb4', '#a99c8c', '#c4b0a0', '#9da6a8', '#d4c4a8', '#b0907a'];
const OFF_COLS = ['#8e9aa6', '#a6adb4', '#7d8792', '#b8bcc0', '#6f7a86', '#9aa3a0'];
const SHOP_COLS = ['#c86a4a', '#d8b060', '#6a9ac8', '#b84a5a', '#e0d0b0', '#7aa870', '#c89a6a'];
const SIGNS = ['カフェ', '本屋', '薬局', 'ゲーム', '居酒屋', '花屋', 'カラオケ', '古着', 'たこ焼き', '喫茶', 'パン', '銭湯', '床屋', '寿司'];
const SIGN_COLS = ['#ff4060', '#40c0ff', '#ffd040', '#60ff90', '#ff80ff', '#ff9040'];

export function generateCity(): CityData {
  const rnd = mulberry32(1337);
  const col = new Collision();
  const buildings: Building[] = []; const props: Prop[] = []; const patches: Patch[] = []; const lamps: [number, number][] = []; const neon: Prop[] = [];
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const addB = (b: Building) => { buildings.push(b); col.addBox({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, h: b.h, layer: 0 }); };
  const overlaps = (x0: number, z0: number, x1: number, z1: number, pad = 0.5) => buildings.some(b => x0 < b.x1 + pad && x1 > b.x0 - pad && z0 < b.z1 + pad && z1 > b.z0 - pad);
  const solidProp = (p: Prop, w: number, d: number, h: number) => { props.push(p); const c = Math.abs(Math.cos(p.rot || 0)) > 0.5; const hw = (c ? w : d) / 2, hd = (c ? d : w) / 2; col.addBox({ x0: p.x - hw, z0: p.z - hd, x1: p.x + hw, z1: p.z + hd, h, layer: p.layer || 0 }); };
  const fence = (x0: number, z0: number, x1: number, z1: number, gaps: [number, number][] = [], h = 2.2, color = '#5a6a60', layer = 0) => {
    const horiz = Math.abs(z1 - z0) < 0.01; const a0 = horiz ? Math.min(x0, x1) : Math.min(z0, z1), a1 = horiz ? Math.max(x0, x1) : Math.max(z0, z1);
    const segs: [number, number][] = []; let cur = a0; for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { if (g0 > cur) segs.push([cur, g0]); cur = Math.max(cur, g1); } if (cur < a1) segs.push([cur, a1]);
    for (const [s0, s1] of segs) {
      const L = s1 - s0; if (L < 0.2) continue; const m = (s0 + s1) / 2;
      const p: Prop = horiz ? { t: 'fence', x: m, z: z0, w: L, d: 0.25, h, color, layer } : { t: 'fence', x: x0, z: m, w: 0.25, d: L, h, color, layer };
      props.push(p); col.addBox({ x0: p.x - p.w! / 2, z0: p.z - p.d! / 2, x1: p.x + p.w! / 2, z1: p.z + p.d! / 2, h, layer });
    }
  };
  // ---------- ground ----------
  for (const r of ROADS) patches.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], kind: r[1] === 108 || r[1] === 136 && r[3] === 136 ? 'deck' : 'road' });
  patches.push({ x0: -4, z0: -78, x1: 4, z1: -8, kind: 'tile' });
  patches.push({ x0: -200, z0: RIVER.z0, x1: 200, z1: RIVER.z1, kind: 'water' });
  for (const [a, b] of BRIDGES) patches.push({ x0: a, z0: RIVER.z0 - 0.1, x1: b, z1: RIVER.z1 + 0.1, kind: 'deck' });
  patches.push({ x0: -196, z0: -165, x1: -88, z1: -90, kind: 'dirt' });
  patches.push({ x0: 90, z0: -166, x1: 196, z1: -90, kind: 'concrete' });
  patches.push({ x0: -196, z0: 10, x1: -86, z1: 94, kind: 'grass' });
  patches.push({ x0: 8, z0: 12, x1: 72, z1: 62, kind: 'parking' });
  patches.push({ x0: -196, z0: 150, x1: -6, z1: 176, kind: 'dirt' });
  patches.push({ x0: 6, z0: 150, x1: 196, z1: 196, kind: 'concrete' });
  patches.push({ x0: TRACKS[0], z0: TRACKS[1], x1: TRACKS[2], z1: TRACKS[3], kind: 'rail' });
  patches.push({ x0: ROOF.rect[0], z0: ROOF.rect[1], x1: ROOF.rect[2], z1: ROOF.rect[3], kind: 'roof' });

  // ---------- landmarks ----------
  for (const l of LANDMARKS) addB({ x0: l.rect[0], z0: l.rect[1], x1: l.rect[2], z1: l.rect[3], h: l.h, color: l.color || '#999', kind: l.kind, sign: l.sign, signColor: l.signColor, signSide: l.id === 'konbini' ? 's' : l.id === 'ramen' ? 'e' : 'n' });
  // Rooftop furniture (layer 1) and fence
  const [rx0, rz0, rx1, rz1] = ROOF.rect;
  fence(rx0, rz0, rx1, rz0, [], 1.6, '#8a9a90', 1); fence(rx0, rz1, rx1, rz1, [], 1.6, '#8a9a90', 1); fence(rx0, rz0, rx0, rz1, [], 1.6, '#8a9a90', 1); fence(rx1, rz0, rx1, rz1, [], 1.6, '#8a9a90', 1);
  solidProp({ t: 'stairhouse', x: -130, z: -174, w: 6, d: 4, h: 3.2, layer: 1, color: '#9a9890' }, 6, 4, 3.2);
  solidProp({ t: 'tank', x: -172, z: -182, w: 5, d: 5, h: 4, layer: 1, color: '#b0b8bc' }, 5, 5, 4);
  // School fences with gates
  fence(-196, -90, -88, -90, [[-142, -118]]); fence(-196, -196, -196, -90); fence(-196, -196, -88, -196); fence(-88, -150, -88, -90);
  fence(88, -90, 196, -90, [[128, 152]]); fence(196, -196, 196, -90); fence(88, -196, 196, -196); fence(88, -128, 88, -90);
  fence(-196, 150, -6, 150, [[-122, -98], [-40, -20]]); fence(-196, 150, -196, 196);
  // Schoolyard props
  for (let i = 0; i < 6; i++) props.push({ t: 'tree', x: -190 + i * 18, z: -160 });
  props.push({ t: 'goal', x: -170, z: -120, rot: Math.PI / 2 }); props.push({ t: 'goal', x: -104, z: -120, rot: -Math.PI / 2 });
  for (let i = 0; i < 8; i++) { const x = 96 + i * 13, z = -164; props.push({ t: 'sakura', x, z }); col.addCircle({ x, z, r: 0.6, layer: 0 }); }
  for (let i = 0; i < 4; i++) { const x = 120 + i * 20, z = -100; props.push({ t: 'sakura', x, z }); col.addCircle({ x, z, r: 0.6, layer: 0 }); }
  props.push({ t: 'dojo_sign', x: 104.2, z: -144, rot: Math.PI / 2, text: '白龍道場' });
  // ---------- shopping arcade ----------
  const shopRow = (x0: number, x1: number, zs: number, ze: number, side: 'e' | 'w') => {
    let z = zs;
    while (z < ze - 5) {
      const w = 6 + Math.floor(rnd() * 4); const z1 = Math.min(ze, z + w);
      if (!overlaps(x0, z, x1, z1, 0.05)) { const c = pick(SIGN_COLS); addB({ x0, z0: z, x1, z1, h: 6 + Math.floor(rnd() * 3) * 3, color: pick(SHOP_COLS), kind: 'shop', sign: pick(SIGNS), signColor: c, signSide: side }); }
      z = z1;
    }
  };
  shopRow(-16, -5, -77, -9, 'e'); shopRow(5, 16, -77, -25, 'w');
  for (let z = -74; z <= -12; z += 8) { props.push({ t: 'arch', x: 0, z }); props.push({ t: 'lantern', x: -3.4, z: z + 4 }); props.push({ t: 'lantern', x: 3.4, z: z + 4 }); }
  props.push({ t: 'arcade_gate', x: 0, z: -9, text: 'ひので商店街' }); props.push({ t: 'arcade_gate', x: 0, z: -77, text: 'ひので商店街' });
  solidProp({ t: 'vending', x: 4.3, z: -48, rot: -Math.PI / 2, color: '#d03030' }, 1.2, 0.8, 1.9); solidProp({ t: 'vending', x: -4.3, z: -60, rot: Math.PI / 2, color: '#3070d0' }, 1.2, 0.8, 1.9);
  solidProp({ t: 'vending', x: 23, z: -9.5, rot: 0, color: '#30a060' }, 1.2, 0.8, 1.9);
  // ---------- park ----------
  const [pcx, pcz, pr] = POND; patches.push({ x0: pcx - pr, z0: pcz - pr, x1: pcx + pr, z1: pcz + pr, kind: 'water' });
  props.push({ t: 'pond', x: pcx, z: pcz, w: pr }); col.addCircle({ x: pcx, z: pcz, r: pr, layer: 0 });
  for (let i = 0; i < 70; i++) {
    const x = -192 + rnd() * 104, z = 14 + rnd() * 78;
    if (Math.hypot(x - pcx, z - pcz) < pr + 4 || Math.abs(z - 40) < 4 || Math.abs(x + 120) < 4 || (x > -176 && x < -164 && z > 80)) continue;
    props.push({ t: rnd() < 0.25 ? 'sakura' : 'tree', x, z }); col.addCircle({ x, z, r: 0.55, layer: 0 });
  }
  props.push({ t: 'bench', x: -120, z: 31.5 }); props.push({ t: 'bench', x: -110, z: 31.5 }); props.push({ t: 'bench', x: 20, z: 105.5 });
  props.push({ t: 'playground', x: -100, z: 70 }); col.addBox({ x0: -103, z0: 68, x1: -97, z1: 72, h: 3, layer: 0 });
  props.push({ t: 'torii', x: -170, z: 20, text: '' });
  // ---------- parking lot ----------
  const CAR = ['#c83030', '#3050c0', '#e0e0e0', '#202020', '#e0c040', '#40a060', '#808890'];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
    if (rnd() < 0.35) continue; const x = 14 + i * 6.5, z = 20 + row * 14;
    solidProp({ t: 'car', x, z, rot: Math.PI / 2, color: pick(CAR) }, 4.2, 1.9, 1.5);
  }
  for (let i = 0; i < 5; i++) solidProp({ t: 'bike', x: 60 + (i % 3) * 3, z: 55 + Math.floor(i / 3) * 3, rot: rnd() * 6, color: '#6a3a9a' }, 1.8, 0.7, 1.1);
  // ---------- station ----------
  patches.push({ x0: 118, z0: 30, x1: 172, z1: 40, kind: 'concrete' });
  fence(86, 40, 198, 40, [[130, 160]], 1.4, '#707070'); fence(86, 48, 198, 48, [], 1.4, '#707070');
  col.addBox({ x0: TRACKS[0], z0: TRACKS[1] + 0.3, x1: TRACKS[2], z1: TRACKS[3] - 0.3, h: 1.2, layer: 0 });
  props.push({ t: 'train', x: 150, z: 44, w: 60 });
  props.push({ t: 'clock', x: 145, z: 11.5 });
  // ---------- river railings & bridges ----------
  const gapsN: [number, number][] = BRIDGES.map(([a, b]) => [a, b]);
  fence(-198, RIVER.z0, 198, RIVER.z0, gapsN, 1.1, '#9aa0a0'); fence(-198, RIVER.z1, 198, RIVER.z1, gapsN, 1.1, '#9aa0a0');
  for (const [a, b] of BRIDGES) { fence(a, RIVER.z0, a, RIVER.z1, [], 1.2, '#c05040'); fence(b, RIVER.z0, b, RIVER.z1, [], 1.2, '#c05040'); props.push({ t: 'bridge', x: (a + b) / 2, z: (RIVER.z0 + RIVER.z1) / 2, w: b - a, d: RIVER.z1 - RIVER.z0 }); }
  // water collider = river minus bridges (keeps everyone out of the water)
  let cx0 = -200; for (const [a, b] of [...BRIDGES, [200, 200] as [number, number]]) { if (a > cx0) col.addBox({ x0: cx0, z0: RIVER.z0 + 0.2, x1: a, z1: RIVER.z1 - 0.2, h: 0.6, layer: 0 }); cx0 = b; }
  props.push({ t: 'fishing', x: -14, z: 106.8 });
  // ---------- warehouse district ----------
  const CONT = ['#b04030', '#3060a0', '#40804a', '#c08030', '#707070'];
  const contSpots: [number, number, number][] = [[30, 158, 0], [44, 158, 0], [70, 168, 1], [78, 186, 1], [100, 158, 0], [96, 190, 1], [60, 170, 0], [150, 156, 0], [178, 158, 0], [112, 176, 1]];
  for (const [x, z, r] of contSpots) solidProp({ t: 'container', x, z, rot: r ? Math.PI / 2 : 0, color: pick(CONT) }, 6, 2.5, 2.6);
  for (let i = 0; i < 14; i++) { const x = 20 + rnd() * 170, z = 152 + rnd() * 12; if (overlaps(x - 1, z - 1, x + 1, z + 1, 1)) continue; solidProp({ t: 'crate', x, z, rot: 0 }, 1.2, 1.2, 1.2); }
  fence(6, 150, 198, 150, [[80, 104], [150, 160]], 2.4, '#6a6a60'); fence(198, 150, 198, 196, [], 2.4, '#6a6a60');
  props.push({ t: 'lamp_flood', x: 100, z: 164 });
  // Tetsuwan yard
  for (let i = 0; i < 5; i++) solidProp({ t: 'crate', x: -60 + i * 3, z: 172, rot: 0 }, 1.2, 1.2, 1.2);
  props.push({ t: 'goal', x: -150, z: 163, rot: Math.PI / 2 });

  // ---------- generic city blocks ----------
  const cells: [number, number, number, number, string][] = [];
  const xsN: [number, number][] = [[-198, -84], [-76, -4], [4, 76], [84, 198]]; const zsN: [number, number][] = [[-198, -86], [-78, -8], [8, 96]];
  for (const [x0, x1] of xsN) for (const [z0, z1] of zsN) {
    const z = ZONES.find(zn => zn.rect[0] <= (x0 + x1) / 2 && zn.rect[2] >= (x0 + x1) / 2 && zn.rect[1] <= (z0 + z1) / 2 && zn.rect[3] >= (z0 + z1) / 2);
    cells.push([x0, z0, x1, z1, z ? z.kind : 'res']);
  }
  cells.push([-60, 152, -6, 198, 'res']);
  for (const [x0, zz0, x1, z1, kind] of cells) {
    const z0 = kind === 'parking' ? 64 : kind === 'station' ? 52 : zz0;
    if (kind === 'school' || kind === 'park' || kind === 'river') continue;
    if (kind === 'alley' || (x0 === -76 && z0 === -78)) { // dense back alleys (west of arcade)
      for (let gx = -74; gx < -20; gx += 11.5) for (let gz = -76; gz < -12; gz += 11) {
        if (rnd() < 0.12) continue; const w = 7 + rnd() * 1.5, d = 7 + rnd() * 1.5;
        if (!overlaps(gx, gz, gx + w, gz + d, 0.4)) addB({ x0: gx, z0: gz, x1: gx + w, z1: gz + d, h: 5 + Math.floor(rnd() * 4) * 3, color: pick(RES_COLS), kind: 'alley' });
      }
      continue;
    }
    const isOffice = kind === 'office' || kind === 'station'; const inset = 3.2;
    const bx0 = x0 + inset, bz0 = z0 + inset, bx1 = x1 - inset, bz1 = z1 - inset;
    const edge = (horiz: boolean, fixed: number, a0: number, a1: number, dir: number) => {
      let a = a0;
      while (a < a1 - 6) {
        const w = Math.min(a1 - a, 8 + rnd() * 9), d = 8 + rnd() * 7;
        let r: [number, number, number, number] = horiz ? [a, dir > 0 ? fixed : fixed - d, a + w, dir > 0 ? fixed + d : fixed] : [dir > 0 ? fixed : fixed - d, a, dir > 0 ? fixed + d : fixed, a + w];
        const clampR = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)); r = [clampR(r[0], bx0, bx1), clampR(r[1], bz0, bz1), clampR(r[2], bx0, bx1), clampR(r[3], bz0, bz1)];
        if (r[2] - r[0] > 4 && r[3] - r[1] > 4 && !overlaps(r[0], r[1], r[2], r[3], 0.6)) {
          const h = isOffice ? 14 + Math.floor(rnd() * 8) * 3 : 6 + Math.floor(rnd() * 4) * 3;
          addB({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], h, color: isOffice ? pick(OFF_COLS) : pick(RES_COLS), kind: isOffice ? 'office' : 'res' });
        }
        a += w + (rnd() < 0.3 ? 3.5 : 0.4);
      }
    };
    edge(true, bz0, bx0, bx1, 1); edge(true, bz1, bx0, bx1, -1); edge(false, bx0, bz0 + 8, bz1 - 8, 1); edge(false, bx1, bz0 + 8, bz1 - 8, -1);
  }
  // ---------- boundary wall (visual; movement is clamped) ----------
  props.push({ t: 'boundary', x: 0, z: 0, w: MAP_HALF });
  // ---------- street lamps along roads (skip if inside a building) ----------
  const lamp = (x: number, z: number) => { if (overlaps(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0.2) || col.insideSolid(x, z, 0)) return; lamps.push([x, z]); col.addCircle({ x, z, r: 0.18, layer: 0 }); };
  for (let x = -190; x <= 190; x += 22) { lamp(x, -9.2); lamp(x + 11, 9.2); lamp(x, -87.2); lamp(x + 11, 95.2); lamp(x + 5, 149); }
  for (let z = -190; z <= 90; z += 22) { if (Math.abs(z) < 12 || Math.abs(z + 82) < 8) continue; lamp(-85.2, z); lamp(-74.8, z + 11); lamp(74.8, z); lamp(85.2, z + 11); }
  for (let z = 12; z <= 92; z += 20) { lamp(-5.2, z); lamp(5.2, z + 10); }
  for (const [x, z] of [[-150, 40], [-120, 20], [-130, 75], [-160, 30], [-100, 50], [30, 38], [50, 62], [100, 160], [140, 160], [-150, 160], [-80, 162], [-140, -100], [-110, -140], [130, -110], [160, -140]] as [number, number][]) lamp(x, z);
  for (const b of buildings) if (b.sign) neon.push({ t: 'neon', x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, color: b.signColor, text: b.sign });
  return { buildings, props, patches, lamps, col, neon };
}
