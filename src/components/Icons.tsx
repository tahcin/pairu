// Line icons for actions, drawn on a 24px grid.
type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Camera = ({ size = 28 }: P) => (
  <svg {...base(size)}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);
export const Gallery = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
);
export const Mic = ({ size = 28 }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
export const Speaker = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);
export const StopIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);
export const Share = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </svg>
);
export const Phone = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
  </svg>
);
export const Back = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const Check = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const Warn = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.5v.5" />
  </svg>
);
export const Globe = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
export const Leaf = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" />
    <path d="M5 19l8-8" />
  </svg>
);
