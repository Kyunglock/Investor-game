import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { diamondText } from '@web/features/raising/gachaRules'
import { idleBossChallenge } from '@web/features/raising/idlePredict'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useShownIdle } from '@web/features/raising/useIdleBattle'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { preloadRewardedAd } from '../app/ads'
import { rate, readOfflineSeen, shouldShowOffline } from '../app/income'
import { meetingReady } from '../app/meeting'
import { Sheet } from '../app/Sheet'
import { MAX_BATCH, queuedCost } from '../app/toy-city/upgradeQueue'
import { stageBadge, useAppUi } from '../app/ui'
import { useCountUp } from '../app/useCountUp'
import rebirthIcon from '../assets/rebirth.png'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { mergeable } from '../mental/armory'
import { idleBuyOrderDamage } from '../mental/buyWall'
import { SHARES_PER_HP, sharesOf } from '../mental/shares'
import { useAutoUpgrade, useAutoUpgradeLoop } from './autoUpgrade'
import { BossReward } from './BossReward'
import { CatInfoCard } from './CatInfoCard'
import { FishIcon } from './FishIcon'
import { GrowthIcon } from './GrowthIcon'
import { IdleActives } from './IdleActives'
import { IdleAttendance } from './IdleAttendance'
import { IdleBattleStats } from './IdleBattleStats'
import { IdleCanvas } from './IdleCanvas'
import { IdleCats, type LoadoutTab } from './IdleCats'
import { IdleOptions } from './IdleOptions'
import { IdlePass } from './IdlePass'
import { IdleRebirth } from './IdleRebirth'
import { IdleSandbox } from './IdleSandbox'
import { IdleShop } from './IdleShop'
import { IdleSkills } from './IdleSkills'
import { IdleTutorial } from './IdleTutorial'
import { IdleIcon } from './icons'
import { MenuIcon } from './MenuIcon'
import { OfflineIncome } from './OfflineIncome'
import { tutorialMenuLocked } from './onboarding'
import { PowerSaveScreen } from './PowerSaveScreen'
import { freeLeft } from './shop'
import { VaultChallenges } from './VaultChallenges'
import './idle-home.css'
import './toy-arcade.css'
import './loadout-tray.css'
import './upgrade-feedback.css'
import './toy-shop.css'

type Menu = 'rebirth' | 'battle' | 'growth' | 'cats' | 'skills' | 'shop' | 'company'
/**
 * 회사 탭은 꺼 두었다 (decisions.md 540번): 아래 메뉴의 회사 탭과 위의 회사 메뉴 단추(☰)가 나오지 않는다. 회사 화면의 코드는 그대로라 이 값을
 * 켜면 돌아온다.
 */
export const COMPANY_ENABLED = false
const menus: { key: Exclude<Menu, 'rebirth'>; label: string }[] = (
  [
    { key: 'battle', label: '돌파' },
    { key: 'growth', label: '성장' },
    // 무기 탭은 고양이 탭에 합쳤다 (560번): 고양이를 고르고 그 자리에서 무기를 바꾸고 합친다.
    { key: 'cats', label: '출전' },
    // 스킬 탭 (587번): 사장냥의 고유 스킬을 보고 장착한다.
    { key: 'skills', label: '스킬' },
    { key: 'shop', label: '상점' },
    { key: 'company', label: '회사' },
  ] as const
).filter((m) => COMPANY_ENABLED || m.key !== 'company')
type Upgrade = NonNullable<Company['battleUpgrades']>[number]

/** 강화 효과(%)는 한 단계 0.2%라 소수가 있다 (648번): 소수 첫째 자리까지, 끝의 0은 뺀다. */
function percentText(percent: number) {
  return Number(percent.toFixed(1)).toLocaleString('ko-KR')
}
/** 능력치 (487번): 공격력·공격 속도·매수벽(체력 강화, 410번: 최대 멘탈과 그 절반인 매수벽 체력이 함께 오른다). 치명타 피해 강화는 없앴다 (556번). */
const STATS: Record<Upgrade['kind'], { name: string; note: string }> = {
  damage: { name: '공격력', note: '탄 공격력' },
  fire: { name: '공격 속도', note: '쏘는 빠르기' },
  hp: { name: '매수벽 체력', note: '매수벽이 무너지면 다시 설 때까지 공격이 멈춰요' },
  buy: { name: '매수벽 공격', note: '매수 주문의 피해 · 무기와 동료가 셀수록 덤이 붙어요' },
}
const maxed = (u: Upgrade) => u.maxLevel > 0 && u.level >= u.maxLevel

