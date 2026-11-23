import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { diamondText, drawable } from '@web/features/raising/gachaRules'
import { nextStep, officeName } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useLocked, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import {
  TUTORIAL_STEPS,
  tutorialStep,
  unlockedFeatures,
  useTutorial,
} from '@web/features/raising/tutorial'
import { useEffect, useState } from 'react'
import { haptic } from '../../fx/haptics'
import { isMuted, setMuted, sfx } from '../../fx/sound'
import { chapterName, stageLabel } from '../../mental/advance'
import { FIRST_PLAY_KEY, firstMeeting } from '../firstPlay'
import { ClipboardIcon, NewsIcon, SoundIcon } from '../Icons'
import { Sheet } from '../Sheet'
import {
  type BattleEntry,
  stageBadge,
  stageDiamonds,
  type Tab,
  type ToyPanel,
  tabBadge,
  useAppUi,
} from '../ui'
import { useCountUp } from '../useCountUp'
import { OfficeSupport } from '../Windows'
import { BattleUpgrades } from './BattleUpgrades'
import { growthProgress } from './model'
import { StreetLife } from './StreetLife'
import { ToyCityStreet } from './ToyCityStreet'

export function ToyIcon({ kind }: { kind: 'upgrade' | 'heart' | 'settings' | 'auto' }) {
  const paths = {
    upgrade: 'M6 22V3M3 3h18L6 9m11-6v7m-3 2h6v6h-6zM3 22h7',
    heart: 'M12 21S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 13-10 13Z',
    settings:
      'm9 2-1 3-3 1-3 3 2 3-1 4 3 3 4-1 3 3 4-2 1-4 3-2-1-4-4-1-1-4ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    auto: 'M19 7a8 8 0 1 0 1 9M19 2v5h-5m-4 1 6 4-6 4Z',
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  )
}

const MENU = [
  { tab: 'market', text: '채용', Icon: ClipboardIcon },
  { tab: 'issue', text: '이슈', Icon: NewsIcon },
] as const

