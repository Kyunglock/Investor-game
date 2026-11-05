import { useEffect, useState } from 'react'
import { type Matchup, type Side, tugSteps } from './tug'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** 마지막 걸음 뒤 막대가 다 차는 시간(ms) */
const SURGE_MS = 450

/** 승패 글자가 뜨는 때(ms): 막대가 이긴 쪽으로 다 찬 뒤 */
export const TUG_DONE_MS =
  (tugSteps({ start: 50, won: true } as Matchup).at(-1)?.at ?? 0) + SURGE_MS

/**
 * 결과 앞의 맞대결 (decisions.md 181번). 막대 하나 안에서 고른 행동(청록, 왼쪽)과 뒤집힐 수 있던 행동(와인, 오른쪽)이 맞닿아
 * 엎치락뒤치락하다, 이긴 쪽이 막대를 쭉 채운다. 움직임을 줄이는 설정이면 끝난 모습만 보인다. 투자 회의 창에서 직원마다 사장 말과 꼬드김·제 판단이 맞붙는다
 * (235번).
 */
export function TugOfWar({
  matchup,
  delay = 0,
  instant: skip = false,
}: {
  matchup: Matchup
  /** 막대가 움직이기 시작하기까지(ms). 투자 회의 창은 직원마다 차례로 돌린다 (235번) */
  delay?: number
  /** 연출 없이 끝난 모습만 (빨리 보기) */
  instant?: boolean
}) {
  const steps = tugSteps(matchup)
  const [instant] = useState(() => skip || reducedMotion())
  const [step, setStep] = useState(instant ? steps.length - 1 : 0)
  const [done, setDone] = useState(instant)
  // 같은 결과 카드 안에서 승부는 한 번만 벌어진다: 처음 그릴 때의 걸음으로 충분하다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 마운트 때 한 번만 돌린다
  useEffect(() => {
    if (instant) {
      return
    }
    const ids = steps.slice(1).map((s, i) => setTimeout(() => setStep(i + 1), delay + s.at))
    ids.push(setTimeout(() => setDone(true), delay + TUG_DONE_MS))
    return () => ids.forEach(clearTimeout)
  }, [])
  const share = steps[step].share
  const final = step === steps.length - 1
  const move = instant
    ? 'none'
    : final
      ? `${SURGE_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`
      : '200ms ease-in-out'
  return (
    <div
      className={`mt-2 ${done ? 'animate-tug-done' : ''}`}
      data-testid="tug"
      data-won={matchup.won}
      data-done={done}
    >
      <div className="relative h-11 overflow-hidden rounded-md bg-wine" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 bg-teal"
          style={{ width: `${share}%`, transition: move === 'none' ? 'none' : `width ${move}` }}
        />
        {/* 맞닿은 자리: 두 힘이 부딪치는 하얀 띠 */}
        {!final && (
          <div
            className="absolute inset-y-0 w-1.5 -translate-x-1/2 bg-white shadow-[0_0_8px_3px_rgba(255,255,255,0.7)]"
            style={{ left: `${share}%`, transition: move === 'none' ? 'none' : `left ${move}` }}
          />
        )}
        <Label side={matchup.mine} align="left" winner={done && matchup.won} />
        <Label side={matchup.rival} align="right" winner={done && !matchup.won} />
      </div>
      {/* 막대는 꾸밈이라 읽지 않고, 승부만 글로 알린다 */}
      <p className="sr-only" aria-live="polite">
        {`${matchup.mine.action}(${matchup.mine.trait}) 대 ${matchup.rival.action}(${matchup.rival.trait})`}
        {done && ` — ${matchup.won ? matchup.mine.trait : matchup.rival.trait} 승`}
      </p>
    </div>
  )
}

function Label({ side, align, winner }: { side: Side; align: 'left' | 'right'; winner: boolean }) {
  return (
    <div
      className={`absolute inset-y-0 flex flex-col justify-center px-3 leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] ${
        align === 'left' ? 'left-0 items-start' : 'right-0 items-end'
      }`}
    >
      <span className={`text-[14px] font-black ${winner ? 'animate-tug-win' : ''}`}>
        {winner && align === 'right' && '승! '}
        {side.action}
        {winner && align === 'left' && ' 승!'}
      </span>
      <span className="text-[10px] font-bold opacity-85">{side.trait}</span>
    </div>
  )
}
