import { type CSSProperties, useEffect, useState } from 'react'

/** 맞붙는 시간, 한쪽으로 밀어붙이는 시간(ms). 투자 회의 연출이 이만큼 늦게 시작한다 (decisions.md 279·284번). */
const CLASH_MS = 2900
const PUSH_MS = 800
export const TEAM_CLASH_MS = CLASH_MS + PUSH_MS
/** 경계선이 한 번 밀고 밀리는 간격(ms). */
const SWING_MS = 290

/**
 * 맞붙는 동안 경계선이 갈 자리(매수 쪽 몫, %). 처음엔 크게 엎치락뒤치락하고, 갈수록 이길 쪽으로 쏠린다. 무게가 팽팽할수록 오래 흔들린다.
 */
export function clashSwings(buy: number, sell: number, buyWins: boolean): number[] {
  const steps = Math.floor(CLASH_MS / SWING_MS)
  const total = buy + sell
  const lean = total === 0 ? 0 : Math.abs(buy - sell) / total
  const out: number[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const amp = 22 * (1 - t * 0.55)
    const side = i % 2 === 0 ? 1 : -1
    const drift = (buyWins ? 1 : -1) * (4 + 14 * t * (0.6 + lean))
    out.push(Math.max(12, Math.min(88, 50 + side * amp + drift)))
  }
  return out
}

/** 불꽃: 튀는 방향(px), 크기, 색, 늦춤(ms). */
const SPARKS: { sx: number; sy: number; size: number; color: string; delay: number }[] = [
  { sx: -38, sy: -30, size: 8, color: 'var(--gold)', delay: 0 },
  { sx: 34, sy: -34, size: 7, color: '#fff', delay: 70 },
  { sx: -44, sy: 18, size: 6, color: 'var(--up)', delay: 140 },
  { sx: 42, sy: 22, size: 6, color: 'var(--down)', delay: 210 },
  { sx: 0, sy: -44, size: 9, color: 'var(--gold)', delay: 280 },
  { sx: -16, sy: 40, size: 5, color: '#fff', delay: 350 },
  { sx: 18, sy: 42, size: 7, color: 'var(--gold)', delay: 110 },
  { sx: -52, sy: -6, size: 5, color: 'var(--up)', delay: 180 },
  { sx: 52, sy: -4, size: 5, color: 'var(--down)', delay: 250 },
  { sx: -26, sy: -46, size: 6, color: '#fff', delay: 320 },
  { sx: 28, sy: -48, size: 6, color: 'var(--gold)', delay: 40 },
  { sx: 6, sy: 48, size: 8, color: 'var(--gold)', delay: 400 },
]

/** "쾅!"이 번갈아 터지는 자리(경계선 기준 px)와 늦춤. */
const BANGS: { dx: number; dy: number; word: string; delay: number }[] = [
  { dx: -46, dy: -30, word: '쾅!', delay: 0 },
  { dx: 40, dy: -26, word: '퍽!', delay: 480 },
  { dx: -36, dy: 26, word: '탁!', delay: 960 },
  { dx: 44, dy: 22, word: '쾅!', delay: 1440 },
  { dx: -8, dy: -40, word: '우당탕!', delay: 1920 },
  { dx: 30, dy: 30, word: '퍽!', delay: 2400 },
]

