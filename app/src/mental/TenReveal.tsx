import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import './weapon-reveal.css'

/** 10연속 뽑기에서 나온 한 장 (517번). */
export type TenCard = {
  key: string
  art: ReactNode
  /** 등급·레벨 띠 */
  badge: string
  name: string
  /** NEW! / 합성 재료 +1 / 레벨 업 */
  note: string
  isNew: boolean
  color: string
  /** 연출 세기 0~3: 가장 센 한 장이 상자의 뜸과 빛을 정한다 */
  power: number
  /** 효과음 등급 */
  sound: Parameters<typeof sfx.weaponReveal>[0]
}

/**
 * 10연속 뽑기 연출 (decisions.md 517번): 한 번 뽑기와 같은 창·상자를 쓰고, 상자가 열리면 열 장이 차례로 뒤집힌다. 가장 좋은 한 장이 뜸의
 * 길이와 빛을 정한다. 결과는 이번 서버 응답의 스냅샷이다.
 */
export function TenReveal({
  label,
  testId,
  icon,
  loading,
  cards,
  canAgain,
  againNote,
  onClose,
  onAgain,
}: {
  label: string
  testId: string
  icon: string
  loading: string
  cards: TenCard[] | null
  canAgain: boolean
  /** 다시 뽑기 단추 아래 줄: 남은 뽑기권 */
  againNote: string
  onClose: () => void
  onAgain: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'charge' | 'open' | 'result'>('charge')
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sounded = useRef(false)
  const best = cards?.reduce((a, b) => (b.power > a.power ? b : a), cards[0]) ?? null
  const power = best?.power ?? 0
  const charge = [700, 1000, 1500, 2200][power] ?? 700
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      dialog.current?.close()
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    if (!cards) return
    if (reduced) {
      setPhase('result')
      return
    }
    sfx.charge()
    const open = setTimeout(
      () => setPhase((current) => (current === 'result' ? current : 'open')),
      charge,
    )
    const reveal = setTimeout(() => setPhase('result'), charge + 220)
    return () => {
      clearTimeout(open)
      clearTimeout(reveal)
    }
  }, [cards, reduced, charge])
  useEffect(() => {
    if (phase !== 'result' || !best || sounded.current || reduced) return
    sounded.current = true
    sfx.weaponReveal(best.sound)
    if (power >= 3) haptic.burst()
    else if (power >= 2) haptic.heavy()
    else haptic.light()
  }, [phase, best, power, reduced])
  useEffect(() => {
    if (phase === 'result')
      dialog.current?.querySelector<HTMLButtonElement>('.weapon-reveal-actions button')?.focus()
  }, [phase])
  const close = () => {
    if (cards) onClose()
  }
  const fresh = cards?.filter((c) => c.isNew).length ?? 0
  return createPortal(
    <dialog
      ref={dialog}
      className="weapon-reveal ten-reveal"
      aria-label={label}
      data-testid={testId}
      data-phase={phase}
      data-grade={best ? best.sound : undefined}
      data-power={power}
      style={{ '--reveal-color': best?.color ?? '#cbd5e1' } as CSSProperties}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onKeyDown={(e) => {
        // 아래 Sheet의 document Escape 처리까지 전달하지 않는다.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
        }
      }}
    >
      <div className="weapon-reveal-body">
        <div className="weapon-reveal-rays" aria-hidden="true" />
        {phase !== 'result' ? (
          <button
            type="button"
            className="weapon-reveal-stage"
            onClick={() => cards && setPhase('result')}
            disabled={!cards}
            data-testid={`${testId}-skip`}
          >
            <span className="weapon-case" aria-hidden="true">
              <i />
              <b>{icon}</b>
            </span>
            <strong>
              {!cards ? loading : phase === 'open' ? '10연속 개봉!' : '열 개의 상자가 떨려요…'}
            </strong>
            <small>{cards ? '화면을 누르면 바로 공개' : '잠시만 기다려 주세요'}</small>
          </button>
        ) : (
          cards && (
            <section className="ten-reveal-result" aria-live="polite">
              <p className="weapon-reveal-new">10연속 결과 · NEW {fresh}</p>
              <ul className="ten-reveal-grid">
                {cards.map((card, i) => (
                  <li
                    key={card.key}
                    className="ten-card"
                    data-testid={`${testId}-card`}
                    data-new={card.isNew}
                    data-power={card.power}
                    style={
                      {
                        '--card-color': card.color,
                        animationDelay: reduced ? undefined : `${i * 90}ms`,
                      } as CSSProperties
                    }
                  >
                    <span className="ten-card-badge">{card.badge}</span>
                    <span className="ten-card-art">{card.art}</span>
                    <b className="ten-card-name">{card.name}</b>
                    <small className="ten-card-note">{card.note}</small>
                  </li>
                ))}
              </ul>
              <div className="weapon-reveal-actions">
                <button type="button" onClick={onClose} data-testid={`${testId}-close`}>
                  닫기
                </button>
                {canAgain && (
                  <button type="button" onClick={onAgain} data-testid={`${testId}-again`}>
                    10연속 한 번 더 <small>{againNote}</small>
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
