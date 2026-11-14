import type { Company } from '@web/api/client'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { CatPortrait, catTrait } from './CatPortrait'
import '../mental/weapon-reveal.css'

type Cat = NonNullable<Company['idle']>['cats'][number]
export type CatDraw = { cat: Cat; isNew: boolean }

/** 새 고양이는 긴 뜸 뒤 금빛으로, 이미 가진 고양이(레벨 업)는 짧게 나온다. 무기 뽑기의 S·D 등급 연출과 같은 세기다. */
export function catRevealPlan(isNew: boolean) {
  return isNew
    ? { charge: 2100, power: 3, color: '#ffdd75', sound: 'S' as const }
    : { charge: 650, power: 1, color: '#76ccff', sound: 'D' as const }
}

/**
 * 고양이 뽑기 연출 (decisions.md 508번): 무기 뽑기(WeaponReveal)와 같은 창·상자·빛을 쓴다. 상자가 떨다 열리고 고양이가 나온다. 결과는 이번
 * 서버 응답의 스냅샷이다.
 */
export function CatReveal({
  result,
  tickets,
  onClose,
  onAgain,
}: {
  result: CatDraw | null
  tickets: number
  onClose: () => void
  onAgain: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'charge' | 'open' | 'result'>('charge')
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sounded = useRef(false)
  const plan = catRevealPlan(result?.isNew ?? false)
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
    sfx.weaponReveal(plan.sound)
    if (plan.power >= 3) haptic.burst()
    else haptic.light()
  }, [phase, result, plan.power, plan.sound, reduced])
  useEffect(() => {
    if (phase === 'result') dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [phase])
  const close = () => {
    if (result) onClose()
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="weapon-reveal cat-reveal"
      aria-label="고양이 뽑기"
      data-testid="cat-reveal"
      data-phase={phase}
      data-grade={result ? plan.sound : undefined}
      data-power={plan.power}
      style={{ '--reveal-color': plan.color } as CSSProperties}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onKeyDown={(e) => {
        // 아래 고양이 Sheet의 document Escape 처리까지 전달하지 않는다.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
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
            onClick={() => result && setPhase('result')}
            disabled={!result}
            data-testid="cat-reveal-skip"
          >
            <span className="weapon-case" aria-hidden="true">
              <i />
              <b>🐾</b>
            </span>
            <strong>
              {!result
                ? '고양이를 데려오는 중…'
                : phase === 'open'
                  ? '야옹!'
                  : '어떤 고양이가 기다릴까?'}
            </strong>
            <small>{result ? '화면을 누르면 바로 공개' : '잠시만 기다려 주세요'}</small>
          </button>
        ) : (
          result && (
            <section
              className="weapon-reveal-result"
              data-testid="cat-drawn"
              data-code={result.cat.code}
              data-new={result.isNew}
              aria-live="polite"
            >
              <p className="weapon-reveal-new">
                {result.isNew ? 'NEW! 새 고양이' : `레벨 업! Lv.${result.cat.level}`}
              </p>
              <span className="weapon-reveal-grade">
                고유 {result.cat.skillName} Lv.{result.cat.skillLevel}
              </span>
              <div className="weapon-reveal-art cat-reveal-art">
                <CatPortrait code={result.cat.code} />
              </div>
              <h2>{result.cat.name}</h2>
              <p className="weapon-reveal-stats">
                무기 공격력의 {result.cat.damagePercent}% · {catTrait(result.cat)}
              </p>
              <p className="weapon-reveal-effect">
                <b>{result.isNew ? '출전 칸에 세우면 함께 싸워요' : '총의 화력이 올랐어요'}</b>
                <br />
                출전해 있는 동안 {result.cat.skillName}이 나가요
                <br />
                {result.cat.skillNextLevel > 0
                  ? `고양이 Lv.${result.cat.skillNextLevel}이 되면 스킬이 Lv.${result.cat.skillLevel + 1}로 올라요`
                  : '스킬이 최고 레벨이에요'}
              </p>
              <div className="weapon-reveal-actions">
                <button type="button" onClick={onClose} data-testid="cat-reveal-close">
                  닫기
                </button>
                {tickets > 0 && (
                  <button type="button" onClick={onAgain} data-testid="cat-reveal-again">
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
