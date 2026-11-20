import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import './weapon-reveal.css'

/** 10연차에서 나온 한 장 (517번). */
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
  /** A등급 이상 (574번): 좋은 것을 뽑았다는 느낌이 들게 빛난다 */
  shiny: boolean
  /** S등급 이상 (576번): 더 좋은 장은 열리기 전의 뜸이 더 길다 */
  jackpot: boolean
}

/** 한 장이 뒷면으로 나와 열리기까지의 뜸(ms, 576번): 보통 장은 금방, A등급은 0.5초, S등급 이상은 1초. */
export function cardSuspense(card: Pick<TenCard, 'shiny' | 'jackpot'>): number {
  return card.jackpot ? 1000 : card.shiny ? 500 : 220
}

/** 10연차 단추에 붙는 덤 표시 (526번): 10연차는 열 개 값에 tenCount개가 나온다. 덤이 없으면 그리지 않는다. */
export function TenBonus({ count }: { count: number }) {
  const bonus = count - 10
  if (bonus < 1) return null
  return (
    <i className="ten-bonus" data-testid="ten-bonus">
      +{bonus}
    </i>
  )
}

/**
 * 10연차 연출 (decisions.md 517·526·574번): 한 번 뽑기와 같은 창·상자를 쓴다. 상자가 열리면 받은 장을 **한 장씩 크게** 보여 주고(누르면 다음
 * 장, "모두 보기"로 건너뛴다), 마지막에 뽑힌 장을 모두 모아 보여 준다. A등급 이상은 빛난다. 가장 좋은 한 장이 상자의 뜸과 모아 보기의 빛을
 * 정한다. 결과는 이번 서버 응답의 스냅샷이다.
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
  useAction,
}: {
  label: string
  testId: string
  icon: string
  loading: string
  cards: TenCard[] | null
  canAgain: boolean
  /** 다시 뽑기 단추 아래 줄: 10연차의 다이아 값 */
  againNote: ReactNode
  onClose: () => void
  useAction?: ReactNode
  onAgain: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'charge' | 'open' | 'cards' | 'result'>('charge')
  // 한 장씩 보는 동안 지금 보는 장과, 그 장이 열렸는가(뒷면 → 앞면, 576번).
  const [at, setAt] = useState(0)
  // 열린 장의 번호로 적는다: 다음 장으로 넘어가면 그 장은 저절로 뒷면이다.
  const [openedAt, setOpenedAt] = useState(-1)
  const opened = openedAt === at
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sounded = useRef(-1)
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
    // 움직임을 줄였으면 상자의 뜸 없이 바로 첫 장이다.
    if (reduced) {
      setPhase('cards')
      return
    }
    sfx.charge()
    const open = setTimeout(
      () => setPhase((current) => (current === 'charge' ? 'open' : current)),
      charge,
    )
    const reveal = setTimeout(
      () => setPhase((current) => (current === 'result' ? current : 'cards')),
      charge + 220,
    )
    return () => {
      clearTimeout(open)
      clearTimeout(reveal)
    }
  }, [cards, reduced, charge])
  const shown = phase === 'cards' ? (cards?.[at] ?? null) : null
  // 장은 뒷면으로 나온다 (576번). 뜸을 들인 뒤 스스로 열리고, 좋은 장일수록 뜸이 길다. 그동안 뒷면이 떨며 빛을 모은다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 장이 바뀔 때만 다시 덮는다.
  useEffect(() => {
    if (!shown) return
    if (reduced) {
      setOpenedAt(at)
      return
    }
    const wait = cardSuspense(shown)
    if (shown.shiny) sfx.cardTease(wait)
    else sfx.cardDeal()
    const open = setTimeout(() => setOpenedAt(at), wait)
    return () => clearTimeout(open)
  }, [at, phase === 'cards', reduced])
  // 열리는 순간 그 장의 등급으로 소리와 떨림을 낸다. 빛나는 장은 더 세게.
  useEffect(() => {
    if (!shown || !opened || sounded.current === at || reduced) return
    sounded.current = at
    sfx.cardFlip()
    sfx.weaponReveal(shown.sound)
    if (shown.jackpot) haptic.burst()
    else if (shown.shiny) haptic.heavy()
    else haptic.light()
  }, [shown, opened, at, reduced])
  useEffect(() => {
    if (phase === 'result')
      dialog.current?.querySelector<HTMLButtonElement>('.weapon-reveal-actions button')?.focus()
    if (phase === 'cards') dialog.current?.querySelector<HTMLButtonElement>('.ten-single')?.focus()
  }, [phase])
  const next = () => {
    if (!cards) return
    // 아직 뒷면이면 누른 것은 열기다.
    if (!opened) return setOpenedAt(at)
    if (at + 1 >= cards.length) setPhase('result')
    else setAt(at + 1)
  }
  const close = () => {
    if (cards) onClose()
  }
  const fresh = cards?.filter((c) => c.isNew).length ?? 0
  const shiny = cards?.filter((c) => c.shiny).length ?? 0
  // 한 장씩 볼 때는 그 장이, 그 밖에는 가장 좋은 장이 창의 빛을 정한다.
  // 뒷면인 동안에는 창이 등급을 미리 알려 주지 않는다.
  const lead = phase === 'cards' ? (opened ? shown : null) : best
  return createPortal(
    <dialog
      ref={dialog}
      className="weapon-reveal ten-reveal"
      aria-label={label}
      data-testid={testId}
      data-phase={phase}
      data-grade={lead ? lead.sound : undefined}
      data-power={lead?.power ?? 0}
      data-shiny={lead?.shiny ?? false}
      style={{ '--reveal-color': lead?.color ?? '#cbd5e1' } as CSSProperties}
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
        {phase === 'cards' && shown && cards ? (
          <section className="ten-single-view" aria-live="polite">
            <p className="ten-single-count" data-testid={`${testId}-count`}>
              {at + 1} / {cards.length}
            </p>
            {/* 한 장씩 (574번): 누르면 다음 장. 장마다 새로 그려 뒷면부터 다시 시작한다. */}
            <button
              key={shown.key}
              type="button"
              className="ten-single"
              onClick={next}
              data-testid={`${testId}-single`}
              data-new={shown.isNew}
              data-shiny={shown.shiny}
              data-jackpot={shown.jackpot}
              data-open={opened}
              aria-label={opened ? undefined : '뒤집힌 카드 · 누르면 바로 열기'}
              style={{ '--card-color': shown.color } as CSSProperties}
            >
              {/* 뒷면이었다가 앞면으로 뒤집힌다 (576번). 앞면이 카드의 크기를 정하고 뒷면이 그 위에 겹친다. */}
              <span className="ten-flip">
                <span className="ten-face ten-back" aria-hidden="true">
                  <b className="ten-back-mark">{icon}</b>
                </span>
                <span className="ten-face ten-front" aria-hidden={!opened}>
                  {shown.shiny && (
                    <span className="ten-single-wow" aria-hidden="true">
                      ✦ 대박! ✦
                    </span>
                  )}
                  <span className="ten-single-badge">{shown.badge}</span>
                  <span className="ten-single-art">{shown.art}</span>
                  <b className="ten-single-name">{shown.name}</b>
                  <small className="ten-single-note">{shown.note}</small>
                </span>
              </span>
              {/* 열리는 순간의 번쩍임: 빛나는 장에만. */}
              {shown.shiny && opened && <i className="ten-burst" aria-hidden="true" />}
            </button>
            <small className="ten-single-hint">
              {!opened
                ? shown.shiny
                  ? '두근두근…'
                  : '카드가 열려요'
                : at + 1 < cards.length
                  ? '카드를 누르면 다음 카드'
                  : '카드를 누르면 결과 모아 보기'}
            </small>
            <button
              type="button"
              className="ten-single-all"
              onClick={() => setPhase('result')}
              data-testid={`${testId}-all`}
            >
              모두 보기
            </button>
          </section>
        ) : phase !== 'result' ? (
          <button
            type="button"
            className="weapon-reveal-stage"
            onClick={() => cards && setPhase('cards')}
            disabled={!cards}
            data-testid={`${testId}-skip`}
          >
            <span className="weapon-case" aria-hidden="true">
              <i />
              <b>{icon}</b>
            </span>
            <strong>
              {!cards ? loading : phase === 'open' ? '10회 뽑기 개봉!' : '상자들이 떨려요…'}
            </strong>
            <small>{cards ? '화면을 누르면 바로 공개' : '잠시만 기다려 주세요'}</small>
          </button>
        ) : (
          cards && (
            <section className="ten-reveal-result" aria-live="polite">
              <p className="weapon-reveal-new">
                10회 뽑기 결과 {cards.length}개 · NEW {fresh}
                {shiny > 0 && ` · A등급 이상 ${shiny}`}
              </p>
              <ul className="ten-reveal-grid" data-count={cards.length}>
                {cards.map((card, i) => (
                  <li
                    key={card.key}
                    className="ten-card"
                    data-testid={`${testId}-card`}
                    data-new={card.isNew}
                    data-power={card.power}
                    data-shiny={card.shiny}
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
              {useAction}
              <div className="weapon-reveal-actions">
                <button type="button" onClick={onClose} data-testid={`${testId}-close`}>
                  닫기
                </button>
                {canAgain && (
                  <button type="button" onClick={onAgain} data-testid={`${testId}-again`}>
                    10회 한 번 더 <small>{againNote}</small>
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
