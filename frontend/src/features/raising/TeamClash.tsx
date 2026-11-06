import { type CSSProperties, useEffect, useState } from 'react'
import type { Company } from '../../api/client'
import { withParticle } from '../game/labels'
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

/** 토론하는 가장 짧은 시간(ms) (decisions.md 279·284·295번). */
const CLASH_MS = 2900
/**
 * 말 한 줄이 머무는 시간(ms) (285·303번): 읽을 만큼. 글자 수에 따라 길어진다(기본 1.2초 + 글자마다 45ms, 1.6~4초). 전에는 길이와 상관없이 1초라
 * 읽기 전에 지나갔다. 결판의 박자(표결·선언·승복)도 같은 셈이다.
 */
export function lineMs(text: string): number {
  return Math.max(1600, Math.min(4000, 1200 + text.length * 45))
}
/** 원탁 한쪽에 앉히는 사람 수. 넘치면 "외 N명". */
const SEATS = 4

export type DebateLine = {
  name: string
  side: 'BUY' | 'SELL'
  text: string
  last: boolean
  /** 결판의 박자 (295번). 옛 회의는 없다. */
  kind?: 'TALK' | 'TALLY' | 'WIN' | 'LOSE'
}

/** 토론 시간: 결판 전 말이 저마다 머무는 시간을 다 더한 만큼, 짧아도 CLASH_MS. */
export function clashMs(debate: DebateLine[]): number {
  const talk = debate.filter((d) => !d.last).reduce((sum, d) => sum + lineMs(d.text), 0)
  return Math.max(CLASH_MS, talk)
}

/** 결판의 박자(표결·선언·승복). 옛 회의는 둘. */
function finale(debate: DebateLine[]): DebateLine[] {
  return debate.filter((d) => d.last)
}

/**
 * 토론 한 줄마다 떠오르는 때(ms). 결판 전 말은 앞말이 머문 만큼 뒤에, 결판의 박자(표결 → 선언 → 승복)는 토론이 끝난 뒤 역시 앞 박자가 머문 만큼 뒤에.
 */
export function debateTimes(debate: DebateLine[]): number[] {
  const clash = clashMs(debate)
  let talkAt = 0
  let finaleAt = clash
  return debate.map((d) => {
    if (d.last) {
      const at = finaleAt
      finaleAt += lineMs(d.text)
      return at
    }
    const at = talkAt
    talkAt += lineMs(d.text)
    return at
  })
}

/** 결판이 다 난 때(ms): 마지막 박자가 뜰 때. 박자가 없으면 토론이 끝난 때. */
export function doneAt(debate: DebateLine[]): number {
  const times = debateTimes(debate)
  const beats = finale(debate)
  return beats.length === 0 ? clashMs(debate) : times[times.length - 1]
}

/** 투자 회의 연출이 이만큼 늦게 시작한다: 결판이 다 나고, 마지막 말을 읽을 만큼 더 머문 뒤. */
export function teamClashMs(debate: DebateLine[]): number {
  const beats = finale(debate)
  const stay = beats.length === 0 ? 800 : lineMs(beats[beats.length - 1].text)
  return doneAt(debate) + stay
}

/** 회의실에서 매수파가 차지하는 몫(%, 왼쪽) (286번): 양쪽 사람 수의 비율. 한 사람뿐인 쪽도 앉을 자리가 있게 22~78%로 자른다. */
export function roomShare(buyers: number, sellers: number): number {
  if (buyers + sellers === 0) {
    return 50
  }
  return Math.max(22, Math.min(78, Math.round((100 * buyers) / (buyers + sellers))))
}

/**
 * 원탁에 앉는 사람 (decisions.md 295번): 토론에서 말한 사람(팀장, 그쪽에 팀장이 없으면 안목 1위, 비었으면 끌려 나온 사람)만. 말한 순서대로.
 */
export function sidePeople(names: string[], side: 'BUY' | 'SELL', debate: DebateLine[]): string[] {
  const spoke = [...new Set(debate.filter((d) => d.side === side).map((d) => d.name))]
  if (spoke.length > 0) {
    return spoke
  }
  return names
}

/** 토론 중 말 한마디가 저울을 미는 폭(%p)과, 토론 중 저울이 머무는 범위. */
const NUDGE = 4
const NUDGE_MIN = 36
const NUDGE_MAX = 64
/** 결판이 나면 이긴 쪽이 적어도 이만큼은 차지한다(%). */
const WIN_MIN = 68
const WIN_MAX = 88