/**
 * "너희가 알아서 해" (decisions.md 279·284번). 사장이 맡기면 매수파와 매도파가 가운데서 맞붙는다: 상자가 흔들리고, ⚡가 맥박 치고, 불꽃과 "쾅!"이
 * 터지며 경계선이 좌우로 크게 밀고 밀리다가, 무게(직원 안목)가 정한 쪽이 끝까지 밀어붙인다. 승패는 서버가 정한 그대로다. 움직임 줄이기·빨리 보기면 끝난
 * 모습만.
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
  const buyWins = choice === 'BUY'
  const swings = clashSwings(buy, sell, buyWins)
  const [step, setStep] = useState(instant ? -1 : 0)
  const [phase, setPhase] = useState<'clash' | 'push' | 'done'>(instant ? 'done' : 'clash')
  useEffect(() => {
    if (instant) {
      setPhase('done')
      setStep(-1)
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < swings.length; i++) {
      timers.push(setTimeout(() => setStep(i), i * SWING_MS))
    }
    timers.push(setTimeout(() => setPhase('push'), CLASH_MS))
    timers.push(setTimeout(() => setPhase('done'), CLASH_MS + PUSH_MS))
    return () => timers.forEach(clearTimeout)
  }, [instant, swings.length])
  const final = buyWins ? 90 : 10
  const share = phase === 'clash' && step >= 0 ? swings[step] : final
  const fighting = phase === 'clash'
  const who = (names: string[]) => (names.length > 0 ? names.join('·') : '아무도 없음')
  return (
    <section
      className={`mt-2 overflow-hidden rounded border-2 border-pen bg-card p-2 ${
        fighting ? 'animate-clash-shake' : phase === 'push' ? 'animate-shake' : ''
      }`}
      data-testid="team-clash"
      data-phase={phase}
      aria-label="매수파와 매도파가 맞붙는다"
    >
      <p className="text-center text-[13px] font-semibold">
        “너희가 알아서 해” — <span className="text-red-pen">직원들끼리 붙었다!</span>
      </p>
      <div className="mt-1 flex justify-between px-1 text-[14px] font-bold">
        <span
          className={`text-up ${fighting ? 'animate-clash-bob' : ''} ${
            phase === 'done' && !buyWins ? 'opacity-40' : ''
          }`}
        >
          👊 매수파
        </span>
        <span
          className={`text-down ${fighting ? 'animate-clash-bob' : ''} ${
            phase === 'done' && buyWins ? 'opacity-40' : ''
          }`}
          style={{ animationDelay: '140ms' }}
        >
          매도파 👊
        </span>
      </div>
      <div className="relative mt-1 h-16 rounded">
        <div className="absolute inset-0 flex overflow-hidden rounded">
          <div
            className={`flex items-center justify-start bg-up pl-2 text-white ${
              phase === 'done' && buyWins ? 'animate-clash-flash' : ''
            }`}
            style={{
              width: `${share}%`,
              transition: `width ${phase === 'clash' ? 240 : 700}ms cubic-bezier(.34,1.56,.64,1)`,
            }}
          >
            <span className="text-[16px] font-black">매수</span>
          </div>
          <div
            className={`flex flex-1 items-center justify-end bg-down pr-2 text-white ${
              phase === 'done' && !buyWins ? 'animate-clash-flash' : ''
            }`}
          >
            <span className="text-[16px] font-black">매도</span>
          </div>
        </div>
        {/* 맞붙는 자리: 경계선을 따라 ⚡가 맥박 치고, 불꽃과 "쾅!"이 터진다. */}
        <div
          className="pointer-events-none absolute top-0 bottom-0"
          style={{
            left: `${share}%`,
            transition: `left ${phase === 'clash' ? 240 : 700}ms cubic-bezier(.34,1.56,.64,1)`,
          }}
          aria-hidden="true"
        >
          <div
            className={`absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 text-[34px] leading-none drop-shadow ${
              fighting ? 'animate-clash-bolt' : ''
            }`}
          >
            ⚡
          </div>
          {fighting &&
            SPARKS.map((s) => (
              <span
                key={`${s.sx}-${s.sy}`}
                className="clash-spark absolute top-1/2 left-0 block rounded-full"
                style={
                  {
                    width: s.size,
                    height: s.size,
                    background: s.color,
                    boxShadow: `0 0 6px ${s.color}`,
                    '--sx': `${s.sx}px`,
                    '--sy': `${s.sy}px`,
                    animationDelay: `${s.delay}ms`,
                  } as CSSProperties
                }
              />
            ))}
          {fighting &&
            BANGS.map((b) => (
              <span
                key={`${b.dx}-${b.delay}`}
                className="clash-bang absolute top-1/2 left-0 whitespace-nowrap font-pen text-[28px] font-black text-gold"
                style={
                  {
                    textShadow: '0 0 3px #8b2342, 2px 2px 0 #8b2342, -1px -1px 0 #fff',
                    '--bx': `${b.dx}px`,
                    '--by': `${b.dy}px`,
                    animationDelay: `${b.delay}ms`,
                  } as CSSProperties
                }
              >
                {b.word}
              </span>
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
          className={`animate-clash-win mt-1 text-center font-pen text-[26px] ${buyWins ? 'text-up' : 'text-down'}`}
          data-testid="clash-result"
        >
          팀 결정: {buyWins ? '매수!' : '매도!'}
        </p>
      )}
    </section>
  )
}
