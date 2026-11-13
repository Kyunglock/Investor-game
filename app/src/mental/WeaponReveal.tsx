import type { Company } from '@web/api/client'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { GunSprite } from './GunSprite'
import type { Weapon } from './hero'
import { FIRE_STYLE_NAMES, SHOT_WEIGHT, WEAPON_EFFECTS } from './weaponEffects'
import { weaponRevealPlan } from './weaponRevealPlan'
import './weapon-reveal.css'

export type DrawResult = {
  draw: NonNullable<NonNullable<Company['armory']>['lastDraw']>
  weapon: Weapon
}

/** 최상위 모달이 인벤토리 시트의 포커스·터치를 가린다. 결과는 이번 서버 응답의 스냅샷이다. */
export function WeaponReveal({
  result,
  tickets,
  onClose,
  onAgain,
}: {
  result: DrawResult | null
  tickets: number
  onClose: () => void
  onAgain: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'charge' | 'open' | 'result'>('charge')
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sounded = useRef(false)
  const plan = weaponRevealPlan(result?.draw.grade ?? 'F')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      dialog.current?.close()
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    if (!result) return
    if (reduced) {
      setPhase('result')
      return
    }
    sfx.charge()
    const open = setTimeout(
      () => setPhase((current) => (current === 'result' ? current : 'open')),
      plan.charge,
    )
    const reveal = setTimeout(() => setPhase('result'), plan.charge + 220)
    return () => {
      clearTimeout(open)
      clearTimeout(reveal)
    }
  }, [result, reduced, plan.charge])
  useEffect(() => {
    if (phase !== 'result' || !result || sounded.current || reduced) return
    sounded.current = true
    sfx.weaponReveal(result.draw.grade)
    if (plan.power >= 3) haptic.burst()
    else if (plan.power >= 2) haptic.heavy()
    else haptic.light()
  }, [phase, result, plan.power, reduced])
  useEffect(() => {
    if (phase === 'result') dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [phase])
  const skip = () => {
    if (result) setPhase('result')
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="weapon-reveal"
      aria-label="무기 뽑기"
      data-testid="weapon-reveal"
      data-phase={phase}
      data-grade={result?.draw.grade}
      data-power={plan.power}
      style={{ '--reveal-color': plan.color } as CSSProperties}
      onCancel={(e) => {
        e.preventDefault()
        if (result) onClose()
      }}
      onKeyDown={(e) => {
        // 아래 인벤토리 Sheet의 document Escape 처리까지 전달하지 않는다.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          if (result) onClose()
        }
      }}
    >
      <div className="weapon-reveal-body">
        <div className="weapon-reveal-rays" aria-hidden="true" />
        <div className="weapon-reveal-sparks" aria-hidden="true">
          ✦ ✧ ✦ ✧ ✦
        </div>
        {phase !== 'result' ? (
          <button
            type="button"
            className="weapon-reveal-stage"
            onClick={skip}
            disabled={!result}
            data-testid="weapon-reveal-skip"
          >
            <span className="weapon-case" aria-hidden="true">
              <i />
              <b>★</b>
            </span>
            <strong>
              {!result
                ? '무기를 가져오는 중…'
                : phase === 'open'
                  ? '봉인 해제!'
                  : '어떤 무기가 기다릴까?'}
            </strong>
            <small>{result ? '화면을 누르면 바로 공개' : '잠시만 기다려 주세요'}</small>
          </button>
        ) : (
          result && (
            <section
              className="weapon-reveal-result"
              data-testid="weapon-drawn"
              data-new={result.draw.isNew}
              aria-live="polite"
            >
              <p className="weapon-reveal-new">
                {result.draw.isNew ? 'NEW! 새 무기' : '합성 재료 +1'}
              </p>
              <span className="weapon-reveal-grade">{result.draw.gradeName} 등급</span>
              <div className="weapon-reveal-art">
                <GunSprite kind={result.draw.kind} grade={result.draw.grade} width={210} />
              </div>
              <h2>{result.draw.name}</h2>
              <p className="weapon-reveal-stats">
                공격력 ×{(result.weapon.damagePercent / 100) * SHOT_WEIGHT} · 연사{' '}
                {(1000 / result.weapon.fireMs / SHOT_WEIGHT).toFixed(1)}발/초
              </p>
              <p>{FIRE_STYLE_NAMES[result.draw.kind]}</p>
              <p className="weapon-reveal-effect">
                <b>{WEAPON_EFFECTS[result.draw.kind].name}</b>
                <br />
                {WEAPON_EFFECTS[result.draw.kind].desc}
              </p>
              <div className="weapon-reveal-actions">
                <button type="button" onClick={onClose} data-testid="weapon-reveal-close">
                  닫기
                </button>
                {tickets > 0 && (
                  <button type="button" onClick={onAgain} data-testid="weapon-reveal-again">
                    한 번 더 뽑기 <small>뽑기권 {tickets}장</small>
                  </button>
                )}
              </div>
            </section>
          )
        )}
      </div>
    </dialog>,
    document.body,
  )
}
