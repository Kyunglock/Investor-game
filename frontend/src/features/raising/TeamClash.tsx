import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { Company } from '../../api/client'
import { CatSprite } from '../game/cat/CatSprite'
import { customerLook, employeeLook } from '../game/cat/look'
import { withParticle } from '../game/labels'
import type { MoodKey } from '../game/moods'

type Employee = Company['employees'][number]

/** 회의실 캐릭터 너비(px). */
const CHARACTER_PX = 40

/**
 * 밀어내기 장면의 고양이 하나 (286·304·341번). 직원은 사무실 미니맵(237번)과 같은 모습(품종은 번호, 차림새는 종합 등급)이고, 끌려 나온 옆자리는 손님 고양이다. 표정: 말할
 * 때 결의, 이기면 기쁨, 지면 절망.
 */
function Character({
  employee,
  look,
  side,
  mood,
  talking,
  fallback,
  size = CHARACTER_PX,
}: {
  employee: Employee | undefined
  look: number
  side: 'BUY' | 'SELL'
  mood: MoodKey | null
  talking: boolean
  fallback: string
  /** 그림 너비(px). 단톡방 프로필은 작게. */
  size?: number
}) {
  const look_ = employee
    ? employeeLook(employee.id, employee.overallGrade, mood)
    : customerLook(look, mood)
  return (
    <span
      className={`relative block drop-shadow ${talking ? 'drop-shadow-[0_0_4px_var(--gold)]' : ''}`}
      style={{ width: size }}
      data-testid="room-character"
      aria-hidden="true"
    >
      <span
        className="absolute bottom-[3%] left-1/2 block -translate-x-1/2 rounded-full"
        style={{
          width: size * 0.62,
          height: size * 0.11,
          background: side === 'BUY' ? 'var(--up)' : 'var(--down)',
          opacity: 0.35,
        }}
      />
      <CatSprite
        look={look_}
        width={size}
        className="relative"
        title={employee?.name ?? fallback}
      />
    </span>
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
/** 단톡방에서 다음 말이 뜨기 전 "입력 중…"이 보이는 시간(ms) (305번). */
const TYPING_MS = 700

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
 * 종목 회의 토론 (decisions.md 279·285·304·352번). 회의를 열면 매수파(왼쪽)와 매도파(오른쪽)가 한가운데 막대를 두고 맞선다. 말 한마디가 꽂힐 때마다 그쪽이
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
  stock,
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
  /** 단톡방 이름에 붙는 종목 이름 (305번). */
  stock?: string
}) {
  const buyWins = choice === 'BUY'
  const clash = clashMs(debate)
  const finish = doneAt(debate)
  const [phase, setPhase] = useState<'clash' | 'push' | 'done'>(instant ? 'done' : 'clash')
  const [said, setSaid] = useState(instant ? debate.length : 0)
  // 띄울 때를 처음 그릴 때 굳힌다: 회사 상태를 다시 받아 배열이 새로 와도 토론이 처음부터 다시 돌지 않게.
  const [times] = useState(() => debateTimes(debate))
  // 단톡방의 "입력 중…" (305번): 다음 말이 뜨기 0.7초 전부터 그 사람 이름으로 보인다.
  const [typing, setTyping] = useState<string | null>(null)
  useEffect(() => {
    if (instant) {
      setPhase('done')
      setSaid(times.length)
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    times.forEach((at, i) => {
      timers.push(setTimeout(() => setTyping(debate[i].name), Math.max(0, at - TYPING_MS)))
      timers.push(
        setTimeout(() => {
          setTyping(null)
          setSaid(i + 1)
        }, at),
      )
    })
    timers.push(setTimeout(() => setPhase('push'), clash))
    timers.push(setTimeout(() => setPhase('done'), finish))
    return () => timers.forEach(clearTimeout)
  }, [instant, times, clash, finish, debate])
  // 새 말이나 "입력 중"이 생기면 단톡방을 아래로 내린다.
  const chatRef = useRef<HTMLOListElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 말이 늘거나 "입력 중"이 바뀔 때마다 내린다
  useEffect(() => {
    const el = chatRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [said, typing])
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
                {staffOf(name) && (
                  <span className="ml-0.5 font-mono-num text-muted">
                    {staffOf(name)?.overallGrade}
                  </span>
                )}
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
        종목 회의 토론 — <span className="text-red-pen">{status}</span>
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
      {/* 단톡방 (305번): 말이 메신저처럼 쌓인다. 매수파는 왼쪽(빨강), 매도파는 오른쪽(파랑). 표결은 투표 카드, 선언은 공지로 고정. */}
      {debate.length > 0 && (
        <div
          className="mt-2 overflow-hidden rounded border border-line bg-line-soft/40"
          data-testid="clash-chat"
        >
          <div className="flex items-center justify-between border-b border-line bg-card px-2.5 py-1.5 text-[12px]">
            <b className="text-[13px]">
              종목회의{stock ? ` · ${stock}` : ''}{' '}
              <span className="font-mono-num font-normal text-muted">
                {new Set([...buyers, ...sellers]).size}
              </span>
            </b>
            <span className="text-muted">단톡방</span>
          </div>
          <ol
            ref={chatRef}
            className="flex max-h-64 flex-col gap-1.5 overflow-y-auto p-2"
            data-testid="clash-debate"
            aria-label="토론 기록"
          >
            {debate.slice(0, said).map((d, i) => {
              const buySide = d.side === 'BUY'
              const kind = kindOf(d)
              if (kind === 'TALLY') {
                const total = buy + sell
                const buyPct = total === 0 ? 50 : Math.round((100 * buy) / total)
                return (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 곧 자리다
                    key={i}
                    className="animate-debate-in mx-auto w-[94%] rounded-lg border border-line bg-card px-2.5 py-2 text-[12.5px]"
                    data-testid="debate-line"
                    data-side={d.side}
                    data-kind={kind}
                  >
                    <b className="block text-[11px] text-muted">
                      📊 표결 · {d.name} (사회) — 안목 무게로 단다
                    </b>
                    <p className="mt-0.5 leading-snug">{d.text}</p>
                    <div className="mt-1.5 grid grid-cols-[32px_1fr_40px] items-center gap-2 font-mono-num text-[12px]">
                      <span className="text-up">매수</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-line-soft">
                        <i
                          className="block h-full rounded-full bg-up transition-[width] duration-700 ease-out"
                          style={{ width: `${buyPct}%` }}
                        />
                      </span>
                      <span className="text-right">{buy}</span>
                      <span className="text-down">매도</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-line-soft">
                        <i
                          className="block h-full rounded-full bg-down transition-[width] duration-700 ease-out"
                          style={{ width: `${100 - buyPct}%` }}
                        />
                      </span>
                      <span className="text-right">{sell}</span>
                    </div>
                  </li>
                )
              }
              const who = staffOf(d.name)
              return (
                <li
                  // 토론은 정해진 순서대로만 늘어난다.
                  // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 곧 자리다
                  key={i}
                  className={`animate-debate-in flex max-w-[88%] items-end gap-1.5 ${
                    buySide ? 'self-start' : 'flex-row-reverse self-end'
                  }`}
                  data-testid="debate-line"
                  data-side={d.side}
                  data-kind={kind}
                >
                  <span className="shrink-0" aria-hidden="true">
                    <Character
                      employee={who}
                      look={d.name.length}
                      side={d.side}
                      mood={kind === 'WIN' ? 'joy' : kind === 'LOSE' ? 'despair' : null}
                      talking={false}
                      fallback={d.name.slice(0, 1)}
                      size={26}
                    />
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block text-[11px] ${buySide ? 'text-up' : 'text-right text-down'}`}
                    >
                      {who?.leader && <span className="text-gold">★</span>}
                      {d.name}
                      {who?.leader ? ' · 팀장' : ''}
                    </span>
                    <div
                      className={`rounded-xl px-2.5 py-1.5 text-[12.5px] leading-snug shadow-sm ${
                        buySide
                          ? 'rounded-bl-sm bg-up/12 text-ink'
                          : 'rounded-br-sm bg-down/12 text-ink'
                      } ${kind === 'WIN' ? 'font-bold' : ''} ${kind === 'LOSE' ? 'italic opacity-80' : ''}`}
                    >
                      {d.text}
                    </div>
                  </div>
                </li>
              )
            })}
            {declared && (
              // 공지 고정: 이긴 쪽 선언이 뜨면 팀 의견을 핀으로 박는다.
              <li
                className="animate-stamp mx-auto rounded-lg bg-gold/20 px-3 py-1 text-[13px] font-bold"
                data-testid="clash-stamp"
              >
                📌 팀 의견:{' '}
                <span
                  className={`pen-circle px-2 font-pen text-[20px] ${buyWins ? 'text-up' : 'text-down'}`}
                >
                  {buyWins ? '매수!' : '매도!'}
                </span>{' '}
                <span className="font-normal text-muted">공지 고정</span>
              </li>
            )}
            {typing && !done && (
              <li
                className="flex items-center gap-1 text-[11px] text-muted"
                data-testid="clash-typing"
              >
                <i className="typing-dot" />
                <i className="typing-dot" />
                <i className="typing-dot" />
                <span className="ml-1">{typing} 입력 중</span>
              </li>
            )}
          </ol>
        </div>
      )}
      {done && (
        <p
          className={`animate-clash-win mt-1 text-center font-pen text-[26px] ${buyWins ? 'text-up' : 'text-down'}`}
          data-testid="clash-result"
        >
          팀 의견: {buyWins ? '매수!' : '매도!'}
        </p>
      )}
    </section>
  )
}
