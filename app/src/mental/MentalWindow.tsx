import type { Company } from '@web/api/client'
import { type MentalCard, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFx } from '../fx/fx'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import type { BattleHandle, Hud, Outcome } from './battle'
import { applyCard, BASE_LOADOUT, type Loadout, pickCards } from './cards'
import { ENEMIES } from './enemies'
import { GENRES } from './genres'
import { type Hero, heroOf } from './hero'

type Mental = NonNullable<Company['mental']>

/**
 * 멘탈 전투 창 (decisions.md 328·330·331·339번): 이벤트 머리글과 장르, 출전 버튼 → 한 판(전장이 열리면 첫 카드 석 장 가운데 하나)(Phaser, 늦게 불러온다. 레벨이 오를 때마다 멈추고 카드를
 * 또 고른다) → 결과 → 서버에 고른 카드 목록과 결과를 보고 → onDone(결산). 건너뛰거나 싸우다 나가면(345번) 보고 없이 바로 onDone이다. 화면 전체를 쓴다.
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
  // 싸우는 사람은 창을 여는 순간 정한다: 회사가 다시 그려져도 한 판이 다시 시작되지 않게.
  const [hero] = useState(() => heroOf(company))
  const [started, setStarted] = useState(false)
  const [picked, setPicked] = useState<MentalCard[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [sending, setSending] = useState(false)
  const genre = GENRES[mental.genre]

  const finish = async () => {
    if (!outcome || sending || picked.length === 0) {
      return
    }
    setSending(true)
    await useRaisingStore.getState().reportMental(picked, outcome.kills, outcome.mentalLeft)
    onDone()
  }

  return createPortal(
    <div className="fixed inset-0 z-40 bg-[#7ddcbe]" role="dialog" aria-label="멘탈 전투">
      {started && !outcome && (
        <Battle
          genre={mental.genre}
          hero={hero}
          onPick={(code) => setPicked((p) => [...p, code])}
          onDone={setOutcome}
          onQuit={onDone}
        />
      )}
      {!started && (
        <div className="flex h-full flex-col items-center justify-center gap-5 arcade-burst overflow-x-hidden overflow-y-auto px-4 py-8">
          <div className="panel w-full max-w-[520px] px-5 py-4 text-center">
            <span className="inline-block rounded-lg bg-[#ff4f6d] px-3 py-0.5 text-[13px] font-bold text-white">
              이번 분기 이벤트
            </span>
            <h2 className="mt-2 font-game text-[24px] leading-tight">{mental.headline}</h2>
            <p className="mt-1 text-[14px] text-muted">
              장르: {genre.name} · {genre.hint}
            </p>
            <p className="mt-1 text-[14px] font-bold">출전: {hero.name} · 4분</p>
          </div>
          <button
            type="button"
            onClick={() => {
              sfx.stamp()
              haptic.medium()
              setStarted(true)
            }}
            className="btn btn-primary animate-breathe min-h-16 w-full max-w-[320px] text-[24px]"
            data-testid="mental-start"
          >
            출전! ▶
          </button>
          <ul className="flex flex-wrap justify-center gap-2 font-game text-[13px] text-ink">
            {Object.values(ENEMIES).map((e) => (
              <li
                key={e.label}
                className="rounded-full border-2 border-(--outline) bg-white px-3 py-1"
              >
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
      {outcome && (
        <div className="flex h-full flex-col items-center justify-center gap-5 arcade-burst overflow-hidden px-4">
          <div
            className="panel w-full max-w-[520px] px-5 py-5 text-center"
            data-testid="mental-result"
          >
            <span
              className={`inline-block rounded-lg px-3 py-0.5 text-[13px] font-bold text-white ${outcome.win ? 'bg-teal' : 'bg-[#ff4f6d]'}`}
            >
              {outcome.win ? '분기 마감' : '멘탈 붕괴'}
            </span>
            <h2 className="mt-2 font-game text-[28px]">
              {outcome.win ? '멘탈 지켜냈다!' : '멘탈이 무너졌다…'}
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="물리친 적" value={outcome.kills} />
              <Stat label="남은 멘탈" value={outcome.mentalLeft} />
              <Stat label="레벨" value={picked.length} />
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
    <div className="rounded-xl border-2 border-(--outline) bg-[#fff6c9] px-2 py-2">
      <span className="block text-[12px] text-muted">{label}</span>
      <b className="block font-game text-[26px] font-normal">{value}</b>
    </div>
  )
}

/**
 * 카드 석 장 고르기 (330번): 제목이 쿵 하고 찍히고, 카드가 아래에서 차례로 튀어 올라 뒤집히며 자리를 잡는다(소리·진동). 누르면 그 카드가 번쩍 커졌다 사라진 뒤
 * onPick.
 */
