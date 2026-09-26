import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CityData, Prop, Building } from '../sim/cityGen';
import { toon, buildingMaterial, outlineMat, canvasTexture, shared, fadeable, fadeGeometry } from './toon';
import { MAP_HALF, ROOF, RIVER } from '../data/city';
import { mulberry32 } from '../core/rng';

const CH = 50, NCH = Math.ceil((MAP_HALF * 2 + 4) / CH);
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const GEOS: Record<string, THREE.BufferGeometry> = {
  box: unitBox,
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
  foliage: new THREE.IcosahedronGeometry(1, 0),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0),
};
interface Inst { geo: string; mat: string; p: THREE.Vector3; r: number; s: THREE.Vector3; color: string; outline: boolean }
const matFor = (key: string): THREE.Material => {
  if (key === 'toon') return toon('#ffffff');
  if (key === 'lampHead') return lampHeadMat; if (key === 'lantern') return lanternMat; if (key === 'glass') return toon('#9fb8c8');
  if (key === 'vendingFront') return vendingMat; return toon('#ffffff');
};
export const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
export const lanternMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a });
export const vendingMat = new THREE.MeshBasicMaterial({ color: 0xe8f4ff });
const signMats: THREE.MeshBasicMaterial[] = [];
/** Per-building render handles for the camera occluder fade (buildings between camera and fight become see-through). */
interface BInfo { b: Building; fa: THREE.InstancedBufferAttribute; i: number; cur: number; afa: THREE.InstancedBufferAttribute | null; a0: number; a1: number; signs: THREE.Object3D[]; roofTop: boolean; camIn?: boolean }
/** Per-prop-instance handle (lamps, poles, trees, arches, containers...) for the same fade. */
interface PInfo { fa: THREE.InstancedBufferAttribute; i: number; cur: number; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; g: THREE.Group }
const FADE_B = 0.14, FADE_P = 0.22;

