// Vertical layouts for the register scenes on a phone, in CSS pixels. Pure functions, shared by
// the WebGL film (scene.ts) and the static version (a 2D canvas), so both draw the same picture.
import type { Register } from "./data";

// Colour codes; the renderers map them to the palette.
export const C = { LEAF: 0, STRAW: 1, TURMERIC: 2, BRICK: 3, SPOT: 4, LIGHT: 5, MUTED: 6 } as const;
export const typeCode = (t: number) => (t === 1 ? C.STRAW : t >= 2 ? C.TURMERIC : C.LEAF);

export interface Frame {
  x: Float32Array;
  y: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  col: Uint8Array;
}
export const newFrame = (n: number): Frame => ({ x: new Float32Array(n), y: new Float32Array(n), size: new Float32Array(n), alpha: new Float32Array(n), col: new Uint8Array(n) });
export const copyFrame = (f: Frame): Frame => ({ x: f.x.slice(), y: f.y.slice(), size: f.size.slice(), alpha: f.alpha.slice(), col: f.col.slice() });

export interface Box {
  W: number;
  H: number; // visible height (small viewport)
  top: number; // below the top bar
  bottom: number; // above the safe area
  gutter: number;
}

export interface CropLabel {
  y: number;
  h: number;
  crop: Register["crops"][number];
}
export interface MobileLabels {
  box: Box;
  crops: CropLabel[];
  cropsTop: number;
  stripX: number;
  paddy: { x: number; y: number; w: number; h: number };
  brown: { x: number; y: number; w: number; h: number };
  rows: { x: number; y: number }[];
  chilli: { x: number; y: number; w: number; h: number };
  claims: { y: number }[];
}

const clampN = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const landscape = (b: Box) => b.W > b.H * 1.1;

// One horizontal strip of dots per crop, stacked from paddy (803) down to cashew (2). The label
// sits in a column on the left; the dot pitch is the largest that fits the screen.
export function cropStrips(reg: Register, b: Box, topFrac = 0.2) {
  const g = b.gutter;
  const labelW = Math.min(118, b.W * 0.33);
  const x0 = g + labelW + 8;
  const stripW = b.W - g - x0;
  const top = Math.max(b.top + 112, b.H * topFrac);
  const avail = b.H - b.bottom - 20 - top;
  const gap = landscape(b) ? 2 : 6;
  const minH = landscape(b) ? 14 : 20;
  let pitch = 10;
  let perRow = 1;
  const height = (p: number) => {
    perRow = Math.max(1, Math.floor(stripW / p));
    return reg.crops.reduce((s, c) => s + Math.max(Math.ceil(c.count / perRow) * p, minH) + gap, -gap);
  };
  while (pitch > 3 && height(pitch) > avail) pitch -= 0.1;
  height(pitch);
  const labels: CropLabel[] = [];
  const rowsOf: { x: number; y: number }[][] = [];
  let y = top;
  reg.crops.forEach((c) => {
    const rows = Math.ceil(c.count / perRow);
    const h = Math.max(rows * pitch, minH);
    labels.push({ y, h, crop: c });
    const slots: { x: number; y: number }[] = [];
    for (let j = 0; j < c.count; j++) slots.push({ x: x0 + (j % perRow) * pitch + pitch / 2, y: y + Math.floor(j / perRow) * pitch + pitch / 2 });
    rowsOf.push(slots);
    y += h + gap;
  });
  return { pitch, perRow, x0, top, labels, rowsOf, labelW };
}

