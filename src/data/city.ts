import type { ZoneDef, LText } from './types';
// Akebono City layout. x = east, z = south. Units: meters. Map bounds +-198.
export const MAP_HALF = 198;
export const RIVER = { z0: 108, z1: 136 };
export const BRIDGES: [number, number][] = [[-7, 7], [110, 124]];
// Roads (walkable asphalt strips). [x0,z0,x1,z1]
export const ROADS: [number, number, number, number][] = [
  [-200, -86, 200, -78], // Kita-dori
  [-200, -8, 200, 8],    // Chuo-dori (main road)
  [-200, 96, 200, 108],  // Riverside road + north bank
  [-200, 136, 200, 148], // South bank road
  [-84, -200, -76, 96],  // West avenue
  [76, -200, 84, 96],    // East avenue
  [-4, 8, 4, 96],        // Bridge road
  [-7, 108, 7, 136],     // Bridge 1 deck
  [110, 108, 124, 136],  // Bridge 2 deck
  [-4, 148, 4, 200],     // South road
];
export const ARCADE: [number, number, number, number] = [-4, -78, 4, -8]; // shopping arcade (pedestrian)

export const ZONES: ZoneDef[] = [
  { id: 'kurogane', kind: 'school', name: { th: 'โรงเรียนคุโรงาเนะ', en: 'Kurogane High' }, rect: [-198, -198, -84, -86], gang: 'kurogane', spawnDensity: 1 },
  { id: 'hakuryu', kind: 'school', name: { th: 'สถาบันฮาคุริว', en: 'Hakuryu Academy' }, rect: [84, -198, 198, -86], gang: 'hakuryu', spawnDensity: 1 },
  { id: 'residential_n', kind: 'res', name: { th: 'ย่านที่พักทิศเหนือ', en: 'North Residential' }, rect: [-76, -198, 76, -86], spawnDensity: 0.2 },
  { id: 'residential_w', kind: 'res', name: { th: 'ซอยหลังคุโรงาเนะ', en: 'Kurogane Backstreets' }, rect: [-198, -78, -84, -8], gang: 'kurogane', spawnDensity: 0.6 },
  { id: 'alleys', kind: 'alley', name: { th: 'ตรอกหลังเมือง', en: 'Back Alleys' }, rect: [-76, -78, -16, -8], gang: 'kagero', spawnDensity: 0.8 },
  { id: 'shotengai', kind: 'shop', name: { th: 'ย่านการค้าฮิโนเดะ', en: 'Hinode Shopping Street' }, rect: [-16, -78, 30, -8], gang: 'onigawara', spawnDensity: 0.5 },
  { id: 'office_e', kind: 'office', name: { th: 'ย่านออฟฟิศ', en: 'Office District' }, rect: [30, -78, 198, -8], gang: 'hakuryu', spawnDensity: 0.3 },
  { id: 'mainroad', kind: 'road', name: { th: 'ถนนชูโอ', en: 'Chuo Main Road' }, rect: [-198, -8, 198, 8], gang: 'yamikaze', spawnDensity: 0.3 },
  { id: 'park', kind: 'park', name: { th: 'สวนมิโดริ', en: 'Midori Park' }, rect: [-198, 8, -84, 96], spawnDensity: 0.3 },
  { id: 'residential_c', kind: 'res', name: { th: 'ย่านที่พักกลางเมือง', en: 'Central Residential' }, rect: [-76, 8, 4, 96], spawnDensity: 0.2 },
  { id: 'parking', kind: 'parking', name: { th: 'ลานจอดรถ', en: 'Parking Lot' }, rect: [4, 8, 76, 96], gang: 'yamikaze', spawnDensity: 0.9 },
  { id: 'station', kind: 'station', name: { th: 'สถานีอาเคโบโนะ', en: 'Akebono Station' }, rect: [84, 8, 198, 96], gang: 'rokkaku', spawnDensity: 0.2 },
  { id: 'riverside', kind: 'river', name: { th: 'ริมแม่น้ำและสะพาน', en: 'Riverside & Bridge' }, rect: [-198, 96, 198, 148], gang: 'kawabata', spawnDensity: 0.2 },
  { id: 'tetsuwan', kind: 'school', name: { th: 'เทคนิคเท็ตสึวัน', en: 'Tetsuwan Technical' }, rect: [-198, 148, -4, 198], gang: 'tetsuwan', spawnDensity: 1 },
  { id: 'warehouse', kind: 'industrial', name: { th: 'โรงงานร้างเท็กคตสึ', en: 'Old Tekkotsu Factory' }, rect: [4, 148, 198, 198], gang: 'tekkotsu', spawnDensity: 0.9 },
];

