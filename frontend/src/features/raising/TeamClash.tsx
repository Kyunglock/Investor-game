import { useEffect, useState } from 'react'
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

/** 토론하는 가장 짧은 시간, 결판 한 박자(표결·선언·승복)의 간격(ms) (decisions.md 279·284·295번). */
const CLASH_MS = 2900
const PUSH_MS = 800
/** 토론 한 줄이 떠오르는 간격(ms) (285번). */
export const DEBATE_LINE_MS = 1000

export type DebateLine = {
  name: string
  side: 'BUY' | 'SELL'
  text: string
  last: boolean
  /** 결판의 박자 (295번). 옛 회의는 없다. */
  kind?: 'TALK' | 'TALLY' | 'WIN' | 'LOSE'
}

/** 토론 시간: 결판 전 말이 다 오갈 때까지, 짧아도 CLASH_MS. */
export function clashMs(debate: DebateLine[]): number {
  return Math.max(CLASH_MS, debate.filter((d) => !d.last).length * DEBATE_LINE_MS)
}

/** 결판의 박자 수: 표결·선언·승복 (옛 회의는 둘). */
function finaleCount(debate: DebateLine[]): number {
  return debate.filter((d) => d.last).length
}

/** 투자 회의 연출이 이만큼 늦게 시작한다: 토론하고, 결판 세 박자가 지나고, 한 박자 더 머문 뒤. */
export function teamClashMs(debate: DebateLine[]): number {
  const finale = finaleCount(debate)
  return clashMs(debate) + PUSH_MS * Math.max(1, finale) + (finale > 0 ? DEBATE_LINE_MS : 0)
}

/**
 * 토론 한 줄마다 떠오르는 때(ms). 결판 전 말은 DEBATE_LINE_MS 간격으로, 결판의 박자(표결 → 선언 → 승복)는 토론이 끝난 뒤 PUSH_MS 간격으로.
 */
export function debateTimes(debate: DebateLine[]): number[] {
  const clash = clashMs(debate)
  let finale = 0
  let talk = 0
  return debate.map((d) => (d.last ? clash + PUSH_MS * finale++ : DEBATE_LINE_MS * talk++))
}

/** 결판이 다 난 때(ms): 마지막 박자가 뜰 때. */
export function doneAt(debate: DebateLine[]): number {
  return clashMs(debate) + PUSH_MS * Math.max(1, finaleCount(debate) - 1)
}

/** 회의실에서 매수파가 차지하는 몫(%, 왼쪽) (286번): 양쪽 사람 수의 비율. 한 사람뿐인 쪽도 앉을 자리가 있게 22~78%로 자른다. */
export function roomShare(buyers: number, sellers: number): number {
  if (buyers + sellers === 0) {
    return 50
  }
  return Math.max(22, Math.min(78, Math.round((100 * buyers) / (buyers + sellers))))
}

/**
 * 줄을 잡는 사람 (decisions.md 295번): 토론에서 말한 사람(팀장, 그쪽에 팀장이 없으면 안목 1위, 비었으면 끌려 나온 사람)이 맨 앞에서 잡고, 그 뒤로 그쪽
 * 의견을 낸 나머지 직원이 붙는다.
 */
