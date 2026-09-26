import * as THREE from 'three';
import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import { CityView } from './city';
import { CrowdView } from './crowdView';
import { CharacterRig } from './characterMesh';
import { FX } from './fx';
import { Overlay } from './overlay';
import { shared } from './toon';
import { bus } from '../core/events';
import { CHAR_BY_ID } from '../data/characters';
import { ROOF, INTERACTABLES } from '../data/city';
import { damp, clamp } from '../core/rng';
import type { Appearance } from '../data/types';

export type Quality = 0 | 1 | 2;
const KEYS = [0, 4.5, 6, 8, 16, 17.4, 18.6, 19.7, 24];
const PAL = {
  top: ['#0a0f24', '#0a0f24', '#6a88c0', '#4a96e8', '#4a92e0', '#5a6aa8', '#3a3a78', '#141a40', '#0a0f24'],
  hor: ['#1a2544', '#1a2544', '#f0b890', '#cfe6f5', '#d6e8f2', '#ffb070', '#ff7a50', '#5a3a60', '#1a2544'],
  sun: ['#8aa0ff', '#8aa0ff', '#ffc890', '#fff6e0', '#fff2d8', '#ffa860', '#ff7040', '#6a70c0', '#8aa0ff'],
  sunI: [0.4, 0.4, 0.95, 1.75, 1.75, 1.45, 1.0, 0.42, 0.4],
  hemiS: ['#3a4a78', '#3a4a78', '#c8b0a0', '#c4dcff', '#c4dcff', '#ffc8a0', '#c08090', '#404880', '#3a4a78'],
  hemiG: ['#20203a', '#20203a', '#7a6050', '#a89a80', '#a89a80', '#886050', '#604050', '#262640', '#20203a'],
  hemiI: [0.78, 0.78, 1.0, 1.35, 1.35, 1.2, 1.0, 0.8, 0.78],
  fog: ['#141c34', '#141c34', '#d8b8a0', '#c8dcea', '#cfe0ea', '#e8b890', '#b8707a', '#2a2a4a', '#141c34'],
};
function sample(arr: (string | number)[], h: number, out?: THREE.Color): any {
  let i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1]) i++; const t = (h - KEYS[i]) / (KEYS[i + 1] - KEYS[i]);
  if (typeof arr[0] === 'number') return (arr[i] as number) + ((arr[i + 1] as number) - (arr[i] as number)) * t;
  return out!.set(arr[i] as string).lerp(new THREE.Color(arr[i + 1] as string), t);
}

