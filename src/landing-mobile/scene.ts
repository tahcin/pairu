// The phone film's WebGL, tuned for mid-range Android: a portrait paddy field in late-afternoon
// light (fewer blades, no post-processing, DPR capped at 1.75), one rice leaf standing diagonally
// across the screen with brown spot, and 2,806 particles, one per approved use in the CIB&RC
// register for our 13 crops. Everything is driven by the film progress p in [0, 1].
import * as THREE from "three";
import type { Register } from "./data";
import { C, registerFrames, type Box, type Frame, type MobileLabels, newFrame } from "./layout";
import { M } from "./timing";

const PALETTE: Record<number, THREE.Color> = {
  [C.LEAF]: new THREE.Color("#3f7a3a"),
  [C.STRAW]: new THREE.Color("#b9a77f"),
  [C.TURMERIC]: new THREE.Color("#d08a1e"),
  [C.BRICK]: new THREE.Color("#a1311f"),
  [C.SPOT]: new THREE.Color("#6b3d1c"),
  [C.LIGHT]: new THREE.Color("#7fa15a"),
  [C.MUTED]: new THREE.Color("#cbbfa9"),
};
const PAPER = new THREE.Color("#f6f1e7");

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The low sun, ahead and to the left, so the field is backlit.
const SUN = new THREE.Vector3(-0.3, 0.2, -0.93).normalize();

const SKY_GLSL = /* glsl */ `
  uniform vec3 uSun;
  vec3 skyColor(vec3 dir) {
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 haze = vec3(0.93, 0.87, 0.74);
    vec3 high = vec3(0.96, 0.945, 0.905);
    vec3 c = mix(haze, high, smoothstep(0.0, 0.3, h));
    float s = max(dot(normalize(dir), uSun), 0.0);
    c = mix(c, vec3(0.97, 0.84, 0.60), pow(s, 5.0) * 0.5 * (1.0 - smoothstep(0.0, 0.5, h)));
    return c;
  }
`;

// A rice leaf: long and narrow, tapering to a point, twisting slightly. Wider than the desktop
// leaf, so the spots read on a small screen.
const LEAF_L = 3.3;
const LEAF_W = 0.5;
const leafHalfWidth = (u: number) => 0.48 * Math.pow(Math.max(0, 1 - u), 0.6) * smooth(0, 0.06, u);
const SPOTS: [number, number, number][] = [
  [0.16, 0.1, 0.026], [0.23, -0.38, 0.021], [0.3, 0.3, 0.031], [0.36, -0.06, 0.025], [0.43, 0.44, 0.018],
  [0.47, -0.4, 0.028], [0.53, 0.12, 0.034], [0.6, -0.24, 0.022], [0.64, 0.4, 0.019], [0.7, -0.02, 0.026],
  [0.75, 0.3, 0.017], [0.8, -0.32, 0.018], [0.26, 0.5, 0.013], [0.57, 0.48, 0.014],
];