export class CityView {
  group = new THREE.Group(); chunks: { g: THREE.Group; built: boolean; cx: number; cz: number; items: Inst[]; buildings: Building[]; signs: Building[] }[] = [];
  lampPools!: THREE.InstancedMesh; water!: THREE.Mesh; waterTex!: THREE.Texture; skyMat!: THREE.ShaderMaterial; stars!: THREE.Points; sky!: THREE.Mesh;
  glowSprites: THREE.Sprite[] = []; bMat = buildingMaterial(); binfos: BInfo[] = []; pinfos: PInfo[] = []; cutCount = 0; propFadeCount = 0;
  constructor(private city: CityData, private quality: number) {
    for (let i = 0; i < NCH * NCH; i++) this.chunks.push({ g: new THREE.Group(), built: false, cx: (i % NCH) * CH - MAP_HALF - 2 + CH / 2, cz: Math.floor(i / NCH) * CH - MAP_HALF - 2 + CH / 2, items: [], buildings: [], signs: [] });
    for (const c of this.chunks) { c.g.visible = false; this.group.add(c.g); }
    const chunkOf = (x: number, z: number) => this.chunks[Math.max(0, Math.min(NCH - 1, Math.floor((z + MAP_HALF + 2) / CH))) * NCH + Math.max(0, Math.min(NCH - 1, Math.floor((x + MAP_HALF + 2) / CH)))];
    for (const b of city.buildings) { const c = chunkOf((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); c.buildings.push(b); if (b.sign) c.signs.push(b); }
    const rnd = mulberry32(7);
    for (const p of city.props) for (const it of this.propInstances(p, rnd)) chunkOf(it.p.x, it.p.z).items.push(it);
    for (const [x, z] of city.lamps) for (const it of this.propInstances({ t: 'lamp', x, z }, rnd)) chunkOf(x, z).items.push(it);
    this.buildGround(); this.buildSky(); this.buildLampPools(); this.buildStatic();
  }
  private I(geo: string, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, r = 0, outline = true, mat = 'toon'): Inst {
    return { geo, mat, p: new THREE.Vector3(x, y, z), r, s: new THREE.Vector3(sx, sy, sz), color, outline };
  }
  private propInstances(p: Prop, rnd: () => number): Inst[] {
    const I = this.I.bind(this); const out: Inst[] = []; const y0 = (p.layer || 0) * ROOF.y; const r = p.rot || 0;
    const c = Math.cos(r), s = Math.sin(r); const off = (lx: number, lz: number): [number, number] => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
    switch (p.t) {
      case 'tree': case 'sakura': { const h = 2.2 + rnd() * 1.2, fs = 1.5 + rnd() * 0.8; out.push(I('cyl', '#5a3e2a', p.x, 0, p.z, 0.35, h, 0.35)); out.push(I('foliage', p.t === 'sakura' ? '#f2a8c4' : ['#4f8f3a', '#5c9e44', '#3f7a34'][Math.floor(rnd() * 3)], p.x, h + fs * 0.6, p.z, fs, fs * 0.9, fs, rnd() * 3)); break; }
      case 'lamp': out.push(I('cyl', '#3a3d44', p.x, 0, p.z, 0.16, 5.2, 0.16, 0, false)); out.push(I('box', '#2a2c30', p.x, 5.1, p.z, 0.5, 0.18, 0.5, 0, false)); out.push(I('box', '#fff', p.x, 4.95, p.z, 0.38, 0.12, 0.38, 0, false, 'lampHead')); break;
      case 'car': { const [ax, az] = [p.x, p.z]; out.push(I('box', p.color!, ax, 0.3, az, 4.2, 0.75, 1.85, r)); const [cx, cz] = off(-0.3, 0); out.push(I('box', p.color!, cx, 1.05, cz, 2.2, 0.6, 1.7, r)); out.push(I('box', '#1e2630', cx, 1.08, cz, 2.25, 0.42, 1.74, r, false)); for (const [lx, lz] of [[1.3, 0.8], [1.3, -0.8], [-1.3, 0.8], [-1.3, -0.8]]) { const [wx, wz] = off(lx, lz); out.push(I('cyl', '#151515', wx, 0.0, wz, 0.6, 0.35, 0.6, 0, false)); } break; }
      case 'bike': out.push(I('box', p.color!, p.x, 0.35, p.z, 1.8, 0.45, 0.4, r)); out.push(I('box', '#222', p.x, 0.75, p.z, 0.9, 0.2, 0.35, r)); break;
      case 'container': out.push(I('box', p.color!, p.x, 0, p.z, 6, 2.6, 2.5, r)); break;
      case 'crate': out.push(I('box', '#a07a4a', p.x, 0, p.z, 1.2, 1.2, 1.2, r)); break;
      case 'bench': out.push(I('box', '#8a5a3a', p.x, y0 + 0.42, p.z, 2, 0.12, 0.6)); out.push(I('box', '#8a5a3a', p.x, y0 + 0.5, p.z + 0.3, 2, 0.5, 0.1)); out.push(I('box', '#333', p.x - 0.8, y0, p.z, 0.1, 0.42, 0.5, 0, false)); out.push(I('box', '#333', p.x + 0.8, y0, p.z, 0.1, 0.42, 0.5, 0, false)); break;
      case 'vending': out.push(I('box', p.color || '#d03a3a', p.x, y0, p.z, 1.2, 1.9, 0.8, r)); { const [fx, fz] = off(0, 0.41); out.push(I('box', '#fff', fx, y0 + 0.9, fz, 0.9, 0.8, 0.02, r, false, 'vendingFront')); } break;
      case 'fence': out.push(I('box', p.color || '#5a6a60', p.x, y0, p.z, p.w!, p.h || 2.2, p.d!, 0, true)); break;
      case 'arch': out.push(I('box', '#c8b48a', p.x, 7.2, p.z, 9.5, 0.35, 0.5, 0)); out.push(I('box', '#d8d0c0', p.x, 7.4, p.z + 4, 9, 0.12, 8, 0, false)); break;
      case 'lantern': out.push(I('sphere', '#fff', p.x, 5.6, p.z, 0.55, 0.75, 0.55, 0, false, 'lantern')); break;
      case 'stairhouse': case 'tank': out.push(I('box', p.color!, p.x, y0, p.z, p.w!, p.h!, p.d!)); if (p.t === 'tank') out.push(I('cyl', '#9ab0b8', p.x, y0 + p.h!, p.z, 3, 2, 3)); break;
      case 'goal': { for (const lz of [-3.6, 3.6]) { const [gx, gz] = off(0, lz); out.push(I('cyl', '#eee', gx, 0, gz, 0.12, 2.4, 0.12, 0, false)); } out.push(I('box', '#eee', p.x, 2.35, p.z, 0.12, 0.12, 7.3, r, false)); break; }
      case 'playground': out.push(I('box', '#d04040', p.x - 2, 0, p.z, 0.2, 3, 0.2)); out.push(I('box', '#d04040', p.x + 2, 0, p.z, 0.2, 3, 0.2)); out.push(I('box', '#e0c040', p.x, 3, p.z, 4.4, 0.25, 0.25)); out.push(I('box', '#4080d0', p.x, 0, p.z + 2, 3, 1.2, 1.2)); break;
      case 'torii': out.push(I('cyl', '#d0402a', p.x - 2, 0, p.z, 0.45, 5, 0.45)); out.push(I('cyl', '#d0402a', p.x + 2, 0, p.z, 0.45, 5, 0.45)); out.push(I('box', '#222', p.x, 5, p.z, 6.2, 0.4, 0.6)); out.push(I('box', '#d0402a', p.x, 4.2, p.z, 5, 0.3, 0.4)); break;
      case 'train': out.push(I('box', '#d8dcd8', p.x, 0.5, p.z, p.w!, 3.2, 3)); out.push(I('box', '#2a8a4a', p.x, 1.2, p.z, p.w! + 0.05, 0.35, 3.05, 0, false)); out.push(I('box', '#26303a', p.x, 2.2, p.z, p.w! + 0.04, 0.7, 3.04, 0, false)); break;
      case 'bridge': out.push(I('box', '#8a8680', p.x, -0.6, p.z, p.w!, 0.62, p.d!, 0, true)); for (const sx of [-1, 1]) out.push(I('box', '#c05040', p.x + sx * (p.w! / 2 - 0.1), 0, p.z, 0.25, 1.2, p.d!, 0, true)); for (let k = -1; k <= 1; k += 2) out.push(I('cyl', '#7a7670', p.x, -4, p.z + k * 7, 2.4, 4, 2.4)); break;
      case 'fishing': out.push(I('cyl', '#333', p.x + 0.8, 0.5, p.z + 1, 0.04, 3, 0.04, 0, false)); out.push(I('box', '#4a6a8a', p.x - 0.8, 0, p.z, 0.5, 0.4, 0.4)); break;
      case 'pond': break;
      case 'clock': out.push(I('cyl', '#555', p.x, 0, p.z, 0.25, 4.5, 0.25, 0, false)); out.push(I('cyl', '#f0f0e8', p.x, 4.5, p.z, 1.2, 0.3, 1.2)); break;
      case 'lamp_flood': out.push(I('cyl', '#444', p.x, 0, p.z, 0.3, 9, 0.3, 0, false)); out.push(I('box', '#fff', p.x, 9, p.z, 1.4, 0.4, 0.8, 0, false, 'lampHead')); break;
    }
    return out;
  }
  private buildChunk(c: typeof this.chunks[0]) {
    c.built = true;
    // buildings
    if (c.buildings.length) {
      const bs = c.buildings; const n = bs.length; const { g: bg, a: fa } = fadeGeometry(unitBox, n);
      const im = new THREE.InstancedMesh(bg, fadeable(this.bMat), n); const om = new THREE.InstancedMesh(bg, fadeable(outlineMat), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); const t = 0.09;
      const roofs: Inst[] = []; const infos: BInfo[] = [];
      bs.forEach((b, i) => {
        const a0 = roofs.length;
        const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        m.compose(new THREE.Vector3(cx, 0, cz), q, new THREE.Vector3(w, b.h, d)); im.setMatrixAt(i, m); im.setColorAt(i, col.set(b.color));
        m.compose(new THREE.Vector3(cx, -t, cz), q, new THREE.Vector3(w + t * 2, b.h + t * 2, d + t * 2)); om.setMatrixAt(i, m);
        const isRoofTop = b.x0 <= ROOF.rect[0] + 1 && b.x1 >= ROOF.rect[2] - 1 && b.z0 <= ROOF.rect[1] + 1 && b.z1 >= ROOF.rect[3] - 1; // playable rooftop: keep the floor clear
        if (!isRoofTop) roofs.push(this.I('box', '#6a6a66', cx, b.h, cz, w + 0.4, 0.5, d + 0.4, 0, false));
        if (!isRoofTop && b.kind !== 'school' && b.kind !== 'warehouse' && w > 6 && d > 6 && (i % 3 === 0)) roofs.push(this.I('box', '#9a9a96', cx + w * 0.2, b.h + 0.5, cz - d * 0.15, 1.8, 1.2, 1.4));
        if (b.kind === 'shop' || b.kind === 'alley') { // awning
          const side = b.signSide || 's'; const aw = side === 'e' || side === 'w' ? [0.9, 0.12, d * 0.9] : [w * 0.9, 0.12, 0.9]; const ax = side === 'e' ? b.x1 + 0.45 : side === 'w' ? b.x0 - 0.45 : cx; const az = side === 's' ? b.z1 + 0.45 : side === 'n' ? b.z0 - 0.45 : cz;
          roofs.push(this.I('box', ['#c83a3a', '#3a6ac8', '#e0a030', '#3a9a5a'][i % 4], ax, 3.1, az, aw[0], 0.38, aw[2], 0, false)); roofs.push(this.I('box', '#f4f0e6', ax, 2.86, az, aw[0] * 1.01, 0.1, aw[2] * 1.01, 0, false));
        }
        infos.push({ b, fa, i, cur: 1, afa: null, a0, a1: roofs.length, signs: [], roofTop: isRoofTop });
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); om.computeBoundingSphere();
      c.g.add(im, om);
      // building attachments (roof caps, awnings) live in their own instanced mesh so they can hide with the cutaway
      if (roofs.length) {
        const { g: ag, a: afa } = fadeGeometry(unitBox, roofs.length); const att = new THREE.InstancedMesh(ag, fadeable(matFor('toon')), roofs.length);
        roofs.forEach((it, k) => { const mm = new THREE.Matrix4().compose(it.p, q.identity(), it.s); att.setMatrixAt(k, mm); att.setColorAt(k, col.set(it.color)); });
        att.castShadow = this.quality > 1; att.receiveShadow = true; att.computeBoundingSphere(); c.g.add(att);
        for (const inf of infos) inf.afa = afa;
      }
      for (const b of c.signs) { const objs = this.makeSign(c.g, b); const inf = infos.find(x => x.b === b); if (inf) inf.signs.push(...objs); }
      this.binfos.push(...infos);
    }
    // grouped instanced props
    const groups = new Map<string, Inst[]>(); for (const it of c.items) { const k = it.geo + '|' + it.mat + '|' + (it.outline ? 1 : 0); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(it); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    for (const [k, list] of groups) {
      const [geoK, matK, ol] = k.split('|'); const geo = GEOS[geoK]; const mat = matFor(matK);
      const { g: pg, a: pfa } = fadeGeometry(geo, list.length);
      const im = new THREE.InstancedMesh(pg, fadeable(mat), list.length); const om = ol === '1' && this.quality > 0 ? new THREE.InstancedMesh(pg, fadeable(outlineMat), list.length) : null;
      geo.computeBoundingBox(); const bb = geo.boundingBox!; const size = new THREE.Vector3(); bb.getSize(size); const t = 0.05;
      list.forEach((it, i) => {
        { // occluder bounds (rotation-safe radius); low props never block the view
          const centred = geoK === 'foliage' || geoK === 'sphere'; const hy = geoK === 'foliage' ? it.s.y : it.s.y / 2; const y0 = centred ? it.p.y - hy : it.p.y, y1 = centred ? it.p.y + hy : it.p.y + it.s.y;
          const rad = (geoK === 'foliage' ? Math.max(it.s.x, it.s.z) : Math.max(it.s.x, it.s.z) * 0.5 * (geoK === 'box' && it.r ? 1.42 : 1)) + 0.1; const rx = geoK === 'box' && !it.r ? it.s.x / 2 + 0.1 : rad, rz = geoK === 'box' && !it.r ? it.s.z / 2 + 0.1 : rad;
          if (y1 > 1.0) this.pinfos.push({ fa: pfa, i, cur: 1, x0: it.p.x - rx, x1: it.p.x + rx, y0, y1, z0: it.p.z - rz, z1: it.p.z + rz, g: c.g });
        }
        q.setFromAxisAngle(up, it.r); m.compose(it.p, q, it.s); im.setMatrixAt(i, m); if (matK === 'toon') im.setColorAt(i, col.set(it.color));
        if (om) { const s2 = new THREE.Vector3(it.s.x + 2 * t / size.x, it.s.y + 2 * t / size.y, it.s.z + 2 * t / size.z); const p2 = it.p.clone(); if (geoK === 'box' || geoK === 'cyl' || geoK === 'cone') p2.y -= t; m.compose(p2, q, s2); om.setMatrixAt(i, m); }
      });
      im.castShadow = this.quality > 1 && matK === 'toon'; im.receiveShadow = true; im.computeBoundingSphere(); c.g.add(im); if (om) { om.computeBoundingSphere(); c.g.add(om); }
    }
  }
  private makeSign(g: THREE.Group, b: Building): THREE.Object3D[] {
    const made: THREE.Object3D[] = [];
    const vertical = b.kind === 'shop' && b.h < 12 && b.signSide !== 'n' && b.signSide !== 's';
    const txt = b.sign!; const tex = canvasTexture(vertical ? 96 : 512, vertical ? 384 : 128, (c) => {
      const W = c.canvas.width, H = c.canvas.height; c.fillStyle = '#141418'; c.fillRect(0, 0, W, H); c.strokeStyle = b.signColor!; c.lineWidth = 8; c.strokeRect(6, 6, W - 12, H - 12);
      c.fillStyle = b.signColor!; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (vertical) { const chars = [...txt].slice(0, 5); const fs = Math.min(70, (H - 30) / chars.length); c.font = `900 ${fs}px "Noto Sans CJK JP", "Kanit", sans-serif`; chars.forEach((ch, i) => c.fillText(ch, W / 2, 20 + fs * 0.55 + i * fs)); }
      else { c.font = `900 ${Math.min(80, 900 / txt.length)}px "Noto Sans CJK JP", "Kanit", sans-serif`; c.fillText(txt, W / 2, H / 2 + 4); }
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xdddddd, transparent: true }); signMats.push(mat);
    const w = vertical ? 1.0 : Math.min(10, (b.x1 - b.x0) * 0.8), h = vertical ? 4 : 1.8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const side = b.signSide || 's'; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; const y = vertical ? Math.min(b.h - 2.2, 5.2) : Math.min(b.h - 1.2, 4.6);
    if (side === 'e') { mesh.position.set(b.x1 + (vertical ? 0.6 : 0.06), y, cz); mesh.rotation.y = Math.PI / 2; }
    else if (side === 'w') { mesh.position.set(b.x0 - (vertical ? 0.6 : 0.06), y, cz); mesh.rotation.y = -Math.PI / 2; }
    else if (side === 'n') { mesh.position.set(cx, y, b.z0 - 0.06); mesh.rotation.y = Math.PI; }
    else mesh.position.set(cx, y, b.z1 + 0.06);
    if (vertical) { mesh.rotation.y += Math.PI / 2; const back = mesh.clone(); back.rotation.y += Math.PI; g.add(back); made.push(back); }
    g.add(mesh); made.push(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: b.signColor, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    glow.position.copy(mesh.position); glow.scale.set(w * 2.2, h * 1.6, 1); g.add(glow); this.glowSprites.push(glow); made.push(glow);
    return made;
  }
  /**
   * Camera occluder fade: buildings whose volume intersects a sight line camera->(player / engaged enemies), or that
   * contain / hug the camera, fade to a screen-door see-through; their roof caps and awnings fade with them and signs
   * turn translucent. Street lamps, poles, trees, arches, containers etc. on those sight lines or right in front of the
   * lens fade the same way, so nothing opaque covers the fight. The rooftop-playable school building never fades.
   */
  updateCutaway(cam: THREE.Vector3, pts: THREE.Vector3[], dt: number) {
    // stop each sight line ~0.9 m short of its target so a wall the fighter is leaning on (behind them) doesn't fade
    pts = pts.map(p => { const v = p.clone().sub(cam); const L = v.length(); return L > 1.2 ? cam.clone().addScaledVector(v, (L - 0.9) / L) : p; });
    let minX = cam.x, maxX = cam.x, minZ = cam.z, maxZ = cam.z; for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const dirty = new Set<THREE.InstancedBufferAttribute>(); let n = 0;
    const step = (cur: number, want: number, snap: boolean) => Math.abs(cur - want) < 0.02 || (snap && want < cur) ? want : cur + (want - cur) * (1 - Math.exp(-(want < cur ? 12 : 5) * dt));
    for (const inf of this.binfos) {
      const b = inf.b; let want = 1; inf.camIn = false;
      if (!inf.roofTop && b.x1 > minX - 1.5 && b.x0 < maxX + 1.5 && b.z1 > minZ - 1.5 && b.z0 < maxZ + 1.5) {
        const inside = cam.x > b.x0 - 1.2 && cam.x < b.x1 + 1.2 && cam.z > b.z0 - 1.2 && cam.z < b.z1 + 1.2 && cam.y < b.h + 1.5;
        inf.camIn = inside;
        if (inside) want = 0; // hugging the lens: hide completely (no full-screen screen-door)
        else { const dx = Math.max(b.x0 - cam.x, 0, cam.x - b.x1), dy = Math.max(0, cam.y - b.h - 0.5), dz = Math.max(b.z0 - cam.z, 0, cam.z - b.z1);
          if (dx * dx + dy * dy + dz * dz < 9 || pts.some(p => segBox(cam, p, b.x0 - 0.35, 0, b.z0 - 0.35, b.x1 + 0.35, b.h + 0.4, b.z1 + 0.35))) want = FADE_B; } // on a sight line, or right under/next to the lens
      }
      if (want === 1 && inf.cur === 1) continue;
      const wasFull = inf.cur > 0.97; inf.cur = step(inf.cur, want, !!inf.camIn); if (inf.cur < 1) n++;
      inf.fa.setX(inf.i, inf.cur); dirty.add(inf.fa);
      if (inf.afa) { for (let k = inf.a0; k < inf.a1; k++) inf.afa.setX(k, inf.cur); dirty.add(inf.afa); }
      const full = inf.cur > 0.97;
      for (const o of inf.signs) { if ((o as THREE.Sprite).isSprite) o.visible = full; else { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = Math.max(0.15, inf.cur); m.depthWrite = full; } }
      if (full !== wasFull && full) for (const o of inf.signs) o.visible = true;
    }
    let pn = 0;
    for (const pi of this.pinfos) {
      let want = 1;
      if (pi.g.visible && pi.x1 > minX - 3 && pi.x0 < maxX + 3 && pi.z1 > minZ - 3 && pi.z0 < maxZ + 3) {
        const dx = Math.max(pi.x0 - cam.x, 0, cam.x - pi.x1), dy = Math.max(pi.y0 - cam.y, 0, cam.y - pi.y1), dz = Math.max(pi.z0 - cam.z, 0, cam.z - pi.z1);
        if (dx * dx + dy * dy + dz * dz < 2.6 * 2.6 || pts.some(p => segBox(cam, p, pi.x0 - 0.25, pi.y0, pi.z0 - 0.25, pi.x1 + 0.25, pi.y1 + 0.2, pi.z1 + 0.25))) want = FADE_P;
      }
      if (want === 1 && pi.cur === 1) continue;
      pi.cur = step(pi.cur, want, false); if (pi.cur < 1) pn++; pi.fa.setX(pi.i, pi.cur); dirty.add(pi.fa);
    }
    for (const a of dirty) a.needsUpdate = true;
    this.cutCount = n; this.propFadeCount = pn;
  }
  private buildGround() {
    const kinds: Record<string, string> = { road: '#3b3d44', tile: '#b7a68a', grass: '#6aa84f', dirt: '#b99c6c', concrete: '#8f8e88', parking: '#46484e', deck: '#8b8781', roof: '#8e948f', rail: '#5a4c3e' };
    const base = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 2 + 60, MAP_HALF * 2 + 60).rotateX(-Math.PI / 2), toon('#9b978f')); base.receiveShadow = true; this.group.add(base);
    const byKind = new Map<string, THREE.BufferGeometry[]>();
    let order = 0;
    for (const p of this.city.patches) {
      if (p.kind === 'water') continue; const y = p.kind === 'roof' ? ROOF.y + 0.02 : 0.02 + (p.kind === 'road' ? 0 : p.kind === 'deck' ? 0.03 : 0.01) + (order++ % 3) * 0.001;
      const g = new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0).rotateX(-Math.PI / 2).translate((p.x0 + p.x1) / 2, y, (p.z0 + p.z1) / 2);
      if (!byKind.has(p.kind)) byKind.set(p.kind, []); byKind.get(p.kind)!.push(g);
    }
    for (const [k, gs] of byKind) { const mesh = new THREE.Mesh(mergeGeometries(gs), toon(kinds[k] || '#888')); mesh.receiveShadow = true; this.group.add(mesh); }
    // road markings (dashes + crosswalks)
    const marks: THREE.BufferGeometry[] = [];
    for (const zc of [-82, 0, 101]) for (let x = -196; x < 196; x += 8) marks.push(new THREE.PlaneGeometry(3, 0.25).rotateX(-Math.PI / 2).translate(x, 0.035, zc));
    for (const xc of [-80, 80]) for (let z = -196; z < 96; z += 8) marks.push(new THREE.PlaneGeometry(0.25, 3).rotateX(-Math.PI / 2).translate(xc, 0.035, z));
    for (const [cx, cz, horiz] of [[-80, -11, 1], [-80, 11, 1], [80, -11, 1], [80, 11, 1], [0, -11, 1], [-88, 0, 0], [88, 0, 0], [-72, 0, 0], [72, 0, 0], [0, 12, 1], [136, 0, 0]] as [number, number, number][])
      for (let i = -3; i <= 3; i++) marks.push(new THREE.PlaneGeometry(horiz ? 0.8 : 5, horiz ? 5 : 0.8).rotateX(-Math.PI / 2).translate(horiz ? cx + i * 1.4 : cx, 0.036, horiz ? cz : cz + i * 1.4));
    for (let x = 88; x < 198; x += 1.2) marks.push(new THREE.PlaneGeometry(0.3, 6).rotateX(-Math.PI / 2).translate(x, 0.04, 44)); // rail sleepers
    const mm = new THREE.Mesh(mergeGeometries(marks), toon('#e8e6de', { halftone: false })); mm.receiveShadow = true; this.group.add(mm);
    const rails: THREE.BufferGeometry[] = []; for (const z of [42.2, 45.8]) rails.push(new THREE.BoxGeometry(112, 0.15, 0.12).translate(142, 0.1, z));
    this.group.add(new THREE.Mesh(mergeGeometries(rails), toon('#8a8a90')));
    // water (river + pond) with scrolling stripes
    this.waterTex = canvasTexture(128, 128, (c) => { c.fillStyle = '#3a78a8'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(200,235,255,0.55)'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); const y = i * 22 + 8; c.moveTo(10 + i * 13, y); c.lineTo(50 + i * 13, y); c.stroke(); } });
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping; this.waterTex.repeat.set(40, 3);
    const wm = new THREE.MeshBasicMaterial({ map: this.waterTex, color: 0xb0c8d8 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(420, RIVER.z1 - RIVER.z0).rotateX(-Math.PI / 2).translate(0, -0.4, (RIVER.z0 + RIVER.z1) / 2), wm); this.group.add(this.water);
    const bankG = [new THREE.BoxGeometry(420, 0.5, 0.6).translate(0, -0.2, RIVER.z0 + 0.3), new THREE.BoxGeometry(420, 0.5, 0.6).translate(0, -0.2, RIVER.z1 - 0.3)];
    this.group.add(new THREE.Mesh(mergeGeometries(bankG), toon('#8a8478')));
    const pond = this.city.props.find(p => p.t === 'pond'); if (pond) { const pm = new THREE.Mesh(new THREE.CircleGeometry(pond.w!, 24).rotateX(-Math.PI / 2).translate(pond.x, 0.06, pond.z), wm); this.group.add(pm); const rim = new THREE.Mesh(new THREE.TorusGeometry(pond.w!, 0.35, 5, 28).rotateX(Math.PI / 2).translate(pond.x, 0.1, pond.z), toon('#a09a8a')); this.group.add(rim); }
  }
  private buildStatic() {
    // boundary: tall distant walls/"hills" so the map edge reads as the end of the city
    const H = MAP_HALF + 3; const wallMat = toon('#6d7270');
    for (const [x, z, w, d] of [[0, -H, H * 2 + 6, 3], [0, H, H * 2 + 6, 3], [-H, 0, 3, H * 2 + 6], [H, 0, 3, H * 2 + 6]] as [number, number, number, number][]) { const m = new THREE.Mesh(unitBox, wallMat); m.position.set(x, 0, z); m.scale.set(w, 4, d); m.receiveShadow = true; this.group.add(m); }
    const hills = new THREE.InstancedMesh(GEOS.cone, toon('#4e6a58'), 40); const m4 = new THREE.Matrix4(); const r = mulberry32(3);
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const R = 320 + r() * 40; const s = 60 + r() * 60; m4.compose(new THREE.Vector3(Math.cos(a) * R, -5, Math.sin(a) * R), new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s * 0.6, s * 1.6)); hills.setMatrixAt(i, m4); }
    hills.computeBoundingSphere(); this.group.add(hills);
    // school gate plates
    for (const [x, z, txt, col] of [[-130, -90, '黒鉄高校', '#c0262d'], [140, -90, '白龍学園', '#2a6fd6'], [-110, 150, '鉄腕工業高校', '#f0a020']] as [number, number, string, string][]) {
      for (const dx of [-12, 12]) { const pil = new THREE.Mesh(unitBox, toon('#b0aca4')); pil.position.set(x + dx, 0, z); pil.scale.set(1.2, 3.2, 1.2); pil.castShadow = true; this.group.add(pil); }
      const tex = canvasTexture(256, 64, (c) => { c.fillStyle = '#f4f0e6'; c.fillRect(0, 0, 256, 64); c.fillStyle = col; c.font = '900 40px "Noto Sans CJK JP", sans-serif'; c.textAlign = 'center'; c.fillText(txt, 128, 46); });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: tex })); plate.position.set(x + 12, 2.3, z + 0.62); this.group.add(plate);
    }
    // arcade gates
    for (const z of [-8.6, -77.4]) { const beam = new THREE.Mesh(unitBox, toon('#b03a2a')); beam.position.set(0, 7.6, z); beam.scale.set(10, 1.6, 0.6); this.group.add(beam);
      const tex = canvasTexture(512, 96, (c) => { c.fillStyle = '#b03a2a'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ffe9a0'; c.font = '900 64px "Noto Sans CJK JP", sans-serif'; c.textAlign = 'center'; c.fillText('ひので商店街', 256, 72); });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 1.4), new THREE.MeshBasicMaterial({ map: tex })); pl.position.set(0, 8.4, z + (z > -40 ? 0.32 : -0.32)); if (z < -40) pl.rotation.y = Math.PI; this.group.add(pl); signMats.push(pl.material as THREE.MeshBasicMaterial); }
    // rooftop door marker & roof slab edge
    const door = new THREE.Mesh(unitBox, toon('#5a4a3a')); door.position.set(ROOF.door[0], 0, -168.05); door.scale.set(1.6, 2.4, 0.2); this.group.add(door);
  }
  private buildLampPools() {
    const tex = glowTex(); const n = this.city.lamps.length;
    this.lampPools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }), n);
    const m = new THREE.Matrix4(); this.city.lamps.forEach(([x, z], i) => { m.compose(new THREE.Vector3(x, 0.07, z), new THREE.Quaternion(), new THREE.Vector3(9, 1, 9)); this.lampPools.setMatrixAt(i, m); });
    this.lampPools.computeBoundingSphere(); this.lampPools.renderOrder = 2; this.group.add(this.lampPools);
  }
  private buildSky() {
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color('#5aa0e8') }, horizon: { value: new THREE.Color('#cfe6f5') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff4d0') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.6)); float s = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 400.0) * 1.5 + pow(s, 8.0) * 0.25); gl_FragColor = vec4(c, 1.0); }' });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), this.skyMat); this.sky.renderOrder = -1; this.group.add(this.sky);
    const pts = new Float32Array(900); const r = mulberry32(5); for (let i = 0; i < 300; i++) { const a = r() * 6.28, e = 0.15 + r() * 1.3; pts[i * 3] = Math.cos(a) * Math.cos(e) * 850; pts[i * 3 + 1] = Math.sin(e) * 850; pts[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 850; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); this.group.add(this.stars);
  }
  /** Streaming/culling: chunks are built lazily when first approached and hidden beyond view distance. */
  update(camPos: THREE.Vector3, viewDist: number, night: number, time: number) {
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - camPos.x, c.cz - camPos.z);
      if (!c.built && d < viewDist + 70) this.buildChunk(c);
      c.g.visible = c.built && d < viewDist + 40;
    }
    this.sky.position.copy(camPos); this.stars.position.copy(camPos);
    this.waterTex.offset.x = time * 0.02; this.waterTex.offset.y = time * 0.01;
    const lampOn = night > 0.35;
    lampHeadMat.color.set(lampOn ? 0xfff0c0 : 0xb8b4a8); vendingMat.color.setScalar(0.75 + night * 0.6); lanternMat.color.setRGB(0.75 + night * 0.6, 0.25 + night * 0.1, 0.18);
    (this.lampPools.material as THREE.MeshBasicMaterial).opacity = Math.max(0, night - 0.3) * 0.85;
    for (const m of signMats) m.color.setScalar(0.82 + night * 0.5);
    for (const s of this.glowSprites) (s.material as THREE.SpriteMaterial).opacity = Math.max(0, night - 0.3) * 0.55;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, night - 0.5) * 1.6;
    shared.night.value = night;
  }
}
let _glow: THREE.Texture | null = null;
export function glowTex() { if (_glow) return _glow; _glow = canvasTexture(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }); return _glow; }
/** Segment (a->b) vs axis-aligned box intersection (slab test). */
function segBox(a: THREE.Vector3, b: THREE.Vector3, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  let tmin = 0, tmax = 1; const o = [a.x, a.y, a.z], d = [b.x - a.x, b.y - a.y, b.z - a.z], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return false; continue; }
    let t1 = (lo[k] - o[k]) / d[k], t2 = (hi[k] - o[k]) / d[k]; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return false;
  }
  return true;
}
