import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type BattleEntry, useAppUi } from '../app/ui'
import { useFx } from '../fx/fx'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'

import {
  type BattleMode,
  DEFENSE_BOSS_SECONDS,
  type StageSpec,
  stageLabel,
  stageSpec,
} from './advance'
import { STAGE_ASSETS } from './assets'
import type { BattleHandle, Hud, Outcome } from './battle'
import { applyCard, type Card, GRADE_NAMES, loadoutOf, type MagicLevels, pickCards } from './cards'
import { ENEMIES } from './enemies'
import { GunSprite } from './GunSprite'
import { BATTLE_SECONDS } from './genres'
import { StagePortrait } from './StagePortrait'
import { WEAPON_EFFECTS } from './weaponEffects'
import './stage.css'
import { DEFAULT_WEAPON, type Hero, heroOf, type Weapon } from './hero'

type Genre = NonNullable<Company['mental']>['genre']
type Armory = NonNullable<Company['armory']>

/** 합칠 수 있는 등급: 가장 높은 등급(UR)은 못 합친다 (366번). */
type MergeGrade = Exclude<Weapon['grade'], 'UR'>

/** 무기 등급 배지 색 (346번). */
const GRADE_BADGE: Record<Weapon['grade'], string> = {
  N: 'bg-[#e6e3ea] text-ink',
  R: 'bg-[#cfe0f7] text-[#2d5c9e]',
  SR: 'bg-[#e4d6fb] text-[#5d3aa6]',
  UR: 'bg-[#ffe7a6] text-[#8a5a00]',
}

/**
 * 멘탈 전투 창 (decisions.md 328·330·339·345·346·369번): 스테이지 선택에서 고른 판(번호 스테이지 = 전진 모드, EX = 디펜스)의 출전 화면, 무기 고르기,
 * 출전 버튼 → 한 판(Phaser, 늦게 불러온다. 레벨이 오를 때마다 멈추고 카드를 고른다) → 결과를 서버에 보내고 받은 보상을 보인다 → onDone(돌아가기).
 * 돌아가거나 싸우다 나가면(345번) 보고 없이 바로 onDone이다. 화면 전체를 쓴다.
 */
