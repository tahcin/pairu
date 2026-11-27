// The landing film's WebGL: a paddy field in late-afternoon light, one rice leaf with brown spots,
// and 2,806 particles, one per approved use in the CIB&RC register for our 13 crops.
// Everything is driven by one number, the film progress p in [0, 1], set from the scroll.
import * as THREE from "three";

export interface Register {
  total: number;
  crops: { id: string; en: string; te: string; count: number }[];
  types: string[];
  brownSpot: { te: string; en: string; uses: number; shown: number; top: { product: string; dose: string; wait: number; ipm: boolean; who: string | null }[] };
  u: [number, number, number][];
}

import { T } from "./timing";
export { T };

const PAPER = new THREE.Color("#f6f1e7");
const INK = new THREE.Color("#1d2719");
const LEAF = new THREE.Color("#3f7a3a");
const STRAW = new THREE.Color("#b9a77f");
const LEAF_LIGHT = new THREE.Color("#7fa15a");
const TURMERIC = new THREE.Color("#d08a1e");
const BRICK = new THREE.Color("#a1311f");
const MUTED = new THREE.Color("#cbbfa9");

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Seeded random, so the field and the particle layout are the same on every visit.
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

// Rice leaf: long and narrow, tapering to a point. Physical size in scene units.
const LEAF_L = 3.3;
const LEAF_W = 0.36;
const leafHalfWidth = (u: number) => 0.48 * Math.pow(Math.max(0, 1 - u), 0.6) * smooth(0, 0.05, u);
// Brown spot: oval spots with a dark margin, a grey centre and a yellow halo. (u along, v across, r)
const SPOTS: [number, number, number][] = [
  [0.18, 0.1, 0.022], [0.24, -0.35, 0.017], [0.31, 0.3, 0.026], [0.37, -0.05, 0.02], [0.44, 0.42, 0.015],
  [0.47, -0.4, 0.024], [0.53, 0.12, 0.028], [0.6, -0.22, 0.018], [0.64, 0.38, 0.016], [0.7, -0.02, 0.022],
  [0.76, 0.28, 0.014], [0.81, -0.3, 0.015], [0.27, 0.48, 0.012], [0.57, 0.45, 0.012],
];

const bladeVert = /* glsl */ `
  attribute vec3 aOffset;   // x, z, height
  attribute vec4 aParams;   // rotation, phase, width, ripeness
  uniform float uTime;
  uniform float uWind;
  uniform vec2 uFog;
  varying float vY;
  varying float vRipe;
  varying float vFog;
  varying float vSide;
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
    vSide = position.x;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    vFog = smoothstep(uFog.x, uFog.y, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const bladeFrag = /* glsl */ `
  uniform vec3 uPaper;
  varying float vY;
  varying float vRipe;
  varying float vFog;
  varying float vSide;
  void main() {
    vec3 root = vec3(0.13, 0.22, 0.11);
    vec3 mid = vec3(0.30, 0.45, 0.19);
    vec3 tip = vec3(0.56, 0.62, 0.29);
    vec3 col = mix(root, mid, smoothstep(0.0, 0.55, vY));
    col = mix(col, tip, smoothstep(0.55, 1.0, vY));
    // Ripening grain on some stems, and the low sun catching the upper blade.
    col = mix(col, vec3(0.80, 0.62, 0.27), smoothstep(0.72, 1.0, vY) * vRipe);
    col += vec3(0.16, 0.10, 0.02) * pow(vY, 2.5);
    col *= 0.9 + 0.12 * vSide;
    gl_FragColor = vec4(mix(col, uPaper, vFog), 1.0);
  }
