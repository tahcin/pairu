// The landing film's WebGL: a paddy field in late-afternoon light, one rice leaf with brown spot
// among its neighbours, and 2,806 particles, one per approved use in the CIB&RC register for our
// 13 crops. Everything is driven by one number, the film progress p in [0, 1], set from the scroll.
import * as THREE from "three";
import { T } from "./timing";
export { T };

export interface Register {
  total: number;
  crops: { id: string; en: string; te: string; count: number }[];
  types: string[];
  brownSpot: { te: string; en: string; uses: number; shown: number; top: { product: string; dose: string; wait: number; ipm: boolean; who: string | null }[] };
  u: [number, number, number][];
}

const LEAF = new THREE.Color("#3f7a3a");
const STRAW = new THREE.Color("#b9a77f");
const LEAF_LIGHT = new THREE.Color("#7fa15a");
const TURMERIC = new THREE.Color("#d08a1e");
const BRICK = new THREE.Color("#a1311f");
const MUTED = new THREE.Color("#cbbfa9");
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
const SUN = new THREE.Vector3(-0.42, 0.2, -0.88).normalize();

// Sky and fog share one function, so the far field melts into the sky with no horizon line.
const SKY_GLSL = /* glsl */ `
  uniform vec3 uSun;
  vec3 skyColor(vec3 dir) {
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 haze = vec3(0.93, 0.87, 0.74);
    vec3 high = vec3(0.95, 0.93, 0.88);
    vec3 c = mix(haze, high, smoothstep(0.0, 0.32, h));
    float s = max(dot(normalize(dir), uSun), 0.0);
    c = mix(c, vec3(0.97, 0.84, 0.60), pow(s, 5.0) * 0.55 * (1.0 - smoothstep(0.0, 0.5, h)));
    return c;
  }
`;

// Rice leaf: long and narrow, tapering to a point, twisting slightly along its length.
const LEAF_L = 3.3;
const LEAF_W = 0.36;
const leafHalfWidth = (u: number) => 0.48 * Math.pow(Math.max(0, 1 - u), 0.6) * smooth(0, 0.06, u);
// Brown spot lesions: oval, a dark brown margin, a reddish brown body, a grey centre, a yellow halo.
const SPOTS: [number, number, number][] = [
  [0.16, 0.1, 0.022], [0.23, -0.38, 0.017], [0.3, 0.3, 0.026], [0.36, -0.06, 0.021], [0.43, 0.44, 0.015],
  [0.47, -0.4, 0.024], [0.53, 0.12, 0.029], [0.6, -0.24, 0.018], [0.64, 0.4, 0.016], [0.7, -0.02, 0.022],
  [0.75, 0.3, 0.014], [0.8, -0.32, 0.015], [0.26, 0.5, 0.011], [0.57, 0.48, 0.012],
];

