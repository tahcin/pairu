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
export const Close = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const ChevronRight = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const ChevronDown = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M5 9l7 7 7-7" />
  </svg>
);
export const ListIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6l1 1 1.5-2M4 12l1 1 1.5-2M4 18l1 1 1.5-2" />
  </svg>
);
export const Sun = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);
export const Question = ({ size = 28 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17v.5" />
  </svg>
);
export const External = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const Clock = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const History = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4l2.5 2" />
  </svg>
);
export const Cross = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);
// The Pairu mark: one leaf on a stem, drawn as a filled shape.
export const Mark = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 29V17" stroke="var(--leaf)" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M16 18C16 9.5 21.5 4 29 3.5c-.4 8-6 13.6-13 14.5z" fill="var(--leaf)" />
    <path d="M16 22C15.6 15.8 11.4 11.6 4 11.4c.4 6.4 4.8 10.4 12 10.6z" fill="#6f9a52" />
  </svg>
);
