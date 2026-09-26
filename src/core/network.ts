/**
 * Network-ready layer. The simulation only talks to a NetworkAdapter. v1 ships a
 * LocalSimulatedNetwork that fakes a few "online" players roaming the city and chat
 * messages, so the game already consumes remote-player snapshots through the same
 * path a real WebSocket/WebRTC adapter would (see README "Multiplayer roadmap").
 */
export interface PlayerSnapshot { id: string; name: string; x: number; z: number; yaw: number; anim: string; level: number; color: string; t: number }
export type NetMessage =
  | { type: 'snapshot'; snap: PlayerSnapshot }
  | { type: 'chat'; from: string; text: string }
  | { type: 'event'; name: string; data?: any }
  | { type: 'leave'; id: string };
export interface NetworkAdapter {
  readonly mode: 'offline' | 'simulated' | 'online';
  readonly localId: string;
  connect(): Promise<void>;
  disconnect(): void;
  send(msg: NetMessage): void;          // local player state/events -> network
  onMessage(cb: (msg: NetMessage) => void): void;
  tick(dt: number): void;               // drive timers (simulated) or flush queues (real)
}

const NAMES = ['RiderK', 'Mochi_Fan', 'KuroFox', 'Sakura77', 'IronBento', 'NightOwl', 'TakoKing'];
const COLORS = ['#e05050', '#50a0e0', '#e0c050', '#60d080', '#c070e0'];
const CHAT = [
  { th: 'ใครไปโรงงานตอนกลางคืนบ้าง?', en: 'anyone going to the factory at night?' },
  { th: 'ราเมงมารุอิจิอร่อยจริง', en: 'maruichi ramen is legit' },
  { th: 'คิริชิมะสวนเก่งมาก ใช้ทุ่มเลย', en: 'kirishima counters everything, just grab him' },
  { th: 'ใครเลเวลเกิน 10 แล้วบ้าง', en: 'who is level 10+ already' },
  { th: 'ระวังยามิคาเซะที่ลานจอดรถ', en: 'watch out for yamikaze at the parking lot' },
];
export class LocalSimulatedNetwork implements NetworkAdapter {
  readonly mode = 'simulated' as const;
  readonly localId = 'local-' + Math.random().toString(36).slice(2, 8);
  private cbs: ((m: NetMessage) => void)[] = [];
  private ghosts: { snap: PlayerSnapshot; tx: number; tz: number; speed: number }[] = [];
  private chatT = 25; private waypoints: [number, number][];
  outbox: NetMessage[] = []; // what a real adapter would transmit (inspectable in tests)
  constructor(waypoints: [number, number][], count = 3) {
    this.waypoints = waypoints;
    for (let i = 0; i < count; i++) {
      const w = waypoints[(i * 5) % waypoints.length];
      this.ghosts.push({ snap: { id: 'sim-' + i, name: NAMES[i % NAMES.length], x: w[0], z: w[1], yaw: 0, anim: 'walk', level: 3 + i * 4, color: COLORS[i % COLORS.length], t: 0 }, tx: w[0], tz: w[1], speed: 3 + i });
    }
  }
  async connect() { /* nothing to do locally */ }
  disconnect() { for (const g of this.ghosts) this.emit({ type: 'leave', id: g.snap.id }); this.ghosts = []; }
  send(msg: NetMessage) { this.outbox.push(msg); if (this.outbox.length > 60) this.outbox.shift(); }
  onMessage(cb: (m: NetMessage) => void) { this.cbs.push(cb); }
  private emit(m: NetMessage) { for (const c of this.cbs) c(m); }
  tick(dt: number) {
    for (const g of this.ghosts) {
      const dx = g.tx - g.snap.x, dz = g.tz - g.snap.z, d = Math.hypot(dx, dz);
      if (d < 1) { const w = this.waypoints[Math.floor(Math.random() * this.waypoints.length)]; g.tx = w[0]; g.tz = w[1]; }
      else { g.snap.x += dx / d * g.speed * dt; g.snap.z += dz / d * g.speed * dt; g.snap.yaw = Math.atan2(dx, dz); }
      g.snap.t += dt; g.snap.anim = g.speed > 5 ? 'run' : 'walk';
      this.emit({ type: 'snapshot', snap: { ...g.snap } });
    }
    this.chatT -= dt;
    if (this.chatT <= 0 && this.ghosts.length) {
      this.chatT = 40 + Math.random() * 50;
      const g = this.ghosts[Math.floor(Math.random() * this.ghosts.length)];
      const c = CHAT[Math.floor(Math.random() * CHAT.length)];
      this.emit({ type: 'chat', from: g.snap.name, text: JSON.stringify(c) });
    }
  }
}
