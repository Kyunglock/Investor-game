import { DiamondPrice } from '@web/features/raising/DiamondIcon'

export type RepeatDraw = {
  left: number
  limit: number
  watching: boolean
  busy: boolean
  error: string | null
  onAd: () => void
}

/** 무료 광고와 다이아 지출을 결과 화면에서도 별개의 행동으로 보여 준다. */
export function DrawAgain({
  kind,
  price,
  canAgain,
  onAgain,
  onClose,
  repeat,
}: {
  kind: 'cat' | 'weapon'
  price: number
  canAgain: boolean
  onAgain: () => void
  onClose: () => void
  repeat: RepeatDraw
}) {
  const pending = repeat.watching || repeat.busy
  return (
    <>
      {repeat.error && <p role="alert">{repeat.error}</p>}
      <div className="weapon-reveal-actions draw-repeat-actions">
        <button
          type="button"
          className="draw-repeat-ad"
          data-testid={`${kind}-reveal-ad`}
          disabled={pending || repeat.left === 0}
          onClick={repeat.onAd}
        >
          {repeat.watching
            ? '광고 시청 중…'
            : repeat.left > 0
              ? '광고로 한 번 더'
              : '오늘 광고 뽑기 완료'}
          <small>
            무료 · 오늘 {repeat.left} / {repeat.limit}회 남음
          </small>
        </button>
        <button
          type="button"
          data-testid={`${kind}-reveal-again`}
          disabled={pending || !canAgain}
          onClick={onAgain}
        >
          다이아로 뽑기 <DiamondPrice amount={price} />
          {!canAgain && <small>다이아가 모자라요</small>}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          data-testid={`${kind}-reveal-close`}
        >
          닫기
        </button>
      </div>
    </>
  )
}
