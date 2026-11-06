import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { Company } from '../../api/client'
import type { Figure } from '../game/pixel/figure'
import type { MoodKey } from '../game/pixel/moods'
import { Person } from '../game/pixel/Person'
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../game/pixel/sprite'
import { usePixelArt } from '../game/pixelArt'
import { ATTIRE_COLORS, attireOf } from './office'

type Employee = Company['employees'][number]

const PIXELATED = { imageRendering: 'pixelated', shapeRendering: 'crispEdges' } as const
/** 회의실 캐릭터 너비(px). */
const CHARACTER_PX = 40

/**
 * 회의실에 앉은 사람 하나 (286번). 직원은 사무실 미니맵(237번)과 같은 모습(성별·차림새는 종합 등급)이고, 끌려 나온 옆자리 사람은 손님 모습이다. 표정: 말할
 * 때 결의, 이기면 기쁨, 지면 절망. 그림을 끄면(190번) 동그라미 글자로 그린다.
 */
function Character({
  employee,
  look,
  side,
  mood,
  talking,
  fallback,
}: {
  employee: Employee | undefined
  look: number
  side: 'BUY' | 'SELL'
  mood: MoodKey | null
  talking: boolean
  fallback: string
}) {
  const shown = usePixelArt((s) => s.shown)
  if (!shown) {
    return (
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[13px] font-bold text-white shadow ${
          side === 'BUY' ? 'bg-up' : 'bg-down'
        } ${talking ? 'ring-2 ring-gold' : ''}`}
      >
        {fallback}
      </span>
    )
  }
  const figure: Figure = employee
    ? {
        who: 'me',
        sex: employee.id % 2 === 0 ? 'F' : 'M',
        stage: 'adult',
        x: 0,
        recolor: ATTIRE_COLORS[attireOf(employee.overallGrade)],
      }
    : { who: 'kid', look, sex: look % 2 ? 'F' : 'M', stage: 'adult', x: 0 }
  return (
    <svg
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      width={CHARACTER_PX}
      height={(CHARACTER_PX * SPRITE_HEIGHT) / SPRITE_WIDTH}
      className={`block drop-shadow ${talking ? 'drop-shadow-[0_0_4px_var(--gold)]' : ''}`}
      style={PIXELATED}
      data-testid="room-character"
      aria-hidden="true"
    >
      <ellipse
        cx={SPRITE_WIDTH / 2}
        cy={SPRITE_HEIGHT - 0.6}
        rx={5}
        ry={0.9}
        fill={side === 'BUY' ? 'var(--up)' : 'var(--down)'}
        opacity={0.35}
      />
      <Person figure={figure} me={{ adornment: null, mark: null }} mood={mood} top={0} />
    </svg>
  )
}

/** 맞붙는 가장 짧은 시간, 한쪽으로 밀어붙이는 시간(ms) (decisions.md 279·284번). */
const CLASH_MS = 2900
const PUSH_MS = 800
/** 토론 한 줄이 떠오르는 간격(ms) (285번). 말이 오가는 동안 계속 맞붙는다. */
export const DEBATE_LINE_MS = 1000
/** 회의실에 한쪽마다 그리는 사람 수. 넘치면 "+N". */
const SEATS = 10

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
 * 회의실에서 매수파가 차지하는 몫(%, 왼쪽) (decisions.md 286번): 양쪽 사람 수의 비율. 한 사람뿐인 쪽도 앉을 자리가 있게 22~78%로 자른다.
 */
export function roomShare(buyers: number, sellers: number): number {
  if (buyers + sellers === 0) {
    return 50
  }
  return Math.max(22, Math.min(78, Math.round((100 * buyers) / (buyers + sellers))))
}

/** 한쪽에 앉는 사람: 그쪽 의견을 낸 직원, 없으면 토론에 끌려 나온 사람(285번). */
export function sidePeople(names: string[], side: 'BUY' | 'SELL', debate: DebateLine[]): string[] {
  if (names.length > 0) {
    return names
  }
  return [...new Set(debate.filter((d) => d.side === side).map((d) => d.name))]
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
  staff = [],
  instant,
}: {
  buyNames: string[]
  sellNames: string[]
  buy: number
  sell: number
  choice: 'BUY' | 'SELL' | 'HOLD'
  debate: DebateLine[]
  /** 회사 직원: 이름으로 캐릭터를 찾는다 (286번). */
  staff?: Employee[]
  instant: boolean
}) {
  const buyWins = choice === 'BUY'
  const clash = clashMs(debate)
  const bangs = bangsFor(clash)
  const [phase, setPhase] = useState<'clash' | 'push' | 'done'>(instant ? 'done' : 'clash')
  const [said, setSaid] = useState(instant ? debate.length : 0)
  const log = useRef<HTMLOListElement>(null)
  // 띄울 때를 처음 그릴 때 굳힌다: 회사 상태를 다시 받아 배열이 새로 와도 토론이 처음부터 다시 돌지 않게.
  const times = useRef(debateTimes(debate)).current
  useEffect(() => {
    if (instant) {
      setPhase('done')
      setSaid(times.length)
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    times.forEach((at, i) => {
      timers.push(setTimeout(() => setSaid(i + 1), at))
    })
    timers.push(setTimeout(() => setPhase('push'), clash))
    timers.push(setTimeout(() => setPhase('done'), clash + PUSH_MS))
    return () => timers.forEach(clearTimeout)
  }, [instant, times, clash])
  // 새 말이 올라오면 대화창을 맨 아래로 내린다.
  useEffect(() => {
    const el = log.current
    if (el && said > 0) {
      el.scrollTop = el.scrollHeight
    }
  }, [said])
  const fighting = phase === 'clash'
  const done = phase === 'done'
  const buyers = sidePeople(buyNames, 'BUY', debate)
  const sellers = sidePeople(sellNames, 'SELL', debate)
  const share = roomShare(buyers.length, sellers.length)
  // 지금 말하는 사람: 방금 올라온 말의 주인.
  const speaking = said > 0 ? debate[said - 1] : null
  const drafted = (names: string[]) => (names.length > 0 ? '' : '(끌려옴)')
  // 한쪽에 한 명뿐이면 한 줄로 앉아 방을 낮춘다: 탁자 앞에 선다.
  const twoRows = Math.max(buyers.length, sellers.length) > 1
  // 회의에 온 직원은 사무실 미니맵과 같은 캐릭터로, 끌려 나온 옆자리 사람은 손님 캐릭터로 그린다.
  const staffOf = (name: string) => staff.find((e) => e.name === name)
  const zone = (side: 'BUY' | 'SELL', people: string[]) => {
    const buySide = side === 'BUY'
    const wins = buySide === buyWins
    const shown = people.slice(0, SEATS)
    const rows = twoRows
      ? [shown.filter((_, i) => i % 2 === 0), shown.filter((_, i) => i % 2 === 1)]
      : [shown]
    return (
      <div
        className={`relative flex h-full flex-col justify-between py-2.5 ${
          buySide ? 'bg-up/15' : 'bg-down/15'
        } ${done && wins ? 'animate-clash-flash' : ''}`}
        style={{ width: buySide ? `${share}%` : `${100 - share}%` }}
        data-testid={buySide ? 'room-buy' : 'room-sell'}
        data-seats={people.length}
      >
        {rows.map((row, r) => (
          <div
            // 위 줄과 아래 줄: 탁자를 사이에 두고 앉는다.
            // biome-ignore lint/suspicious/noArrayIndexKey: 줄은 둘뿐이다
            key={r}
            className={`flex flex-wrap justify-center gap-x-1 ${r === 1 ? 'items-end' : ''}`}
          >
            {row.map((name) => {
              const talking = !done && speaking?.name === name && speaking.side === side
              return (
                <div
                  key={name}
                  className={`relative flex w-12 flex-col items-center transition-transform duration-300 ${talking ? 'z-10' : ''} ${fighting ? 'animate-clash-bob' : ''} ${
                    phase === 'push' && wins ? (buySide ? 'translate-x-2' : '-translate-x-2') : ''
                  } ${done && !wins ? 'opacity-45 grayscale' : ''} ${done && wins ? 'animate-clash-win' : ''}`}
                  style={{ animationDelay: `${(name.length * 97) % 360}ms` }}
                  data-testid="room-seat"
                  data-talking={talking}
                >
                  {talking && (
                    <span className="absolute -top-3 -right-1 text-[13px]" aria-hidden="true">
                      💬
                    </span>
                  )}
                  <span
                    className={`block transition-transform duration-200 ${talking ? 'scale-115' : ''}`}
                  >
                    <Character
                      employee={staffOf(name)}
                      look={name.length}
                      side={side}
                      mood={done ? (wins ? 'joy' : 'despair') : talking ? 'confident' : null}
                      talking={talking}
                      fallback={done ? (wins ? '🙌' : '😩') : name.slice(0, 1)}
                    />
                  </span>
                  <span className="w-full truncate text-center text-[10px] leading-tight">
                    {name}
                  </span>
                </div>
              )
            })}
            {r === 1 && people.length > SEATS && (
              <span className="self-center text-[11px] text-muted">+{people.length - SEATS}</span>
            )}
          </div>
        ))}
      </div>
    )
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
      {/* 회의실 (286번): 매수파는 왼쪽, 매도파는 오른쪽에 탁자를 사이에 두고 앉는다. 방은 사람 수 비율대로 나뉜다. */}
      <div
        className={`relative mt-1 overflow-hidden rounded border border-line bg-paper ${twoRows ? 'h-52' : 'h-[118px]'}`}
        data-testid="meeting-room"
        role="img"
        aria-label={`회의실: 매수파 ${buyers.length}명, 매도파 ${sellers.length}명`}
      >
        <div
          className={`absolute right-3 left-3 h-6 rounded-full border-2 border-pen/40 bg-desk shadow-inner ${twoRows ? 'top-1/2 -translate-y-1/2' : 'bottom-2.5'}`}
          aria-hidden="true"
        />
        <div className="relative flex h-full">
          {zone('BUY', buyers)}
          {zone('SELL', sellers)}
        </div>
        {/* 맞붙는 자리: 두 편이 갈리는 선을 따라 ⚡가 맥박 치고, 불꽃과 "쾅!"이 터진다. */}
        <div
          className="pointer-events-none absolute top-0 bottom-0"
          style={{ left: `${share}%` }}
          aria-hidden="true"
        >
          <div className="absolute top-0 bottom-0 left-0 border-l-2 border-dashed border-pen/50" />
          <div
            className={`absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 text-[30px] leading-none drop-shadow ${
              fighting ? 'animate-clash-bolt' : done ? 'opacity-0' : ''
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
      <div className="mt-1 flex justify-between gap-2 whitespace-nowrap text-[12px]">
        <span className="text-up" data-testid="clash-buy">
          매수파 {buyers.length}명{drafted(buyNames)} · 무게 {buy}
        </span>
        <span className="text-right text-down" data-testid="clash-sell">
          매도파 {sellers.length}명{drafted(sellNames)} · 무게 {sell}
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
