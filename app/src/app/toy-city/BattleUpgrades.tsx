import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { type CSSProperties, useEffect, useReducer, useRef, useState } from 'react'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { holdCharge, holdDelay, type UpgradeKind, UpgradeQueue } from './upgradeQueue'
import './battle-upgrades.css'

const TEXT: Record<UpgradeKind, { name: string; effect: string }> = {
  damage: { name: '공격력', effect: '탄 공격력' },
  fire: { name: '연사', effect: '쏘는 빠르기' },
  hp: { name: '매수벽 체력', effect: '최대 멘탈·매수벽' },
  buy: { name: '매수벽 공격', effect: '매수 주문 공격력' },
  crit: { name: '치명타 피해', effect: '치명타 배율' },
}

/**
 * 자본으로 사는 전투 강화 (decisions.md 367·394번): 공격력·연사·체력(410번)을 끝없이, 한 단계에 1%. 한 번 누르면 한 단계, 꾹 누르고 있으면 0.4초마다에서
 * 점점 빨라져 0.05초마다 오른다. 손을 떼거나 자본이 모자라면 멈춘다. 값과 효과는 서버가 정하고, 그사이는 줄에 선 단계까지 미리 셈해 보인다.
 */
export function BattleUpgrades({ company }: { company: Company }) {
  const error = useRaisingStore((s) => s.error)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [short, setShort] = useState<UpgradeKind | null>(null)
  const queue = useRef<UpgradeQueue | null>(null)
  if (!queue.current) {
    queue.current = new UpgradeQueue(
      (kind, levels) => useRaisingStore.getState().buyBattleUpgrade(kind, levels),
      () => useRaisingStore.getState().company,
      redraw,
      (kind) => setShort(kind),
    )
  }
  const q = queue.current
  const kinds = (company.battleUpgrades ?? []).map((u) => u.kind)
  return (
    <>
      <p className="toy-sheet-lead">멘탈 전투에 영구로 붙어요</p>
      <p className="text-sm text-muted">
        자본 <b data-testid="battle-upgrade-capital">{money(q.capital())}</b> · 꾹 누르면 점점
        빠르게 올라요
      </p>
      <ul className="toy-battle-upgrades" data-testid="battle-upgrades">
        {kinds.map((kind) => (
          <UpgradeRow
            key={kind}
            kind={kind}
            queue={q}
            short={short === kind}
            onShortSeen={() => setShort(null)}
          />
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-red-pen">
          {error}
        </p>
      )}
    </>
  )
}

function UpgradeRow({
  kind,
  queue,
  short,
  onShortSeen,
}: {
  kind: UpgradeKind
  queue: UpgradeQueue
  short: boolean
  onShortSeen: () => void
}) {
  const [holding, setHolding] = useState(false)
  const [step, setStep] = useState(0)
  const [denied, setDenied] = useState(0)
  const timer = useRef<number | null>(null)
  const steps = useRef(0)
  const v = queue.view(kind)

  const stop = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
    steps.current = 0
    setHolding(false)
    setStep(0)
  }
  /** 한 단계 올린다. 자본이 모자라면 멈추고 버튼이 고개를 젓는다. */
  const once = (): boolean => {
    if (!queue.push(kind)) {
      setDenied((n) => n + 1)
      haptic.error()
      return false
    }
    sfx.upgrade(steps.current)
    haptic.light()
    return true
  }
  const tick = () => {
    if (!once()) {
      stop()
      return
    }
    steps.current += 1
    setStep(steps.current)
    timer.current = window.setTimeout(tick, holdDelay(steps.current - 1))
  }
  const start = () => {
    if (timer.current != null) return
    setHolding(true)
    steps.current = 0
    tick()
  }

  // 서버가 덜 사 주었으면(자본) 꾹 누르기를 멈춘다.
  useEffect(() => {
    if (short) {
      if (timer.current != null) {
        window.clearTimeout(timer.current)
        timer.current = null
        steps.current = 0
        setHolding(false)
        setStep(0)
      }
      setDenied((n) => n + 1)
      onShortSeen()
    }
  }, [short, onShortSeen])
  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    },
    [],
  )

  if (!v) return null
  const text = TEXT[kind]
  const affordable = queue.affordable(kind)
  const speed = step >= 10 ? 'max' : step >= 4 ? 'fast' : 'slow'
  return (
    <li data-kind={kind} data-level={v.level} className="toy-upgrade-row">
      <div className="toy-upgrade-info">
        <b>{text.name}</b>{' '}
        <span key={v.level} className="toy-upgrade-level" data-speed={speed}>
          Lv.{v.level}
        </span>
        <p className="text-sm text-muted">
          {text.effect} <b className="toy-upgrade-bonus">+{v.bonusPercent}%</b> → +
          {v.nextBonusPercent}%
        </p>
      </div>
      <button
        type="button"
        className="toy-sheet-action toy-upgrade-buy"
        data-testid="battle-upgrade-buy"
        data-holding={holding || undefined}
        data-speed={holding ? speed : undefined}
        disabled={!holding && !affordable}
        aria-label={`${text.name} 강화 ${money(v.price)} (꾹 누르면 연속)`}
        style={{ '--charge': holdCharge(step) } as CSSProperties}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          e.preventDefault()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          start()
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          // 키보드(Enter·Space)로 누르면 한 단계. 손가락·마우스는 누르는 순간 이미 올렸다.
          if (e.detail === 0) once()
        }}
      >
        <span
          key={denied}
          className={denied > 0 ? 'toy-upgrade-price is-denied' : 'toy-upgrade-price'}
        >
          {money(v.price)}
        </span>
      </button>
    </li>
  )
}
