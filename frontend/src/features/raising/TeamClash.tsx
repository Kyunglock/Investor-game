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
 * 밀어내기 장면의 사람 하나 (286·304번). 직원은 사무실 미니맵(237번)과 같은 모습(성별·차림새는 종합 등급)이고, 끌려 나온 옆자리 사람은 손님 모습이다. 표정: 말할
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
/** 한쪽에 세우는 사람 수. 넘치면 "외 N명". */
const SEATS = 3

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

/**
 * 한쪽에 서는 사람 (decisions.md 295번): 토론에서 말한 사람(팀장, 그쪽에 팀장이 없으면 안목 1위, 비었으면 끌려 나온 사람)만. 말한 순서대로.
 */
export function sidePeople(names: string[], side: 'BUY' | 'SELL', debate: DebateLine[]): string[] {
  const spoke = [...new Set(debate.filter((d) => d.side === side).map((d) => d.name))]
  if (spoke.length > 0) {
    return spoke
  }
  return names
}

/** 토론 중 말 한마디가 경계를 밀어내는 폭(%p)과, 토론 중 경계가 머무는 범위 (304번: 말이 적은 대신 한마디가 세게 민다). */
const NUDGE = 12
const NUDGE_MIN = 22
const NUDGE_MAX = 78
/** 결판이 나면 이긴 쪽이 적어도 이만큼은 차지한다(%). */
const WIN_MIN = 68
const WIN_MAX = 88

/**
 * 토론 중 막대의 매수 쪽 눈금(%) (decisions.md 291·304번): 반반에서 시작해 말 한마디마다 말한 쪽이 반대쪽을 12%p 밀어낸다. 결판의 박자는 세지 않는다.
 * 승패는 서버가 무게로 정했고 표결 때 드러난다.
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
 * 표결 뒤 막대의 매수 쪽 눈금(%): 양쪽 무게(직원 안목, 279번)의 비율대로, 다만 이긴 쪽이 68~88%를 차지한다. 무게가 둘 다 없으면 이긴 쪽 70%.
 */
export function gaugeDone(buy: number, sell: number, buyWins: boolean): number {
  const total = buy + sell
  const winner = total === 0 ? 70 : Math.round((100 * (buyWins ? buy : sell)) / total)
  const share = Math.max(WIN_MIN, Math.min(WIN_MAX, winner))
  return buyWins ? share : 100 - share
}

/** 번개 한 가닥: 위에서 아래로 좌우로 꺾이며 내려오는 점들. */
function bolt(rand: () => number, spread: number, h: number): string {
  const steps = 7
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const y = (h * i) / steps
    const x = i === 0 || i === steps ? 0 : (rand() - 0.5) * 2 * spread
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

/**
 * 경계의 전기 (304번): 막대 경계를 따라 번개가 위아래로 튀고, 말이 꽂힐 때(surge) 더 굵고 넓게 튀며 가지가 뻗는다. 90ms마다(꽂힐 때는 45ms) 모양을 새로
 * 그린다. 그림이 멈춰 있으면(still) 한 번만 그린다.
 */
function Lightning({ surge, still, tone }: { surge: boolean; still: boolean; tone: string }) {
  const [seed, setSeed] = useState(1)
  useEffect(() => {
    if (still) {
      return
    }
    const id = setInterval(() => setSeed((s) => (s * 16807) % 2147483647 || 1), surge ? 45 : 90)
    return () => clearInterval(id)
  }, [still, surge])
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const h = 40
  const spread = surge ? 9 : 4
  const main = bolt(rand, spread, h)
  const branches = surge ? 3 : 1
  return (
    <svg
      viewBox="-20 0 40 40"
      className="pointer-events-none absolute top-0 left-1/2 h-full w-10 -translate-x-1/2 overflow-visible drop-shadow-[0_0_3px_#fff]"
      aria-hidden="true"
      data-testid="clash-bolt"
      data-surge={surge}
    >
      <polyline
        points={main}
        fill="none"
        stroke={tone}
        strokeWidth={surge ? 5 : 3}
        strokeLinejoin="round"
        opacity={0.35}
      />
      <polyline
        points={main}
        fill="none"
        stroke="#fffbe6"
        strokeWidth={surge ? 2.4 : 1.6}
        strokeLinejoin="round"
      />
      {Array.from({ length: branches }, (_, i) => {
        const y0 = 8 + rand() * 24
        const dir = rand() < 0.5 ? -1 : 1
        const len = 6 + rand() * (surge ? 14 : 6)
        const d = `M0,${y0.toFixed(1)} l${(dir * len * 0.5).toFixed(1)},${(rand() * 6 - 3).toFixed(1)} l${(dir * len * 0.5).toFixed(1)},${(rand() * 8 - 4).toFixed(1)}`
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 가지는 매번 새로 그린다
          <path key={i} d={d} fill="none" stroke="#fff" strokeWidth={1} opacity={0.85} />
        )
      })}
    </svg>
  )
}