`;

const leafVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float x = p.x / ${LEAF_L.toFixed(2)};
    p.z += -0.32 * x * x + 0.05 * sin(x * 6.0);
    p.y += 0.06 * sin(x * 3.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const leafFrag = /* glsl */ `
  uniform float uScan;
  uniform float uResolve;
  uniform float uFade;
  uniform vec3 uSpots[${SPOTS.length}];
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float u = vUv.x;
    float v = vUv.y - 0.5;
    float hw = 0.48 * pow(max(0.0, 1.0 - u), 0.6) * smoothstep(0.0, 0.05, u);
    hw *= 1.0 + 0.018 * sin(u * 190.0) * sin(u * 23.0);
    if (abs(v) > hw) discard;
    float rel = v / max(hw, 0.0001);
    // Parallel veins and a pale midrib, as on a rice leaf.
    vec3 col = mix(vec3(0.27, 0.45, 0.18), vec3(0.42, 0.60, 0.25), 0.5 + 0.5 * rel);
    col *= 0.94 + 0.06 * smoothstep(0.75, 1.0, abs(sin(rel * 3.14159 * 7.0)));
    col = mix(col, vec3(0.72, 0.78, 0.48), (1.0 - smoothstep(0.0, 0.07, abs(rel))) * 0.6);
    col *= 0.86 + 0.18 * u;
    col = mix(col, vec3(0.62, 0.66, 0.30), smoothstep(0.82, 1.0, u) * 0.55);          // drier tip
    col *= 1.0 - 0.22 * smoothstep(0.7, 1.0, abs(rel));                               // edges turn away from the light
    col += vec3(0.10, 0.08, 0.03) * exp(-pow((rel + 0.25) / 0.22, 2.0)) * 0.8;          // sheen beside the midrib
    vec2 P = vec2(u * ${LEAF_L.toFixed(2)}, v * ${LEAF_W.toFixed(2)});
    float ring = 0.0;
    for (int i = 0; i < ${SPOTS.length}; i++) {
      vec3 s = uSpots[i];
      float shw = 0.48 * pow(max(0.0, 1.0 - s.x), 0.6);
      vec2 c = vec2(s.x * ${LEAF_L.toFixed(2)}, s.y * shw * ${LEAF_W.toFixed(2)});
      vec2 d = (P - c) / vec2(s.z * 1.9, s.z);
      float r = length(d);
      col = mix(col, vec3(0.74, 0.66, 0.30), (1.0 - smoothstep(1.1, 1.9, r)) * 0.55);  // yellow halo
      col = mix(col, vec3(0.36, 0.20, 0.10), 1.0 - smoothstep(0.85, 1.0, r));          // dark margin
      col = mix(col, vec3(0.52, 0.32, 0.16), 1.0 - smoothstep(0.55, 0.75, r));         // brown body
      col = mix(col, vec3(0.70, 0.64, 0.54), 1.0 - smoothstep(0.18, 0.32, r));         // grey centre
      float seen = step(s.x, uScan - 0.02) * uResolve;
      ring = max(ring, seen * (1.0 - smoothstep(0.0, 0.09, abs(r - 2.35))));
    }
    col = mix(col, vec3(0.98, 0.96, 0.90), ring * 0.95);
    float band = exp(-pow((u - uScan) / 0.025, 2.0)) * step(0.001, uScan) * step(uScan, 0.999);
    col = mix(col, vec3(1.0, 0.98, 0.92), band * 0.75);
    if (hash(floor(vUv * vec2(420.0, 46.0))) < uFade) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const pointVert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_PointSize = aSize * uDpr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const pointFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = 1.0 - smoothstep(0.42, 0.5, d);
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

interface State {
  pos: Float32Array; // x, y in CSS px from the top left
  col: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
}

export interface Labels {
  crops: { x: number; y: number; w: number; crop: Register["crops"][number] }[];
  rows: { x: number; y: number }[];
  rest: { x: number; y: number };
  paddy: { x: number; y: number; w: number };
  brown: { x: number; y: number; w: number };
  chilli: { x: number; y: number; w: number };
  claims: { x: number; y: number }[];
}