// The same leaf shape in JS and GLSL: arch, twist and a raised midrib.
function leafPoint(x: number, y: number, out: THREE.Vector3) {
  const xn = x / LEAF_L;
  const ridge = 0.014 * (1 - Math.min(1, Math.abs(y) / (LEAF_W / 2)));
  const a = 0.42 * xn + 0.1;
  const y2 = y * Math.cos(a) - ridge * Math.sin(a);
  const z2 = y * Math.sin(a) + ridge * Math.cos(a);
  return out.set(x, y2 + 0.07 * Math.sin(xn * 3), z2 - 0.34 * xn * xn + 0.05 * Math.sin(xn * 6));
}
const leafVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec3 p = position;
    float xn = p.x / ${LEAF_L.toFixed(2)};
    float ridge = 0.014 * (1.0 - min(1.0, abs(p.y) / ${(LEAF_W / 2).toFixed(3)}));
    float a = 0.42 * xn + 0.1;
    float y2 = p.y * cos(a) - ridge * sin(a);
    float z2 = p.y * sin(a) + ridge * cos(a);
    vec3 q = vec3(p.x, y2 + 0.07 * sin(xn * 3.0), z2 - 0.34 * xn * xn + 0.05 * sin(xn * 6.0));
    vec4 w = modelMatrix * vec4(q, 1.0);
    vView = w.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const leafFrag = /* glsl */ `
  uniform float uScan;
  uniform float uResolve;
  uniform float uFade;
  uniform float uPlain;
  uniform float uSeed;
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
    hw *= 1.0 - 0.035 * fract(u * 240.0 + uSeed);   // fine serration along the edge
    if (abs(v) > hw) discard;
    float rel = v / max(hw, 0.0001);
    // Parallel veins, a pale midrib, edges turning away from the light.
    vec3 col = mix(vec3(0.25, 0.43, 0.16), vec3(0.40, 0.58, 0.23), 0.5 + 0.5 * rel);
    col *= 0.93 + 0.07 * smoothstep(0.7, 1.0, abs(sin(rel * 3.14159 * 8.0)));
    col = mix(col, vec3(0.70, 0.77, 0.46), (1.0 - smoothstep(0.0, 0.06, abs(rel))) * 0.6);
    col *= 0.85 + 0.17 * u;
    col *= 1.0 - 0.2 * smoothstep(0.72, 1.0, abs(rel));
    // Backlight: the low sun shines through the blade, warming it and lifting the veins.
    float back = pow(max(dot(normalize(vView), uSun), 0.0), 2.0);
    col += vec3(0.20, 0.17, 0.04) * (0.35 + back) * (1.0 - 0.5 * abs(rel));
    // Tip burn from water stress: straw to brown, with a ragged edge.
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
        col = mix(col, vec3(0.80, 0.70, 0.30), (1.0 - smoothstep(1.1, 2.0, r)) * 0.6);   // yellow halo
        col = mix(col, vec3(0.33, 0.18, 0.09), 1.0 - smoothstep(0.86, 1.0, r));         // dark margin
        col = mix(col, vec3(0.55, 0.30, 0.15), 1.0 - smoothstep(0.55, 0.78, r));         // reddish brown body
        col = mix(col, vec3(0.68, 0.63, 0.55), 1.0 - smoothstep(0.16, 0.32, r));         // grey centre
        float seen = step(s.x, uScan - 0.02) * uResolve;
        ring = max(ring, seen * (1.0 - smoothstep(0.0, 0.08, abs(r - 2.4))));
      }
    }
    col = mix(col, vec3(0.99, 0.97, 0.91), ring * 0.95);
    float band = exp(-pow((u - uScan) / 0.025, 2.0)) * step(0.001, uScan) * step(uScan, 0.999);
    col = mix(col, vec3(1.0, 0.98, 0.92), band * 0.7);
    if (hash(floor(vUv * vec2(420.0, 46.0))) < uFade) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const bladeVert = /* glsl */ `
  attribute vec3 aOffset;   // x, z, height
  attribute vec4 aParams;   // rotation, phase, width, ripeness
  uniform float uTime;
  uniform float uWind;
  varying float vY;
  varying float vRipe;
  varying vec3 vWorld;
  varying vec3 vNormal2;
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
    vNormal2 = vec3(-s, 0.0, c);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;
const bladeFrag = /* glsl */ `
  uniform vec2 uFog;
  varying float vY;
  varying float vRipe;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  ${SKY_GLSL}
  void main() {
    vec3 view = vWorld - cameraPosition;
    float dist = length(view);
    vec3 dir = view / dist;
    vec3 root = vec3(0.10, 0.17, 0.08);
    vec3 mid = vec3(0.27, 0.42, 0.17);
    vec3 tip = vec3(0.52, 0.60, 0.27);
    vec3 col = mix(root, mid, smoothstep(0.0, 0.55, vY));
    col = mix(col, tip, smoothstep(0.55, 1.0, vY));
    col = mix(col, vec3(0.78, 0.60, 0.26), smoothstep(0.72, 1.0, vY) * vRipe);
    // Low sun: a little diffuse light, and warm light through the upper blade when backlit.
    float diff = abs(dot(vNormal2, uSun));
    col *= 0.78 + 0.32 * diff;
    float back = pow(max(dot(dir, uSun), 0.0), 3.0);
    col += vec3(0.62, 0.42, 0.13) * back * pow(vY, 1.6) * 0.75;
    col += vec3(0.10, 0.06, 0.01) * pow(vY, 3.0);
    float fog = smoothstep(uFog.x, uFog.y, dist);
    gl_FragColor = vec4(mix(col, skyColor(dir), fog), 1.0);
  }
`;
const groundFrag = /* glsl */ `
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
  varying vec3 vDir;
  ${SKY_GLSL}
  void main() { gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }
`;

