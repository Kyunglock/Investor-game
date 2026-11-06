import { type CSSProperties, useEffect, useRef, useState } from 'react'

/** 맞붙는 가장 짧은 시간, 한쪽으로 밀어붙이는 시간(ms) (decisions.md 279·284번). */
const CLASH_MS = 2900
const PUSH_MS = 800
/** 토론 한 줄이 떠오르는 간격(ms) (285번). 말이 오가는 동안 계속 맞붙는다. */
export const DEBATE_LINE_MS = 1000
/** 경계선이 한 번 밀고 밀리는 간격(ms). */
const SWING_MS = 290

export type DebateLine = { name: string; side: 'BUY' | 'SELL'; text: string; last: boolean }

/** 맞붙는 시간: 결판 전 토론이 다 오갈 때까지, 짧아도 CLASH_MS. */
export function clashMs(debate: DebateLine[]): number {
  return Math.max(CLASH_MS, debate.filter((d) => !d.last).length * DEBATE_LINE_MS)
}

/** 투자 회의 연출이 이만큼 늦게 시작한다: 맞붙고, 밀어붙이고, 진 쪽이 투덜댈 때까지. */
export function teamClashMs(debate: DebateLine[]): number {
  return clashMs(debate) + PUSH_MS + (debate.some((d) => d.last) ? DEBATE_LINE_MS : 0)
}

/**
 * 토론 한 줄마다 떠오르는 때(ms). 결판 전 말은 DEBATE_LINE_MS 간격으로, 이긴 쪽 결판은 밀어붙이기 시작에, 진 쪽 투덜거림은 밀어붙인 뒤에.
 */
export function debateTimes(debate: DebateLine[]): number[] {
  const clash = clashMs(debate)
  let finale = 0
  let talk = 0
  return debate.map((d) => (d.last ? clash + PUSH_MS * finale++ : DEBATE_LINE_MS * talk++))
}

/**
 * 맞붙는 동안 경계선이 갈 자리(매수 쪽 몫, %). 처음엔 크게 엎치락뒤치락하고, 갈수록 이길 쪽으로 쏠린다. 무게가 팽팽할수록 오래 흔들린다.
 */
export function clashSwings(buy: number, sell: number, buyWins: boolean, ms = CLASH_MS): number[] {
  const steps = Math.floor(ms / SWING_MS)
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

/** 맞붙는 내내 "쾅!"이 터지게 BANGS를 이어 붙인다. */
function bangsFor(ms: number) {
  const cycle = 2880
  const out: typeof BANGS = []
  for (let start = 0; start < ms - 300; start += cycle) {
    for (const b of BANGS) {
      if (start + b.delay < ms - 300) {
        out.push({ ...b, delay: start + b.delay })
      }
    }
  }
  return out
}

/**
 * "너희가 알아서 해" (decisions.md 279·284·285번). 사장이 맡기면 매수파와 매도파가 가운데서 맞붙는다: 상자가 흔들리고, ⚡가 맥박 치고, 불꽃과 "쾅!"이
 * 터지며 경계선이 좌우로 크게 밀고 밀리다가, 무게(직원 안목)가 정한 쪽이 끝까지 밀어붙인다. 승패는 서버가 정한 그대로다. 움직임 줄이기·빨리 보기면 끝난
 * 모습만. 맞붙는 동안 아래로 매수파(왼쪽)·매도파(오른쪽)의 말이 한 줄씩 쭉쭉 올라오고, 끝에 이긴 쪽이 결판을 내고 진 쪽이 투덜댄다.
 */
export function TeamClash({
  buyNames,
  sellNames,
  buy,
  sell,
  choice,
  debate,
  instant,
}: {
  buyNames: string[]
  sellNames: string[]
  buy: number
  sell: number
  choice: 'BUY' | 'SELL' | 'HOLD'
  debate: DebateLine[]
  instant: boolean
}) {
  const buyWins = choice === 'BUY'
  const clash = clashMs(debate)
  const swings = clashSwings(buy, sell, buyWins, clash)
  const bangs = bangsFor(clash)
  const [step, setStep] = useState(instant ? -1 : 0)
  const [phase, setPhase] = useState<'clash' | 'push' | 'done'>(instant ? 'done' : 'clash')
  const [said, setSaid] = useState(instant ? debate.length : 0)
  const log = useRef<HTMLOListElement>(null)
  // 띄울 때를 처음 그릴 때 굳힌다: 회사 상태를 다시 받아 배열이 새로 와도 토론이 처음부터 다시 돌지 않게.
  const times = useRef(debateTimes(debate)).current
  useEffect(() => {
    if (instant) {
      setPhase('done')
      setStep(-1)
      setSaid(times.length)
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < swings.length; i++) {
      timers.push(setTimeout(() => setStep(i), i * SWING_MS))
    }
    times.forEach((at, i) => {
      timers.push(setTimeout(() => setSaid(i + 1), at))
    })
    timers.push(setTimeout(() => setPhase('push'), clash))
    timers.push(setTimeout(() => setPhase('done'), clash + PUSH_MS))
    return () => timers.forEach(clearTimeout)
  }, [instant, swings.length, times, clash])
  // 새 말이 올라오면 대화창을 맨 아래로 내린다.
  useEffect(() => {
    const el = log.current
    if (el && said > 0) {
      el.scrollTop = el.scrollHeight
    }
  }, [said])
  const final = buyWins ? 90 : 10
  const share = phase === 'clash' && step >= 0 ? swings[step] : final
  const fighting = phase === 'clash'
  // 한쪽이 비었으면 토론에 끌려 나온 사람(모르겠다던 직원이나 옆자리 사람)이 그쪽을 든다 (285번).
  const who = (names: string[], side: 'BUY' | 'SELL') => {
    if (names.length > 0) {
      return names.join('·')
    }
    const drafted = debate.find((d) => d.side === side)?.name
    return drafted ? `${drafted}(끌려 나옴)` : '아무도 없음'
  }
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
            bangs.map((b) => (
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
          {who(buyNames, 'BUY')} · 무게 {buy}
        </span>
        <span className="text-right text-down" data-testid="clash-sell">
          {who(sellNames, 'SELL')} · 무게 {sell}
        </span>
      </div>
      {debate.length > 0 && (
        <ol
          ref={log}
          className="mt-2 max-h-52 space-y-1.5 overflow-y-auto rounded bg-paper/60 p-1.5"
          data-testid="clash-debate"
          aria-label="직원들의 토론"
          aria-live="polite"
        >
          {debate.slice(0, said).map((d, i) => {
            const buySide = d.side === 'BUY'
            const won = d.last && buySide === buyWins
            return (
              <li
                // 토론은 정해진 순서대로만 늘어난다.
                // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 곧 자리다
                key={i}
                className={`animate-debate-in flex ${buySide ? 'justify-start' : 'justify-end'}`}
                data-testid="debate-line"
                data-side={d.side}
              >
                <div
                  className={`max-w-[82%] rounded-lg border-2 px-2 py-1 text-[13px] leading-snug ${
                    buySide
                      ? 'rounded-bl-none border-up bg-up/10'
                      : 'rounded-br-none border-down bg-down/10'
                  } ${won ? 'font-bold text-[15px]' : ''} ${d.last && !won ? 'italic opacity-80' : ''}`}
                >
                  <span
                    className={`block text-[11px] font-semibold ${buySide ? 'text-up' : 'text-right text-down'}`}
                  >
                    {buySide ? '👊 ' : ''}
                    {d.name}
                    {buySide ? '' : ' 👊'}
                  </span>
                  {d.text}
                </div>
              </li>
            )
          })}
        </ol>
      )}
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