/** 매수 주문 한 장의 수량 (514·573·638번): 벽의 깊이는 보지 않는다. 이 강화의 고정 수량에 팀 화력을 따르는 덤이 붙는다(서버가 더해 준다). */
function buyNote(company: Company, u: Upgrade) {
  if (!company.idle) return STATS.buy.note
  const damage = idleBuyOrderDamage((u.bonusShares ?? 0) / SHARES_PER_HP)
  return `매수 주문 한 장 ${sharesOf(damage).toLocaleString()}주 · 무기와 동료가 셀수록 덤이 붙어요`
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
  const [skillUse, setSkillUse] = useState(false)
  const [replay, setReplay] = useState<number | null>(null)
  const [inVault, setInVault] = useState(false)
  const [ownMenu, setMenu] = useState<Menu>('battle')
  // 전투에서 "무기 바꾸기"로 오면(Windows) 고양이·무기 탭이 사장냥의 장비 목록으로 열린다 (530·560번). 닫거나 다른 데로 가면 그 요청을 지운다.
  const weaponsAsked = useAppUi((s) => s.sheet?.kind === 'weapons')
  const menu = weaponsAsked ? 'cats' : ownMenu
  const rebirthButton = useRef<HTMLButtonElement>(null)
  const previousMenu = useRef(menu)
  useEffect(() => {
    const restore = previousMenu.current === 'rebirth' && menu === 'battle'
    previousMenu.current = menu
    if (!restore) return
    // 시트의 닫힘·포커스 정리가 끝난 다음 바로가기 버튼으로 돌아온다.
    const frame = requestAnimationFrame(() => rebirthButton.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [menu])
  // 고양이·무기 탭에서 고른 고양이. null이면 사장냥이다. 메뉴를 오가도 유지한다.
  const [ownWearer, setWearer] = useState<CatCode | null>(null)
  const wearer = weaponsAsked ? null : ownWearer
  // 고양이·무기 탭이 장비 목록을 펴고 있는가 (560번). 아래 메뉴로 들어오면 고양이 목록부터 보인다.
  const [loadoutTab, setLoadoutTab] = useState<LoadoutTab>('고양이')
  const requestedTab = weaponsAsked ? '무기' : loadoutTab
  const tab =
    requestedTab === '무기' && (company.idle?.onboarding?.step ?? 8) < 5 ? '고양이' : requestedTab
  // 상점이 처음 보일 뽑기: 장비 목록에서 오면 무기 뽑기다.
  const [shopKind, setShopKind] = useState<'cat' | 'weapon'>('cat')
  const go = (next: Menu) => {
    if (tutorialMenuLocked(company, next)) return
    if (weaponsAsked) useAppUi.getState().closeSheet()
    setMenu(next)
  }
  const idle = company.idle
  // 벽 번호와 거래 정지는 화면이 먼저 부순 벽을 따른다 (532번). 돈은 서버가 확정한 값만 쓴다.
  const shown = useShownIdle(idle)
  const halted = shown.circuitSeconds > 0
  // 보스 도전 (547번): 50번째 벽마다 저절로 나오고 서킷브레이커로 시작한다.
  const bossFight = idleBossChallenge(shown.wall)
  // 최고 기록 (654번): 통과한 가장 높은 벽. 지금 선 벽이 그보다 높으면 기록을 갱신하는 중이다.
  // 환생한 적이 없으면 지금 선 벽이 늘 최고 기록이라 적지 않는다 (655번): 그때는 다이아 보상을 받은 보스만 적는다.
  const best = idle?.bestWall ?? 0
  const reborn = (idle?.rebirth?.count ?? 0) > 0
  const recordRun = reborn && best > 0 && shown.wall > best
  const bossPaid = idle?.bossReward?.wall ?? 0
  // 지정 자동 강화 (654번): 성장 탭에서 고른 능력치를 돈이 모이는 대로 산다.
  useAutoUpgradeLoop(company, connected)
  // 자본은 1초마다 서버에서 새로 온다 (#803): 숫자가 그 사이를 굴러가며 계속 불어난다.
  const capital = useCountUp(company.capital)
  // 종목회의를 열거나 이어 갈 수 있으면 회사 메뉴에 점을 단다 (#803).
  const meeting = meetingReady(company)
  // 자리를 비운 동안의 수입 알림이 떠 있거나 전투·종목회의 창이 열려 있으면 출석 보상은 그 뒤에 받는다 (528·568번).
  const [offlineSeen, setOfflineSeen] = useState(readOfflineSeen)
  const offlineShowing = shouldShowOffline(idle?.offline, offlineSeen)
  const elsewhere = useAppUi((s) => s.battle != null || s.investOpen)
  const exReady = stageBadge(company) !== null
  // 광고 단추를 누르자마자 광고가 뜨도록 앱에서는 미리 받아 둔다 (589번).
  useEffect(preloadRewardedAd, [])
  useEffect(() => {
    if (menu === 'battle' || menu === 'company') return
    const previous = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => {
      if (document.body.dataset.tutorialDragLock) return
      if (useAppUi.getState().sheet?.kind === 'weapons') useAppUi.getState().closeSheet()
      setMenu('battle')
    })
    return () => useAppUi.getState().setModalBack(previous)
  }, [menu])
  const navigate = (next: Menu) => {
    // 아래 메뉴로 상점에 오면 고양이 뽑기부터 보인다.
    if (next === 'shop') setShopKind('cat')
    if (next === 'cats') setLoadoutTab('고양이')
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
          data-tutorial-menu={item.key}
          type="button"
          className={activeMenu === item.key ? 'on' : ''}
          disabled={tutorialMenuLocked(company, item.key)}
          title={
            tutorialMenuLocked(company, item.key)
              ? item.key === 'skills'
                ? '100 매도벽 돌파 시 해금'
                : '첫 출근 안내를 진행하면 열려요'
              : undefined
          }
          aria-current={activeMenu === item.key ? 'page' : undefined}
          onClick={() => navigate(item.key)}
        >
          <MenuIcon name={item.key} />
          <span>{item.label}</span>
          {tutorialMenuLocked(company, item.key) && (
            <small className="tutorial-lock">
              {item.key === 'skills' ? '100벽 돌파' : '안내 후 해금'}
            </small>
          )}
          {item.key === 'growth' && affordable && (
            <i className="idle-dot" role="img" aria-label="강화 가능" />
          )}
          {item.key === 'cats' && canMerge && (
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
  const tutorial = () => (
    <IdleTutorial
      company={company}
      replay={replay}
      onReplay={setReplay}
      menu={menu}
      skillUse={skillUse}
      onSkillUse={() => setSkillUse(true)}
      onGo={(next, openGear) => {
        if (next === 'cats') {
          setWearer('night')
          setLoadoutTab(openGear ? '무기' : '고양이')
        }
        go(next)
      }}
    />
  )
  return (
    <section
      className="idle-home"
      data-testid="idle-battle"
      aria-label={managing ? '회사' : '무한 매도벽 돌파'}
    >
      {inVault ? (
        <div className="idle-canvas" />
      ) : (
        <IdleCanvas company={company} connected={connected} />
      )}
      <BossReward company={company} hidden={managing} />
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
              <span className="idle-coin" data-reward-target="money">
                ₩
              </span>
              <span className="idle-cash-lines">
                {/* 테스트판도 자본은 무한이 아니다 (650번): 다이아만 ∞다. */}
                <b>{money(capital)}</b>
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
              data-state={connected ? (halted ? 'halt' : bossFight ? 'boss' : 'auto') : 'wait'}
            >
              {connected
                ? halted
                  ? '거래 정지'
                  : `${bossFight ? '보스 ' : '매도벽 '}${shown.wall.toLocaleString()}`
                : '연결 대기'}
            </strong>
            {connected && ((reborn && best > 0) || bossPaid > 0) && (
              <small
                className="idle-wall-best"
                data-testid="idle-wall-best"
                data-record={recordRun || undefined}
              >
                {recordRun
                  ? '최고기록 갱신중!'
                  : reborn && best > 0 && `최고 ${best.toLocaleString()}`}
                {!recordRun && bossPaid > 0 && (
                  <span className={reborn && best > 0 ? 'idle-wall-best-boss' : undefined}>
                    {reborn && best > 0 && ' · '}보스 보상 {bossPaid.toLocaleString()}까지
                  </span>
                )}
              </small>
            )}
            {/* 다이아 (526번): 직원·고양이·무기 뽑기에 쓰는 하나뿐인 뽑기 재화. */}
            <div
              className="idle-cash idle-diamonds"
              role="status"
              aria-label={`다이아 ${company.diamonds.amount.toLocaleString()}개`}
              data-testid="idle-diamonds"
            >
              <span data-reward-target="diamond">
                <IdleIcon name="diamond" />
              </span>
              {company.sandboxInfinite ? '∞' : diamondText(company.diamonds.amount)}
            </div>
            {/* 시즌패스와 설정은 위 줄의 오른쪽 끝에 둔다 (567번): 전투 공간과 아래 메뉴 사이의 단추 줄을 없앴다. */}
            <IdlePass company={company} />
            <IdleOptions
              company={company}
              onTutorial={() => {
                setReplay(-1)
                go('battle')
              }}
            />
            {COMPANY_ENABLED && (
              <button type="button" aria-label="회사 메뉴" onClick={onManage}>
                ☰
              </button>
            )}
          </header>
          {/* 전투 통계 (645번): 오른쪽 스킬 줄 위. 위 줄은 320px 화면에서 벽 번호가 잘려 자리가 없다. */}
          <IdleBattleStats company={company} />
          {idle?.rebirth && (
            <button
              type="button"
              className="idle-rebirth-shortcut"
              ref={rebirthButton}
              aria-label="환생"
              title="환생"
              data-testid="rebirth-shortcut"
              onClick={(event) => {
                // 터치 환경에서도 시트를 닫으면 이 버튼으로 포커스를 돌린다.
                event.currentTarget.focus()
                go('rebirth')
              }}
            >
              <img src={rebirthIcon} alt="" width={48} height={48} />
            </button>
          )}
          {/* 출석 보상은 들어오면 저절로 받는다 (566번): 단추가 없다. */}
          <IdleAttendance company={company} wait={offlineShowing || elsewhere} />
          <IdleSandbox company={company} />
          {menu === 'battle' && !elsewhere && (
            <VaultChallenges
              key={company.companyId}
              company={company}
              onBattleChange={setInVault}
            />
          )}
          {idle?.onboarding?.skillsUnlocked !== false && (
            <IdleActives
              company={company}
              connected={connected}
              autoPaused={inVault || elsewhere}
            />
          )}
          {menu === 'battle' && tutorial()}
          {/* 전투 화면에서 고양이를 꾹 누르면 그 고양이의 정보가 뜬다 (605번). */}
          <CatInfoCard
            company={company}
            onManage={(code) => {
              setWearer(code)
              navigate('cats')
            }}
          />
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
      <PowerSaveScreen company={company} />
      {menu !== 'battle' && menu !== 'company' && (
        <Sheet
          title={menu === 'rebirth' ? '환생' : menus.find((m) => m.key === menu)?.label}
          onClose={() => go('battle')}
          testId="idle-menu"
          className={`idle-sheet ${menu === 'cats' ? 'loadout-sheet' : ''}`}
          footer={nav}
        >
          {tutorial()}
          {menu === 'rebirth' && <IdleRebirth company={company} />}
          {menu === 'growth' && <IdleGrowth company={company} />}
          {menu === 'cats' && (
            <IdleCats
              company={company}
              picked={wearer}
              onPick={(code) => {
                // 전투에서 온 요청(사장냥 장비)을 보다가 다른 고양이를 고르면 그 요청을 지우고 이 탭에 머문다.
                if (weaponsAsked) {
                  useAppUi.getState().closeSheet()
                  setMenu('cats')
                  setLoadoutTab('무기')
                }
                setWearer(code)
              }}
              onSkills={
                tutorialMenuLocked(company, 'skills')
                  ? undefined
                  : () => {
                      setWearer(wearer)
                      navigate('skills')
                    }
              }
              tab={tab}
              onTab={(nextTab) => {
                if (weaponsAsked) {
                  useAppUi.getState().closeSheet()
                  setMenu('cats')
                }
                setLoadoutTab(nextTab)
              }}
            />
          )}
          {menu === 'skills' && <IdleSkills company={company} picked={wearer} onPick={setWearer} />}
          {menu === 'shop' && (
            <IdleShop
              key={shopKind}
              company={company}
              kind={shopKind}
              onUse={(kind, code) => {
                setWearer(code)
                // 뽑은 무기를 들렸으면 장비 목록으로, 고양이를 편성했으면 고양이 목록으로 돌아온다.
                setLoadoutTab(kind === 'cat' ? '고양이' : '무기')
                go('cats')
              }}
            />
          )}
          {(!connected || halted) && (
            <p className="idle-sheet-note">
              {connected
                ? '서킷브레이커 · 거래 재개 대기'
                : '연결을 기다리는 동안 전투가 멈춰 있어요'}
            </p>
          )}
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
  const shown = useCountUp(power, 450)
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
      <span>전투력</span>
      <strong>
        {gain > 0 && (
          <i className="idle-power-gain" data-testid="idle-power-gain">
            +{powerText(gain)}
          </i>
        )}
        {powerText(shown)}
      </strong>
    </div>
  )
}

/**
 * 성장 탭 (decisions.md 600번): 돈으로 올리는 강화와, 환생해서 얻은 생선으로 올리는 영구 강화를 탭으로 나눈다. 환생 카드는 영구 강화 쪽에 있다.
 */
function IdleGrowth({ company }: { company: Company }) {
  const [tab, setTab] = useState<'stats' | 'forever'>('stats')
  const fish = company.idle?.rebirth?.fish ?? 0
  const tabs = [
    { key: 'stats', label: '강화' },
    { key: 'forever', label: '영구 강화' },
  ] as const
  return (
    <>
      <div className="idle-growth-tabs" role="tablist" aria-label="성장">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`growth-tab-${t.key}`}
            onClick={() => {
              sfx.tap()
              setTab(t.key)
            }}
          >
            {t.label}
            {t.key === 'forever' && (
              <span className="idle-fish-count">
                <FishIcon />
                {fish.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'stats' ? (
        <>
          <p className="idle-subtitle">강해진 만큼, 더 빠르게 돌파해요</p>
          <IdleStats company={company} />
        </>
      ) : (
        <IdleForever company={company} />
      )}
    </>
  )
}

type FishUpgrade = NonNullable<
  NonNullable<NonNullable<Company['idle']>['rebirth']>['upgrades']
>[number]
/** 영구 강화 (600번): 전투 강화와 같은 능력치에 더해지고 환생해도 남는다. */
const FOREVER: Record<FishUpgrade['kind'], { name: string; unit: string }> = {
  damage: { name: '공격력', unit: '%' },
  hp: { name: '매수벽 체력', unit: '%' },
  buy: { name: '매수벽 공격', unit: '주' },
}

function IdleForever({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const rebirth = company.idle?.rebirth
  const [failed, setFailed] = useState<string | null>(null)
  if (!rebirth) return null
  return (
    <>
      <p className="idle-subtitle">환생해서 얻은 생선으로 올려요. 환생해도 사라지지 않아요</p>
      {(rebirth.upgrades ?? []).map((u) => (
        <article className="idle-stat" key={u.kind} data-testid="fish-upgrade" data-kind={u.kind}>
          <span className="idle-stat-icon" aria-hidden="true">
            <GrowthIcon name={u.kind} />
          </span>
          <div className="idle-stat-info">
            <b>
              {FOREVER[u.kind].name} <small>Lv.{u.level}</small>
            </b>
            <small>환생해도 그대로예요</small>
            <p>
              +{u.bonus.toLocaleString()}
              {FOREVER[u.kind].unit} → +{u.nextBonus.toLocaleString()}
              {FOREVER[u.kind].unit}
            </p>
          </div>
          <button
            type="button"
            className="idle-buy idle-fish-buy"
            disabled={busy || rebirth.fish < u.cost}
            onClick={async () => {
              setFailed(null)
              await useRaisingStore.getState().buyFishUpgrade(u.kind)
              const reason = useRaisingStore.getState().error
              if (reason) setFailed(reason)
              else sfx.levelUp()
            }}
          >
            강화
            <small>
              <FishIcon /> {u.cost.toLocaleString()}
            </small>
          </button>
        </article>
      ))}
      {failed && <p role="alert">{failed}</p>}
      <IdleRebirth company={company} />
    </>
  )
}

function IdleStats({ company }: { company: Company }) {
  const [count, setCount] = useState(1)
  const [buying, setBuying] = useState<Upgrade['kind'] | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const sequence = useRef(0)
  const [receipt, setReceipt] = useState<{
    kind: Upgrade['kind']
    id: number
    levels: number
    bonus: number
  } | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!receipt) return
    const timer = window.setTimeout(() => setReceipt(null), 1400)
    return () => window.clearTimeout(timer)
  }, [receipt])
  const [error, setError] = useState<string | null>(null)
  const autoKinds = useAutoUpgrade((s) => s.kinds)
  const toggleAuto = useAutoUpgrade((s) => s.toggle)
  return (
    <>
      <IdlePower power={company.idle?.power ?? 0} />
      <p className="idle-auto-note">
        <b>자동</b>을 켠 능력치는 돈이 모이는 대로 저절로 강화돼요(가장 싼 것부터)
      </p>
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
          <article
            className="idle-stat"
            key={u.kind}
            data-testid="idle-stat"
            data-kind={u.kind}
            data-upgraded={receipt?.kind === u.kind || undefined}
          >
            {receipt?.kind === u.kind && (
              <span key={receipt.id} className="idle-upgrade-burst" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
            <span className="idle-stat-icon" aria-hidden="true">
              <GrowthIcon name={u.kind} />
            </span>
            <div className="idle-stat-info">
              <b>
                {STATS[u.kind].name} <small>Lv.{u.level}</small>
              </b>
              <small>{u.kind === 'buy' ? buyNote(company, u) : STATS[u.kind].note}</small>
              <p aria-live="polite" aria-atomic="true">
                {receipt?.kind === u.kind ? (
                  <span key={receipt.id} className="idle-upgrade-gain" data-testid="upgrade-gain">
                    강화 완료! Lv.+{receipt.levels} · +{Number(receipt.bonus.toFixed(2))}
                    {receipt.kind === 'buy' ? '주' : '%'}
                  </span>
                ) : u.kind === 'buy' ? (
                  // 매수벽 공격은 %가 아니라 수량으로 오른다 (579번).
                  `+${(u.bonusShares ?? 0).toLocaleString()}주 → +${((u.bonusShares ?? 0) + ((u.nextBonusShares ?? 0) - (u.bonusShares ?? 0)) * levels).toLocaleString()}주`
                ) : full ? (
                  `+${percentText(u.bonusPercent)}% · 최대`
                ) : (
                  `+${percentText(u.bonusPercent)}% → +${percentText(u.bonusPercent + (u.nextBonusPercent - u.bonusPercent) * levels)}%`
                )}
              </p>
            </div>
            <button
              type="button"
              className="idle-buy"
              disabled={full || buying !== null || company.capital < price}
              aria-busy={buying === u.kind}
              data-pending={buying === u.kind || undefined}
              onClick={async () => {
                if (inFlight.current) return
                inFlight.current = true
                setBuying(u.kind)
                setReceipt(null)
                setError(null)
                // 누를 때와 강화가 될 때의 진동은 없앴다 (600번): 연달아 누르면 화면이 떨리는 것처럼 느껴졌다.
                try {
                  const result = await useRaisingStore.getState().buyBattleUpgrade(u.kind, levels)
                  if (!mounted.current) return
                  const after = result?.battleUpgrades?.find((item) => item.kind === u.kind)
                  if (after && after.level > u.level) {
                    setReceipt({
                      kind: u.kind,
                      id: ++sequence.current,
                      levels: after.level - u.level,
                      bonus:
                        u.kind === 'buy'
                          ? (after.bonusShares ?? 0) - (u.bonusShares ?? 0)
                          : after.bonusPercent - u.bonusPercent,
                    })
                    sfx.levelUp()
                  } else {
                    setError(
                      useRaisingStore.getState().error ?? '강화되지 않았어요. 다시 시도해 주세요.',
                    )
                    haptic.error()
                  }
                } catch {
                  if (mounted.current) {
                    setError('연결이 끊겼어요. 다시 시도해 주세요.')
                    haptic.error()
                  }
                } finally {
                  inFlight.current = false
                  if (mounted.current) setBuying(null)
                }
              }}
            >
              {buying === u.kind ? '강화 중…' : full ? 'MAX' : `강화 ×${levels}`}
              {!full && <small>{money(price)}</small>}
            </button>
            <label className="idle-auto-toggle" data-on={autoKinds.includes(u.kind) || undefined}>
              <input
                type="checkbox"
                data-testid="auto-upgrade"
                data-kind={u.kind}
                checked={autoKinds.includes(u.kind)}
                disabled={full}
                onChange={() => {
                  sfx.tap()
                  toggleAuto(u.kind)
                }}
              />
              자동
            </label>
          </article>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
