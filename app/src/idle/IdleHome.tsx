import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { diamondText } from '@web/features/raising/gachaRules'
import { idleHoldWall } from '@web/features/raising/idlePredict'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useShownIdle } from '@web/features/raising/useIdleBattle'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { rate, readOfflineSeen, shouldShowOffline } from '../app/income'
import { meetingReady } from '../app/meeting'
import { Sheet } from '../app/Sheet'
import { MAX_BATCH, queuedCost } from '../app/toy-city/upgradeQueue'
import { stageBadge, useAppUi } from '../app/ui'
import { useCountUp } from '../app/useCountUp'
import { mergeable } from '../mental/armory'
import { idleThreat } from '../mental/assault'
import { idleBuyOrderDamage } from '../mental/buyWall'
import { heroOf } from '../mental/hero'
import { sharesOf } from '../mental/shares'
import { BASE_CRIT_CHANCE, BASE_CRIT_MULT, CRIT_CHANCE, CRIT_MULT } from '../mental/weaponEffects'
import { GrowthIcon } from './GrowthIcon'
import { IdleActives } from './IdleActives'
import { IdleAttendance } from './IdleAttendance'
import { IdleBoss } from './IdleBoss'
import { IdleCanvas } from './IdleCanvas'
import { IdleCats } from './IdleCats'
import { IdleOptions } from './IdleOptions'
import { IdlePass } from './IdlePass'
import { IdleSandbox } from './IdleSandbox'
import { IdleShop } from './IdleShop'
import { IdleWeapons } from './IdleWeapons'
import { IdleIcon } from './icons'
import { MenuIcon } from './MenuIcon'
import { OfflineIncome } from './OfflineIncome'
import { freeLeft } from './shop'
import './idle-home.css'
import './toy-arcade.css'

type Menu = 'battle' | 'growth' | 'weapons' | 'cats' | 'shop' | 'company'
/**
 * 회사 탭은 꺼 두었다 (decisions.md 540번): 아래 메뉴의 회사 탭과 위의 회사 메뉴 단추(☰)가 나오지 않는다. 회사 화면의 코드는 그대로라 이 값을
 * 켜면 돌아온다.
 */
