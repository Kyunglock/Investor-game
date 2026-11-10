import type { Company, Drawn } from '@web/api/client'
import { BattleEntryButton, BattleEntryContent } from '@web/features/raising/BattleEntryButton'
import { GachaReveal, useDrawReveal } from '@web/features/raising/Gacha'
import { InvestWindow } from '@web/features/raising/InvestWindow'
import { QuarterSheet } from '@web/features/raising/QuarterSheet'
import { useRaisingStore } from '@web/features/raising/store'
import { useLocked, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { useTutorial } from '@web/features/raising/tutorial'
import { YearEndSheet } from '@web/features/raising/YearEnd'
import { useEffect, useState } from 'react'
import { useFx } from '../fx/fx'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { MentalWindow } from '../mental/MentalWindow'
import { firstQuarter } from './firstPlay'
import { ToyCityMove } from './toy-city/ToyCityMove'
import { useAppUi } from './ui'

/**
 * 회의 창과 결산서 (웹의 CompanyScreen과 같은 흐름): 분기 넘기기를 누르면 (직원이 종목을 물어 오면, 382번) 종목 회의 → 결산. 연말 결산서·분기 실적·
 * 건물 알림·엔딩은 서버 상태와 스토어의 표시로 뜬다. 이 컴포넌트는 회사·해·분기·직원이 바뀌면 다시 그려져 창 상태가 초기화된다.
 */
export function Windows({ company }: { company: Company }) {
  const justSettled = useRaisingStore((s) => s.justSettled)
  const moveAlert = useRaisingStore((s) => s.moveAlert)
  const upgradeMove = useRaisingStore((s) => s.upgradeMove)
  const moveBeforeSeats = useRaisingStore((s) => s.moveBeforeSeats)
  const justQuartered = useRaisingStore((s) => s.justQuartered)
  const { settle, convene, scout } = useRaisingStore.getState()
  const investOpen = useAppUi((s) => s.investOpen)
  const setInvestOpen = useAppUi((s) => s.setInvestOpen)
  useEffect(() => () => useAppUi.getState().setInvestOpen(false), [])
  // 멘탈 전투는 스테이지를 골라 들어간다 (decisions.md 369번): 분기를 넘길 때 저절로 뜨지 않는다.
  const battle = useAppUi((s) => s.battle)
  const sheet = useAppUi((s) => s.sheet)
  // 회의 뒤 전투에서 무기를 바꾸러 갔으면, 인벤토리를 닫을 때 회의 창으로 돌아온다. 회의 창이 인벤토리를 덮지 않게 그동안은 닫아 둔다.
  const [investAfterWeapons, setInvestAfterWeapons] = useState(false)
  useEffect(() => {
    if (investAfterWeapons && !(sheet?.kind === 'toy' && sheet.panel === 'weapons')) {
      setInvestAfterWeapons(false)
      setInvestOpen(true)
    }
  }, [investAfterWeapons, sheet, setInvestOpen])
  const ended = company.status === 'ENDED'
  const drawn = useDrawReveal(company)

  // 결산: 전투 없이 바로 넘긴다 (369번).
  const battleOrSettle = () => {
    void settle()
  }

  // 분기 넘기기: 직원이 종목을 물어 오면(267·382번) 종목 회의를 열고, 아무도 안 왔으면 바로 결산한다.
  const stockOrSettle = async () => {
    const pending = useRaisingStore.getState().company?.invest?.outcome?.battle
    if (pending?.open) {
      useAppUi.getState().startBattle({ kind: 'invest', mode: pending.mode, level: pending.level })
      return
    }
    if (!(await scout())) {
      battleOrSettle()
      return
    }
    if (await convene()) {
      setInvestOpen(true)
    }
  }

  // 분기 넘기기 (결산 버튼이 부른다).
  useEffect(() => {
    return useAppUi.subscribe((state, prev) => {
      if (state.settleRequest === prev.settleRequest) {
        return
      }
      void stockOrSettle()
    })
  })

  const closeYearEnd = () => {
    useRaisingStore.setState({ justSettled: false })
    useAppUi.getState().setTab('record')
  }

  return (
    <>
      {justSettled && <YearEndSheet company={company} onClose={closeYearEnd} />}
      {company.lastSettlement && moveAlert && !justSettled && (
        <ToyCityMove
          company={company}
          beforeSeats={moveBeforeSeats ?? company.seats}
          before={company.lastSettlement.gradeBefore}
          after={company.lastSettlement.gradeAfter}
          year={company.lastSettlement.year}
          onDone={() => useRaisingStore.setState({ moveAlert: false })}
        />
      )}
      {upgradeMove && !justSettled && (
        <ToyCityMove
          company={company}
          beforeSeats={upgradeMove.beforeSeats ?? company.seats}
          before={upgradeMove.before}
          after={upgradeMove.after}
          year={upgradeMove.year}
          onDone={() => useRaisingStore.setState({ upgradeMove: null })}
        />
      )}
      {drawn && !justSettled && (
        // 채용 뽑기 결과 (decisions.md 312번): 카드가 열릴 때마다 소리·진동, 특급이면 금빛 번쩍임과 색종이.
        <GachaReveal
          drawn={drawn}
          onClose={() => useRaisingStore.setState({ justDrew: false })}
          onFlip={revealFx}
        />
      )}
      {justQuartered && company.lastQuarter && (
        <QuarterSheet
          quarter={company.lastQuarter}
          employees={company.employees}
          onClose={() => useRaisingStore.setState({ justQuartered: false })}
        />
      )}
      {!ended && company.invest && investOpen && (
        <InvestWindow
          invest={company.invest}
          year={company.year}
          quarter={company.quarter}
          employees={company.employees}
          onClose={() => {
            setInvestOpen(false)
            if (company.invest?.outcome) useAppUi.getState().setTab('office')
          }}
          onSettle={() => {
            setInvestOpen(false)
            battleOrSettle()
          }}
          onBattle={(b) => {
            // 회의 뒤 전투 (414번): 창을 닫고 전투로 갔다가, 끝나면 회의 창으로 돌아와 전·후 손익을 보고 분기를 넘긴다.
            setInvestOpen(false)
            useAppUi.getState().startBattle({ kind: 'invest', mode: b.mode, level: b.level })
          }}
        />
      )}
      {!ended && battle && (
        <MentalWindow
          entry={battle}
          company={company}
          onDone={() => {
            const back = battle.kind === 'invest'
            useAppUi.getState().endBattle()
            if (back) setInvestOpen(true)
          }}
          onChangeWeapon={() => {
            // 무기 인벤토리는 사무실 화면의 시트라서, 다른 탭에서 왔어도 사무실로 가서 연다.
            const back = battle.kind === 'invest'
            const ui = useAppUi.getState()
            ui.endBattle()
            ui.setTab('office')
            ui.openSheet({ kind: 'toy', panel: 'weapons' })
            if (back) setInvestAfterWeapons(true)
          }}
        />
      )}
    </>
  )
}

/** 뽑기 카드가 열릴 때의 효과 (decisions.md 310·312번). */
function revealFx(d: Drawn, el: HTMLElement | null) {
  const fx = useFx.getState()
  if (d.star) {
    fx.flashScreen('rgba(245,211,107,0.55)')
    fx.burstAt(el, 'confetti')
    sfx.fanfare()
    haptic.heavy()
    return
  }
  if (d.fresh) {
    fx.burstAt(el, 'sparks')
    sfx.cash()
    haptic.medium()
    return
  }
  fx.burstAt(el, 'coins')
  sfx.coin()
  haptic.light()
}

/** 화면 아래의 큰 버튼 (decisions.md 310번): 분기 넘기기(누르면 도장 소리·진동·불꽃). 망했으면 다음 회사 차리기. */
export function ActionBar({
  company,
  variant = 'default',
}: {
  company: Company
  variant?: 'default' | 'toy'
}) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const windowOpen = useAppUi((s) => s.investOpen || Boolean(s.battle) || Boolean(s.sheet))
  const reportOpen = useRaisingStore(
    (s) => s.justSettled || s.justQuartered || Boolean(s.upgradeMove) || s.moveAlert,
  )
  const { restart } = useRaisingStore.getState()
  const settleSpot = useTutorialSpot(company, 'settle')
  // 튜토리얼 잠금 (347번): 분기 넘기기는 직원을 앉힌 뒤 열린다.
  const settleLocked = useLocked(company, 'settle')
  const firstGame =
    useTutorial((s) => s.active) && firstQuarter(company) && !company.invest?.outcome
  const ended = company.status === 'ENDED'
  const battle = company.invest?.outcome?.battle
  const pending = battle?.open ? battle : null
  const progress = pending?.mode ?? 'QUARTER'
  const enterBattle = () => {
    if (!pending) return
    sfx.stamp()
    haptic.medium()
    useAppUi.getState().startBattle({ kind: 'invest', mode: pending.mode, level: pending.level })
  }
  if (ended || windowOpen || reportOpen) {
    return null
  }
  if (company.broke) {
    return (
      <div className="px-4 pt-2 pb-2 text-ink" data-testid="broke">
        <p className="text-[13px] font-semibold text-red-pen">{company.broke}</p>
        {error && (
          <p role="alert" className="text-[12px] text-red-pen">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            sfx.stamp()
            haptic.medium()
            void restart()
          }}
          className="btn btn-primary mt-1 min-h-14 w-full text-[15px]"
        >
          문을 닫고 사재로 {company.number + 1}호 회사 차리기
        </button>
      </div>
    )
  }
  if (!company.meeting) {
    return null
  }
  if (variant === 'toy') {
    const assigned = company.employees.filter((e) => e.desk).length
    const upgradeLevels = (company.battleUpgrades ?? []).reduce((n, u) => n + u.level, 0)
    return (
      <div className="toy-action-area">
        {error && (
          <p role="alert" className="toy-error">
            {error}
          </p>
        )}
        {/* 아래 카드 셋 (decisions.md 367번): 지난 분기 수익·팀 분위기를 빼고 전투 강화와 스테이지를 둔다. */}
        <div className="toy-bottom-cards">
          <button
            type="button"
            className="toy-stat"
            data-testid="battle-upgrade-open"
            onClick={() => {
              sfx.tap()
              haptic.light()
              useAppUi.getState().openSheet({ kind: 'toy', panel: 'battle' })
            }}
          >
            <small>자본으로</small>
            <strong>강화</strong>
            <em>{upgradeLevels > 0 ? `${upgradeLevels}단계 올림` : '공격력·연사'}</em>
          </button>
          {/* 상태별 버튼은 같은 슬롯에서 교체한다. 회의·전투 화면이 열리면 ActionBar 자체를 내린다. */}
          <div key={`${company.companyId}:${company.year}:${company.quarter}:${progress}`}>
            {pending ? (
              <button
                type="button"
                className="toy-progress battle-entry battle-entry-compact"
                data-progress={progress}
                data-mode={pending.mode}
                data-testid="pending-invest-battle"
                disabled={busy}
                onClick={enterBattle}
              >
                <BattleEntryContent mode={pending.mode} disabled={busy} compact />
              </button>
            ) : (
              <button
                type="button"
                className={`toy-progress toy-stat toy-advance ${settleSpot}`}
                style={{ width: '100%' }}
                data-progress="QUARTER"
                data-testid="settle"
                data-locked={settleLocked || undefined}
                disabled={busy || settleLocked}
                onClick={(ev) => {
                  sfx.stamp()
                  haptic.medium()
                  useFx.getState().burstAt(ev.currentTarget, 'sparks')
                  useAppUi.getState().requestSettle()
                }}
              >
                <small>
                  {busy
                    ? '처리 중…'
                    : settleLocked
                      ? '직원을 앉혀주세요'
                      : firstGame
                        ? '첫 판 준비 완료'
                        : '다음 분기로'}
                </small>
                <strong>{firstGame ? '첫 게임 시작' : '▶ 넘기기'}</strong>
                <em>
                  자리 {assigned}/{company.seats}
                </em>
              </button>
            )}
          </div>
          {/* 스테이지 입구 (decisions.md 369번): 스테이지 선택 시트를 연다. */}
          <button
            type="button"
            className="toy-stat"
            data-testid="stage-open"
            onClick={() => {
              sfx.tap()
              haptic.light()
              useAppUi.getState().openSheet({ kind: 'toy', panel: 'stage' })
            }}
          >
            <small>멘탈</small>
            <strong>강화</strong>
            <em>
              {company.stages && company.stages.best > 0
                ? `${company.stages.best}/${company.stages.last} · +${company.stages.bonusPercent}%`
                : '1-1부터'}
            </em>
          </button>
        </div>
      </div>
    )
  }
  if (pending)
    return (
      <div className="px-4 pt-2 pb-3 text-ink">
        {error && (
          <p role="alert" className="mb-1 text-[12px] text-red-pen">
            {error}
          </p>
        )}
        <BattleEntryButton
          mode={pending.mode}
          onClick={enterBattle}
          disabled={busy}
          testId="pending-invest-battle"
        />
      </div>
    )
  return (
    <div className="px-4 pt-2 pb-2 text-ink">
      {error && (
        <p role="alert" className="mb-1 text-[12px] text-red-pen">
          {error}
        </p>
      )}
      <div className="grid gap-2">
        <button
          type="button"
          disabled={busy || settleLocked}
          onClick={(ev) => {
            sfx.stamp()
            haptic.medium()
            useFx.getState().burstAt(ev.currentTarget, 'sparks')
            useAppUi.getState().requestSettle()
          }}
          className={`btn min-h-14 text-[17px] ${settleLocked ? 'btn-line opacity-50' : `btn-primary animate-breathe ${settleSpot}`}`}
          data-testid="settle"
          data-locked={settleLocked || undefined}
        >
          {settleLocked
            ? '🔒 직원을 앉히면 열린다'
            : `${company.year}년 차 ${company.quarter}분기 넘기기 ▶`}
        </button>
      </div>
    </div>
  )
}
