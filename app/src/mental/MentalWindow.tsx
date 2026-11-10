import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorial } from '@web/features/raising/tutorial'
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
import { type AssaultSpec, assaultSpec } from './assault'
import { STAGE_ASSETS } from './assets'
import type { BattleHandle, Hud, Outcome } from './battle'
import {
  AUTO_PICK_MS,
  autoPickIndex,
  READY_GAP_MS,
  REVEAL_TIMING,
  revealPlan,
  topGrade,
} from './cardReveal'
import { applyCard, type Card, GRADE_NAMES, loadoutOf, pickCards } from './cards'
import { ENEMIES } from './enemies'
import { GunSprite } from './GunSprite'
import { BATTLE_SECONDS } from './genres'
import { StagePortrait } from './StagePortrait'
import { GRADE_BADGE } from './WeaponInventory'
import { FIRE_STYLE_NAMES, WEAPON_EFFECTS, WEAPON_TRAITS } from './weaponEffects'
import './stage.css'
import { type Hero, heroOf, type Weapon } from './hero'
import { WallGainFlight } from './WallGainFlight'
import { queueWallGain, shownPrice, type WallGain } from './wallGain'

type Genre = NonNullable<Company['mental']>['genre']

/**
 * 멘탈 전투 창 (decisions.md 328·330·339·345·346·369번): 스테이지 선택에서 고른 판(번호 스테이지 = 전진 모드, EX = 디펜스)의 출전 화면, 무기 고르기,
 * 출전 버튼 → 한 판(Phaser, 늦게 불러온다. 레벨이 오를 때마다 멈추고 카드를 고른다) → 결과를 서버에 보내고 받은 보상을 보인다 → onDone(돌아가기).
 * 돌아가거나 싸우다 나가면(345번) 보고 없이 바로 onDone이다. 화면 전체를 쓴다.
 */