/**
 * 토론 중 저울의 매수 쪽 눈금(%) (decisions.md 291번): 반반에서 시작해 말 한마디마다 말한 쪽으로 조금씩 기운다. 결판의 박자는 세지 않는다. 크게 기울지는
 * 않는다: 승패는 서버가 무게로 정했고 표결 때 드러난다.
 */
export function gaugeDuring(debate: DebateLine[], said: number): number {
  let at = 50
  for (const d of debate.slice(0, said)) {
    if (d.last) {
      continue
    }
    at = Math.max(NUDGE_MIN, Math.min(NUDGE_MAX, at + (d.side === 'BUY' ? NUDGE : -NUDGE)))
  }
  return at
}

/**
 * 표결 뒤 저울의 매수 쪽 눈금(%): 양쪽 무게(직원 안목, 279번)의 비율대로, 다만 이긴 쪽이 68~88%를 차지한다. 무게가 둘 다 없으면 이긴 쪽 70%.
 */
export function gaugeDone(buy: number, sell: number, buyWins: boolean): number {
  const total = buy + sell
  const winner = total === 0 ? 70 : Math.round((100 * (buyWins ? buy : sell)) / total)
  const share = Math.max(WIN_MIN, Math.min(WIN_MAX, winner))
  return buyWins ? share : 100 - share
}

/** 원탁 둘레의 자리(%): 왼쪽 반원은 매수파, 오른쪽 반원은 매도파. 윗줄에 앉고 아랫줄은 말풍선 자리로 비워 둔다. 탁자 가까운 자리부터. */
const LEFT_SEATS: { x: number; y: number }[] = [
  { x: 16, y: 14 },
  { x: 2, y: 40 },
  { x: 30, y: 40 },
  { x: 2, y: 4 },
]
const seatAt = (side: 'BUY' | 'SELL', i: number): CSSProperties => {
  const s = LEFT_SEATS[Math.min(i, LEFT_SEATS.length - 1)]
  return side === 'BUY' ? { left: `${s.x}%`, top: `${s.y}%` } : { right: `${s.x}%`, top: `${s.y}%` }
}