export function MentalWindow({
  entry,
  company,
  onDone,
}: {
  entry: BattleEntry
  company: Company
  onDone: () => void
}) {
  // 싸우는 사람과 든 무기는 출전을 누르는 순간 굳힌다: 회사가 다시 그려져도 한 판이 다시 시작되지 않게.
  const [hero, setHero] = useState<Hero | null>(null)
  const started = hero !== null
  const [picked, setPicked] = useState<Card[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [sending, setSending] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [pauseRequest, setPauseRequest] = useState(0)
  const busy = useRaisingStore((s) => s.busy)
  const apiError = useRaisingStore((s) => s.error)
  const modal = useRef<HTMLDivElement>(null)
  // 디펜스가 주 콘텐츠다 (509번): 번호 스테이지도 EX도 멘탈벽을 지키는 디펜스다. 전진 모드(364번)는 지금 쓰지 않는다.
  const mode: BattleMode = 'defense'
  const perChapter = company.stages?.perChapter
  // 한 번만 만든다: 새 객체면 전투(Battle)의 effect가 다시 돌아 판이 처음부터 다시 시작됐다.
  const stageNumber = entry.kind === 'stage' ? entry.stage : null
  const spec: StageSpec | undefined = useMemo(
    () => (stageNumber === null ? undefined : stageSpec(stageNumber, perChapter)),
    [stageNumber, perChapter],
  )
  const genre: Genre = company.mental?.genre ?? 'DEFENSE'
  const [saved, setSaved] = useState(false)
  const weapons = company.weapons?.length ? company.weapons : [DEFAULT_WEAPON]

  const back = useEffectEvent(() => {
    if (hero && !outcome) setPauseRequest((n) => n + 1)
    else if (!hero) onDone()
  })
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    modal.current?.focus()
    const previous = useAppUi.getState().modalBack
    const handler = () => back()
    useAppUi.getState().setModalBack(handler)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const root = modal.current
        const active =
          root?.querySelector('.stage-pause-overlay') ??
          root?.querySelector('.stage-card-overlay') ??
          root
        const controls = active
          ? Array.from(active.querySelectorAll<HTMLElement>('button:not(:disabled)'))
          : []
        const first = controls[0],
          last = controls.at(-1)
        if (
          first &&
          (!active?.contains(document.activeElement) ||
            document.activeElement === root ||
            (!e.shiftKey && document.activeElement === last))
        ) {
          e.preventDefault()
          first.focus()
        } else if (last && e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handler()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      useAppUi.getState().setModalBack(previous)
      document.removeEventListener('keydown', key)
      previousFocus?.focus()
    }
  }, [])

  // 결과가 나오면 바로 서버에 보내고(369번) 받은 보상을 결과 카드에 보인다.
  const save = useEffectEvent(async () => {
    if (!outcome || sending || saved) {
      return
    }
    setSending(true)
    setReportError(null)
    const store = useRaisingStore.getState()
    if (entry.kind === 'stage') {
      await store.reportStage(entry.stage, outcome.win, outcome.stars)
    } else {
      await store.reportEx(outcome.kills)
    }
    const state = useRaisingStore.getState()
    if (state.error) {
      setReportError(state.error)
    } else {
      setSaved(true)
    }
    setSending(false)
  })
  useEffect(() => {
    if (outcome) void save()
  }, [outcome])
  const reward = saved ? (company.stages?.lastResult ?? null) : null

  return createPortal(
    <div
      ref={modal}
      tabIndex={-1}
      className="stage-layer"
      role="dialog"
      aria-modal="true"
      aria-label="멘탈 전투"
    >
      <div className="stage-frame" style={{ backgroundImage: `url(${STAGE_ASSETS.street})` }}>
        {hero && !outcome && (
          <Battle
            mode={mode}
            stage={spec}
            genre={genre}
            hero={hero}
            cards={picked}
            pauseRequest={pauseRequest}
            onPick={(card) => setPicked((p) => [...p, card])}
            onDone={setOutcome}
            onQuit={onDone}
          />
        )}
        {!started && (
          <div className="stage-lobby" data-testid="mental-lobby">
            <header className="stage-heading">
              <span className="stage-eyebrow">
                {entry.kind === 'stage' ? '멘탈 스테이지' : 'EX 도전 · 분기에 한 번'}
              </span>
              <h2>
                {entry.kind === 'stage'
                  ? `스테이지 ${stageLabel(entry.stage, perChapter)}`
                  : 'EX 디펜스'}
              </h2>
              <p>{company.mental?.headline ?? '흔들리지 않는 마음으로'}</p>
            </header>
            <div className="stage-hero-card">
              <span className="stage-mode" data-testid="stage-mode">
                {spec?.boss
                  ? `디펜스 · ${DEFENSE_BOSS_SECONDS / 60}분에 보스 · 제한 시간 ${BATTLE_SECONDS / 60}분 안에 격파`
                  : `디펜스 · 제한 시간 ${BATTLE_SECONDS / 60}분 버티기`}
              </span>
              <StagePortrait weapon={heroOf(company).weapon} />
              <div className="stage-mini-wall">
                <span>♡</span> 멘탈벽
              </div>
              <p>
                {spec?.boss
                  ? '불안을 막고 패닉셀 대장을 쓰러뜨리세요'
                  : '몰려오는 불안을 막아 멘탈벽을 지키세요'}
              </p>
              <small>
                {spec
                  ? '누른 방향으로 발사 · 멘탈벽이 많이 남을수록 별이 많다'
                  : '누른 방향으로 발사 · 적을 많이 잡을수록 무기 뽑기권이 많다'}
              </small>
            </div>
            <WeaponPicker weapons={weapons} armory={company.armory ?? null} busy={busy} />
            {apiError && (
              <p role="alert" className="stage-error">
                {apiError}
              </p>
            )}
            <div className="stage-enemies">
              {Object.values(ENEMIES).map((e) => (
                <span key={e.label}>
                  <i style={{ background: e.fill }} />
                  {e.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              className="stage-primary"
              data-testid="mental-start"
              onClick={() => {
                sfx.stamp()
                haptic.medium()
                setHero(heroOf(company))
              }}
            >
              {spec ? '출발' : '멘탈 지키러 가기'} <span aria-hidden="true">▶</span>
            </button>
            <button
              type="button"
              className="stage-skip"
              data-testid="mental-skip"
              onClick={() => {
                sfx.tap()
                onDone()
              }}
            >
              돌아가기
            </button>
          </div>
        )}
        {outcome && (
          <div className="stage-summary">
            <div className="stage-result-card" data-testid="mental-result">
              <span
                className={`inline-block rounded-lg px-3 py-0.5 text-[13px] font-bold text-white ${outcome.win ? 'bg-teal' : 'bg-[#ff4f6d]'}`}
              >
                {outcome.win
                  ? '멘탈 지켜냈다'
                  : outcome.reason === 'time'
                    ? '시간 초과'
                    : '멘탈 붕괴'}
              </span>
              <h2 className="mt-2 font-game text-[28px]">
                {outcome.win
                  ? '멘탈 지켜냈다!'
                  : outcome.reason === 'time'
                    ? '보스를 못 쓰러뜨렸다…'
                    : '멘탈이 무너졌다…'}
              </h2>
              {spec && (
                <p
                  className="mt-1 text-[30px] tracking-[4px]"
                  role="img"
                  aria-label={`별 ${outcome.stars}개`}
                  data-testid="mental-stars"
                  data-stars={outcome.stars}
                >
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i < outcome.stars ? 'text-[#ffc83d]' : 'text-ink/20'}>
                      ★
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="레벨" value={picked.length} />
                <Stat label="물리친 적" value={outcome.kills} />
                <Stat label="남은 멘탈" value={outcome.mentalLeft} />
              </div>
              <p className="mt-3 text-[14px]" data-testid="mental-reward">
                {sending
                  ? '보상을 받는 중…'
                  : !reward
                    ? ''
                    : reward.capital > 0 || reward.tickets > 0
                      ? `${reward.firstClear ? '처음 깼다! ' : ''}${reward.capital > 0 ? `자본 +${money(reward.capital)} · ` : ''}무기 뽑기권 +${reward.tickets}장`
                      : spec && !outcome.win
                        ? '깨면 자본과 무기 뽑기권을 받는다.'
                        : '이번에 더 받을 보상은 없다.'}
              </p>
            </div>
            <button
              type="button"
              disabled={sending || busy}
              onClick={() => {
                sfx.stamp()
                haptic.medium()
                if (reportError) void save()
                else onDone()
              }}
              className="stage-primary"
              data-testid="mental-done"
            >
              {sending ? '저장 중…' : reportError ? '다시 저장하기' : '돌아가기 ▶'}
            </button>
            {reportError && (
              <p className="stage-error" role="alert">
                {reportError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * 무기 고르기 (decisions.md 346·366번): 가진 무기를 늘어놓고 누르면 든다. 든 무기는 테두리가 진하다. 무기 뽑기권으로 뽑고, 같은 무기가 mergeCount개면
 * 합쳐 한 등급 올린다.
 */
function WeaponPicker({
  weapons,
  armory,
  busy,
}: {
  weapons: Weapon[]
  armory: Armory | null
  busy: boolean
}) {
  const [shown, setShown] = useState(false)
  const last = armory?.lastDraw ?? null
  return (
    <div className="stage-weapons" data-testid="weapon-picker">
      <div className="stage-weapon-head">
        <p className="font-game text-[15px]">
          무기{' '}
          <span className="text-[12px] text-muted">
            · 뽑기권 <b data-testid="weapon-tickets">{armory?.tickets ?? 0}</b>장
          </span>
        </p>
        <button
          type="button"
          className="stage-weapon-draw"
          data-testid="weapon-draw"
          disabled={busy || !armory || armory.tickets <= 0}
          onClick={() => {
            sfx.stamp()
            haptic.medium()
            setShown(true)
            void useRaisingStore.getState().drawWeapon()
          }}
        >
          무기 뽑기
        </button>
      </div>
      {shown && last && (
        <p
          className="stage-weapon-drawn animate-pop"
          data-testid="weapon-drawn"
          data-new={last.isNew}
        >
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GRADE_BADGE[last.grade]}`}
          >
            {last.gradeName}
          </span>{' '}
          {last.name} {last.isNew ? '— 새 무기!' : '— 합성 재료 +1'}
        </p>
      )}
      <ul className="stage-weapon-list">
        {weapons.map((w) => (
          <li key={`${w.kind}-${w.grade}`}>
            <button
              type="button"
              disabled={busy || w.equipped}
              aria-pressed={w.equipped}
              onClick={() => {
                sfx.tap()
                haptic.light()
                void useRaisingStore.getState().equipWeapon(w.kind, w.grade)
              }}
              className={`stage-weapon ${w.equipped ? 'is-equipped' : ''}`}
              data-testid="weapon"
              data-kind={w.kind}
              data-grade={w.grade}
            >
              <GunSprite kind={w.kind} grade={w.grade} width={88} />
              <span className="font-game text-[15px]">
                {w.name}{' '}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GRADE_BADGE[w.grade]}`}
                >
                  {w.gradeName}
                </span>
              </span>
              <span className="text-[11px] text-muted">
                {w.equipped ? '장착 중 · ' : ''}공격 ×{w.damagePercent / 100} ·{' '}
                {(1000 / w.fireMs).toFixed(1)}발/초{w.count > 1 ? ` · ${w.count}개` : ''}
              </span>
              <span
                className="stage-weapon-effect"
                data-testid="weapon-effect"
                title={WEAPON_EFFECTS[w.kind].desc}
              >
                {WEAPON_EFFECTS[w.kind].name} · {WEAPON_EFFECTS[w.kind].desc}
              </span>
            </button>
            {armory && w.grade !== 'UR' && w.count >= armory.mergeCount && (
              <button
                type="button"
                className="stage-weapon-merge"
                data-testid="weapon-merge"
                disabled={busy}
                onClick={() => {
                  sfx.levelUp()
                  haptic.medium()
                  void useRaisingStore.getState().mergeWeapon(w.kind, w.grade as MergeGrade)
                }}
              >
                {armory.mergeCount}개 합쳐 등급 올리기
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stage-stat">
      <span className="block text-[12px] text-muted">{label}</span>
      <b className="block font-game text-[26px] font-normal">{value}</b>
    </div>
  )
}

const CARD_ROLES: Record<Card['code'], string> = {
  atk: '공격',
  spd: '연사',
  water: '물 마법',
  fire: '불 마법',
  lightning: '번개 마법',
}

const GRADE_ORDER: Record<Card['grade'], number> = { N: 0, R: 1, SR: 2, UR: 3 }

/**
 * 카드 석 장 고르기 (330번): 제목이 쿵 하고 찍히고, 카드가 아래에서 차례로 튀어 올라 뒤집히며 자리를 잡는다(소리·진동). 누르면 그 카드가 번쩍 커졌다 사라진 뒤
 * onPick. 마법 카드는 지금 레벨과 오를 레벨을 보인다(392번).
 */
function CardPick({
  title,
  sub,
  levels,
  onPick,
}: {
  title: string
  sub: string
  levels: MagicLevels
  onPick: (card: Card) => void
}) {
  const [cards] = useState(() => pickCards(levels))
  const [chosen, setChosen] = useState<Card | null>(null)
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (pickTimer.current) clearTimeout(pickTimer.current)
    },
    [],
  )
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
    <div className="stage-cards" data-testid="mental-cards">
      <header className="stage-card-heading">
        <span className="stage-card-crown" aria-hidden="true">
          ✦
        </span>
        <p className="stage-card-eyebrow">MENTAL UPGRADE</p>
        <h3 className="stage-card-title">{title}</h3>
        <p className="stage-card-subtitle">{sub}</p>
        <span className="stage-card-count">세 가지 가능성 · 단 한 장의 선택</span>
      </header>
      <div className="stage-card-options">
        {cards.map((c, i) => (
          <button
            key={`${c.code}-${c.grade}`}
            type="button"
            disabled={chosen !== null}
            style={
              {
                animationDelay: chosen ? '0ms' : `${120 + i * 110}ms`,
                '--card-accent': c.color,
              } as CSSProperties
            }
            data-card={c.code}
            data-grade={c.grade}
            data-chosen={chosen === c}
            aria-pressed={chosen === c}
            onClick={(ev) => {
              if (chosen) {
                return
              }
              setChosen(c)
              sfx.cash()
              haptic.heavy()
              useFx.getState().burstAt(ev.currentTarget, 'sparks')
              pickTimer.current = setTimeout(
                () => onPick(c),
                matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240,
              )
            }}
            className={`stage-card-option ${
              chosen === c
                ? 'animate-mental-card-pick'
                : chosen
                  ? 'opacity-30'
                  : 'animate-mental-card-in'
            }`}
          >
            <span className="stage-card-icon" aria-hidden="true">
              <span>{c.icon}</span>
            </span>
            <span className="stage-card-copy">
              <span className="stage-card-meta">
                <span>
                  {GRADE_NAMES[c.grade]} · {CARD_ROLES[c.code]}
                </span>
                <span aria-hidden="true">✦ {String(i + 1).padStart(2, '0')}</span>
              </span>
              <span className="stage-card-name">{c.name}</span>
              {c.level && (
                <span className="stage-card-level" data-testid="card-level">
                  {c.level.from === 0
                    ? `새 마법 · Lv.${c.level.to}`
                    : `Lv.${c.level.from} → Lv.${c.level.to}`}
                </span>
              )}
              <span className="stage-card-description">{c.desc}</span>
            </span>
            <span className="stage-card-effect">
              <span aria-hidden="true">＋</span>
              {c.effect}
            </span>
            <span className="stage-card-select" aria-hidden="true">
              {chosen === c ? '✓ 선택 완료' : '선택 ›'}
            </span>
          </button>
        ))}
      </div>
      <p className="stage-card-footnote">선택 즉시 적용 · 이번 전투 동안 유지</p>
    </div>
  )
}

/**
 * 한 판: Phaser를 늦게 불러 컨테이너에 띄우고, 그 위에 멘탈(멘탈벽 위)·레벨(왼쪽 세로)·시간(오른쪽 위)과 큰 알림을 그린다. 레벨이 오르면 전투 위에 카드 고르기가 뜬다. 오른쪽 위 Ⅱ로 언제든
 * 나갈 수 있다(345번): 전투를 멈추고 물은 뒤 나가면 강화 없이 결산이다.
 */
function Battle({
  mode,
  stage,
  genre,
  hero,
  cards,
  pauseRequest,
  onPick,
  onDone,
  onQuit,
}: {
  mode: BattleMode
  stage?: StageSpec
  genre: Genre
  hero: Hero
  cards: Card[]
  pauseRequest: number
  onPick: (card: Card) => void
  onDone: (outcome: Outcome) => void
  /** 싸우다 나간다 (345번): 이번 분기 강화 없이 결산으로. */
  onQuit: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<BattleHandle | null>(null)
  const loadout = useRef(loadoutOf(hero.weapon, hero.upgrades))
  const [hud, setHud] = useState<Hud | null>(null)
  const [banner, setBanner] = useState<{ text: string; color: string; id: number } | null>(null)
  const [hurt, setHurt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [asking, setAsking] = useState(false)

  const togglePause = useEffectEvent(() => {
    handle.current?.setPaused(!asking)
    setAsking(!asking)
  })
  useEffect(() => {
    if (pauseRequest > 0) togglePause()
  }, [pauseRequest])

  // biome-ignore lint/correctness/useExhaustiveDependencies: 재시도 횟수가 바뀌면 실패한 전장 로더를 새로 만든다.
  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    const el = host.current
    if (!el) {
      return
    }
    let cancelled = false
    let bannerId = 0
    void import('./battle')
      .then(({ startBattle }) => {
        if (cancelled) {
          return
        }
        handle.current = startBattle(el, {
          mode,
          stage,
          genre,
          hero,
          loadout: loadout.current,
          onReady: () => setLoading(false),
          onError: (message) => {
            setLoading(false)
            setLoadError(message)
          },
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
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          setLoadError('전장을 불러오지 못했어요. 다시 시도해주세요.')
        }
      })
    return () => {
      cancelled = true
      handle.current?.stop()
      handle.current = null
    }
  }, [mode, stage, genre, hero, onDone, attempt])

  return (
    <>
      <div ref={host} className="absolute inset-0" data-testid="battle-canvas" />
      {loadError && (
        <div className="stage-overlay">
          <div className="stage-result-card">
            <p role="alert">{loadError}</p>
            <button
              type="button"
              className="stage-primary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              다시 불러오기
            </button>
            <button type="button" className="stage-skip" onClick={onQuit}>
              이번 분기는 쉬어가기
            </button>
          </div>
        </div>
      )}
      {loading && (
        <p className="absolute inset-0 grid place-items-center font-game text-[18px] text-ink">
          전장을 여는 중…
        </p>
      )}
      <div
        className="pointer-events-none absolute inset-0 transition-shadow"
        style={{ boxShadow: hurt ? 'inset 0 0 120px 40px rgba(255,79,109,0.55)' : 'none' }}
      />
      {hud && !loadError && (
        <>
          {/* 위의 흰 판을 없앴다 (390번): 적이 내려오는 위쪽 가운데를 비우고, 멘탈은 멘탈벽 위에, 레벨은 왼쪽 가장자리에 세로로 둔다. */}
          <div className="battle-hud" data-testid="battle-hud">
            <div className="battle-corner">
              {hud.segment && (
                <b className="battle-segment" data-testid="battle-segment">
                  {hud.boss ? '보스' : `구간 ${hud.segment.at}/${hud.segment.total}`}
                </b>
              )}
              <time data-testid="battle-timer">
                {Math.floor(hud.secondsLeft / 60)}:{String(hud.secondsLeft % 60).padStart(2, '0')}
              </time>
              <button
                type="button"
                aria-label="전투 일시정지"
                className="battle-pause"
                data-testid="mental-quit"
                onClick={() => {
                  sfx.tap()
                  handle.current?.setPaused(true)
                  setAsking(true)
                }}
              >
                Ⅱ
              </button>
            </div>
            {hud.boss && (
              <div className="battle-boss" data-testid="battle-boss">
                <b>{hud.boss.name}</b>
                <div
                  className="battle-boss-health"
                  role="progressbar"
                  aria-label={`${hud.boss.name} 체력`}
                  aria-valuenow={Math.round(hud.boss.hp * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${hud.boss.hp * 100}%` }} />
                </div>
              </div>
            )}
            <div className="battle-level" data-testid="battle-level">
              <b>
                <small>Lv.</small>
                {hud.level}
              </b>
              <div
                className="battle-xp"
                role="progressbar"
                aria-label="다음 레벨 경험치"
                aria-valuenow={Math.round(hud.xp * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ height: `${hud.xp * 100}%` }} />
              </div>
              <span>
                <small>처치</small>
                <b>{hud.kills}</b>
              </span>
            </div>
            <div className="battle-wall" data-testid="battle-wall">
              <span className="battle-wall-label">
                <span aria-hidden="true">♥</span> 멘탈벽
              </span>
              <div
                className="battle-health"
                role="progressbar"
                aria-label="멘탈벽 내구도"
                aria-valuenow={hud.mental}
                aria-valuemin={0}
                aria-valuemax={hud.maxMental}
              >
                <i style={{ width: `${(hud.mental / hud.maxMental) * 100}%` }} />
                <strong>
                  {hud.mental} / {hud.maxMental}
                </strong>
              </div>
            </div>
          </div>
          <div className="battle-footer">
            <span>{mode === 'advance' ? '끌어서 움직이기 · 자동 사격' : '누른 방향으로 발사'}</span>
            <div>
              {[...new Set(cards.map((c) => c.code))].map((code) => {
                const same = cards.filter((c) => c.code === code)
                const top = same.reduce((a, b) =>
                  GRADE_ORDER[b.grade] > GRADE_ORDER[a.grade] ? b : a,
                )
                // 마법은 고른 수가 곧 레벨이다(392번).
                const label = top.level
                  ? `${top.name} Lv.${same.length}`
                  : `${top.name} ${same.length}장`
                return (
                  <span
                    key={code}
                    data-grade={top.grade}
                    title={label}
                    role="img"
                    aria-label={label}
                  >
                    {top.icon}
                    <small>{same.length}</small>
                  </span>
                )
              })}
            </div>
          </div>
        </>
      )}
      {banner && (
        <p
          key={banner.id}
          className="stage-banner animate-mental-banner"
          style={{ background: banner.color }}
          aria-live="polite"
        >
          {banner.text}
        </p>
      )}
      {asking && (
        <div
          className="stage-overlay stage-pause-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="전투 나가기"
          data-testid="mental-quit-ask"
        >
          <div className="stage-result-card">
            <h3 className="font-game text-[24px]">잠깐 쉬어가요</h3>
            <p className="mt-1 text-[14px] text-muted">
              나가면 이번 판은 기록되지 않습니다. 물리친 적과 고른 카드도 남지 않습니다.
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
                className="stage-primary"
                data-testid="mental-quit-no"
              >
                계속 지키기 ▶
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.tap()
                  onQuit()
                }}
                className="stage-skip"
                data-testid="mental-quit-yes"
              >
                전투 마치기 · 강화 없음
              </button>
            </div>
          </div>
        </div>
      )}
      {levelUp !== null && hud && (
        <div className="stage-overlay stage-card-overlay" data-testid="mental-levelup">
          <CardPick
            key={levelUp}
            title={levelUp === 1 ? '오늘의 마음가짐' : `한층 더 단단하게 · Lv. ${levelUp}`}
            sub={
              levelUp === 1
                ? '한 장을 고르세요. 레벨이 오를 때마다 또 고릅니다'
                : '카드 한 장을 더 쌓으세요'
            }
            levels={loadout.current}
            onPick={(card) => {
              loadout.current = applyCard(loadout.current, card)
              onPick(card)
              setLevelUp(null)
              handle.current?.applyLoadout(loadout.current)
            }}
          />
        </div>
      )}
    </>
  )
}