export function MentalWindow({
  entry,
  company,
  onDone,
  onChangeWeapon,
}: {
  entry: BattleEntry
  company: Company
  onDone: () => void
  /** 출전 화면의 "무기 바꾸기": 전투 창을 닫고 메인의 무기 인벤토리를 연다(Windows가 맡는다). */
  onChangeWeapon: () => void
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
  // 종목 회의 뒤 전투(414번): 맞힌 쪽에 걸었으면 공격 판(매도벽 돌파, 413번), 틀렸으면 디펜스.
  const assaultLevel = entry.kind === 'invest' && entry.mode === 'ASSAULT' ? entry.level : null
  const mode: BattleMode = assaultLevel !== null ? 'assault' : 'defense'
  const stockName = company.invest?.stockName
  const assault = useMemo(
    () => (assaultLevel === null ? undefined : assaultSpec(assaultLevel, { name: stockName })),
    [assaultLevel, stockName],
  )
  const perChapter = company.stages?.perChapter
  // 한 번만 만든다: 새 객체면 전투(Battle)의 effect가 다시 돌아 판이 처음부터 다시 시작됐다.
  // 종목 회의 뒤 디펜스 (414번)는 세기(level)만큼의 번호 스테이지 판을 빌려 쓴다. 보스 판(챕터 끝)은 피한다.
  const stageNumber =
    entry.kind === 'stage'
      ? entry.stage
      : entry.kind === 'invest'
        ? investStage(entry.level, perChapter)
        : null
  const spec: StageSpec | undefined = useMemo(
    () => (stageNumber === null ? undefined : stageSpec(stageNumber, perChapter)),
    [stageNumber, perChapter],
  )
  const genre: Genre = company.mental?.genre ?? 'DEFENSE'
  const [saved, setSaved] = useState(false)

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
    } else if (entry.kind === 'invest') {
      await store.reportInvestBattle(entry.mode, outcome.stars)
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
  const reward = saved && entry.kind !== 'invest' ? (company.stages?.lastResult ?? null) : null
  const investBattle = saved && entry.kind === 'invest' ? company.invest?.outcome?.battle : null

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
            stage={mode === 'assault' ? undefined : spec}
            assault={assault}
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
                {entry.kind === 'stage'
                  ? '멘탈 수련'
                  : entry.kind === 'invest'
                    ? `종목 회의 뒤 전투 · 세기 ${entry.level}`
                    : 'EX 도전 · 분기에 한 번'}
              </span>
              <h2>
                {entry.kind === 'stage'
                  ? `수련 ${stageLabel(entry.stage, perChapter)}`
                  : entry.kind === 'invest'
                    ? mode === 'assault'
                      ? '매도벽 돌파!'
                      : '멘탈을 지켜라'
                    : 'EX 디펜스'}
              </h2>
              {/* 매도벽 돌파는 설명 글(어느 쪽에 걸었나·별 배율)을 뺐다 (439번). */}
              {entry.kind === 'invest' && mode !== 'assault' && (
                <p data-testid="invest-battle-rule" className="stage-invest-rule">
                  반대로 걸었다. 버틸수록 회의 손실이 줄어든다 · 별 1·2·3개 → 손실 30% · 60% 막기 ·
                  다 막고 판돈 10% 더
                </p>
              )}
              {entry.kind !== 'invest' && (
                <p>{company.mental?.headline ?? '흔들리지 않는 마음으로'}</p>
              )}
            </header>
            <div className="stage-hero-card">
              {mode !== 'assault' && (
                <span className="stage-mode" data-testid="stage-mode">
                  {spec?.boss
                    ? `디펜스 · ${DEFENSE_BOSS_SECONDS / 60}분에 보스 · 제한 시간 ${BATTLE_SECONDS / 60}분 안에 격파`
                    : `디펜스 · 제한 시간 ${BATTLE_SECONDS / 60}분 버티기`}
                </span>
              )}
              {entry.kind === 'invest' && (
                // 회의 뒤 전투의 세기와 오른 이유 (#594): 회사가 크고 사장이 강할수록 적도 강하다.
                <span className="stage-level" data-testid="stage-level">
                  세기 {entry.level}
                  {levelWhy(company.invest?.outcome?.battle?.levelParts)}
                </span>
              )}
              <StagePortrait weapon={heroOf(company).weapon} />
              {mode === 'assault' && (
                <small>패닉셀·투매를 뚫고 전진! 중간 서킷브레이커에서 멘탈 회복</small>
              )}
              {mode !== 'assault' && (
                <>
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
                </>
              )}
            </div>
            <EquippedWeapon
              weapon={heroOf(company).weapon}
              onChange={() => {
                sfx.tap()
                onChangeWeapon()
              }}
            />
            {apiError && (
              <p role="alert" className="stage-error">
                {apiError}
              </p>
            )}
            <div className="stage-enemies">
              {(mode === 'assault'
                ? [
                    { label: '시장가 매도', fill: '#5b8def' },
                    { label: '대량 매도', fill: '#2f5fbf' },
                    { label: '허매도', fill: '#a9c1f0' },
                  ]
                : Object.values(ENEMIES)
              ).map((e) => (
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
            {mode === 'assault' ? (
              <AssaultResult outcome={outcome} battle={investBattle} sending={sending} />
            ) : (
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
                      <span
                        key={i}
                        className={i < outcome.stars ? 'text-[#ffc83d]' : 'text-ink/20'}
                      >
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
                    : investBattle && investBattle.after != null
                      ? `회의 손익 ${signedMoney(investBattle.before)} → ${signedMoney(investBattle.after)}`
                      : !reward
                        ? ''
                        : reward.capital > 0 || reward.tickets > 0
                          ? `${reward.firstClear ? '처음 깼다! ' : ''}${reward.capital > 0 ? `자본 +${money(reward.capital)} · ` : ''}무기 뽑기권 +${reward.tickets}장`
                          : spec && !outcome.win
                            ? '깨면 자본과 무기 뽑기권을 받는다.'
                            : '이번에 더 받을 보상은 없다.'}
                </p>
              </div>
            )}
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

const LEVEL_NAMES: Record<string, string> = {
  news: '기사',
  big: '크게',
  stage: '수련',
  building: '건물',
  year: '연차',
  upgrade: '강화',
}

/** 세기가 오른 이유 한 줄: " · 기사 +2 · 건물 +1". 없으면 빈칸. */
function levelWhy(parts: { code: string; plus: number }[] | undefined): string {
  if (!parts?.length) return ''
  return parts.map((p) => ` · ${LEVEL_NAMES[p.code] ?? p.code} +${p.plus}`).join('')
}

/** 공격 판의 별에 따른 회의 수익 배율 (414번 ②). 서버 `invest.battle`의 규칙과 같다. */
const ASSAULT_MULT = [1, 1.2, 1.5, 2] as const

/**
 * 매도벽 돌파 결과 (#591, decisions.md 428번): 공격 판이 끝나면 돌파 결과만 크게 보인다. 배지·제목은 공격 판 문구, 별 셋을 크게, 숫자 칸은 부순
 * 매도벽·걸린 시간·주가, 가장 크게 회의 수익 배율과 회의 손익 전→후. 디펜스용 레벨·물리친 적·남은 멘탈은 보이지 않는다.
 */
function AssaultResult({
  outcome,
  battle,
  sending,
}: {
  outcome: Outcome
  battle: { before: number; after?: number | null } | null | undefined
  sending: boolean
}) {
  const priceUp =
    outcome.priceStart > 0
      ? Math.round(((outcome.priceEnd - outcome.priceStart) / outcome.priceStart) * 1000) / 10
      : 0
  const mm = Math.floor(outcome.seconds / 60)
  const ss = String(Math.floor(outcome.seconds % 60)).padStart(2, '0')
  const mult = ASSAULT_MULT[Math.max(0, Math.min(3, outcome.stars))]
  return (
    <div className="stage-result-card" data-testid="mental-result" data-mode="assault">
      <span
        className={`inline-block rounded-lg px-3 py-0.5 text-[13px] font-bold text-white ${outcome.win ? 'bg-[#e8434f]' : 'bg-[#6b7a99]'}`}
      >
        {outcome.win ? '매도벽 돌파!' : outcome.reason === 'time' ? '시간 초과' : '멘탈 붕괴'}
      </span>
      <h2 className="mt-2 font-game text-[28px]">
        {outcome.win
          ? '매도벽 돌파!'
          : outcome.reason === 'time'
            ? '매도벽에 막혔다…'
            : '멘탈이 무너졌다…'}
      </h2>
      <p
        className="mt-1 text-[44px] leading-none tracking-[6px]"
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
      <p
        className="mt-2 font-game text-[34px] leading-none text-[#e8434f]"
        data-testid="assault-mult"
      >
        회의 수익 ×{mult}
      </p>
      <p className="mt-2" data-testid="mental-reward">
        {sending ? (
          <span className="text-[14px]">회의 손익을 바꾸는 중…</span>
        ) : battle && battle.after != null ? (
          <span className="block">
            <span className="block text-[13px] text-muted">회의 손익</span>
            <span className="font-game text-[22px]">
              {signedMoney(battle.before)} →{' '}
              <b className={battle.after >= 0 ? 'text-[#e8434f]' : 'text-[#3a86ff]'}>
                {signedMoney(battle.after)}
              </b>
            </span>
          </span>
        ) : null}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2" data-testid="assault-stats">
        <Stat label="부순 매도벽" value={`${outcome.wallsBroken}/${outcome.wallsTotal}`} />
        <Stat label="걸린 시간" value={`${mm}:${ss}`} />
        <Stat label="주가" value={`${priceUp >= 0 ? '+' : ''}${priceUp}%`} />
      </div>
    </div>
  )
}

/**
 * 출전 화면의 든 무기 (#564): 무기 고르기·뽑기·합성은 메인의 무기 인벤토리(WeaponInventory.tsx)로 옮겼다. 여기서는 든 무기만 작게 보이고, 바꾸려면
 * 출전 화면을 닫고 인벤토리를 연다.
 */
function EquippedWeapon({ weapon, onChange }: { weapon: Weapon; onChange: () => void }) {
  return (
    <div className="stage-equipped" data-testid="stage-weapon" data-kind={weapon.kind}>
      <GunSprite kind={weapon.kind} grade={weapon.grade} width={64} />
      <span className="min-w-0 flex-1 text-left">
        <b className="block font-game text-[15px] font-normal">
          {weapon.name}{' '}
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GRADE_BADGE[weapon.grade]}`}
          >
            {weapon.gradeName}
          </span>
        </b>
        <span className="block text-[11px] text-muted">
          {FIRE_STYLE_NAMES[weapon.kind]} · {WEAPON_EFFECTS[weapon.kind].name} · 강점{' '}
          {WEAPON_TRAITS[weapon.kind].strength}
        </span>
      </span>
      <button
        type="button"
        className="stage-weapon-change"
        data-testid="stage-weapon-change"
        onClick={onChange}
      >
        무기 바꾸기
      </button>
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
  cat: '동료',
  water: '물 마법',
  fire: '불 마법',
  lightning: '번개 마법',
  earth: '땅 마법',
}

const GRADE_ORDER: Record<Card['grade'], number> = { N: 0, R: 1, SR: 2, UR: 3 }

/** 카드 한 장의 앞뒤 (393번): 뒷면 → 떨리며 빛이 샘 → 옆으로 누움 → 앞면. */
type Face = 'back' | 'tease' | 'turn' | 'front'

/** 반짝이 수: 희귀 8, 영웅 10, 전설 14. 일반은 없다. */
const SPARKLES: Record<Card['grade'], number> = { N: 0, R: 8, SR: 10, UR: 14 }

/**
 * 카드 석 장 고르기 (330·393·420번): 석 장이 뒷면으로 쿵 깔리고(화면 흔들림은 408번에서 뺐다), 왼쪽부터 한 장씩 떨리며 빛이 새다가 뒤집힌다. 펼치는 빠르기는 모든
 * 등급이 같고(420번), 펼친 순간의 연출만 등급이 높을수록 세다: 일반은 가볍게 탁, 희귀는 파란 빛과 반짝이, 영웅은 보라 빛기둥·화면 번쩍·진동, 전설은
 * 화면이 잠깐 어두워졌다가 금빛 폭발·빛줄기·큰 소리. 뒷면 테두리가 등급을 살짝 흘린다(높을수록 미리 빛난다). 다 펼친 뒤에만 고르고, 그 전에 누르면 남은 카드를 한 번에 펼친다. 움직임 줄이기면
 * 처음부터 앞면이다. 고르면 그 카드가 번쩍 커지며 날아가고 나머지는 가라앉은 뒤 onPick. 순서와 시각은 cardReveal.ts.
 * 다 펼친 뒤 AUTO_PICK_MS(5초) 안에 고르지 않으면 autoPickIndex의 카드를 저절로 고른다(#566). 그 카드는 미리 빛나고 남은 시간이 막대로 줄어든다.
 * 일시정지(paused)나 앱이 뒤로 간 동안은 세지 않는다.
 */
function CardPick({
  title,
  sub,
  levels,
  paused,
  onPick,
}: {
  title: string
  sub: string
  levels: Parameters<typeof pickCards>[0]
  paused: boolean
  onPick: (card: Card) => void
}) {
  const manual = useTutorial((s) => s.active)
  const [cards] = useState(() => pickCards(levels))
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const plan = useMemo(() => revealPlan(cards.map((c) => c.grade)), [cards])
  const [faces, setFaces] = useState<Face[]>(() => cards.map(() => (reduced ? 'front' : 'back')))
  const facesNow = useRef(faces)
  const [ready, setReady] = useState(reduced)
  const readyNow = useRef(reduced)
  const [dim, setDim] = useState(false)
  const [chosen, setChosen] = useState<Card | null>(null)
  const auto = useMemo(() => autoPickIndex(cards), [cards])
  const [autoLeft, setAutoLeft] = useState(AUTO_PICK_MS)
  const root = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }
  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }
  const setFace = (i: number, face: Face) => {
    facesNow.current = facesNow.current.map((f, j) => (j === i ? face : f))
    setFaces(facesNow.current)
  }
  const makeReady = () => {
    readyNow.current = true
    setReady(true)
  }

  /** 앞면이 보이는 순간의 소리·진동·화면 연출. 카드 둘레의 빛·반짝이·빛기둥·빛줄기는 CSS(stage.css)가 그린다. */
  const revealFx = (grade: Card['grade'], el: Element | null | undefined) => {
    const fx = useFx.getState()
    if (grade === 'N') {
      sfx.cardFlip()
      haptic.light()
    } else if (grade === 'R') {
      sfx.cardRare()
      haptic.light()
    } else if (grade === 'SR') {
      sfx.cardEpic()
      haptic.heavy()
      fx.flashScreen('rgba(190,140,255,0.42)')
    } else {
      sfx.cardLegend()
      haptic.burst()
      fx.flashScreen('rgba(255,216,110,0.6)')
      fx.burstAt(el, 'coins')
      fx.burstAt(el, 'sparks')
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: 카드는 처음 한 번 정해지고 펼치는 순서도 한 번만 돈다.
  useEffect(() => {
    if (reduced) {
      sfx.levelUp()
      haptic.medium()
      return
    }
    sfx.cardDeal()
    haptic.medium()
    plan.steps.forEach((step, i) => {
      const grade = cards[i].grade
      later(step.tease, () => {
        setFace(i, 'tease')
        sfx.cardTease(REVEAL_TIMING[grade].tease)
      })
      later(step.turn, () => setFace(i, 'turn'))
      later(step.face, () => {
        setFace(i, 'front')
        revealFx(grade, buttons.current[i])
        // 전설은 앞면이 보인 뒤에 화면이 잠깐 어두워진다 (420번): 뜸에서 미리 알리지 않는다. 다음 카드를 늦추지 않는다.
        if (grade === 'UR') setDim(true)
      })
      if (grade === 'UR') later(step.face + 350, () => setDim(false))
    })
    later(plan.ready, makeReady)
    return clearTimers
  }, [])

  /** 다 펼치기 전에 누르면 남은 카드를 한 번에 펼친다. 연출은 남은 것 가운데 가장 높은 등급 것을 한 번만. */
  const skip = () => {
    if (readyNow.current || facesNow.current.every((f) => f === 'front')) return
    clearTimers()
    const pending = cards.filter((_, i) => facesNow.current[i] !== 'front')
    const top = topGrade(pending.map((c) => c.grade))
    const at = cards.findIndex((c, i) => facesNow.current[i] !== 'front' && c.grade === top)
    facesNow.current = cards.map(() => 'front')
    setFaces(facesNow.current)
    setDim(false)
    revealFx(top, buttons.current[at])
    later(READY_GAP_MS, makeReady)
  }

  const pick = (c: Card, el: HTMLElement) => {
    if (chosen) return
    if (!readyNow.current) {
      skip()
      return
    }
    setChosen(c)
    sfx.cardPick()
    haptic.heavy()
    const fx = useFx.getState()
    fx.burstAt(el, 'sparks')
    if (!reduced) {
      fx.flashScreen('rgba(255,240,190,0.4)')
    }
    later(reduced ? 0 : 380, () => onPick(c))
  }

  const autoPick = useEffectEvent(() => {
    const el = buttons.current[auto]
    if (el) pick(cards[auto], el)
  })
  // 자동 선택 시계: 고를 수 있는 동안만 0.1초씩 센다. 멈춤·앱이 뒤로 간 동안(document.hidden)은 그대로 둔다.
  useEffect(() => {
    if (!ready || chosen || paused || manual) return
    const id = setInterval(() => {
      if (document.hidden) return
      setAutoLeft((left) => Math.max(0, left - 100))
    }, 100)
    return () => clearInterval(id)
  }, [ready, chosen, paused, manual])
  useEffect(() => {
    if (!manual && ready && !chosen && autoLeft <= 0) autoPick()
  }, [ready, chosen, autoLeft, manual])

  return (
    <>
      {!ready && (
        <div
          className="stage-card-catcher"
          data-dim={dim}
          aria-hidden="true"
          onPointerDown={skip}
        />
      )}
      <div
        ref={root}
        className="stage-cards"
        data-testid="mental-cards"
        data-revealed={ready}
        onPointerDown={() => {
          if (!readyNow.current) skip()
        }}
      >
        <header className="stage-card-heading">
          <span className="stage-card-crown" aria-hidden="true">
            ✦
          </span>
          <p className="stage-card-eyebrow">MENTAL UPGRADE</p>
          <h3 className="stage-card-title">{title}</h3>
          <p className="stage-card-subtitle" aria-live="polite">
            {ready ? sub : '카드를 펼치는 중 · 누르면 바로 펼쳐요'}
          </p>
          <span className="stage-card-count">세 가지 가능성 · 단 한 장의 선택</span>
        </header>
        <div className="stage-card-options">
          {cards.map((c, i) => {
            const face = faces[i]
            const shown = face === 'front'
            return (
              <div
                key={`${c.code}-${c.grade}`}
                className="stage-card-slot"
                data-grade={c.grade}
                data-face={face}
                data-chosen={chosen === c}
                data-auto={ready && !chosen && i === auto}
                style={
                  {
                    '--card-accent': c.color,
                    '--deal-delay': `${i * 70}ms`,
                    '--tease-ms': `${REVEAL_TIMING[c.grade].tease}ms`,
                    '--turn-ms': `${REVEAL_TIMING[c.grade].turn}ms`,
                  } as CSSProperties
                }
              >
                {shown && !reduced && c.grade !== 'N' && (
                  <>
                    <span className="stage-card-fx" aria-hidden="true">
                      <span className="stage-card-glow" />
                      {c.grade === 'SR' && <span className="stage-card-pillar" />}
                      {c.grade === 'UR' && <span className="stage-card-rays" />}
                    </span>
                    <span className="stage-card-fx is-front" aria-hidden="true">
                      {c.grade === 'UR' && <span className="stage-card-ring" />}
                      {Array.from({ length: SPARKLES[c.grade] }, (_, k) => (
                        <i
                          // biome-ignore lint/suspicious/noArrayIndexKey: 반짝이는 자리만 다르고 늘 같은 수다.
                          key={k}
                          style={
                            {
                              '--a': `${(360 / SPARKLES[c.grade]) * k + (k % 2) * 14}deg`,
                              '--d': `${54 + (k % 3) * 18}px`,
                              animationDelay: `${(k % 4) * 40}ms`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </span>
                  </>
                )}
                {chosen === c && !reduced && (
                  <span className="stage-card-fx is-front" aria-hidden="true">
                    <span className="stage-card-ring is-pick" />
                  </span>
                )}
                <button
                  ref={(el) => {
                    buttons.current[i] = el
                  }}
                  type="button"
                  disabled={chosen !== null}
                  aria-disabled={!ready}
                  aria-label={shown ? undefined : `${i + 1}번째 카드 · 아직 뒤집혀 있음`}
                  data-card={c.code}
                  data-grade={c.grade}
                  data-face={face}
                  data-chosen={chosen === c}
                  aria-pressed={chosen === c}
                  onClick={(ev) => pick(c, ev.currentTarget)}
                  className={`stage-card-option ${
                    chosen === c ? 'animate-mental-card-pick' : chosen ? 'is-passed' : ''
                  }`}
                >
                  <span className="stage-card-back" aria-hidden="true">
                    <span className="stage-card-back-emblem">✦</span>
                  </span>
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
                    {c.mates && (
                      <span className="stage-card-level" data-testid="card-mates">
                        고양이 {c.mates.from} → {c.mates.to}마리
                      </span>
                    )}
                  </span>
                  <span className="stage-card-effect">
                    <span aria-hidden="true">＋</span>
                    {c.effect}
                  </span>
                  <span className="stage-card-select" aria-hidden="true">
                    {chosen === c ? '✓ 선택 완료' : '선택 ›'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
        {ready && !chosen && manual ? (
          <p className="stage-card-manual" data-testid="card-manual">
            카드를 직접 고를 때까지 전투는 멈춰 있어요
          </p>
        ) : ready && !chosen ? (
          <div className="stage-card-auto" data-testid="card-auto">
            <span
              className="stage-card-auto-bar"
              style={{ transform: `scaleX(${autoLeft / AUTO_PICK_MS})` }}
              aria-hidden="true"
            />
            <p className="stage-card-footnote">
              {Math.ceil(autoLeft / 1000)}초 뒤 「{cards[auto].name}」 자동 선택
            </p>
          </div>
        ) : (
          <p className="stage-card-footnote">선택 즉시 적용 · 이번 전투 동안 유지</p>
        )}
      </div>
    </>
  )
}

/**
 * 한 판: Phaser를 늦게 불러 컨테이너에 띄우고, 그 위에 멘탈(멘탈벽 위)·레벨(왼쪽 세로)·시간(오른쪽 위)과 큰 알림을 그린다. 레벨이 오르면 전투 위에 카드 고르기가 뜬다. 오른쪽 위 Ⅱ로 언제든
 * 나갈 수 있다(345번): 전투를 멈추고 물은 뒤 나가면 강화 없이 결산이다.
 */
function Battle({
  mode,
  stage,
  assault,
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
  /** 공격 판(mode 'assault', decisions.md 413번)의 판: assaultSpec(level)을 useMemo로 한 번만 만들어 넘긴다(새 객체면 판이 다시 시작된다). */
  assault?: AssaultSpec
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
  const [gains, setGains] = useState<WallGain[]>([])
  const gainId = useRef(0)
  const priceTarget = useRef<HTMLElement>(null)
  const displayPrice = hud?.assault ? shownPrice(hud.assault.price, gains) : 0
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
    setGains([])
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
          assault,
          genre,
          hero,
          loadout: loadout.current,
          onReady: () => setLoading(false),
          onError: (message) => {
            setLoading(false)
            setLoadError(message)
          },
          onHud: setHud,
          onWallGain: (amount, start) => {
            const gain = { id: ++gainId.current, amount, start }
            setGains((queue) => queueWallGain(queue, gain))
          },
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
  }, [mode, stage, assault, genre, hero, onDone, attempt])

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
          <div
            className={`battle-hud${hud.assault ? ' battle-hud-assault' : ''}`}
            data-testid="battle-hud"
          >
            <div className="battle-corner">
              {hud.segment && (
                <b className="battle-segment" data-testid="battle-segment">
                  {hud.boss
                    ? '보스'
                    : hud.assault
                      ? `남은 벽 ${hud.assault.wallsTotal - hud.assault.wallsBroken}`
                      : `구간 ${hud.segment.at}/${hud.segment.total}`}
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
            {hud.assault && (
              <div className="battle-price" data-testid="battle-price">
                <span className="battle-price-now">
                  <small className="battle-price-name">{hud.assault.name}</small>
                  <b className="battle-price-value">{displayPrice.toLocaleString()}</b>
                  <em ref={priceTarget} className="battle-price-up" data-testid="battle-price-up">
                    ▲{(((displayPrice - hud.assault.start) / hud.assault.start) * 100).toFixed(1)}%
                  </em>
                </span>
                <span className="battle-price-goal">
                  <small className="battle-price-name">목표가</small>
                  <b className="battle-price-target">{hud.assault.target.toLocaleString()}</b>
                </span>
              </div>
            )}
            {hud.boss && (
              <div
                className={`battle-boss${hud.assault ? ' battle-boss-low' : ''}`}
                data-testid="battle-boss"
              >
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
            <div
              className={`battle-wall${hud.assault ? ' battle-wall-assault' : ''}`}
              data-testid="battle-wall"
            >
              <span className="battle-wall-label">
                <span aria-hidden="true">♥</span> {hud.assault ? '멘탈' : '멘탈벽'}
              </span>
              <div
                className="battle-health"
                role="progressbar"
                aria-label={hud.assault ? '멘탈' : '멘탈벽 내구도'}
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
          {gains[0] && (
            <WallGainFlight
              key={gains[0].id}
              gain={gains[0]}
              target={priceTarget}
              paused={asking || levelUp !== null}
              onDone={() => setGains((queue) => queue.slice(1))}
            />
          )}
          <div className={`battle-footer${hud.assault ? ' battle-footer-assault' : ''}`}>
            <span>
              {mode === 'assault'
                ? '좌우로 끌거나 화면 왼쪽·오른쪽 누르기 · 위로 자동 사격'
                : mode === 'advance'
                  ? '끌어서 움직이기 · 자동 사격'
                  : '누른 방향으로 발사'}
            </span>
            <div>
              {[...new Set(cards.map((c) => c.code))].map((code) => {
                const same = cards.filter((c) => c.code === code)
                const top = same.reduce((a, b) =>
                  GRADE_ORDER[b.grade] > GRADE_ORDER[a.grade] ? b : a,
                )
                // 마법은 고른 수가 곧 레벨이다(392번). 고양이 카드는 함께 싸우는 고양이 수(393번).
                const label =
                  code === 'cat'
                    ? `함께 싸우는 고양이 ${same.length}마리`
                    : top.level
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
                {mode === 'assault' ? '계속 오르기 ▶' : '계속 지키기 ▶'}
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
            paused={asking}
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

/** 종목 회의 뒤 디펜스의 판 (414번): 세기 1이면 1스테이지, 세기마다 두 스테이지씩 단단해진다. 챕터 끝(보스) 판은 한 칸 앞으로. */
function investStage(level: number, perChapter = 10): number {
  const n = Math.max(1, level * 2 - 1)
  return n % perChapter === 0 ? n - 1 : n
}

function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}${money(Math.abs(amount))}`
}
