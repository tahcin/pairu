// Scene timing on the film progress. Shared by the WebGL (scene.ts) and the captions (Film.tsx).
export const T = {
  descend: [0.035, 0.2],
  scan: [0.23, 0.3],
  dissolve: [0.37, 0.41],
  crops: 0.45,
  paddy: 0.51,
  brown: 0.565,
  rows: 0.62,
  chilli: 0.7,
  reject: [0.718, 0.775],
  out: 0.795,
};

// Chapters for the progress rail.
export const CHAPTERS = [
  { at: 0, label: "Field" },
  { at: 0.2, label: "Leaf" },
  { at: 0.37, label: "Register" },
  { at: 0.67, label: "Plain AI" },
  { at: 0.8, label: "Evidence" },
];