export function registerFrames(reg: Register, b: Box, N: number, CLAIMS: number) {
  const U = reg.u.length;
  const g = b.gutter;
  const W = b.W;
  const H = b.H;
  const wide = landscape(b);

  // Group the uses by crop, and within a crop fungicides first, so colour forms bands.
  const byCrop: number[][] = reg.crops.map(() => []);
  reg.u.forEach((u, i) => byCrop[u[0]].push(i));
  byCrop.forEach((list) => list.sort((a, c) => (reg.u[a][2] > 0 ? 1 : 0) - (reg.u[c][2] > 0 ? 1 : 0) || reg.u[a][1] - reg.u[c][1]));

  // 1. Crops.
  const strips = cropStrips(reg, b);
  const sCrops = newFrame(N);
  byCrop.forEach((list, c) =>
    list.forEach((i, j) => {
      const s = strips.rowsOf[c][j];
      sCrops.x[i] = s.x;
      sCrops.y[i] = s.y;
      sCrops.size[i] = Math.max(2.4, strips.pitch * 0.72);
      sCrops.alpha[i] = 1;
      sCrops.col[i] = typeCode(reg.u[i][1]);
    }),
  );
  for (let c = 0; c < CLAIMS; c++) {
    sCrops.x[U + c] = W + 40;
    sCrops.y[U + c] = H * 0.6;
  }

  // Everything not kept flies outward from a point, as if the camera pushed in past it.
  const zoomOut = (f: Frame, keep: (i: number) => boolean, cx: number, cy: number, k: number) => {
    for (let i = 0; i < N; i++) {
      if (keep(i)) continue;
      f.x[i] = cx + (f.x[i] - cx) * k;
      f.y[i] = cy + (f.y[i] - cy) * k;
      f.size[i] *= 0.6;
      f.alpha[i] = 0;
    }
  };

  // 2. Paddy: its 803 uses fill the screen; brown spot's 31 turn turmeric.
  const paddy = byCrop[0];
  const sPaddy = copyFrame(sCrops);
  const pTop = Math.max(b.top + 150, H * 0.33);
  const pW = W - g * 2;
  const pH = H - b.bottom - 24 - pTop;
  let pp = 40;
  let pRow = 1;
  while (pp > 6) {
    pRow = Math.floor(pW / pp);
    if (Math.ceil(paddy.length / pRow) * pp <= pH) break;
    pp -= 0.25;
  }
  const pRows = Math.ceil(paddy.length / pRow);
  const px0 = W / 2 - (pRow * pp) / 2;
  const py0 = pTop;
  zoomOut(sPaddy, (i) => i < U && reg.u[i][0] === 0, strips.x0 + 40, strips.top + 30, 3.2);
  paddy.forEach((i, j) => {
    sPaddy.x[i] = px0 + (j % pRow) * pp + pp / 2;
    sPaddy.y[i] = py0 + Math.floor(j / pRow) * pp + pp / 2;
    sPaddy.size[i] = pp * 0.62;
    sPaddy.alpha[i] = reg.u[i][2] > 0 ? 1 : 0.92;
    sPaddy.col[i] = reg.u[i][2] > 0 ? C.TURMERIC : C.LEAF;
  });

  // 3. Brown spot: the 31 uses, large.
  const brown = reg.u.map((u, i) => (u[2] > 0 ? i : -1)).filter((i) => i >= 0);
  const sBrown = copyFrame(sPaddy);
  const bCols = wide ? 11 : 5;
  const bRows = Math.ceil(brown.length / bCols);
  const bTop = Math.max(b.top + 150, H * 0.34);
  const bp = Math.min((W - g * 2) / bCols, (H - b.bottom - 30 - bTop) / bRows, 64);
  const bx0 = W / 2 - (bCols * bp) / 2;
  zoomOut(sBrown, (i) => i < U && reg.u[i][2] > 0, W / 2, py0 + (pRows * pp) / 2, 2.6);
  brown.forEach((i, j) => {
    sBrown.x[i] = bx0 + (j % bCols) * bp + bp / 2;
    sBrown.y[i] = bTop + Math.floor(j / bCols) * bp + bp / 2;
    sBrown.size[i] = bp * 0.56;
    sBrown.alpha[i] = 1;
    sBrown.col[i] = C.TURMERIC;
  });

  // 4. The card: three uses become the bullets of three large rows; the rest fly out.
  const sRows = copyFrame(sBrown);
  const rTop = Math.max(b.top + 128, H * 0.3);
  const rStep = wide ? 0 : Math.min(150, (H - b.bottom - 70 - rTop) / 3);
  const rColW = (W - g * 2) / 3;
  const rows = [0, 1, 2].map((j) => (wide ? { x: g + j * rColW, y: rTop } : { x: g, y: rTop + j * rStep }));
  zoomOut(sRows, (i) => i < U && reg.u[i][2] >= 3, W / 2, bTop + bp * 3, 2.4);
  brown.forEach((i) => {
    const f = reg.u[i][2];
    if (f < 3) return;
    sRows.x[i] = rows[f - 3].x + 9;
    sRows.y[i] = rows[f - 3].y + 12;
    sRows.size[i] = 16;
    sRows.alpha[i] = 1;
    sRows.col[i] = C.LEAF;
  });
  for (let c = 0; c < CLAIMS; c++) {
    sRows.x[U + c] = -30;
    sRows.y[U + c] = H * (0.5 + c * 0.1);
    sRows.col[U + c] = C.TURMERIC;
    sRows.size[U + c] = 14;
  }

  // 5. Chilli: its 475 uses as a block near the top, four claims from a general AI below.
  const chilli = byCrop[reg.crops.findIndex((c) => c.id === "chilli")];
  const sChilli = copyFrame(sRows);
  const cTop = Math.max(b.top + 172, H * 0.27);
  // The four claims need about 100 px each on a narrow phone; the chilli block takes what is left.
  const claimNeed = (W < 420 ? 100 : 84) * CLAIMS;
  const cH = clampN(H - b.bottom - 16 - claimNeed - 26 - cTop, 40, H * 0.13);
  const cW = W - g * 2;
  let cp = 14;
  let cRow = 1;
  while (cp > 4) {
    cRow = Math.floor(cW / cp);
    if (Math.ceil(chilli.length / cRow) * cp <= cH) break;
    cp -= 0.25;
  }
  for (let i = 0; i < N; i++) sChilli.alpha[i] = 0;
  chilli.forEach((i, j) => {
    sChilli.x[i] = g + (j % cRow) * cp + cp / 2;
    sChilli.y[i] = cTop + Math.floor(j / cRow) * cp + cp / 2;
    sChilli.col[i] = C.LEAF;
    sChilli.size[i] = cp * 0.66;
    sChilli.alpha[i] = 1;
  });
  const chH = Math.ceil(chilli.length / cRow) * cp;
  const clTop = cTop + chH + 26;
  const clStep = (H - b.bottom - 16 - clTop) / CLAIMS;
  const claims = [0, 1, 2, 3].map((c) => ({ y: clTop + c * clStep }));
  for (let c = 0; c < CLAIMS; c++) {
    const i = U + c;
    sChilli.x[i] = g + 7;
    sChilli.y[i] = claims[c].y + 11;
    sChilli.col[i] = C.TURMERIC;
    sChilli.size[i] = 13;
    sChilli.alpha[i] = 1;
  }
  const sOut = copyFrame(sChilli);
  for (let c = 0; c < CLAIMS; c++) sOut.col[U + c] = C.BRICK;

  const labels: MobileLabels = {
    box: b,
    crops: strips.labels,
    cropsTop: strips.top,
    stripX: strips.x0,
    paddy: { x: px0, y: py0, w: pRow * pp, h: pRows * pp },
    brown: { x: bx0, y: bTop, w: bCols * bp, h: bRows * bp },
    rows,
    chilli: { x: g, y: cTop, w: cRow * cp, h: chH },
    claims,
  };
  return { sCrops, sPaddy, sBrown, sRows, sChilli, sOut, labels, byCrop, strips };
}
