import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { type ReactNode, useEffect, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { GachaScene } from '../app/scenes/GachaScene'
import { MAX_BATCH, queuedCost } from '../app/toy-city/upgradeQueue'
import { useAppUi } from '../app/ui'
import { WeaponInventory } from '../mental/WeaponInventory'
import { IdleCanvas } from './IdleCanvas'
import './idle-home.css'

type Menu = 'battle' | 'growth' | 'cats' | 'summon' | 'company'
const menus: { key: Menu; label: string; path: string }[] = [
  {
    key: 'battle',
    label: '돌파',
    path: 'm6 3 15 15-3 3L3 6V3h3Zm8 11 5-5m-5-6h7v7M3 21l6-6m-4-2 6 6',
  },
  { key: 'growth', label: '성장', path: 'M4 20V10h4v10m4 0V5h4v15m4 0V2M2 22h21' },
  {
    key: 'cats',
    label: '고양이',
    path: 'M4 12 3 3l7 4h4l7-4-1 9v4c0 6-16 6-16 0v-4Zm4 1h1m6 0h1m-6 4 2 1 2-1',
  },
  { key: 'summon', label: '소환', path: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z' },
  {
    key: 'company',
    label: '회사',
    path: 'M4 22V5l8-3 8 3v17M9 22v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1',
  },
]
const symbols: Record<string, string> = { water: '💧', meteor: '☄', bolt: 'ϟ', ram: '🪵' }

export function IdleHome({
  company,
  connected,
  onManage,
  managing,
  onBattle,
  office,
}: {
  company: Company
  connected: boolean
  onManage: () => void
  managing: boolean
  onBattle: () => void
  office: ReactNode
}) {
  const [menu, setMenu] = useState<Menu>('battle')
  const [part, setPart] = useState<'stats' | 'weapons' | 'skills'>('stats')
  const [summon, setSummon] = useState<'weapon' | 'staff'>('weapon')
  const idle = company.idle
  useEffect(() => {
    if (menu === 'battle' || menu === 'company') return
    const previous = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => setMenu('battle'))
    return () => useAppUi.getState().setModalBack(previous)
  }, [menu])
  const navigate = (next: Menu) => {
    if (next === 'company') {
      setMenu('battle')
      onManage()
    } else {
      setMenu(next)
      if (next === 'battle') onBattle()
    }
  }
  const activeMenu = menu === 'battle' && managing ? 'company' : menu
  const affordable = company.battleUpgrades?.some(
    (u) => u.kind !== 'hp' && u.price <= company.capital,
  )
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={item.path} />
          </svg>
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
          <span aria-hidden="true">{skill.owned ? symbols[skill.code] : '🔒'}</span>
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
            <div className="idle-cash">
              <span className="idle-coin">₩</span>
              <b>{money(company.capital)}</b>
            </div>
            <div
              className="idle-cash"
              role="status"
              aria-label={`무기 뽑기권 ${company.armory?.tickets ?? 0}장`}
            >
              <span aria-hidden="true">▣</span>
              {company.armory?.tickets ?? 0}
            </div>
            <button type="button" aria-label="회사 메뉴" onClick={onManage}>
              ☰
            </button>
          </header>
          <div className="idle-stage">
            <strong>매도벽 {(idle?.wall ?? 1).toLocaleString()}</strong>
            <em>
              {connected ? ((idle?.circuitSeconds ?? 0) > 0 ? '거래 정지' : '● AUTO') : '연결 대기'}
            </em>
            <p>
              {idle?.boss
                ? '대량 매도 큰손 등장'
                : `큰손 등장까지 ${10 - ((idle?.wall ?? 1) % 10)}벽`}
            </p>
          </div>
        </>
      )}
      {nav}
      {menu !== 'battle' && menu !== 'company' && (
        <Sheet
          title={menus.find((m) => m.key === menu)?.label}
          onClose={() => setMenu('battle')}
          testId="idle-menu"
          className="idle-sheet"
          footer={nav}
        >
          {menu === 'growth' && (
            <>
              <p className="idle-subtitle">강해진 만큼, 더 빠르게 돌파해요</p>
              <div className="idle-tabs" role="tablist" aria-label="성장 분류">
                {(['stats', 'weapons', 'skills'] as const).map((key, i) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={part === key}
                    onClick={() => setPart(key)}
                  >
                    {['능력치', '무기', '스킬'][i]}
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
          {menu === 'cats' && (
            <>
              <p className="idle-subtitle">돌파 보상으로 얻은 고양이가 함께 싸워요</p>
              <div className="idle-collection">
                <article className="owned">
                  <span aria-hidden="true">🐱</span>
                  <div>
                    <b>사장냥</b>
                    <small>기본 동료 · 장착한 무기로 자동 공격</small>
                  </div>
                </article>
                {idle?.skills
                  .filter((s) => ['meteor', 'ram'].includes(s.code))
                  .map((s) => (
                    <article key={s.code} className={s.owned ? 'owned' : ''}>
                      <span aria-hidden="true">{s.owned ? '🐱' : '🔒'}</span>
                      <div>
                        <b>{s.name}</b>
                        <small>
                          {s.owned ? '획득 · 함께 전투 중' : `${s.unlockWall}벽 돌파 시 합류`}
                        </small>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {menu === 'summon' && (
            <>
              <div className="idle-tabs">
                <button
                  type="button"
                  aria-pressed={summon === 'weapon'}
                  onClick={() => setSummon('weapon')}
                >
                  무기 뽑기
                </button>
                <button
                  type="button"
                  aria-pressed={summon === 'staff'}
                  onClick={() => setSummon('staff')}
                >
                  직원 채용
                </button>
              </div>
              {summon === 'weapon' ? (
                <WeaponInventory company={company} />
              ) : (
                <GachaScene company={company} />
              )}
            </>
          )}
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
        <span>초당 공격력</span>
        <strong>{Math.round(company.idle?.dps ?? 0).toLocaleString()}</strong>
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
      {company.battleUpgrades
        ?.filter((u) => u.kind !== 'hp')
        .map((u) => {
          let levels = count
          while (
            levels > 1 &&
            queuedCost(u.price, u.priceGrowthPercent, 0, levels) > company.capital
          )
            levels--
          const price = queuedCost(u.price, u.priceGrowthPercent, 0, levels)
          return (
            <article className="idle-stat" key={u.kind}>
              <span className="idle-stat-icon" aria-hidden="true">
                {u.kind === 'damage' ? '⚔' : '➶'}
              </span>
              <div className="idle-stat-info">
                <b>
                  {u.kind === 'damage' ? '공격력' : '공격 속도'} <small>Lv.{u.level}</small>
                </b>
                <p>
                  +{u.bonusPercent}% → +
                  {u.bonusPercent + (u.nextBonusPercent - u.bonusPercent) * levels}%
                </p>
              </div>
              <button
                type="button"
                className="idle-buy"
                disabled={buying || company.capital < price}
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
                강화 ×{levels}
                <small>{money(price)}</small>
              </button>
            </article>
          )
        })}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
