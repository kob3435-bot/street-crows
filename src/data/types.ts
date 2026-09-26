// Shared data-layer types. All content (gangs, characters, quests, skills, zones)
// is pure data so it can be extended to 40-60 characters without code changes.
export type Lang = 'th' | 'en';
export interface LText { th: string; en: string }

export type HairStyle = 'pompadour' | 'spiky' | 'buzz' | 'long' | 'slick' | 'mohawk' | 'messy' | 'bald' | 'topknot';
export type Accessory = 'none' | 'headband' | 'shades' | 'mask' | 'chain' | 'bandage' | 'cap';
export interface Appearance {
  hair: HairStyle; hairColor: string; jacket: string; shirt: string; pants: string; shoes: string;
  skin: string; accessory: Accessory; build: number; height: number; longCoat?: boolean; openJacket?: boolean;
}

export type Tier = 'grunt' | 'mid' | 'miniboss' | 'boss';

export interface AIParams {
  aggression: number;     // 0..1 how eagerly it takes attack tokens
  blockRate: number;      // chance to block an incoming attack it sees
  dodgeRate: number;      // chance to side-step / backstep
  counterRate: number;    // chance to counter after a successful block/dodge
  comboMax: number;       // max chained hits
  range: number;          // preferred spacing (m) while circling
  speed: number;          // move speed multiplier
  reaction: number;       // reaction delay (s)
  retreatHp: number;      // hp fraction under which it retreats (0 = never)
  specialRate: number;    // chance to use special when available
  patience: number;       // seconds it is willing to wait for an opening
  grabRate: number;       // how often it uses grabs vs guard
  feint: number;          // chance to feint (step in, step out)
}

export interface BossPhase {
  name: LText; ai: Partial<AIParams>; moves: string[]; special: string; taunt: LText;
}

export interface Character {
  id: string; name: LText; jp: string; nickname: LText; age: number; gang: string; role: LText;
  personality: LText; backstory: LText; relations: Record<string, string>;
  power: number; style: LText; signature: LText; strengths: LText; weaknesses: LText;
  tier: Tier; fightable: boolean; hp: number; atk: number; def: number;
  ai: AIParams; moves: string[]; special?: string; phases?: BossPhase[];
  look: Appearance; relationStart?: number;
}

export interface Gang {
  id: string; name: LText; jp: string; color: string; accent: string; territory: string[];
  leader: string; members: number; style: LText; history: LText; relations: Record<string, number>;
  hostileToPlayer: boolean; uniform: Partial<Appearance>; gruntNames: string[];
}

export interface ZoneDef {
  id: string; name: LText; rect: [number, number, number, number]; // x0,z0,x1,z1
  gang?: string; kind: string; spawnDensity: number; music?: string;
}
