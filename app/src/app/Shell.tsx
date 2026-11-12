import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { officeName } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorialSpot } from '@web/features/raising/TutorialBanner'
import {
  FEATURE_NAMES,
  type Feature,
  unlockedFeatures,
  useTutorial,
} from '@web/features/raising/tutorial'
import { useEffect, useRef, useState } from 'react'
import { isMuted, setMuted, sfx } from '../fx/sound'
import { BookIcon, BuildingIcon, ChairIcon, ClipboardIcon, NewsIcon, SoundIcon } from './Icons'
import { GachaScene } from './scenes/GachaScene'
import { IssueScene } from './scenes/IssueScene'
import { OfficeScene } from './scenes/OfficeScene'
import { RecordScene } from './scenes/RecordScene'
import { StaffScene } from './scenes/StaffScene'
import { type Tab, tabBadge, tabFromWeb, useAppUi } from './ui'
import { useCountUp } from './useCountUp'
import { ActionBar, Windows } from './Windows'

const TABS: { id: Tab; label: string; icon: () => React.ReactNode }[] = [
  { id: 'office', label: '사무실', icon: BuildingIcon },
  { id: 'market', label: '채용', icon: ClipboardIcon },
  { id: 'staff', label: '인력 관리', icon: ChairIcon },
  { id: 'issue', label: '이슈', icon: NewsIcon },
  { id: 'record', label: '기록', icon: BookIcon },
]

/**
 * 앱 화면의 틀 (decisions.md 309·310번): 위에 회사 머리띠(건물·해·분기·자본), 가운데 장면 하나, 아래에 분기 넘기기 버튼과 다섯 탭. 문서처럼 길게 내리지 않고
 * 장면을 옆으로 밀어 가며 본다. 장면 안에서만 스크롤한다. 폭락·손실이면 화면이 흔들리고(FxLayer), 자본은 숫자가 굴러간다.
 */
