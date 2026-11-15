import type { Company, Drawn } from '@web/api/client'
import { GachaReveal, useDrawReveal } from '@web/features/raising/Gacha'
import { InvestWindow } from '@web/features/raising/InvestWindow'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorial } from '@web/features/raising/tutorial'
import { useEffect, useState } from 'react'
import { useFx } from '../fx/fx'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { MentalWindow } from '../mental/MentalWindow'
import { ToyCityMove } from './toy-city/ToyCityMove'
import { useAppUi } from './ui'

/**
 * 회사 화면 위에 뜨는 창들 (#803): 종목회의, 건물 확장 연출, 채용 뽑기 결과, 멘탈 전투. 분기·결산이 없어져 회의는 이슈 탭의 종목회의 칸이 열고
 * (investOpen), 결과를 보고 확인을 누르면 닫히기만 한다. 이 컴포넌트는 회사·직원이 바뀌면 다시 그려져 창 상태가 초기화된다.
 */
export function Windows({ company }: { company: Company }) {
  const upgradeMove = useRaisingStore((s) => s.upgradeMove)
  const investOpen = useAppUi((s) => s.investOpen)
  const setInvestOpen = useAppUi((s) => s.setInvestOpen)
  useEffect(() => () => useAppUi.getState().setInvestOpen(false), [])
  // 멘탈 전투는 스테이지를 골라 들어간다 (decisions.md 369번): 저절로 뜨지 않는다.
  const battle = useAppUi((s) => s.battle)
  const sheet = useAppUi((s) => s.sheet)
  // 회의 뒤 전투에서 무기를 바꾸러 갔으면, 인벤토리를 닫을 때 회의 창으로 돌아온다. 회의 창이 인벤토리를 덮지 않게 그동안은 닫아 둔다.
  const [investAfterWeapons, setInvestAfterWeapons] = useState(false)
  useEffect(() => {
    if (investAfterWeapons && sheet?.kind !== 'weapons') {
      setInvestAfterWeapons(false)
      setInvestOpen(true)
    }
  }, [investAfterWeapons, sheet, setInvestOpen])
  const drawn = useDrawReveal(company)

  return (
    <>
      {upgradeMove && (
        <ToyCityMove
          company={company}
          beforeSeats={upgradeMove.beforeSeats ?? company.seats}
          before={upgradeMove.before}
          after={upgradeMove.after}
          onDone={() => useRaisingStore.setState({ upgradeMove: null })}
        />
      )}
      {drawn && (
        // 채용 뽑기 결과 (decisions.md 312번): 카드가 열릴 때마다 소리·진동, 특급이면 금빛 번쩍임과 색종이.
        <GachaReveal
          drawn={drawn}
          onClose={() => useRaisingStore.setState({ justDrew: false })}
          onFlip={revealFx}
        />
      )}
      {company.invest && investOpen && (
        <InvestWindow
          invest={company.invest}
          employees={company.employees}
          onClose={() => {
            setInvestOpen(false)
          }}
          // 결과를 보고 확인을 누르면 닫는다 (#803): 넘길 분기가 없다.
          onSettle={() => {
            setInvestOpen(false)
          }}
          onBattle={(b) => {
            useAppUi.getState().startBattle({ kind: 'invest', mode: b.mode, level: b.level })
          }}
        />
      )}
      {battle && (
        <MentalWindow
          entry={battle}
          company={company}
          onDone={() => {
            const back = battle.kind === 'invest'
            const ui = useAppUi.getState()
            ui.endBattle()
            if (battle.kind === 'assault' && battle.tutorial) {
              ui.setTab('office')
              useTutorial.getState().finish()
            } else if (back) setInvestOpen(true)
            // 매도벽 돌파 스테이지(#698)를 마치면 다음 스테이지를 바로 고르게 선택 화면으로 돌아간다.
            else if (battle.kind === 'assault' && ui.tab === 'office') {
              ui.openSheet({ kind: 'toy', panel: 'assault' })
            }
          }}
          onChangeWeapon={() => {
            // 무기 인벤토리는 사무실 탭(자동 전투 화면)의 성장 메뉴에 있어서, 다른 탭에서 왔어도 거기로 가서 연다.
            const back = battle.kind === 'invest'
            const ui = useAppUi.getState()
            ui.endBattle()
            ui.setTab('office')
            ui.openSheet({ kind: 'weapons' })
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

/** 사무실 화면 아래의 돌파 지원 현황: 지금 매도벽과 배치한 직원 수. */
export function OfficeSupport({ company, connected }: { company: Company; connected: boolean }) {
  const error = useRaisingStore((s) => s.error)
  const windowOpen = useAppUi((s) => s.investOpen || Boolean(s.battle) || Boolean(s.sheet))
  const moving = useRaisingStore((s) => Boolean(s.upgradeMove))
  if (windowOpen || moving) {
    return null
  }
  const assigned = company.employees.filter((employee) => employee.desk).length
  return (
    <div className="toy-action-area">
      {error && (
        <p role="alert" className="toy-error">
          {error}
        </p>
      )}
      <section className="toy-support" aria-label="돌파 지원 현황" data-testid="office-support">
        <div className="toy-support-heading">
          <strong>돌파 지원 사무실</strong>
          <span role="status">
            {connected
              ? (company.idle?.circuitSeconds ?? 0) > 0
                ? '거래 정지'
                : '● 자동 전투 중'
              : '연결 대기'}
          </span>
        </div>
        <dl>
          <div>
            <dt>현재 매도벽</dt>
            <dd>{(company.idle?.wall ?? 1).toLocaleString()}벽</dd>
          </div>
          <div>
            <dt>배치한 직원</dt>
            <dd>
              {assigned} / {company.seats}
            </dd>
          </div>
          <div>
            <dt>대기 중인 직원</dt>
            <dd>{company.employees.length - assigned}명</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
