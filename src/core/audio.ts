/** 100% procedural WebAudio: hit SFX, punk-ish music loops, city ambience. No samples. */
type Track = 'none' | 'city' | 'battle' | 'boss' | 'night';
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
export class AudioSys {
  ctx: AudioContext | null = null; master!: GainNode; sfx!: GainNode; music!: GainNode; amb!: GainNode;
  private noiseBuf!: AudioBuffer; private dist!: WaveShaperNode;
  private track: Track = 'none'; private want: Track = 'city'; private step = 0; private nextT = 0; private timer: any = null;
  private musicBus!: GainNode; private fading = false; volume = 0.8; musicVolume = 0.5; night = 0; ambT = 0;
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(comp);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVolume * 0.55; this.music.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.music);
    this.amb = c.createGain(); this.amb.gain.value = 0.18; this.amb.connect(this.master);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.dist = c.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); } this.dist.curve = curve;
    const gtrLP = c.createBiquadFilter(); gtrLP.type = 'lowpass'; gtrLP.frequency.value = 2600; this.dist.connect(gtrLP); gtrLP.connect(this.musicBus);
    this.startAmbience();
    this.nextT = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
  }
  setVolume(v: number, m: number) { this.volume = v; this.musicVolume = m; if (this.ctx) { this.master.gain.value = v; this.music.gain.value = m * 0.55; } }
  setTrack(t: Track) { this.want = t; }
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  private noise(t: number, dur: number, freq: number, q: number, peak: number, type: BiquadFilterType = 'bandpass', out?: AudioNode) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); this.env(g, t, 0.003, peak, dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05); return f;
  }
  private tone(t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine', out?: AudioNode) {
    const c = this.ctx!; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this.env(g, t, 0.004, peak, dur); o.connect(g); g.connect(out || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  play(name: string, power = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    switch (name) {
      case 'hit': this.tone(t, 180, 60, 0.12, 0.5 * power); this.noise(t, 0.08, 1800, 1.2, 0.5 * power); break;
      case 'heavy': this.tone(t, 120, 38, 0.25, 0.85); this.noise(t, 0.16, 900, 0.8, 0.7); this.noise(t + 0.01, 0.1, 3500, 2, 0.25); break;
      case 'block': this.noise(t, 0.07, 3000, 4, 0.35); this.tone(t, 600, 400, 0.05, 0.12, 'square'); break;
      case 'counter': this.tone(t, 900, 1800, 0.08, 0.2, 'triangle'); this.tone(t + 0.02, 140, 45, 0.28, 0.9); this.noise(t, 0.2, 1200, 0.7, 0.7); break;
      case 'whoosh': this.noise(t, 0.12, 700 + Math.random() * 400, 1.5, 0.16 * power, 'bandpass'); break;
      case 'dodge': this.noise(t, 0.18, 500, 1, 0.14); break;
      case 'perfect': this.tone(t, 1200, 300, 0.4, 0.25, 'sine'); this.tone(t, 1800, 450, 0.4, 0.12, 'triangle'); break;
      case 'ko': this.tone(t, 90, 30, 0.6, 0.9); this.noise(t, 0.4, 400, 0.6, 0.6, 'lowpass'); break;
      case 'special': this.tone(t, 200, 900, 0.35, 0.3, 'sawtooth'); this.noise(t, 0.4, 2000, 0.5, 0.3); break;
      case 'guardbreak': this.noise(t, 0.3, 2500, 1, 0.6); this.tone(t, 300, 80, 0.3, 0.5, 'square'); break;
      case 'levelup': [0, 4, 7, 12].forEach((n, i) => this.tone(t + i * 0.09, NOTE(72 + n), NOTE(72 + n), 0.25, 0.22, 'square')); break;
      case 'quest': [0, 7, 12, 16].forEach((n, i) => this.tone(t + i * 0.11, NOTE(67 + n), NOTE(67 + n), 0.3, 0.2, 'triangle')); break;
      case 'ui': this.tone(t, 880, 880, 0.05, 0.08, 'square'); break;
      case 'coin': this.tone(t, 1320, 1320, 0.06, 0.12, 'square'); this.tone(t + 0.06, 1760, 1760, 0.1, 0.12, 'square'); break;
      case 'phase': this.tone(t, 60, 40, 0.9, 0.9, 'sawtooth'); this.noise(t, 0.9, 300, 0.5, 0.5, 'lowpass'); break;
      case 'grab': this.noise(t, 0.06, 900, 2, 0.3); break;
      case 'throw': this.tone(t + 0.05, 100, 35, 0.35, 0.9); this.noise(t + 0.05, 0.3, 500, 0.6, 0.6, 'lowpass'); break;
      case 'step': this.noise(t, 0.04, 300, 1, 0.05, 'lowpass'); break;
    }
  }
  // ---------------- music sequencer ----------------
  private schedule() {
    const c = this.ctx!; if (!c) return;
    if (this.want !== this.track && !this.fading) { // quick crossfade
      this.fading = true; const g = this.musicBus.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(Math.max(0.0001, g.value), c.currentTime); g.linearRampToValueAtTime(0.0001, c.currentTime + 0.4);
      setTimeout(() => { this.track = this.want; this.step = 0; const g2 = this.musicBus.gain; g2.cancelScheduledValues(c.currentTime); g2.setValueAtTime(0.0001, c.currentTime); g2.linearRampToValueAtTime(1, c.currentTime + 0.3); this.fading = false; }, 420);
    }
    const bpm = this.track === 'battle' ? 168 : this.track === 'boss' ? 176 : this.track === 'night' ? 84 : 96;
    const sixteenth = 60 / bpm / 4;
    while (this.nextT < c.currentTime + 0.12) { this.playStep(this.step, this.nextT, sixteenth); this.nextT += sixteenth; this.step = (this.step + 1) % 64; }
    this.ambT -= 0.03; if (this.ambT <= 0) { this.ambT = 3 + Math.random() * 6; this.ambientEvent(); }
  }
  private playStep(s: number, t: number, dur: number) {
    const tr = this.track; if (tr === 'none') return;
    const bar = Math.floor(s / 16), i = s % 16; const out = this.musicBus;
    const kick = (v = 0.7) => { this.tone(t, 150, 45, 0.18, v, 'sine', out); };
    const snare = (v = 0.35) => { this.noise(t, 0.12, 1800, 0.7, v, 'bandpass', out); this.tone(t, 220, 160, 0.07, v * 0.4, 'triangle', out); };
    const hat = (v = 0.07) => { this.noise(t, 0.03, 8000, 1, v, 'highpass', out); };
    const bass = (n: number, v = 0.22, len = 1) => { this.tone(t, NOTE(n), NOTE(n), dur * len * 0.9, v, 'sawtooth', out); };
    if (tr === 'battle' || tr === 'boss') {
      const prog = tr === 'boss' ? [40, 40, 43, 38] : [40, 48, 43, 45]; // E C G A (battle) / E E G D (boss)
      const root = prog[bar];
      if (i % 8 === 0 || (tr === 'boss' && i % 8 === 3)) kick(0.8); if (i % 8 === 4) snare(0.4); if (i % 2 === 0) hat(0.08);
      if (i % 2 === 0) bass(root - 12 + (tr === 'boss' && i === 14 ? 3 : 0), 0.2, 2);
      if (i % 4 === 0 || (i === 14)) { // palm-muted power chord through distortion
        for (const iv of [0, 7, 12]) { const o = this.ctx!.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(root + iv); const g = this.ctx!.createGain(); this.env(g, t, 0.005, 0.06, dur * (i % 8 === 0 ? 3.5 : 1.6)); o.connect(g); g.connect(this.dist); o.start(t); o.stop(t + dur * 4); }
      }
      if (tr === 'boss' && bar === 3 && i >= 8 && i % 2 === 0) this.tone(t, NOTE(64 + [0, 3, 5, 7][(i - 8) / 2]), NOTE(64 + [0, 3, 5, 7][(i - 8) / 2]), dur * 1.8, 0.07, 'square', out);
    } else {
      const prog = tr === 'night' ? [45, 41, 43, 40] : [43, 40, 45, 38]; // lo-fi city
      const root = prog[bar];
      if (i === 0 || i === 10) kick(0.45); if (i === 4 || i === 12) snare(0.18); if (i % 4 === 2) hat(0.05);
      if (i === 0 || i === 6 || i === 8) bass(root - 12, 0.15, 3);
      if (i === 0) for (const iv of [12, 16, 19, 23]) this.tone(t, NOTE(root + iv - (tr === 'night' ? 1 : 0)), NOTE(root + iv), dur * 14, 0.025, 'triangle', out);
      if (tr === 'city' && (i === 3 || i === 11) && Math.random() < 0.6) this.tone(t, NOTE(root + 24 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)]), NOTE(root + 24), dur * 3, 0.03, 'sine', out);
    }
  }
  // ---------------- ambience ----------------
  private startAmbience() {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = c.createGain(); g.gain.value = 0.35;
    s.connect(f); f.connect(g); g.connect(this.amb); s.start();
  }
  private ambientEvent() {
    if (!this.ctx) return; const t = this.ctx.currentTime; const r = Math.random();
    if (r < 0.35) { const f = this.noise(t, 1.6, 300, 0.6, 0.25, 'bandpass', this.amb); f.frequency.linearRampToValueAtTime(900, t + 0.8); f.frequency.linearRampToValueAtTime(250, t + 1.6); } // car pass
    else if (r < 0.5) { this.tone(t, 392, 392, 0.3, 0.05, 'square', this.amb); this.tone(t, 330, 330, 0.3, 0.05, 'square', this.amb); } // horn
    else if (this.night < 0.5) { for (let k = 0; k < 3; k++) this.tone(t + k * 0.12, 2600 + Math.random() * 800, 3400, 0.08, 0.04, 'sine', this.amb); } // birds
    else { for (let k = 0; k < 6; k++) this.tone(t + k * 0.07, 4200, 4300, 0.04, 0.025, 'sine', this.amb); } // crickets
  }
}
export const audio = new AudioSys();