// A light depth of field for the close-up: 16 taps on a disc, radius from the distance to the focus.
const dofFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uFocus;
  uniform float uRange;
  uniform float uMax;
  uniform float uNear;
  uniform float uFar;
  varying vec2 vUv;
  float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  float coc(vec2 uv) { return clamp(abs(lin(texture2D(tDepth, uv).r) - uFocus) / uRange, 0.0, 1.0) * uMax; }
  void main() {
    float r = coc(vUv);
    vec3 sum = texture2D(tColor, vUv).rgb;
    float wsum = 1.0;
    if (r > 0.5) {
      for (int i = 0; i < 16; i++) {
        float a = float(i) * 2.39996;
        float rr = sqrt((float(i) + 0.5) / 16.0);
        vec2 o = vec2(cos(a), sin(a)) * rr * r * uTexel;
        float rs = coc(vUv + o);
        float w = smoothstep(0.0, 1.0, rs / max(r, 0.001) + 0.2);
        sum += texture2D(tColor, vUv + o).rgb * w;
        wsum += w;
      }
    }
    gl_FragColor = vec4(sum / wsum, 1.0);
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
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
}

export interface Labels {
  crops: { x: number; y: number; w: number; crop: Register["crops"][number] }[];
  rows: { x: number; y: number }[];
  rest: { x: number; y: number };
  paddy: { x: number; y: number; w: number; h: number };
  brown: { x: number; y: number; w: number; h: number };
  chilli: { x: number; y: number; w: number; h: number };
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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 160);
  const sunU = { value: SUN };
  const fogU = { value: new THREE.Vector2(4, 48) };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 16),
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
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShaderMaterial({
      uniforms: { uSun: sunU, uFog: fogU },
      vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: groundFrag,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // The field: instanced blades, a straight-ish row structure, ripening grain on some stems.
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
  const MAX_BLADES = 52000;
  const offsets = new Float32Array(MAX_BLADES * 3);
  const params = new Float32Array(MAX_BLADES * 4);
  const r = rng(20261128);
  let n = 0;
  while (n < MAX_BLADES) {
    const z = -64 + Math.pow(r(), 0.6) * 76;
    const x = (r() - 0.5) * (26 + (12 - z) * 1.15);
    // Near the leaf the crop thins so the close-up stays readable; the rest is dense.
    if (Math.abs(x) < 1.9 && z > -0.45 && z <= 0.35 && r() < 0.75) continue;
    const lane = Math.abs(x) < 0.9 && z > 0.6 && z < 3.9;
    const h = lane ? 0.2 + r() * 0.35 : 0.72 + r() * 0.62 + (z < -20 ? 0.2 : 0);
    const far = Math.max(0, -z - 8) / 38;
    offsets.set([x, z, h], n * 3);
    params.set([r() * Math.PI, r() * 6.28, (0.034 + r() * 0.03) * (1 + far * 3), r() < 0.45 ? 0.55 + r() * 0.45 : 0], n * 4);
    n++;
  }
  blade.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  blade.setAttribute("aParams", new THREE.InstancedBufferAttribute(params, 4));
  blade.instanceCount = MAX_BLADES;
  const bladeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uFog: fogU, uSun: sunU },
    vertexShader: bladeVert,
    fragmentShader: bladeFrag,
    side: THREE.DoubleSide,
  });
  const field = new THREE.Mesh(blade, bladeMat);
  field.frustumCulled = false;
  scene.add(field);

  // The leaf, its plant and its neighbours.
  const leafGeo = new THREE.PlaneGeometry(LEAF_L, LEAF_W, 120, 8);
  const leafMat = new THREE.ShaderMaterial({
    uniforms: {
      uScan: { value: 0 },
      uResolve: { value: 0 },
      uFade: { value: 0 },
      uPlain: { value: 0 },
      uSeed: { value: 0 },
      uSun: sunU,
      uSpots: { value: SPOTS.map((s) => new THREE.Vector3(...s)) },
    },
    vertexShader: leafVert,
    fragmentShader: leafFrag,
    side: THREE.DoubleSide,
  });
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.set(0, 1.05, 0);
  leaf.rotation.set(-0.12, 0.05, 0.05);
  scene.add(leaf);
  const plant = new THREE.Group();
  scene.add(plant);
  const stemMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#6f9a45") });
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.62, 1.0, 0.02), new THREE.Vector3(-1.7, 0.6, 0.06), new THREE.Vector3(-1.78, 0.0, 0.1)]);
  plant.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 16, 0.024, 6, false), stemMat));
  const neighbours: { pos: [number, number, number]; rot: [number, number, number]; s: number }[] = [
    { pos: [0.15, 1.42, -0.45], rot: [-0.3, 0.25, 0.32], s: 0.95 },
    { pos: [-0.25, 0.72, -0.25], rot: [0.15, -0.2, -0.22], s: 0.85 },
    { pos: [0.6, 1.25, -1.1], rot: [-0.2, -0.4, 0.18], s: 1.0 },
    { pos: [-0.9, 1.5, -0.9], rot: [-0.1, 0.5, 0.42], s: 0.8 },
  ];
  const leafMats: THREE.ShaderMaterial[] = [];
  neighbours.forEach((nb, i) => {
    const m = leafMat.clone();
    m.uniforms.uPlain.value = 1;
    m.uniforms.uSeed.value = i * 0.37 + 0.2;
    m.uniforms.uSun = sunU;
    leafMats.push(m);
    const mesh = new THREE.Mesh(leafGeo, m);
    mesh.position.set(...nb.pos);
    mesh.rotation.set(...nb.rot);
    mesh.scale.setScalar(nb.s);
    plant.add(mesh);
  });

  // Camera: from blade height, looking across the field into the sun, to a close look at the leaf.
  const camStart = { pos: new THREE.Vector3(0.2, 1.12, 11.5), look: new THREE.Vector3(-0.6, 1.3, -30) };
  const camEnd = { pos: new THREE.Vector3(0, 1.22, 3.45), look: new THREE.Vector3(0, 1.24, 0) };
  const look = new THREE.Vector3();

  // Depth of field target and pass.
  const rt = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
  const dofMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture },
      tDepth: { value: rt.depthTexture },
      uTexel: { value: new THREE.Vector2() },
      uFocus: { value: 3.45 },
      uRange: { value: 2.2 },
      uMax: { value: 0 },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: dofFrag,
    depthTest: false,
    depthWrite: false,
  });
  const dofScene = new THREE.Scene();
  const dofQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMat);
  dofQuad.frustumCulled = false;
  dofScene.add(dofQuad);
  const dofCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Overlay in CSS pixels: a paper veil and the particles.
  const overlay = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
  const veilMat = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMat);
  overlay.add(veil);

  const U = reg.u.length;
  const CLAIMS = 4;
  const N = U + CLAIMS;
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const colAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const sizeAttr = new THREE.BufferAttribute(new Float32Array(N), 1);
  const alphaAttr = new THREE.BufferAttribute(new Float32Array(N), 1);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("aColor", colAttr);
  geo.setAttribute("aSize", sizeAttr);
  geo.setAttribute("aAlpha", alphaAttr);
  const pointMat = new THREE.ShaderMaterial({ uniforms: { uDpr: { value: dpr } }, vertexShader: pointVert, fragmentShader: pointFrag, transparent: true, depthTest: false });
  const points = new THREE.Points(geo, pointMat);
  points.frustumCulled = false;
  overlay.add(points);

  const delay = new Float32Array(N);
  const pr = rng(7);
  for (let i = 0; i < N; i++) delay[i] = pr() * 0.45;
  const typeColor = (t: number) => (t === 1 ? STRAW : t >= 2 ? TURMERIC : LEAF);
  let states: { at: number; s: State }[] = [];

  const newState = (): State => ({ pos: new Float32Array(N * 2), col: new Float32Array(N * 3), size: new Float32Array(N), alpha: new Float32Array(N) });
  const copy = (s: State): State => ({ pos: s.pos.slice(), col: s.col.slice(), size: s.size.slice(), alpha: s.alpha.slice() });
  const setCol = (s: State, i: number, c: THREE.Color) => s.col.set([c.r, c.g, c.b], i * 3);
  // Push everything not kept outward from a focus point, as if the camera zoomed in past it.
  const zoomOut = (s: State, keep: (i: number) => boolean, cx: number, cy: number, k: number) => {
    for (let i = 0; i < N; i++) {
      if (keep(i)) continue;
      s.pos[i * 2] = cx + (s.pos[i * 2] - cx) * k;
      s.pos[i * 2 + 1] = cy + (s.pos[i * 2 + 1] - cy) * k;
      s.size[i] *= k * 0.8;
      s.alpha[i] = 0;
    }
  };

  function layout() {
    // 1. The leaf, sampled in its final framing and coloured like the leaf at each point.
    camera.position.copy(camEnd.pos);
    camera.lookAt(camEnd.look);
    camera.updateMatrixWorld();
    leaf.updateMatrixWorld();
    const sLeaf = newState();
    const sr = rng(11);
    const v = new THREE.Vector3();
    let k = 0;
    while (k < N) {
      const u = sr();
      const vv = (sr() - 0.5) * 2;
      const hw = leafHalfWidth(u);
      if (hw <= 0.001) continue;
      const vy = vv * hw;
      leafPoint((u - 0.5) * LEAF_L, vy * LEAF_W, v).applyMatrix4(leaf.matrixWorld).project(camera);
      let c = LEAF_LIGHT.clone().lerp(LEAF, 0.5 + 0.5 * vv);
      for (const sp of SPOTS) {
        const dx = ((u - sp[0]) * LEAF_L) / (sp[2] * 1.9);
        const dy = ((vy - sp[1] * leafHalfWidth(sp[0])) * LEAF_W) / sp[2];
        if (Math.hypot(dx, dy) < 1.15) c = new THREE.Color("#6b3d1c");
      }
      sLeaf.pos[k * 2] = (v.x * 0.5 + 0.5) * W;
      sLeaf.pos[k * 2 + 1] = (-v.y * 0.5 + 0.5) * H;
      setCol(sLeaf, k, c);
      sLeaf.size[k] = 3.4;
      sLeaf.alpha[k] = k < U ? 1 : 0;
      k++;
    }

    // 2. Every approved use, one tall waffle per crop, filling the screen.
    const nc = reg.crops.length;
    const left = W * 0.07;
    const span = W * 0.86;
    const colW = span / nc;
    const base = H * 0.8;
    const top = H * 0.3;
    const maxCount = Math.max(...reg.crops.map((c) => c.count));
    let pitch = 14;
    while (pitch > 3.4 && Math.ceil(maxCount / Math.floor((colW - 10) / pitch)) * pitch > base - top) pitch -= 0.2;
    const perRow = Math.floor((colW - 10) / pitch);
    const byCrop: number[][] = reg.crops.map(() => []);
    reg.u.forEach((u, i) => byCrop[u[0]].push(i));
    byCrop.forEach((list) => list.sort((a, b) => (reg.u[a][2] > 0 ? 1 : 0) - (reg.u[b][2] > 0 ? 1 : 0) || reg.u[a][1] - reg.u[b][1]));
    const sCrops = newState();
    const cropLabels: Labels["crops"] = [];
    byCrop.forEach((list, c) => {
      const x0 = left + c * colW + (colW - perRow * pitch) / 2;
      list.forEach((i, j) => {
        sCrops.pos[i * 2] = x0 + (j % perRow) * pitch + pitch / 2;
        sCrops.pos[i * 2 + 1] = base - Math.floor(j / perRow) * pitch;
        setCol(sCrops, i, typeColor(reg.u[i][1]));
        sCrops.size[i] = pitch * 0.66;
        sCrops.alpha[i] = 1;
      });
      cropLabels.push({ x: left + c * colW, y: base + pitch + 10, w: colW, crop: reg.crops[c] });
    });
    for (let c = 0; c < CLAIMS; c++) sCrops.pos.set([W + 60, H / 2], (U + c) * 2);

    // 3. Paddy: the camera "zooms" into its column; its 803 uses fill the screen, the rest fly out.
    const paddy = byCrop[0];
    const sPaddy = copy(sCrops);
    const pW = W * 0.84;
    const pH = H * 0.5;
    let pp = 40;
    let pRow = 1;
    while (pp > 8) {
      pRow = Math.floor(pW / pp);
      if (Math.ceil(paddy.length / pRow) * pp <= pH) break;
      pp -= 1;
    }
    const pRows = Math.ceil(paddy.length / pRow);
    const px0 = W / 2 - (pRow * pp) / 2;
    const py0 = H * 0.36;
    const paddyCol = { x: left + colW / 2, y: (base + top) / 2 };
    zoomOut(sPaddy, (i) => i < U && reg.u[i][0] === 0, paddyCol.x, paddyCol.y, 3.4);
    paddy.forEach((i, j) => {
      sPaddy.pos[i * 2] = px0 + (j % pRow) * pp + pp / 2;
      sPaddy.pos[i * 2 + 1] = py0 + Math.floor(j / pRow) * pp + pp / 2;
      sPaddy.size[i] = pp * 0.6;
      sPaddy.alpha[i] = 1;
      if (reg.u[i][2] > 0) setCol(sPaddy, i, TURMERIC);
    });

    // 4. Brown spot on paddy: the 31 uses, large, in two rows; the rest of paddy flies out.
    const brown = reg.u.map((u, i) => (u[2] > 0 ? i : -1)).filter((i) => i >= 0);
    const sBrown = copy(sPaddy);
    const bCols = Math.ceil(brown.length / 2);
    const bp = Math.min(74, (W * 0.84) / bCols);
    const bx0 = W / 2 - (bCols * bp) / 2;
    const by0 = H * 0.56;
    zoomOut(sBrown, (i) => i < U && reg.u[i][2] > 0, W / 2, py0 + (pRows * pp) / 2, 2.6);
    brown.forEach((i, j) => {
      sBrown.pos[i * 2] = bx0 + (j % bCols) * bp + bp / 2;
      sBrown.pos[i * 2 + 1] = by0 + Math.floor(j / bCols) * bp;
      sBrown.size[i] = bp * 0.5;
      sBrown.alpha[i] = 1;
      setCol(sBrown, i, TURMERIC);
    });

    // 5. The card: three uses become the bullets of three large rows; the other 28 fly out.
    const sRows = copy(sBrown);
    const rowX = W * 0.07;
    const rows: Labels["rows"] = [0, 1, 2].map((j) => ({ x: rowX, y: H * (0.47 + j * 0.15) }));
    zoomOut(sRows, (i) => i < U && reg.u[i][2] >= 3, W / 2, by0, 2.4);
    brown.forEach((i) => {
      const f = reg.u[i][2];
      if (f >= 3) {
        sRows.pos[i * 2] = rows[f - 3].x + 14;
        sRows.pos[i * 2 + 1] = rows[f - 3].y;
        sRows.size[i] = 28;
        sRows.alpha[i] = 1;
        setCol(sRows, i, LEAF);
      }
    });
    for (let c = 0; c < CLAIMS; c++) {
      sRows.pos.set([W + 60, H * (0.42 + c * 0.13)], (U + c) * 2);
      setCol(sRows, U + c, TURMERIC);
      sRows.size[U + c] = 22;
    }

    // 6. Chilli: its 475 uses as a block on the left; four claims from a general AI on the right.
    const chilli = byCrop[reg.crops.findIndex((c) => c.id === "chilli")];
    const sChilli = copy(sRows);
    const cH = H * 0.42;
    const cRow = 19;
    const cp = Math.min(19, cH / Math.ceil(chilli.length / cRow));
    const cx0 = W * 0.07;
    const cy0 = H * 0.4;
    for (let i = 0; i < N; i++) sChilli.alpha[i] = 0;
    chilli.forEach((i, j) => {
      sChilli.pos[i * 2] = cx0 + (j % cRow) * cp + cp / 2;
      sChilli.pos[i * 2 + 1] = cy0 + Math.floor(j / cRow) * cp + cp / 2;
      setCol(sChilli, i, LEAF);
      sChilli.size[i] = cp * 0.6;
      sChilli.alpha[i] = 1;
    });
    const claims: Labels["claims"] = [];
    for (let c = 0; c < CLAIMS; c++) {
      const i = U + c;
      const y = H * (0.42 + c * 0.13);
      claims.push({ x: W * 0.42, y });
      sChilli.pos.set([W * 0.42, y], i * 2);
      setCol(sChilli, i, TURMERIC);
      sChilli.size[i] = 22;
      sChilli.alpha[i] = 1;
    }
    const sOut = copy(sChilli);
    for (let c = 0; c < CLAIMS; c++) setCol(sOut, U + c, BRICK);

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
      rest: { x: rowX, y: H * 0.9 },
      paddy: { x: px0, y: py0, w: pRow * pp, h: pRows * pp },
      brown: { x: bx0, y: by0, w: bCols * bp, h: bp * 2 },
      chilli: { x: cx0, y: cy0, w: cRow * cp, h: Math.ceil(chilli.length / cRow) * cp },
      claims,
    });
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    const bw = Math.floor(W * dpr);
    const bh = Math.floor(H * dpr);
    rt.setSize(bw, bh);
    dofMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
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
  const claimRejected = [0, 0, 0, 0];
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
    let k = 0;
    while (k < states.length - 1 && p >= states[k + 1].at - (states[k + 1].at - states[k].at) * 0.62) k++;
    const a = states[k].s;
    const b = states[Math.min(k + 1, states.length - 1)].s;
    let f = 0;
    if (k < states.length - 1) {
      const s0 = states[k + 1].at - (states[k + 1].at - states[k].at) * 0.62;
      f = clamp((p - s0) / (states[k + 1].at - s0));
    }
    const dissolveIn = smooth(T.dissolve[0], T.dissolve[0] + 0.03, p);
    for (let i = 0; i < N; i++) {
      const t = easeInOut(clamp((f - delay[i] * 0.55) / 0.6));
      pos[i * 3] = a.pos[i * 2] + (b.pos[i * 2] - a.pos[i * 2]) * t;
      pos[i * 3 + 1] = a.pos[i * 2 + 1] + (b.pos[i * 2 + 1] - a.pos[i * 2 + 1]) * t;
      for (let c = 0; c < 3; c++) col[i * 3 + c] = a.col[i * 3 + c] + (b.col[i * 3 + c] - a.col[i * 3 + c]) * t;
      size[i] = a.size[i] + (b.size[i] - a.size[i]) * t;
      alpha[i] = (a.alpha[i] + (b.alpha[i] - a.alpha[i]) * t) * (k === 0 ? dissolveIn : 1);
    }
    for (let c = 0; c < CLAIMS; c++) {
      const i = U + c;
      const rj = claimRejected[c];
      if (rj > 0 && p < T.out) {
        col[i * 3] = TURMERIC.r + (BRICK.r - TURMERIC.r) * rj;
        col[i * 3 + 1] = TURMERIC.g + (BRICK.g - TURMERIC.g) * rj;
        col[i * 3 + 2] = TURMERIC.b + (BRICK.b - TURMERIC.b) * rj;
        alpha[i] = 1 - rj * 0.5;
        size[i] *= 1 - rj * 0.4;
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
    renderer.setRenderTarget(null);
    renderer.clear();
    if (veilA < 1) {
      const d = easeInOut(smooth(T.descend[0], T.descend[1], p));
      camera.position.lerpVectors(camStart.pos, camEnd.pos, d);
      look.lerpVectors(camStart.look, camEnd.look, Math.pow(d, 0.7));
      camera.lookAt(look);
      fogU.value.set(4 - d * 1.5, 48 - d * 32);
      bladeMat.uniforms.uTime.value = time;
      bladeMat.uniforms.uWind.value = 1 - d * 0.5;
      const scan = smooth(T.scan[0], T.scan[1], p);
      leafMat.uniforms.uScan.value = scan > 0 && scan < 1 ? scan : scan >= 1 ? 1.1 : 0;
      leafMat.uniforms.uResolve.value = smooth(T.scan[0], T.scan[0] + 0.01, p);
      const fade = smooth(T.dissolve[0] + 0.01, T.dissolve[1], p);
      leafMat.uniforms.uFade.value = fade;
      for (const m of leafMats) m.uniforms.uFade.value = fade;
      const dof = smooth(0.6, 1, d) * 9 * dpr;
      if (dof > 0.5) {
        dofMat.uniforms.uMax.value = dof;
        dofMat.uniforms.uFocus.value = camera.position.distanceTo(leaf.position);
        renderer.setRenderTarget(rt);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(dofScene, dofCam);
      } else {
        renderer.render(scene, camera);
      }
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
      rt.dispose();
      renderer.dispose();
      blade.dispose();
      geo.dispose();
    },
  };
}