function CardPick({
  title,
  sub,
  loadout,
  mentalFull,
  onPick,
}: {
  title: string
  sub: string
  loadout: Loadout
  mentalFull: boolean
  onPick: (code: MentalCard) => void
}) {
  const [cards] = useState(() => pickCards(loadout, mentalFull))
  const [chosen, setChosen] = useState<MentalCard | null>(null)
  useEffect(() => {
    sfx.levelUp()
    haptic.medium()
    const timers = cards.map((_, i) => setTimeout(() => sfx.tap(), 120 + i * 110))
    return () => {
      for (const t of timers) {
        clearTimeout(t)
      }
    }
  }, [cards])
  return (
    <div
      className="flex w-full max-w-[620px] flex-col items-center gap-3"
      data-testid="mental-cards"
    >
      <h3 className="animate-mental-title text-center font-game text-[40px] text-white [-webkit-text-stroke:3px_#2b2340] [paint-order:stroke] [text-shadow:0_4px_0_#2b2340]">
        {title}
      </h3>
      <p className="font-game text-[16px] text-ink">{sub}</p>
      <div className="grid w-full gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <button
            key={c.code}
            type="button"
            disabled={chosen !== null}
            style={{ animationDelay: chosen ? '0ms' : `${120 + i * 110}ms`, background: undefined }}
            onClick={(ev) => {
              if (chosen) {
                return
              }
              setChosen(c.code)
              sfx.cash()
              haptic.heavy()
              useFx.getState().burstAt(ev.currentTarget, 'sparks')
              setTimeout(() => onPick(c.code), 380)
            }}
            className={`panel flex items-center gap-3 px-4 py-3 text-left sm:flex-col sm:items-center sm:text-center ${
              chosen === c.code
                ? 'animate-mental-card-pick'
                : chosen
                  ? 'opacity-30'
                  : 'animate-mental-card-in'
            }`}
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-[#2b2340] text-[26px]"
              style={{ background: c.color }}
              aria-hidden="true"
            >
              {c.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-game text-[20px]">{c.name}</span>
              <span className="block text-[13px] text-muted">{c.desc}</span>
            </span>
            <span className="shrink-0 rounded-full border-2 border-(--outline) bg-[#fff3c4] px-3 py-0.5 font-game text-[14px]">
              {c.effect}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 한 판: Phaser를 늦게 불러 컨테이너에 띄우고, 위에 멘탈·시간·레벨과 큰 알림을 그린다. 레벨이 오르면 전투 위에 카드 고르기가 뜬다. 오른쪽 위 ✕로 언제든
 * 나갈 수 있다(345번): 전투를 멈추고 물은 뒤 나가면 강화 없이 결산이다.
 */
function Battle({
  genre,
  hero,
  onPick,
  onDone,
  onQuit,
}: {
  genre: Mental['genre']
  hero: Hero
  onPick: (code: MentalCard) => void
  onDone: (outcome: Outcome) => void
  /** 싸우다 나간다 (345번): 이번 분기 강화 없이 결산으로. */
  onQuit: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<BattleHandle | null>(null)
  const loadout = useRef(BASE_LOADOUT)
  const [hud, setHud] = useState<Hud | null>(null)
  const [banner, setBanner] = useState<{ text: string; color: string; id: number } | null>(null)
  const [hurt, setHurt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) {
      return
    }
    let cancelled = false
    let bannerId = 0
    void import('./battle').then(({ startBattle }) => {
      if (cancelled) {
        return
      }
      setLoading(false)
      handle.current = startBattle(el, {
        genre,
        hero,
        loadout: loadout.current,
        onHud: setHud,
        onBanner: (text, color) => setBanner({ text, color, id: ++bannerId }),
        onHurt: () => {
          setHurt(true)
          haptic.light()
          setTimeout(() => setHurt(false), 80)
        },
        onLevelUp: setLevelUp,
        onDone,
      })
    })
    return () => {
      cancelled = true
      handle.current?.stop()
      handle.current = null
    }
  }, [genre, hero, onDone])

  return (
    <>
      <div ref={host} className="absolute inset-0" />
      {loading && (
        <p className="absolute inset-0 grid place-items-center font-game text-[18px] text-ink">
          전장을 여는 중…
        </p>
      )}
      <div
        className="pointer-events-none absolute inset-0 transition-shadow"
        style={{ boxShadow: hurt ? 'inset 0 0 120px 40px rgba(255,79,109,0.55)' : 'none' }}
      />
      {hud && (
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex flex-col gap-1.5 px-3 pt-[calc(env(safe-area-inset-top)+10px)] font-game text-[#2b2340]">
          <div className="flex items-center gap-2">
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
              {Math.floor(hud.secondsLeft / 60)}:{String(hud.secondsLeft % 60).padStart(2, '0')}
            </div>
            <div className="rounded-full border-[3px] border-[#2b2340] bg-white px-3 py-1 text-[14px] font-bold shadow-[0_3px_0_#2b2340]">
              적 <span className="text-[#ff4f6d]">{hud.kills}</span>
            </div>
            <button
              type="button"
              aria-label="전투 나가기"
              onClick={() => {
                sfx.tap()
                handle.current?.setPaused(true)
                setAsking(true)
              }}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full border-[3px] border-[#2b2340] bg-white text-[16px] font-bold shadow-[0_3px_0_#2b2340] active:translate-y-0.5 active:shadow-none"
              data-testid="mental-quit"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border-[3px] border-[#2b2340] bg-white px-3 py-1 text-[13px] font-bold shadow-[0_3px_0_#2b2340]">
            Lv.{hud.level}
            <span className="block h-2.5 w-[min(200px,40vw)] overflow-hidden rounded-full border-2 border-[#2b2340] bg-[#e8f3ff]">
              <span
                className="block h-full bg-[#6aa8ff] transition-[width]"
                style={{ width: `${hud.xp * 100}%` }}
              />
            </span>
          </div>
        </div>
      )}
      {banner && (
        <p
          key={banner.id}
          className="animate-mental-banner pointer-events-none absolute top-[22%] left-1/2 whitespace-nowrap rounded-2xl border-4 border-[#2b2340] px-6 py-2 font-game text-[clamp(22px,4.4vw,36px)] text-white [text-shadow:0_3px_0_#2b2340] shadow-[0_6px_0_#2b2340]"
          style={{ background: banner.color }}
          aria-live="polite"
        >
          {banner.text}
        </p>
      )}
      {asking && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#2b2340]/55 px-6"
          role="alertdialog"
          aria-modal="true"
          aria-label="전투 나가기"
          data-testid="mental-quit-ask"
        >
          <div className="panel w-full max-w-[360px] px-5 py-5 text-center">
            <h3 className="font-game text-[24px]">그만 싸울까요?</h3>
            <p className="mt-1 text-[14px] text-muted">
              나가면 이번 분기는 강화 없이 결산으로 갑니다. 물리친 적과 고른 카드는 남지 않습니다.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  sfx.stamp()
                  haptic.medium()
                  setAsking(false)
                  handle.current?.setPaused(false)
                }}
                className="btn btn-primary min-h-14 text-[18px]"
                data-testid="mental-quit-no"
              >
                계속 싸운다 ▶
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.tap()
                  onQuit()
                }}
                className="btn btn-ghost min-h-12 text-[15px]"
                data-testid="mental-quit-yes"
              >
                나간다 (강화 없음)
              </button>
            </div>
          </div>
        </div>
      )}
      {levelUp !== null && hud && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 arcade-burst-soft px-4"
          data-testid="mental-levelup"
        >
          <CardPick
            key={levelUp}
            title={levelUp === 1 ? '멘탈 카드' : `LEVEL UP! Lv.${levelUp}`}
            sub={
              levelUp === 1
                ? '한 장을 고르세요. 레벨이 오를 때마다 또 고릅니다'
                : '카드 한 장을 더 쌓으세요'
            }
            loadout={loadout.current}
            mentalFull={hud.mental >= hud.maxMental}
            onPick={(code) => {
              loadout.current = applyCard(loadout.current, code)
              onPick(code)
              setLevelUp(null)
              handle.current?.applyLoadout(loadout.current)
            }}
          />
        </div>
      )}
    </>
  )
}
