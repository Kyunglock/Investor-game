import type { Grade } from '../../api/client'
import { LADDER, ladderTone } from './grades'

/** 등급 사다리 (11.3절). 지금 위치와 다음 칸을 보인다. X와 Z가 SSS 위라는 것을 색으로 보인다. */
export function GradeLadder({ grade }: { grade: Grade }) {
  const at = LADDER.indexOf(grade)
  return (
    <ol className="mt-2 flex flex-wrap gap-1" aria-label="등급 사다리" data-testid="ladder">
      {LADDER.map((g, i) => (
        <li
          key={g}
          className={`min-w-[34px] rounded-sm px-1 text-center font-mono-num text-[11px] leading-5 ${ladderTone(g)} ${
            i === at ? 'ring-2 ring-wine' : i > at + 1 ? 'opacity-40' : ''
          }`}
          aria-current={i === at ? 'step' : undefined}
        >
          {g}
        </li>
      ))}
    </ol>
  )
}