export const COMPANY_ENABLED = false
const menus: { key: Menu; label: string }[] = (
  [
    { key: 'battle', label: '돌파' },
    { key: 'growth', label: '성장' },
    { key: 'weapons', label: '무기' },
    { key: 'cats', label: '고양이' },
    { key: 'shop', label: '상점' },
    { key: 'company', label: '회사' },
  ] as const
).filter((m) => COMPANY_ENABLED || m.key !== 'company')
type Upgrade = NonNullable<Company['battleUpgrades']>[number]
/** 능력치 (487번): 공격력·공격 속도·매수벽(체력 강화, 410번: 최대 멘탈과 그 절반인 매수벽 체력이 함께 오른다)·치명타 피해. */
const STATS: Record<Upgrade['kind'], { name: string; note: string }> = {
  damage: { name: '공격력', note: '탄 공격력' },
  fire: { name: '공격 속도', note: '쏘는 빠르기' },
  hp: { name: '매수벽 체력', note: '매수벽이 무너지면 열 벽 뒤로 물러나요' },
  buy: { name: '매수벽 공격', note: '매수 주문의 피해 · 무기와 따로 세요' },
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

/** 매수 주문 한 장의 수량 (514번): 무기와 상관없이 그 벽의 물량 배율과 이 강화만 따른다. */
function buyNote(company: Company, u: Upgrade) {
  const idle = company.idle
  if (!idle) return STATS.buy.note
  const damage = idleBuyOrderDamage(idleThreat(idle.wall, idle.maxHp), u.bonusPercent / 100)
  return `매수 주문 한 장 ${sharesOf(damage).toLocaleString()}주 · 무기와 따로 세요`
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
  // 전투에서 "무기 바꾸기"로 오면(Windows) 무기 탭이 사장냥의 장비로 열린다 (530·540번). 닫거나 다른 데로 가면 그 요청을 지운다.
  const weaponsAsked = useAppUi((s) => s.sheet?.kind === 'weapons')
  const menu = weaponsAsked ? 'weapons' : ownMenu
  // 무기 탭에서 무기를 들 고양이. null이면 사장냥이다. 고양이 탭의 "무기 탭 ▸"이 그 고양이로 연다.
  const [ownWearer, setWearer] = useState<CatCode | null>(null)
  const wearer = weaponsAsked ? null : ownWearer
  // 상점이 처음 보일 뽑기: 무기 탭에서 오면 무기 뽑기다.
  const [shopKind, setShopKind] = useState<'cat' | 'weapon'>('cat')
  const go = (next: Menu) => {
    if (weaponsAsked) useAppUi.getState().closeSheet()
    setMenu(next)
  }
  const idle = company.idle
  // 벽 번호와 거래 정지는 화면이 먼저 부순 벽을 따른다 (532번). 돈은 서버가 확정한 값만 쓴다.
  const shown = useShownIdle(idle)
  const halted = shown.circuitSeconds > 0
  // 보스 앞의 벽은 부숴도 다시 서고, 대량 매도벽은 보스 도전으로 들어온 것이다 (546번).
  const holding = idleHoldWall(shown.wall)
  const bossFight = shown.wall % 10 === 0
  // 자본은 1초마다 서버에서 새로 온다 (#803): 숫자가 그 사이를 굴러가며 계속 불어난다.
  const capital = useCountUp(company.capital)
  // 종목회의를 열거나 이어 갈 수 있으면 회사 메뉴에 점을 단다 (#803).
  const meeting = meetingReady(company)
  // 자리를 비운 동안의 수입 알림이 떠 있거나 전투·종목회의 창이 열려 있으면 출석판은 그 뒤에 뜬다 (528번).
  const [offlineSeen, setOfflineSeen] = useState(readOfflineSeen)
  const offlineShowing = shouldShowOffline(idle?.offline, offlineSeen)
  const elsewhere = useAppUi((s) => s.battle != null || s.investOpen)
  const exReady = stageBadge(company) !== null
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
    // 아래 메뉴로 상점에 오면 고양이 뽑기부터 보인다.
    if (next === 'shop') setShopKind('cat')
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
  const canMerge = mergeable(company).length > 0
  const shopFree = freeLeft(company)
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
          <MenuIcon name={item.key} />
          <span>{item.label}</span>
          {item.key === 'growth' && affordable && (
            <i className="idle-dot" role="img" aria-label="강화 가능" />
          )}
          {item.key === 'weapons' && canMerge && (
            <i className="idle-dot" role="img" aria-label="합칠 수 있는 무기 있음" />
          )}
          {item.key === 'shop' && shopFree && (
            <i className="idle-dot" role="img" aria-label="무료 상품 있음" data-testid="shop-dot" />
          )}
          {item.key === 'company' && meeting && (
            <i
              className="idle-dot"
              role="img"
              aria-label="종목회의 가능"
              data-testid="meeting-dot"
            />
          )}
          {/* 오늘 EX 디펜스가 남아 있으면 받을 다이아가 있다 (527번, #797). 점은 하나만 단다. */}
          {item.key === 'company' && !meeting && exReady && (
            <i
              className="idle-dot"
              role="img"
              aria-label="EX 디펜스 가능"
              data-testid="stage-dot"
            />
          )}
        </button>
      ))}
    </nav>
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
              <span className="idle-cash-lines">
                {/* 테스트판의 지갑은 떨어지지 않는다 (499번). */}
                <b>{company.sandboxInfinite ? '∞' : money(capital)}</b>
                {/* 회사가 1초에 버는 돈 (#803). */}
                {idle?.income && (
                  <small data-testid="idle-income">+{rate(idle.income.perSecond)}/초</small>
                )}
              </span>
            </div>
            {/* 상태 줄은 없앴다 (493번): 평소엔 벽 번호만, 전투가 멈춘 때만 그 까닭을 여기에 보인다. */}
            <strong
              className="idle-wall-number"
              data-testid="idle-wall-number"
              data-state={
                connected
                  ? halted
                    ? 'halt'
                    : bossFight
                      ? 'boss'
                      : holding
                        ? 'hold'
                        : 'auto'
                  : 'wait'
              }
            >
              {connected
                ? halted
                  ? '거래 정지'
                  : `${bossFight ? '보스 ' : '매도벽 '}${shown.wall.toLocaleString()}${holding ? ' 반복' : ''}`
                : '연결 대기'}
            </strong>
            {/* 다이아 (526번): 직원·고양이·무기 뽑기에 쓰는 하나뿐인 뽑기 재화. */}
            <div
              className="idle-cash idle-diamonds"
              role="status"
              aria-label={`다이아 ${company.diamonds.amount.toLocaleString()}개`}
              data-testid="idle-diamonds"
            >
              <IdleIcon name="diamond" />
              {company.sandboxInfinite ? '∞' : diamondText(company.diamonds.amount)}
            </div>
            {COMPANY_ENABLED && (
              <button type="button" aria-label="회사 메뉴" onClick={onManage}>
                ☰
              </button>
            )}
          </header>
          <div className="idle-toolbar" role="toolbar" aria-label="전투 편의 메뉴">
            <IdleOptions />
            <div className="idle-quick">
              <IdlePass company={company} />
              <IdleAttendance company={company} wait={offlineShowing || elsewhere} />
            </div>
          </div>
          <IdleSandbox company={company} />
          <IdleActives company={company} connected={connected} />
          <IdleBoss company={company} connected={connected} />
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
      <OfflineIncome company={company} seen={offlineSeen} onSeen={setOfflineSeen} />
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
              <IdleStats company={company} />
            </>
          )}
          {menu === 'weapons' && (
            <IdleWeapons
              company={company}
              wearer={wearer}
              onWearer={(code) => {
                if (weaponsAsked) useAppUi.getState().closeSheet()
                setMenu('weapons')
                setWearer(code)
              }}
              onDraw={() => {
                setShopKind('weapon')
                go('shop')
              }}
            />
          )}
          {menu === 'cats' && (
            <IdleCats
              company={company}
              onGear={(code) => {
                setWearer(code)
                go('weapons')
              }}
            />
          )}
          {menu === 'shop' && <IdleShop key={shopKind} company={company} kind={shopKind} />}
          <p className="idle-sheet-note">
            {connected
              ? halted
                ? '서킷브레이커 · 거래 재개 대기'
                : '● 메뉴를 보는 동안에도 자동 전투 중'
              : '연결을 기다리는 동안 전투가 멈춰 있어요'}
          </p>
        </Sheet>
      )}
    </section>
  )
}

