// Scene timing for the phone film, on the film progress p in [0, 1]. The track is SCREENS screen
// heights long, so 0.01 of progress is about a seventh of a thumb flick.
export const SCREENS = 15;

export const M = {
  hero: [0, 0.05],
  descend: [0.04, 0.17],
  desc: [0.06, 0.15],
  scan: [0.17, 0.225],
  look: [0.165, 0.222],
  name: [0.226, 0.346],
  build: [0.23, 0.255],
  cycle: [0.265, 0.33],
  dissolve: [0.35, 0.385],
  every: [0.358, 0.41],
  crops: 0.43,
  cropsCap: [0.412, 0.476],
  paddy: 0.495,
  paddyCap: [0.478, 0.532],
  brown: 0.55,
  brownCap: [0.533, 0.588],
  rows: 0.61,
  rowsCap: [0.59, 0.646],
  chilli: 0.68,
  chilliCap: [0.656, 0.795],
  reject: [0.695, 0.775],
  out: 0.784,
  ev1: [0.8, 0.895],
  ev2: [0.9, 1.01],
} as const;

export const CHAPTERS = [
  { at: 0, label: "Field" },
  { at: 0.12, label: "Leaf" },
  { at: 0.35, label: "Register" },
  { at: 0.66, label: "Plain AI" },
  { at: 0.8, label: "Evidence" },
];