export function sidePeople(names: string[], side: 'BUY' | 'SELL', debate: DebateLine[]): string[] {
  const spoke = [...new Set(debate.filter((d) => d.side === side).map((d) => d.name))]
  return [...spoke, ...names.filter((n) => !spoke.includes(n))]
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

/** 한쪽에 줄을 잡는 사람 수. 넘치면 "+N". */
const PULLERS = 3

/** 깃발의 자리(%): 매수파가 왼쪽에서 당기므로 매수 쪽 눈금이 클수록 왼쪽으로 간다. */
export function flagAt(gauge: number): number {
  return 100 - gauge
}

/**
 * "너희가 알아서 해" (decisions.md 279·285·295번). 사장이 맡기면 매수파(왼쪽)와 매도파(오른쪽)가 밧줄을 잡고 줄다리기를 한다: 팀장이 맨 앞에서 잡고
 * 팀원이 뒤에 붙는다. 한마디 할 때마다 말한 쪽이 "영차" 하고 기울며 가운데 깃발이 그쪽으로 끌려간다. 말은 위 띠에 말풍선으로 뜬다. 사회가 표결을 부르면 깃발이
 * 무게대로 쭉 끌려가고, 이긴 쪽이 선언하면 도장이 찍히고, 진 쪽이 물러나면 넘어진다. 승패는 서버가 정한 그대로다. 움직임 줄이기·빨리 보기면 끝난 모습만.
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
  // 지금 말하는 사람과 그 말. 끝난 뒤에는 아무도 당기지 않는다.
  const current = said > 0 && !done ? debate[said - 1] : null
  const kindOf = (d: DebateLine) => d.kind ?? (d.last ? 'WIN' : 'TALK')
  const tallied = debate.slice(0, said).some((d) => kindOf(d) === 'TALLY') || phase !== 'clash'
  const declared = debate.slice(0, said).some((d) => kindOf(d) === 'WIN') || done
  const gauge = tallied ? gaugeDone(buy, sell, buyWins) : gaugeDuring(debate, said)
  const flag = flagAt(gauge)
  const pulling = current && kindOf(current) === 'TALK' ? current.side : null
  const status = done
    ? '결판이 났다'
    : declared
      ? `${buyWins ? '매수' : '매도'}로 정했다`
      : tallied
        ? '영차! 표결한다…'
        : current
          ? `${withParticle(current.name, '이', '가')} 당긴다`
          : '밧줄을 잡았다'
  // 회의에 온 직원은 사무실 미니맵과 같은 캐릭터로, 끌려 나온 옆자리 사람은 손님 캐릭터로 그린다.
  const staffOf = (name: string) => staff.find((e) => e.name === name)
  const team = (side: 'BUY' | 'SELL', people: string[]) => {
    const buySide = side === 'BUY'
    const wins = buySide === buyWins
    const shown = people.slice(0, PULLERS)
    const others = people.length - shown.length
    const pull = pulling === side
    return (
      <div
        className={`absolute bottom-[14px] flex items-end gap-0.5 transition-transform duration-500 ease-in-out ${
          buySide ? 'left-[4%] flex-row-reverse' : 'right-[4%] flex-row'
        }`}
        style={{
          // 표결이 나면 이긴 쪽으로 줄 전체가 끌려간다.
          transform: tallied ? `translateX(${buyWins ? -18 : 18}px)` : undefined,
        }}
        data-testid={buySide ? 'room-buy' : 'room-sell'}
        data-seats={people.length}
      >
        {others > 0 && <span className="self-center px-0.5 text-[11px] text-muted">+{others}</span>}
        {shown.map((name, i) => {
          const speaking = current?.name === name && current.side === side
          const lean = done
            ? !wins
              ? buySide
                ? 'rotate(70deg) translateY(8px)'
                : 'rotate(-70deg) translateY(8px)'
              : undefined
            : pull
              ? buySide
                ? 'rotate(-14deg)'
                : 'rotate(14deg)'
              : undefined
          return (
            <div
              key={name}
              className={`flex w-[52px] flex-col items-center transition-all duration-300 ease-out ${
                i > 0 ? 'scale-90 opacity-90' : ''
              } ${done && !wins ? 'opacity-45 grayscale' : ''} ${done && wins ? 'animate-clash-win' : ''}`}
              style={{
                transform: lean,
                transformOrigin: 'bottom center',
                animationDelay: `${i * 120}ms`,
              }}
              data-testid="room-seat"
              data-talking={speaking}
            >
              <Character
                employee={staffOf(name)}
                look={name.length}
                side={side}
                mood={done ? (wins ? 'joy' : 'despair') : speaking || pull ? 'confident' : null}
                talking={speaking}
                fallback={done ? (wins ? '🙌' : '😩') : name.slice(0, 1)}
              />
              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${speaking ? 'font-bold' : ''}`}
              >
                {staffOf(name)?.leader && <span className="text-gold">★</span>}
                {name}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
  const bubble = current && (
    <div
      key={said}
      className={`animate-pop absolute top-2 z-20 max-w-[78%] rounded-lg border-2 bg-card px-2 py-1 text-[12.5px] leading-snug shadow ${
        current.side === 'BUY'
          ? 'left-2 rounded-bl-none border-up'
          : 'right-2 rounded-br-none border-down'
      }`}
      data-testid="room-bubble"
      data-kind={kindOf(current)}
    >
      <b className={`block text-[11px] ${current.side === 'BUY' ? 'text-up' : 'text-down'}`}>
        {kindOf(current) === 'TALLY' ? `${current.name} (사회)` : current.name}
      </b>
      {current.text}
    </div>
  )
  return (
    <section
      className="mt-2 overflow-hidden rounded border-2 border-pen bg-card p-2"
      data-testid="team-clash"
      data-phase={phase}
      aria-label="매수파와 매도파가 줄다리기를 한다"
    >
      <p className="text-center text-[13px] font-semibold">
        “너희가 알아서 해” — <span className="text-red-pen">{status}</span>
      </p>
      {/* 줄다리기 (295번): 매수파는 왼쪽, 매도파는 오른쪽. 깃발이 말한 쪽으로 끌려가고 표결 때 무게대로 쭉 간다. */}
      <div
        className="relative mt-1.5 h-[212px] overflow-hidden rounded border border-line bg-paper"
        data-testid="meeting-room"
        role="img"
        aria-label={`줄다리기: 매수파 ${buyers.length}명, 매도파 ${sellers.length}명, 깃발은 매수 쪽 ${gauge}%`}
      >
        {bubble}
        <div className="absolute right-0 bottom-[14px] left-0 h-[3px] bg-line" aria-hidden="true" />
        <div
          className="absolute bottom-[14px] left-1/2 h-[64px] border-l-2 border-dashed border-muted/60"
          aria-hidden="true"
        />
        <div
          className="absolute right-[6%] bottom-[58px] left-[6%] h-[4px] rounded bg-[#9c7b52]"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-[56px] h-[20px] w-[16px] -translate-x-1/2 bg-gold transition-[left] duration-700 ease-in-out"
          style={{ left: `${flag}%`, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}
          data-testid="clash-flag"
          data-gauge={gauge}
          aria-hidden="true"
        />
        {team('BUY', buyers)}
        {team('SELL', sellers)}
        {declared && (
          // 선언 도장: 이긴 쪽 위에 찍힌다.
          <span
            className={`animate-stamp pen-circle absolute top-[38%] z-10 px-3 py-0.5 font-pen text-[24px] leading-tight ${
              buyWins ? 'left-[12%] text-up' : 'right-[12%] text-down'
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
          매수파 {buyers.length}명 · 무게 {buy}
        </span>
        <span className="text-right text-down" data-testid="clash-sell">
          매도파 {sellers.length}명 · 무게 {sell}
        </span>
      </div>
      {debate.length > 0 && (
        <details className="mt-1">
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
