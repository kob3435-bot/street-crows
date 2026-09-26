import * as THREE from 'three';
import type { Appearance } from '../data/types';
import type { Fighter } from '../sim/fighter';
import { toon, outlineMat, canvasTexture } from './toon';
import { damp } from '../core/rng';

const geoCache = new Map<string, THREE.BufferGeometry>();
const G = (key: string, make: () => THREE.BufferGeometry) => { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; };
const box = (w: number, h: number, d: number) => G(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cap = (r: number, l: number) => G(`c${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 3, 8));
const sph = (r: number) => G(`s${r}`, () => new THREE.SphereGeometry(r, 12, 10));
const cone = (r: number, h: number) => G(`k${r}|${h}`, () => new THREE.ConeGeometry(r, h, 6));
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const T = 0.022; // outline thickness
let exclTex: THREE.Texture | null = null;

type Pose = Record<string, number>;
const JOINTS = ['hipsY', 'hipsX', 'torsoX', 'torsoY', 'headX', 'lShX', 'lShZ', 'lElX', 'rShX', 'rShZ', 'rElX', 'lHipX', 'lHipZ', 'lKnX', 'rHipX', 'rHipZ', 'rKnX', 'bodyX', 'bodyZ', 'spin', 'lift'];

export class CharacterRig {
  root = new THREE.Group(); body = new THREE.Group(); hips = new THREE.Group(); torso = new THREE.Group(); head = new THREE.Group();
  shL = new THREE.Group(); shR = new THREE.Group(); elL = new THREE.Group(); elR = new THREE.Group();
  hipL = new THREE.Group(); hipR = new THREE.Group(); knL = new THREE.Group(); knR = new THREE.Group(); coat: THREE.Object3D | null = null;
  pose: Pose = {}; meshes: THREE.Mesh[] = []; outlines: THREE.Mesh[] = []; stars = new THREE.Group(); excl: THREE.Sprite; flashing = false; look: Appearance; lodFar = false;
  constructor(look: Appearance, opts: { hero?: boolean } = {}) {
    this.look = look; for (const j of JOINTS) this.pose[j] = 0;
    const b = look.build, H = 1;
    const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, size: [number, number, number], color: string, pos: [number, number, number], rot?: [number, number, number], outline = true) => {
      const m = new THREE.Mesh(geo, toon(color)); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = true;
      if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.scale.set((size[0] + T * 2) / size[0], (size[1] + T * 2) / size[1], (size[2] + T * 2) / size[2]); m.add(o); this.outlines.push(o); }
      parent.add(m); this.meshes.push(m); return m;
    };
    this.root.add(this.body); this.body.add(this.hips); this.hips.position.y = 0.95 * H;
    part(this.hips, box(0.34 * b, 0.18, 0.22), [0.34 * b, 0.18, 0.22], look.pants, [0, 0, 0]);
    for (const [g, k, sx] of [[this.hipL, this.knL, 1], [this.hipR, this.knR, -1]] as [THREE.Group, THREE.Group, number][]) {
      g.position.set(0.1 * b * sx, -0.06, 0); this.hips.add(g);
      part(g, cap(0.078 * b, 0.26), [0.16 * b, 0.42, 0.16 * b], look.pants, [0, -0.21, 0]);
      k.position.y = -0.43; g.add(k);
      part(k, cap(0.07 * b, 0.26), [0.14 * b, 0.4, 0.14 * b], look.pants, [0, -0.2, 0]);
      part(k, box(0.12, 0.08, 0.26), [0.12, 0.08, 0.26], look.shoes, [0, -0.43, 0.05]);
    }
    if (look.longCoat) { this.coat = part(this.hips, box(0.42 * b, 0.46, 0.27), [0.42 * b, 0.46, 0.27], look.jacket, [0, -0.2, -0.005]); }
    this.torso.position.y = 0.08; this.hips.add(this.torso);
    part(this.torso, box(0.44 * b, 0.52, 0.26), [0.44 * b, 0.52, 0.26], look.jacket, [0, 0.28, 0]);
    if (look.openJacket) part(this.torso, box(0.15 * b, 0.46, 0.02), [0.15 * b, 0.46, 0.02], look.shirt, [0, 0.27, 0.132], undefined, false);
    part(this.torso, box(0.3 * b, 0.07, 0.24), [0.3 * b, 0.07, 0.24], look.jacket, [0, 0.56, 0], undefined, false); // collar
    this.head.position.y = 0.6; this.torso.add(this.head);
    part(this.head, cap(0.05, 0.06), [0.1, 0.16, 0.1], look.skin, [0, 0.02, 0], undefined, false);
    const headM = part(this.head, sph(0.14), [0.28, 0.3, 0.28], look.skin, [0, 0.15, 0.005]); headM.scale.set(1, 1.08, 1);
    const black = '#111111';
    for (const sx of [1, -1]) {
      part(this.head, box(0.034, 0.024, 0.012), [0.034, 0.024, 0.012], black, [0.05 * sx, 0.155, 0.132], undefined, false);
      part(this.head, box(0.064, 0.016, 0.014), [0.064, 0.016, 0.014], look.hairColor === '#d0d0d0' ? '#444' : look.hairColor, [0.052 * sx, 0.19, 0.13], [0, 0, 0.28 * sx], false);
    }
    part(this.head, box(0.05, 0.009, 0.01), [0.05, 0.009, 0.01], '#6a3a30', [0, 0.085, 0.138], undefined, false);
    if (opts.hero) part(this.head, box(0.05, 0.02, 0.01), [0.05, 0.02, 0.01], '#f0d8b0', [-0.065, 0.12, 0.128], [0, 0.4, 0.3], false); // band-aid
    this.buildHair(part); this.buildAccessory(part, black);
    for (const [g, e, sx] of [[this.shL, this.elL, 1], [this.shR, this.elR, -1]] as [THREE.Group, THREE.Group, number][]) {
      g.position.set(0.27 * b * sx, 0.48, 0); this.torso.add(g);
      part(g, cap(0.068 * b, 0.2), [0.14 * b, 0.34, 0.14 * b], look.jacket, [0, -0.15, 0]);
      e.position.y = -0.31; g.add(e);
      part(e, cap(0.06 * b, 0.18), [0.12 * b, 0.3, 0.12 * b], look.jacket, [0, -0.12, 0]);
      part(e, sph(0.062), [0.124, 0.124, 0.124], look.skin, [0, -0.3, 0.01]);
    }
    const s = look.height; this.root.scale.set(s, s, s);
    // dizzy stars + telegraph "!"
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(cone(0.05, 0.12), toon('#ffe040', { halftone: false })); st.position.set(Math.cos(i * 2.1) * 0.25, 0, Math.sin(i * 2.1) * 0.25); this.stars.add(st); }
    this.stars.position.y = 2.0; this.stars.visible = false; this.root.add(this.stars);
    if (!exclTex) exclTex = canvasTexture(64, 128, c => { c.font = 'bold 110px Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.lineWidth = 10; c.strokeStyle = '#000'; c.strokeText('!', 32, 108); c.fillStyle = '#ff2a2a'; c.fillText('!', 32, 108); });
    this.excl = new THREE.Sprite(new THREE.SpriteMaterial({ map: exclTex, depthTest: false, transparent: true })); this.excl.scale.set(0.35, 0.7, 1); this.excl.position.y = 2.35; this.excl.visible = false; this.excl.renderOrder = 10; this.root.add(this.excl);
  }
  private buildHair(part: any) {
    const L = this.look, c = L.hairColor, h = this.head;
    const capM = (sy: number, z = 0, y = 0.19) => { const m = part(h, sph(0.152), [0.3, 0.3, 0.3], c, [0, y, z]); m.scale.set(1.02, sy, 1.06); return m; };
    switch (L.hair) {
      case 'pompadour': capM(0.62, -0.01); part(h, cap(0.1, 0.16), [0.2, 0.36, 0.2], c, [0, 0.28, 0.08], [Math.PI / 2 - 0.35, 0, 0]); break;
      case 'spiky': capM(0.66); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(h, cone(0.055, 0.2), [0.11, 0.2, 0.11], c, [Math.sin(a) * 0.08, 0.3, Math.cos(a) * 0.07 - 0.02], [Math.cos(a) * 0.7 - 0.3, 0, -Math.sin(a) * 0.7]); } break;
      case 'buzz': capM(0.7, 0, 0.17); break;
      case 'long': capM(0.66); part(h, box(0.27, 0.34, 0.09), [0.27, 0.34, 0.09], c, [0, 0.05, -0.11]); break;
      case 'slick': { const m = capM(0.6, -0.03, 0.2); m.scale.z = 1.18; part(h, box(0.12, 0.05, 0.14), [0.12, 0.05, 0.14], c, [0, 0.22, -0.16], [0.4, 0, 0]); break; }
      case 'mohawk': capM(0.5, 0, 0.16); part(h, box(0.05, 0.16, 0.32), [0.05, 0.16, 0.32], c, [0, 0.33, -0.01]); break;
      case 'messy': capM(0.68); for (let i = 0; i < 5; i++) part(h, cone(0.05, 0.12), [0.1, 0.12, 0.1], c, [(i - 2) * 0.05, 0.28, 0.1 - Math.abs(i - 2) * 0.03], [0.9, 0, (i - 2) * 0.35]); break;
      case 'topknot': capM(0.62); part(h, sph(0.06), [0.12, 0.12, 0.12], c, [0, 0.33, -0.06]); break;
      case 'bald': break;
    }
  }
  private buildAccessory(part: any, black: string) {
    const h = this.head;
    switch (this.look.accessory) {
      case 'headband': part(h, box(0.31, 0.045, 0.31), [0.31, 0.045, 0.31], '#e8e8e8', [0, 0.215, 0]); break;
      case 'shades': part(h, box(0.2, 0.04, 0.03), [0.2, 0.04, 0.03], black, [0, 0.158, 0.135], undefined, false); break;
      case 'mask': part(h, box(0.24, 0.2, 0.04), [0.24, 0.2, 0.04], '#f0f0f4', [0, 0.14, 0.13]); break;
      case 'bandage': part(h, box(0.3, 0.04, 0.3), [0.3, 0.04, 0.3], '#f4f0e8', [0, 0.24, 0], [0.2, 0, 0.1]); break;
      case 'chain': part(this.torso, box(0.2, 0.02, 0.02), [0.2, 0.02, 0.02], '#e0c040', [0, 0.1, 0.14], [0, 0, 0.2], false); break;
      case 'cap': { const m = part(h, sph(0.155), [0.31, 0.31, 0.31], '#c03030', [0, 0.2, 0]); m.scale.set(1.04, 0.62, 1.06); part(h, box(0.22, 0.02, 0.14), [0.22, 0.02, 0.14], '#c03030', [0, 0.215, 0.17]); break; }
    }
  }
  setOutlines(v: boolean) { if (this.lodFar === !v) return; this.lodFar = !v; for (const o of this.outlines) o.visible = v; }
  private flash(on: boolean) {
    if (on === this.flashing) return; this.flashing = on;
    for (const m of this.meshes) { if (on) { m.userData.mat = m.material; m.material = flashMat; } else if (m.userData.mat) m.material = m.userData.mat; }
  }
  /** Procedural animation from simulation state. */
  update(f: Fighter, dt: number, alpha: number, combatNear: boolean) {
    const P: Pose = {}; for (const j of JOINTS) P[j] = 0;
    const t = f.animT; const sp = f.speedNow; let k = 16;
    const guard = combatNear || f.aggro;
    const stance = () => { P.lShX = -0.9; P.lElX = -1.7; P.rShX = -0.7; P.rElX = -1.9; P.lShZ = 0.15; P.rShZ = -0.15; P.torsoY = 0.25; P.lHipX = -0.15; P.rHipX = 0.2; P.lKnX = 0.25; P.rKnX = 0.2; P.hipsY = -0.04; };
    const locomotion = () => {
      if (sp > 0.4) {
        const run = sp > 6.5; const freq = run ? 11 : 7.5; const amp = run ? 0.95 : 0.55; const s = Math.sin(t * freq);
        P.lHipX = -s * amp; P.rHipX = s * amp; P.lKnX = Math.max(0, s) * amp * 1.3 + 0.1; P.rKnX = Math.max(0, -s) * amp * 1.3 + 0.1;
        P.lShX = s * amp * 0.8; P.rShX = -s * amp * 0.8; P.lElX = -0.5 - (run ? 0.8 : 0); P.rElX = -0.5 - (run ? 0.8 : 0);
        P.hipsY = Math.abs(Math.cos(t * freq)) * (run ? 0.07 : 0.035) - (run ? 0.05 : 0); P.torsoX = run ? 0.28 : 0.05; P.lShZ = 0.08; P.rShZ = -0.08;
        if (guard && !run) { P.lShX = -0.8 + s * 0.2; P.lElX = -1.6; P.rShX = -0.7 - s * 0.2; P.rElX = -1.8; }
      } else if (guard) { stance(); P.hipsY += Math.sin(t * 5) * 0.015; P.torsoX = 0.08; }
      else { P.lShZ = 0.1; P.rShZ = -0.1; P.lElX = -0.15; P.rElX = -0.15; P.hipsY = Math.sin(t * 2) * 0.008; P.headX = Math.sin(t * 0.7) * 0.05; P.torsoX = -0.03; }
    };
    switch (f.state) {
      case 'idle': case 'move': locomotion(); break;
      case 'block': P.lShX = -1.9; P.lElX = -1.8; P.rShX = -1.8; P.rElX = -1.9; P.lShZ = -0.35; P.rShZ = 0.35; P.torsoX = 0.2; P.headX = 0.25; P.lKnX = 0.35; P.rKnX = 0.35; P.lHipX = -0.3; P.rHipX = -0.1; P.hipsY = -0.08; k = 26; break;
      case 'blockstun': P.lShX = -1.9; P.lElX = -1.8; P.rShX = -1.8; P.rElX = -1.9; P.lShZ = -0.35; P.rShZ = 0.35; P.torsoX = -0.15; P.lKnX = 0.4; P.rKnX = 0.4; P.hipsY = -0.1; k = 30; break;
      case 'hitstun': { const a = Math.min(1, f.stateT / 0.08); P.torsoX = -0.55 * a; P.headX = -0.5 * a; P.lShX = 0.5; P.rShX = 0.3; P.lShZ = 0.5; P.rShZ = -0.6; P.lKnX = 0.3; P.hipsY = -0.05; P.torsoY = (f.id % 2 ? 0.3 : -0.3); k = 40; break; }
      case 'dizzy': P.torsoX = 0.3 + Math.sin(t * 3) * 0.1; P.bodyZ = Math.sin(t * 2.6) * 0.14; P.headX = 0.3; P.lShX = 0.2; P.rShX = 0.2; P.lShZ = 0.3; P.rShZ = -0.3; P.lKnX = 0.4; P.rKnX = 0.4; P.hipsY = -0.1; k = 8; break;
      case 'knockdown': case 'ko': case 'thrown': {
        const down = f.state === 'thrown' ? Math.min(1, f.stateT * 3) : 1; P.bodyX = -1.5 * down; P.lift = 0.18; P.lShZ = 1.2; P.rShZ = -1.2; P.lHipX = -0.3; P.rHipX = 0.2; P.lKnX = 0.5; P.headX = 0.2; k = f.state === 'thrown' ? 10 : 14;
        if (f.state === 'ko') { P.lShZ = 1.4; P.rShZ = -1.0; P.lKnX = 0.9; P.rHipX = -0.6; }
        break;
      }
      case 'getup': { const a = Math.min(1, f.stateT / Math.max(0.1, f.stateDur)); P.bodyX = -1.5 * (1 - a); P.lift = 0.18 * (1 - a); P.lKnX = 1.2 * (1 - a) + 0.3; P.rKnX = 0.9 * (1 - a) + 0.3; P.hipsY = -0.25 * (1 - a); k = 20; break; }
      case 'dodge': { P.torsoX = 0.55; P.hipsY = -0.28; P.lKnX = 1.1; P.rKnX = 1.0; P.lHipX = -0.7; P.rHipX = -0.2; P.lShX = -0.4; P.rShX = 0.4; const side = Math.sin(f.yaw) * f.dodgeDirZ - Math.cos(f.yaw) * f.dodgeDirX; P.bodyZ = side * 0.4; k = 30; break; }
      case 'grabbing': P.lShX = -1.4; P.rShX = -1.4; P.lElX = -0.6; P.rElX = -0.6; P.lShZ = -0.2; P.rShZ = 0.2; P.torsoX = 0.1; P.lKnX = 0.3; P.rKnX = 0.3; k = 20; break;
      case 'grabbed': P.torsoX = -0.3; P.lShX = 0.3; P.rShX = 0.3; P.lShZ = 0.6; P.rShZ = -0.6; P.headX = -0.3; P.lift = 0.12; k = 20; break;
      case 'taunt': P.lShZ = 1.3 + Math.sin(t * 10) * 0.1; P.rShZ = -1.3; P.lElX = -0.8; P.rElX = -0.8; P.torsoX = -0.35; P.headX = -0.45; P.lKnX = 0.3; P.rKnX = 0.3; P.hipsY = -0.05; k = 10; break;
      case 'attack': { k = 34; this.attackPose(f, P); break; }
    }
    // smooth toward target pose
    for (const j of JOINTS) { if (j === 'spin') { this.pose[j] = P[j]; continue; } this.pose[j] = damp(this.pose[j], P[j], k, dt); }
    const p = this.pose;
    this.hips.position.y = 0.95 + p.hipsY; this.hips.rotation.x = p.hipsX;
    this.torso.rotation.set(p.torsoX, p.torsoY, 0); this.head.rotation.x = p.headX;
    this.shL.rotation.set(p.lShX, 0, p.lShZ); this.shR.rotation.set(p.rShX, 0, p.rShZ); this.elL.rotation.x = p.lElX; this.elR.rotation.x = p.rElX;
    this.hipL.rotation.set(p.lHipX, 0, p.lHipZ); this.hipR.rotation.set(p.rHipX, 0, p.rHipZ); this.knL.rotation.x = p.lKnX; this.knR.rotation.x = p.rKnX;
    this.body.rotation.set(p.bodyX, p.spin, p.bodyZ); this.body.position.y = p.lift;
    if (this.coat) this.coat.rotation.x = Math.min(0.5, sp * 0.04) + (f.state === 'attack' ? 0.15 : 0);
    const x = f.px + (f.x - f.px) * alpha, z = f.pz + (f.z - f.pz) * alpha;
    this.root.position.set(x, f.y + f.layer * 15, z); this.root.rotation.y = f.yaw;
    this.stars.visible = f.state === 'dizzy'; if (this.stars.visible) this.stars.rotation.y += dt * 5;
    this.excl.visible = f.telegraph > 0 && Math.sin(f.telegraph * 30) > -0.5;
    this.flash(f.hurtFlash > 0.1);
  }
  private attackPose(f: Fighter, P: Pose) {
    const m = f.move!; const tt = f.moveT; const su = m.startup, ac = m.active;
    const ph = tt < su ? 0 : tt < su + ac ? 1 : 2; const a = ph === 0 ? tt / su : ph === 1 ? (tt - su) / ac : Math.min(1, (tt - su - ac) / m.recovery);
    const w = ph === 0 ? a : ph === 1 ? 1 : 1 - a; // 0..1 extension envelope
    P.lKnX = 0.25; P.rKnX = 0.25; P.hipsY = -0.05; P.lElX = -1.7; P.rElX = -1.8; P.lShX = -0.9; P.rShX = -0.7;
    const straight = (right: boolean, ext: number, twist: number) => {
      if (right) { P.rShX = -0.7 - 0.95 * ext; P.rElX = -1.9 * (1 - ext); P.torsoY = -twist * ext + 0.25 * (1 - ext); P.rShZ = -0.1; }
      else { P.lShX = -0.9 - 0.75 * ext; P.lElX = -1.7 * (1 - ext); P.torsoY = twist * ext + 0.25 * (1 - ext); }
      P.torsoX = 0.15 * ext; P.lHipX = -0.3; P.rHipX = 0.3;
    };
    switch (m.anim) {
      case 'jab': straight(false, ph === 0 ? a * 0.3 : w, 0.4); break;
      case 'cross': case 'counter': straight(true, ph === 0 ? a * 0.2 : w, 0.7); break;
      case 'hook': P.rShX = -1.4 * w - 0.3; P.rShZ = -1.2 * w; P.rElX = -1.3; P.torsoY = ph === 0 ? 0.5 * a : -0.8 * w; break;
      case 'uppercut': P.rShX = ph === 0 ? 0.3 * a : -2.6 * w; P.rElX = -1.2 * (1 - w * 0.5); P.torsoX = ph === 0 ? 0.3 * a : -0.35 * w; P.hipsY = ph === 0 ? -0.18 * a : 0.05; P.lKnX = 0.5 * (ph === 0 ? a : 1 - w); break;
      case 'heavy': case 'finisher': if (ph === 0) { P.rShX = 0.9 * a; P.rElX = -1.2; P.torsoY = 0.9 * a; P.torsoX = -0.1; P.hipsY = -0.12 * a; } else { straight(true, w, 1.1); P.torsoX = 0.3 * w; P.rHipX = 0.6 * w; } break;
      case 'kick': case 'kick2': P.lHipX = -1.55 * w; P.lKnX = ph === 0 ? 1.4 * a : 0.2 + (1 - w) * 1.2; P.torsoX = -0.25 * w; P.lShX = -0.6; P.rShX = -0.4; P.rKnX = 0.15; break;
      case 'roundhouse': case 'hkick': { P.rHipX = -1.1 * w; P.rHipZ = -1.3 * w; P.rKnX = ph === 0 ? 1.1 * a : 0.25; P.torsoX = -0.3 * w; P.lShZ = 0.8 * w; P.rShZ = -0.8 * w; P.spin = ph === 1 ? -a * Math.PI * (m.anim === 'hkick' ? 2 : 1) : 0; break; }
      case 'flykick': P.lHipX = -1.5; P.lKnX = 0.1; P.rHipX = 0.4; P.rKnX = 1.6; P.torsoX = -0.4; P.lShZ = 0.9; P.rShZ = -0.9; P.bodyX = -0.3; break;
      case 'headbutt': P.torsoX = ph === 0 ? -0.5 * a : 0.9 * w; P.headX = ph === 0 ? -0.4 : 0.6 * w; P.lShX = 0.4; P.rShX = 0.4; break;
      case 'grab': P.lShX = -1.5 * w; P.rShX = -1.5 * w; P.lElX = -0.3; P.rElX = -0.3; P.torsoX = 0.3 * w; P.lShZ = -0.25; P.rShZ = 0.25; break;
      case 'throw': P.torsoY = ph === 0 ? 0.7 * a : -1.4 * w; P.lShX = -1.3; P.rShX = -1.3; P.lElX = -0.4; P.rElX = -0.4; P.torsoX = 0.2; break;
      case 'spin': { const sp = ph === 1 ? a * Math.PI * 2 * (m.hits || 3) * 0.5 : 0; P.spin = -sp; P.lShZ = 1.4 * w; P.rShZ = -1.4 * w; P.lElX = -0.2; P.rElX = -0.2; P.hipsY = -0.1; P.rHipZ = -0.5 * w; break; }
      case 'charge': P.torsoX = ph === 0 ? 0.3 + Math.sin(f.animT * 40) * 0.05 : 0.9; P.headX = 0.4; P.lShX = 0.6; P.rShX = 0.6; P.lKnX = 0.6; P.rKnX = 0.6; P.hipsY = -0.18; if (ph === 1) { const s = Math.sin(f.animT * 18); P.lHipX = -s; P.rHipX = s; } break;
      case 'stance': P.lShX = -1.5; P.lElX = -0.4; P.rShX = -0.9; P.rElX = -1.6; P.lShZ = -0.2; P.torsoY = 0.5; P.torsoX = 0.1; P.lKnX = 0.6; P.rKnX = 0.6; P.hipsY = -0.18; P.lHipX = -0.5; P.rHipX = 0.4; break;
      case 'slam': if (ph === 0) { P.lShX = -2.9 * a; P.rShX = -2.9 * a; P.lElX = -0.4; P.rElX = -0.4; P.torsoX = -0.3 * a; P.lift = Math.sin(a * Math.PI) * 1.2; } else { P.lShX = -1.2; P.rShX = -1.2; P.torsoX = 0.7 * w; P.hipsY = -0.3 * w; P.lKnX = 1.0 * w; P.rKnX = 1.0 * w; } break;
      case 'rush': { const s = Math.sin(f.animT * 45); straight(s > 0, Math.abs(s), 0.5); break; }
      case 'dash': { P.torsoX = 0.6; P.lShX = 0.8; P.rShX = 0.8; P.lShZ = 0.5; P.rShZ = -0.5; const s = Math.sin(f.animT * 30); P.lHipX = -s * 1.2; P.rHipX = s * 1.2; if (ph === 1) { P.rHipX = -1.3; P.rHipZ = -0.8; } break; }
      default: straight(true, w, 0.6);
    }
  }
  dispose() { this.root.removeFromParent(); }
}
