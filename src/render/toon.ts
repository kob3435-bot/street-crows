import * as THREE from 'three';
/** Cel shading helpers: 3-step gradient toon materials with a subtle halftone in shadows, ink-outline (inverted hull) helpers. */
let gradient: THREE.DataTexture | null = null;
export function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat); gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true; return gradient;
}
export const shared = { halftone: { value: 1.0 }, night: { value: 0.0 }, day: { value: 1.0 }, time: { value: 0 } };
function injectHalftone(sh: any) {
  sh.uniforms.uHalftone = shared.halftone;
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uHalftone;\nvoid main() {')
    .replace('#include <opaque_fragment>', `
      {
        float lumD = dot(reflectedLight.directDiffuse, vec3(0.3333));
        float base = dot(diffuseColor.rgb, vec3(0.3333)) + 0.02;
        float lit = clamp(lumD / base, 0.0, 1.0);
        vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy * 0.25);
        float dd = length(fract(hp) - 0.5);
        float rad = (1.0 - lit) * 0.42;
        outgoingLight *= 1.0 - step(dd, rad) * 0.16 * uHalftone;
      }
      #include <opaque_fragment>`);
}
const cache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: string | number, opts: { emissive?: string; halftone?: boolean } = {}): THREE.MeshToonMaterial {
  const key = String(color) + (opts.emissive || '') + (opts.halftone === false ? 'n' : '');
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: new THREE.Color(color as any), gradientMap: gradientMap() });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); }
    if (opts.halftone !== false) { m.onBeforeCompile = injectHalftone; m.customProgramCacheKey = () => 'toonHT'; }
    cache.set(key, m);
  }
  return m;
}
/** Building material: toon + procedural windows from world position (lit at night). */
export function buildingMaterial(): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradientMap() });
  m.onBeforeCompile = (sh: any) => {
    sh.uniforms.uNight = shared.night; sh.uniforms.uHalftone = shared.halftone;
    sh.vertexShader = 'varying vec3 vWPos;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      wp = modelMatrix * wp; vWPos = wp.xyz;
      vec3 wn = objectNormal;
      #ifdef USE_INSTANCING
        wn = mat3(instanceMatrix) * wn;
      #endif
      vWN = normalize(mat3(modelMatrix) * wn);`);
    sh.fragmentShader = 'varying vec3 vWPos;\nvarying vec3 vWN;\nuniform float uNight;\nuniform float uHalftone;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec3 n = normalize(vWN);
        if (abs(n.y) < 0.5) {
          float u = abs(n.x) > 0.5 ? vWPos.z : vWPos.x;
          vec2 cell = vec2(u / 3.1, vWPos.y / 3.0);
          vec2 f = fract(cell);
          float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.82) * step(2.6, vWPos.y);
          vec2 id = floor(cell) + floor(vWPos.xz * 0.02) * 17.0;
          float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
          vec3 glass = mix(vec3(0.33, 0.42, 0.52), vec3(0.08, 0.1, 0.16), uNight) * (0.8 + 0.4 * h);
          vec3 litc = vec3(1.0, 0.82, 0.5) * step(0.42, h) * uNight * 1.25;
          outgoingLight = mix(outgoingLight, glass + litc, win * 0.92);
          float frame = win * (1.0 - step(0.26, f.x) * step(f.x, 0.74) * step(0.34, f.y) * step(f.y, 0.76));
          outgoingLight = mix(outgoingLight, outgoingLight * 0.5, frame * 0.5);
        } else if (n.y > 0.5) {
          outgoingLight *= 0.86;
        }
        float lumD = dot(reflectedLight.directDiffuse, vec3(0.3333));
        float base = dot(diffuseColor.rgb, vec3(0.3333)) + 0.02;
        float lit = clamp(lumD / base, 0.0, 1.0);
        vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy * 0.25);
        outgoingLight *= 1.0 - step(length(fract(hp) - 0.5), (1.0 - lit) * 0.42) * 0.14 * uHalftone;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'building';
  return m;
}
export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0f, side: THREE.BackSide });
/** Adds an inverted-hull outline to a mesh by a scaled back-face clone (absolute thickness). */
export function addOutline(mesh: THREE.Mesh, size: THREE.Vector3, t = 0.035) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.set((size.x + t * 2) / size.x, (size.y + t * 2) / size.y, (size.z + t * 2) / size.z);
  o.userData.outline = true; mesh.add(o); return o;
}
export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d')!; draw(c);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Screen-door (ordered-dither) fade for instanced meshes: geometry carries a per-instance `aFade` attribute
 * (1 = opaque). Fragments are discarded against a 4x4 Bayer matrix, so faded occluders stay in the opaque
 * pass (no sorting issues) and read as see-through.
 */
function injectFade(sh: any) {
  sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = aFade;');
  sh.fragmentShader = 'varying float vFade;\nfloat fadeB2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }\nfloat fadeB4(vec2 a) { return fadeB2(0.5 * a) * 0.25 + fadeB2(a); }\n'
    + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vFade < 0.995 && fadeB4(gl_FragCoord.xy) >= vFade) discard;');
}
const fadeCache = new Map<string, THREE.Material>();
export function fadeable<M extends THREE.Material>(mat: M): M {
  let f = fadeCache.get(mat.uuid) as M | undefined;
  if (!f) {
    f = mat.clone() as M; const orig = mat; const key = 'F|' + orig.customProgramCacheKey();
    f.onBeforeCompile = (sh: any, r: any) => { orig.onBeforeCompile(sh, r); injectFade(sh); };
    f.customProgramCacheKey = () => key; fadeCache.set(mat.uuid, f);
  }
  return f;
}
/** Clone a geometry for one instanced mesh and give it a per-instance fade attribute (all opaque). */
export function fadeGeometry(geo: THREE.BufferGeometry, n: number) {
  const g = geo.clone(); const a = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aFade', a); return { g, a };
}
