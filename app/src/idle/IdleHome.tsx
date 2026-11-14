import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { type ReactNode, useEffect, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { MAX_BATCH, queuedCost } from '../app/toy-city/upgradeQueue'
import { useAppUi } from '../app/ui'
import { heroOf } from '../mental/hero'
import { WeaponInventory, weaponBadge } from '../mental/WeaponInventory'
import { BASE_CRIT_CHANCE, BASE_CRIT_MULT, CRIT_CHANCE, CRIT_MULT } from '../mental/weaponEffects'
import { IdleCanvas } from './IdleCanvas'
import { IdleCats } from './IdleCats'
import { IdleSandbox } from './IdleSandbox'
import { IdleIcon, type IdleIconName } from './icons'
import './idle-home.css'

type Menu = 'battle' | 'growth' | 'cats' | 'company'
type Part = 'stats' | 'weapons' | 'skills'
const menus: { key: Menu; label: string }[] = [
  { key: 'battle', label: '돌파' },
  { key: 'growth', label: '성장' },
  { key: 'cats', label: '고양이' },
  { key: 'company', label: '회사' },
]
const parts: { key: Part; label: string; icon: IdleIconName }[] = [
  { key: 'stats', label: '능력치', icon: 'stats' },
  { key: 'weapons', label: '인벤토리', icon: 'bag' },
  { key: 'skills', label: '스킬', icon: 'spark' },
]
type Upgrade = NonNullable<Company['battleUpgrades']>[number]
/** 능력치 (487번): 공격력·공격 속도·매수벽(체력 강화, 410번: 최대 멘탈과 그 절반인 매수벽 체력이 함께 오른다)·치명타 피해. */
const STATS: Record<Upgrade['kind'], { name: string; note: string }> = {
  damage: { name: '공격력', note: '탄 공격력' },
  fire: { name: '공격 속도', note: '쏘는 빠르기' },
  hp: { name: '매수벽 체력', note: '매수벽이 무너지면 다시 설 때까지 공격이 멈춰요' },
  buy: { name: '매수벽 공격', note: '매수 주문이 매도 물량을 더 세게 받아쳐요' },
  crit: { name: '치명타 피해', note: '치명타 배율' },
}
const maxed = (u: Upgrade) => u.maxLevel > 0 && u.level >= u.maxLevel
/** 지금 든 무기의 치명타 (492번): 확률과 강화를 더한 배율을 그대로 보여 준다. */
function critNote(company: Company, u: Upgrade) {
  const revolver = heroOf(company).weapon.kind === 'revolver'
  const chance = revolver ? CRIT_CHANCE : BASE_CRIT_CHANCE
  const mult = (revolver ? CRIT_MULT : BASE_CRIT_MULT) * (1 + u.bonusPercent / 100)
  return `지금 무기는 ${Math.round(chance * 100)}% 확률로 ${mult.toFixed(2)}배`
}

export function IdleHome({
  company,
  connected,
  blocked,
  onResume,
  onManage,
  managing,
  onBattle,
  office,
}: {
  company: Company
  connected: boolean
  /** 다른 화면이 전투를 가져가 서버가 이 화면을 거절했다. onResume으로 다시 가져온다 (492번). */
  blocked: boolean
  onResume: () => void
  onManage: () => void
  managing: boolean
  onBattle: () => void
  office: ReactNode
}) {
  const [ownMenu, setMenu] = useState<Menu>('battle')
  const [ownPart, setPart] = useState<Part>('stats')
  // 전투에서 "무기 바꾸기"로 오면(Windows) 성장 › 인벤토리가 열린다. 닫거나 다른 데로 가면 그 요청을 지운다.
  const weaponsAsked = useAppUi((s) => s.sheet?.kind === 'weapons')
  const menu = weaponsAsked ? 'growth' : ownMenu
  const part = weaponsAsked ? 'weapons' : ownPart
  const go = (next: Menu, nextPart: Part = part) => {
    if (weaponsAsked) useAppUi.getState().closeSheet()
    setMenu(next)
    setPart(nextPart)
  }
  const idle = company.idle
  useEffect(() => {
    if (menu === 'battle' || menu === 'company') return
    const previous = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => {
      if (useAppUi.getState().sheet?.kind === 'weapons') useAppUi.getState().closeSheet()
      setMenu('battle')
    })
    return () => useAppUi.getState().setModalBack(previous)
  }, [menu])
  const navigate = (next: Menu) => {
    if (next === 'company') {
      go('battle')
      onManage()
    } else {
      go(next)
      if (next === 'battle') onBattle()
    }
  }
  const activeMenu = menu === 'battle' && managing ? 'company' : menu
  const affordable = company.battleUpgrades?.some((u) => !maxed(u) && u.price <= company.capital)
  const nav = (
    <nav className="idle-nav" aria-label="게임 메뉴">
      {menus.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeMenu === item.key ? 'on' : ''}
          aria-current={activeMenu === item.key ? 'page' : undefined}
          onClick={() => navigate(item.key)}
        >
          <IdleIcon name={item.key} />
          <span>{item.label}</span>
          {item.key === 'growth' && affordable && (
            <i className="idle-dot" role="img" aria-label="강화 가능" />
          )}
        </button>
      ))}
    </nav>
  )
  const skills = (
    <div className="idle-collection">
      {idle?.skills.map((skill) => (
        <article key={skill.code} className={skill.owned ? 'owned' : ''}>
          <span className="idle-stat-icon" aria-hidden="true">
            <IdleIcon
              name={skill.owned ? (skill.code as 'water' | 'meteor' | 'bolt' | 'ram') : 'lock'}
            />
          </span>
          <div>
            <b>{skill.name}</b>
            <small>{skill.owned ? '획득 · 자동 발동' : `${skill.unlockWall}벽 돌파 시 획득`}</small>
          </div>
        </article>
      ))}
    </div>
  )
  return (
    <section
      className="idle-home"
      data-testid="idle-battle"
      aria-label={managing ? '회사' : '무한 매도벽 돌파'}
    >
      <IdleCanvas company={company} connected={connected} />
      {managing ? (
        <div className="idle-office">{office}</div>
      ) : (
        <>
          <header className="idle-hud">
            <div
              className="idle-cash"
              role="status"
              aria-label={`보유 자본 ${money(company.capital)}`}
            >
              <span className="idle-coin">₩</span>
              {/* 테스트판의 지갑은 떨어지지 않는다 (499번). */}
              <b>{company.sandbox ? '∞' : money(company.capital)}</b>
            </div>
            {/* 상태 줄은 없앴다 (493번): 평소엔 벽 번호만, 전투가 멈춘 때만 그 까닭을 여기에 보인다. */}
            <strong
              className="idle-wall-number"
              data-testid="idle-wall-number"
              data-state={connected ? ((idle?.circuitSeconds ?? 0) > 0 ? 'halt' : 'auto') : 'wait'}
            >
              {connected
                ? (idle?.circuitSeconds ?? 0) > 0
                  ? '거래 정지'
                  : `매도벽 ${(idle?.wall ?? 1).toLocaleString()}`
                : '연결 대기'}
            </strong>
            <div
              className="idle-cash"
              role="status"
              aria-label={`무기 뽑기권 ${company.armory?.tickets ?? 0}장`}
            >
              <IdleIcon name="ticket" />
              {company.sandbox ? '∞' : (company.armory?.tickets ?? 0)}
            </div>
            <button type="button" aria-label="회사 메뉴" onClick={onManage}>
              ☰
            </button>
          </header>
          <IdleSandbox company={company} />
          {blocked && (
            <div className="idle-blocked" role="alert" data-testid="idle-blocked">
              <p>다른 화면에서 전투 중이라 여기는 멈췄어요</p>
              <button type="button" onClick={onResume}>
                여기서 이어 하기
              </button>
            </div>
          )}
        </>
      )}
      {nav}
      {menu !== 'battle' && menu !== 'company' && (
        <Sheet
          title={menus.find((m) => m.key === menu)?.label}
          onClose={() => go('battle')}
          testId="idle-menu"
          className="idle-sheet"
          footer={nav}
        >
          {menu === 'growth' && (
            <>
              <p className="idle-subtitle">강해진 만큼, 더 빠르게 돌파해요</p>
              <div className="idle-tabs" role="tablist" aria-label="성장 분류">
                {parts.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={part === item.key}
                    onClick={() => go('growth', item.key)}
                  >
                    <IdleIcon name={item.icon} />
                    {item.label}
                    {item.key === 'weapons' && weaponBadge(company) && (
                      <b className="idle-tab-badge">{weaponBadge(company)}</b>
                    )}
                  </button>
                ))}
              </div>
              {part === 'stats' ? (
                <IdleStats company={company} />
              ) : part === 'weapons' ? (
                <WeaponInventory company={company} />
              ) : (
                skills
              )}
            </>
          )}
          {menu === 'cats' && <IdleCats company={company} />}
          <p className="idle-sheet-note">
            {connected
              ? (idle?.circuitSeconds ?? 0) > 0
                ? '서킷브레이커 · 거래 재개 대기'
                : '● 메뉴를 보는 동안에도 자동 전투 중'
              : '연결을 기다리는 동안 전투가 멈춰 있어요'}
          </p>
        </Sheet>
      )}
    </section>
  )
}

