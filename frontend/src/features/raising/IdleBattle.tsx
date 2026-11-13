import type { ReactNode } from 'react'
import { useState } from 'react'
import type { Company } from '../../api/client'
import { money } from '../game/labels'
import { useRaisingStore } from './store'
import './idle-battle.css'

const symbols: Record<string, string> = { water: '💧', meteor: '☄️', bolt: '⚡', ram: '🪵' }
export function IdleBattle({
  company,
  connected,
  children,
  onManage,
}: {
  company: Company
  connected: boolean
  children?: ReactNode
  onManage: () => void
}) {
  const idle = company.idle
  const [buying, setBuying] = useState(false)
  const error = useRaisingStore((s) => s.error)
  if (!idle) return <p role="status">자동 전투를 준비하고 있어요…</p>
  const percent = Math.max(0, Math.min(100, (idle.hp / idle.maxHp) * 100))
  return (
    <section className={`idle-home ${connected ? 'idle-running' : ''}`} data-testid="idle-battle">
      <header className="idle-heading">
        <div>
          <small>끝없이 오르는 고양이 투자단</small>
          <h1>매도벽 돌파</h1>
        </div>
        <button type="button" onClick={onManage}>
          회사 관리 ↗
        </button>
      </header>
      <div className="idle-wallet">
        <span>
          보유 자본 <b>{money(company.capital)}</b>
        </span>
        <span className="idle-live">{connected ? '● 자동 전투 중' : '○ 연결 중 · 전투 대기'}</span>
      </div>
      <section className="idle-arena" aria-label="자동 매도벽 전투">
        <div className="idle-road" />
        <div className="idle-wave">
          <small>{idle.boss ? '대량 매도 큰손' : '멈추지 않는 돌파'}</small>
          <strong>매도벽 {idle.wall.toLocaleString()}</strong>
          <span>10벽마다 보스 · 무기 뽑기권 획득</span>
        </div>
        <div key={idle.wall} className={`idle-wall ${idle.boss ? 'idle-boss' : ''}`}>
          <strong>{idle.boss ? '🐋 대량 매도벽' : '매도 주문'}</strong>
          <div className="idle-bricks" aria-hidden="true">
            {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((id) => (
              <span key={id}>{Math.ceil(idle.hp / 12).toLocaleString()}주</span>
            ))}
          </div>
          <progress aria-label="매도벽 남은 체력" max={idle.maxHp} value={idle.hp} />
          <small>
            {Math.ceil(idle.hp).toLocaleString()} / {Math.ceil(idle.maxHp).toLocaleString()} ·{' '}
            {percent.toFixed(0)}%
          </small>
        </div>
        <div className="idle-shots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="idle-magic" aria-hidden="true">
          {idle.skills
            .filter((s) => s.owned)
            .map((s) => (
              <span key={s.code} className={`idle-spell idle-${s.code}`}>
                {symbols[s.code]}
              </span>
            ))}
        </div>
        <div className="idle-team">
          {children ?? (
            <span className="idle-cat" role="img" aria-label="사장 고양이">
              🐱
            </span>
          )}
          {idle.skills
            .filter((s) => s.owned && ['meteor', 'ram'].includes(s.code))
            .map((s) => (
              <span className="idle-cat" role="img" key={s.code} aria-label={s.name}>
                🐱<small>{symbols[s.code]}</small>
              </span>
            ))}
        </div>
        <div className="idle-power">
          초당 공격력 <b>{Math.round(idle.dps).toLocaleString()}</b>{' '}
          <span>누적 수익 {money(idle.earned)}</span>
        </div>
      </section>
      <div className="idle-growth">
        <h2>돌파 보상 · 스킬과 고양이</h2>
        <p>
          {idle.nextUnlock
            ? `${idle.nextUnlock}벽 돌파 시 다음 능력 획득`
            : '모든 능력을 획득했어요. 강화로 더 멀리!'}{' '}
          · 획득하면 자동 사용
        </p>
        <div className="idle-skills">
          {idle.skills.map((s) => (
            <div key={s.code} className={s.owned ? 'owned' : ''}>
              <span>{s.owned ? symbols[s.code] : '🔒'}</span>
              <b>{s.name}</b>
              <small>{s.owned ? '획득 · 자동 사용' : `${s.unlockWall}벽 돌파 보상`}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="idle-upgrades">
        {company.battleUpgrades
          ?.filter((u) => u.kind !== 'hp')
          .map((u) => (
            <button
              key={u.kind}
              type="button"
              disabled={buying || company.capital < u.price}
              onClick={async () => {
                setBuying(true)
                try {
                  await useRaisingStore.getState().buyBattleUpgrade(u.kind)
                } finally {
                  setBuying(false)
                }
              }}
            >
              <span>
                {u.kind === 'damage' ? '⚔ 공격력' : '➶ 공격 속도'} <b>Lv.{u.level}</b>
              </span>
              <strong>{money(u.price)} · 강화</strong>
              <small>
                +{u.bonusPercent}% → +{u.nextBonusPercent}%
              </small>
            </button>
          ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="idle-footnote">
        앱을 켜 둔 동안만 진행돼요. 종료·백그라운드에서는 멈추고, 다시 켜면 이어서 돌파해요.
      </p>
    </section>
  )
}
