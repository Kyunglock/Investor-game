import type { Company } from '@web/api/client'
import { shortWon } from '@web/features/game/labels'
import { officeName } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { useEffect } from 'react'
import { IssueScene } from './scenes/IssueScene'
import { MarketScene } from './scenes/MarketScene'
import { OfficeScene } from './scenes/OfficeScene'
import { RecordScene } from './scenes/RecordScene'
import { StaffScene } from './scenes/StaffScene'
import { type Tab, tabBadge, tabFromWeb, useAppUi } from './ui'
import { ActionBar, Windows } from './Windows'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'office', label: '사무실', icon: '🏢' },
  { id: 'market', label: '공채', icon: '📋' },
  { id: 'staff', label: '배치', icon: '🪑' },
  { id: 'issue', label: '이슈', icon: '📰' },
  { id: 'record', label: '기록', icon: '📒' },
]

/**
 * 앱 화면의 틀 (decisions.md 309번): 위에 회사 머리띠(건물·해·분기·자본), 가운데 장면 하나, 아래에 분기 넘기기 버튼과 다섯 탭. 문서처럼 길게 내리지 않고
 * 장면을 바꿔 가며 본다. 장면 안에서만 스크롤한다.
 */
export function Shell({ company }: { company: Company }) {
  const tab = useAppUi((s) => s.tab)
  const webTab = useRaisingStore((s) => s.tab)
  const ended = company.status === 'ENDED'
  // 웹의 튜토리얼·결산이 가리키는 탭(store.tab)을 따라간다.
  useEffect(() => {
    const t = tabFromWeb(webTab)
    if (t) {
      useAppUi.getState().setTab(t)
      useRaisingStore.setState({ tab: null })
    }
  }, [webTab])
  const marketSpot = useTutorialSpot(company, 'market')
  const staffSpot = useTutorialSpot(company, 'staff')
  const key = `${company.companyId}-${company.year}-${company.quarter}-${company.employees.map((e) => e.id).join('.')}`
  return (
    <div className="app-screen bg-[--hud]" data-testid="shell">
      <header
        className="flex items-center justify-between gap-3 px-4 py-2 text-white"
        data-testid="hud"
      >
        <div className="min-w-0">
          <p className="text-[11px] text-white/60">
            {company.number}호 회사 ·{' '}
            {ended ? '끝난 회사' : `${company.year}년 차 ${company.quarter}분기`}
          </p>
          <p
            className="truncate font-serif-kr text-[16px] font-black leading-tight"
            data-testid="company-building"
          >
            {officeName(company.grade)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-white/60">자본</p>
          <p
            className="font-mono-num text-[17px] font-bold leading-tight"
            data-testid="company-capital"
          >
            {shortWon(company.capital)}
          </p>
        </div>
      </header>
      <main className="relative overflow-hidden rounded-t-2xl bg-bg">
        <div
          key={tab}
          className="scene-in absolute inset-0 overflow-y-auto px-4 py-3"
          data-testid="scene"
        >
          {tab === 'office' && <OfficeScene company={company} />}
          {tab === 'market' && <MarketScene company={company} />}
          {tab === 'staff' && <StaffScene company={company} />}
          {tab === 'issue' && <IssueScene company={company} />}
          {tab === 'record' && <RecordScene company={company} />}
        </div>
      </main>
      <div className="safe-bottom bg-card">
        <ActionBar company={company} />
        <nav className="grid grid-cols-5 border-line-soft border-t" aria-label="회사 일">
          {TABS.map((t) => {
            const badge = tabBadge(company, t.id)
            const on = tab === t.id
            const hidden = ended && t.id === 'market'
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={hidden}
                onClick={() => useAppUi.getState().setTab(t.id)}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] disabled:opacity-30 ${
                  on ? 'font-bold text-wine' : 'text-muted'
                } ${t.id === 'market' ? marketSpot : t.id === 'staff' ? staffSpot : ''}`}
                data-testid={`tab-${t.id}`}
              >
                <span
                  className={`text-[20px] leading-none ${on ? '' : 'grayscale'}`}
                  aria-hidden="true"
                >
                  {t.icon}
                </span>
                {t.label}
                {badge && (
                  <span
                    className={`absolute top-1 right-[18%] rounded-full px-1.5 font-mono-num text-[10px] ${
                      badge === '!' ? 'bg-red-pen text-white' : 'bg-line-soft text-ink'
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