// Hand-placed landmark buildings/colliders. h = height; kind selects visuals.
export interface Landmark { id: string; kind: string; rect: [number, number, number, number]; h: number; color?: string; sign?: string; signColor?: string; roof?: boolean }
export const LANDMARKS: Landmark[] = [
  // Kurogane High: main building, gym, fence
  { id: 'kuro_main', kind: 'school', rect: [-190, -192, -104, -168], h: 15, color: '#8c8a84' },
  { id: 'kuro_gym', kind: 'gym', rect: [-100, -192, -88, -150], h: 10, color: '#6d6a66' },
  // Hakuryu Academy
  { id: 'haku_main', kind: 'school', rect: [104, -192, 190, -168], h: 16, color: '#e2e2de' },
  { id: 'haku_dojo', kind: 'dojo', rect: [88, -160, 104, -128], h: 8, color: '#5a3a2a' },
  // Shopping street special shops (west side = ramen)
  { id: 'ramen', kind: 'shop', rect: [-16, -40, -5, -28], h: 7, color: '#b24a2a', sign: 'ラーメン まるいち', signColor: '#ff3030' },
  { id: 'konbini', kind: 'shop', rect: [5, -24, 22, -10], h: 5, color: '#e8e8e8', sign: 'ハッピーマート', signColor: '#20c060' },
  // Station
  { id: 'station', kind: 'station', rect: [118, 14, 172, 30], h: 12, color: '#b8b4a8', sign: '曙駅 AKEBONO STN', signColor: '#40a0ff' },
  { id: 'gym_box', kind: 'shop', rect: [176, 14, 194, 28], h: 6, color: '#7a2a2a', sign: '六角ボクシング', signColor: '#ff5050' },
  // Tetsuwan Technical
  { id: 'tetsu_main', kind: 'school', rect: [-190, 176, -110, 194], h: 12, color: '#7c7f86' },
  { id: 'tetsu_shop', kind: 'garage', rect: [-104, 176, -64, 194], h: 9, color: '#566070' },
  // Warehouse district
  { id: 'wh_big', kind: 'warehouse', rect: [120, 166, 190, 194], h: 14, color: '#6e5a48' },
  { id: 'wh_small', kind: 'warehouse', rect: [20, 176, 60, 194], h: 10, color: '#5e6064' },
];
// Train tracks (collider strip, fenced) through station zone.
export const TRACKS: [number, number, number, number] = [86, 40, 198, 48];
// Park pond (collider)
export const POND: [number, number, number] = [-150, 60, 14]; // cx, cz, r
// Rooftop of Kurogane main building (separate layer)
export const ROOF = { rect: [-188, -190, -106, -170] as [number, number, number, number], y: 15, door: [-130, -166] as [number, number], roofSpawn: [-130, -173] as [number, number] };