/**
 * "너희가 알아서 해" (decisions.md 279·285·295번). 사장이 맡기면 팀장들이 원탁에 둘러앉는다: 왼쪽 반원이 매수파, 오른쪽이 매도파. 말하는 사람이
 * 일어서고 그 사람 머리 위에 말풍선이 뜬다(아래 대화 기록은 접어 둔다). 위 저울은 말마다 조금씩 기울고, 사회가 표결을 부르면 무게대로 쭉 기운다. 이긴 쪽이
 * 선언하면 그쪽에 "매수"·"매도" 도장이 찍히고, 진 쪽이 토를 달고 물러나면 끝난다. 승패는 서버가 정한 그대로다. 움직임 줄이기·빨리 보기면 끝난 모습만.
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
  const finish = doneAt(debate)
  const [phase, setPhase] = useState<'clash' | 'push' | 'done'>(instant ? 'done' : 'clash')
  const [said, setSaid] = useState(instant ? debate.length : 0)
  // 띄울 때를 처음 그릴 때 굳힌다: 회사 상태를 다시 받아 배열이 새로 와도 토론이 처음부터 다시 돌지 않게.
  const [times] = useState(() => debateTimes(debate))
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
    timers.push(setTimeout(() => setPhase('done'), finish))
    return () => timers.forEach(clearTimeout)
  }, [instant, times, clash, finish])
  const done = phase === 'done'
  const buyers = sidePeople(buyNames, 'BUY', debate)
  const sellers = sidePeople(sellNames, 'SELL', debate)
  const buyOthers = Math.max(0, buyNames.length - buyers.filter((n) => buyNames.includes(n)).length)
  const sellOthers = Math.max(
    0,
    sellNames.length - sellers.filter((n) => sellNames.includes(n)).length,
  )
  // 지금 말하는 사람과 그 말. 끝난 뒤에는 아무도 일어나 있지 않다.
  const current = said > 0 && !done ? debate[said - 1] : null
  const kindOf = (d: DebateLine) => d.kind ?? (d.last ? 'WIN' : 'TALK')
  const tallied = debate.slice(0, said).some((d) => kindOf(d) === 'TALLY') || phase !== 'clash'
  const declared = debate.slice(0, said).some((d) => kindOf(d) === 'WIN') || done
  const gauge = tallied ? gaugeDone(buy, sell, buyWins) : gaugeDuring(debate, said)
  const status = done
    ? '결판이 났다'
    : declared
      ? `${buyWins ? '매수' : '매도'}로 정했다`
      : tallied
        ? '표결한다…'
        : current
          ? `${withParticle(current.name, '이', '가')} 말한다`
          : '팀장들이 원탁에 모였다'
  // 회의에 온 직원은 사무실 미니맵과 같은 캐릭터로, 끌려 나온 옆자리 사람은 손님 캐릭터로 그린다.
  const staffOf = (name: string) => staff.find((e) => e.name === name)
  const seat = (side: 'BUY' | 'SELL', people: string[]) => {
    const buySide = side === 'BUY'
    const wins = buySide === buyWins
    const shown = people.slice(0, SEATS)
    const others = people.length - shown.length + (buySide ? buyOthers : sellOthers)
    return (
      <div
        className="absolute inset-0"
        data-testid={buySide ? 'room-buy' : 'room-sell'}
        data-seats={people.length}
      >
        {shown.map((name, i) => {
          const up = current?.name === name && current.side === side
          return (
            <div
              key={name}
              className={`absolute flex w-12 -translate-x-1/2 flex-col items-center transition-all duration-300 ease-out ${
                buySide ? '' : 'translate-x-1/2'
              } ${up ? 'z-10 -translate-y-1.5' : ''} ${done && !wins ? 'opacity-45 grayscale' : ''} ${
                done && wins ? 'animate-clash-win' : ''
              }`}
              style={{
                ...seatAt(side, i),
                animationDelay: `${(name.length * 97) % 360}ms`,
                marginLeft: buySide ? 24 : 0,
                marginRight: buySide ? 0 : 24,
              }}
              data-testid="room-seat"
              data-talking={up}
            >
              <span
                className={`block origin-bottom transition-transform duration-300 ease-out ${up ? 'scale-115' : ''}`}
              >
                <Character
                  employee={staffOf(name)}
                  look={name.length}
                  side={side}
                  mood={done ? (wins ? 'joy' : 'despair') : up ? 'confident' : null}
                  talking={up}
                  fallback={done ? (wins ? '🙌' : '😩') : name.slice(0, 1)}
                />
              </span>
              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${up ? 'font-bold' : ''}`}
              >
                {staffOf(name)?.leader && <span className="text-gold">★</span>}
                {name}
              </span>
            </div>
          )
        })}
        {others > 0 && (
          <span
            className={`absolute top-1 text-[11px] text-muted ${buySide ? 'left-2' : 'right-2'}`}
          >
            외 {others}명
          </span>
        )}
      </div>
    )
  }
  // 말풍선: 말하는 사람의 자리 옆에. 매수파는 오른쪽으로, 매도파는 왼쪽으로 꼬리를 낸다.
  const bubble = (() => {
    if (!current) {
      return null
    }
    const people = current.side === 'BUY' ? buyers : sellers
    const i = Math.min(Math.max(0, people.indexOf(current.name)), LEFT_SEATS.length - 1)
    const s = LEFT_SEATS[i]
    const buySide = current.side === 'BUY'
    return (
      <div
        key={said}
        className={`animate-pop absolute bottom-2 z-20 max-w-[80%] rounded-lg border-2 bg-card px-2 py-1 text-[12.5px] leading-snug shadow ${
          buySide ? 'left-2 rounded-tl-none border-up' : 'right-2 rounded-tr-none border-down'
        }`}
        data-testid="room-bubble"
        data-kind={kindOf(current)}
        data-seat={s.x}
      >
        <b className={`block text-[11px] ${buySide ? 'text-up' : 'text-down'}`}>{current.name}</b>
        {current.text}
      </div>
    )
  })()
  return (
    <section
      className="mt-2 overflow-hidden rounded border-2 border-pen bg-card p-2"
      data-testid="team-clash"
      data-phase={phase}
      aria-label="팀장들이 원탁에서 토론한다"
    >
      <p className="text-center text-[13px] font-semibold">
        “너희가 알아서 해” — <span className="text-red-pen">{status}</span>
      </p>
      {/* 저울 (291번): 매수(빨강)와 매도(파랑)가 나눠 차지한다. 말마다 조금씩, 표결이 나면 무게대로 쭉 기운다. */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] font-bold">
        <span className={`text-up ${done && !buyWins ? 'opacity-40' : ''}`}>매수파</span>
        <div
          className="relative h-3 flex-1 overflow-hidden rounded-full bg-down/80"
          role="img"
          aria-label={`매수파와 매도파의 저울: 매수 ${gauge}%`}
          data-testid="clash-gauge"
          data-gauge={gauge}
        >
          <div
            className="h-full rounded-l-full bg-up/90 transition-[width] duration-700 ease-in-out"
            style={{ width: `${gauge}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-card transition-[left] duration-700 ease-in-out"
            style={{ left: `calc(${gauge}% - 1px)` }}
          />
        </div>
        <span className={`text-down ${done && buyWins ? 'opacity-40' : ''}`}>매도파</span>
      </div>
      {/* 원탁 (295번): 왼쪽 반원은 매수파, 오른쪽 반원은 매도파. 팀장만 앉는다. */}
      <div
        className="relative mt-1.5 h-[212px] overflow-hidden rounded border border-line bg-paper"
        data-testid="meeting-room"
        role="img"
        aria-label={`원탁: 매수파 ${buyers.length}명, 매도파 ${sellers.length}명`}
      >
        <div
          className="absolute left-1/2 top-[46%] h-[84px] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-pen/30 bg-desk shadow-[inset_0_6px_0_rgba(0,0,0,0.08)]"
          aria-hidden="true"
        >
          <span className="absolute left-[14%] top-1/2 -translate-y-1/2 font-pen text-[20px] text-up opacity-55">
            매수
          </span>
          <span className="absolute right-[14%] top-1/2 -translate-y-1/2 font-pen text-[20px] text-down opacity-55">
            매도
          </span>
        </div>
        {seat('BUY', buyers)}
        {seat('SELL', sellers)}
        {bubble}
        {declared && (
          // 선언 도장: 이긴 쪽 반원 위에 찍힌다.
          <span
            className={`animate-stamp pen-circle absolute top-1 z-10 px-3 py-0.5 font-pen text-[24px] leading-tight ${
              buyWins ? 'left-[30%] text-up' : 'right-[30%] text-down'
            }`}
            data-testid="clash-stamp"
            aria-hidden="true"
          >
            {buyWins ? '매수' : '매도'}
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-between gap-2 whitespace-nowrap text-[12px]">
        <span className="text-up" data-testid="clash-buy">
          매수파 {buyNames.length || buyers.length}명 · 무게 {buy}
        </span>
        <span className="text-right text-down" data-testid="clash-sell">
          매도파 {sellNames.length || sellers.length}명 · 무게 {sell}
        </span>
      </div>
      {debate.length > 0 && (
        <details className="mt-1" open>
          <summary className="cursor-pointer text-[12px] text-muted">토론 기록</summary>
          <ol
            className="mt-1 max-h-52 space-y-1.5 overflow-y-auto rounded bg-paper/60 p-1.5"
            data-testid="clash-debate"
            aria-label="토론 기록"
          >
            {debate.slice(0, said).map((d, i) => {
              const buySide = d.side === 'BUY'
              const kind = kindOf(d)
              return (
                <li
                  // 토론은 정해진 순서대로만 늘어난다.
                  // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 곧 자리다
                  key={i}
                  className={`flex ${buySide ? 'justify-start' : 'justify-end'}`}
                  data-testid="debate-line"
                  data-side={d.side}
                  data-kind={kind}
                >
                  <div
                    className={`max-w-[82%] rounded-lg border px-2 py-1 text-[12.5px] leading-snug ${
                      buySide
                        ? 'rounded-bl-none border-up bg-up/10'
                        : 'rounded-br-none border-down bg-down/10'
                    } ${kind === 'WIN' ? 'font-bold' : ''} ${kind === 'LOSE' ? 'italic opacity-80' : ''}`}
                  >
                    <span
                      className={`block text-[11px] font-semibold ${buySide ? 'text-up' : 'text-right text-down'}`}
                    >
                      {kind === 'TALLY' ? `${d.name} (사회)` : d.name}
                    </span>
                    {d.text}
                  </div>
                </li>
              )
            })}
          </ol>
        </details>
      )}
      {done && (
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
