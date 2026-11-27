// Simple drawn crop icons, one per crop id. Flat shapes, readable at 56px.
const LEAF = "#4E7D3A";
const LEAF_DARK = "#355C27";
const STEM = "#6B8F3E";

const icons: Record<string, JSX.Element> = {
  paddy: (
    <g fill="none" strokeLinecap="round">
      <path d="M32 58 C32 42 30 28 24 14" stroke={STEM} strokeWidth="3" />
      <path d="M32 58 C33 42 36 30 42 18" stroke={STEM} strokeWidth="3" />
      <path d="M32 58 C30 46 22 38 12 34" stroke={LEAF} strokeWidth="3" />
      <path d="M32 58 C35 46 44 40 54 38" stroke={LEAF} strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={`a${i}`} cx={24 + i * 0.4 - 3} cy={14 + i * 5} rx="2.6" ry="4" fill="#D9A93B" transform={`rotate(-30 ${21 + i * 0.4} ${14 + i * 5})`} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={`b${i}`} cx={44 - i * 0.6} cy={18 + i * 5} rx="2.6" ry="4" fill="#D9A93B" transform={`rotate(30 ${44 - i * 0.6} ${18 + i * 5})`} />
      ))}
    </g>
  ),
  cotton: (
    <g>
      <path d="M32 60 V44" stroke={STEM} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 46 L32 40 L44 46 L40 52 L32 48 L24 52 Z" fill="#8A5A2B" />
      <circle cx="24" cy="30" r="10" fill="#FFFFFF" stroke="#D8D0C2" strokeWidth="1.5" />
      <circle cx="40" cy="30" r="10" fill="#FFFFFF" stroke="#D8D0C2" strokeWidth="1.5" />
      <circle cx="32" cy="20" r="11" fill="#FFFFFF" stroke="#D8D0C2" strokeWidth="1.5" />
      <circle cx="32" cy="34" r="9" fill="#FFFFFF" stroke="#D8D0C2" strokeWidth="1.5" />
    </g>
  ),
  chilli: (
    <g>
      <path d="M40 10 C38 14 36 16 33 17" stroke={STEM} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M28 16 C38 14 44 20 42 30 C40 42 30 52 14 58 C24 48 28 38 26 28 C25 22 25 18 28 16 Z" fill="#C8372D" />
      <path d="M26 16 C30 13 35 14 38 18 C34 20 30 20 26 16 Z" fill={LEAF} />
      <path d="M33 24 C34 30 32 36 28 42" stroke="#E0675C" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  ),
  groundnut: (
    <g>
      <path
        d="M22 10 C30 8 36 14 35 22 C34 27 31 29 32 34 C33 40 38 44 37 51 C36 58 28 60 22 57 C15 54 14 46 18 40 C21 35 21 32 18 27 C14 20 15 12 22 10 Z"
        fill="#C99A5B"
        stroke="#9C7340"
        strokeWidth="2"
      />
      <path d="M20 18 L30 20 M18 46 L32 48 M22 52 L33 53 M19 24 L31 26" stroke="#9C7340" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M44 30 C50 22 56 22 58 26 C54 30 50 32 44 30 Z" fill={LEAF} />
      <path d="M44 38 C52 36 56 40 56 44 C50 44 46 42 44 38 Z" fill={LEAF_DARK} />
    </g>
  ),
  maize: (
    <g>
      <path d="M32 8 C40 14 42 30 38 44 C36 50 28 50 26 44 C22 30 24 14 32 8 Z" fill="#E9B93A" />
      {[16, 22, 28, 34, 40].map((y) => (
        <path key={y} d={`M${27 + (y > 30 ? 0 : 1)} ${y} H${37 - (y > 30 ? 0 : 1)}`} stroke="#C99520" strokeWidth="1.5" />
      ))}
      <path d="M32 12 V44" stroke="#C99520" strokeWidth="1.5" />
      <path d="M30 58 C18 52 14 40 18 26 C22 36 26 44 32 48 Z" fill={LEAF} />
      <path d="M34 58 C46 52 50 40 46 26 C42 36 38 44 32 48 Z" fill={LEAF_DARK} />
    </g>
  ),
  tomato: (
    <g>
      <circle cx="32" cy="36" r="20" fill="#D8412F" />
      <path d="M22 30 C22 26 26 23 29 23" stroke="#EE7B6B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M32 18 L28 12 M32 18 L22 18 M32 18 L42 18 M32 18 L36 12 M32 18 L32 10" stroke={LEAF} strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  brinjal: (
    <g>
      <path d="M38 18 C50 24 52 40 44 50 C36 60 20 58 16 48 C12 38 22 34 26 28 C29 23 32 16 38 18 Z" fill="#5B2E6B" />
      <path d="M22 44 C22 48 25 51 29 52" stroke="#8E5AA0" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M34 16 C38 12 44 12 48 16 C46 22 40 24 34 20 Z" fill={LEAF} />
      <path d="M44 14 L50 6" stroke={STEM} strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  banana: (
    <g>
      <path d="M30 10 L34 10 L34 18 L30 18 Z" fill="#6B5A2E" />
      <path d="M32 18 C20 22 12 36 16 52 C20 50 22 40 32 30 Z" fill="#E8C33A" stroke="#B8962A" strokeWidth="1.5" />
      <path d="M32 18 C30 30 30 44 34 56 C38 54 38 40 36 26 Z" fill="#F0CF4A" stroke="#B8962A" strokeWidth="1.5" />
      <path d="M32 18 C44 22 52 36 48 52 C44 50 42 40 34 28 Z" fill="#E8C33A" stroke="#B8962A" strokeWidth="1.5" />
    </g>
  ),
  mango: (
    <g>
      <path d="M30 16 C44 14 54 26 52 40 C50 52 38 58 28 56 C16 54 10 44 14 32 C17 24 22 17 30 16 Z" fill="#F0A834" />
      <path d="M40 22 C46 26 49 32 48 38" stroke="#F6C86A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M22 44 C26 50 32 52 38 52" stroke="#D9822A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M30 16 C30 12 32 9 34 8" stroke="#6B5A2E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M34 10 C40 4 50 6 52 10 C46 14 40 14 34 10 Z" fill={LEAF} />
    </g>
  ),
  blackgram: (
    <g>
      <path d="M10 22 C22 14 42 14 54 22 C50 28 44 30 32 30 C20 30 14 28 10 22 Z" fill={LEAF} />
      <path d="M12 22 C24 18 40 18 52 22" stroke={LEAF_DARK} strokeWidth="1.5" fill="none" />
      {[
        [20, 44],
        [32, 40],
        [44, 44],
        [26, 52],
        [38, 52],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx="6" ry="4.5" fill="#2A2522" />
          <path d={`M${x - 2} ${y} H${x + 2}`} stroke="#F2EDE4" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
    </g>
  ),
  potato: (
    <g>
      <path d="M14 34 C12 24 22 16 34 16 C46 16 54 24 52 36 C50 48 40 52 30 52 C20 52 15 44 14 34 Z" fill="#C79A63" stroke="#9C7340" strokeWidth="2" />
      {[
        [24, 28],
        [38, 26],
        [44, 38],
        [28, 42],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#8A6236" />
      ))}
    </g>
  ),
  onion: (
    <g>
      <path d="M32 18 C46 26 52 36 48 46 C45 54 38 56 32 56 C26 56 19 54 16 46 C12 36 18 26 32 18 Z" fill="#B54A5A" />
      <path d="M32 20 C40 28 42 40 38 54 M32 20 C24 28 22 40 26 54" stroke="#D97C8A" strokeWidth="2" fill="none" />
      <path d="M32 18 C30 12 28 8 24 4 M32 18 C34 12 38 8 42 6" stroke={LEAF} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M28 57 L30 61 M32 57 V62 M36 57 L34 61" stroke="#9C7340" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  cashew: (
    <g>
      <path d="M30 8 C30 12 31 14 32 16" stroke="#6B5A2E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M32 10 C38 4 48 6 50 10 C44 14 38 14 32 10 Z" fill={LEAF} />
      <path d="M20 22 C20 16 26 14 32 14 C40 14 46 18 45 26 C44 34 40 40 32 41 C24 41 20 34 20 22 Z" fill="#E4572E" />
      <path d="M26 20 C26 18 28 17 30 17" stroke="#F28C6B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M36 40 C44 40 48 46 46 52 C44 58 36 60 30 56 C26 53 28 49 32 48 C35 47 34 44 33 41 Z" fill="#9C8A6A" stroke="#6E5F45" strokeWidth="1.5" />
    </g>
  ),
  unknown: (
    <g fill="none" strokeLinecap="round">
      <path d="M32 56 C32 42 32 30 32 22" stroke={STEM} strokeWidth="3" />
      <path d="M32 40 C24 40 16 34 14 24 C24 24 30 30 32 40 Z" fill={LEAF} />
      <path d="M32 32 C40 32 48 26 50 16 C40 16 34 22 32 32 Z" fill={LEAF_DARK} />
      <circle cx="32" cy="14" r="4" fill="#C8862A" />
    </g>
  ),
};

export function CropIcon({ id, size = 56 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {icons[id] || icons.unknown}
    </svg>
  );
}