export interface Interactable { id: string; pos: [number, number]; kind: 'npc' | 'shop' | 'door' | 'bench' | 'bus' | 'item' | 'board'; label: LText; npc?: string; layer?: number }
export const INTERACTABLES: Interactable[] = [
  { id: 'npc_kenta', kind: 'npc', npc: 'kenta', pos: [136, 4], label: { th: 'คุยกับเคนตะ', en: 'Talk to Kenta' } },
  { id: 'shop_ramen', kind: 'shop', pos: [-3.5, -34], label: { th: 'ร้านราเมง (ฟื้นพลัง/ซื้อ)', en: 'Ramen Shop (heal / buy)' } },
  { id: 'shop_konbini', kind: 'shop', pos: [13, -8.5], label: { th: 'ร้านสะดวกซื้อ', en: 'Convenience Store' } },
  { id: 'npc_saeko', kind: 'npc', npc: 'saeko', pos: [-4, -30], label: { th: 'คุยกับซาเอโกะ', en: 'Talk to Saeko' } },
  { id: 'npc_genzo', kind: 'npc', npc: 'genzo', pos: [-14, 105], label: { th: 'คุยกับเก็นโซ', en: 'Talk to Genzo' } },
  { id: 'npc_mikami', kind: 'npc', npc: 'mikami', pos: [185, 32], label: { th: 'คุยกับมิคามิ', en: 'Talk to Mikami' } },
  { id: 'npc_nakagawa', kind: 'npc', npc: 'nakagawa', pos: [-120, -84], label: { th: 'คุยกับนากางาวะ', en: 'Talk to Nakagawa' } },
  { id: 'npc_minoru', kind: 'npc', npc: 'minoru', pos: [-60, 145], label: { th: 'คุยกับมิโนรุ', en: 'Talk to Minoru' } },
  { id: 'npc_daigo', kind: 'npc', npc: 'daigo', pos: [-150, -178], layer: 1, label: { th: 'คุยกับไดโกะ', en: 'Talk to Daigo' } },
  { id: 'npc_granny', kind: 'npc', npc: 'granny', pos: [20, -4], label: { th: 'คุณยายดูกังวล', en: 'A worried grandma' } },
  { id: 'door_roof', kind: 'door', pos: [-130, -166.5], label: { th: 'ขึ้นดาดฟ้า', en: 'Go to rooftop' } },
  { id: 'door_roof_down', kind: 'door', pos: [-130, -174.6], layer: 1, label: { th: 'ลงจากดาดฟ้า', en: 'Go downstairs' } },
  { id: 'bench_park', kind: 'bench', pos: [-120, 30], label: { th: 'นั่งพัก (ข้ามเวลา)', en: 'Rest (skip time)' } },
  { id: 'bench_river', kind: 'bench', pos: [20, 104], label: { th: 'นั่งพัก (ข้ามเวลา)', en: 'Rest (skip time)' } },
  { id: 'bus_station', kind: 'bus', pos: [110, 10], label: { th: 'ป้ายรถเมล์ (เดินทางด่วน)', en: 'Bus stop (fast travel)' } },
  { id: 'bus_kuro', kind: 'bus', pos: [-120, -76], label: { th: 'ป้ายรถเมล์ (เดินทางด่วน)', en: 'Bus stop (fast travel)' } },
  { id: 'bus_haku', kind: 'bus', pos: [120, -76], label: { th: 'ป้ายรถเมล์ (เดินทางด่วน)', en: 'Bus stop (fast travel)' } },
  { id: 'bus_shop', kind: 'bus', pos: [-6, -6], label: { th: 'ป้ายรถเมล์ (เดินทางด่วน)', en: 'Bus stop (fast travel)' } },
  { id: 'bus_south', kind: 'bus', pos: [-8, 150], label: { th: 'ป้ายรถเมล์ (เดินทางด่วน)', en: 'Bus stop (fast travel)' } },
  { id: 'bus_park', kind: 'bus', pos: [-88, 20], label: { th: 'ป้ายรถเมล์ (เดินทางด่วน)', en: 'Bus stop (fast travel)' } },
  { id: 'item_cat', kind: 'item', pos: [-170, 88], label: { th: 'แมวสามสี!', en: 'A calico cat!' } },
];
export const BUS_STOPS = INTERACTABLES.filter(i => i.kind === 'bus');

// Named places for quest targets / fast travel / debug teleport.
export const PLACES: Record<string, { pos: [number, number]; layer?: number; name: LText }> = {
  station: { pos: [136, 6], name: { th: 'สถานีอาเคโบโนะ', en: 'Akebono Station' } },
  shotengai: { pos: [0, -40], name: { th: 'ย่านการค้าฮิโนเดะ', en: 'Hinode Shopping Street' } },
  ramen: { pos: [-2, -34], name: { th: 'ร้านราเมงมารุอิจิ', en: 'Maruichi Ramen' } },
  konbini: { pos: [13, -6], name: { th: 'ร้านสะดวกซื้อ', en: 'Convenience Store' } },
  kurogane_yard: { pos: [-140, -130], name: { th: 'สนามโรงเรียนคุโรงาเนะ', en: 'Kurogane Schoolyard' } },
  kurogane_roof: { pos: [-140, -180], layer: 1, name: { th: 'ดาดฟ้าคุโรงาเนะ', en: 'Kurogane Rooftop' } },
  hakuryu_yard: { pos: [140, -130], name: { th: 'ลานฮาคุริว', en: 'Hakuryu Courtyard' } },
  park: { pos: [-120, 40], name: { th: 'สวนมิโดริ', en: 'Midori Park' } },
  parking: { pos: [40, 50], name: { th: 'ลานจอดรถ', en: 'Parking Lot' } },
  bridge: { pos: [0, 122], name: { th: 'สะพานอาเคโบโนะ', en: 'Akebono Bridge' } },
  underbridge: { pos: [-14, 103], name: { th: 'ใต้สะพาน', en: 'Under the Bridge' } },
  tetsuwan_yard: { pos: [-110, 164], name: { th: 'ลานเท็ตสึวัน', en: 'Tetsuwan Yard' } },
  warehouse: { pos: [100, 170], name: { th: 'โรงงานร้าง', en: 'Old Factory' } },
  alleys: { pos: [-45, -45], name: { th: 'ตรอกหลังเมือง', en: 'Back Alleys' } },
  station_gym: { pos: [185, 34], name: { th: 'ยิมมวยร็อกคาคุ', en: 'Rokkaku Gym' } },
};
