import type { CSSProperties } from 'react'
import './jackpot-fx.css'

/**
 * 좋은 것을 처음 뽑았을 때 넘길 수 없는 시간(ms) (decisions.md 693번): 이동안 축하 연출이 나오고, 누르기·모두 보기·닫기가 듣지 않는다.
 */
export const REVEAL_HOLD_MS = 3000

const SPARKS = Array.from({ length: 16 }, (_, i) => i)

/**
 * 넘길 수 없는 동안의 축하 연출 (693번): 번쩍임 뒤에 별이 가운데에서 사방으로 세 번 터져 나가고, 아래의 막대가 남은 시간을 보여 준다.
 * 뽑기 창(`.weapon-reveal-body`) 안에 둔다. 색은 창의 `--reveal-color`를 따른다.
 */
export function JackpotFx() {
  return (
    <div
      className="jackpot-fx"
      aria-hidden="true"
      style={{ '--hold': `${REVEAL_HOLD_MS}ms` } as CSSProperties}
    >
      {SPARKS.map((i) => (
        <i
          key={i}
          style={
            {
              '--a': `${i * 22.5 + (i % 2) * 9}deg`,
              '--d': `${(i % 4) * 0.16}s`,
              '--r': `${32 + (i % 3) * 10}vmin`,
            } as CSSProperties
          }
        >
          {i % 2 ? '✦' : '★'}
        </i>
      ))}
      <span className="jackpot-timer">
        <b />
      </span>
    </div>
  )
}