export function ToyCityHome({ company, connected }: { company: Company; connected: boolean }) {
  const sheet = useAppUi((s) => s.sheet)
  // 확장 뒤 처음 사무실을 볼 때만 새 라이벌이 지어진다 (415번): 다른 탭으로 가면 지운다.
  const rivalRise = useAppUi((s) => s.rivalRise)
  const battle = useAppUi((s) => s.battle)
  useEffect(() => () => useAppUi.getState().setRivalRise(null), [])
  const panel = sheet?.kind === 'toy' ? sheet.panel : null
  const setPanel = (panel: ToyPanel | null) => {
    if (panel === 'assault') {
      useAppUi.getState().setTab('office')
      window.dispatchEvent(new Event('idle-home'))
      return
    }
    if (panel) useAppUi.getState().openSheet({ kind: 'toy', panel })
    else useAppUi.getState().closeSheet()
  }
  const [muted, setMutedState] = useState(isMuted)
  const capital = useCountUp(company.capital)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const tutorialOn = useTutorial((s) => s.active)
  const unlocked = unlockedFeatures(company, tutorialOn)
  const tutorial = tutorialStep(company)
  const upgradeLocked = useLocked(company, 'upgrade')
  const upgradeSpot = useTutorialSpot(company, 'upgrade')
  const marketSpot = useTutorialSpot(company, 'market')
  const settleSpot = useTutorialSpot(company, 'settle')
  const progress = growthProgress(company)
  // 뽑은 직원은 서버가 바로 앉히므로 쉬는 사람이 없다 (#801).
  const staff = company.employees.length
  const plan = company.upgrade
  const changeTab = (tab: Tab) => {
    sfx.tap()
    useAppUi.getState().setTab(tab)
  }
  // 채용은 메뉴를 거치지 않고 가진 다이아가 닿는 만큼 바로 뽑는다 (490·526번). 결과 카드는 Windows가 띄운다. 도감과 확률은 다른 장면 아래의 도감 탭에 있다.
  const [hireNote, setHireNote] = useState<string | null>(null)
  const hire = () => {
    const count = drawable(company)
    if (count < 1) {
      sfx.tap()
      setHireNote(
        company.employees.length >= company.seats
          ? '자리가 꽉 찼어요 · 회사를 넓히면 더 뽑을 수 있어요'
          : '다이아가 모자라요 · 멘탈 보호 스테이지의 별로 얻어요',
      )
      return
    }
    sfx.stamp()
    haptic.medium()
    setHireNote(null)
    void useRaisingStore.getState().draw(count)
  }
  return (
    <div className="toy-home" data-testid="office-scene">
      <ToyCityStreet
        company={company}
        onUpgrade={() => setPanel('upgrade')}
        rise={rivalRise}
        onRiseDone={() => useAppUi.getState().setRivalRise(null)}
      />
      {/* 살아 있는 거리 (#597): 계절·구름·행인. 전투·확장 연출 중에는 멈춘다. */}
      <StreetLife company={company} paused={Boolean(battle) || Boolean(rivalRise)} />
      <div className="toy-growth">
        <div
          role="progressbar"
          aria-label="다음 건물 확장"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.percent)}
        >
          <i style={{ width: `${progress.percent}%` }} />
        </div>
        <span data-testid="growth-progress">{progress.label}</span>
      </div>
      <div className="toy-tools">
        <button
          type="button"
          className="toy-round"
          aria-label="설정"
          onClick={() => setPanel('settings')}
        >
          <ToyIcon kind="settings" />
        </button>
        <button
          type="button"
          className="toy-round"
          aria-pressed={muted}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          onClick={() => {
            setMuted(!muted)
            setMutedState(!muted)
            if (muted) sfx.tap()
          }}
        >
          <SoundIcon off={muted} />
        </button>
      </div>
      <div className="toy-wallets" data-testid="hud">
        <div className="toy-wallet">
          <i aria-hidden="true">₩</i>
          <strong data-testid="company-capital">{money(capital)}</strong>
        </div>
        {/* 다이아 (526번): 직원·고양이·무기 뽑기에 쓴다. */}
        <div
          className="toy-wallet toy-wallet-diamond"
          role="img"
          aria-label={`다이아 ${company.diamonds.amount.toLocaleString()}개`}
        >
          <i aria-hidden="true">
            <DiamondIcon />
          </i>
          <strong data-testid="company-diamonds">
            {company.sandboxInfinite ? '∞' : diamondText(company.diamonds.amount)}
          </strong>
        </div>
      </div>
      {/* 첫 종목회의를 정하기 전까지는 첫 판의 흐름이 이끈다 (#803): 그 뒤에 남은 걸음만 한 줄로 보인다. */}
      {tutorialOn && !firstMeeting(company) && (
        <div className="toy-tutorial" data-testid="tutorial" data-step={tutorial.id}>
          <span>
            {tutorial.n}/{TUTORIAL_STEPS} · {tutorial.short}
          </span>
          <button
            type="button"
            onClick={() => useTutorial.getState().finish()}
            data-testid="tutorial-finish"
          >
            {tutorial.n === TUTORIAL_STEPS ? '끝내기' : '건너뛰기'}
          </button>
        </div>
      )}
      <nav className="toy-side toy-left" aria-label="회사 일">
        {MENU.map(({ tab, text, Icon }) => {
          // 종목회의가 이슈 탭에 있으므로(474번) 종목회의가 열리면 이슈 탭도 연다. 튜토리얼의 종목회의 걸음은 이 메뉴를 거쳐 회의 칸의 버튼으로 이어진다.
          const locked =
            !unlocked.includes(tab) && !(tab === 'issue' && unlocked.includes('settle'))
          const badge = tabBadge(company, tab)
          return (
            <button
              key={tab}
              type="button"
              disabled={locked}
              className={`toy-menu ${tab === 'market' ? marketSpot : tab === 'issue' ? settleSpot : ''}`}
              data-testid={`tab-${tab}`}
              data-locked={locked || undefined}
              onClick={() => (tab === 'market' ? hire() : changeTab(tab))}
            >
              <Icon />
              <span>{text}</span>
              {locked ? <small>잠김</small> : badge && <b className="toy-badge">{badge}</b>}
            </button>
          )
        })}
      </nav>
      <div className="toy-side toy-right">
        <button
          type="button"
          className={`toy-menu toy-expand ${upgradeSpot}`}
          disabled={!plan || upgradeLocked}
          onClick={() => setPanel('upgrade')}
          data-testid="open-upgrade"
          data-locked={upgradeLocked || undefined}
        >
          <ToyIcon kind="upgrade" />
          <span>건물 올리기</span>
          <small>{upgradeLocked ? '잠김' : plan?.affordable ? '확장 가능' : '성장 목표'}</small>
        </button>
        {/* 다이아 미션 (527번, #797): 멘탈 보호 스테이지로 가는 입구. 오늘 EX 디펜스가 남아 있으면 표를 단다. */}
        {company.stages && (
          <button
            type="button"
            className="toy-menu"
            data-testid="stage-open"
            aria-label={`멘탈 보호 스테이지${stageBadge(company) ? ' · EX 디펜스 가능' : ''}`}
            onClick={() => {
              sfx.tap()
              haptic.light()
              setPanel('stage')
            }}
          >
            <ToyIcon kind="heart" />
            <span>멘탈 보호</span>
            {stageBadge(company) && (
              <b className="toy-badge" data-testid="stage-badge" aria-hidden="true">
                {stageBadge(company)}
              </b>
            )}
          </button>
        )}
      </div>
      <div className="toy-speech" role="status">
        {hireNote
          ? hireNote
          : staff > 0
            ? `고양이 ${staff}명이 열심히 일하는 중`
            : '첫 동료를 기다리고 있어요'}
      </div>
      <div className="toy-bottom">
        <OfficeSupport company={company} connected={connected} />
      </div>
      {panel && (
        <Sheet
          title={
            panel === 'upgrade'
              ? '다음 단계로 성장하기'
              : panel === 'stage'
                ? '멘탈 보호 스테이지'
                : panel === 'assault'
                  ? '매도벽 돌파'
                  : panel === 'side'
                    ? '보조게임'
                    : panel === 'battle'
                      ? '자본으로 전투 강화'
                      : '회사 설정'
          }
          testId={`toy-${panel}-sheet`}
          onClose={() => setPanel(null)}
        >
          {panel === 'upgrade' && (
            <>
              <p className="toy-sheet-lead">
                {nextStep(company.grade)?.kind === 'move' && plan
                  ? officeName(plan.to)
                  : '사무실을 더 넓혀요'}
              </p>
              {plan && (
                <>
                  <p>
                    확장 비용 {money(plan.cost)} · 자본 {money(plan.needed)}부터
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {plan.affordable
                      ? '성장할 준비가 됐어요.'
                      : `${money(Math.max(0, plan.needed - company.capital))}을 더 모으면 확장할 수 있어요.`}
                  </p>
                  <button
                    type="button"
                    className="toy-sheet-action"
                    disabled={busy || !plan.affordable || upgradeLocked}
                    data-testid="upgrade"
                    onClick={async () => {
                      sfx.stamp()
                      haptic.heavy()
                      await useRaisingStore.getState().upgrade()
                      if (!useRaisingStore.getState().error) setPanel(null)
                    }}
                  >
                    {busy ? '처리 중…' : '건물 확장하기'}
                  </button>
                </>
              )}
              {error && (
                <p role="alert" className="mt-2 text-red-pen">
                  {error}
                </p>
              )}
            </>
          )}
          {panel === 'stage' && <StageSelect company={company} />}
          {panel === 'assault' && <AssaultSelect company={company} />}
          {panel === 'side' && <SideGames company={company} onMental={() => setPanel('stage')} />}
          {panel === 'battle' && <BattleUpgrades company={company} />}
          {panel === 'settings' && (
            <>
              <p className="toy-sheet-lead">내 속도에 맞춰 회사를 키워요</p>
              <button
                type="button"
                className="toy-sheet-secondary"
                onClick={() => {
                  try {
                    localStorage.removeItem(`${FIRST_PLAY_KEY}:${company.companyId}`)
                    localStorage.removeItem(`investor-game.guide:${company.companyId}`)
                  } catch {
                    /* 저장 불가 환경에서도 안내를 연다. */
                  }
                  useTutorial.getState().start()
                  setPanel(null)
                }}
              >
                튜토리얼 다시 보기
              </button>
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}

/** 보조게임 메뉴 (#698): 주 게임 매도벽 돌파 옆에서 따로 하는 멘탈 보호 스테이지(번호 디펜스와 EX 디펜스). 종목회의는 이슈 탭으로 옮겼다(474번). */
function SideGames({ company, onMental }: { company: Company; onMental: () => void }) {
  const stages = company.stages
  return (
    <div className="toy-side-games" data-testid="side-games">
      <p className="toy-sheet-lead">매도벽 돌파 말고도 할 수 있어요</p>
      <section>
        <h3>멘탈 보호 스테이지</h3>
        <p className="text-sm text-muted">
          몰려오는 불안을 막아 멘탈벽을 지켜요. 깬 만큼 회사의 초당 수입이 늘어요.
        </p>
        <button
          type="button"
          className="toy-stat toy-side-game"
          data-testid="stage-open"
          onClick={() => {
            sfx.tap()
            haptic.light()
            onMental()
          }}
        >
          <small>멘탈 전투 · 디펜스</small>
          <strong>멘탈 보호 ▶</strong>
          <em>
            {stages && stages.best > 0
              ? `${stageLabel(stages.best, stages.perChapter)}까지 · 초당 수입 +${stages.bonusPercent}%`
              : '1-1부터'}
            {stages?.exAvailable ? ' · EX 가능' : ''}
          </em>
        </button>
      </section>
    </div>
  )
}

/**
 * 매도벽 돌파 스테이지 선택 (#698): 주 게임. 1-1부터 차례로 열리고 챕터 끝은 보스다. 스테이지 번호가 매도벽의 세기라 뒤로 갈수록 세진다. 처음 깨면
 * 자본을 받는다. 다이아는 주지 않는다 (526번).
 */
export function AssaultSelect({ company }: { company: Company }) {
  const assaults = company.assaults
  const per = assaults?.perChapter ?? 10
  const last = assaults?.last ?? per
  const best = assaults?.best ?? 0
  const open = Math.min(best + 1, last)
  const chapters = Math.ceil(last / per)
  const openChapter = Math.ceil(open / per)
  const [chapter, setChapter] = useState(openChapter)
  const numbers = Array.from({ length: per }, (_, i) => (chapter - 1) * per + i + 1).filter(
    (n) => n <= last,
  )
  const start = (stage: number) => {
    sfx.stamp()
    haptic.medium()
    useAppUi.getState().startBattle({ kind: 'assault', stage })
  }
  const turn = (to: number) => {
    sfx.tap()
    setChapter(to)
  }
  return (
    <>
      <div className="toy-chapter" data-testid="assault-chapter" data-chapter={chapter}>
        <button
          type="button"
          aria-label="앞 챕터"
          disabled={chapter <= 1}
          onClick={() => turn(chapter - 1)}
        >
          ‹
        </button>
        <p className="toy-sheet-lead">
          챕터 {chapter}
          {chapter > openChapter && <small> · 잠김</small>}
        </p>
        <button
          type="button"
          aria-label="다음 챕터"
          disabled={chapter >= chapters}
          onClick={() => turn(chapter + 1)}
        >
          ›
        </button>
      </div>
      <p className="text-sm text-muted" data-testid="assault-lead">
        {chapter > openChapter
          ? `챕터 ${chapter - 1} 보스를 깨면 열린다`
          : '매도벽을 부수고 올라가요. 처음 깨면 자본을 받아요.'}
      </p>
      <ol className="toy-stage-grid" data-testid="assault-grid">
        {numbers.map((n) => {
          const stars = assaults?.stars[n - 1] ?? 0
          const locked = n > open
          const boss = n % per === 0
          return (
            <li key={n}>
              <button
                type="button"
                className={`toy-stage-pick ${boss ? 'is-boss' : ''} ${stars > 0 ? 'is-cleared' : ''}`}
                disabled={locked}
                data-testid="assault-stage"
                data-stage={n}
                data-stars={stars}
                aria-label={`매도벽 돌파 ${stageLabel(n, per)}${locked ? ' 잠김' : ''}${boss ? ' 보스' : ''} 별 ${stars}개`}
                onClick={() => start(n)}
              >
                <b>{locked ? '🔒' : stageLabel(n, per)}</b>
                <small aria-hidden="true">
                  {boss && !locked ? '보스 ' : ''}
                  {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                </small>
              </button>
            </li>
          )
        })}
      </ol>
    </>
  )
}

/**
 * 스테이지 선택 (decisions.md 369·407번): 번호 스테이지를 골라 전진 모드로 들어간다. 깬 다음 스테이지까지 열리고, 챕터 마지막은 보스. 보스를 깨면
 * 다음 챕터가 열린다. 챕터는 ‹ › 로 넘겨 보고, 처음에는 지금 깰 차례인 챕터가 보인다. 별과 초당 수입 보너스가 보이고, 아래에 하루에 한 번 하는 EX
 * 디펜스가 있다 (#803).
 */
function StageSelect({ company }: { company: Company }) {
  const stages = company.stages
  const per = stages?.perChapter ?? 10
  const open = stages ? Math.min(stages.best + 1, stages.last) : 1
  const chapters = stages ? Math.ceil(stages.last / per) : 1
  const openChapter = Math.ceil(open / per)
  const [chapter, setChapter] = useState(openChapter)
  if (!stages) return null
  const numbers = Array.from({ length: per }, (_, i) => (chapter - 1) * per + i + 1).filter(
    (n) => n <= stages.last,
  )
  const start = (entry: BattleEntry) => {
    sfx.stamp()
    haptic.medium()
    useAppUi.getState().startBattle(entry)
  }
  const turn = (to: number) => {
    sfx.tap()
    setChapter(to)
  }
  return (
    <>
      <div className="toy-chapter" data-testid="stage-chapter" data-chapter={chapter}>
        <button
          type="button"
          aria-label="앞 챕터"
          disabled={chapter <= 1}
          onClick={() => turn(chapter - 1)}
          data-testid="chapter-prev"
        >
          ‹
        </button>
        <p className="toy-sheet-lead">
          챕터 {chapter} · {chapterName(chapter)}
          {chapter > openChapter && <small> · 잠김</small>}
        </p>
        <button
          type="button"
          aria-label="다음 챕터"
          disabled={chapter >= chapters}
          onClick={() => turn(chapter + 1)}
          data-testid="chapter-next"
        >
          ›
        </button>
      </div>
      <p className="text-sm text-muted" data-testid="stage-bonus">
        {chapter > openChapter
          ? `챕터 ${chapter - 1} 보스를 깨면 열린다`
          : `마친 최고 수련만큼 회사의 초당 수입이 늘어요: 지금 초당 수입 +${stages.bonusPercent}%`}
      </p>
      <p className="text-sm text-muted" data-testid="stage-diamond-lead">
        별을 처음 얻을 때마다 다이아를 받아요.
      </p>
      <ol className="toy-stage-grid" data-testid="stage-grid">
        {numbers.map((n) => {
          const stars = stages.stars[n - 1] ?? 0
          const locked = n > open
          const boss = n % per === 0
          // 남은 다이아 (527번): 얻지 않은 별의 몫. 10의 배수 스테이지는 두 배라 ×2를 단다. 다 받으면 흐리게 "다 받음".
          const left = stageDiamonds(company, n)
          const double = n % 10 === 0
          return (
            <li key={n}>
              <button
                type="button"
                className={`toy-stage-pick has-diamonds ${boss ? 'is-boss' : ''} ${stars > 0 ? 'is-cleared' : ''}`}
                disabled={locked}
                data-testid="stage"
                data-stage={n}
                data-stars={stars}
                data-diamonds={left}
                aria-label={`수련 ${stageLabel(n, per)}${locked ? ' 잠김' : ''}${boss ? ' 보스' : ''} 별 ${stars}개 · ${
                  left > 0
                    ? `남은 다이아 ${left.toLocaleString()}개${double ? ' (두 배)' : ''}`
                    : '다이아 다 받음'
                }`}
                onClick={() => start({ kind: 'stage', stage: n })}
              >
                <b>{locked ? '🔒' : stageLabel(n, per)}</b>
                <small aria-hidden="true">
                  {boss && !locked ? '보스 ' : ''}
                  {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                </small>
                {left > 0 ? (
                  <span
                    className="toy-stage-diamonds"
                    aria-hidden="true"
                    data-testid="stage-diamonds"
                  >
                    <DiamondIcon />
                    {diamondText(left)}
                  </span>
                ) : (
                  <span
                    className="toy-stage-diamonds is-done"
                    aria-hidden="true"
                    data-testid="stage-diamonds"
                  >
                    다 받음
                  </span>
                )}
                {double && left > 0 && (
                  <i className="toy-stage-double" aria-hidden="true">
                    ×2
                  </i>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        className="toy-sheet-action"
        data-testid="stage-ex"
        disabled={!stages.exAvailable}
        onClick={() => start({ kind: 'ex' })}
      >
        {stages.exAvailable ? (
          <>
            EX 디펜스 · 하루 한 번 · <DiamondIcon /> 다이아 {stages.exDiamonds.toLocaleString()}개
          </>
        ) : (
          'EX 디펜스는 내일 다시'
        )}
      </button>
    </>
  )
}
