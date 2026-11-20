import type { CatCode } from '@web/features/raising/store'
import { NEW_CATS } from '../mental/catRoster'

const coats: Partial<Record<CatCode, string>> = {
  sky: '#acc7db',
  mint: '#afd6c4',
  lilac: '#b9a3cb',
  sunset: '#efa97d',
  night: '#918b9f',
  snow: '#f5ede3',
}

export function LoafCat({ code }: { code: CatCode }) {
  const cat = NEW_CATS.find((entry) => entry.code === code)
  const fur = cat?.color ?? coats[code]
  const folded = cat?.model === 'fold' || code === 'sky'
  return (
    <svg className="baking-cat" viewBox="0 0 108 76" aria-hidden="true">
      <ellipse cx="54" cy="65" rx="46" ry="5" fill="#9c6947" opacity=".18" />
      <g
        className="loaf-breath"
        stroke="#574139"
        strokeWidth="2.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          d="M10 55 Q10 40 24 35 Q38 21 63 24 Q88 24 96 45 Q104 62 87 64 Q56 69 22 64 Q9 64 10 55Z"
          fill={fur}
        />
        <path d="M64 26 q2 9 7 10 M73 28 q2 6 5 8" fill="none" opacity=".38" strokeWidth="4" />
        <path
          d="M90 47 Q101 60 83 62 Q69 65 59 61 Q55 58 61 56 Q66 55 74 57 Q84 58 85 52"
          fill={fur}
        />
        <path
          d={
            folded
              ? 'M14 41 L9 29 Q10 24 24 29 Q32 24 42 28 Q56 23 57 29 L51 41 Q56 57 39 60 Q17 63 12 52 Q10 47 14 41Z'
              : 'M14 40 L14 21 Q15 17 28 28 Q35 25 42 28 L53 19 Q57 18 53 40 Q60 55 43 60 Q19 65 12 53 Q10 47 14 40Z'
          }
          fill={fur}
        />
        <path
          d={folded ? 'M12 28 l9 3 -6 4 M47 31 l8 -3 -3 8' : 'M17 25 l7 5 -7 5 M46 31 l6 -7 -1 11'}
          fill="#e8a99f"
          stroke="none"
        />
        <ellipse cx="33" cy="51" rx="15" ry="7" fill="#fff2dd" stroke="none" opacity=".85" />
        <path d="M18 43 q4 5 9 0 M38 43 q4 5 9 -1" fill="none" />
        <path d="M30 48 q3 -2 6 0 l-3 3Z" fill="#ad786f" stroke="none" />
        <path d="M33 51 q-2 4 -5 2 M33 51 q2 3 5 1" fill="none" strokeWidth="1.4" />
        <path
          d="M12 46 l-6 -1 M13 50 l-6 1 M48 47 l7 -2 M48 50 l6 1"
          fill="none"
          strokeWidth="1.2"
        />
        <path d="M25 60 q5 5 12 2 q5 3 10 -1" fill="none" strokeWidth="1.7" />
      </g>
    </svg>
  )
}