/** 큰 전투력은 돈처럼 단위로 줄여 적는다. */
const powerText = (power: number) =>
  power < 1e12 ? Math.round(power).toLocaleString() : money(power)

/**
 * 전투력 (decisions.md 538번): 성장 탭의 숫자 하나. 서버가 강화·무기·고양이를 묶어 준다. 오르면 오른 만큼을 잠깐 옆에 띄운다.
 */
function IdlePower({ power }: { power: number }) {
  const last = useRef(power)
  const [gain, setGain] = useState(0)
  useEffect(() => {
    const diff = power - last.current
    last.current = power
    if (diff <= 0) return
    setGain(diff)
    const timer = window.setTimeout(() => setGain(0), 1600)
    return () => window.clearTimeout(timer)
  }, [power])
  return (
    <div className="idle-power" data-testid="idle-power">
      <span>
        전투력
        <small>강화·무기·고양이를 모두 더한 힘</small>
      </span>
      <strong>
        {gain > 0 && (
          <i className="idle-power-gain" data-testid="idle-power-gain">
            +{powerText(gain)}
          </i>
        )}
        {powerText(power)}
      </strong>
    </div>
  )
}

function IdleStats({ company }: { company: Company }) {
  const [count, setCount] = useState(1)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <IdlePower power={company.idle?.power ?? 0} />
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
              <GrowthIcon name={u.kind} />
            </span>
            <div className="idle-stat-info">
              <b>
                {STATS[u.kind].name} <small>Lv.{u.level}</small>
              </b>
              <small>
                {u.kind === 'crit'
                  ? critNote(company, u)
                  : u.kind === 'buy'
                    ? buyNote(company, u)
                    : STATS[u.kind].note}
              </small>
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