function leafPoint(x: number, y: number, out: THREE.Vector3) {
  const xn = x / LEAF_L;
  const ridge = 0.016 * (1 - Math.min(1, Math.abs(y) / (LEAF_W / 2)));
  const a = 0.42 * xn + 0.1;
  const y2 = y * Math.cos(a) - ridge * Math.sin(a);
  const z2 = y * Math.sin(a) + ridge * Math.cos(a);
  return out.set(x, y2 + 0.07 * Math.sin(xn * 3), z2 - 0.3 * xn * xn + 0.05 * Math.sin(xn * 6));
}
const leafVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec3 p = position;
    float xn = p.x / ${LEAF_L.toFixed(2)};
    float ridge = 0.016 * (1.0 - min(1.0, abs(p.y) / ${(LEAF_W / 2).toFixed(3)}));
    float a = 0.42 * xn + 0.1;
    float y2 = p.y * cos(a) - ridge * sin(a);
    float z2 = p.y * sin(a) + ridge * cos(a);
    vec3 q = vec3(p.x, y2 + 0.07 * sin(xn * 3.0), z2 - 0.3 * xn * xn + 0.05 * sin(xn * 6.0));
    vec4 w = modelMatrix * vec4(q, 1.0);
    vView = w.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const leafFrag = /* glsl */ `
  precision mediump float;
  uniform float uScan;
  uniform float uResolve;
  uniform float uFade;
  uniform float uPlain;
  uniform float uSeed;
  uniform float uFog;
  uniform vec3 uSpots[${SPOTS.length}];
  varying vec2 vUv;
  varying vec3 vView;
  ${SKY_GLSL}
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    float u = vUv.x;
    float v = vUv.y - 0.5;
    float hw = 0.48 * pow(max(0.0, 1.0 - u), 0.6) * smoothstep(0.0, 0.06, u);
    hw *= 1.0 - 0.03 * fract(u * 240.0 + uSeed);
    if (abs(v) > hw) discard;
    float rel = v / max(hw, 0.0001);
    vec3 col = mix(vec3(0.25, 0.43, 0.16), vec3(0.40, 0.58, 0.23), 0.5 + 0.5 * rel);
    col *= 0.93 + 0.07 * smoothstep(0.7, 1.0, abs(sin(rel * 3.14159 * 8.0)));
    col = mix(col, vec3(0.70, 0.77, 0.46), (1.0 - smoothstep(0.0, 0.06, abs(rel))) * 0.6);
    col *= 0.85 + 0.17 * u;
    col *= 1.0 - 0.2 * smoothstep(0.72, 1.0, abs(rel));
    float back = pow(max(dot(normalize(vView), uSun), 0.0), 2.0);
    col += vec3(0.20, 0.17, 0.04) * (0.35 + back) * (1.0 - 0.5 * abs(rel));
    float burn = smoothstep(0.84, 0.95, u + 0.05 * noise(vec2(u * 30.0, rel * 3.0 + uSeed)));
    col = mix(col, mix(vec3(0.72, 0.62, 0.38), vec3(0.50, 0.36, 0.20), smoothstep(0.93, 1.0, u)), burn);
    vec2 P = vec2(u * ${LEAF_L.toFixed(2)}, v * ${LEAF_W.toFixed(2)});
    float ring = 0.0;
    if (uPlain < 0.5) {
      for (int i = 0; i < ${SPOTS.length}; i++) {
        vec3 s = uSpots[i];
        float shw = 0.48 * pow(max(0.0, 1.0 - s.x), 0.6);
        vec2 c = vec2(s.x * ${LEAF_L.toFixed(2)}, s.y * shw * ${LEAF_W.toFixed(2)});
        vec2 d = (P - c) / vec2(s.z * 1.9, s.z);
        float r = length(d) * (1.0 + 0.08 * (noise(d * 3.0 + float(i)) - 0.5));
        col = mix(col, vec3(0.80, 0.70, 0.30), (1.0 - smoothstep(1.1, 2.0, r)) * 0.6);
        col = mix(col, vec3(0.33, 0.18, 0.09), 1.0 - smoothstep(0.86, 1.0, r));
        col = mix(col, vec3(0.55, 0.30, 0.15), 1.0 - smoothstep(0.55, 0.78, r));
        col = mix(col, vec3(0.68, 0.63, 0.55), 1.0 - smoothstep(0.16, 0.32, r));
        float seen = step(s.x, uScan - 0.02) * uResolve;
        ring = max(ring, seen * (1.0 - smoothstep(0.0, 0.1, abs(r - 2.4))));
      }
    }
    col = mix(col, vec3(0.99, 0.97, 0.91), ring * 0.95);
    float band = exp(-pow((u - uScan) / 0.025, 2.0)) * step(0.001, uScan) * step(uScan, 0.999);
    col = mix(col, vec3(1.0, 0.98, 0.92), band * 0.7);
    // Leaves further from the camera sink into the haze, a cheap stand-in for depth of field.
    vec3 dir = normalize(vView);
    col = mix(col, skyColor(dir), uFog);
    if (hash(floor(vUv * vec2(420.0, 46.0))) < uFade) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const bladeVert = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec4 aParams;
  uniform float uTime;
  uniform float uWind;
  uniform vec3 uSunV;
  varying float vY;
  varying float vRipe;
  varying vec3 vWorld;
  varying float vDiff;
  void main() {
    float y = position.y;
    float w = aParams.z * (1.0 - pow(y, 1.6));
    vec3 local = vec3(position.x * w, y * aOffset.z, 0.0);
    float c = cos(aParams.x), s = sin(aParams.x);
    local = vec3(local.x * c, local.y, local.x * s);
    vec2 g = aOffset.xy;
    float gust = sin(uTime * 0.7 + g.x * 0.23 - g.y * 0.17) * 0.55 + sin(uTime * 1.6 + g.x * 0.9 + aParams.y) * 0.22;
    float bend = (0.32 + gust * 0.38) * uWind * y * y * aOffset.z;
    local.x += bend * 0.55;
    local.z += bend * 0.22;
    local.y -= bend * bend * 0.12;
    vec3 world = vec3(g.x, 0.0, g.y) + local;
    vY = y;
    vRipe = aParams.w;
    vWorld = world;
    vDiff = abs(dot(vec3(-s, 0.0, c), uSunV));
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;
const bladeFrag = /* glsl */ `
  precision mediump float;
  uniform vec2 uFog;
  varying float vY;
  varying float vRipe;
  varying vec3 vWorld;
  varying float vDiff;
  ${SKY_GLSL}
  void main() {
    vec3 view = vWorld - cameraPosition;
    float dist = length(view);
    vec3 dir = view / dist;
    vec3 col = mix(vec3(0.10, 0.17, 0.08), vec3(0.27, 0.42, 0.17), smoothstep(0.0, 0.55, vY));
    col = mix(col, vec3(0.52, 0.60, 0.27), smoothstep(0.55, 1.0, vY));
    col = mix(col, vec3(0.78, 0.60, 0.26), smoothstep(0.72, 1.0, vY) * vRipe);
    col *= 0.78 + 0.32 * vDiff;
    float back = pow(max(dot(dir, uSun), 0.0), 3.0);
    col += vec3(0.62, 0.42, 0.13) * back * pow(vY, 1.6) * 0.75;
    col += vec3(0.10, 0.06, 0.01) * pow(vY, 3.0);
    float fog = smoothstep(uFog.x, uFog.y, dist);
    gl_FragColor = vec4(mix(col, skyColor(dir), fog), 1.0);
  }
