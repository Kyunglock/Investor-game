import { type CSSProperties, useEffect, useState } from 'react'

/** 맞붙는 시간과 한쪽으로 밀리는 시간(ms). 투자 회의 연출이 이만큼 늦게 시작한다 (decisions.md 279번). */
const CLASH_MS = 2200
const PUSH_MS = 700
export const TEAM_CLASH_MS = CLASH_MS + PUSH_MS

/** 불꽃이 튀는 방향(px)과 늦춤(ms). */
const SPARKS: { sx: number; sy: number; delay: number }[] = [
  { sx: -26, sy: -22, delay: 0 },
  { sx: 24, sy: -26, delay: 90 },
  { sx: -30, sy: 14, delay: 180 },
  { sx: 28, sy: 18, delay: 260 },
  { sx: 0, sy: -32, delay: 340 },
  { sx: -12, sy: 28, delay: 420 },
  { sx: 14, sy: 30, delay: 120 },
]

/**
 * "너희가 알아서 해" (decisions.md 279번). 사장이 맡기면 매수파(사자)와 매도파(팔자)가 가운데서 맞붙어 불꽃이 튄다. 경계선이 엎치락뒤치락하다가 무게(직원
 * 안목)가 정한 쪽으로 밀리고, 이긴 쪽이 팀 결정이 된다. 승패는 서버가 정한 그대로다. 움직임을 줄이는 설정이거나 빨리 보기면 끝난 모습만.
 */
export function TeamClash({
  buyNames,
  sellNames,
  buy,
  sell,
  choice,
  instant,
}: {
  buyNames: string[]
  sellNames: string[]
  buy: number
  sell: number
  choice: 'BUY' | 'SELL' | 'HOLD'
  instant: boolean
}) {
  const [phase, setPhase] = useState<'clash' | 'push' | 'done'>(instant ? 'done' : 'clash')
  useEffect(() => {
    if (instant) {
      setPhase('done')
      return
    }
    const push = setTimeout(() => setPhase('push'), CLASH_MS)
    const done = setTimeout(() => setPhase('done'), CLASH_MS + PUSH_MS)
    return () => {
      clearTimeout(push)
      clearTimeout(done)
    }
  }, [instant])
  const buyWins = choice === 'BUY'
  // 맞붙는 동안은 가운데, 밀리면 이긴 쪽이 82%를 차지한다.
  const share = phase === 'clash' ? 50 : buyWins ? 82 : 18
  const who = (names: string[]) => (names.length > 0 ? names.join('·') : '아무도 없음')
  return (
    <section
      className="mt-2 rounded border border-pen bg-card p-2"
      data-testid="team-clash"
      data-phase={phase}
      aria-label="매수파와 매도파가 맞붙는다"
    >
      <p className="text-center text-[13px] font-semibold">
        “너희가 알아서 해” — 직원들끼리 붙었다
      </p>
      <div className="relative mt-2 h-14 overflow-visible rounded">
        <div className="absolute inset-0 flex overflow-hidden rounded">
          <div
            className="flex items-center justify-start bg-up/85 pl-2 text-white transition-[width] duration-700 ease-out"
            style={{ width: `${share}%` }}
          >
            <span className="text-[15px] font-bold">매수</span>
          </div>
          <div className="flex flex-1 items-center justify-end bg-down/85 pr-2 text-white">
            <span className="text-[15px] font-bold">매도</span>
          </div>
        </div>
        {/* 맞붙는 자리: 경계선이 흔들리고 불꽃이 튄다. */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 transition-[left] duration-700 ease-out"
          style={{ left: `${share}%` }}
          aria-hidden="true"
        >
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[26px] leading-none ${
              phase === 'clash' ? 'animate-clash-jitter' : ''
            }`}
          >
            ⚡
          </div>
          {phase === 'clash' &&
            SPARKS.map((s) => (
              <span
                key={`${s.sx}-${s.sy}`}
                className="clash-spark absolute top-1/2 block h-2 w-2 -translate-x-1/2 rounded-full bg-gold"
                style={
                  {
                    '--sx': `${s.sx}px`,
                    '--sy': `${s.sy}px`,
                    animationDelay: `${s.delay}ms`,
                  } as CSSProperties
                }
              />
            ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[12px]">
        <span className="text-up" data-testid="clash-buy">
          {who(buyNames)} · 무게 {buy}
        </span>
        <span className="text-right text-down" data-testid="clash-sell">
          {who(sellNames)} · 무게 {sell}
        </span>
      </div>
      {phase === 'done' && (
        <p
          className={`animate-clash-win mt-1 text-center font-pen text-[22px] ${buyWins ? 'text-up' : 'text-down'}`}
          data-testid="clash-result"
        >
          팀 결정: {buyWins ? '매수!' : '매도!'}
        </p>
      )}
    </section>
  )
}
