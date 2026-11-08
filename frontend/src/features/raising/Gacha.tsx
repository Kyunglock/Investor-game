import { useEffect, useRef, useState } from 'react'
import type { Company, Drawn } from '../../api/client'
import { Overlay } from '../game/Overlay'
import { GradeBadge, tierClass, tierOf } from './GradeCard'
import { collected, drawable } from './gachaRules'
import { EMPLOYEE_LADDER } from './grades'
import { titleOf } from './office'
import { useRaisingStore } from './store'

/** 카드가 하나씩 뒤집히는 간격(ms). 특급 앞에서는 한 번 더 뜸을 들인다. */
const FLIP_MS = 420
const STAR_PAUSE_MS = 900

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/**
 * 뽑기 결과 (decisions.md 312번): 뒤집힌 카드가 하나씩 열린다. 특급은 뒷면이 금빛으로 떨다가 늦게 열리고, 도감에 처음 오른 등급에는 NEW가 붙는다. 카드를
 * 누르면 바로 열리고 "모두 열기"로 한꺼번에 연다. 다 열리면 확인. onFlip은 카드가 열릴 때마다 부른다(앱이 소리·진동·터짐을 낸다).
 */
export function GachaReveal({
  drawn,
  onClose,
  onFlip,
}: {
  drawn: Drawn[]
  onClose: () => void
  onFlip?: (drawn: Drawn, el: HTMLElement | null) => void
}) {
  const [open, setOpen] = useState<number>(() => (reducedMotion() ? drawn.length : 0))
  const cards = useRef<(HTMLButtonElement | null)[]>([])
  const flipped = useRef(new Set<number>())
  // 하나씩 연다. 다음 카드가 특급이면 한 번 더 뜸을 들인다.
  useEffect(() => {
    if (open >= drawn.length) {
      return
    }
    const wait = open === 0 ? 500 : drawn[open].star ? STAR_PAUSE_MS : FLIP_MS
    const id = setTimeout(() => setOpen((n) => Math.max(n, open + 1)), wait)
    return () => clearTimeout(id)
  }, [open, drawn])
  useEffect(() => {
    for (let i = 0; i < Math.min(open, drawn.length); i++) {
      if (!flipped.current.has(i)) {
        flipped.current.add(i)
        onFlip?.(drawn[i], cards.current[i])
      }
    }
  }, [open, drawn, onFlip])
  const done = open >= drawn.length
  const best = drawn.reduce((top, d) => Math.max(top, EMPLOYEE_LADDER.indexOf(d.grade)), 0)
  return (
    <Overlay>
      <section
        className="animate-pop rounded-xl bg-[#141824] p-4 text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="채용 뽑기 결과"
        data-testid="gacha-reveal"
      >
        <h2 className="text-center font-pen text-[26px] leading-tight">{drawn.length}명이 왔다!</h2>
        <ul
          className={`mt-3 grid gap-2 ${drawn.length === 1 ? 'grid-cols-1 px-16' : drawn.length <= 4 ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-5'}`}
        >
          {drawn.map((d, i) => (
            <li key={d.employeeId} className="aspect-[3/4]">
              <button
                ref={(el) => {
                  cards.current[i] = el
                }}
                type="button"
                onClick={() => setOpen((n) => Math.max(n, i + 1))}
                className={`flip-card h-full w-full ${i < open ? 'is-open' : ''} ${d.star ? 'is-star' : ''}`}
                aria-label={i < open ? `${d.name} ${d.grade}` : '뒤집힌 카드'}
                data-testid="gacha-card"
                data-open={i < open}
                data-grade={d.grade}
                data-star={d.star}
              >
                <span className="flip-inner">
                  <span className="flip-back" aria-hidden="true">
                    <span className="text-[28px] font-black">?</span>
                  </span>
                  <span className="flip-front">
                    <span
                      className={`grade-card ${tierClass(tierOf(d.grade))} flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-ink`}
                    >
                      <span className="gem-static">
                        <GradeBadge grade={d.grade} label={d.star ? '특급' : undefined} />
                      </span>
                      <b className="text-[14px] leading-tight">{d.name}</b>
                      <span className="text-[11px] text-muted">{titleOf(d.grade)}</span>
                      {d.fresh && (
                        <span className="rounded bg-red-pen px-1.5 text-[10px] font-bold text-white">
                          NEW
                        </span>
                      )}
                      {d.hello && i < open && (
                        // 첫인사 (349번): 버릇대로 한마디.
                        <span
                          className="mt-1 line-clamp-3 text-[10px] leading-tight text-ink/75"
                          data-testid="drawn-hello"
                        >
                          “{d.hello}”
                        </span>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {done ? (
          <>
            <p className="mt-3 text-center text-[13px] text-white/75" data-testid="gacha-best">
              최고 {EMPLOYEE_LADDER[best]} · 뽑은 사람은 쉬는 채로 들어왔습니다. 자리에 앉히세요.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 min-h-12 w-full rounded-lg bg-wine font-semibold text-white"
              data-testid="gacha-close"
            >
              확인
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(drawn.length)}
            className="mt-3 min-h-11 w-full rounded-lg border border-white/30 text-[14px]"
            data-testid="gacha-open-all"
          >
            모두 열기
          </button>
        )}
      </section>
    </Overlay>
  )
}

/** 확률표 (312번): 이 회사에서 칸마다 나오는 등급과 확률. */
export function RatesTable({ company }: { company: Company }) {
  return (
    <ul className="grid gap-1" data-testid="gacha-rates">
      {company.gacha.rates.map((r) => (
        <li
          key={`${r.grade}-${r.star}-${r.percent}`}
          className="flex items-center justify-between rounded border border-line-soft bg-white px-2 py-1 text-[13px]"
        >
          <span>
            <GradeBadge grade={r.grade} size="inline" />
            {r.grade} {r.star && <b className="text-gold">특급</b>}
          </span>
          <b className="font-mono-num">{r.percent}%</b>
        </li>
      ))}
    </ul>
  )
}

/** 도감 (312번): 등급마다 얻은 사람 수. 아직 못 본 등급은 물음표. 사장의 것이라 다음 회사로 이어진다. */
export function CollectionGrid({ company }: { company: Company }) {
  return (
    <div data-testid="collection">
      <p className="text-[12px] text-muted">
        {collected(company)} / {company.gacha.collection.length} 등급을 만났습니다
      </p>
      <ul className="mt-1 grid grid-cols-6 gap-1">
        {company.gacha.collection.map((c) => (
          <li
            key={c.grade}
            className={`flex flex-col items-center rounded border py-1 text-[11px] ${
              c.count > 0
                ? 'border-line bg-white'
                : 'border-dashed border-line-soft bg-white/40 text-faint'
            }`}
            data-testid="collection-entry"
            data-grade={c.grade}
            data-count={c.count}
          >
            {c.count > 0 ? (
              <>
                <span className="gem-static">
                  <GradeBadge grade={c.grade} size="sm" />
                </span>
                <span className="font-mono-num">×{c.count}</span>
              </>
            ) : (
              <>
                <span className="text-[16px] leading-[32px]">?</span>
                <span className="font-mono-num">{c.grade}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 웹의 채용 탭 (312번): 채용권과 뽑기 버튼, 확률표, 도감. 내보내기는 없앴다(338번), 합성도 뺐다(384번). */
/** 이 값 이상이면 인원 상한이 없는 것으로 본다 (decisions.md 354번). */
const NO_LIMIT = 100_000

export function GachaPanel({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { draw } = useRaisingStore.getState()
  const g = company.gacha
  const many = drawable(company)
  const full = g.roster >= g.rosterMax
  return (
    <section data-testid="gacha">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px]">
          🎟 채용권{' '}
          <b className="font-mono-num text-[18px]" data-testid="tickets">
            {g.tickets}
          </b>
          장
        </p>
        <p className="text-[12px] text-muted" data-testid="roster">
          데리고 있는 사람 {g.roster}
          {g.rosterMax < NO_LIMIT && ` / ${g.rosterMax}`}명
        </p>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        채용권 한 장에 한 명이 옵니다. 분기를 넘길 때마다, 연말·업적·이사 때 채용권을 받습니다.
        {company.meeting?.hrCap && ` 인사팀 덕에 ${company.meeting.hrCap} 언저리까지 나옵니다.`}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || many < 1}
          onClick={() => void draw(1)}
          className="min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50"
          data-testid="draw-one"
        >
          1명 뽑기
        </button>
        <button
          type="button"
          disabled={busy || many < 2}
          onClick={() => void draw(many)}
          className="min-h-12 rounded border border-wine font-semibold text-wine disabled:opacity-50"
          data-testid="draw-many"
        >
          {many >= 2 ? `${many}명 뽑기` : '여러 명 뽑기'}
        </button>
      </div>
      {full && (
        <p className="mt-1 text-[12px] text-wine" data-testid="roster-full">
          데리고 있을 자리가 꽉 찼습니다.
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] text-muted">확률표</summary>
        <div className="mt-1">
          <RatesTable company={company} />
        </div>
      </details>
      <h4 className="mt-3 font-pen text-[20px]">도감</h4>
      <CollectionGrid company={company} />
    </section>
  )
}

/** 뽑기 결과 창을 띄울 때: 방금 뽑았고 결과가 있다. */
export function useDrawReveal(company: Company): Drawn[] | null {
  const justDrew = useRaisingStore((s) => s.justDrew)
  return justDrew && company.gacha.drawn.length > 0 ? company.gacha.drawn : null
}