export function Shell({ company }: { company: Company }) {
  const tab = useAppUi((s) => s.tab)
  const modalBack = useAppUi((s) => s.modalBack)
  const webTab = useRaisingStore((s) => s.tab)
  const screen = useRef<HTMLDivElement>(null)
  const ended = company.status === 'ENDED'
  // 웹의 튜토리얼·결산이 가리키는 탭(store.tab)을 따라간다.
  useEffect(() => {
    const t = tabFromWeb(webTab)
    if (t) {
      useAppUi.getState().setTab(t)
      useRaisingStore.setState({ tab: null })
    }
  }, [webTab])
  // 장면 방향: 오른쪽 탭으로 가면 오른쪽에서, 왼쪽 탭으로 가면 왼쪽에서 들어온다.
  const prevTab = useRef(tab)
  const dir =
    TABS.findIndex((t) => t.id === tab) >= TABS.findIndex((t) => t.id === prevTab.current)
      ? 'scene-left'
      : 'scene-right'
  useEffect(() => {
    prevTab.current = tab
  }, [tab])
  const marketSpot = useTutorialSpot(company, 'market')
  const staffSpot = useTutorialSpot(company, 'staff')
  // 튜토리얼 잠금·해금 (347번): 열리지 않은 탭은 잠긴다. 새로 열리면 위에 잠깐 알린다.
  const tutorialOn = useTutorial((s) => s.active)
  const unlocked = unlockedFeatures(company, tutorialOn)
  const [opened, setOpened] = useState<{ names: string; id: number } | null>(null)
  const seen = useRef<Feature[] | null>(null)
  useEffect(() => {
    const before = seen.current
    seen.current = unlocked
    if (!tutorialOn || before === null) {
      return
    }
    const fresh = unlocked.filter((f) => !before.includes(f))
    if (fresh.length === 0) {
      return
    }
    sfx.levelUp()
    setOpened({ names: fresh.map((f) => FEATURE_NAMES[f]).join('·'), id: Date.now() })
    const t = setTimeout(() => setOpened(null), 2200)
    return () => clearTimeout(t)
  }, [unlocked, tutorialOn])
  const key = `${company.companyId}-${company.year}-${company.quarter}-${company.employees.map((e) => e.id).join('.')}`
  return (
    <div
      ref={screen}
      inert={Boolean(modalBack)}
      className={`app-screen app-bg ${tab === 'office' ? 'toy-shell-home' : ''}`}
      data-testid="shell"
    >
      {tab !== 'office' && <Hud company={company} />}
      <main className="relative overflow-hidden">
        <div
          key={tab}
          className={
            tab === 'office'
              ? 'absolute inset-0 overflow-y-auto'
              : `${dir} absolute inset-0 overflow-y-auto px-4 py-3`
          }
          data-testid="scene"
        >
          {tab === 'office' && <OfficeScene company={company} />}
          {tab === 'market' && <GachaScene company={company} />}
          {tab === 'staff' && <StaffScene company={company} />}
          {tab === 'issue' && <IssueScene company={company} />}
          {tab === 'record' && <RecordScene company={company} />}
        </div>
      </main>
      {tab !== 'office' && (
        <div className="safe-bottom">
          {/* 이슈 탭은 종목회의 칸이 분기 넘기기를 맡는다 (474번). */}
          {tab !== 'record' && tab !== 'issue' && <ActionBar company={company} />}
          <nav
            className="grid grid-cols-5 gap-1 border-(--outline) border-t-[3px] bg-white px-1.5 pt-1.5 pb-1"
            aria-label="회사 일"
          >
            {TABS.map((t) => {
              const badge = tabBadge(company, t.id)
              const on = tab === t.id
              const hidden = ended && t.id === 'market'
              const locked = t.id !== 'office' && !unlocked.includes(t.id)
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  disabled={hidden || locked}
                  onClick={() => {
                    if (!on) {
                      sfx.tap()
                    }
                    useAppUi.getState().setTab(t.id)
                  }}
                  className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 font-game text-[12px] transition-colors disabled:opacity-30 ${
                    on
                      ? 'border-(--outline) bg-(--gold-bright) text-ink shadow-[0_3px_0_var(--outline)]'
                      : 'border-transparent text-ink/60'
                  } ${t.id === 'market' ? marketSpot : t.id === 'staff' ? staffSpot : ''}`}
                  data-testid={`tab-${t.id}`}
                  data-locked={locked || undefined}
                >
                  <span key={on ? 'on' : 'off'} className={on ? 'animate-tab-bounce' : ''}>
                    <Icon />
                  </span>
                  {t.label}
                  {locked && (
                    <span
                      className="absolute -top-1 right-[12%] rounded-full border-2 border-(--outline) bg-white px-1 text-[10px] leading-4"
                      role="img"
                      aria-label="잠김"
                    >
                      🔒
                    </span>
                  )}
                  {badge && !locked && (
                    <span
                      className={`absolute -top-1 right-[12%] rounded-full border-2 border-(--outline) px-1.5 font-mono-num text-[10px] leading-4 ${
                        badge === '!'
                          ? 'animate-badge-pulse bg-red-pen text-white'
                          : 'bg-white text-ink'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      )}
      <Windows key={key} company={company} />
      {opened && (
        <p
          key={opened.id}
          className="animate-mental-banner pointer-events-none absolute top-[18%] left-1/2 z-30 whitespace-nowrap rounded-2xl border-4 border-(--outline) bg-(--gold-bright) px-5 py-2 font-game text-[22px] text-ink shadow-[0_6px_0_var(--outline)]"
          role="status"
          data-testid="unlocked-toast"
        >
          🔓 {opened.names} 열림!
        </p>
      )}
    </div>
  )
}

/** 머리띠: 건물 이름과 해·분기, 굴러가는 자본, 소리 끄기. */
function Hud({ company }: { company: Company }) {
  const capital = useCountUp(company.capital)
  const [muted, setMutedState] = useState(isMuted)
  const ended = company.status === 'ENDED'
  return (
    <header
      className="mx-3 mt-2 mb-1 flex items-center justify-between gap-2 rounded-2xl border-[3px] border-(--outline) bg-white px-3 py-1.5 text-ink shadow-[0_4px_0_var(--outline)]"
      data-testid="hud"
    >
      <div className="min-w-0">
        <p className="text-[11px] text-ink/55">
          {company.number}호 회사 ·{' '}
          {ended ? '끝난 회사' : `${company.year}년 차 ${company.quarter}분기`}
        </p>
        <p className="truncate font-game text-[19px] leading-tight" data-testid="company-building">
          {officeName(company.grade)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div
          className="flex items-center gap-1.5 rounded-full border-2 border-(--outline) bg-[#fff6c9] py-0.5 pr-3 pl-1"
          title="자본"
        >
          <span
            className="grid h-6 w-6 place-items-center rounded-full border-2 border-(--outline) bg-(--gold-bright) font-game text-[12px]"
            aria-hidden="true"
          >
            ₩
          </span>
          <p
            key={company.capital}
            className="animate-num-pop font-mono-num text-[17px] font-bold leading-tight"
            data-testid="company-capital"
          >
            {money(capital)}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={muted}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          onClick={() => {
            setMuted(!muted)
            setMutedState(!muted)
            if (muted) {
              sfx.tap()
            }
          }}
          className="rounded-full p-1.5 text-ink/55 active:scale-90"
        >
          <SoundIcon off={muted} />
        </button>
      </div>
    </header>
  )
}
