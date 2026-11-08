import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { toggleAutoPlay } from '@web/features/raising/autoPlay'
import { nextStep, officeName } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useLocked, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { tutorialStep, unlockedFeatures, useTutorial } from '@web/features/raising/tutorial'
import { useState } from 'react'
import { haptic } from '../../fx/haptics'
import { isMuted, setMuted, sfx } from '../../fx/sound'
import { stageLabel } from '../../mental/advance'
import { BookIcon, ChairIcon, ClipboardIcon, NewsIcon, SoundIcon } from '../Icons'
import { Sheet } from '../Sheet'
import { type BattleEntry, type Tab, type ToyPanel, tabBadge, useAppUi } from '../ui'
import { useCountUp } from '../useCountUp'
import { ActionBar } from '../Windows'
import { growthProgress } from './model'
import { ToyCityStreet } from './ToyCityStreet'

export function ToyIcon({ kind }: { kind: 'upgrade' | 'heart' | 'settings' | 'cup' | 'auto' }) {
  const paths = {
    upgrade: 'M6 22V3M3 3h18L6 9m11-6v7m-3 2h6v6h-6zM3 22h7',
    heart: 'M12 21S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 13-10 13Z',
    settings:
      'm9 2-1 3-3 1-3 3 2 3-1 4 3 3 4-1 3 3 4-2 1-4 3-2-1-4-4-1-1-4ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    cup: 'M7 3h10v7a5 5 0 0 1-10 0Zm0 2H3v4q0 4 5 4m9-8h4v4q0 4-5 4m-4 2v6m-5 0h10',
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
  { tab: 'staff', text: '인력 관리', Icon: ChairIcon },
  { tab: 'issue', text: '이슈', Icon: NewsIcon },
  { tab: 'record', text: '기록', Icon: BookIcon },
] as const

export function ToyCityHome({ company }: { company: Company }) {
  const sheet = useAppUi((s) => s.sheet)
  const panel = sheet?.kind === 'toy' ? sheet.panel : null
  const setPanel = (panel: ToyPanel | null) => {
    if (panel) useAppUi.getState().openSheet({ kind: 'toy', panel })
    else useAppUi.getState().closeSheet()
  }
  const [muted, setMutedState] = useState(isMuted)
  const capital = useCountUp(company.capital)
  const busy = useRaisingStore((s) => s.busy)
  const autoPlay = useRaisingStore((s) => s.autoPlay)
  const error = useRaisingStore((s) => s.error)
  const tutorialOn = useTutorial((s) => s.active)
  const unlocked = unlockedFeatures(company, tutorialOn)
  const tutorial = tutorialStep(company)
  const upgradeLocked = useLocked(company, 'upgrade')
  const autoLocked = useLocked(company, 'auto')
  const upgradeSpot = useTutorialSpot(company, 'upgrade')
  const marketSpot = useTutorialSpot(company, 'market')
  const staffSpot = useTutorialSpot(company, 'staff')
  const progress = growthProgress(company)
  const ended = company.status === 'ENDED'
  const unavailable = ended || Boolean(company.broke || company.ending)
  const assigned = company.employees.filter((e) => e.desk).length
  const resting = company.employees.length - assigned
  const plan = company.upgrade
  const changeTab = (tab: Tab) => {
    sfx.tap()
    useAppUi.getState().setTab(tab)
  }
  const issue = company.meeting?.omen ?? company.meeting?.eraEnding ?? company.era.description
  return (
    <div className="toy-home" data-testid="office-scene">
      <ToyCityStreet company={company} onUpgrade={() => setPanel('upgrade')} />
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
        <span data-testid={plan?.left != null ? 'construction' : 'growth-progress'}>
          {progress.label}
        </span>
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
        <button
          type="button"
          className="toy-round"
          aria-label="업적과 기록"
          disabled={!unlocked.includes('record')}
          onClick={() => changeTab('record')}
        >
          <ToyIcon kind="cup" />
        </button>
      </div>
      <div className="toy-wallets" data-testid="hud">
        <div className="toy-wallet">
          <i aria-hidden="true">₩</i>
          <strong data-testid="company-capital">{money(capital)}</strong>
        </div>
        <button
          type="button"
          className="toy-wallet toy-mental-chip"
          onClick={() => setPanel('stage')}
        >
          <i aria-hidden="true">♥</i>멘탈 +{company.stages?.bonusPercent ?? 0}%
        </button>
      </div>
      <header className="toy-stage">
        <p>CHAPTER {String(company.number).padStart(2, '0')} · TOY CITY</p>
        <h1 data-testid="company-building">{officeName(company.grade)}</h1>
        <span>
          {ended ? '끝난 회사' : `${company.year}년 차 ${company.quarter}분기`} · 자리 {assigned} /{' '}
          {company.seats}
        </span>
      </header>
      {tutorialOn && !ended && (
        <div className="toy-tutorial" data-testid="tutorial" data-step={tutorial.id}>
          <span>
            {tutorial.n}/5 · {tutorial.short}
          </span>
          <button
            type="button"
            onClick={() => useTutorial.getState().finish()}
            data-testid="tutorial-finish"
          >
            {tutorial.n === 5 ? '끝내기' : '건너뛰기'}
          </button>
        </div>
      )}
      <nav className="toy-side toy-left" aria-label="회사 일">
        {MENU.map(({ tab, text, Icon }) => {
          const locked = !unlocked.includes(tab) || (ended && tab === 'market')
          const badge = tabBadge(company, tab)
          return (
            <button
              key={tab}
              type="button"
              disabled={locked}
              className={`toy-menu ${tab === 'market' ? marketSpot : tab === 'staff' ? staffSpot : ''}`}
              data-testid={`tab-${tab}`}
              data-locked={locked || undefined}
              onClick={() => changeTab(tab)}
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
          disabled={unavailable || !plan || upgradeLocked}
          onClick={() => setPanel('upgrade')}
          data-testid="open-upgrade"
          data-locked={upgradeLocked || undefined}
        >
          <ToyIcon kind="upgrade" />
          <span>건물 올리기</span>
          <small>
            {upgradeLocked
              ? '잠김'
              : plan?.left != null
                ? '공사 중'
                : plan?.affordable
                  ? '확장 가능'
                  : '성장 목표'}
          </small>
        </button>
        <button type="button" className="toy-menu" onClick={() => setPanel('stage')}>
          <ToyIcon kind="heart" />
          <span>멘탈</span>
        </button>
      </div>
      <div className="toy-speech">
        {resting > 0
          ? `쉬는 고양이 ${resting}명 · 배치해보세요`
          : assigned > 0
            ? `고양이 ${assigned}명이 열심히 일하는 중`
            : '첫 동료를 기다리고 있어요'}
      </div>
      <div className="toy-bottom">
        <button
          type="button"
          className="toy-ticker"
          disabled={!unlocked.includes('issue')}
          onClick={() => changeTab('issue')}
          data-testid="era"
        >
          <b>거리 소식</b>
          <span>{issue}</span>
          <span aria-hidden="true">→</span>
        </button>
        <ActionBar company={company} variant="toy" />
      </div>
      {panel && (
        <Sheet
          title={
            panel === 'upgrade'
              ? '다음 단계로 성장하기'
              : panel === 'stage'
                ? '멘탈 스테이지'
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
              {plan?.left != null ? (
                <p>완공까지 {plan.left}년 · 연말 결산마다 공사가 진행됩니다.</p>
              ) : (
                plan && (
                  <>
                    <p>
                      확장 비용 {money(plan.cost)} · 자본 {money(plan.needed)}부터
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {plan.affordable
                        ? '성장할 준비가 됐어요.'
                        : `${money(Math.max(0, plan.needed - company.capital))}을 더 모으면 확장할 수 있어요.`}
                      {plan.years > 0 && ` 공사 기간은 ${plan.years}년입니다.`}
                    </p>
                    <button
                      type="button"
                      className="toy-sheet-action"
                      disabled={
                        unavailable || busy || !plan.affordable || upgradeLocked || autoPlay
                      }
                      data-testid="upgrade"
                      onClick={async () => {
                        sfx.stamp()
                        haptic.heavy()
                        await useRaisingStore.getState().upgrade()
                        if (!useRaisingStore.getState().error) setPanel(null)
                      }}
                    >
                      {busy ? '처리 중…' : plan.years > 0 ? '공사 시작' : '건물 확장하기'}
                    </button>
                  </>
                )
              )}
              {error && (
                <p role="alert" className="mt-2 text-red-pen">
                  {error}
                </p>
              )}
            </>
          )}
          {panel === 'stage' && <StageSelect company={company} disabled={unavailable} />}
          {panel === 'battle' && <BattleUpgrades company={company} />}
          {panel === 'settings' && (
            <>
              <p className="toy-sheet-lead">내 속도에 맞춰 회사를 키워요</p>
              <button
                type="button"
                className="toy-sheet-action"
                disabled={autoLocked || ended || Boolean(company.broke || company.ending)}
                aria-pressed={autoPlay}
                data-testid="auto"
                onClick={() => {
                  toggleAutoPlay(!autoPlay)
                  setPanel(null)
                }}
              >
                {autoPlay ? '자동 진행 멈추기' : '자동 진행 시작'}
              </button>
              <p className="mt-3 text-sm text-muted">
                자동 진행은 채용·배치·회의·분기 넘기기를 대신합니다.
              </p>
              <button
                type="button"
                className="toy-sheet-secondary"
                onClick={() => {
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

const BATTLE_UPGRADE_TEXT: Record<'damage' | 'fire' | 'speed', { name: string; effect: string }> = {
  damage: { name: '데미지', effect: '탄 공격력' },
  fire: { name: '연사', effect: '쏘는 간격 단축' },
  speed: { name: '고양이 속도', effect: '전진 모드 이동 속도' },
}

/** 강화 효과 글: 0이면 부호 없이, 연사는 간격이 줄어 −. */
function bonusLabel(kind: 'damage' | 'fire' | 'speed', percent: number) {
  if (percent === 0) return '0%'
  return `${kind === 'fire' ? '−' : '+'}${percent}%`
}

/** 자본으로 사는 전투 강화 (decisions.md 367번): 데미지·연사·고양이 속도를 한 단계씩. 값과 효과는 서버가 준다. */
function BattleUpgrades({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const upgrades = company.battleUpgrades ?? []
  return (
    <>
      <p className="toy-sheet-lead">멘탈 전투에 영구로 붙어요</p>
      <p className="text-sm text-muted">자본 {money(company.capital)}</p>
      <ul className="toy-battle-upgrades" data-testid="battle-upgrades">
        {upgrades.map((u) => {
          const text = BATTLE_UPGRADE_TEXT[u.kind]
          const max = u.price == null
          const affordable = !max && company.capital >= (u.price ?? 0)
          return (
            <li key={u.kind} data-kind={u.kind} data-level={u.level}>
              <div>
                <b>{text.name}</b>{' '}
                <small>
                  {u.level}/{u.maxLevel}단계
                </small>
                <p className="text-sm text-muted">
                  {text.effect} {bonusLabel(u.kind, u.bonusPercent)}
                  {u.nextBonusPercent != null && ` → ${bonusLabel(u.kind, u.nextBonusPercent)}`}
                </p>
              </div>
              <button
                type="button"
                className="toy-sheet-action"
                data-testid="battle-upgrade-buy"
                disabled={busy || max || !affordable}
                onClick={() => {
                  sfx.stamp()
                  haptic.medium()
                  void useRaisingStore.getState().buyBattleUpgrade(u.kind)
                }}
              >
                {max ? '최대' : money(u.price ?? 0)}
              </button>
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-red-pen">
          {error}
        </p>
      )}
    </>
  )
}

/**
 * 스테이지 선택 (decisions.md 369번): 번호 스테이지를 골라 전진 모드로 들어간다. 깬 다음 스테이지까지 열리고, 챕터 마지막은 보스. 별과 분기 강화율이
 * 보이고, 아래에 분기에 한 번 하는 EX 디펜스가 있다.
 */
function StageSelect({ company, disabled }: { company: Company; disabled: boolean }) {
  const stages = company.stages
  if (!stages) return null
  const open = Math.min(stages.best + 1, stages.last)
  const numbers = Array.from({ length: stages.last }, (_, i) => i + 1)
  const start = (entry: BattleEntry) => {
    sfx.stamp()
    haptic.medium()
    useAppUi.getState().startBattle(entry)
  }
  return (
    <>
      <p className="toy-sheet-lead">챕터 1 · 개미의 첫걸음</p>
      <p className="text-sm text-muted" data-testid="stage-bonus">
        깬 최고 스테이지만큼 매 분기 직원들이 더 번다: 지금 +{stages.bonusPercent}%
      </p>
      <ol className="toy-stage-grid" data-testid="stage-grid">
        {numbers.map((n) => {
          const stars = stages.stars[n - 1] ?? 0
          const locked = n > open
          const boss = n % stages.perChapter === 0
          return (
            <li key={n}>
              <button
                type="button"
                className={`toy-stage-pick ${boss ? 'is-boss' : ''} ${stars > 0 ? 'is-cleared' : ''}`}
                disabled={disabled || locked}
                data-testid="stage"
                data-stage={n}
                data-stars={stars}
                aria-label={`스테이지 ${stageLabel(n, stages.perChapter)}${locked ? ' 잠김' : ''}${boss ? ' 보스' : ''} 별 ${stars}개`}
                onClick={() => start({ kind: 'stage', stage: n })}
              >
                <b>{locked ? '🔒' : stageLabel(n, stages.perChapter)}</b>
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
      <button
        type="button"
        className="toy-sheet-action"
        data-testid="stage-ex"
        disabled={disabled || !stages.exAvailable}
        onClick={() => start({ kind: 'ex' })}
      >
        {stages.exAvailable ? 'EX 디펜스 · 분기에 한 번 · 무기 뽑기권' : 'EX 디펜스는 다음 분기에'}
      </button>
    </>
  )
}
