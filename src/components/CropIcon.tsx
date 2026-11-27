// Drawn crop icons, one per crop id, in one style: flat filled shapes, no outlines, a base tone
// and one shade, on a 64 px grid with the object filling about 44 px. Readable at 48 px.
const LEAF = "#5C9443";
const LEAF_DARK = "#3D7231";
const STEM = "#4E7F36";

const icons: Record<string, JSX.Element> = {
  paddy: (
    <g>
      <path d="M32 58 C31.5 46 30 34 25 22" stroke={STEM} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M32 58 C32.5 46 35 36 40 26" stroke={STEM} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M32 58 C28 48 20 43 9 42 C18 38 27 42 32 52 Z" fill={LEAF} />
      <path d="M32 58 C36 48 44 43 55 41 C46 37 37 41 32 52 Z" fill={LEAF_DARK} />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={`a${i}`} cx={23.5 - i * 0.9} cy={21 - i * 3.6} rx="2.4" ry="3.6" fill={i % 2 ? "#D29A2C" : "#E3B444"} transform={`rotate(-28 ${23.5 - i * 0.9} ${21 - i * 3.6})`} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={`b${i}`} cx={41 + i * 1.1} cy={25 - i * 3.6} rx="2.4" ry="3.6" fill={i % 2 ? "#E3B444" : "#D29A2C"} transform={`rotate(26 ${41 + i * 1.1} ${25 - i * 3.6})`} />
      ))}
    </g>
  ),
  cotton: (
    <g>
      <path d="M32 58 V44" stroke={STEM} strokeWidth="3" strokeLinecap="round" />
      <circle cx="23" cy="31" r="10.5" fill="#E7DFD1" />
      <circle cx="41" cy="31" r="10.5" fill="#E7DFD1" />
      <circle cx="32" cy="36" r="10" fill="#E7DFD1" />
      <circle cx="22" cy="29" r="9.5" fill="#FFFFFF" />
      <circle cx="42" cy="29" r="9.5" fill="#FFFFFF" />
      <circle cx="32" cy="20" r="10.5" fill="#FFFFFF" />
      <circle cx="32" cy="33" r="8.5" fill="#FFFFFF" />
      <path d="M18 44 L26 39 L32 44 L38 39 L46 44 L40 49 L32 46 L24 49 Z" fill="#8A5A2B" />
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
      <path d="M24 9 C32 7 38 13 37 21 C36.5 26 33 29 34 34 C35 40 40 44 39 51 C38 58 30 61 23 58 C16 55 15 46 19 40 C22 35 22 32 19 27 C15 20 16 11 24 9 Z" fill="#CFA066" />
      <path d="M24 9 C32 7 38 13 37 21 C36.5 26 33 29 34 34 C35 40 40 44 39 51 C38 58 30 61 23 58 C30 56 33 50 30 43 C28 37 28 32 31 26 C33 19 30 12 24 9 Z" fill="#B5864E" />
      <path d="M21 18 L31 20 M20 25 L31 27 M20 46 L33 48 M23 52 L33 53" stroke="#A97B45" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M44 30 C50 21 57 21 59 25 C55 30 50 32 44 30 Z" fill={LEAF} />
      <path d="M44 38 C52 35 57 39 57 44 C50 44 46 42 44 38 Z" fill={LEAF_DARK} />
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
      <path d="M29.5 8 h5 v10 h-5 Z" fill="#7A6A3A" />
      <path d="M32 17 C19 21 11 36 15 53 C20 51 23 40 32 29 Z" fill="#E9C23C" />
      <path d="M32 17 C44 21 53 36 49 53 C44 51 41 40 32 29 Z" fill="#D6A92C" />
      <path d="M32 17 C29 30 29 45 33 57 C38 55 38 40 35 25 Z" fill="#F3D35A" />
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
      <path d="M13 35 C11 24 21 15 34 15 C47 15 55 24 53 36 C51 49 41 53 30 53 C19 53 14 45 13 35 Z" fill="#CFA066" />
      <path d="M53 36 C51 49 41 53 30 53 C21 53 16 48 14 41 C22 47 36 48 44 42 C50 37 52 30 51 24 C53 27 54 31 53 36 Z" fill="#B5864E" />
      {[
        [24, 27],
        [38, 25],
        [44, 36],
        [28, 40],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" fill="#94683A" />
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
      <path d="M30 7 C30 11 31 13 32 15" stroke="#6B5A2E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M32 10 C38 4 48 6 50 10 C44 14 38 14 32 10 Z" fill={LEAF} />
      <path d="M19 23 C19 16 25 14 32 14 C40 14 46 18 45 26 C44 34 40 41 32 42 C24 42 19 35 19 23 Z" fill="#E4572E" />
      <path d="M45 26 C44 34 40 41 32 42 C27 42 23 39 21 34 C27 38 35 37 40 31 C43 27 44 22 43 18 C45 20 45.5 23 45 26 Z" fill="#C9431F" />
      <path d="M36 41 C44 41 49 46 47 53 C45 59 36 61 30 57 C26 54 28 49 32 48 C35 47 34 44 33 42 Z" fill="#A8946F" />
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
