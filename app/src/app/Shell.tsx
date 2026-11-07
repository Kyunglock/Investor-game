import type { Company } from '@web/api/client'
import { shortWon } from '@web/features/game/labels'
import { officeName } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { useEffect, useRef, useState } from 'react'
import { useFx } from '../fx/fx'
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
  { id: 'staff', label: '배치', icon: ChairIcon },
  { id: 'issue', label: '이슈', icon: NewsIcon },
  { id: 'record', label: '기록', icon: BookIcon },
]

/**
 * 앱 화면의 틀 (decisions.md 309·310번): 위에 회사 머리띠(건물·해·분기·자본), 가운데 장면 하나, 아래에 분기 넘기기 버튼과 다섯 탭. 문서처럼 길게 내리지 않고
 * 장면을 옆으로 밀어 가며 본다. 장면 안에서만 스크롤한다. 폭락·손실이면 화면이 흔들리고(FxLayer), 자본은 숫자가 굴러간다.
 */
export function Shell({ company }: { company: Company }) {
  const tab = useAppUi((s) => s.tab)
  const webTab = useRaisingStore((s) => s.tab)
  const shake = useFx((s) => s.shake)
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
  // 흔들림: 클래스를 뗐다 붙여 애니메이션을 다시 돌린다.
  useEffect(() => {
    const el = screen.current
    if (!el || shake === 0) {
      return
    }
    el.classList.remove('animate-shake-screen')
    void el.offsetWidth
    el.classList.add('animate-shake-screen')
  }, [shake])
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
  const key = `${company.companyId}-${company.year}-${company.quarter}-${company.employees.map((e) => e.id).join('.')}`
  return (
    <div ref={screen} className="app-screen bg-(--hud)" data-testid="shell">
      <Hud company={company} />
      <main className="relative overflow-hidden bg-bg">
        <div
          key={tab}
          className={`${dir} absolute inset-0 overflow-y-auto px-4 py-3`}
          data-testid="scene"
        >
          {tab === 'office' && <OfficeScene company={company} />}
          {tab === 'market' && <GachaScene company={company} />}
          {tab === 'staff' && <StaffScene company={company} />}
          {tab === 'issue' && <IssueScene company={company} />}
          {tab === 'record' && <RecordScene company={company} />}
        </div>
      </main>
      <div className="safe-bottom bg-(--hud)">
        <ActionBar company={company} />
        <nav className="grid grid-cols-5 border-white/10 border-t" aria-label="회사 일">
          {TABS.map((t) => {
            const badge = tabBadge(company, t.id)
            const on = tab === t.id
            const hidden = ended && t.id === 'market'
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={hidden}
                onClick={() => {
                  if (!on) {
                    sfx.tap()
                  }
                  useAppUi.getState().setTab(t.id)
                }}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] transition-colors disabled:opacity-30 ${
                  on ? 'font-bold text-(--gold-bright)' : 'text-white/55'
                } ${t.id === 'market' ? marketSpot : t.id === 'staff' ? staffSpot : ''}`}
                data-testid={`tab-${t.id}`}
              >
                <span key={on ? 'on' : 'off'} className={on ? 'animate-tab-bounce' : ''}>
                  <Icon />
                </span>
                {t.label}
                {on && (
                  <span
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-(--gold-bright)"
                    aria-hidden="true"
                  />
                )}
                {badge && (
                  <span
                    className={`absolute top-1.5 right-[16%] rounded-full px-1.5 font-mono-num text-[10px] ${
                      badge === '!'
                        ? 'animate-badge-pulse bg-red-pen text-white'
                        : 'bg-white/15 text-white'
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
      <Windows key={key} company={company} />
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
      className="flex items-center justify-between gap-2 px-4 py-2 text-white"
      data-testid="hud"
    >
      <div className="min-w-0">
        <p className="text-[11px] text-white/55">
          {company.number}호 회사 ·{' '}
          {ended ? '끝난 회사' : `${company.year}년 차 ${company.quarter}분기`}
        </p>
        <p
          className="truncate font-serif-kr text-[17px] font-black leading-tight"
          data-testid="company-building"
        >
          {officeName(company.grade)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-[11px] text-white/55">자본</p>
          <p
            key={company.capital}
            className="animate-num-pop font-mono-num text-[18px] font-bold leading-tight text-(--gold-bright)"
            data-testid="company-capital"
          >
            {shortWon(capital)}
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
          className="rounded-full p-1.5 text-white/55 active:scale-90"
        >
          <SoundIcon off={muted} />
        </button>
      </div>
    </header>
  )
}