function IdleStats({ company }: { company: Company }) {
  const [count, setCount] = useState(1)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <div className="idle-power">
        <span>
          화력
          <small>모든 공격이 벽에 맞을 때</small>
        </span>
        <strong>{Math.round(company.idle?.dps ?? 0).toLocaleString()}</strong>
      </div>
      <div className="idle-power idle-power-real" data-testid="idle-wall-dps">
        <span>
          실제 벽 피해
          <small>최근 초당 · 몬스터에 맞은 탄은 빼고</small>
        </span>
        <strong>{(company.idle?.wallDps ?? 0).toFixed(1)}</strong>
      </div>
      <div className="idle-buy-count">
        <span>강화 횟수</span>
        <div>
          {[1, 10, MAX_BATCH].map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)}>
              {n === MAX_BATCH ? '최대 100' : `×${n}`}
            </button>
          ))}
        </div>
      </div>
      {company.battleUpgrades?.map((u) => {
        const full = maxed(u)
        let levels = u.maxLevel > 0 ? Math.min(count, u.maxLevel - u.level) : count
        while (levels > 1 && queuedCost(u.price, u.priceGrowthPercent, 0, levels) > company.capital)
          levels--
        const price = queuedCost(u.price, u.priceGrowthPercent, 0, levels)
        return (
          <article className="idle-stat" key={u.kind} data-testid="idle-stat" data-kind={u.kind}>
            <span className="idle-stat-icon" aria-hidden="true">
              <IdleIcon name={u.kind} />
            </span>
            <div className="idle-stat-info">
              <b>
                {STATS[u.kind].name} <small>Lv.{u.level}</small>
              </b>
              <small>{u.kind === 'crit' ? critNote(company, u) : STATS[u.kind].note}</small>
              <p>
                {full
                  ? `+${u.bonusPercent}% · 최대`
                  : `+${u.bonusPercent}% → +${u.bonusPercent + (u.nextBonusPercent - u.bonusPercent) * levels}%`}
              </p>
            </div>
            <button
              type="button"
              className="idle-buy"
              disabled={full || buying || company.capital < price}
              onClick={async () => {
                setBuying(true)
                setError(null)
                try {
                  const result = await useRaisingStore.getState().buyBattleUpgrade(u.kind, levels)
                  if (!result)
                    setError(
                      useRaisingStore.getState().error ?? '연결이 끊겼어요. 다시 시도해 주세요.',
                    )
                } finally {
                  setBuying(false)
                }
              }}
            >
              {full ? 'MAX' : `강화 ×${levels}`}
              {!full && <small>{money(price)}</small>}
            </button>
          </article>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