`;
const groundFrag = /* glsl */ `
  precision mediump float;
  uniform vec2 uFog;
  varying vec3 vWorld;
  ${SKY_GLSL}
  void main() {
    vec3 view = vWorld - cameraPosition;
    float dist = length(view);
    float fog = smoothstep(uFog.x, uFog.y, dist);
    gl_FragColor = vec4(mix(vec3(0.16, 0.17, 0.08), skyColor(view / dist), fog), 1.0);
  }
`;
const skyFrag = /* glsl */ `
  precision mediump float;
  varying vec3 vDir;
  ${SKY_GLSL}
  void main() { gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }
`;

const pointVert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vPx;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vPx = aSize * uDpr;
    gl_PointSize = vPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const pointFrag = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vPx;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float edge = 1.0 / max(vPx, 1.0);
    float a = 1.0 - smoothstep(0.5 - edge * 1.5, 0.5, d);
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export interface MobileFilm {
  setProgress(p: number): void;
  setClaim(c: number, v: number): void;
  setRunning(v: boolean): void;
  resize(box: Box, canvasH: number): void;
  destroy(): void;
}

export interface FilmOptions {
  box: Box;
  canvasH: number;
  onLayout: (l: MobileLabels) => void;
  // Called once if the device cannot keep up even at the lowest setting, while still near the top.
  onWeak: () => void;
  // Called when the first frame has been drawn.
  onFirstFrame: () => void;
}

export function createMobileFilm(canvas: HTMLCanvasElement, reg: Register, opts: FilmOptions): MobileFilm {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false, stencil: false });
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const lowTier = cores <= 4 || mem <= 3;
  let dpr = Math.min(window.devicePixelRatio || 1, lowTier ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(PAPER, 1);
  renderer.autoClear = false;

  let box = opts.box;
  let W = box.W;
  let CH = opts.canvasH;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, W / CH, 0.05, 140);
  const sunU = { value: SUN };
  const fogU = { value: new THREE.Vector2(4, 44) };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(130, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: { uSun: sunU },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.ShaderMaterial({
      uniforms: { uSun: sunU, uFog: fogU },
      vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: groundFrag,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // The field: instanced blades, only inside the portrait frustum the camera ever sees.
  const SEG = 4;
  const blade = new THREE.InstancedBufferGeometry();
  const bv: number[] = [];
  const bi: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const y = i / SEG;
    bv.push(-0.5, y, 0, 0.5, y, 0);
    if (i < SEG) {
      const a = i * 2;
      bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  blade.setAttribute("position", new THREE.Float32BufferAttribute(bv, 3));
  blade.setIndex(bi);
  const MAX_BLADES = lowTier ? 11000 : 16000;
  const offsets = new Float32Array(MAX_BLADES * 3);
  const params = new Float32Array(MAX_BLADES * 4);
  const r = rng(20261128);
  let n = 0;
  while (n < MAX_BLADES) {
    const z = -56 + Math.pow(r(), 0.55) * 68;
    const half = 0.34 * (12 - z) + 1.4;
    const x = (r() - 0.5) * 2 * half;
    // A clearing around the leaf, so the close-up stays readable.
    if (Math.abs(x) < 1.3 && z > -0.5 && z <= 0.4 && r() < 0.8) continue;
    const lane = Math.abs(x) < 1.1 && z > 0.5 && z < 2.6;
    const h = lane ? 0.2 + r() * 0.4 : 0.72 + r() * 0.62 + (z < -20 ? 0.2 : 0);
    const far = Math.max(0, -z - 8) / 38;
    offsets.set([x, z, h], n * 3);
    params.set([r() * Math.PI, r() * 6.28, (0.036 + r() * 0.03) * (1 + far * 3), r() < 0.45 ? 0.55 + r() * 0.45 : 0], n * 4);
    n++;
  }
  blade.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  blade.setAttribute("aParams", new THREE.InstancedBufferAttribute(params, 4));
  blade.instanceCount = MAX_BLADES;
  const bladeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uFog: fogU, uSun: sunU, uSunV: sunU },
    vertexShader: bladeVert,
    fragmentShader: bladeFrag,
    side: THREE.DoubleSide,
  });
  const field = new THREE.Mesh(blade, bladeMat);
  field.frustumCulled = false;
  scene.add(field);

  // The leaf stands diagonally across the portrait frame, its neighbours behind it.
  const leafGeo = new THREE.PlaneGeometry(LEAF_L, LEAF_W, 90, 6);
  const leafMat = new THREE.ShaderMaterial({
    uniforms: {
      uScan: { value: 0 },
      uResolve: { value: 0 },
      uFade: { value: 0 },
      uPlain: { value: 0 },
      uSeed: { value: 0 },
      uFog: { value: 0 },
      uSun: sunU,
      uSpots: { value: SPOTS.map((s) => new THREE.Vector3(...s)) },
    },
    vertexShader: leafVert,
    fragmentShader: leafFrag,
    side: THREE.DoubleSide,
  });
  const LEAF_POS = new THREE.Vector3(0, 1.62, 0);
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.copy(LEAF_POS);
  leaf.rotation.set(-0.1, 0.12, 1.08);
  scene.add(leaf);
  const neighbours: { pos: [number, number, number]; rot: [number, number, number]; s: number; fog: number }[] = [
    { pos: [0.55, 1.5, -0.7], rot: [-0.2, 0.3, 1.35], s: 0.95, fog: 0.22 },
    { pos: [-0.6, 1.3, -0.5], rot: [0.15, -0.2, 1.85], s: 0.9, fog: 0.18 },
    { pos: [0.1, 1.9, -1.5], rot: [-0.2, -0.4, 1.2], s: 1.0, fog: 0.38 },
    { pos: [-0.9, 1.75, -1.3], rot: [-0.1, 0.5, 2.0], s: 0.85, fog: 0.36 },
  ];
  const leafMats: THREE.ShaderMaterial[] = [];
  neighbours.forEach((nb, i) => {
    const m = leafMat.clone();
    m.uniforms.uPlain.value = 1;
    m.uniforms.uSeed.value = i * 0.37 + 0.2;
    m.uniforms.uFog.value = nb.fog;
    m.uniforms.uSun = sunU;
    leafMats.push(m);
    const mesh = new THREE.Mesh(leafGeo, m);
    mesh.position.set(...nb.pos);
    mesh.rotation.set(...nb.rot);
    mesh.scale.setScalar(nb.s);
    scene.add(mesh);
  });

  // Camera: above the crop, looking into the sun so the sky holds the title; then down into the
  // crop to the leaf.
  const camStart = { pos: new THREE.Vector3(-0.85, 1.62, 12.2), look: new THREE.Vector3(-1.6, 4.6, -30) };
  const camEnd = { pos: new THREE.Vector3(0.18, 1.66, 1.95), look: new THREE.Vector3(0, 1.62, 0) };
  const look = new THREE.Vector3();

  // Overlay in CSS pixels: a paper veil and the particles, each in its own small scene.
  const ortho = new THREE.OrthographicCamera(0, W, 0, CH, -10, 10);
  const veilMat = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 1, depthTest: false, side: THREE.DoubleSide });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMat);
  const veilOnly = new THREE.Scene();
  veilOnly.add(veil);

  const U = reg.u.length;
  const CLAIMS = 4;
  const N = U + CLAIMS;
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const colAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const sizeAttr = new THREE.BufferAttribute(new Float32Array(N), 1);
  const alphaAttr = new THREE.BufferAttribute(new Float32Array(N), 1);
  [posAttr, colAttr, sizeAttr, alphaAttr].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("position", posAttr);
  geo.setAttribute("aColor", colAttr);
  geo.setAttribute("aSize", sizeAttr);
  geo.setAttribute("aAlpha", alphaAttr);
  const pointMat = new THREE.ShaderMaterial({ uniforms: { uDpr: { value: dpr } }, vertexShader: pointVert, fragmentShader: pointFrag, transparent: true, depthTest: false });
  const points = new THREE.Points(geo, pointMat);
  points.frustumCulled = false;
  const pointsOnly = new THREE.Scene();
  pointsOnly.add(points);

  const delay = new Float32Array(N);
  const pr = rng(7);
  for (let i = 0; i < N; i++) delay[i] = pr() * 0.45;
  let states: { at: number; s: Frame }[] = [];

  function layout() {
    // 1. The leaf, sampled in its final framing and coloured like the leaf at each point.
    camera.position.copy(camEnd.pos);
    camera.lookAt(camEnd.look);
    camera.updateMatrixWorld();
    leaf.updateMatrixWorld();
    const sLeaf = newFrame(N);
    const sr = rng(11);
    const v = new THREE.Vector3();
    let k = 0;
    while (k < N) {
      const u = 0.12 + sr() * 0.8;
      const vv = (sr() - 0.5) * 2;
      const hw = leafHalfWidth(u);
      if (hw <= 0.001) continue;
      const vy = vv * hw;
      leafPoint((u - 0.5) * LEAF_L, vy * LEAF_W, v).applyMatrix4(leaf.matrixWorld).project(camera);
      let c: number = vv > 0 ? C.LIGHT : C.LEAF;
      for (const sp of SPOTS) {
        const dx = ((u - sp[0]) * LEAF_L) / (sp[2] * 1.9);
        const dy = ((vy - sp[1] * leafHalfWidth(sp[0])) * LEAF_W) / sp[2];
        if (Math.hypot(dx, dy) < 1.15) c = C.SPOT;
      }
      sLeaf.x[k] = (v.x * 0.5 + 0.5) * W;
      sLeaf.y[k] = (-v.y * 0.5 + 0.5) * CH;
      sLeaf.col[k] = c;
      sLeaf.size[k] = 3.2;
      sLeaf.alpha[k] = k < U ? 1 : 0;
      k++;
    }
    const f = registerFrames(reg, box, N, CLAIMS);
    states = [
      { at: M.dissolve[1], s: sLeaf },
      { at: M.crops, s: f.sCrops },
      { at: M.paddy, s: f.sPaddy },
      { at: M.brown, s: f.sBrown },
      { at: M.rows, s: f.sRows },
      { at: M.chilli, s: f.sChilli },
      { at: M.out, s: f.sOut },
    ];
    opts.onLayout(f.labels);
  }

  function resize(b: Box, canvasH: number) {
    box = b;
    W = b.W;
    CH = canvasH;
    renderer.setSize(W, CH, false);
    camera.aspect = W / CH;
    // A wider lens in landscape keeps the leaf whole.
    camera.fov = W > CH ? 38 : 52;
    camera.updateProjectionMatrix();
    ortho.right = W;
    ortho.bottom = CH;
    ortho.updateProjectionMatrix();
    veil.scale.set(W, CH, 1);
    veil.position.set(W / 2, CH / 2, 0);
    layout();
    dirty = true;
  }

  let progress = 0;
  let shownProgress = -1;
  const claimRejected = [0, 0, 0, 0];
  let time = 0;
  let running = true;
  let raf = 0;
  let last = performance.now();
  let frames = 0;
  let slowFrames = 0;
  let level = 0;
  let intro = 0;
  let dirty = true;
  let first = true;

  const tmp = new THREE.Color();
  function applyParticles(p: number) {
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;
    const size = sizeAttr.array as Float32Array;
    const alpha = alphaAttr.array as Float32Array;
    let k = 0;
    while (k < states.length - 1 && p >= states[k + 1].at - (states[k + 1].at - states[k].at) * 0.62) k++;
    const a = states[k].s;
    const b = states[Math.min(k + 1, states.length - 1)].s;
    let f = 0;
    if (k < states.length - 1) {
      const s0 = states[k + 1].at - (states[k + 1].at - states[k].at) * 0.62;
      f = clamp((p - s0) / (states[k + 1].at - s0));
    }
    const dissolveIn = smooth(M.dissolve[0], M.dissolve[0] + 0.02, p);
    for (let i = 0; i < N; i++) {
      const t = easeInOut(clamp((f - delay[i] * 0.55) / 0.6));
      pos[i * 3] = a.x[i] + (b.x[i] - a.x[i]) * t;
      pos[i * 3 + 1] = a.y[i] + (b.y[i] - a.y[i]) * t;
      const ca = PALETTE[a.col[i]];
      const cb = PALETTE[b.col[i]];
      col[i * 3] = ca.r + (cb.r - ca.r) * t;
      col[i * 3 + 1] = ca.g + (cb.g - ca.g) * t;
      col[i * 3 + 2] = ca.b + (cb.b - ca.b) * t;
      size[i] = a.size[i] + (b.size[i] - a.size[i]) * t;
      alpha[i] = (a.alpha[i] + (b.alpha[i] - a.alpha[i]) * t) * (k === 0 ? dissolveIn : 1);
    }
    for (let c = 0; c < CLAIMS; c++) {
      const i = U + c;
      const rj = claimRejected[c];
      if (rj > 0 && p < M.out) {
        tmp.copy(PALETTE[C.TURMERIC]).lerp(PALETTE[C.BRICK], rj);
        col[i * 3] = tmp.r;
        col[i * 3 + 1] = tmp.g;
        col[i * 3 + 2] = tmp.b;
        size[i] *= 1 - rj * 0.3;
      }
    }
    const outFade = 1 - smooth(M.out, M.out + 0.025, p);
    if (outFade < 1) for (let i = 0; i < N; i++) alpha[i] *= outFade;
    posAttr.needsUpdate = colAttr.needsUpdate = sizeAttr.needsUpdate = alphaAttr.needsUpdate = true;
  }

  // Quality steps, applied when frames run long: fewer blades, then a lower pixel ratio.
  function degrade() {
    level++;
    if (level === 1) {
      blade.instanceCount = Math.floor(MAX_BLADES * 0.6);
    } else if (level === 2) {
      dpr = 1;
      renderer.setPixelRatio(dpr);
      pointMat.uniforms.uDpr.value = dpr;
      renderer.setSize(W, CH, false);
      blade.instanceCount = Math.floor(MAX_BLADES * 0.4);
    } else if (level === 3 && progress < 0.12) {
      opts.onWeak();
    }
    dirty = true;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!running) return;
    const p = progress;
    const fieldOn = p < M.dissolve[1];
    // The scene only needs redrawing while the wind moves the field, during the intro, or when
    // the progress changed; static register frames cost nothing.
    if (!fieldOn && !dirty && Math.abs(p - shownProgress) < 1e-5) return;
    shownProgress = p;
    dirty = false;
    time += dt;
    if (fieldOn) {
      frames++;
      if (frames > 30 && dt > 0.024) slowFrames++;
      if (frames % 90 === 0) {
        if (slowFrames > 45) degrade();
        slowFrames = 0;
      }
    }
    intro = Math.min(1, intro + dt / 1.1);
    const veilA = Math.max(1 - easeInOut(intro), smooth(M.dissolve[0] - 0.01, M.dissolve[1], p));
    renderer.setRenderTarget(null);
    renderer.clear();
    if (veilA < 1) {
      const d = easeInOut(smooth(M.descend[0], M.descend[1], p));
      camera.position.lerpVectors(camStart.pos, camEnd.pos, d);
      look.lerpVectors(camStart.look, camEnd.look, Math.pow(d, 0.7));
      camera.lookAt(look);
      fogU.value.set(4 - d * 2, 44 - d * 34);
      bladeMat.uniforms.uTime.value = time;
      bladeMat.uniforms.uWind.value = 1 - d * 0.55;
      const scan = smooth(M.scan[0], M.scan[1], p);
      leafMat.uniforms.uScan.value = scan > 0 && scan < 1 ? scan : scan >= 1 ? 1.1 : 0;
      leafMat.uniforms.uResolve.value = smooth(M.scan[0], M.scan[0] + 0.008, p);
      const fade = smooth(M.dissolve[0] + 0.008, M.dissolve[1], p);
      leafMat.uniforms.uFade.value = fade;
      for (const m of leafMats) m.uniforms.uFade.value = fade;
      renderer.render(scene, camera);
      dirty = true; // the wind keeps moving
    }
    veilMat.opacity = veilA;
    if (veilA > 0) renderer.render(veilOnly, ortho);
    if (p >= M.dissolve[0] && states.length) {
      applyParticles(p);
      renderer.render(pointsOnly, ortho);
    }
    if (intro < 1) dirty = true;
    if (first) {
      first = false;
      opts.onFirstFrame();
    }
  }
  resize(box, CH);
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p: number) {
      progress = p;
    },
    setClaim(c: number, v: number) {
      if (claimRejected[c] !== v) dirty = true;
      claimRejected[c] = v;
    },
    setRunning(v: boolean) {
      if (v && !running) last = performance.now();
      running = v;
      dirty = true;
    },
    resize,
    destroy() {
      cancelAnimationFrame(raf);
      renderer.dispose();
      blade.dispose();
      geo.dispose();
      leafGeo.dispose();
      renderer.forceContextLoss();
    },
  };
}