/**
 * "너희가 알아서 해" (decisions.md 279·285·304번). 사장이 맡기면 매수파(왼쪽)와 매도파(오른쪽)가 한가운데 막대를 두고 맞선다. 말 한마디가 꽂힐 때마다 그쪽이
 * 반대쪽을 쿵 밀어내고(튕기며 넘어갔다 돌아온다), 경계에서 번개가 튀고 불꽃이 흩어진다. 사회가 표결을 부르면 무게대로 쭉 밀리고, 이긴 쪽이 선언하면 그쪽에
 * "매수"·"매도" 도장이 찍히고, 진 쪽이 토를 달고 물러나면 끝난다. 승패는 서버가 정한 그대로다. 움직임 줄이기·빨리 보기면 끝난 모습만.
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
  // 말이 꽂힌 직후 0.65초: 번개가 굵어지고 불꽃이 튀고 막대가 흔들린다.
  const [surge, setSurge] = useState(false)
  useEffect(() => {
    if (instant || said === 0) {
      return
    }
    setSurge(true)
    const id = setTimeout(() => setSurge(false), 650)
    return () => clearTimeout(id)
  }, [instant, said])
  const done = phase === 'done'
  const buyers = sidePeople(buyNames, 'BUY', debate)
  const sellers = sidePeople(sellNames, 'SELL', debate)
  const buyOthers = Math.max(0, buyNames.length - buyers.filter((n) => buyNames.includes(n)).length)
  const sellOthers = Math.max(
    0,
    sellNames.length - sellers.filter((n) => sellNames.includes(n)).length,
  )
  // 지금 말하는 사람과 그 말. 끝난 뒤에는 아무도 나서 있지 않다.
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
          ? `${withParticle(current.name, '이', '가')} 밀어붙인다`
          : '매수파와 매도파가 맞섰다'
  const pushedBy = current && !current.last ? current.side : null
  const staffOf = (name: string) => staff.find((e) => e.name === name)
  const crowd = (side: 'BUY' | 'SELL', people: string[]) => {
    const buySide = side === 'BUY'
    const wins = buySide === buyWins
    const shown = people.slice(0, SEATS)
    const others = people.length - shown.length + (buySide ? buyOthers : sellOthers)
    return (
      <div
        className={`flex min-w-0 flex-1 items-end gap-1 ${buySide ? 'justify-start' : 'flex-row-reverse'}`}
        data-testid={buySide ? 'side-buy' : 'side-sell'}
        data-people={people.length}
      >
        {shown.map((name) => {
          const up = current?.name === name && current.side === side
          return (
            <div
              key={name}
              className={`flex w-12 flex-col items-center transition-transform duration-300 ease-out ${
                up ? `z-10 scale-115 ${buySide ? 'translate-x-2' : '-translate-x-2'}` : ''
              } ${done && !wins ? 'opacity-45 grayscale' : ''} ${done && wins ? 'animate-clash-win' : ''}`}
              style={{ animationDelay: `${(name.length * 97) % 360}ms` }}
              data-testid="speaker"
              data-talking={up}
            >
              <Character
                employee={staffOf(name)}
                look={name.length}
                side={side}
                mood={done ? (wins ? 'joy' : 'despair') : up ? 'confident' : null}
                talking={up}
                fallback={done ? (wins ? '🙌' : '😩') : name.slice(0, 1)}
              />
              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${up ? 'font-bold' : ''}`}
              >
                {staffOf(name)?.leader && <span className="text-gold">★</span>}
                {name}
              </span>
            </div>
          )
        })}
        {others > 0 && <span className="self-center text-[11px] text-muted">외 {others}명</span>}
      </div>
    )
  }
  const tone = pushedBy === 'BUY' ? 'var(--up)' : pushedBy === 'SELL' ? 'var(--down)' : '#ffd84d'
  return (
    <section
      className="mt-2 overflow-hidden rounded border-2 border-pen bg-card p-2"
      data-testid="team-clash"
      data-phase={phase}
      aria-label="매수파와 매도파가 막대를 밀어내며 맞선다"
    >
      <p className="text-center text-[13px] font-semibold">
        “너희가 알아서 해” — <span className="text-red-pen">{status}</span>
      </p>
      {/* 밀어내기 (304번): 양쪽 사람이 막대를 사이에 두고 선다. 말이 꽂힐 때마다 경계가 반대쪽으로 쿵 밀린다. */}
      <div className="relative mt-1.5 rounded border border-line bg-paper px-2 pt-2 pb-1">
        <div className="flex items-end justify-between gap-2">
          {crowd('BUY', buyers)}
          {crowd('SELL', sellers)}
        </div>
        <div
          key={said}
          className={`relative mt-1 h-10 rounded-full bg-down/85 shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] ${
            surge && !instant ? 'animate-push-hit' : ''
          }`}
          role="img"
          aria-label={`매수파와 매도파의 막대: 매수 ${gauge}%`}
          data-testid="clash-gauge"
          data-gauge={gauge}
          data-pushed-by={pushedBy ?? undefined}
          style={{ '--push-dir': pushedBy === 'SELL' ? -1 : 1 } as CSSProperties}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-l-full bg-up/90 ${instant ? '' : 'push-fill'}`}
            style={{ width: `${gauge}%` }}
          />
          <span className="absolute inset-y-0 left-3 flex items-center font-pen text-[20px] text-white/90">
            매수 {gauge}%
          </span>
          <span className="absolute inset-y-0 right-3 flex items-center font-pen text-[20px] text-white/90">
            매도 {100 - gauge}%
          </span>
          {/* 경계의 전극: 번개가 튀고, 말이 꽂히면 불꽃이 흩어진다. */}
          <div
            className={`absolute top-[-6px] bottom-[-6px] w-1.5 -translate-x-1/2 rounded-full bg-white ${instant ? '' : 'push-fill-left'}`}
            style={{
              left: `${gauge}%`,
              boxShadow: `0 0 10px 2px ${tone}, 0 0 22px 4px ${tone}`,
            }}
            data-testid="clash-edge"
          >
            <Lightning surge={surge} still={instant || done} tone={tone} />
            {surge && !instant && (
              <span className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <i
                    // biome-ignore lint/suspicious/noArrayIndexKey: 불꽃은 자리만 다르다
                    key={i}
                    className="push-spark"
                    style={
                      {
                        '--a': `${(i * 36 + ((said * 53) % 36)).toFixed(0)}deg`,
                        '--d': `${26 + ((i * 17 + said * 7) % 22)}px`,
                        background: i % 3 === 0 ? '#fff' : tone,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            )}
          </div>
          {declared && (
            // 선언 도장: 이긴 쪽 막대 아래(말풍선 자리)에 찍힌다.
            <span
              className={`animate-stamp pen-circle absolute -bottom-14 z-10 px-3 py-0.5 font-pen text-[26px] leading-tight ${
                buyWins ? 'left-[10%] text-up' : 'right-[10%] text-down'
              }`}
              data-testid="clash-stamp"
              aria-hidden="true"
            >
              {buyWins ? '매수' : '매도'}
            </span>
          )}
        </div>
        {/* 지금 말: 말한 쪽에 붙은 큰 말풍선. */}
        <div className="mt-2 min-h-[64px]">
          {current && (
            <div
              key={said}
              className={`animate-debate-in max-w-[88%] rounded-lg border-2 bg-card px-2.5 py-1.5 text-[13px] leading-snug shadow ${
                current.side === 'BUY'
                  ? 'mr-auto rounded-tl-none border-up'
                  : 'ml-auto rounded-tr-none border-down'
              }`}
              data-testid="clash-bubble"
              data-kind={kindOf(current)}
            >
              <b
                className={`block text-[11px] ${current.side === 'BUY' ? 'text-up' : 'text-right text-down'}`}
              >
                {kindOf(current) === 'TALLY' ? `${current.name} (사회)` : current.name}
              </b>
              {current.text}
            </div>
          )}
        </div>
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