export function createFilm(canvas: HTMLCanvasElement, reg: Register, onLayout: (l: Labels) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(PAPER, 1);
  renderer.autoClear = false;

  let W = window.innerWidth;
  let H = window.innerHeight;

  // Field
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 140);
  const fogUniform = { value: new THREE.Vector2(5, 40) };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShaderMaterial({
      uniforms: { uPaper: { value: PAPER }, uFog: fogUniform },
      vertexShader: `varying float vDepth; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
      // Fog per pixel: the plane's corners are far away, so per-vertex fog would wash it all to paper.
      fragmentShader: `varying float vDepth; uniform vec3 uPaper; uniform vec2 uFog; void main(){ gl_FragColor = vec4(mix(vec3(0.19,0.21,0.10), uPaper, smoothstep(uFog.x, uFog.y, vDepth)), 1.0); }`,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const SEG = 5;
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
  const MAX_BLADES = 42000;
  const offsets = new Float32Array(MAX_BLADES * 3);
  const params = new Float32Array(MAX_BLADES * 4);
  const r = rng(20261128);
  let n = 0;
  while (n < MAX_BLADES) {
    // Denser near the camera path, sparser far away; a clearing between camera and leaf.
    const z = -46 + Math.pow(r(), 0.62) * 52;
    const x = (r() - 0.5) * (30 + (6 - z) * 1.1);
    // Between the camera's last position and the leaf, the crop is low (seedlings), so the view is clear.
    const lane = Math.abs(x) < 2.4 && z > 0.3 && z < 5.8;
    const nearLeaf = Math.abs(x) < 1.9 && z > -0.45 && z <= 0.3;
    if (nearLeaf && r() < 0.7) continue;
    const h = lane ? 0.18 + r() * 0.3 : 0.75 + r() * 0.65 + (z < -20 ? 0.2 : 0);
    // Far blades are drawn wider so they do not shimmer at a pixel or less.
    const far = Math.max(0, -z - 8) / 38;
    offsets.set([x, z, h], n * 3);
    params.set([r() * Math.PI, r() * 6.28, (0.035 + r() * 0.03) * (1 + far * 3), r() < 0.42 ? 0.55 + r() * 0.45 : 0], n * 4);
    n++;
  }
  blade.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  blade.setAttribute("aParams", new THREE.InstancedBufferAttribute(params, 4));
  blade.instanceCount = MAX_BLADES;
  const bladeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uFog: fogUniform, uPaper: { value: PAPER } },
    vertexShader: bladeVert,
    fragmentShader: bladeFrag,
    side: THREE.DoubleSide,
  });
  const field = new THREE.Mesh(blade, bladeMat);
  field.frustumCulled = false;
  scene.add(field);

  // The leaf
  const leafMat = new THREE.ShaderMaterial({
    uniforms: {
      uScan: { value: 0 },
      uResolve: { value: 0 },
      uFade: { value: 0 },
      uSpots: { value: SPOTS.map((s) => new THREE.Vector3(...s)) },
    },
    vertexShader: leafVert,
    fragmentShader: leafFrag,
    side: THREE.DoubleSide,
  });
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_L, LEAF_W, 96, 6), leafMat);
  leaf.position.set(0, 1.05, 0);
  leaf.rotation.set(-0.12, 0.05, 0.05);
  scene.add(leaf);
  // The leaf grows from a stem, so it is part of a plant, not floating above the field.
  const stemMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#3d6a2c") });
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.62, 1.02, 0.02), new THREE.Vector3(-1.7, 0.6, 0.06), new THREE.Vector3(-1.78, 0.0, 0.1)]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 16, 0.022, 6, false), stemMat);
  stem.position.copy(leaf.position).sub(new THREE.Vector3(0, 1.05, 0));
  scene.add(stem);

  // Camera path: from above the field to a close look at the leaf.
  const camStart = { pos: new THREE.Vector3(0, 5.4, 17), look: new THREE.Vector3(0, 2.6, -18) };
  const camEnd = { pos: new THREE.Vector3(0, 1.22, 3.45), look: new THREE.Vector3(0, 1.24, 0) };
  const look = new THREE.Vector3();

  // Overlay: a paper veil and the particles, in CSS pixels.
  const overlay = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
  const veilMat = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMat);
  overlay.add(veil);

  const N = reg.u.length + 4; // 2,806 approved uses, then 4 claims from a general AI
  const CLAIMS = 4;
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const colAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const sizeAttr = new THREE.BufferAttribute(new Float32Array(N), 1);
  const alphaAttr = new THREE.BufferAttribute(new Float32Array(N), 1);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("aColor", colAttr);
  geo.setAttribute("aSize", sizeAttr);
  geo.setAttribute("aAlpha", alphaAttr);
  const pointMat = new THREE.ShaderMaterial({
    uniforms: { uDpr: { value: dpr } },
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    transparent: true,
    depthTest: false,
  });
  const points = new THREE.Points(geo, pointMat);
  points.frustumCulled = false;
  overlay.add(points);

  const delay = new Float32Array(N);
  const pr = rng(7);
  for (let i = 0; i < N; i++) delay[i] = pr() * 0.45;

  const typeColor = (t: number) => (t === 1 ? STRAW : t >= 2 ? TURMERIC : LEAF);
  let states: { at: number; s: State }[] = [];
  let leafSamples: { x: number; y: number; c: THREE.Color }[] = [];

  function newState(): State {
    return { pos: new Float32Array(N * 2), col: new Float32Array(N * 3), size: new Float32Array(N), alpha: new Float32Array(N) };
  }

  // Sample points on the leaf in its final framing, coloured like the leaf at that spot.
  function sampleLeaf() {
    camera.position.copy(camEnd.pos);
    camera.lookAt(camEnd.look);
    camera.updateMatrixWorld();
    leaf.updateMatrixWorld();
    const s = rng(11);
    const out: { x: number; y: number; c: THREE.Color }[] = [];
    const v = new THREE.Vector3();
    while (out.length < N) {
      const u = s();
      const vv = (s() - 0.5) * 2;
      const hw = leafHalfWidth(u);
      if (Math.abs(vv) > 1 || hw <= 0.001) continue;
      const vy = vv * hw;
      const x = (u - 0.5) * LEAF_L;
      const xn = x / LEAF_L;
      v.set(x, vy * LEAF_W + 0.06 * Math.sin(xn * 3), -0.32 * xn * xn + 0.05 * Math.sin(xn * 6));
      v.applyMatrix4(leaf.matrixWorld).project(camera);
      let c = LEAF_LIGHT.clone().lerp(LEAF, 0.5 + 0.5 * vv);
      for (const sp of SPOTS) {
        const shw = leafHalfWidth(sp[0]);
        const dx = ((u - sp[0]) * LEAF_L) / (sp[2] * 1.9);
        const dy = ((vy - sp[1] * shw) * LEAF_W) / sp[2];
        if (Math.hypot(dx, dy) < 1.15) c = new THREE.Color("#6b3d1c");
      }
      out.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, c });
    }
    leafSamples = out;
  }

  function layout() {
    sampleLeaf();
    const U = reg.u;
    const nc = reg.crops.length;
    // 1. The leaf
    const sLeaf = newState();
    for (let i = 0; i < N; i++) {
      const p = leafSamples[i];
      sLeaf.pos[i * 2] = p.x;
      sLeaf.pos[i * 2 + 1] = p.y;
      sLeaf.col.set([p.c.r, p.c.g, p.c.b], i * 3);
      sLeaf.size[i] = 3.2;
      sLeaf.alpha[i] = i < U.length ? 1 : 0;
    }
    // 2. All approved uses, one waffle column per crop, rising from a baseline.
    const sCrops = newState();
    const left = W * 0.1;
    const span = W * 0.8;
    const colW = span / nc;
    const base = H * 0.7;
    // The largest pitch at which paddy's column still fits between the caption and the baseline.
    const maxCount = Math.max(...reg.crops.map((c) => c.count));
    const room = base - H * 0.26;
    let pitch = 7.2;
    while (pitch > 3.4 && Math.ceil(maxCount / Math.floor((colW - 12) / pitch)) * pitch > room) pitch -= 0.2;
    const perRow = Math.floor((colW - 12) / pitch);
    const byCrop: number[][] = reg.crops.map(() => []);
    U.forEach((u, i) => byCrop[u[0]].push(i));
    // Within a crop, brown spot uses last so they sit on top, then by type.
    byCrop.forEach((list) => list.sort((a, b) => (U[a][2] > 0 ? 1 : 0) - (U[b][2] > 0 ? 1 : 0) || U[a][1] - U[b][1]));
    const cropLabels: Labels["crops"] = [];
    byCrop.forEach((list, c) => {
      const x0 = left + c * colW + (colW - perRow * pitch) / 2;
      list.forEach((i, k) => {
        sCrops.pos[i * 2] = x0 + (k % perRow) * pitch + pitch / 2;
        sCrops.pos[i * 2 + 1] = base - Math.floor(k / perRow) * pitch;
        const tc = typeColor(U[i][1]);
        sCrops.col.set([tc.r, tc.g, tc.b], i * 3);
        sCrops.size[i] = pitch * 0.64;
        sCrops.alpha[i] = 1;
      });
      cropLabels.push({ x: left + c * colW, y: base + 18, w: colW, crop: reg.crops[c] });
    });
    // 3. Paddy, large and centred; the rest stay behind, faint.
    const sPaddy = newState();
    sPaddy.pos.set(sCrops.pos);
    sPaddy.col.set(sCrops.col);
    const pp = 11;
    const pRow = 46;
    const paddy = byCrop[0];
    const pRows = Math.ceil(paddy.length / pRow);
    const px0 = W / 2 - (pRow * pp) / 2;
    const py0 = H * 0.5 + (pRows * pp) / 2 - pRows * pp * 0.5 + 40;
    for (let i = 0; i < N; i++) {
      sPaddy.size[i] = sCrops.size[i];
      sPaddy.alpha[i] = i < U.length ? 0.1 : 0;
    }
    paddy.forEach((i, k) => {
      sPaddy.pos[i * 2] = px0 + (k % pRow) * pp + pp / 2;
      sPaddy.pos[i * 2 + 1] = py0 + (Math.floor(k / pRow) - pRows / 2) * pp;
      sPaddy.size[i] = 7.4;
      sPaddy.alpha[i] = 1;
      if (U[i][2] > 0) sPaddy.col.set([TURMERIC.r, TURMERIC.g, TURMERIC.b], i * 3);
    });
    // 4. Brown spot on paddy: 31 uses in one line; everything else almost gone.
    const sBrown = newState();
    sBrown.pos.set(sPaddy.pos);
    sBrown.col.set(sPaddy.col);
    const brown = U.map((u, i) => (u[2] > 0 ? i : -1)).filter((i) => i >= 0);
    const bp = Math.min(30, (W * 0.7) / brown.length);
    const bx0 = W / 2 - (brown.length * bp) / 2;
    const by = H * 0.56;
    for (let i = 0; i < N; i++) {
      sBrown.size[i] = sPaddy.size[i];
      sBrown.alpha[i] = i < U.length ? 0.04 : 0;
    }
    brown.forEach((i, k) => {
      sBrown.pos[i * 2] = bx0 + k * bp + bp / 2;
      sBrown.pos[i * 2 + 1] = by;
      sBrown.size[i] = 13;
      sBrown.alpha[i] = 1;
      sBrown.col.set([TURMERIC.r, TURMERIC.g, TURMERIC.b], i * 3);
    });
    // 5. The card: three rows, each led by its particle; the other 28 rest in a short line beneath.
    const sRows = newState();
    sRows.pos.set(sBrown.pos);
    sRows.col.set(sBrown.col);
    const rowX = W * 0.5 - Math.min(560, W * 0.36);
    const rowY0 = H * 0.46;
    const rowGap = 74;
    const rows: Labels["rows"] = [0, 1, 2].map((k) => ({ x: rowX, y: rowY0 + k * rowGap }));
    const restY = rowY0 + 3 * rowGap + 18;
    let rk = 0;
    for (let i = 0; i < N; i++) {
      sRows.size[i] = sBrown.size[i];
      sRows.alpha[i] = i < U.length ? 0 : 0;
    }
    brown.forEach((i) => {
      const f = U[i][2];
      if (f >= 3) {
        sRows.pos[i * 2] = rows[f - 3].x;
        sRows.pos[i * 2 + 1] = rows[f - 3].y;
        sRows.size[i] = 16;
        sRows.alpha[i] = 1;
        sRows.col.set([LEAF.r, LEAF.g, LEAF.b], i * 3);
      } else {
        sRows.pos[i * 2] = rowX + 4 + rk * 9;
        sRows.pos[i * 2 + 1] = restY;
        sRows.size[i] = 6;
        sRows.alpha[i] = 0.7;
        sRows.col.set([MUTED.r, MUTED.g, MUTED.b], i * 3);
        rk++;
      }
    });
    // 6. Chilli: its 475 approved uses as a quiet block on the left; four claims arrive on the right.
    const sChilli = newState();
    const chilli = byCrop[reg.crops.findIndex((c) => c.id === "chilli")];
    const cRow = 25;
    const cp = 9;
    const cx0 = W * 0.1;
    const cy0 = H * 0.36;
    for (let i = 0; i < N; i++) {
      sChilli.pos[i * 2] = sRows.pos[i * 2];
      sChilli.pos[i * 2 + 1] = sRows.pos[i * 2 + 1];
      sChilli.col.set([MUTED.r, MUTED.g, MUTED.b], i * 3);
      sChilli.size[i] = 5;
      sChilli.alpha[i] = 0;
    }
    chilli.forEach((i, k) => {
      sChilli.pos[i * 2] = cx0 + (k % cRow) * cp;
      sChilli.pos[i * 2 + 1] = cy0 + Math.floor(k / cRow) * cp;
      sChilli.col.set([LEAF.r, LEAF.g, LEAF.b], i * 3);
      sChilli.size[i] = 5.2;
      sChilli.alpha[i] = 1;
    });
    const claims: Labels["claims"] = [];
    for (let c = 0; c < CLAIMS; c++) {
      const i = U.length + c;
      const y = H * 0.34 + c * 96;
      claims.push({ x: W * 0.5, y });
      sChilli.pos[i * 2] = W * 0.5;
      sChilli.pos[i * 2 + 1] = y;
      sChilli.col.set([TURMERIC.r, TURMERIC.g, TURMERIC.b], i * 3);
      sChilli.size[i] = 16;
      sChilli.alpha[i] = 1;
    }
    // 7. Out: everything goes quiet.
    const sOut = newState();
    sOut.pos.set(sChilli.pos);
    sOut.col.set(sChilli.col);
    sOut.size.set(sChilli.size);
    sOut.alpha.set(sChilli.alpha);
    for (let c = 0; c < CLAIMS; c++) {
      const i = U.length + c;
      sOut.col.set([BRICK.r, BRICK.g, BRICK.b], i * 3);
    }

    // Claims start off screen to the right, so they fly in.
    for (let c = 0; c < CLAIMS; c++) {
      const i = U.length + c;
      sRows.pos[i * 2] = W + 40;
      sRows.pos[i * 2 + 1] = H * 0.34 + c * 96;
      sRows.col.set([TURMERIC.r, TURMERIC.g, TURMERIC.b], i * 3);
      sRows.size[i] = 16;
    }

    states = [
      { at: T.dissolve[1], s: sLeaf },
      { at: T.crops, s: sCrops },
      { at: T.paddy, s: sPaddy },
      { at: T.brown, s: sBrown },
      { at: T.rows, s: sRows },
      { at: T.chilli, s: sChilli },
      { at: T.out, s: sOut },
    ];
    onLayout({
      crops: cropLabels,
      rows,
      rest: { x: rowX, y: restY },
      paddy: { x: px0, y: py0 - (pRows / 2) * pp - 64, w: pRow * pp },
      brown: { x: bx0, y: by, w: brown.length * bp },
      chilli: { x: cx0, y: cy0, w: cRow * cp },
      claims,
    });
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    ortho.right = W;
    ortho.bottom = H;
    ortho.updateProjectionMatrix();
    veil.scale.set(W, H, 1);
    veil.position.set(W / 2, H / 2, 0);
    layout();
  }

  let progress = 0;
  let claimRejected = [0, 0, 0, 0];
  let time = 0;
  let running = true;
  let raf = 0;
  let last = performance.now();
  let frames = 0;
  let slow = 0;

  function applyParticles(p: number) {
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;
    const size = sizeAttr.array as Float32Array;
    const alpha = alphaAttr.array as Float32Array;
    if (p < T.dissolve[0] || !states.length) {
      alpha.fill(0);
      alphaAttr.needsUpdate = true;
      return;
    }
    // Find the segment and how far into it we are; each move takes the last 60% of the gap before its state.
    let k = 0;
    while (k < states.length - 1 && p >= states[k + 1].at - (states[k + 1].at - states[k].at) * 0.6) k++;
    const a = states[k].s;
    const b = states[Math.min(k + 1, states.length - 1)].s;
    let f = 0;
    if (k < states.length - 1) {
      const s0 = states[k + 1].at - (states[k + 1].at - states[k].at) * 0.6;
      const s1 = states[k + 1].at;
      f = clamp((p - s0) / (s1 - s0));
    }
    // During the dissolve, the leaf's own particles fade in on top of the leaf.
    const dissolveIn = smooth(T.dissolve[0], T.dissolve[0] + 0.03, p);
    for (let i = 0; i < N; i++) {
      const t = easeInOut(clamp((f - delay[i] * 0.6) / 0.6));
      pos[i * 3] = a.pos[i * 2] + (b.pos[i * 2] - a.pos[i * 2]) * t;
      pos[i * 3 + 1] = a.pos[i * 2 + 1] + (b.pos[i * 2 + 1] - a.pos[i * 2 + 1]) * t;
      for (let c = 0; c < 3; c++) col[i * 3 + c] = a.col[i * 3 + c] + (b.col[i * 3 + c] - a.col[i * 3 + c]) * t;
      size[i] = a.size[i] + (b.size[i] - a.size[i]) * t;
      alpha[i] = (a.alpha[i] + (b.alpha[i] - a.alpha[i]) * t) * (k === 0 ? dissolveIn : 1);
    }
    // Claims from a general AI: each turns brick and drops as it is rejected.
    const U = reg.u.length;
    for (let c = 0; c < 4; c++) {
      const i = U + c;
      const rj = claimRejected[c];
      if (rj > 0 && p < T.out) {
        col[i * 3] = TURMERIC.r + (BRICK.r - TURMERIC.r) * rj;
        col[i * 3 + 1] = TURMERIC.g + (BRICK.g - TURMERIC.g) * rj;
        col[i * 3 + 2] = TURMERIC.b + (BRICK.b - TURMERIC.b) * rj;
        alpha[i] = 1 - rj * 0.5;
        size[i] *= 1 - rj * 0.45;
      }
    }
    const outFade = 1 - smooth(T.out, T.out + 0.03, p);
    if (outFade < 1) for (let i = 0; i < N; i++) alpha[i] *= outFade;
    posAttr.needsUpdate = colAttr.needsUpdate = sizeAttr.needsUpdate = alphaAttr.needsUpdate = true;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!running) return;
    time += dt;
    // Adapt once after the first second: fewer blades and a lower pixel ratio on a slow machine.
    frames++;
    if (frames > 20 && frames < 100 && dt > 0.022) slow++;
    if (frames === 100 && slow > 40) {
      blade.instanceCount = Math.floor(MAX_BLADES * 0.55);
      dpr = 1;
      renderer.setPixelRatio(dpr);
      pointMat.uniforms.uDpr.value = dpr;
      resize();
    }
    const p = progress;
    const veilA = smooth(T.dissolve[0] - 0.01, T.dissolve[1], p);
    renderer.clear();
    if (veilA < 1) {
      const d = easeInOut(smooth(T.descend[0], T.descend[1], p));
      camera.position.lerpVectors(camStart.pos, camEnd.pos, d);
      look.lerpVectors(camStart.look, camEnd.look, Math.pow(d, 0.8));
      camera.lookAt(look);
      fogUniform.value.set(5 - d * 2, 40 - d * 24);
      bladeMat.uniforms.uTime.value = time;
      bladeMat.uniforms.uWind.value = 1 - d * 0.55;
      const scan = smooth(T.scan[0], T.scan[1], p);
      leafMat.uniforms.uScan.value = scan > 0 && scan < 1 ? scan : scan >= 1 ? 1.1 : 0;
      leafMat.uniforms.uResolve.value = smooth(T.scan[0], T.scan[0] + 0.01, p);
      leafMat.uniforms.uFade.value = smooth(T.dissolve[0] + 0.01, T.dissolve[1], p);
      renderer.render(scene, camera);
    }
    veilMat.opacity = veilA;
    applyParticles(p);
    if (veilA > 0 || p >= T.dissolve[0]) renderer.render(overlay, ortho);
  }

  resize();
  raf = requestAnimationFrame(frame);
  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  return {
    setProgress(p: number) {
      progress = p;
    },
    setClaim(c: number, v: number) {
      claimRejected[c] = v;
    },
    setRunning(v: boolean) {
      running = v;
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      blade.dispose();
      geo.dispose();
    },
  };
}
