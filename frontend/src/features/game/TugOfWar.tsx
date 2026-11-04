import { useEffect, useState } from 'react'
import { type Matchup, tugSteps } from './tug'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** 끝까지 밀린 뒤 승패 글자가 뜨는 때(ms). tugSteps의 마지막 걸음 + 막대가 다 밀리는 시간 */
const VERDICT_MS = 1_550

/**
 * 결과 앞의 맞대결 (decisions.md 181번). 내 능력치(청록)와 그 반대 힘(와인)이 한 막대를 두고 밀고 당기다, 이긴 쪽이 쭉 밀어붙인다.
 * 움직임을 줄이는 설정이면 끝난 모습만 보인다.
 */
export function TugOfWar({ matchup }: { matchup: Matchup }) {
  const steps = tugSteps(matchup)
  const [instant] = useState(reducedMotion)
  const [step, setStep] = useState(instant ? steps.length - 1 : 0)
  const [done, setDone] = useState(instant)
  // 같은 결과 카드 안에서 승부는 한 번만 벌어진다: 처음 그릴 때의 걸음으로 충분하다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 마운트 때 한 번만 돌린다
  useEffect(() => {
    if (instant) {
      return
    }
    const ids = steps.slice(1).map((s, i) => setTimeout(() => setStep(i + 1), s.at))
    ids.push(setTimeout(() => setDone(true), VERDICT_MS))
    return () => ids.forEach(clearTimeout)
  }, [])
  const share = steps[step].share
  const final = step === steps.length - 1
  return (
    <div className="mt-2" data-testid="tug" data-won={matchup.won} data-done={done}>
      <div className="flex items-end justify-between text-[13px] font-black">
        <span className={`text-teal ${done && matchup.won ? 'animate-tug-win' : ''}`}>
          {matchup.mine}
          {done && matchup.won && <span className="ml-1 text-[11px]">승!</span>}
        </span>
        <span className="text-[10px] font-bold text-faint">VS</span>
        <span className={`text-wine ${done && !matchup.won ? 'animate-tug-win' : ''}`}>
          {done && !matchup.won && <span className="mr-1 text-[11px]">승!</span>}
          {matchup.rival}
        </span>
      </div>
      <div
        className="relative mt-1 h-3.5 overflow-hidden rounded-full bg-wine"
        role="meter"
        aria-label={`${matchup.mine} 대 ${matchup.rival}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
      >
        <div
          className="h-full rounded-r-full bg-teal"
          style={{
            width: `${share}%`,
            transition: instant
              ? 'none'
              : final
                ? 'width 400ms cubic-bezier(0.2, 0.9, 0.2, 1)'
                : 'width 260ms ease-in-out',
          }}
        />
        {/* 맞닿은 자리의 불꽃 */}
        {!final && (
          <div
            className="absolute top-0 h-full w-1 -translate-x-1/2 bg-white/80"
            style={{ left: `${share}%`, transition: 'left 260ms ease-in-out' }}
          />
        )}
      </div>
    </div>
  )
}