/** Reads simulation state and draws it. Owns camera, lighting, day/night, streaming, FX. */
export class GameRenderer {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; city: CityView; crowd: CrowdView; fx = new FX(); overlay: Overlay;
  hemi = new THREE.HemisphereLight(); sun = new THREE.DirectionalLight(); points: THREE.PointLight[] = []; fill = new THREE.PointLight(0xd0dcff, 0, 20, 1.1);
  rigs = new Map<number, CharacterRig>(); actors = new Map<string, CharacterRig>(); ghosts = new Map<string, CharacterRig>();
  camDist = 11; camWant = 11; lockRing!: THREE.Mesh; private focus = new THREE.Vector3(); shake = 0; camTarget = new THREE.Vector3(); viewDist = 180; frame = 0; fps = 60; private fpsAcc = 0; private fpsN = 0;
  constructor(public canvas: HTMLCanvasElement, public world: World, public quality: Quality, uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality === 0 ? Math.min(1, devicePixelRatio) * 0.8 : quality === 1 ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = quality > 0; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1200);
    this.viewDist = [120, 170, 230][quality];
    this.scene.fog = new THREE.Fog(0xc8dcea, this.viewDist * 0.45, this.viewDist + 20);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    if (quality > 0) { this.sun.castShadow = true; const s = quality === 2 ? 2048 : 1024; this.sun.shadow.mapSize.set(s, s); const c = this.sun.shadow.camera; c.left = -38; c.right = 38; c.top = 38; c.bottom = -38; c.near = 1; c.far = 160; this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.04; }
    for (let i = 0; i < [2, 4, 6][quality]; i++) { const p = new THREE.PointLight(0xffd8a0, 0, 16, 1.6); this.points.push(p); this.scene.add(p); }
    this.city = new CityView(world.city, quality); this.scene.add(this.city.group); this.scene.add(this.fill);
    this.crowd = new CrowdView(world.crowd, quality); this.scene.add(this.crowd.group);
    this.scene.add(this.fx.group);
    this.overlay = new Overlay(uiRoot, canvas);
    this.buildActors(); this.bindEvents();
    this.resize(); window.addEventListener('resize', () => this.resize());
    shared.halftone.value = quality === 0 ? 0 : 1;
  }
  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w < h ? 72 : 58; this.camera.updateProjectionMatrix(); }
  private buildActors() {
    for (const it of INTERACTABLES) {
      if (it.kind !== 'npc' || !it.npc) continue;
      const look: Appearance = CHAR_BY_ID[it.npc]?.look || { hair: 'topknot', hairColor: '#d8d8d8', jacket: '#8a6a9a', shirt: '#e0d0c0', pants: '#5a4a5a', shoes: '#333', skin: '#e8c8a8', accessory: 'none', build: 0.85, height: 0.86 };
      const rig = new CharacterRig(look); this.actors.set(it.id, rig); this.scene.add(rig.root);
    }
    const rg = new THREE.RingGeometry(0.62, 0.8, 28, 1).rotateX(-Math.PI / 2);
    this.lockRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    const tick = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4).rotateX(Math.PI), (this.lockRing.material as THREE.Material)); tick.position.y = 2.55; tick.name = 'lockTick'; this.lockRing.add(tick);
    this.lockRing.renderOrder = 5; this.lockRing.visible = false; this.scene.add(this.lockRing);
    const cat = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.45), new THREE.MeshToonMaterial({ color: 0xf0e0c0 })); body.position.y = 0.2; cat.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshToonMaterial({ color: 0xe08a40 })); head.position.set(0, 0.35, 0.25); cat.add(head); cat.position.set(-170, 0, 88); cat.name = 'cat'; this.scene.add(cat);
  }
  private v3 = new THREE.Vector3();
  private bindEvents() {
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    bus.on('hit', (e) => {
      const f: Fighter = e.tgt; const y = f.y + 1.2 + f.layer * ROOF.y; const heavy = e.heavy || e.counter; const pl = e.att?.isPlayer;
      this.fx.spark(f.x, y, f.z, heavy ? 16 : 8, e.counter ? '#80d0ff' : heavy ? '#ffd040' : '#fff4c0', heavy ? 8 : 5, heavy ? 0.35 : 0.22);
      if (heavy) this.fx.burst(f.x, y, f.z, e.finisher ? 3.2 : e.counter ? 2.2 : 1.6);
      this.shake = Math.max(this.shake, e.m?.shake ?? 0.1) * (pl || f.isPlayer ? 1 : 0.4);
      if (pl) { const words = e.finisher ? ['ドガァン!!'] : e.counter ? ['カウンター!'] : heavy ? ['ドカッ!', 'バキッ!', 'ゴッ!'] : ['バシッ', 'ドッ', 'パン']; this.overlay.sfx(words[Math.floor(Math.random() * words.length)], P(f.x, y + 0.4, f.z), e.counter ? '#8fe0ff' : heavy ? '#ffe14a' : '#ffffff', heavy ? 44 : 30); }
      this.overlay.sfx(String(Math.round(e.dmg)), P(f.x + (Math.random() - 0.5) * 0.5, y + 0.9, f.z), f.isPlayer ? '#ff6060' : '#ffffff', f.isPlayer ? 26 : 22);
      if (e.finisher || (e.ko && e.tgt.phases)) { this.overlay.impactFrame(0.12); this.overlay.speedLines(1); }
      else if (heavy && pl) this.overlay.speedLines(0.45);
    });
    bus.on('block', (e) => { const f = e.f; this.fx.spark(f.x, 1.3 + f.layer * ROOF.y, f.z, 6, '#9fd8ff', 4, 0.2); this.overlay.sfx('ガッ', P(f.x, 1.8 + f.layer * ROOF.y, f.z), '#bfe8ff', 26); });
    bus.on('parry', (e) => { const f = e.f; this.fx.spark(f.x, 1.3 + f.layer * ROOF.y, f.z, 14, '#8fe0ff', 7, 0.3); this.fx.ring(f.x, f.layer * ROOF.y, f.z, 2.5, '#8fe0ff'); this.overlay.sfx('パリィ!', P(f.x, 2 + f.layer * ROOF.y, f.z), '#8fe0ff', 34); });
    bus.on('perfectDodge', (e) => { if (!e.f.isPlayer) return; this.overlay.slowTint(0.6); this.overlay.speedLines(0.6, '#cfe8ff'); });
    bus.on('guardBreak', (e) => { const f = e.f; this.fx.burst(f.x, 1.4 + f.layer * ROOF.y, f.z, 2); this.fx.spark(f.x, 1.4 + f.layer * ROOF.y, f.z, 20, '#ffffff', 8); this.shake = Math.max(this.shake, 0.35); this.overlay.sfx('ガシャン!', P(f.x, 2.1 + f.layer * ROOF.y, f.z), '#ff8a3a', 40); });
    bus.on('land', (e) => { const f = e.f; this.fx.dust(f.x, f.layer * ROOF.y, f.z, e.hard ? 10 : 6); if (e.hard) this.shake = Math.max(this.shake, 0.25); });
    bus.on('shockwave', (e) => { const f = e.f; this.fx.ring(f.x, f.layer * ROOF.y, f.z, e.r * 1.2, '#ffd080'); this.fx.dust(f.x, f.layer * ROOF.y, f.z, 14); this.shake = 0.5; });
    bus.on('slam', (e) => { const f = e.f; this.fx.ring(f.x, f.layer * ROOF.y, f.z, 5.5, '#ff9060'); this.fx.dust(f.x, f.layer * ROOF.y, f.z, 18); this.shake = 0.7; });
    bus.on('playerSpecial', () => { this.overlay.speedLines(1, '#ffe9a0'); this.overlay.impactFrame(0.1); this.shake = 0.3; });
    bus.on('enemySpecial', (e) => { this.overlay.speedLines(0.5, '#ff9a9a'); const f = e.f; this.overlay.sfx('!!', P(f.x, 2.6 + f.layer * ROOF.y, f.z), '#ff4040', 48); });
    bus.on('bossPhase', (e) => { const f = e.f; this.fx.ring(f.x, f.layer * ROOF.y, f.z, 7, '#ff5050'); this.overlay.speedLines(1, '#ffffff'); this.shake = 0.6; });
    bus.on('ko', (e) => { const f = e.f; this.fx.burst(f.x, 1 + f.layer * ROOF.y, f.z, 2.4); if (e.by?.isPlayer) this.overlay.sfx('K.O.!', P(f.x, 2.4 + f.layer * ROOF.y, f.z), '#ff3a3a', 52); });
    bus.on('dodge', (e) => { if (e.f.isPlayer) this.fx.dust(e.f.x, e.f.layer * ROOF.y, e.f.z, 3); });
    bus.on('mirror', (e) => { const f = e.f; this.fx.burst(f.x, 1.5 + f.layer * ROOF.y, f.z, 2.5); this.overlay.sfx('見切った!', P(f.x, 2.4 + f.layer * ROOF.y, f.z), '#8fd0ff', 40); this.overlay.impactFrame(0.08); });
    bus.on('grabBreak', (e) => { const f = e.f; this.overlay.sfx('バッ!', P(f.x, 2 + f.layer * ROOF.y, f.z), '#ffffff', 30); });
  }
  private syncRigs(dt: number, alpha: number) {
    const w = this.world; const seen = new Set<number>(); const p = w.player;
    const combatNear = w.fighters.some(f => !f.isPlayer && f.aggro && f.alive && f.distTo(p) < 14);
    for (const f of w.fighters) {
      const d = Math.hypot(f.x - this.camera.position.x, f.z - this.camera.position.z);
      if (d > 90 && !f.isPlayer) continue;
      seen.add(f.id); let rig = this.rigs.get(f.id);
      if (!rig) { rig = new CharacterRig(f.appearance, { hero: f.isPlayer }); this.rigs.set(f.id, rig); this.scene.add(rig.root); }
      if (f.isPlayer && rig.look !== f.appearance) { rig.dispose(); rig = new CharacterRig(f.appearance, { hero: true }); this.rigs.set(f.id, rig); this.scene.add(rig.root); }
      rig.update(f, dt, alpha, f.isPlayer ? combatNear : false); rig.setOutlines(d < (this.quality === 0 ? 25 : 45));
    }
    for (const [id, rig] of this.rigs) if (!seen.has(id)) { rig.dispose(); this.rigs.delete(id); }
    // static NPC actors (hidden while unavailable, e.g. before their chapter or while that character is fighting)
    const present = new Set(w.interactables().map(i => i.id)); for (const [id, rig] of this.actors) if (!present.has(id)) rig.root.visible = false;
    for (const it of w.interactables()) {
      const rig = this.actors.get(it.id); if (!rig) continue; const layer = it.layer || 0;
      rig.root.position.set(it.pos[0], layer * ROOF.y, it.pos[1]);
      const dx = p.x - it.pos[0], dz = p.z - it.pos[1]; const near = Math.hypot(dx, dz) < 8 && p.layer === layer;
      rig.root.rotation.y = damp(rig.root.rotation.y, near ? Math.atan2(dx, dz) : 0, 4, dt);
      rig.root.visible = Math.hypot(this.camera.position.x - it.pos[0], this.camera.position.z - it.pos[1]) < 100 && !(it.id === 'npc_granny' && false);
      const fake = { state: 'idle', animT: w.time + it.pos[0], speedNow: 0, px: it.pos[0], pz: it.pos[1], x: it.pos[0], z: it.pos[1], y: 0, layer, yaw: rig.root.rotation.y, telegraph: 0, hurtFlash: 0, aggro: false, id: 0 } as any;
      rig.update(fake, dt, 1, false); rig.root.rotation.y = fake.yaw;
    }
    const cat = this.scene.getObjectByName('cat'); if (cat) cat.visible = !w.quests.done.has('side_cat') && !(w.quests.active.find(a => a.id === 'side_cat' && a.step > 0));
    // simulated online players
    for (const [id, r] of w.remotes) {
      let g = this.ghosts.get(id);
      if (!g) { g = new CharacterRig({ hair: 'messy', hairColor: '#202020', jacket: r.color, shirt: '#eee', pants: '#222', shoes: '#eee', skin: '#e0b890', accessory: 'cap', build: 1, height: 1 }); this.ghosts.set(id, g); this.scene.add(g.root); }
      const fake = { state: 'move', animT: w.time, speedNow: r.anim === 'run' ? 7 : 3, px: r.x, pz: r.z, x: r.x, z: r.z, y: 0, layer: 0, yaw: r.yaw, telegraph: 0, hurtFlash: 0, aggro: false, id: 1 } as any;
      g.update(fake, dt, 1, false); g.root.visible = Math.hypot(this.camera.position.x - r.x, this.camera.position.z - r.z) < 90;
    }
    for (const [id, g] of this.ghosts) if (!w.remotes.has(id)) { g.dispose(); this.ghosts.delete(id); }
  }
  /**
   * Wide third-person overview camera. Distance = world.camZoom (wheel / pinch / D-pad, 4.5-18 m, default 11)
   * widened a little in portrait, with several engaged enemies, or for bosses. Buildings between camera and the
   * fight are cut away (CityView.updateCutaway); other solids pull the camera in with fast-in / slow-out damping.
   */
  private updateCamera(dt: number, alpha: number) {
    const w = this.world, p = w.player; const x = p.px + (p.x - p.px) * alpha, z = p.pz + (p.z - p.pz) * alpha; const baseY = p.layer * ROOF.y;
    const eng = w.fighters.filter(f => f.aggro && f.alive && !f.isPlayer && f.layer === p.layer && f.distTo(p) < 14);
    const boss = eng.some(f => !!f.phases);
    const portrait = window.innerHeight > window.innerWidth;
    let want = w.camZoom * (portrait ? 1.22 : 1) * (1 + Math.min(0.22, 0.055 * Math.max(0, eng.length - 1)) + (boss ? 0.08 : 0));
    if (w.dialogue) want *= 0.62;
    this.camWant = damp(this.camWant, want, 3, dt);
    // focus: player, biased toward the enemy group (max 30 %, <= 3 m) so the whole fight stays in frame
    let fx = x, fz = z;
    if (eng.length) { let cx = 0, cz = 0; for (const f of eng) { cx += f.x; cz += f.z; } cx /= eng.length; cz /= eng.length; let ox = (cx - x) * 0.3, oz = (cz - z) * 0.3; const ol = Math.hypot(ox, oz); if (ol > 3) { ox *= 3 / ol; oz *= 3 / ol; } fx += ox; fz += oz; }
    const fy = baseY + 1.2 + Math.min(p.y, 1) * 0.3;
    if (!this.focus.lengthSq() || Math.abs(this.focus.x - fx) > 10 || Math.abs(this.focus.z - fz) > 10) this.focus.set(fx, fy, fz);
    else this.focus.set(damp(this.focus.x, fx, 9, dt), damp(this.focus.y, fy, 8, dt), damp(this.focus.z, fz, 9, dt));
    this.camTarget.copy(this.focus);
    const yaw = w.camYaw, pitch = w.camPitch; const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const t = this.camTarget; let dist = this.camWant;
    // collision with non-cuttable solids (rooftop school, tanks, containers...). Probe a small fan so edges don't flicker.
    let hit = w.col.ray(t.x, t.y, t.z, dir.x, dir.y, dir.z, dist + 0.4, true);
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.35);
    for (const s of [1, -1]) hit = Math.min(hit, w.col.ray(t.x + side.x * s, t.y, t.z + side.z * s, dir.x, dir.y, dir.z, dist + 0.4, true));
    if (hit - 0.4 < dist) dist = hit - 0.4 >= 1.4 ? hit - 0.4 : Math.max(0.3, Math.min(1.4, hit - 0.2)); // hugging a wall: go closer rather than into it
    this.camDist = dist < this.camDist ? dist : damp(this.camDist, dist, 2.2, dt); // snap in (never clip), ease out
    const cp = t.clone().addScaledVector(dir, this.camDist); cp.y = Math.max(baseY + 0.5, cp.y);
    if (w.col.pointInSolid(cp.x, cp.y, cp.z, true)) { this.camDist = Math.min(this.camDist, 0.3); cp.copy(t).addScaledVector(dir, 0.3); }
    if (this.shake > 0.001) { const s = this.shake * 0.25; cp.x += (Math.random() - 0.5) * s; cp.y += (Math.random() - 0.5) * s; cp.z += (Math.random() - 0.5) * s; this.shake = Math.max(0, this.shake - dt * 2.5); }
    this.camera.position.copy(cp); this.camera.lookAt(t.x, t.y + 0.1, t.z);
    // cutaway occluders on sight lines to the player and up to 4 engaged enemies
    const pts = [new THREE.Vector3(x, baseY + 1.1, z)]; for (const f of eng.slice(0, 4)) pts.push(new THREE.Vector3(f.x, baseY + 1.1, f.z));
    if (p.layer === 0) this.city.updateCutaway(cp, pts, dt); else this.city.updateCutaway(cp, [], dt);
    // lock-on / target indicator
    const tg = w.currentTarget(); const show = !!tg && tg.alive && (eng.length > 0 || w.auto) && tg.distTo(p) < 16 && !w.dialogue;
    this.lockRing.visible = show;
    if (show && tg) {
      const s = Math.max(0.9, tg.radius / 0.45); this.lockRing.position.set(tg.x, tg.layer * ROOF.y + 0.05, tg.z); this.lockRing.scale.setScalar(s); this.lockRing.rotation.y = w.time * 2;
      const tick = this.lockRing.getObjectByName('lockTick')!; tick.position.y = (2.35 + Math.sin(w.time * 6) * 0.1) * (tg.appearance?.height || 1) / s;
      (this.lockRing.material as THREE.MeshBasicMaterial).color.set(w.auto ? 0x3ad0ff : 0xff4a3a);
    }
  }
  /** Debug/test: is the camera inside a solid it should not be inside (non-cut solid, or an un-cut building)? */
  camInsideSolid(): boolean {
    const c = this.camera.position; if (this.world.col.pointInSolid(c.x, c.y, c.z, true)) return true;
    for (const inf of this.city.binfos) { const b = inf.b; if (c.x > b.x0 && c.x < b.x1 && c.z > b.z0 && c.z < b.z1 && c.y < b.h && inf.cur > 0.6) return true; } // faded buildings are see-through
    return false;
  }
  private updateLighting() {
    const w = this.world; const h = w.clock; const c = new THREE.Color();
    const night = w.nightFactor;
    this.city.skyMat.uniforms.top.value.copy(sample(PAL.top, h, c.clone())); this.city.skyMat.uniforms.horizon.value.copy(sample(PAL.hor, h, c.clone()));
    const sunCol = sample(PAL.sun, h, c.clone()); this.sun.color.copy(sunCol); this.sun.intensity = sample(PAL.sunI, h) * 1.25;
    this.hemi.color.copy(sample(PAL.hemiS, h, c.clone())); this.hemi.groundColor.copy(sample(PAL.hemiG, h, c.clone())); this.hemi.intensity = sample(PAL.hemiI, h) * 1.35;
    const fog = sample(PAL.fog, h, c.clone()); (this.scene.fog as THREE.Fog).color.copy(fog); this.renderer.setClearColor(fog);
    // sun/moon direction: sun during day, moon at night (always from above-ish so toon shading stays readable)
    const dayT = clamp((h - 5.5) / 13.5, 0, 1); const az = Math.PI * (0.15 + dayT * 0.7); const el = night > 0.5 ? 0.9 : 0.35 + Math.sin(dayT * Math.PI) * 0.75;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el) * 0.6 + 0.3).normalize();
    this.city.skyMat.uniforms.sunDir.value.copy(dir); this.city.skyMat.uniforms.sunCol.value.copy(sunCol).multiplyScalar(night > 0.5 ? 0.3 : 1);
    const p = this.world.player; const pc = new THREE.Vector3(p.x, p.layer * ROOF.y, p.z);
    this.sun.position.copy(pc).addScaledVector(dir, 80); this.sun.target.position.copy(pc);
    // nearest street lamps become real point lights at night
    if (night > 0.35) {
      const lamps = this.world.city.lamps.map(l => ({ l, d: (l[0] - p.x) ** 2 + (l[1] - p.z) ** 2 })).sort((a, b) => a.d - b.d);
      this.points.forEach((pt, i) => { const L = lamps[i]; if (!L) { pt.intensity = 0; return; } pt.position.set(L.l[0], 4.6, L.l[1]); pt.intensity = (night - 0.3) * 38; });
    } else for (const pt of this.points) pt.intensity = 0;
    { const p = this.world.player; const cy = this.camera.position; this.fill.position.set((p.x * 2 + cy.x) / 3, p.layer * ROOF.y + 5, (p.z * 2 + cy.z) / 3); this.fill.intensity = night * 8; }
    shared.halftone.value = this.quality === 0 ? 0 : 1 - night * 0.6;
    return night;
  }
  render(dt: number, alpha: number) {
    this.frame++;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    const night = this.updateLighting();
    this.syncRigs(dt, alpha); this.updateCamera(dt, alpha);
    this.city.update(this.camera.position, this.viewDist, night, this.world.time);
    this.crowd.update(this.world.time, this.camera.position, [60, 90, 120][this.quality], this.world.slowmoT > 0 ? 0.3 : 1, this.world.player.layer);
    this.fx.update(dt, this.camera); this.overlay.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  project(x: number, y: number, z: number): { x: number; y: number; vis: boolean } {
    this.v3.set(x, y, z).project(this.camera); return { x: (this.v3.x * 0.5 + 0.5) * window.innerWidth, y: (-this.v3.y * 0.5 + 0.5) * window.innerHeight, vis: this.v3.z < 1 && Math.abs(this.v3.x) < 1.1 && Math.abs(this.v3.y) < 1.1 };
  }
}
