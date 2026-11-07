import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import type { Hud, Outcome } from './battle'
import { type Card, loadoutOf, pickCards } from './cards'
import { ENEMIES } from './enemies'
import { GENRES } from './genres'
import { type Hero, heroOf } from './hero'

type Mental = NonNullable<Company['mental']>

/**
 * 멘탈 전투 창 (decisions.md 328번): 이벤트 머리글과 장르 → 카드 석 장 가운데 하나 → 한 판(Phaser, 늦게 불러온다) → 결과 → 서버에 보고 → onDone(결산).
 * 건너뛰면 보고 없이 바로 onDone이다. 화면 전체를 쓴다.
 */
export function MentalWindow({
  mental,
  company,
  onDone,
}: {
  mental: Mental
  company: Company
  onDone: () => void
}) {
  const [cards] = useState(() => pickCards())
  // 싸우는 사람은 창을 여는 순간 정한다: 회사가 다시 그려져도 한 판이 다시 시작되지 않게.
  const [hero] = useState(() => heroOf(company))
  const [card, setCard] = useState<Card | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [sending, setSending] = useState(false)
  const genre = GENRES[mental.genre]

  const finish = async () => {
    if (!card || !outcome || sending) {
      return
    }
    setSending(true)
    await useRaisingStore.getState().reportMental(card.code, outcome.kills, outcome.mentalLeft)
    onDone()
  }

  return createPortal(
    <div className="fixed inset-0 z-40 bg-[#1c2238]" role="dialog" aria-label="멘탈 전투">
      {card && !outcome && (
        <Battle genre={mental.genre} hero={hero} card={card} onDone={setOutcome} />
      )}
      {!card && (
        <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto bg-[rgba(43,35,64,0.72)] px-4 py-8">
          <div className="panel w-full max-w-[520px] px-5 py-4 text-center">
            <span className="inline-block rounded-lg bg-[#ff4f6d] px-3 py-0.5 text-[13px] font-bold text-white">
              이번 분기 이벤트
            </span>
            <h2 className="mt-2 text-[22px] font-bold leading-tight">{mental.headline}</h2>
            <p className="mt-1 text-[14px] text-muted">
              장르: {genre.name} · {genre.hint}
            </p>
            <p className="mt-1 text-[14px] font-bold">출전: {hero.name}</p>
          </div>
          <p className="text-[15px] font-bold text-white">멘탈 카드 한 장을 고르세요</p>
          <div
            className="grid w-full max-w-[620px] gap-3 sm:grid-cols-3"
            data-testid="mental-cards"
          >
            {cards.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  sfx.tap()
                  haptic.light()
                  setCard(c)
                }}
                className="panel flex items-center gap-3 px-4 py-3 text-left sm:flex-col sm:items-center sm:text-center"
              >
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-[#2b2340] text-[26px]"
                  style={{ background: c.color }}
                  aria-hidden="true"
                >
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-bold">{c.name}</span>
                  <span className="block text-[13px] text-muted">{c.desc}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#fff3c4] px-3 py-0.5 text-[13px] font-bold">
                  {c.effect}
                </span>
              </button>
            ))}
          </div>
          <ul className="flex flex-wrap justify-center gap-2 text-[12px] text-white">
            {Object.values(ENEMIES).map((e) => (
              <li key={e.label} className="rounded-full bg-[rgba(0,0,0,0.3)] px-3 py-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: e.fill }}
                />{' '}
                {e.label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              sfx.tap()
              onDone()
            }}
            className="btn btn-ghost min-h-11 px-5 text-[14px]"
            data-testid="mental-skip"
          >
            이번 분기는 건너뛰기 (강화 없음)
          </button>
        </div>
      )}
      {card && outcome && (
        <div className="flex h-full flex-col items-center justify-center gap-5 bg-[rgba(43,35,64,0.72)] px-4">
          <div
            className="panel w-full max-w-[520px] px-5 py-5 text-center"
            data-testid="mental-result"
          >
            <span
              className={`inline-block rounded-lg px-3 py-0.5 text-[13px] font-bold text-white ${outcome.win ? 'bg-teal' : 'bg-[#ff4f6d]'}`}
            >
              {outcome.win ? '분기 마감' : '멘탈 붕괴'}
            </span>
            <h2 className="mt-2 text-[24px] font-bold">
              {outcome.win ? '멘탈 지켜냈다!' : '멘탈이 무너졌다…'}
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="물리친 적" value={outcome.kills} />
              <Stat label="남은 멘탈" value={outcome.mentalLeft} />
              <Stat label="카드" value={card.name} />
            </div>
            <p className="mt-3 text-[13px] text-muted">
              얼마나 세지는지는 결산에서 알려준다: 적을 많이 물리치고 멘탈을 많이 남길수록 이번 분기
              직원들이 더 벌고 손이 덜 흔들린다.
            </p>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={() => {
              sfx.stamp()
              haptic.medium()
              void finish()
            }}
            className="btn btn-gold min-h-14 px-10 text-[18px]"
            data-testid="mental-done"
          >
            결산으로 ▶
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border-2 border-line bg-[#fff8ea] px-2 py-2">
      <span className="block text-[12px] text-muted">{label}</span>
      <b className="block text-[22px]">{value}</b>
    </div>
  )
}

/** 한 판: Phaser를 늦게 불러 컨테이너에 띄우고, 위에 멘탈·시간·점수와 큰 알림을 그린다. */
function Battle({
  genre,
  hero,
  card,
  onDone,
}: {
  genre: Mental['genre']
  hero: Hero
  card: Card
  onDone: (outcome: Outcome) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [hud, setHud] = useState<Hud | null>(null)
  const [banner, setBanner] = useState<{ text: string; color: string; id: number } | null>(null)
  const [hurt, setHurt] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const el = host.current
    if (!el) {
      return
    }
    let stop: (() => void) | null = null
    let cancelled = false
    let bannerId = 0
    void import('./battle').then(({ startBattle }) => {
      if (cancelled) {
        return
      }
      setLoading(false)
      stop = startBattle(el, {
        genre,
        hero,
        loadout: loadoutOf(card.code),
        onHud: setHud,
        onBanner: (text, color) => setBanner({ text, color, id: ++bannerId }),
        onHurt: () => {
          setHurt(true)
          haptic.light()
          setTimeout(() => setHurt(false), 80)
        },
        onDone,
      })
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [genre, hero, card, onDone])

  return (
    <>
      <div ref={host} className="absolute inset-0" />
      {loading && (
        <p className="absolute inset-0 grid place-items-center text-[16px] font-bold text-white">
          전장을 여는 중…
        </p>
      )}
      <div
        className="pointer-events-none absolute inset-0 transition-shadow"
        style={{ boxShadow: hurt ? 'inset 0 0 120px 40px rgba(255,79,109,0.55)' : 'none' }}
      />
      {hud && (
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+10px)] text-[#2b2340]">
          <div className="flex items-center gap-2 rounded-full border-[3px] border-[#2b2340] bg-white px-3 py-1 text-[14px] font-bold shadow-[0_3px_0_#2b2340]">
            멘탈
            <span className="block h-3.5 w-[min(160px,26vw)] overflow-hidden rounded-full border-2 border-[#2b2340] bg-[#f3eadb]">
              <span
                className="block h-full bg-gradient-to-r from-[#ff7aa8] to-[#ffd84d] transition-[width]"
                style={{ width: `${(hud.mental / hud.maxMental) * 100}%` }}
              />
            </span>
            {hud.mental}
          </div>
          <div className="mx-auto rounded-full border-[3px] border-[#2b2340] bg-white px-3 py-1 text-[14px] font-bold shadow-[0_3px_0_#2b2340]">
            {hud.secondsLeft}초
          </div>
          <div className="rounded-full border-[3px] border-[#2b2340] bg-white px-3 py-1 text-[14px] font-bold shadow-[0_3px_0_#2b2340]">
            적 <span className="text-[#ff4f6d]">{hud.kills}</span>
          </div>
        </div>
      )}
      {banner && (
        <p
          key={banner.id}
          className="animate-mental-banner pointer-events-none absolute top-[22%] left-1/2 whitespace-nowrap rounded-2xl border-4 border-[#2b2340] px-6 py-2 text-[clamp(20px,4vw,34px)] font-bold text-white shadow-[0_6px_0_#2b2340]"
          style={{ background: banner.color }}
          aria-live="polite"
        >
          {banner.text}
        </p>
      )}
    </>
  )
}
